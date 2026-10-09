# Organisations and members API

Module: `apps/api/src/modules/identity`. Contracts: `packages/shared/src/api/organisations.ts`.

Every error body is `ApiErrorBody`: `{ statusCode, code, message, field? }`. Switch on `code`, not
on the message.

| Method and path                   | Access                      | Body                        | Success                 |
| --------------------------------- | --------------------------- | --------------------------- | ----------------------- |
| `GET /me/organisations`           | signed in                   | none                        | 200 `OrganisationDto[]` |
| `POST /organisations`             | signed in                   | `{ name }` (1 to 120 chars) | 201 `OrganisationDto`   |
| `GET /organisations/:id/members`  | member with `manageMembers` | none                        | 200 `MemberDto[]`       |
| `POST /organisations/:id/members` | member with `manageMembers` | `{ email, role }`           | 201 `MemberDto`         |

The caller becomes the owner of an organisation they create. Adding a member by email creates the
user if they have never signed in; they get access the first time they do.

## Errors

| Status | `code`             | When                                                                                   |
| ------ | ------------------ | -------------------------------------------------------------------------------------- |
| 401    | `not_signed_in`    | No valid session                                                                       |
| 404    | `not_a_member`     | The organisation does not exist **or** the caller is not a member (deliberately alike) |
| 403    | `forbidden`        | The caller's role lacks the permission, or may not grant that role                     |
| 403    | `mfa_required`     | The action needs a recent second-factor check (see below)                              |
| 409    | `already_a_member` | The email is already a member                                                          |
| 422    | `invalid_request`  | The body failed validation; `field` names the first bad field                          |
| 403    | `no_access_policy` | A route forgot its access decorator (a bug; it fails closed)                           |

## Roles and permissions

The map lives in `packages/shared/src/roles.ts` and the web app uses the same one, so the UI and
the api cannot disagree.

| Permission      | owner | admin | finance | door_staff | Needs MFA |
| --------------- | ----- | ----- | ------- | ---------- | --------- |
| `viewMoney`     | yes   | yes   | yes     |            |           |
| `managePayouts` | yes   |       | yes     |            | yes       |
| `manageMembers` | yes   | yes   |         |            |           |
| `exportData`    | yes   | yes   | yes     |            | yes       |
| `scanTickets`   | yes   | yes   | yes     | yes        |           |

Only an owner may grant `owner` or `finance`, and only with a recent MFA check. Admins can add
`admin` and `door_staff`. Every membership change is written to the insert-only audit log.
