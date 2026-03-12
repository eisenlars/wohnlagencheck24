import { createAdminClient } from "@/utils/supabase/admin";
import type { AdminRole } from "@/lib/security/admin-auth";

type AuditEntityType =
  | "partner"
  | "partner_area_map"
  | "partner_integration"
  | "partner_secret"
  | "auth_user"
  | "other";

type AuditEventType =
  | "create"
  | "update"
  | "delete"
  | "activate"
  | "deactivate"
  | "rotate"
  | "revoke"
  | "invite"
  | "reset_password"
  | "other";

type AuditLogInput = {
  actorUserId: string;
  actorRole: AdminRole | "system";
  eventType: AuditEventType;
  entityType: AuditEntityType;
  entityId: string;
  payload?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
};

const REDACT_KEYS = [
  "api_key",
  "api_key_encrypted",
  "token",
  "token_hash",
  "token_encrypted",
  "secret",
  "secret_encrypted",
  "password",
  "authorization",
];

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (REDACT_KEYS.includes(k.toLowerCase())) {
      out[k] = "[REDACTED]";
      continue;
    }
    out[k] = redact(v);
  }
  return out;
}

export async function writeSecurityAuditLog(input: AuditLogInput) {
  try {
    const admin = createAdminClient();
    await admin.from("security_audit_log").insert({
      actor_user_id: input.actorUserId,
      actor_role: input.actorRole,
      event_type: input.eventType,
      entity_type: input.entityType,
      entity_id: input.entityId,
      payload: redact(input.payload ?? null),
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("security_audit_log insert failed:", error);
  }
}
