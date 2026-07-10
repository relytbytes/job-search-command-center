import { NextRequest, NextResponse } from 'next/server';
import { fetchRecommendations } from '@/lib/jobapi';
import { TERM_GROUPS } from '@/lib/seed';

export const dynamic = 'force-dynamic';

/**
 * Maps a boolean-search term group to the role "track" it feeds. Keeps recommendations
 * grouped by the same lanes the pipeline uses.
 */
const GROUP_TO_TRACK: Record<string, string> = {
  'Hospitality Leadership (F&B Director / GM / Beverage Director)': 'F&B Director / GM',
  'Wine & Spirits Distribution / Beverage Sales': 'Foodservice Sales',
  'Remote Hospitality SaaS / Tech Sales': 'Remote Hospitality SaaS / Tech',
  'Aviation / Ops-Adjacent Management': 'Aviation / Airport Operations',
  'General Management (cross-industry)': 'Operations / Business Development',
  'Procurement / Supply Chain': 'Procurement / Supply Chain',
  'Aviation, Airport & RDU-Adjacent': 'Aviation / Airport Operations',
  'Foodservice Sales & Account Management': 'Foodservice Sales',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const only = searchParams.get('track'); // optional: restrict to one track/group
  const custom = searchParams.get('q'); // optional: a raw query overriding the presets
  const perQuery = Math.min(Number(searchParams.get('per') || 5), 10);

  let queries: { text: string; track: string }[];
  if (custom) {
    queries = [{ text: custom, track: only || 'Custom' }];
  } else {
    // One representative query (the first, most-targeted string) per relevant group.
    queries = TERM_GROUPS.map((g) => ({
      text: g.items[0],
      track: GROUP_TO_TRACK[g.title] || g.title,
    })).filter((q) => !only || q.track === only);
  }

  try {
    const { listings, provider, errors } = await fetchRecommendations(queries, perQuery);
    return NextResponse.json({ listings, provider, errors });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Search failed' }, { status: 500 });
  }
}
