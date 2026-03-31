import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** GET /api/analytics/summary?days=30 — proxied to the Express backend. */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const days = searchParams.get("days") ?? "30";

  try {
    const resp = await fetch(`${BACKEND_URL}/analytics/summary?days=${days}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!resp.ok) {
      return NextResponse.json({ error: "Backend error" }, { status: resp.status });
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Analytics service unavailable" }, { status: 503 });
  }
}

/** DELETE /api/analytics/events — user data deletion request. */
export async function DELETE(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  try {
    const resp = await fetch(
      `${BACKEND_URL}/analytics/events?sessionId=${encodeURIComponent(sessionId)}`,
      { method: "DELETE" },
    );

    if (!resp.ok) {
      return NextResponse.json({ error: "Backend error" }, { status: resp.status });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Analytics service unavailable" }, { status: 503 });
  }
}
