import { NextResponse } from "next/server";

// Edge Runtime: no cold-start cost, instant response
export const runtime = "edge";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      // Short SHA injected by Vercel at build time
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
      env: process.env.VERCEL_ENV ?? "development",
    },
    {
      headers: {
        // Never cache health checks
        "Cache-Control": "no-store",
      },
    }
  );
}
