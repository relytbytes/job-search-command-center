import { NextRequest, NextResponse } from 'next/server';
import { fetchRecommendations, type RecQuery } from '@/lib/jobapi';
import { REC_TRACKS } from '@/lib/recTracks';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const only = searchParams.get('track'); // optional: restrict to one track
  const custom = searchParams.get('q'); // optional: a raw query overriding the presets
  const perQuery = Math.min(Number(searchParams.get('per') || 8), 15);

  let queries: RecQuery[];
  if (custom) {
    queries = [{ text: custom, track: only || 'Custom' }];
  } else {
    const tracks = only ? REC_TRACKS.filter((t) => t.track === only) : REC_TRACKS;
    // One exact-phrase query per title within each track.
    queries = tracks.flatMap((t) =>
      t.phrases.map((p) => ({ text: p, track: t.track, where: t.where })),
    );
  }

  try {
    const { listings, provider, errors } = await fetchRecommendations(queries, perQuery);
    return NextResponse.json({ listings, provider, errors });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Search failed' }, { status: 500 });
  }
}
