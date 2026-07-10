import type { Listing } from './types';

/**
 * Compliant job-search adapters. We never scrape Indeed/LinkedIn/ZipRecruiter directly
 * (their Terms forbid it). Instead we query an aggregator API that legally indexes those
 * postings. Set JOB_API_PROVIDER to pick one; each needs its own key(s).
 *
 *   adzuna  -> ADZUNA_APP_ID + ADZUNA_APP_KEY        (free tier, https://developer.adzuna.com)
 *   jsearch -> JSEARCH_API_KEY (RapidAPI)            (indexes Google-for-Jobs incl. LinkedIn/ZipRecruiter)
 *   serpapi -> SERPAPI_KEY                           (Google Jobs engine)
 *
 * With no provider configured, we return a small curated sample so the UI is demonstrable.
 */

export type Provider = 'adzuna' | 'jsearch' | 'serpapi' | 'sample';

export function activeProvider(): Provider {
  const p = (process.env.JOB_API_PROVIDER || '').toLowerCase();
  if (p === 'adzuna' && process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) return 'adzuna';
  if (p === 'jsearch' && process.env.JSEARCH_API_KEY) return 'jsearch';
  if (p === 'serpapi' && process.env.SERPAPI_KEY) return 'serpapi';
  // Auto-detect if provider unset but keys present.
  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) return 'adzuna';
  if (process.env.JSEARCH_API_KEY) return 'jsearch';
  if (process.env.SERPAPI_KEY) return 'serpapi';
  return 'sample';
}

const DEFAULT_LOCATION = process.env.JOB_SEARCH_LOCATION || 'Raleigh, North Carolina';

/**
 * Aggregator APIs don't accept raw LinkedIn boolean strings well. We distill a boolean
 * string down to a short keyword query (the leading quoted phrases) that these APIs handle.
 */
