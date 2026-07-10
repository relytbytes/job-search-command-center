export type Role = {
  id: string;
  co: string;
  role: string;
  src: string;
  loc: string;
  type: string;
  sal: string;
  track: string;
  status: string; // current pipeline stage (source of truth in Sheets)
  prio: string;
  contact: string;
  next: string;
  notes: string;
};

export type StatusMeta = { key: string; color: string; bg: string };

export type TermGroup = { title: string; items: string[] };

export type BoardGroup = {
  title: string;
  items: [board: string, url: string, bestFor: string, notes: string][];
};

/** A recommendation pulled from a job-search API. */
export type Listing = {
  id: string;
  co: string;
  role: string;
  loc: string;
  sal: string;
  src: string; // which board/provider surfaced it
  url: string;
  posted: string;
  snippet: string;
  track: string; // which of the user's tracks this query maps to
};

/** The order of Tracker columns in the Google Sheet. Keep in sync with seed-sheet.ts. */
export const SHEET_HEADERS = [
  'Company',
  'Role',
  'Source',
  'Location',
  'Work Type',
  'Salary',
  'Track',
  'Status',
  'Priority',
  'Contact',
  'Next Action',
  'Notes',
] as const;
