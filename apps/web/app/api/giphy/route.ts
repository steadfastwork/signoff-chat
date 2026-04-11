import { NextRequest, NextResponse } from "next/server";

const GIPHY_BASE = "https://api.giphy.com/v1/gifs";

/**
 * Server-side proxy for GIPHY API.
 * Keeps the API key out of the browser bundle.
 *
 * GET /api/giphy?type=trending&limit=24
 * GET /api/giphy?type=search&q=cats&limit=24
 */
export async function GET(req: NextRequest) {
  const apiKey = process.env.GIPHY_API_KEY ?? process.env.NEXT_PUBLIC_GIPHY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GIPHY not configured" }, { status: 503 });
  }

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") ?? "trending";
  const q = searchParams.get("q") ?? "";
  const limit = Math.min(Number(searchParams.get("limit") ?? "24"), 48);

  const params = new URLSearchParams({
    api_key: apiKey,
    limit: String(limit),
    rating: "g",
  });

  let url: string;
  if (type === "search" && q.trim()) {
    params.set("q", q.trim());
    url = `${GIPHY_BASE}/search?${params}`;
  } else {
    url = `${GIPHY_BASE}/trending?${params}`;
  }

  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) {
    return NextResponse.json({ error: "GIPHY request failed" }, { status: res.status });
  }

  const data = await res.json();

  // Slim down the response — only send what the picker needs
  const gifs = (data.data ?? []).map((g: any) => ({
    id: String(g.id),
    title: g.title ?? "",
    url: g.images?.original?.url ?? "",
    previewUrl: g.images?.fixed_width_small?.url ?? g.images?.fixed_width?.url ?? g.images?.original?.url ?? "",
    width: Number(g.images?.original?.width ?? 0),
    height: Number(g.images?.original?.height ?? 0),
  }));

  return NextResponse.json({ gifs });
}
