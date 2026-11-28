export const APP_ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  /**
   * The demo sign-in page: each role, what it does, and a one-click sign-in.
   * Under /login because `login` can never be a workspace slug. It sends
   * visitors to /login unless demo mode is on (see features/auth/demo-accounts).
   */
  DEMO_LOGIN: "/login/demo",
  SIGNUP: "/signup",
  CONTACT_SALES: "/contact-sales",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",
  SETUP: "/setup",
  AUTH_CALLBACK: "/auth/callback",
  /**
   * Tenant-less, so it renders without the workspace shell -- which is the
   * whole point: a customer must never see the agent dashboard chrome. Kept
   * out of every tenant route (see RESERVED_LABELS) and treated as a central
   * path by the proxy, so it is reachable signed out and by a customer session.
   */
  UNAUTHORIZED: "/unauthorized",
  /** Served by the proxy for tenant URLs while maintenance mode is on. */
  MAINTENANCE: "/maintenance",
  /** Served by the proxy for a blocked workspace's URLs. */
  BLOCKED: "/blocked",
} as const;
