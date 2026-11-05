# ServiceDesk SaaS: OWASP ZAP Findings

| Field           | Value                                             |
| --------------- | ------------------------------------------------- |
| Assessment date | 2026-11-04                                        |
| Document status | Draft for review                                  |
| Target          | https://servicedesk-ui.vercel.app                 |
| Retest status   | **No ZAP rerun after any fix.** Local checks only |

Related documents: [Assessment](application-security-assessment.md) · [Remediation tracker](security-remediation-tracker.md) · [Testing methodology](security-testing-methodology.md)

Scanner alerts are preliminary observations. "Scanner severity" is ZAP's value and "Assessed severity" is this review's, and the two are deliberately kept separate.

## 1. Evidence reviewed

| ID  | Source                                                   | Date                           | Type                                 | Limits                                                                          |
| --- | -------------------------------------------------------- | ------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------- |
| Z1  | `ZAP Passive hostedscan report 2026-11-03.pdf`, 16 pages | 2026-11-03                     | HostedScan summary of a passive scan | Trial watermark. 5 alerts, one instance each                                    |
| Z2  | `ZAP Passive scanner output 2026-11-03.pdf`, 19 pages    | 2026-11-03, 09:51 as printed   | ZAP 2.17.0 report                    | Trial watermark. Up to 5 instances per alert. Confidence not shown              |
| Z3  | 12 alert screenshots from a ZAP desktop session          | 2026-11-04, 12:56 to 12:58 IST | ZAP 2.17.0, Standard Mode            | **Screenshot-based: one selected instance per alert, partly cropped responses** |
| Z4  | `~/.ZAP/zap.log`                                         | 2026-11-04                     | Spider and active scanner log        | Rule-level totals only, no request detail                                       |

The PDFs and screenshots are outside this repository. The full ZAP session (all instances and requests) was not exported, so Z3 alerts marked "Systemic" have unknown instance counts.

