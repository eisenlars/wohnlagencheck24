import { NextResponse } from "next/server";

import { rebuildPublicRequestEntriesForPartner } from "@/lib/public-asset-projections";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export async function POST() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const count = await rebuildPublicRequestEntriesForPartner(user.id, admin);
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
