import { NextRequest, NextResponse } from 'next/server';
import { fetchRecommendations, type RecQuery } from '@/lib/jobapi';

export const dynamic = 'force-dynamic';

/**
 * Concise, aggregator-friendly keyword queries per track. These feed Adzuna's
 * `what_or` (match ANY word, then relevance-rank), which is what returns real
 * results — the raw boolean search strings are built for LinkedIn/Google and
 * over-constrain keyword APIs to zero hits. Track names match the role "track"
 * values so the UI's per-track filter lines up.
 *
 * `where: null` = nationwide (for the inherently-remote track); others default
 * to the configured location (Raleigh) with a ~30mi radius.
 */
const TRACK_QUERIES: RecQuery[] = [
  { track: 'F&B Director / GM', text: 'restaurant general manager food beverage director hospitality' },
  { track: 'Foodservice Sales', text: 'foodservice sales territory account manager food distributor' },
  { track: 'Procurement / Supply Chain', text: 'procurement buyer purchasing supply chain sourcing planner' },
  { track: 'Aviation / Airport Operations', text: 'airport aviation operations manager ground station' },
  { track: 'Operations / Business Development', text: 'operations manager business development director' },
  {
    track: 'Remote Hospitality SaaS / Tech',
    text: 'restaurant hospitality account executive customer success',
    where: null,
  },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const only = searchParams.get('track'); // optional: restrict to one track
  const custom = searchParams.get('q'); // optional: a raw query overriding the presets
  const perQuery = Math.min(Number(searchParams.get('per') || 8), 15);

  let queries: RecQuery[];
  if (custom) {
    queries = [{ text: custom, track: only || 'Custom' }];
  } else {
    queries = only ? TRACK_QUERIES.filter((q) => q.track === only) : TRACK_QUERIES;
  }

  try {
    const { listings, provider, errors } = await fetchRecommendations(queries, perQuery);
    return NextResponse.json({ listings, provider, errors });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Search failed' }, { status: 500 });
  }
}
