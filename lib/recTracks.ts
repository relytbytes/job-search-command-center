/**
 * Recommendation tracks, tailored to Tyler Shelton's actual resume:
 * senior beverage leadership (Wine/Beverage Director), wine & spirits distribution
 * sales, restaurant/F&B management, B2B & hospitality-tech sales, and
 * procurement/inventory. Aviation is intentionally excluded — the resume shows an
 * associate degree but no aviation work history, so those postings aren't a fit.
 *
 * Each `text` is a concise keyword set fed to the aggregator's ANY-match mode and
 * relevance-ranked. `where: null` = nationwide (for inherently-remote lanes).
 * These track names are the grouping shown in the Recommended tab.
 */
export type RecTrack = { track: string; text: string; where?: string | null };

export const REC_TRACKS: RecTrack[] = [
  {
    track: 'Beverage / Wine Director',
    text: 'beverage director wine director sommelier beverage manager',
  },
  {
    track: 'Wine & Spirits Sales / Distribution',
    text: 'wine spirits sales representative distributor key account market development manager',
  },
  {
    track: 'Restaurant / F&B Management',
    text: 'general manager assistant general manager restaurant food beverage director hospitality',
  },
  {
    track: 'Hospitality & B2B Sales / Accounts',
    text: 'account executive account manager business development territory sales',
  },
  {
    track: 'Remote Hospitality Tech Sales',
    text: 'restaurant hospitality account executive customer success software',
    where: null,
  },
  {
    track: 'Procurement / Purchasing / Inventory',
    text: 'buyer purchasing procurement inventory forecasting supply',
  },
];

export const REC_TRACK_NAMES = REC_TRACKS.map((t) => t.track);
