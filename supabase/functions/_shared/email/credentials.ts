// A valid access token for an integration: decrypted from the row while it
// has life left, otherwise refreshed with the (encrypted) refresh token and
// written back encrypted. Shared by every provider.
//
// Concurrent callers for one integration share one refresh, so a batch of
// messages never refreshes the same token five times.

import { AuthRevokedError } from "./errors.ts";
import { decryptToken, encryptToken, tokenAad } from "./token-crypto.ts";
import type { EmailIntegration, TokenResult } from "./types.ts";

/** Refresh this long before the provider's expiry. */
const EXPIRY_MARGIN_MS = 2 * 60 * 1000;

export interface AccessTokenSource {
  get(integration: EmailIntegration): Promise<string>;
  /** After a 401: the next get() refreshes. */
  invalidate(integration: EmailIntegration): void;
  /** Refresh now, whatever the stored expiry, and persist the result. */
  forceRefresh(integration: EmailIntegration): Promise<TokenResult>;
}

export interface CredentialPersistence {
  saveTokens(
    integrationId: string,
    tokens: {
      accessTokenEncrypted: string;
      tokenExpiresAt: Date;
      refreshTokenEncrypted?: string;
    },
  ): Promise<void>;
}

export type RefreshFn = (refreshToken: string) => Promise<TokenResult>;

export class IntegrationCredentials implements AccessTokenSource {
  private readonly cache = new Map<
    string,
    { token: string; expiresAt: number }
  >();
  private readonly pending = new Map<string, Promise<TokenResult>>();

  constructor(
    private readonly deps: {
      key: CryptoKey;
      refresh: RefreshFn;
      persistence: CredentialPersistence;
      now?: () => number;
      onRefreshFailure?: (
        integration: EmailIntegration,
        error: unknown,
      ) => void;
    },
  ) {}

  private now(): number {
    return this.deps.now ? this.deps.now() : Date.now();
  }

  async get(integration: EmailIntegration): Promise<string> {
    const cached = this.cache.get(integration.id);
    if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > this.now()) {
      return cached.token;
    }

    const aad = tokenAad(integration.tenantId, integration.provider);

    if (
      integration.accessTokenEncrypted &&
      integration.tokenExpiresAt &&
      integration.tokenExpiresAt.getTime() - EXPIRY_MARGIN_MS > this.now() &&
      !this.invalidated.has(integration.id)
    ) {
      const token = await decryptToken(
        integration.accessTokenEncrypted,
        this.deps.key,
        aad,
      );
      this.cache.set(integration.id, {
        token,
        expiresAt: integration.tokenExpiresAt.getTime(),
      });
      return token;
    }

    return (await this.sharedRefresh(integration, aad)).accessToken;
  }

  /** One refresh per integration at a time; concurrent callers share it. */
  private sharedRefresh(
    integration: EmailIntegration,
    aad: string,
  ): Promise<TokenResult> {
    let pending = this.pending.get(integration.id);

    if (!pending) {
      pending = this.refresh(integration, aad).finally(() => {
        this.pending.delete(integration.id);
      });
      this.pending.set(integration.id, pending);
    }

    return pending;
  }

  forceRefresh(integration: EmailIntegration): Promise<TokenResult> {
    this.invalidate(integration);
    return this.sharedRefresh(
      integration,
      tokenAad(integration.tenantId, integration.provider),
    );
  }

  private readonly invalidated = new Set<string>();

  invalidate(integration: EmailIntegration): void {
    this.cache.delete(integration.id);
    this.invalidated.add(integration.id);
  }

  private async refresh(
    integration: EmailIntegration,
    aad: string,
  ): Promise<TokenResult> {
    if (!integration.refreshTokenEncrypted) {
      throw new AuthRevokedError(
        "The mailbox has no refresh token; reconnect it.",
      );
    }

    const refreshToken = await decryptToken(
      integration.refreshTokenEncrypted,
      this.deps.key,
      aad,
    );

    let result: TokenResult;
    try {
      result = await this.deps.refresh(refreshToken);
    } catch (error) {
      this.deps.onRefreshFailure?.(integration, error);
      throw error;
    }

    await this.deps.persistence.saveTokens(integration.id, {
      accessTokenEncrypted: await encryptToken(
        result.accessToken,
        this.deps.key,
        aad,
      ),
      tokenExpiresAt: result.expiresAt,
      // Google rarely rotates refresh tokens, but when it does the old one stops working.
      refreshTokenEncrypted: result.refreshToken
        ? await encryptToken(result.refreshToken, this.deps.key, aad)
        : undefined,
    });

    this.invalidated.delete(integration.id);
    this.cache.set(integration.id, {
      token: result.accessToken,
      expiresAt: result.expiresAt.getTime(),
    });

    return result;
  }
}
