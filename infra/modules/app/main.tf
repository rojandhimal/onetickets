# Everything that runs the OneTickets containers in one environment: image
# repositories, the ECS cluster, the load balancer, and one Fargate service per
# app. CI owns which image each service runs (it registers new task definition
# revisions); Terraform owns everything else and ignores the task definition
# the services point at.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

locals {
  region = data.aws_region.current.region

  # How the db-roles task (plain psql) reaches Postgres as the owner.
  psql_environment = [
    { name = "PGHOST", value = var.db_address },
    { name = "PGDATABASE", value = "onetickets" },
    { name = "PGSSLMODE", value = "require" },
  ]

  internal_namespace = "onetickets.internal"
  internal_api_url   = "http://api.${local.internal_namespace}:3001"

  services = {
    api = {
      port              = 3001
      health_check_path = var.api_health_check_path
      hostnames         = [var.api_hostname]
      cpu               = var.api_cpu
      memory            = var.api_memory
      desired_count     = var.api_desired_count
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3001" },
        { name = "APP_ENV", value = var.environment },
        { name = "WEB_URL", value = "https://${var.web_hostname}" },
        { name = "MAIL_TRANSPORT", value = "ses" },
        { name = "EMAIL_FROM_DOMAIN", value = var.email_domain },
        { name = "TRUST_PROXY_HOPS", value = tostring(var.api_trust_proxy_hops) },
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = "${var.db_app_secret_arn}:url::" },
        { name = "MFA_ENCRYPTION_KEY", valueFrom = "${aws_secretsmanager_secret.api.arn}:mfa_encryption_key::" },
        { name = "GOOGLE_CLIENT_ID", valueFrom = "${aws_secretsmanager_secret.google_oauth.arn}:client_id::" },
        { name = "GOOGLE_CLIENT_SECRET", valueFrom = "${aws_secretsmanager_secret.google_oauth.arn}:client_secret::" },
      ]
      command = null
    }
    web = {
      port              = 3000
      health_check_path = "/"
      hostnames         = [var.web_hostname]
      cpu               = var.web_cpu
      memory            = var.web_memory
      desired_count     = var.web_desired_count
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3000" },
        { name = "APP_ENV", value = var.environment },
        # Private address of the API (Cloud Map), the same in every
        # environment, so it can be baked into the image at build time.
        { name = "API_URL", value = local.internal_api_url },
      ]
      secrets = []
      command = null
    }
  }
}

# ---------------------------------------------------------------------------
# Image repositories. Staging builds and pushes; production receives the same
# image by digest when a release is approved.
# ---------------------------------------------------------------------------

resource "aws_ecr_repository" "app" {
  for_each = local.services

  name                 = "onetickets/${each.key}"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  # AES256 rather than the environment's KMS key, so production can pull
  # staging's images without a cross-account key grant.
  encryption_configuration {
    encryption_type = "AES256"
  }
}

# Lets another account (production) pull images from this one (staging), so a
# release promotes the exact image staging tested.
data "aws_iam_policy_document" "ecr_cross_account_pull" {
  count = length(var.ecr_pull_account_ids) > 0 ? 1 : 0

  statement {
    actions = [
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchCheckLayerAvailability",
    ]
    principals {
      type        = "AWS"
      identifiers = [for id in var.ecr_pull_account_ids : "arn:aws:iam::${id}:root"]
    }
  }
}

resource "aws_ecr_repository_policy" "app" {
  for_each = length(var.ecr_pull_account_ids) > 0 ? aws_ecr_repository.app : {}

  repository = each.value.name
  policy     = data.aws_iam_policy_document.ecr_cross_account_pull[0].json
}

resource "aws_ecr_lifecycle_policy" "app" {
  for_each   = aws_ecr_repository.app
  repository = each.value.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last 50 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 50
      }
      action = { type = "expire" }
    }]
  })
}

# ---------------------------------------------------------------------------
# Cluster, logs and IAM
# ---------------------------------------------------------------------------

