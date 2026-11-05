# ServiceDesk SaaS: Authentication and Authorization Test Plan

| Field             | Value                                        |
| ----------------- | -------------------------------------------- |
| Assessment date   | 2026-11-04                                   |
| Document status   | Draft. Plan ready, **execution not started** |
| Execution summary | 2 Observed, 1 Blocked, all others Not Run    |

Related documents: [Tenant isolation tests](tenant-isolation-tests.md) · [Methodology](security-testing-methodology.md) · [Remediation tracker](security-remediation-tracker.md)

**Status values:** `Not Run` means no execution evidence. `Observed` means seen in scanner evidence, once, without a full test. `Blocked` means the prerequisite is unavailable. `Pass` and `Fail` require saved evidence.

**Where to run:** a local Supabase stack or staging, with the test accounts in the [methodology](security-testing-methodology.md#7-test-account-requirements). Do not run these on production.

**Direct API convention:** "direct API" means calling Supabase REST, Storage, or Auth with the public anon key and the test user's own access token, bypassing the Next.js app.

## Login and logout

| Test ID | Preconditions             | Procedure                                                                                                  | Expected result                                                                                                 | Actual result | Status  |
| ------- | ------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------- | ------- |
| AUTH-01 | Active Agent              | Sign in with correct credentials                                                                           | Session set, lands in own workspace                                                                             | —             | Not Run |
| AUTH-02 | Active Agent              | Sign in with a wrong password                                                                              | Generic error, no session                                                                                       | —             | Not Run |
| AUTH-03 | Unknown email             | Sign in                                                                                                    | Same error as AUTH-02                                                                                           | —             | Not Run |
| AUTH-04 | Signed in                 | Sign out, then press back and reuse the old refresh token                                                  | Redirect to login, token refused                                                                                | —             | Not Run |
| AUTH-05 | Signed in on two browsers | Sign out in one, check the other                                                                           | Behaviour matches the global sign-out scope in code. Record it                                                  | —             | Not Run |
| AUTH-06 | Any account               | Inspect cookies after sign-in                                                                              | Secure and SameSite=Lax. Record HttpOnly state for [SEC-011](application-security-assessment.md#sec-011)        | —             | Not Run |
| AUTH-07 | Test IP, staging          | Exceed the login limit through the app, then call the Auth API directly. Then simulate limiter RPC failure | App returns rate limited. Record direct API behaviour for [SEC-010](application-security-assessment.md#sec-010) | —             | Not Run |
| AUTH-08 | JavaScript disabled       | Submit login with test credentials                                                                         | No credential in URL or logs ([SEC-014](owasp-zap-findings.md#sec-014))                                         | —             | Not Run |
| AUTH-09 | Staff in Tenant A         | Sign in at Tenant B's login URL                                                                            | Refused or returned to own workspace, session not granted to B                                                  | —             | Not Run |
| AUTH-10 | Disabled member           | Sign in                                                                                                    | Access refused                                                                                                  | —             | Not Run |

## Password reset

| Test ID  | Preconditions         | Procedure                                      | Expected result                                                         | Actual result | Status  |
| -------- | --------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- | ------------- | ------- |
| RESET-01 | Existing account      | Request reset, compare with an unknown email   | Same message, per [SEC-017](application-security-assessment.md#sec-017) | —             | Not Run |
| RESET-02 | Reset link            | Use it to set a new password                   | Password changes, old password fails                                    | —             | Not Run |
| RESET-03 | Used reset link       | Use it again                                   | Refused                                                                 | —             | Not Run |
| RESET-04 | Expired link          | Use after expiry                               | Refused with a clear message                                            | —             | Not Run |
| RESET-05 | Spoofed `Host` header | Request reset                                  | Link uses the configured site origin                                    | —             | Not Run |
| RESET-06 | Removed member        | Request reset through central and tenant pages | No workspace access gained                                              | —             | Not Run |
| RESET-07 | Test IP               | Exceed the reset limit                         | Rate limited                                                            | —             | Not Run |

## Magic-link expiration and reuse

| Test ID | Preconditions        | Procedure                                          | Expected result                                                       | Actual result | Status  |
| ------- | -------------------- | -------------------------------------------------- | --------------------------------------------------------------------- | ------------- | ------- |
| LINK-01 | Portal customer      | Request and use a sign-in link                     | Signed in to that portal only                                         | —             | Not Run |
| LINK-02 | Used link            | Open it again                                      | Refused                                                               | —             | Not Run |
| LINK-03 | Expired link         | Open after expiry. Record the live OTP expiry      | Refused                                                               | —             | Not Run |
| LINK-04 | Link for Tenant A    | Change the slug in the callback URL to Tenant B    | No access or membership created in B without intent. Record behaviour | —             | Not Run |
| LINK-05 | Crafted error params | Call the callback with `error_description=<text>`  | Login shows fixed text only                                           | —             | Not Run |
| LINK-06 | Staff account        | Use a portal link while holding a staff membership | No customer session or staff bypass                                   | —             | Not Run |

## Session expiration and revocation

| Test ID | Preconditions          | Procedure                                                                        | Expected result                                                                                                   | Actual result | Status  |
| ------- | ---------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------- | ------- |
| SESS-01 | Unremembered sign-in   | Close and reopen the browser                                                     | Session gone                                                                                                      | —             | Not Run |
| SESS-02 | Remembered sign-in     | Inspect cookie lifetime                                                          | 30 days                                                                                                           | —             | Not Run |
| SESS-03 | Signed-in browser      | Read `document.cookie` in the console                                            | Record whether auth tokens are readable ([SEC-011](application-security-assessment.md#sec-011))                   | —             | Not Run |
| SESS-04 | Agent with saved token | Disable the Agent, then call `tickets` through the direct API until token expiry | **Ideally refused immediately.** Record the actual window ([SEC-005](application-security-assessment.md#sec-005)) | —             | Not Run |
| SESS-05 | Agent promoted         | Change role, then open restricted pages                                          | Token refreshes, new role applies                                                                                 | —             | Not Run |
| SESS-06 | Expired access token   | Call the direct API                                                              | 401                                                                                                               | —             | Not Run |
| SESS-07 | Password changed       | Reuse the old session in another browser                                         | Record behaviour. Should be revoked                                                                               | —             | Not Run |

## Unauthorized route access

| Test ID  | Preconditions  | Procedure                                             | Expected result                        | Actual result                                                                                      | Status   |
| -------- | -------------- | ----------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------- | -------- |
| ROUTE-01 | Anonymous      | GET `/platform`                                       | Redirect to login with no console data | ZAP screenshot: 307 to `/login`. Body seen only in part ([SEC-022](owasp-zap-findings.md#sec-022)) | Observed |
| ROUTE-02 | Anonymous      | GET an unknown tenant path                            | Redirect to tenant login               | ZAP report: `/tenant/$` returned 307 to `/tenant/login?next=%2F%24`                                | Observed |
| ROUTE-03 | Anonymous      | GET each tenant route with a real slug                | Redirect to login                      | —                                                                                                  | Not Run  |
| ROUTE-04 | Staff          | GET `/platform`                                       | 404                                    | —                                                                                                  | Not Run  |
| ROUTE-05 | Customer       | GET the staff dashboard                               | Redirect to `/unauthorized`            | —                                                                                                  | Not Run  |
| ROUTE-06 | Staff          | GET the portal                                        | Redirect to own dashboard              | —                                                                                                  | Not Run  |
| ROUTE-07 | Anonymous      | GET `/api/sentry-test` in staging                     | Refused in production mode             | —                                                                                                  | Not Run  |
| ROUTE-08 | Any            | Send a forged `x-tenant-slug` header                  | Header ignored                         | —                                                                                                  | Not Run  |
| ROUTE-09 | Signed out     | Visit `/login?next=/\example.com` and `//example.com` | Lands inside the app only              | —                                                                                                  | Not Run  |
| ROUTE-10 | Blocked tenant | Open pages, then POST a Server Action                 | Blocked page, 503 on POST              | —                                                                                                  | Not Run  |

## Role-based access control

Run each row with Tenant Admin, Manager, Agent, Billing Admin and Customer. Record each role's result.

| Test ID | Capability                                | Expected: Admin / Manager / Agent / Billing / Customer                    | Actual result | Status  |
| ------- | ----------------------------------------- | ------------------------------------------------------------------------- | ------------- | ------- |
| RBAC-01 | View all tenant tickets                   | Yes / Yes / Yes / No / No                                                 | —             | Not Run |
| RBAC-02 | Delete a ticket                           | Yes / No / No / No / No                                                   | —             | Not Run |
| RBAC-03 | Delete a message                          | Yes / Yes / No / No / No                                                  | —             | Not Run |
| RBAC-04 | Read internal notes                       | Yes / Yes / Yes / No / No                                                 | —             | Not Run |
| RBAC-05 | Manage team and roles                     | Yes / Limited, confirm the intended rule / No / No / No                   | —             | Not Run |
| RBAC-06 | Change billing plan                       | Yes / No / No / Yes / No                                                  | —             | Not Run |
| RBAC-07 | View invoices                             | Yes / No / No / Yes / No                                                  | —             | Not Run |
| RBAC-08 | Edit SLA policies                         | Confirm the rule in `assertCanManageSla` and test each role               | —             | Not Run |
| RBAC-09 | Edit branding                             | Yes / No / No / No / No                                                   | —             | Not Run |
| RBAC-10 | View audit log                            | Business plan, entitled roles only. Confirm each                          | —             | Not Run |
| RBAC-11 | Read attachment metadata as Billing Admin | Confirm intent. RLS allows metadata while storage does not allow the file | —             | Not Run |

## Direct API authorization

| Test ID | Preconditions                          | Procedure                                                                                      | Expected result                                                                                                                           | Actual result | Status                            |
| ------- | -------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------- |
| API-01  | Anon key only                          | Read every tenant table through REST                                                           | No rows or refused                                                                                                                        | —             | Not Run                           |
| API-02  | Customer token                         | Read `customers`, `memberships`, `invoices`, `audit_logs`                                      | Own record only, or nothing. Live policies suggest customers can read all members ([SEC-029](application-security-assessment.md#sec-029)) | —             | Not Run                           |
| API-03  | Agent token                            | Call `subscription` function                                                                   | 403                                                                                                                                       | —             | Not Run                           |
| API-04  | Forged PayPal webhook                  | POST with invalid signature to a **sandbox** deployment                                        | 401 with no state change                                                                                                                  | —             | Not Run                           |
| API-05  | Customer token and anon key            | POST to `reconcile-subscriptions` on staging                                                   | **Should be refused.** Code suggests it is accepted ([SEC-006](application-security-assessment.md#sec-006))                               | —             | Not Run                           |
| API-06  | Live dashboard access                  | Read `verify_jwt` per function                                                                 | True for all except `paypal-webhook` ([SEC-009](application-security-assessment.md#sec-009))                                              | —             | Blocked: connector refused access |
| API-07  | Forged JWT with `service_role` payload | POST to `email-jobs` on staging                                                                | Refused by gateway                                                                                                                        | —             | Not Run                           |
| API-08  | Valid event replayed                   | Send the same sandbox event twice                                                              | One invoice, one state change                                                                                                             | —             | Not Run                           |
| API-09  | Any token                              | Call service-only functions such as `rate_limit_hit`, `platform_analytics`, `portal_link_user` | Refused                                                                                                                                   | —             | Not Run                           |
| API-10  | Tenant Admin token                     | Call `transfer_tenant_ownership` as a non-owner                                                | Refused                                                                                                                                   | —             | Not Run                           |

## Privilege escalation attempts

Each row targets a code-level concern. Run on a disposable stack only.

| Test ID | Preconditions                                    | Procedure                                                                      | Expected result                                                                                                     | Actual result | Status  |
| ------- | ------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------- | ------- |
| PRIV-01 | Manager, second account                          | Direct insert into `memberships` with `role = tenant_admin`                    | **Should be refused.** Code suggests it succeeds ([SEC-002](application-security-assessment.md#sec-002))            | —             | Not Run |
| PRIV-02 | Manager                                          | Direct update of own role to `tenant_admin`                                    | Refused by `WITH CHECK`                                                                                             | —             | Not Run |
| PRIV-03 | Agent                                            | Direct insert or update on `memberships`                                       | Refused                                                                                                             | —             | Not Run |
| PRIV-04 | Any user                                         | Update own `user_metadata` with `tenant_id` and `tenant_role`, then refresh    | Claims unchanged. RLS unaffected. Storage covered by [TEN-20](tenant-isolation-tests.md#storage-policy-enforcement) | —             | Not Run |
| PRIV-05 | Tenant Admin, Free plan                          | Direct update `tenants.plan_id` to Business                                    | Value unchanged ([SEC-001](application-security-assessment.md#sec-001))                                             | —             | Not Run |
| PRIV-06 | Billing Admin                                    | Direct update of `subscriptions`                                               | No rows changed                                                                                                     | —             | Not Run |
| PRIV-07 | Tenant Admin                                     | Direct update of an invoice to paid, and insert a new invoice                  | Both refused                                                                                                        | —             | Not Run |
| PRIV-08 | Tenant Admin                                     | Direct insert into `tenants`, and delete own tenant                            | **Should be refused.** Code suggests both succeed ([SEC-007](application-security-assessment.md#sec-007))           | —             | Not Run |
| PRIV-09 | Member                                           | Set `is_primary` on any membership                                             | Refused by trigger                                                                                                  | —             | Not Run |
| PRIV-10 | Customer                                         | Set own `tickets` fields through REST, or insert a message with another author | Refused                                                                                                             | —             | Not Run |
| PRIV-11 | Blocked workspace member                         | Read and write tickets through the direct API                                  | Refused                                                                                                             | —             | Not Run |
| PRIV-12 | Removed Manager or Tenant Admin with saved token | Direct insert into `memberships` for another account, and for self             | **Should be refused.** Live policy suggests it succeeds ([SEC-030](application-security-assessment.md#sec-030))     | —             | Not Run |

## Customer and agent permissions

| Test ID | Preconditions                         | Procedure                                      | Expected result                                                                  | Actual result | Status  |
| ------- | ------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------- | ------------- | ------- |
| CUST-01 | Two customers in one tenant           | Customer 1 opens Customer 2's ticket URL       | Not found                                                                        | —             | Not Run |
| CUST-02 | Customer with internal note on ticket | Read messages through UI and REST              | Public messages only                                                             | —             | Not Run |
| CUST-03 | Customer                              | Download an internal note's attachment         | Refused                                                                          | —             | Not Run |
| CUST-04 | Signed-out visitor                    | Submit a portal request with an existing email | No access to that account's data                                                 | —             | Not Run |
| CUST-05 | Agent                                 | Edit another agent's message                   | Refused                                                                          | —             | Not Run |
| CUST-06 | Agent                                 | Lower a ticket priority                        | Confirm flow, audit entry written                                                | —             | Not Run |
| CUST-07 | Customer                              | Overwrite a colleague's avatar                 | **Should be refused.** See [SEC-004](application-security-assessment.md#sec-004) | —             | Not Run |

## Platform administrator permissions

| Test ID | Preconditions                    | Procedure                               | Expected result                                                                                                | Actual result | Status  |
| ------- | -------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------- | ------- |
| PLAT-01 | Listed email, unconfirmed        | Open `/platform`                        | 404                                                                                                            | —             | Not Run |
| PLAT-02 | Confirmed email, not listed      | Open `/platform` and invoke actions     | 404, actions refused                                                                                           | —             | Not Run |
| PLAT-03 | Listed and confirmed             | Open each page                          | Loads                                                                                                          | —             | Not Run |
| PLAT-04 | Tenant Admin                     | Invoke block, settings and plan actions | Refused                                                                                                        | —             | Not Run |
| PLAT-05 | Listed and confirmed             | Sign in                                 | **MFA required once implemented.** Today no MFA exists ([SEC-015](application-security-assessment.md#sec-015)) | —             | Not Run |
| PLAT-06 | Platform action taken            | Review audit log                        | Actor attributed                                                                                               | —             | Not Run |
| PLAT-07 | Email removed from the allowlist | Reuse the existing session              | Access ends on next request                                                                                    | —             | Not Run |

## Account recovery and invitation flows

| Test ID | Preconditions               | Procedure                                 | Expected result                      | Actual result | Status  |
| ------- | --------------------------- | ----------------------------------------- | ------------------------------------ | ------------- | ------- |
| INV-01  | Tenant Admin                | Invite a team member and accept           | Membership active with intended role | —             | Not Run |
| INV-02  | Invite revoked              | Use the link                              | No access                            | —             | Not Run |
| INV-03  | Invite used                 | Reuse it                                  | Refused                              | —             | Not Run |
| INV-04  | Invited person, other email | Sign in as someone else and open the link | No membership granted                | —             | Not Run |
| INV-05  | Manager                     | Invite a Tenant Admin through the app     | Matches the intended rule            | —             | Not Run |
| INV-06  | Seat limit reached          | Invite again                              | Refused                              | —             | Not Run |
| INV-07  | Customer invite             | Accept and open the portal                | Customer role only                   | —             | Not Run |
| INV-08  | Owner                       | Transfer ownership                        | Roles change, old owner not primary  | —             | Not Run |
