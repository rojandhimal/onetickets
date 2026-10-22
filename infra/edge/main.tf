# Cloudflare in front of staging and production (SEC-5). One stack for the
# zone, because Cloudflare allows one ruleset per phase per zone and both
# environments share the domain. Apply it after the environments: it reads
# their hostnames, load balancers and origin header from their state.
#
# Together with behind_cloudflare in modules/app (load balancer limited to
# Cloudflare's IP ranges and to requests carrying the origin header, and
# TRUST_PROXY_HOPS=2), this is one change: apply the environment, then this
# stack straight after. Until this stack is applied the app answers 404.

data "terraform_remote_state" "env" {
  for_each = var.environments

  backend = "s3"
  config = {
    bucket = var.state_bucket
    key    = "${each.key}/terraform.tfstate"
    region = "ap-southeast-2"
  }
}

locals {
  envs = {
    for name, state in data.terraform_remote_state.env : name => {
      web_hostname  = state.outputs.web_hostname
      api_hostname  = state.outputs.api_hostname
      load_balancer = state.outputs.load_balancer_dns_name
      origin_header = state.outputs.origin_verify_header
    }
  }

  records = merge([
    for name, env in local.envs : {
      "${name}-web" = { hostname = env.web_hostname, target = env.load_balancer }
      "${name}-api" = { hostname = env.api_hostname, target = env.load_balancer }
    }
  ]...)

  all_hosts = sort(flatten([for env in local.envs : [env.web_hostname, env.api_hostname]]))
  web_hosts = sort([for env in local.envs : env.web_hostname])
  api_hosts = sort([for env in local.envs : env.api_hostname])

  # Paths that send a sign-in email or check a sign-in code. In the browser
  # they go through the web app's /api rewrite; the api hostname serves them
  # without the prefix. The free plan can only match on the path, not the
  # host or method, so the list holds both forms. The api (Express) ignores
  # case and a trailing slash, so the rule lowercases the path and lists each
  # path with and without the slash.
  sign_in_paths = [
    "/api/auth/magic-link",
    "/api/auth/magic-link/verify",
    "/api/auth/mfa/verify",
    "/auth/magic-link",
    "/auth/magic-link/verify",
    "/auth/mfa/verify",
  ]
  sign_in_expression = "lower(http.request.uri.path) in {${join(" ", formatlist("\"%s\"", flatten([for path in local.sign_in_paths : [path, "${path}/"]])))}}"
  csp_expression     = "lower(http.request.uri.path) in {\"/csp-report\" \"/csp-report/\"}"

  # Per client IP, per Cloudflare data centre. Each limit sits well above
  # what a person does: a sign-in takes two or three of these requests, and a
  # page sends at most a few CSP reports. The api's own per-IP and per-email
  # limits still apply behind these.
  rate_limit_rules = {
    # One rule, counting both kinds of request together in one 20-per-10-s
    # per-IP counter: a burst of CSP reports from browsers behind a shared NAT
    # can spend that IP's sign-in budget for 10 s until the zone moves to Pro.
    free = [{
      description = "Sign-in and CSP reports: 20 requests in 10 s per IP"
      expression  = "(${local.sign_in_expression}) or (${local.csp_expression})"
      period      = 10
      requests    = 20
      timeout     = 10
    }]
    pro = [
      {
        description = "Sign-in: 10 requests a minute per IP, then blocked for 10 minutes"
        expression  = local.sign_in_expression
        period      = 60
        requests    = 10
        timeout     = 600
      },
      {
        description = "CSP reports: 30 a minute per IP, then blocked for a minute"
        expression  = local.csp_expression
        period      = 60
        requests    = 30
        timeout     = 60
      },
    ]
  }
}

# Proxied, so visitors only ever reach Cloudflare. The apex works as a CNAME
# because Cloudflare flattens it. Certificate validation and email records
# stay "DNS only" and are added by hand (infra/README.md).
resource "cloudflare_dns_record" "app" {
  for_each = local.records

  zone_id = var.zone_id
  name    = each.value.hostname
  type    = "CNAME"
  content = each.value.target
  proxied = true
  ttl     = 1 # automatic, required for proxied records
  comment = "Managed by Terraform (infra/edge)"
}

