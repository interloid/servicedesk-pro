"use client";

import { Building2, Mail, UserRound } from "lucide-react";
import { useState } from "react";

import type { ChatProfile } from "@/features/chatbot/chatbot";

/**
 * The signed-in customer's own profile under the assistant's reply: photo (or
 * initials), name, email and company. The data comes from the server's session,
 * not from the model. Editing stays where it lives -- Profile in the menu.
 */
export function ChatProfileCard({ profile }: { profile: ChatProfile }) {
  const [broken, setBroken] = useState(false);
  const showPhoto = profile.avatarUrl && !broken;

  return (
    <div className="w-full max-w-sm overflow-hidden rounded-2xl border bg-background shadow-xs">
      <div className="h-14 bg-muted" />

      <div className="-mt-9 px-4 pb-4">
        <div className="flex items-end gap-3">
          {showPhoto ? (
            // A public Storage URL from the portal itself (CSP allows it).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl!}
              alt={`${profile.name}'s profile photo`}
              referrerPolicy="no-referrer"
              onError={() => setBroken(true)}
              className="size-16 shrink-0 rounded-full border-4 border-background bg-muted object-cover shadow-sm"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-16 shrink-0 items-center justify-center rounded-full border-4 border-background bg-brand-accent text-lg font-semibold text-brand-accent-foreground shadow-sm"
            >
              {profile.initials || <UserRound className="size-6" />}
            </span>
          )}
          <div className="min-w-0 pb-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {profile.name}
            </p>
            <p className="text-[11px] text-muted-foreground">Your profile</p>
          </div>
        </div>

        <dl className="mt-3 space-y-2 text-[13px]">
          <div>
            <dt className="sr-only">Email</dt>
            <dd className="flex min-w-0 items-center gap-2.5 text-foreground/90">
              <Mail
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0 truncate">{profile.email}</span>
            </dd>
          </div>
          <div>
            <dt className="sr-only">Company</dt>
            <dd className="flex min-w-0 items-center gap-2.5 text-foreground/90">
              <Building2
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0 truncate">
                {profile.company || (
                  <span className="text-muted-foreground">No company set</span>
                )}
              </span>
            </dd>
          </div>
        </dl>

        <p className="mt-3 border-t pt-2.5 text-[11px] text-muted-foreground">
          To change your name, company or photo, open <b>Profile</b> in the menu
          at the top right.
        </p>
      </div>
    </div>
  );
}
