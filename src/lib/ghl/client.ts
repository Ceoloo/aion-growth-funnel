import "server-only";
import { fetchJson, IntegrationError } from "../http";
import type { GhlConfig } from "./config";
import type { GhlContactUpsert } from "./mapping";

/**
 * GoHighLevel REST client.
 *
 * Endpoints and the `Version` header follow HighLevel's public API reference
 * (https://marketplace.gohighlevel.com/docs/). One version value is used for
 * every call — see `GHL_API_VERSION` in docs/ghl-integration.md — so versions
 * are never mixed within a single delivery.
 *
 * Authentication is deliberately behind `AuthProvider`. Today it returns the
 * location-scoped token from the environment; adding marketplace OAuth later
 * means supplying a different provider, not rewriting the client.
 */

export interface AuthProvider {
  /** Returns a bearer token valid for the given location. */
  getAccessToken(locationId: string): Promise<string>;
  readonly kind: string;
}

export class StaticLocationTokenProvider implements AuthProvider {
  readonly kind = "location-token";
  constructor(private readonly token: string) {}
  async getAccessToken(): Promise<string> {
    return this.token;
  }
}

export interface GhlContact {
  id: string;
  email?: string;
  tags?: string[];
}

export interface GhlOpportunity {
  id: string;
  name?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  status?: string;
  contactId?: string;
}

export interface GhlNote {
  id: string;
  body?: string;
}

export class GhlClient {
  constructor(
    private readonly config: GhlConfig,
    private readonly auth: AuthProvider,
  ) {}

  private get locationId(): string {
    const id = this.config.locationId;
    if (!id) {
      throw new IntegrationError("GHL_LOCATION_ID is not configured", {
        kind: "configuration",
      });
    }
    return id;
  }

  private async headers(): Promise<Record<string, string>> {
    const token = await this.auth.getAccessToken(this.locationId);
    return {
      Authorization: `Bearer ${token}`,
      Version: this.config.apiVersion,
    };
  }