# Cloudflare checks the load balancer's certificate (Full (strict)) for our
# hostnames only, leaving any other site on the domain as it is.
resource "cloudflare_ruleset" "config" {
  zone_id = var.zone_id
  name    = "OneTickets configuration"
  kind    = "zone"
  phase   = "http_config_settings"

  rules = [{
    description = "Full (strict) TLS to the load balancer"
    expression  = "http.host in {${join(" ", formatlist("\"%s\"", local.all_hosts))}}"
    action      = "set_config"
    action_parameters = {
      ssl = "strict"
    }
  }]
}

# Request headers, set at the edge where clients can't influence them.
resource "cloudflare_ruleset" "request_headers" {
  zone_id = var.zone_id
  name    = "OneTickets request headers"
  kind    = "zone"
  phase   = "http_request_late_transform"

  rules = concat(
    # The load balancer only forwards app requests that carry this header,
    # so nothing can reach the app without passing through this zone.
    [for name, env in local.envs : {
      description = "Origin header for ${name}"
      expression  = "http.host in {\"${env.web_hostname}\" \"${env.api_hostname}\"}"
      action      = "rewrite"
      action_parameters = {
        headers = {
          (env.origin_header.name) = {
            operation = "set"
            value     = env.origin_header.value
          }
        }
      }
    }],
    # Only the web app's server may continue a trace in the api; a client
    # could otherwise choose trace ids and force sampling. The browser's own
    # traces into the web app's pages are unaffected.
    [{
      description = "Drop client trace headers on the way to the api"
      expression  = "(http.host in {${join(" ", formatlist("\"%s\"", local.api_hosts))}}) or (http.host in {${join(" ", formatlist("\"%s\"", local.web_hosts))}} and starts_with(lower(http.request.uri.path), \"/api/\"))"
      action      = "rewrite"
      action_parameters = {
        headers = {
          "sentry-trace" = { operation = "remove" }
          "baggage"      = { operation = "remove" }
        }
      }
    }],
  )
}

# Banners (the API at /api/public/banners/<key>) carry
# `public, max-age=31536000, immutable` and every upload gets a new key, so
# nothing ever needs purging. The edge keeps them for 30 days, not the year
# the origin allows, so a removed banner is gone from Cloudflare within the
# same 30 days the uploads bucket keeps old versions. Said explicitly rather
# than left to Cloudflare's by-extension default.
resource "cloudflare_ruleset" "cache" {
  zone_id = var.zone_id
  name    = "OneTickets cache"
  kind    = "zone"
  phase   = "http_request_cache_settings"

  rules = [{
    description = "Cache event banners"
    expression  = "http.host in {${join(" ", formatlist("\"%s\"", local.web_hosts))}} and starts_with(lower(http.request.uri.path), \"/api/public/banners/\")"
    action      = "set_cache_settings"
    action_parameters = {
      cache = true
      edge_ttl = {
        mode    = "override_origin"
        default = 2592000 # 30 days
        # Never keep errors: a 404 for a key that doesn't exist yet must not
        # stick for 30 days.
        status_code_ttl = [{
          status_code_range = { from = 400, to = 599 }
          value             = -1 # no-store
        }]
      }
      browser_ttl = { mode = "respect_origin" }
    }
  }]
}

resource "cloudflare_ruleset" "rate_limits" {
  zone_id = var.zone_id
  name    = "OneTickets rate limits"
  kind    = "zone"
  phase   = "http_ratelimit"

  rules = [for rule in local.rate_limit_rules[var.cloudflare_plan] : {
    description = rule.description
    expression  = rule.expression
    action      = "block"
    ratelimit = {
      characteristics     = ["ip.src", "cf.colo.id"]
      period              = rule.period
      requests_per_period = rule.requests
      mitigation_timeout  = rule.timeout
    }
  }]
}
