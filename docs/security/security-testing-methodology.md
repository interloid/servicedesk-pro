# ServiceDesk SaaS: Security Testing Methodology

| Field           | Value            |
| --------------- | ---------------- |
| Assessment date | 2026-11-04       |
| Document status | Draft for review |

Related documents: [Assessment](application-security-assessment.md) · [OWASP ZAP findings](owasp-zap-findings.md) · [Authentication and authorization tests](authentication-authorization-tests.md) · [Tenant isolation tests](tenant-isolation-tests.md) · [Remediation tracker](security-remediation-tracker.md)

## 1. Testing scope

| In scope                                           | Out of scope                                         |
| -------------------------------------------------- | ---------------------------------------------------- |
| Next.js app, proxy, Server Actions, route handlers | Infrastructure run by Vercel and Supabase            |
| PostgreSQL schema, RLS, functions, storage         | PayPal, Google, Gmail and Sentry services themselves |
| Edge Functions and scheduled jobs                  | Denial of service and load testing                   |
| Customer portal and platform console               | Social engineering                                   |

## 2. Test environment

| Environment          | Used so far                                                                                         | Allowed activity                                              |
| -------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Local Supabase stack | Local `npm test`. An earlier review ran a policy test                                               | All tests, including destructive                              |
| Staging or preview   | **None identified.** Must be set up, with its own Supabase project, PayPal sandbox and test mailbox | Active scans and all test plans                               |
| Production           | Passive scans and one active scan (see below)                                                       | Passive only, see [Section 13](#rules-for-production-testing) |

## 3. Tools and versions

| Tool             | Version                     | Use                     | Status                                            |
| ---------------- | --------------------------- | ----------------------- | ------------------------------------------------- |
| OWASP ZAP        | 2.17.0                      | DAST                    | Unauthenticated runs on 2026-11-03 and 2026-11-04 |
| ZAP `ascanrules` | 84.0.0                      | Active rules            | Used on 2026-11-04                                |
| ZAP `pscanrules` | 77.0.0                      | Passive rules           | Used on 2026-11-04                                |
| HostedScan       | Not stated in report        | Hosted passive ZAP      | Run 2026-11-03, trial report                      |
| `npm audit`      | npm 11.x per `package.json` | Production dependencies | Run 2026-11-04: 0 vulnerabilities                 |
| Vitest           | 5.1.0                       | Unit tests              | Run 2026-11-04: 20 passed                         |
| Snyk             | Unknown                     | Dependency scanning     | **Report not available.** See placeholder below   |

### Snyk evidence placeholder

> **EVIDENCE PENDING.** No Snyk report, configuration or reference was found in the repository, its Git history or the workstation directories searched. Snyk results are therefore **not represented anywhere in this package**.
>
> | Field                          | To be completed |
> | ------------------------------ | --------------- |
> | Date and scan target           | _Pending_       |
> | Projects covered               | _Pending_       |
> | Critical / High / Medium / Low | _Pending_       |
> | Report location                | _Pending_       |
> | Reviewed by                    | _Pending_       |

When supplied, add new findings to the [tracker](security-remediation-tracker.md) from SEC-029. Make sure the scan covers the Deno imports in `supabase/functions/`, which `npm audit` does not.

## 4. Passive versus active scanning

| Aspect                           | Passive scanning                                                               | Active scanning                                                    |
| -------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| What it does                     | Inspects traffic that was already generated                                    | Sends crafted attack requests                                      |
| Example                          | Missing header, cookie flag                                                    | SQL injection, XSS and path traversal payloads                     |
| Effect on target                 | Only the crawl's own requests                                                  | Can create data, trigger emails, fill logs and affect availability |
| A spider is not passive analysis | A spider submits forms as it crawls, so even a "passive" scan creates requests | —                                                                  |
| Production                       | Allowed under [Section 13](#rules-for-production-testing)                      | **Not allowed**                                                    |

### What actually ran

| Date       | Activity                        | Type                | Requests            | Result                                                                      |
| ---------- | ------------------------------- | ------------------- | ------------------- | --------------------------------------------------------------------------- |
| 2026-11-03 | HostedScan and ZAP report       | Passive, per report | Not reported        | 2 Medium, 3 Low, 5 Informational                                            |
| 2026-11-04 | ZAP Quick Start spider          | Crawl               | Not reported        | Standard spider ran for about 3.5 seconds. Client Spider failed             |
| 2026-11-04 | ZAP passive rules on that crawl | Passive             | —                   | 2 Medium, 3 Low, 7 Informational                                            |
| 2026-11-04 | ZAP Quick Start attack          | **Active**          | 2,190 over 78 nodes | 0 alerts, recorded as [SEC-020](application-security-assessment.md#sec-020) |

The active run should be reported as active. Calling the 2026-11-04 evidence passive would be inaccurate.

## 5. Manual verification

A scanner alert is not a finding until it has been checked:

1. Read the actual request and response.
2. Compare with the code or configuration that produced it.
3. Decide what data and which users are affected.
4. Try to reproduce it safely, outside production.
5. Record the outcome as Confirmed, False Positive or Under Investigation.

So far this was done by reading evidence and code. **No exploit reproduction has been done.**

## 6. Authentication requirements

No scan so far used authentication, which is the largest coverage gap. For authenticated DAST:

- Configure a ZAP context per role, with session handling for `@supabase/ssr` cookies.
- Fix the ZAP browser setup. On 2026-11-04 the Client Spider and browser launch failed, so use a supported Firefox or Chrome version.
- Add `Authorization` and `apikey` headers for direct API tests.
- Exclude sign-out and destructive routes from spidering at first.
- Use a verification URL per role, to detect a lost session.

## 7. Test account requirements

Use only synthetic accounts in a non-production project.

| Account                  | Tenant  | Purpose                                               |
| ------------------------ | ------- | ----------------------------------------------------- |
| Owner / Tenant Admin     | A, B    | Admin paths                                           |
| Manager                  | A       | [SEC-002](application-security-assessment.md#sec-002) |
| Agent                    | A, B    | Staff paths                                           |
| Billing Admin            | A       | Billing paths                                         |
| Customer × 2             | A       | Customer separation                                   |
| Customer                 | B       | Cross-tenant                                          |
| Multi-tenant Agent       | A and B | Token selection                                       |
| Second helper account    | None    | Escalation targets                                    |
| Disabled member          | A       | Revocation                                            |
| Platform admin           | Console | Console paths                                         |
| Allowlisted, unconfirmed | None    | Platform gate                                         |

Store credentials in a password manager, never in this repository.

## 8. Evidence collection

| Requirement  | Detail                                                                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Scanner runs | Export full HTML or JSON, with date, version, policy, target and whether it was authenticated. Screenshots support but do not replace reports |
| Manual tests | Save the request, response, user, role, time and environment                                                                                  |
| Identifiers  | Link evidence to test and finding IDs                                                                                                         |
| Redaction    | Remove tokens, cookies, keys, passwords and real customer data before saving                                                                  |
| Storage      | Reports may reveal structure, so keep them access-controlled, not in a public location                                                        |
| Integrity    | Do not edit raw exports. Add notes separately                                                                                                 |

Current evidence (two PDFs, screenshots and the ZAP log) sits on one workstation. Move it to a controlled shared location.

## 9. Severity classification

Scanner severity and assessed severity are recorded separately. Scanner values are never copied across without review.

| Severity      | Definition                                                                | Example shape                         |
| ------------- | ------------------------------------------------------------------------- | ------------------------------------- |
| Critical      | Easy to exploit, with broad cross-tenant data access or platform takeover | Unauthenticated read of all tenants   |
| High          | Serious access or integrity loss, or crossing tenants with a precondition | Privilege escalation, billing forgery |
| Medium        | Limited or conditional impact, or a missing major safeguard               | Stale access window, unenforced CSP   |
| Low           | Small impact, or hard to exploit                                          | Hardening gaps                        |
| Informational | No direct risk                                                            | Framework header                      |

**Factors, in order:** tenant isolation effect, data sensitivity, ease of exploitation, required privileges, and available mitigations.

**Provisional severity** applies until a finding is confirmed by execution. "None" in the tracker means no security impact after review.

**Confidence:** High, Medium and Low as defined in the [tracker](security-remediation-tracker.md).

## 10. Result classification

| Classification              | Rule                                                  |
| --------------------------- | ----------------------------------------------------- |
| Verified by code inspection | Read in the repository. Does not prove live behaviour |
| Verified by executed test   | Evidence saved and reviewed                           |
| Partially verified          | Some evidence, with gaps stated                       |
| Not verified                | Nothing usable. Never reported as a pass              |
| Not applicable              | Needs a rationale                                     |

## 11. Retesting process

1. The owner fixes the issue and deploys it, including migrations.
2. Someone other than the author, where possible, runs the validation steps in staging.
3. Run the wider area's tests, not only the single case.
4. Save the evidence and update the tracker status, evidence and date.
5. If it fails, return it to `Open` with notes.
6. Re-run the full test plans before major releases and after changes to RLS, auth, billing or the proxy.

## 12. Reporting limitations

- All scans so far were unauthenticated. Passes say nothing about signed-in behaviour.
- A scan finding nothing does not prove absence of a vulnerability.
- Code inspection cannot detect drift between the repository and live.
- Scanner reports here show a limited number of instances.
- The authorization logic that matters most (RLS, tenancy) is not something generic DAST can test without role-aware tests.
- Reports must not be described as certifying the application as secure.

<a id="rules-for-production-testing"></a>

## 13. Rules for production testing

| Rule                                                                                                                | Reason                                   |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **No active scanning on production**                                                                                | Possible data changes, emails, log noise |
| In ZAP, do not use Quick Start "Automated Scan". It includes an active attack. Use Safe mode or proxy-only browsing | Prevents a repeat of SEC-020             |
| Passive checks need written approval from the application owner, with a time window                                 | Accountability                           |
| No destructive tests, no exploitation and no fuzzing                                                                | Protects customers                       |
| No use of real customer accounts or reading customer data                                                           | Privacy                                  |
| Do not create or change production data                                                                             | Integrity                                |
| No load or denial of service testing                                                                                | Availability                             |
| Check Vercel's and Supabase's testing policies before any scan                                                      | Provider terms                           |
| Keep a record of who ran what and when, and check logs afterwards                                                   | Audit                                    |
| Stop immediately on errors or customer impact, and notify the owner                                                 | Safety                                   |