  private url(path: string, query?: Record<string, string | undefined>): string {
    const url = new URL(`${this.config.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
    return url.toString();
  }

  /**
   * Create-or-update a contact. Idempotent by email within a location, which
   * is what makes a retry after an ambiguous timeout safe: replaying the
   * upsert updates the same contact rather than creating a second one.
   */
  async upsertContact(payload: GhlContactUpsert): Promise<{ contact: GhlContact; isNew: boolean }> {
    const result = await fetchJson<{ contact?: GhlContact; new?: boolean; id?: string }>(
      this.url("/contacts/upsert"),
      {
        method: "POST",
        headers: await this.headers(),
        body: payload,
        timeoutMs: this.config.timeoutMs,
        label: "GHL upsert contact",
      },
    );
    const contact = result.data.contact ?? (result.data.id ? { id: result.data.id } : undefined);
    if (!contact?.id) {
      throw new IntegrationError("GHL upsert contact: response contained no contact id", {
        kind: "permanent",
        status: result.status,
      });
    }
    return { contact, isNew: result.data.new === true };
  }

  async getContact(contactId: string): Promise<GhlContact | null> {
    try {
      const result = await fetchJson<{ contact?: GhlContact }>(
        this.url(`/contacts/${encodeURIComponent(contactId)}`),
        {
          method: "GET",
          headers: await this.headers(),
          timeoutMs: this.config.timeoutMs,
          label: "GHL get contact",
        },
      );
      return result.data.contact ?? null;
    } catch (error) {
      if (error instanceof IntegrationError && error.status === 404) return null;
      throw error;
    }
  }

  /**
   * Adds tags without touching the ones already on the contact. The endpoint
   * is additive and returns the contact's full tag list afterwards.
   */
  async addTags(contactId: string, tags: string[]): Promise<string[]> {
    if (tags.length === 0) return [];
    const result = await fetchJson<{ tags?: string[] }>(
      this.url(`/contacts/${encodeURIComponent(contactId)}/tags`),
      {
        method: "POST",
        headers: await this.headers(),
        body: { tags },
        timeoutMs: this.config.timeoutMs,
        label: "GHL add tags",
      },
    );
    return result.data.tags ?? [];
  }

  async searchOpportunities(params: {
    contactId: string;
    pipelineId?: string;
  }): Promise<GhlOpportunity[]> {
    const result = await fetchJson<{ opportunities?: GhlOpportunity[] }>(
      this.url("/opportunities/search", {
        locationId: this.locationId,
        contactId: params.contactId,
        pipelineId: params.pipelineId,
        status: "all",
        limit: "20",
      }),
      {
        method: "GET",
        headers: await this.headers(),
        timeoutMs: this.config.timeoutMs,
        label: "GHL search opportunities",
      },
    );
    return result.data.opportunities ?? [];
  }

  async createOpportunity(payload: {
    name: string;
    contactId: string;
    pipelineId: string;
    pipelineStageId?: string;
    assignedTo?: string;
  }): Promise<GhlOpportunity> {
    const result = await fetchJson<{ opportunity?: GhlOpportunity; id?: string }>(
      this.url("/opportunities/"),
      {
        method: "POST",
        headers: await this.headers(),
        body: {
          locationId: this.locationId,
          name: payload.name,
          contactId: payload.contactId,
          pipelineId: payload.pipelineId,
          // Status is always `open`. An assessment is an inquiry, never a won
          // deal, and we never set a monetary value we cannot justify.
          status: "open",
          ...(payload.pipelineStageId ? { pipelineStageId: payload.pipelineStageId } : {}),
          ...(payload.assignedTo ? { assignedTo: payload.assignedTo } : {}),
        },
        timeoutMs: this.config.timeoutMs,
        label: "GHL create opportunity",
      },
    );
    const opportunity =
      result.data.opportunity ?? (result.data.id ? { id: result.data.id } : undefined);
    if (!opportunity?.id) {
      throw new IntegrationError("GHL create opportunity: response contained no id", {
        kind: "permanent",
        status: result.status,
      });
    }
    return opportunity;
  }

  async listNotes(contactId: string): Promise<GhlNote[]> {
    const result = await fetchJson<{ notes?: GhlNote[] }>(
      this.url(`/contacts/${encodeURIComponent(contactId)}/notes`),
      {
        method: "GET",
        headers: await this.headers(),
        timeoutMs: this.config.timeoutMs,
        label: "GHL list notes",
      },
    );
    return result.data.notes ?? [];
  }

  async createNote(contactId: string, body: string, userId?: string): Promise<GhlNote> {
    const result = await fetchJson<{ note?: GhlNote; id?: string }>(
      this.url(`/contacts/${encodeURIComponent(contactId)}/notes`),
      {
        method: "POST",
        headers: await this.headers(),
        body: { body, ...(userId ? { userId } : {}) },
        timeoutMs: this.config.timeoutMs,
        label: "GHL create note",
      },
    );
    const note = result.data.note ?? (result.data.id ? { id: result.data.id } : undefined);
    if (!note?.id) {
      throw new IntegrationError("GHL create note: response contained no id", {
        kind: "permanent",
        status: result.status,
      });
    }
    return note;
  }
}

/**
 * Posts an event to an inbound workflow webhook.
 *
 * A 2xx here means GoHighLevel accepted the event, which is not the same as
 * every workflow action having completed. The delivery record says
 * "event accepted", never "workflow finished".
 */
export async function postInboundWorkflowEvent(
  url: string,
  event: unknown,
  options: { timeoutMs: number; secret?: string },
): Promise<{ status: number }> {
  const result = await fetchJson(url, {
    method: "POST",
    headers: options.secret ? { "X-AION-Signature": options.secret } : {},
    body: event,
    timeoutMs: options.timeoutMs,
    label: "GHL inbound workflow webhook",
  });
  return { status: result.status };
}
