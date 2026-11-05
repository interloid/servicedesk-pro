export type ShellIdentity = {
  org: {
    id: string;
    name: string;
    initial: string;
    planSummary: string;
    /** The plan's display name, e.g. "Free" or "Pro". */
    planName: string;
    /** Whether the plan turns on the Audit log (features_json.audit_logs). */
    auditLogs: boolean;
  };

  user: {
    id: string;
    name: string;
    email: string;
    initials: string;
    avatarUrl?: string;
    role: string;
    /** The login token still carries an older role than the live membership. */
    tokenRoleStale: boolean;
  };
};
