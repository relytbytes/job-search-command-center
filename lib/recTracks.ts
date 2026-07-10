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
export const REC_TRACKS: RecTrack[] = [
  {
    track: 'Beverage / Wine Director',
    phrases: ['beverage director', 'wine director', 'sommelier'],
  },
  {
    track: 'Wine & Spirits Sales / Distribution',
    phrases: ['wine sales', 'spirits sales', 'beverage sales manager'],
  },
  {
    track: 'Restaurant / F&B Management',
    phrases: ['food beverage director', 'restaurant general manager', 'restaurant manager'],
  },
  {
    track: 'Hospitality & B2B Sales / Accounts',
    phrases: ['key account manager', 'business development manager', 'territory sales manager'],
  },
  {
    track: 'Remote Hospitality Tech Sales',
    phrases: ['restaurant account executive', 'hospitality account executive', 'restaurant customer success'],
    where: null,
  },
  {
    track: 'Procurement / Purchasing / Inventory',
    phrases: ['procurement manager', 'purchasing manager', 'buyer'],
  },
  // Re-added at Tyler's request: he holds an Associate in Aviation Management and a
  // B.S. in Management Information Systems, and has multi-unit operations experience.
  {
    track: 'Operations & General Management',
    phrases: ['operations manager', 'general manager', 'operations director'],
  },
  {
    track: 'Aviation & Airport Operations',
    phrases: ['airport operations', 'aviation manager', 'station manager'],
  },
];

export const REC_TRACK_NAMES = REC_TRACKS.map((t) => t.track);
