# What tegs needs to set up

Everything the team can't do without your own accounts. I'll tick items off as you confirm them.

## Now (GitHub)

- [x] Merge [PR #1, monorepo and CI](https://github.com/rojandhimal/onetickets/pull/1). It has passed QA, Security and CI
- [x] Make `main` the default branch
- [ ] Confirm branch protection requires the current CI and security checks on `main`

Branch policy is settled in [AGENTS.md](../../AGENTS.md): one branch per role at a time, with each
new PR starting from the latest `main`. No branch-policy answer is needed for the next S1 story.

## Now (local machine)

- [ ] Confirm the local Docker stack runs on your machine. The one-command setup shipped in #11;
      follow [the local guide](../../docs/local-development.md#run-the-whole-app) with
      `docker compose up --build`

## Before the Sprint 0 demo (13 Nov)

- [ ] Send the interview [recruitment pack](/project/research/recruitment-pack.md) after adding your screener and video links. Target 8 organisers and 6 attendees
- [ ] Line up 2 or 3 founding organisers for the demo
- [ ] Confirm two defaults in the [usability test plan](/project/research/usability-test-plan-s1-s2.md) (5 organisers and 5 attendees, 9 to 12 Nov): an extra A$30 gift card per separate session, and sharing the private design canvas with participants (or screen-sharing it instead)

## Later, when you set up staging (deferred 9 Oct)

- [ ] AWS: one management account with root MFA on, and an admin user in IAM Identity Center. Terraform creates the staging and production accounts
- [ ] Two unique emails for those accounts' root users (for example aws+staging@yourdomain), plus one alerts email
- [ ] A domain, with DNS on Cloudflare (free plan)
- [ ] Request SES production access in the production account's SES console as soon as it exists (AWS takes about a day; until then magic-link emails only reach verified addresses)
- [ ] Add the DNS records Terraform prints in Cloudflare after each apply: certificate, web and API CNAMEs, and email records (DKIM, MX and SPF on bounce.<domain>, DMARC). If the domain already sends mail (for example Google Workspace), set up that provider's SPF and DKIM first
- [ ] Google sign-in client (OAuth client ID) for organiser sign-up, with redirect URI https://<web host>/api/auth/google/callback per environment. After the apply, paste its id and secret into the onetickets-<env>/google-oauth secret
- [ ] In GitHub, create `staging` and `production` environments in the repo settings, and add yourself as the required reviewer on production, and restrict both environments to the main branch
- [ ] Run the Terraform applies in the order in `infra/README.md` (PR #4). DevOps then gives you the values to paste into GitHub

## Before Sprint 4 (18 Jan)

- [ ] Stripe account (Connect platform)
- [ ] Ask Stripe how long it allows Australian payouts to be held until after an event
- [ ] Ask your accountant whether GST applies to the processing fee

## Budget (DevOps estimate, after the 9 Oct scale-down)

US$0 while running locally. Once staging and production are set up, about US$375-380 a month: staging about US$45-50 (runs weekdays 7:00 to 22:00 Sydney time), production about US$330, no dev account. Before Cloudflare, Sentry and email. Budget alert at US$450.
