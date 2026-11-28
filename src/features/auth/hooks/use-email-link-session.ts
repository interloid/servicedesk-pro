"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createSupabaseClient } from "@/lib/supabase/client";
import {
  LINK_ACTION_PARAM,
  LINK_ACTIONS,
} from "@/features/auth/schemas/reset-password";
import type { TenantPasswordAccessResult } from "@/features/auth/services/auth.service";

/** Why the form can't be used at all, as opposed to one bad attempt. */
export type BlockedReason = "expired" | "no-access";

/**
 * Invite: Supabase's own invite mail. Magic link: the mail an existing account
 * gets when it's invited to another workspace. Both are a first password, not
 * a reset.
 */
const FIRST_PASSWORD_TYPES = new Set(["invite", "magiclink"]);
const LINK_TYPES = new Set(["invite", "magiclink", "recovery"]);

export const EXPIRED_LINK_MESSAGE =
  "Email links work once and expire after an hour, so this one has either been used or run out. Request a new link and open it from the newest email.";

export const EXPIRED_INVITE_MESSAGE =
  "Invitation links work once and expire after an hour, so this one has either been used or run out. Contact your admin to send you a new invitation.";

type LinkOutcome = {
  isInviteLink: boolean;
  isFirstPassword: boolean;
  email: string | null;
  error: string | null;
  blockedReason: BlockedReason;
};

/**
 * Turn the email link in the URL into a session, once, and check the person
 * may still set a password. Shared by both reset-password pages so a fix to
 * the link handling lands on both.
 *
 * The URL is read from window.location, not useSearchParams: stripping the
 * code with replaceState updates useSearchParams, which would re-run an
 * effect that depends on it. The work is held in a ref, so Strict Mode's
 * second effect run awaits the same exchange instead of reusing a spent code.
 */
async function verifyEmailLink(
  checkAccess: () => Promise<TenantPasswordAccessResult>,
): Promise<LinkOutcome> {
  const supabase = createSupabaseClient();
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const isInviteLink =
    searchParams.get(LINK_ACTION_PARAM) === LINK_ACTIONS.INVITE;
  const expired: LinkOutcome = {
    isInviteLink,
    isFirstPassword: isInviteLink,
    email: null,
    error: isInviteLink ? EXPIRED_INVITE_MESSAGE : EXPIRED_LINK_MESSAGE,
    blockedReason: "expired",
  };
  const stripUrl = () =>
    window.history.replaceState({}, document.title, window.location.pathname);

  try {
    // Supabase sends a dead link back with the reason in the URL and no
    // tokens. Stop there: falling through to getSession() would pick up
    // whoever is already signed in on this browser and offer to change
    // THEIR password.
    const linkError =
      searchParams.get("error_code") ??
      searchParams.get("error") ??
      hashParams.get("error_code") ??
      hashParams.get("error");

    if (linkError) {
      console.error("[Reset Password] Link rejected:", linkError);
      stripUrl();
      return expired;
    }

    const code = searchParams.get("code");

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("[Reset Password] Code exchange failed:", error.message);
        return expired;
      }

      // A used code must not stay in the URL to be replayed or shared.
      stripUrl();
    }

    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const type = hashParams.get("type");
    let isFirstPassword = isInviteLink;

    if (type && LINK_TYPES.has(type) && accessToken && refreshToken) {
      isFirstPassword = FIRST_PASSWORD_TYPES.has(type);

      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error || !data.session) {
        console.error(
          "[Reset Password] Failed to establish session:",
          error?.message,
        );
        return { ...expired, isFirstPassword };
      }

      stripUrl();
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error(
        "[Reset Password] No valid session:",
        sessionError?.message,
      );
      return { ...expired, isFirstPassword };
    }

    const email = session.user.email ?? null;

    // The link's session proves who they are, not that they still belong:
    // a revoked invite or a removed member keeps a working link.
    const access = await checkAccess();

    if (!access.success) {
      // The server already ended the session; clear this tab's copy too.
      await supabase.auth.signOut({ scope: "local" });
      return {
        isInviteLink,
        isFirstPassword,
        email,
        error: access.error,
        blockedReason: access.reason === "no-access" ? "no-access" : "expired",
      };
    }

    return {
      isInviteLink,
      isFirstPassword,
      email,
      error: null,
      blockedReason: "expired",
    };
  } catch (error) {
    console.error("[Reset Password] Session verification failed:", error);
    return expired;
  }
}

export function useEmailLinkSession(
  checkAccess: () => Promise<TenantPasswordAccessResult>,
) {
  const [verifying, setVerifying] = useState(true);
  const [outcome, setOutcome] = useState<LinkOutcome>({
    isInviteLink: false,
    isFirstPassword: false,
    email: null,
    error: null,
    blockedReason: "expired",
  });
  const runRef = useRef<Promise<LinkOutcome> | null>(null);
  const checkAccessRef = useRef(checkAccess);

  useEffect(() => {
    checkAccessRef.current = checkAccess;
  });

  useEffect(() => {
    let cancelled = false;

    runRef.current ??= verifyEmailLink(() => checkAccessRef.current());
    runRef.current.then((result) => {
      if (cancelled) return;
      setOutcome(result);
      setVerifying(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /** End the form for good: a dead link or access removed while it was open. */
  const block = useCallback((reason: BlockedReason, message: string) => {
    setOutcome((prev) => ({ ...prev, blockedReason: reason, error: message }));
  }, []);

  return { verifying, ...outcome, block };
}
