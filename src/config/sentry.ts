import type { BrowserOptions } from "@sentry/nextjs";

/**
 * What every Sentry setup may collect. Sentry v11 collects cookies, user details
 * and request bodies unless told otherwise, and here those hold customer tickets,
 * login tokens and invoice links. Errors and stack traces still arrive.
 */
export const SENTRY_DATA_COLLECTION: BrowserOptions["dataCollection"] = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
};
