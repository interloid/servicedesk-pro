// EmailProvider for Gmail. Every Gmail-specific detail -- history pages,
// label ids, the watch topic, the attachment endpoint -- stays in this
// folder; the processor and the ticket logic only see IncomingEmail.

import type { AccessTokenSource } from "../../credentials.ts";
import { AuthRevokedError, HistoryExpiredError } from "../../errors.ts";
import type {
  EmailIntegration,
  EmailProvider,
  IncomingAttachment,
  IncomingEmail,
  MailboxChanges,
  TokenResult,
  WatchResult,
} from "../../types.ts";
import {
  GmailApi,
  type GoogleClientConfig,
  type FetchLike,
  refreshAccessToken as refreshGoogleToken,
} from "./gmail-api.ts";
import { normalizeGmailMessage } from "./gmail-normalize.ts";
import { base64UrlToBytes } from "./mime.ts";

/** Most history pages read in one sync; the rest waits for the next run. */
const MAX_HISTORY_PAGES = 20;

/** When the cursor has aged out: inbox mail from this far back is re-listed. */
const RECOVERY_QUERY = "{in:inbox in:sent} newer_than:2d";
const RECOVERY_MAX_MESSAGES = 200;

export interface GmailProviderOptions {
  google: GoogleClientConfig;
  /** projects/<project>/topics/<topic> */
  pubsubTopic: string;
  credentials: AccessTokenSource;
  fetchImpl?: FetchLike;
}

export class GmailProvider implements EmailProvider {
  readonly name = "gmail" as const;
  private readonly api: GmailApi;

  constructor(private readonly options: GmailProviderOptions) {
    this.api = new GmailApi(options.fetchImpl ?? fetch);
  }

  /**
   * Run `call` with a valid token; on a 401 refresh once and try again. A
   * second 401 means the grant itself is gone.
   */
  private async withToken<T>(
    integration: EmailIntegration,
    call: (token: string) => Promise<T>,
  ): Promise<T> {
    const token = await this.options.credentials.get(integration);

    try {
      return await call(token);
    } catch (error) {
      if (!(error instanceof AuthRevokedError)) throw error;
      this.options.credentials.invalidate(integration);
      return call(await this.options.credentials.get(integration));
    }
  }

  async listChanges(
    integration: EmailIntegration,
    historyId: string,
  ): Promise<MailboxChanges> {
    return this.withToken(integration, async (token) => {
      const ids: string[] = [];
      const seen = new Set<string>();
      let pageToken: string | undefined;
      let latest = historyId;
      let lastEntry: string | null = null;

      try {
        for (let page = 0; page < MAX_HISTORY_PAGES; page += 1) {
          const response = await this.api.listHistory(token, {
            startHistoryId: historyId,
            pageToken,
          });

          latest = response.historyId ?? latest;

          for (const entry of response.history ?? []) {
            lastEntry = entry.id ?? lastEntry;
            for (const added of entry.messagesAdded ?? []) {
              const message = added.message;
              const labels = message.labelIds ?? [];
              // Inbox mail (customers) and sent mail (the team replying
              // from Gmail). Drafts, spam, trash and anything archived
              // straight past the inbox by a filter are left alone.
              if (
                labels.includes("DRAFT") ||
                labels.includes("SPAM") ||
                labels.includes("TRASH") ||
                !(labels.includes("INBOX") || labels.includes("SENT"))
              ) {
                continue;
              }
              if (!seen.has(message.id)) {
                seen.add(message.id);
                ids.push(message.id);
              }
            }
          }

          pageToken = response.nextPageToken;
          if (!pageToken) {
            return { messageIds: ids, historyId: latest, cursorReset: false };
          }
        }

        // Out of pages for this run. The historyId on each page is the
        // mailbox's latest, so saving it would skip the pages not read yet;
        // save the last entry read instead and the next sync continues there.
        return {
          messageIds: ids,
          historyId: lastEntry ?? historyId,
          cursorReset: false,
        };
      } catch (error) {
        if (!(error instanceof HistoryExpiredError)) throw error;
        return this.recover(token);
      }
    });
  }

  /**
   * The cursor is older than Gmail's history (about a week): list recent
   * inbox mail instead and start again from the mailbox's current cursor.
   * The ledger's unique constraint drops anything already filed.
   */
  private async recover(token: string): Promise<MailboxChanges> {
    const profile = await this.api.getProfile(token);
    const ids: string[] = [];
    let pageToken: string | undefined;

    while (ids.length < RECOVERY_MAX_MESSAGES) {
      const list = await this.api.listMessages(token, {
        q: RECOVERY_QUERY,
        maxResults: 100,
        pageToken,
      });
      for (const message of list.messages ?? []) ids.push(message.id);
      pageToken = list.nextPageToken;
      if (!pageToken) break;
    }

    // messages.list is newest first; process oldest first.
    return {
      messageIds: ids.reverse(),
      historyId: profile.historyId,
      cursorReset: true,
    };
  }

  async getNewMessages(
    integration: EmailIntegration,
    historyId: string,
  ): Promise<IncomingEmail[]> {
    const changes = await this.listChanges(integration, historyId);
    const messages: IncomingEmail[] = [];
    for (const id of changes.messageIds) {
      messages.push(await this.getMessage(integration, id));
    }
    return messages;
  }

  getMessage(
    integration: EmailIntegration,
    messageId: string,
  ): Promise<IncomingEmail> {
    return this.withToken(integration, async (token) =>
      normalizeGmailMessage(await this.api.getMessage(token, messageId)),
    );
  }

  async getAttachmentContent(
    integration: EmailIntegration,
    messageId: string,
    attachment: IncomingAttachment,
  ): Promise<Uint8Array> {
    if (attachment.data) return attachment.data;

    if (!attachment.providerAttachmentId) {
      return new Uint8Array();
    }

    const body = await this.withToken(integration, (token) =>
      this.api.getAttachment(
        token,
        messageId,
        attachment.providerAttachmentId!,
      ),
    );

    return body.data ? base64UrlToBytes(body.data) : new Uint8Array();
  }

  /** A new access token from the refresh token, persisted (encrypted) by the credentials source. */
  refreshAccessToken(integration: EmailIntegration): Promise<TokenResult> {
    return this.options.credentials.forceRefresh(integration);
  }

  async watch(integration: EmailIntegration): Promise<WatchResult> {
    const response = await this.withToken(integration, (token) =>
      this.api.watch(token, this.options.pubsubTopic, ["INBOX", "SENT"]),
    );

    return {
      historyId: String(response.historyId),
      expiration: new Date(Number(response.expiration)),
    };
  }

  async getCurrentHistoryId(integration: EmailIntegration): Promise<string> {
    const profile = await this.withToken(integration, (token) =>
      this.api.getProfile(token),
    );
    return String(profile.historyId);
  }
}

/** For callers that only need a refresh (the credentials' RefreshFn). */
export function gmailRefresher(
  google: GoogleClientConfig,
  fetchImpl: FetchLike = fetch,
) {
  return (refreshToken: string) =>
    refreshGoogleToken({ ...google, refreshToken }, fetchImpl);
}
