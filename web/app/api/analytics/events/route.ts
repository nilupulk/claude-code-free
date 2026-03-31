import { NextRequest, NextResponse } from "next/server";
import type { EventBatch } from "@/lib/analytics/events";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function POST(req: NextRequest) {
  let body: EventBatch;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body?.events)) {
    return NextResponse.json({ error: "events must be an array" }, { status: 400 });
  }

  // Forward the validated batch to the Express backend.
  try {
    const resp = await fetch(`${BACKEND_URL}/analytics/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      return NextResponse.json({ error: "Backend error" }, { status: resp.status });
    }

    return NextResponse.json({ ok: true, received: body.events.length });
  } catch {
    // Backend unreachable — acknowledge silently so the client isn't disrupted.
    return NextResponse.json({ ok: true, received: 0 });
  }
}
