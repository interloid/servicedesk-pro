# ServiceDesk SaaS: Tenant Isolation Test Plan

| Field            | Value                                          |
| ---------------- | ---------------------------------------------- |
| Assessment date  | 2026-11-04                                     |
| Document status  | Draft. Plan ready, **execution not started**   |
| Isolation status | **Not established. No test has been executed** |

Related documents: [Authentication and authorization tests](authentication-authorization-tests.md) · [Security architecture](security-architecture.md#4-multi-tenant-isolation-model) · [Methodology](security-testing-methodology.md)

Reading the policies shows the intended design, not the live result. Do not describe tenant isolation as passed until these tests have run with saved evidence.

## 1. Test environment

Run on a local Supabase stack or staging, never on production. These tests include write and delete attempts.

| Fixture      | Tenant A                                            | Tenant B            |
| ------------ | --------------------------------------------------- | ------------------- |
| Staff        | Tenant Admin, Manager, Agent, Billing Admin         | Tenant Admin, Agent |
| Customers    | Customer A1, Customer A2                            | Customer B1         |
| Tickets      | One per customer, with public and internal messages | One, same shape     |
| Attachments  | Public message file, internal note file             | Same                |
| Billing      | Subscription, invoice, PDF                          | Same                |
| Multi-tenant | Agent M, a member of both tenants                   |                     |

Record every ID for A and B before starting. Test both directions. Compare row counts before and after each write attempt.

**Each test needs:** the request, the response, the user and role, and for write attempts proof that data did not change. Empty results count as a pass only if the same query returns data for an authorised user.

## 2. Test cases

### Cross-tenant ticket access

| Test ID | Scenario                                      | Procedure                               | Expected result            | Actual result | Status  |
| ------- | --------------------------------------------- | --------------------------------------- | -------------------------- | ------------- | ------- |
| TEN-01  | A staff opens B ticket URL                    | Replace ID in the ticket page URL       | Not found, no data in page | —             | Not Run |
| TEN-02  | A staff reads B ticket through REST           | `GET /tickets?id=eq.<B>` with A token   | Empty                      | —             | Not Run |
| TEN-03  | A staff updates or deletes B ticket           | `PATCH` and `DELETE` with A token       | 0 rows changed             | —             | Not Run |
| TEN-04  | A staff calls Server Actions with B ticket ID | Replay reply, assign and status actions | Refused, B unchanged       | —             | Not Run |
| TEN-05  | A staff calls ticket RPCs with B ID           | `change_ticket_priority` and similar    | Refused                    | —             | Not Run |

### Cross-tenant customer access

| Test ID | Scenario                                                | Procedure             | Expected result      | Actual result | Status  |
| ------- | ------------------------------------------------------- | --------------------- | -------------------- | ------------- | ------- |
| TEN-06  | A staff opens B customer page                           | Replace ID in the URL | Not found            | —             | Not Run |
| TEN-07  | A staff reads B through `customers` and `customer_list` | REST with A token     | Empty                | —             | Not Run |
| TEN-08  | A staff invites or edits with B customer ID             | Replay actions        | Refused, B unchanged | —             | Not Run |

### Ticket message access

| Test ID | Scenario                  | Procedure                                          | Expected result                 | Actual result | Status  |
| ------- | ------------------------- | -------------------------------------------------- | ------------------------------- | ------------- | ------- |
| TEN-09  | A staff reads B messages  | REST with B `ticket_id`                            | Empty                           | —             | Not Run |
| TEN-10  | A staff posts to B ticket | Insert with A `tenant_id`, then with B `tenant_id` | Refused. No message on B ticket | —             | Not Run |

### Tenant ID manipulation

| Test ID | Scenario                     | Procedure                                                                  | Expected result                   | Actual result | Status  |
| ------- | ---------------------------- | -------------------------------------------------------------------------- | --------------------------------- | ------------- | ------- |
| TEN-11  | Move a row to another tenant | `PATCH` A ticket with `tenant_id = B`                                      | Refused                           | —             | Not Run |
| TEN-12  | Forged request context       | Send `x-tenant-slug: B`, change the path slug, set `sd_tenant = B`         | Stays in A. No B data             | —             | Not Run |
| TEN-13  | Self-written claims          | Set `user_metadata.tenant_id` and `tenant_role` to B values, refresh token | Claims and table access unchanged | —             | Not Run |

### Database RLS enforcement

| Test ID | Scenario              | Procedure                                                                                                  | Expected result                                                                                                                             | Actual result | Status  |
| ------- | --------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------- |
| TEN-14  | Attach a B user to A  | A Tenant Admin inserts a membership with a B user's UUID, then reads, updates and deletes that `users` row | **Insert should be refused.** Code suggests it succeeds ([SEC-003](application-security-assessment.md#sec-003)). If so, confirm effect on B | —             | Not Run |
| TEN-15  | Sweep all tables      | For every table with `tenant_id`, select using A token and filter on B's ID                                | 0 rows on all                                                                                                                               | —             | Not Run |
| TEN-16  | Agent M active tenant | With token for A, read B rows. Switch preferred tenant, and repeat                                         | Only the token's tenant is visible                                                                                                          | —             | Not Run |
| TEN-17  | Removed from A        | Remove Agent M from A, then use the old token                                                              | Record the window ([SEC-005](application-security-assessment.md#sec-005))                                                                   | —             | Not Run |
| TEN-18  | Anonymous             | Read every table and every anon-callable RPC                                                               | No tenant rows. `get_tenant_by_slug` returns only public branding and ID                                                                    | —             | Not Run |

### Direct API requests using another tenant's record ID

| Test ID | Scenario         | Procedure                                                                                                                                 | Expected result      | Actual result | Status  |
| ------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------- | ------- |
| TEN-19  | Sweep record IDs | For invoices, SLA policies, saved views, tags, notifications, attachments, audit entries: read, update and delete using A token and B IDs | No access, no change | —             | Not Run |

### Storage policy enforcement

| Test ID | Scenario                                     | Procedure                                                                                                      | Expected result                                                                                          | Actual result | Status  |
| ------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------- | ------- |
| TEN-20  | Write to B avatar folder                     | Set `user_metadata.tenant_id` to B ID, refresh, then upload, overwrite and delete under `avatars/<B>/`         | **Should be refused.** Code suggests it succeeds ([SEC-004](application-security-assessment.md#sec-004)) | —             | Not Run |
| TEN-21  | List or read B private buckets               | A token on `ticket-attachments` and `invoices` with B paths                                                    | Refused                                                                                                  | —             | Not Run |
| TEN-22  | Replace own invoice PDF                      | A Billing Admin overwrites and deletes a PDF through the storage API                                           | **Should be refused.** Code suggests it succeeds ([SEC-008](application-security-assessment.md#sec-008)) | —             | Not Run |
| TEN-23  | Write attachment with an active content type | Upload `text/html` or SVG directly to the A folder of `ticket-attachments`, then open it through a signed link | Rejected, or served so it cannot run scripts. Record the result                                          | —             | Not Run |

### Attachment download access

| Test ID | Scenario                        | Procedure                                                            | Expected result                                                                | Actual result | Status  |
| ------- | ------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------- | ------- |
| TEN-24  | Customer A1 reads others' files | A2's file, internal note file, and B's file                          | All refused                                                                    | —             | Not Run |
| TEN-25  | Signed link lifetime            | Reuse an attachment link after 1 hour, and after the user is removed | Expired after 1 hour. Record the removal case, as links work until they expire | —             | Not Run |

### Customer portal access

| Test ID | Scenario                  | Procedure                                                            | Expected result                                                            | Actual result | Status  |
| ------- | ------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------- | ------- |
| TEN-26  | Customer A1 in B's portal | Open B's portal, its request pages and A ticket IDs under the B slug | No A data shown under B and no B data. No B membership without a B sign-in | —             | Not Run |

### Search, filters, exports and reports

| Test ID | Scenario               | Procedure                                                                                                | Expected result                       | Actual result | Status  |
| ------- | ---------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------- | ------- |
| TEN-27  | Search and saved views | Search for a unique B term in header search, ticket filters, portal help. Add filter-breaking characters | No B results, no errors exposing data | —             | Not Run |
| TEN-28  | Reports and exports    | With unique A and B counts, open reports, export and call the report RPCs                                | Only A figures                        | —             | Not Run |
| TEN-29  | Realtime               | Subscribe with A token to B channels and tables                                                          | No B events                           | —             | Not Run |

### Background jobs

| Test ID | Scenario                   | Procedure                                                                                    | Expected result                                                                  | Actual result | Status  |
| ------- | -------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------- | ------- |
| TEN-30  | Tenant-specific processing | Create SLA breaches and notifications in A and B, then run the SLA, email and reconcile jobs | Each alert and email goes only to its own tenant's people, with correct branding | —             | Not Run |
| TEN-31  | Blocked tenant jobs        | Block A, and run jobs                                                                        | Behaviour matches product rules. B unaffected                                    | —             | Not Run |
| TEN-32  | Webhook routing            | Send a sandbox event for B's agreement                                                       | Only B's subscription and invoice change                                         | —             | Not Run |
| TEN-33  | Platform console scope     | Console as admin, then tenant users attempting the same data                                 | Admin sees all, tenant users refused                                             | —             | Not Run |

## 3. Exit criteria

Tenant isolation can be reported as tested when all of these are true:

- [ ] Every test above has saved evidence, and no status is `Not Run`
- [ ] TEN-14, TEN-20 and any other failures are fixed and retested
- [ ] The test environment's migrations match production, or the difference is documented
- [ ] Results were reviewed by someone other than the tester
- [ ] The tests run automatically before merge ([SEC-016](application-security-assessment.md#sec-016))
