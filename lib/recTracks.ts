/**
 * Recommendation tracks, tailored to Tyler Shelton's actual resume:
 * senior beverage leadership (Wine/Beverage Director), wine & spirits distribution
 * sales, restaurant/F&B management, B2B & hospitality-tech sales, and
 * procurement/inventory. Aviation is intentionally excluded — the resume shows an
 * associate degree but no aviation work history, so those postings aren't a fit.
 *
 * Each track lists exact job-title PHRASES. The search runs one exact-phrase query
 * per title (Adzuna `what_phrase`), which is precise — "beverage director" won't
 * match a Dollar General store manager or a nurse the way loose keyword-OR did.
 * `where: null` = nationwide (for inherently-remote lanes).
 */
export type RecTrack = { track: string; phrases: string[]; where?: string | null };

// Title-only search ANDs every word and matches the job TITLE, so phrases must be
// words that appear in real titles (no stopwords like "and") and be specific
// enough to the lane's industry — generic titles like "market development manager"
// pull cross-industry noise, so they're avoided here.
// Two exact-title phrases per lane (fewer, higher-signal queries → less noise and
// fewer rate-limit failures). "general manager" is deliberately omitted — it is the
// biggest fast-food/QSR magnet; the exclude list in jobapi.ts filters the rest.
export const REC_TRACKS: RecTrack[] = [
  {
    track: 'Beverage / Wine Director',
    phrases: ['beverage director', 'wine director'],
  },
  {
    track: 'Wine & Spirits Sales / Distribution',
    phrases: ['wine sales', 'spirits sales'],
  },
  {
    track: 'Restaurant / F&B Management',
    phrases: ['food beverage director', 'restaurant general manager'],
  },
  {
    track: 'Hospitality & B2B Sales / Accounts',
    phrases: ['key account manager', 'business development manager'],
  },
  {
    track: 'Remote Hospitality Tech Sales',
    phrases: ['restaurant account executive', 'hospitality account executive'],
    where: null,
  },
  {
    track: 'Procurement / Purchasing / Inventory',
    phrases: ['procurement manager', 'purchasing manager'],
  },
  // Operations / management — corporate ops titles (not "general manager", which
  // pulls QSR). Tyler has multi-unit ops experience + a B.S. in MIS.
  {
    track: 'Operations & General Management',
    phrases: ['operations manager', 'operations director'],
  },
  // Aviation — run NATIONWIDE (where: null): there are almost no aviation-management
  // titles within 30mi of Raleigh, so a local search returns nothing. A stretch lane
  // (Associate in Aviation Management, no aviation work history); may mean relocation.
  {
    track: 'Aviation & Airport Operations',
    phrases: ['airport operations', 'aviation manager'],
    where: null,
  },
];

export const REC_TRACK_NAMES = REC_TRACKS.map((t) => t.track);
