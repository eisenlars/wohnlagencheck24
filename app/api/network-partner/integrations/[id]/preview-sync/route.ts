import { NextResponse } from "next/server";

import { requireNetworkPartnerActorContext } from "@/lib/network-partners/auth";
import { requireNetworkPartnerRole } from "@/lib/network-partners/roles";

function mapPreviewError(error: Error) {
  if (error.message === "UNAUTHORIZED") return { status: 401, error: "Unauthorized" };
  if (error.message === "FORBIDDEN") return { status: 403, error: "Forbidden" };
  return { status: 500, error: error.message || "Unexpected error" };
}

export async function POST() {
  try {
    requireNetworkPartnerRole(
      await requireNetworkPartnerActorContext(),
      ["network_owner", "network_editor"],
    );
    return NextResponse.json(
      { error: "Preview-Sync wird zentral im Admin ausgeführt." },
      { status: 403 },
    );
  } catch (error) {
    const mapped = mapPreviewError(error as Error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