All scans were **unauthenticated**. See [SEC-020](application-security-assessment.md#sec-020) for the active scan shown in Z4.

### What changed between the two scans

| Item                                          | 2026-11-03 (Z1, Z2)                                | 2026-11-04 (Z3)           |
| --------------------------------------------- | -------------------------------------------------- | ------------------------- |
| Alert summary                                 | 2 Medium, 3 Low, 5 Info                            | 2 Medium, 3 Low, 7 Info   |
| CSP-Report-Only header                        | Not in recorded responses                          | Present                   |
| `robots.txt`                                  | Not shown                                          | Includes `Disallow` rules |
| HSTS alert                                    | Present                                            | Absent                    |
| Big Redirect, CSP Report-Only, Modern Web App | Not raised (Big Redirect listed as a passing rule) | Raised                    |

Commit `ec4b56a` (2026-11-03 19:58 IST), which added the CSP-Report-Only header, falls between the scans. That is consistent with a deployment in between, though the deployment itself was not verified. Note also that Z3 explored `/platform`, which Z2 did not report.

## 2. Summary

| Finding             | ZAP alert                                       | Plugin  | Scanner risk / confidence | Assessed severity           | Status              |
| ------------------- | ----------------------------------------------- | ------- | ------------------------- | --------------------------- | ------------------- |
| [SEC-013](#sec-013) | CSP Header Not Set                              | 10038   | Medium / High             | Medium                      | Confirmed           |
| [SEC-013](#sec-013) | CSP Report-Only Header Found                    | 10038-3 | Informational / High      | Same finding                | Confirmed           |
| [SEC-021](#sec-021) | Cross-Domain Misconfiguration                   | 10098   | Medium / Medium           | Informational (provisional) | Under Investigation |
| [SEC-022](#sec-022) | Big Redirect Detected                           | 10044   | Low / Medium              | None                        | False Positive      |
| [SEC-019](#sec-019) | Cookie No HttpOnly Flag                         | 10010   | Low / Medium              | Informational               | Confirmed           |
| [SEC-018](#sec-018) | Server Leaks via X-Powered-By                   | 10037   | Low / Medium              | Informational               | Confirmed           |
| [SEC-023](#sec-023) | Strict-Transport-Security Not Set (Z1, Z2 only) | 10035   | Low / Not shown           | None                        | False Positive      |
| [SEC-027](#sec-027) | Authentication Request Identified               | 10111   | Informational / Low       | None                        | False Positive      |
| [SEC-014](#sec-014) | Sensitive Information in URL                    | 10024   | Informational / Medium    | Medium (provisional)        | Confirmed           |
| [SEC-028](#sec-028) | Modern Web Application                          | 10109   | Informational / Medium    | None                        | False Positive      |
| [SEC-025](#sec-025) | Re-examine Cache-control Directives             | 10015   | Informational / Low       | Informational (provisional) | Under Investigation |
| [SEC-026](#sec-026) | Retrieved from Cache                            | 10050   | Informational / Medium    | Informational (provisional) | Under Investigation |
| [SEC-024](#sec-024) | User Controllable HTML Element Attribute        | 10031   | Informational / Low       | None                        | False Positive      |

Sources for risk and confidence: Z3 screenshots, and Z1 and Z2 for HSTS. Instance counts: Z3 shows Cookie 3, Authentication 4, Modern Web App 3, User Controllable 3, others "Systemic". Z2 shows 5 for most alerts, which is its display limit.

**Active scan (Z4):** rules for path traversal, remote file include, external redirect, server side include, XSS, SQL injection, React2Shell, command injection (including timing), XPath, XXE, SSTI, XSLT and SOAP completed with 2,190 requests and 0 alerts. This is useful but limited evidence. It covered 78 unauthenticated nodes after a spider of about 3.5 seconds, and the Client Spider failed. **It is not evidence that the authenticated application is free of these issues.**

## 3. Finding details

<a id="sec-013"></a>

### SEC-013: Content Security Policy not enforced

| Attribute          | Detail                                                                                                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scanner alerts     | CSP Header Not Set (Medium, High confidence, CWE-693). CSP Report-Only Header Found (Informational, High, CWE-693)                                                                                                                  |
| Affected endpoints | Z2: `/`, `/login`, `/setup`, `/tenant/forgot-password`. Z3: `/`. Header policy is global, from `next.config.ts`                                                                                                                     |
| Evidence           | Z3 responses carry `Content-Security-Policy-Report-Only` and no `Content-Security-Policy`. `next.config.ts` sets report-only on purpose, and RISK-011 in the 2026-11-03 review is Partial                                           |
| Impact             | The browser logs violations but blocks nothing, so CSP gives no XSS protection today                                                                                                                                                |
| Exploitability     | Not exploitable alone. It removes a safety net if XSS is found, and sessions are readable by script ([SEC-011](application-security-assessment.md#sec-011))                                                                         |
| False positive?    | No. Also note the policy allows `script-src 'unsafe-inline'`, which weakens XSS protection when enforced, and has no `report-uri` or `report-to`, so reports never reach the team                                                   |
| Recommendation     | Add a reporting endpoint, such as Sentry's CSP endpoint. Review violations across staff, portal, billing and console. Then enforce, moving to nonces if inline scripts can be removed                                               |
| Validation         | Response carries an enforcing header on all routes. Staff, portal, PayPal and Sentry flows work with a clean console. An injected inline test script in staging is blocked                                                          |
| Retest status      | Fix in working tree, checked on a local build 2026-11-04, [details](security-remediation-tracker.md#zap-fixes-2026-11-04). Not deployed, ZAP not rerun. Policy still allows inline scripts, so ZAP may raise `unsafe-inline` alerts |

<a id="sec-014"></a>

### SEC-014: Sign-in forms can send credentials in the URL

| Attribute          | Detail                                                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scanner alert      | Information Disclosure: Sensitive Information in URL (Informational, Medium confidence, CWE-598)                                                                                                                                                                                      |
| Affected endpoints | `/login`, `/setup`, `/tenant/login`, `/tenant/forgot-password` with query strings such as `?email=…&password=ZAP&remember=on`                                                                                                                                                         |
| Evidence           | `AuthCard` renders `<form noValidate>` with no `method` or `action` (`src/features/auth/components/auth-card.tsx:35`). The submit handler exists only after JavaScript loads. ZAP's GET submissions returned 200, and the Z3 `/setup` response body echoes the query in its page data |
| What it proves     | ZAP itself built these URLs from the forms using fake values (`zaproxy@example.com`, `ZAP`). **No real credential appears in the evidence**, and the normal JavaScript flow uses a Server Action. The defect is the fallback                                                          |
| Impact             | If someone submits before JavaScript loads, or a script fails, their password goes in the URL. It can then land in browser history, Vercel request logs and page data. The Referrer-Policy limits cross-site leakage                                                                  |
| Exploitability     | Not attacker-triggered at will. Most likely on slow networks with autofill and Enter. Severity is provisional because the frequency is unknown                                                                                                                                        |
| False positive?    | The scanner's URLs are artificial, but the underlying behaviour is real                                                                                                                                                                                                               |
| Recommendation     | Set `method="post"` on auth and portal credential forms, including `portal-sign-in-form.tsx`, `portal-set-password-form.tsx` and `onboarding/components/account.tsx`, and disable submission until hydrated. Search Vercel logs for `password=` in URLs and purge any hits            |
| Validation         | With JavaScript disabled in staging, submit each form with test credentials. No credential appears in any URL, history entry or log                                                                                                                                                   |
| Retest status      | Fix in working tree, checked on a local build 2026-11-04, [details](security-remediation-tracker.md#zap-fixes-2026-11-04). Not deployed, ZAP not rerun. Vercel log search for `password=` still to do                                                                                 |

<a id="sec-018"></a>

### SEC-018: `X-Powered-By` header exposed

| Attribute          | Detail                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scanner alert      | Server Leaks Information via X-Powered-By (Low, Medium confidence, CWE-497)                                                                            |
| Affected endpoints | `/`, `/login`, `/tenant/login`, `/tenant/forgot-password`, others (Systemic)                                                                           |
| Evidence           | `X-Powered-By: Next.js`. `next.config.ts` does not set `poweredByHeader: false`                                                                        |
| Impact             | Names the framework, without a version. Paths such as `/_next/` reveal it anyway                                                                       |
| Exploitability     | None directly                                                                                                                                          |
| False positive?    | True observation, minimal impact                                                                                                                       |
| Recommendation     | Set `poweredByHeader: false`                                                                                                                           |
| Validation         | Header absent from dynamic and static responses                                                                                                        |
| Retest status      | Fix in working tree, checked on a local build 2026-11-04, [details](security-remediation-tracker.md#zap-fixes-2026-11-04). Not deployed, ZAP not rerun |

<a id="sec-019"></a>

### SEC-019: `sd_tenant` cookie lacks HttpOnly

| Attribute          | Detail                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scanner alert      | Cookie No HttpOnly Flag (Low, Medium confidence, CWE-1004)                                                                                             |
| Affected endpoints | `/tenant/$`, `/tenant/login`, `/tenant/forgot-password`                                                                                                |
| Evidence           | `Set-Cookie: sd_tenant=tenant; Path=/; Max-Age=2592000; Secure; SameSite=lax`                                                                          |
| Impact             | The cookie holds a workspace slug hint, not a session. Reading it reveals only the workspace label                                                     |
| Exploitability     | None for session theft. It is validated by `isValidTenantSlug` and used only for internal redirects                                                    |
| False positive?    | True but not a session cookie. Nothing in client code reads it, as only `src/proxy.ts` uses it, so HttpOnly can be added safely                        |
| Scanner blind spot | The real session cookies never appeared in the scan. They are covered by [SEC-011](application-security-assessment.md#sec-011)                         |
| Recommendation     | Add `httpOnly: true` in `rememberTenant`                                                                                                               |
| Validation         | `Set-Cookie` includes HttpOnly. Tenant sign-in redirects still work                                                                                    |
| Retest status      | Fix in working tree, checked on a local build 2026-11-04, [details](security-remediation-tracker.md#zap-fixes-2026-11-04). Not deployed, ZAP not rerun |

<a id="sec-021"></a>

### SEC-021: Cross-Domain Misconfiguration

| Attribute          | Detail                                                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scanner alert      | Cross-Domain Misconfiguration (Medium, Medium confidence, CWE-264)                                                                                                                  |
| Affected endpoints | `/_next/static/immutable/chunks/*`, `/_next/static/immutable/media/*`, `/robots.txt`, `/sitemap.xml`. Also prerendered public pages such as `/` and `/setup`                        |
| Evidence           | `Access-Control-Allow-Origin: *`. The application sets no CORS headers, so this appears to be Vercel's handling of static and prerendered output                                    |
| Impact             | Other sites can read public content they could fetch anyway. `*` does not permit credentialed reads                                                                                 |
| Exploitability     | None shown on observed instances                                                                                                                                                    |
| False positive?    | Likely, for all observed content. It stays open only because authenticated and dynamic routes were never observed. Dynamic `/login` responses in Z2 and Z3 did not carry the header |
| Recommendation     | No change for static assets. Confirm no authenticated response carries a permissive header                                                                                          |
| Validation         | Authenticated staging scan: no `Access-Control-Allow-Origin: *` on any response with tenant data                                                                                    |
| Retest status      | Not retested                                                                                                                                                                        |

<a id="sec-022"></a>

### SEC-022: Big Redirect Detected

| Attribute         | Detail                                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scanner alert     | Big Redirect Detected (Low, Medium confidence, CWE-201)                                                                                                                                          |
| Affected endpoint | `/platform`, unauthenticated. Other instances not visible                                                                                                                                        |
| Evidence          | `307`, `Location: /login`, `Cache-Control: private, no-cache, no-store`, HTML body with `__next_error__` and skeleton markup. The predicted size was 306 bytes                                   |
| Impact            | Would matter only if the body carried console data                                                                                                                                               |
| Exploitability    | Unlikely. `requirePlatformAdmin` runs in the layout and in each page before any service-role read, and the visible body is a loading shell. **The screenshot shows only a fragment of the body** |
| False positive?   | Probably a by-product of how Next.js renders a redirect from a server component. Not closed until the whole body is read                                                                         |
| Recommendation    | Inspect the entire response. No code change expected if it is only a shell                                                                                                                       |
| Validation        | Fetch `/platform` anonymously in staging, and confirm the body has no tenant names, emails, counts or settings                                                                                   |
| Retest status     | Local build 2026-11-04: 26 KB anonymous body with no console data. Marked False Positive. Confirm once on deployment                                                                             |

<a id="sec-023"></a>

### SEC-023: Strict-Transport-Security Header Not Set

| Attribute          | Detail                                                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scanner alert      | Strict-Transport-Security Header Not Set (Low, CWE-319), Z1 and Z2 only                                                                                                                                                                           |
| Affected endpoints | `/`, `/?_rsc=…`, `/forgot-password?_rsc=…`, `/setup`, `/setup?_rsc=…`                                                                                                                                                                             |
| Evidence           | The recorded request has `If-None-Match` and the response is `304 Not Modified`. Full `200` responses in the same report include `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, and `next.config.ts` sets it globally |
| Impact             | None shown. Browsers apply HSTS from the full response                                                                                                                                                                                            |
| Exploitability     | None                                                                                                                                                                                                                                              |
| False positive?    | **Yes**, for the instance examined. Other instances were listed without response details                                                                                                                                                          |
| Recommendation     | No change                                                                                                                                                                                                                                         |
| Validation         | Confirm the header on `200` responses. Z3 already shows it on those                                                                                                                                                                               |
| Retest status      | Alert absent from Z3, but this is not a formal retest                                                                                                                                                                                             |

<a id="sec-024"></a>

### SEC-024: User Controllable HTML Element Attribute

| Attribute          | Detail                                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scanner alert      | User Controllable HTML Element Attribute, Potential XSS (Informational, Low confidence, CWE-20)                                                                          |
| Affected endpoints | `/login?…&remember=on`, `/tenant/login?…&remember=on`, `/tenant/login?…&next=…&remember=on`. 3 instances                                                                 |
| Evidence           | All three report `remember=on` matching a `<button value="on">`                                                                                                          |
| Analysis           | The app's Checkbox uses Radix, whose default is `value = "on"` (`@radix-ui/react-checkbox`). So the value is a **constant matching by coincidence**, not reflected input |
| Impact             | None shown                                                                                                                                                               |
| Exploitability     | None shown. The ZAP active XSS rule raised 0 alerts, unauthenticated                                                                                                     |
| False positive?    | **Yes**. Confirm by sending `remember=test` to see that the attribute stays `on`                                                                                         |
| Recommendation     | No change                                                                                                                                                                |
| Validation         | Request `/login?remember=test` in staging. The button value stays `on`                                                                                                   |
| Retest status      | `/login?remember=test` on local build 2026-11-04: value stays `on`. Confirmed False Positive                                                                             |

<a id="sec-025"></a>

### SEC-025: Re-examine Cache-control Directives

| Attribute          | Detail                                                                                                                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scanner alert      | Re-examine Cache-control Directives (Informational, Low confidence, CWE-525)                                                                                                                                                                         |
| Affected endpoints | `/`, `/robots.txt`, `/setup`, `/setup?…`, `/sitemap.xml`                                                                                                                                                                                             |
| Evidence           | `Cache-Control: public, max-age=0, must-revalidate`. In Z3, dynamic `/login` shows `private, no-cache, no-store`                                                                                                                                     |
| Impact             | None for public pages. In Z2 only, `/setup?fullName=…&password=ZAP…` had `X-Vercel-Cache: HIT` with `X-Nextjs-Prerender: 1`, which indicates the CDN answered with the prerendered page. Credentials in such URLs are covered by [SEC-014](#sec-014) |
| Exploitability     | None shown                                                                                                                                                                                                                                           |
| False positive?    | Yes for public content. Authenticated pages have not been observed                                                                                                                                                                                   |
| Recommendation     | Confirm tenant and portal pages send `private, no-store`                                                                                                                                                                                             |
| Validation         | Authenticated staging crawl: no tenant data response carries `public` or `X-Vercel-Cache: HIT`                                                                                                                                                       |
| Retest status      | Not retested                                                                                                                                                                                                                                         |

<a id="sec-026"></a>

### SEC-026: Retrieved from Cache

| Attribute          | Detail                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| Scanner alert      | Retrieved from Cache (Informational, Medium confidence, CWE-525)       |
| Affected endpoints | `/_next/static/immutable/*`, `/robots.txt`, `/sitemap.xml`             |
| Evidence           | `Age` header, such as `Age: 405509` on a font file                     |
| Impact             | None for these public assets. This is normal CDN behaviour             |
| Exploitability     | None shown                                                             |
| False positive?    | Yes for observed content. Tracked with SEC-025 for authenticated pages |
| Recommendation     | No change for static assets                                            |
| Validation         | Same authenticated crawl as SEC-025                                    |
| Retest status      | Not retested                                                           |

<a id="sec-027"></a>

### SEC-027: Authentication Request Identified

| Attribute          | Detail                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| Scanner alert      | Authentication Request Identified (Informational, Low confidence)                                         |
| Affected endpoints | `/setup?…`, `/login?…`, `/tenant/login?…`. 4 instances                                                    |
| Evidence           | ZAP labelled the parameters `userParam`, `passwordParam`. ZAP's own guidance says there is nothing to fix |
| Impact             | None. This alert only helps set up scan authentication                                                    |
| Exploitability     | Not applicable                                                                                            |
| False positive?    | Not a vulnerability. The GET behaviour it incidentally shows belongs to [SEC-014](#sec-014)               |
| Recommendation     | Use it to configure authenticated scanning in staging                                                     |
| Validation         | None needed                                                                                               |
| Retest status      | Not applicable                                                                                            |

<a id="sec-028"></a>

### SEC-028: Modern Web Application

| Attribute          | Detail                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Scanner alert      | Modern Web Application (Informational, Medium confidence)                                                                       |
| Affected endpoints | `/platform`, others not visible. 3 instances                                                                                    |
| Evidence           | Pages with scripts and no links, for example `<script src="/_next/static/immutable/chunks/…js" async>`                          |
| Impact             | Not a vulnerability, but a **coverage warning**. The standard spider cannot follow this app, and the Client Spider failed in Z4 |
| Exploitability     | Not applicable                                                                                                                  |
| False positive?    | Not a vulnerability                                                                                                             |
| Recommendation     | Fix the ZAP browser setup and use the Client Spider or Ajax Spider in staging                                                   |
| Validation         | The Sites tree shows authenticated routes                                                                                       |
| Retest status      | Not applicable                                                                                                                  |

## 4. Passing rules

Z2 lists rules that raised nothing, including Anti-clickjacking, X-Content-Type-Options, Cookie Without Secure Flag, Cookie Without SameSite, Vulnerable JS Library, Application Error Disclosure and Absence of Anti-CSRF Tokens. A pass covers only the unauthenticated traffic the scan saw.

## 5. Retest procedure

1. Apply the fix and deploy to staging.
2. Run ZAP against staging with the same rules, plus authenticated contexts. See the [methodology](security-testing-methodology.md).
3. Run each item's validation step above, and save the request and response.
4. Update the [tracker](security-remediation-tracker.md) with evidence and date.
5. Export the full ZAP report (HTML or JSON) rather than screenshots.