export function toKeywords(booleanString: string): string {
  const phrases = Array.from(booleanString.matchAll(/"([^"]+)"/g)).map((m) => m[1]);
  if (phrases.length) return phrases.slice(0, 3).join(' ');
  return booleanString.replace(/\b(AND|OR|NOT)\b/g, ' ').replace(/[()"]/g, ' ').trim().slice(0, 80);
}

function dedupe(listings: Listing[]): Listing[] {
  const seen = new Set<string>();
  return listings.filter((l) => {
    const k = (l.co + '|' + l.role).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function searchAdzuna(
  query: string,
  track: string,
  limit: number,
  where: string | null,
): Promise<Listing[]> {
  const country = process.env.ADZUNA_COUNTRY || 'us';
  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`);
  url.searchParams.set('app_id', process.env.ADZUNA_APP_ID as string);
  url.searchParams.set('app_key', process.env.ADZUNA_APP_KEY as string);
  url.searchParams.set('results_per_page', String(limit));
  // `title_only` matches the words in the job TITLE only — so "beverage director"
  // hits titles like "Beverage Director", not a Sous Chef whose description happens
  // to mention food & beverage. This is the key to relevant results.
  url.searchParams.set('title_only', query);
  // Prune obviously-irrelevant job types that occasionally slip through.
  url.searchParams.set('what_exclude', 'nurse RN CNA caregiver driver warehouse cashier dishwasher');
  url.searchParams.set('sort_by', 'relevance');
  // `where` is optional: null means a nationwide search (used for remote tracks).
  if (where) {
    url.searchParams.set('where', where);
    url.searchParams.set('distance', '50'); // km (~30 mi) around the location
  }

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`Adzuna ${res.status}`);
  const data = await res.json();
  return (data.results || []).map((j: any, i: number): Listing => ({
    id: `adz-${j.id ?? i}`,
    co: j.company?.display_name || 'Unknown',
    role: j.title || '',
    loc: j.location?.display_name || DEFAULT_LOCATION,
    sal:
      j.salary_min || j.salary_max
        ? `$${Math.round((j.salary_min || j.salary_max) / 1000)}K–$${Math.round((j.salary_max || j.salary_min) / 1000)}K`
        : '',
    src: 'Adzuna',
    url: j.redirect_url || '',
    posted: (j.created || '').slice(0, 10),
    snippet: (j.description || '').slice(0, 180),
    track,
  }));
}

async function searchJSearch(
  query: string,
  track: string,
  limit: number,
  where: string | null,
): Promise<Listing[]> {
  const url = new URL('https://jsearch.p.rapidapi.com/search');
  url.searchParams.set('query', where ? `"${query}" in ${where}` : `"${query}" remote`);
  url.searchParams.set('num_pages', '1');
  const res = await fetch(url.toString(), {
    cache: 'no-store',
    headers: {
      'X-RapidAPI-Key': process.env.JSEARCH_API_KEY as string,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
    },
  });
  if (!res.ok) throw new Error(`JSearch ${res.status}`);
  const data = await res.json();
  return (data.data || []).slice(0, limit).map((j: any, i: number): Listing => ({
    id: `js-${j.job_id ?? i}`,
    co: j.employer_name || 'Unknown',
    role: j.job_title || '',
    loc: [j.job_city, j.job_state].filter(Boolean).join(', ') || DEFAULT_LOCATION,
    sal:
      j.job_min_salary || j.job_max_salary
        ? `$${Math.round((j.job_min_salary || j.job_max_salary) / 1000)}K–$${Math.round((j.job_max_salary || j.job_min_salary) / 1000)}K`
        : '',
    src: j.job_publisher || 'JSearch',
    url: j.job_apply_link || j.job_google_link || '',
    posted: (j.job_posted_at_datetime_utc || '').slice(0, 10),
    snippet: (j.job_description || '').slice(0, 180),
    track,
  }));
}

async function searchSerpApi(
  query: string,
  track: string,
  limit: number,
  where: string | null,
): Promise<Listing[]> {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_jobs');
  url.searchParams.set('q', where ? `"${query}" ${where}` : `"${query}" remote`);
  url.searchParams.set('api_key', process.env.SERPAPI_KEY as string);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`SerpApi ${res.status}`);
  const data = await res.json();
  return (data.jobs_results || []).slice(0, limit).map((j: any, i: number): Listing => ({
    id: `sa-${i}`,
    co: j.company_name || 'Unknown',
    role: j.title || '',
    loc: j.location || DEFAULT_LOCATION,
    sal: j.detected_extensions?.salary || '',
    src: j.via ? j.via.replace(/^via\s+/i, '') : 'Google Jobs',
    url: j.share_link || j.related_links?.[0]?.link || '',
    posted: j.detected_extensions?.posted_at || '',
    snippet: (j.description || '').slice(0, 180),
    track,
  }));
}

/** Deterministic sample used when no provider is configured, so the tab is never empty. */
function sampleListings(track: string): Listing[] {
  const base: Omit<Listing, 'track'>[] = [
    { id: 's1', co: 'Compass Group', role: 'District Manager, Restaurant Group', loc: 'Raleigh, NC', sal: '$95K–$115K', src: 'Indeed (via API)', url: 'https://www.indeed.com/jobs?q=district+manager+restaurant&l=Raleigh%2C+NC', posted: '2026-07-08', snippet: 'Lead multi-unit F&B operations across the Triangle region…' },
    { id: 's2', co: 'Republic National Distributing', role: 'Key Account Manager, On-Premise', loc: 'Durham, NC', sal: '$80K–$100K', src: 'LinkedIn (via API)', url: 'https://www.linkedin.com/jobs/search/?keywords=key%20account%20manager%20spirits&location=Durham%2C%20NC', posted: '2026-07-09', snippet: 'Manage a portfolio of premium wine & spirits accounts…' },
    { id: 's3', co: 'Toast', role: 'Account Executive, Restaurant SaaS', loc: 'Remote', sal: '$90K–$130K', src: 'ZipRecruiter (via API)', url: 'https://www.ziprecruiter.com/jobs-search?search=restaurant+account+executive&location=Remote', posted: '2026-07-07', snippet: 'Sell restaurant management technology to independent operators…' },
    { id: 's4', co: 'Signature Aviation', role: 'General Manager, FBO Operations', loc: 'Morrisville, NC', sal: '$110K–$140K', src: 'JSfirm (via API)', url: 'https://www.jsfirm.com/', posted: '2026-07-06', snippet: 'Oversee fixed base operations at RDU including guest services…' },
  ];
  return base.map((b) => ({ ...b, track }));
}

async function runProvider(
  provider: Provider,
  query: string,
  track: string,
  limit: number,
  where: string | null,
): Promise<Listing[]> {
  switch (provider) {
    case 'adzuna':
      return searchAdzuna(query, track, limit, where);
    case 'jsearch':
      return searchJSearch(query, track, limit, where);
    case 'serpapi':
      return searchSerpApi(query, track, limit, where);
    default:
      return sampleListings(track);
  }
}

/** A single recommendation query. `where` undefined → default location; null → nationwide. */
export type RecQuery = { text: string; track: string; where?: string | null };

/**
 * Fetch recommendations for a set of (query, track) pairs, deduping across them.
 * Queries here are concise keyword strings (not raw boolean strings) suited to
 * aggregator APIs; toKeywords still guards against a stray boolean string.
 */
export async function fetchRecommendations(
  queries: RecQuery[],
  perQuery = 5,
): Promise<{ listings: Listing[]; provider: Provider; errors: string[] }> {
  const provider = activeProvider();
  const errors: string[] = [];
  const all: Listing[] = [];

  // Build one task per query, then run with limited concurrency: enough to stay
  // fast and under a serverless timeout, but few enough to avoid Adzuna's
  // rate limit (429) that firing them all at once triggers.
  const tasks = queries.map((q) => async () => {
    const kw = toKeywords(q.text);
    // undefined => default location; null => nationwide (remote tracks)
    const where = q.where === null ? null : q.where || DEFAULT_LOCATION;
    return runProvider(provider, kw, q.track, perQuery, where);
  });

  const settled = await runWithConcurrency(tasks, 3);
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      all.push(...r.value);
    } else {
      errors.push(`${queries[i].track}: ${r.reason?.message || 'query failed'}`);
    }
  });

  return { listings: dedupe(all), provider, errors };
}

/** Run async tasks with at most `limit` in flight at once; never rejects. */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const idx = next++;
      try {
        results[idx] = { status: 'fulfilled', value: await tasks[idx]() };
      } catch (reason) {
        results[idx] = { status: 'rejected', reason } as PromiseRejectedResult;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}
