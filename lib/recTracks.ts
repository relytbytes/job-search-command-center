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

export const REC_TRACKS: RecTrack[] = [
  {
    track: 'Beverage / Wine Director',
    phrases: ['beverage director', 'wine director', 'sommelier'],
  },
  {
    track: 'Wine & Spirits Sales / Distribution',
    phrases: ['wine sales representative', 'spirits sales', 'beverage account manager', 'market development manager'],
  },
  {
    track: 'Restaurant / F&B Management',
    phrases: ['food and beverage director', 'restaurant general manager', 'restaurant manager'],
  },
  {
    track: 'Hospitality & B2B Sales / Accounts',
    phrases: ['key account manager', 'business development manager', 'sales account executive'],
  },
  {
    track: 'Remote Hospitality Tech Sales',
    phrases: ['restaurant account executive', 'hospitality account executive', 'customer success manager'],
    where: null,
  },
  {
    track: 'Procurement / Purchasing / Inventory',
    phrases: ['procurement manager', 'purchasing manager', 'inventory manager', 'buyer'],
  },
];

export const REC_TRACK_NAMES = REC_TRACKS.map((t) => t.track);