resource "aws_ecs_cluster" "this" {
  name = var.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "app" {
  for_each = toset(["api", "web", "migrate", "db-roles"])

  name              = "/onetickets/${var.environment}/${each.key}"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn
}

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

# Used by the ECS agent to pull images, write logs and read secrets at start.
resource "aws_iam_role" "execution" {
  name               = "${var.name}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# App secrets Terraform can generate. MFA_ENCRYPTION_KEY encrypts stored TOTP
# seeds; rotating it means re-encrypting them, so it is generated once.
resource "random_bytes" "mfa_encryption_key" {
  length = 32
}

resource "aws_secretsmanager_secret" "api" {
  name                    = "${var.name}/api"
  description             = "Generated API secrets"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "api" {
  secret_id = aws_secretsmanager_secret.api.id
  secret_string = jsonencode({
    mfa_encryption_key = random_bytes.mfa_encryption_key.base64
  })
}

# Filled in by hand once the Google OAuth client exists (see infra/README.md).
# Terraform creates it empty and never overwrites what is put there.
resource "aws_secretsmanager_secret" "google_oauth" {
  name                    = "${var.name}/google-oauth"
  description             = "Google OAuth client for organiser sign-in"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "google_oauth" {
  secret_id     = aws_secretsmanager_secret.google_oauth.id
  secret_string = jsonencode({ client_id = "", client_secret = "" })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

data "aws_iam_policy_document" "execution_secrets" {
  statement {
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      var.db_app_secret_arn,
      var.db_owner_secret_arn,
      aws_secretsmanager_secret.api.arn,
      aws_secretsmanager_secret.google_oauth.arn,
    ]
  }
  statement {
    actions   = ["kms:Decrypt"]
    resources = [var.kms_key_arn]
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

# Identity of the running app code. Starts with uploads access only; add
# grants here as features need them (SES, KMS signing).
resource "aws_iam_role" "task" {
  name               = "${var.name}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

data "aws_iam_policy_document" "task" {
  statement {
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.uploads.arn}/*"]
  }
  statement {
    actions   = ["kms:Decrypt", "kms:GenerateDataKey"]
    resources = [var.kms_key_arn]
  }
  statement {
    actions   = ["ses:SendEmail", "ses:SendRawEmail"]
    resources = [var.ses_identity_arn]
  }
}

resource "aws_iam_role_policy" "task" {
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task.json
}

# ---------------------------------------------------------------------------
# Networking: load balancer in public subnets, tasks in private subnets
# ---------------------------------------------------------------------------

resource "aws_security_group" "alb" {
  name        = "${var.name}-alb"
  description = "Public HTTPS into the load balancer"
  vpc_id      = var.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "alb" {
  for_each = { for pair in setproduct(var.ingress_cidrs, [80, 443]) : "${pair[0]}-${pair[1]}" => pair }

  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = each.value[0]
  ip_protocol       = "tcp"
  from_port         = each.value[1]
  to_port           = each.value[1]
}

resource "aws_vpc_security_group_egress_rule" "alb_to_tasks" {
  security_group_id            = aws_security_group.alb.id
  referenced_security_group_id = aws_security_group.tasks.id
  ip_protocol                  = "tcp"
  from_port                    = 3000
  to_port                      = 3001
}

resource "aws_security_group" "tasks" {
  name        = "${var.name}-tasks"
  description = "ECS tasks; inbound only from the load balancer"
  vpc_id      = var.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "tasks_from_alb" {
  security_group_id            = aws_security_group.tasks.id
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = 3000
  to_port                      = 3001
}

# The web app forwards /api calls to the API directly over the private network.
resource "aws_vpc_security_group_ingress_rule" "tasks_from_tasks" {
  security_group_id            = aws_security_group.tasks.id
  referenced_security_group_id = aws_security_group.tasks.id
  ip_protocol                  = "tcp"
  from_port                    = 3001
  to_port                      = 3001
}

resource "aws_service_discovery_private_dns_namespace" "internal" {
  name = local.internal_namespace
  vpc  = var.vpc_id
}

resource "aws_service_discovery_service" "api" {
  name = "api"

  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.internal.id
    routing_policy = "MULTIVALUE"

    dns_records {
      type = "A"
      ttl  = 10
    }
  }

  # ECS reports task health to Cloud Map, so unhealthy tasks leave DNS.
  health_check_custom_config {}
}

# Tasks call Postgres, AWS APIs and third parties (Stripe, Google).
resource "aws_vpc_security_group_egress_rule" "tasks_all" {
  security_group_id = aws_security_group.tasks.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_lb" "this" {
  name               = var.name
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids
  idle_timeout       = 60

  drop_invalid_header_fields = true
  enable_deletion_protection = var.deletion_protection
}

resource "aws_acm_certificate" "this" {
  domain_name               = var.web_hostname
  subject_alternative_names = [var.api_hostname]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# DNS is in Cloudflare, so validation records are added there by hand (see the
# `certificate_validation_records` output). Apply waits here until they exist.
resource "aws_acm_certificate_validation" "this" {
  certificate_arn = aws_acm_certificate.this.arn
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.this.certificate_arn

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Not found"
      status_code  = "404"
    }
  }
}

resource "aws_lb_target_group" "app" {
  for_each = local.services

  name                 = "${var.name}-${each.key}"
  port                 = each.value.port
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = var.vpc_id
  deregistration_delay = 30

  health_check {
    path                = each.value.health_check_path
    matcher             = "200-399"
    interval            = 15
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener_rule" "app" {
  for_each = local.services

  listener_arn = aws_lb_listener.https.arn
  priority     = each.key == "api" ? 10 : 20

  condition {
    host_header {
      values = each.value.hostnames
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app[each.key].arn
  }
}

# ---------------------------------------------------------------------------
# Task definitions and services. The image here is only the first revision's;
# deploys register new revisions with the image CI built.
# ---------------------------------------------------------------------------

resource "aws_ecs_task_definition" "app" {
  for_each = local.services

  family                   = "${var.name}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name                   = each.key
    image                  = "${aws_ecr_repository.app[each.key].repository_url}:bootstrap"
    essential              = true
    portMappings           = [{ containerPort = each.value.port, protocol = "tcp" }]
    environment            = each.value.environment
    secrets                = each.value.secrets
    readonlyRootFilesystem = false
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.app[each.key].name
        awslogs-region        = local.region
        awslogs-stream-prefix = each.key
      }
    }
  }])

  lifecycle {
    ignore_changes = [container_definitions]
  }
}

# One-off tasks the deploy runs, in order, before updating services. Both
# connect as the schema owner, which the API never sees.
#
# migrate:  the API image's migration command (MIGRATION_DATABASE_URL).
# db-roles: plain psql that makes sure the API's login exists, has the current
#           password and is a member of the ot_app group role the migrations
#           create. Kept out of the app so the password never passes through
#           app code or migration files.
locals {
  db_roles_sql = <<-SQL
    SELECT format('CREATE ROLE %I LOGIN', :'app_user')
     WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user') \gexec
    SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'app_user', :'app_password') \gexec
    SELECT format('GRANT ot_app TO %I', :'app_user') \gexec
  SQL
}

resource "aws_ecs_task_definition" "migrate" {
  family                   = "${var.name}-migrate"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name        = "migrate"
    image       = "${aws_ecr_repository.app["api"].repository_url}:bootstrap"
    essential   = true
    command     = var.migrate_command
    environment = [{ name = "APP_ENV", value = var.environment }]
    secrets = [
      { name = "MIGRATION_DATABASE_URL", valueFrom = "${var.db_owner_secret_arn}:url::" },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.app["migrate"].name
        awslogs-region        = local.region
        awslogs-stream-prefix = "migrate"
      }
    }
  }])

  # CI registers new revisions with each release's image.
  lifecycle {
    ignore_changes = [container_definitions]
  }
}

resource "aws_ecs_task_definition" "db_roles" {
  family                   = "${var.name}-db-roles"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name        = "db-roles"
    image       = var.psql_image
    essential   = true
    command     = ["sh", "-c", "echo \"$SQL\" | psql --quiet --no-psqlrc -v ON_ERROR_STOP=1 -v app_user=\"$APP_DB_USER\" -v app_password=\"$APP_DB_PASSWORD\""]
    environment = concat(local.psql_environment, [{ name = "SQL", value = local.db_roles_sql }])
    secrets = [
      { name = "PGUSER", valueFrom = "${var.db_owner_secret_arn}:username::" },
      { name = "PGPASSWORD", valueFrom = "${var.db_owner_secret_arn}:password::" },
      { name = "APP_DB_USER", valueFrom = "${var.db_app_secret_arn}:username::" },
      { name = "APP_DB_PASSWORD", valueFrom = "${var.db_app_secret_arn}:password::" },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.app["db-roles"].name
        awslogs-region        = local.region
        awslogs-stream-prefix = "db-roles"
      }
    }
  }])
}

resource "aws_ecs_service" "app" {
  for_each = local.services

  name            = each.key
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.app[each.key].arn
  desired_count   = each.value.desired_count
  launch_type     = "FARGATE"

  enable_execute_command            = var.enable_execute_command
  health_check_grace_period_seconds = 60

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app[each.key].arn
    container_name   = each.key
    container_port   = each.value.port
  }

  dynamic "service_registries" {
    for_each = each.key == "api" ? [1] : []
    content {
      registry_arn = aws_service_discovery_service.api.arn
    }
  }

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  depends_on = [aws_lb_listener_rule.app]
}

resource "aws_appautoscaling_target" "api" {
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.app["api"].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = var.api_desired_count
  max_capacity       = var.api_max_count
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${var.name}-api-cpu"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.api.service_namespace
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension

  target_tracking_scaling_policy_configuration {
    target_value       = 60
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

# ---------------------------------------------------------------------------
# Private uploads bucket (event images, ticket PDFs); served via signed URLs.
# ---------------------------------------------------------------------------

resource "aws_s3_bucket" "uploads" {
  bucket = "onetickets-${var.environment}-uploads-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration {
    status = "Enabled"
  }
}
