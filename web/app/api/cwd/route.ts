/**
 * GET /api/cwd
 *
 * Returns the server's current working directory.
 * Used by the browser process shim to initialise process.cwd().
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ cwd: process.cwd() });
}
