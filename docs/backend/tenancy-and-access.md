# Tenancy and access control

Two layers stop one organisation from seeing another's data. Either one alone would be enough;
both must be bypassed for a leak.

## 1. The access guard (application)

`AccessGuard` (`apps/api/src/modules/identity/access.ts`) runs on every route and refuses any
route without one of these decorators:

- `@Public()`: anyone.
- `@SignedIn()`: any signed-in user.
- `@OrganisationAccess(permission?)`: a member of the route's `:organisationId`, with the
  permission if one is named. Permissions in `MFA_REQUIRED` also need an MFA-verified session.

## 2. Row-level security (database)

- The api connects as a login granted `ot_app`, never as the owner or a superuser. Background jobs
  use a login granted `ot_worker`.
- Every table in a module schema has `ENABLE` and `FORCE ROW LEVEL SECURITY`, plus an `ot_app`
  policy keyed to `current_setting('app.organisation_id')` or `app.user_id`.
- `UnitOfWork.run({ organisationId, userId }, work)` opens a transaction and sets both with
  `set_config(..., true)`, so they end with the transaction and cannot leak between pooled
  connections.
- Grants are least privilege: no `DELETE` until a feature needs one; the audit log is insert-only.

## Adding a table

1. Create it in a new migration in `apps/api/migrations`, in the module's schema.
2. `alter table ... enable row level security; alter table ... force row level security;`
3. Add an `ot_app` policy scoped to the organisation (or user), and an `ot_worker` one if jobs
   need it.
4. Grant only the verbs the feature uses.

`apps/api/test/rls.int.test.ts` fails CI if any module table lacks RLS, `FORCE` or an `ot_app`
policy, so step 2 or 3 cannot be forgotten.
