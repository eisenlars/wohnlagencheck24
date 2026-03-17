"use client";

import type { LeadGeneratorSubmissionPayload } from "./types";

export async function submitLeadGenerator(payload: LeadGeneratorSubmissionPayload): Promise<{
  ok: boolean;
  error?: string;
  retryAfterSec?: number;
}> {
  const response = await fetch("/api/lead-generators/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    retry_after_sec?: number;
  };

  if (!response.ok) {
    return {
      ok: false,
      error: body.error ?? "SUBMISSION_FAILED",
      retryAfterSec: body.retry_after_sec,
    };
  }

  return { ok: true };
}
