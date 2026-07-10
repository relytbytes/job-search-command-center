import { google, sheets_v4 } from 'googleapis';
import type { Role } from './types';
import { SHEET_HEADERS } from './types';
import { seedRoles, roleToRow, rowToRole } from './seed';

const TAB = process.env.SHEET_TAB || 'Tracker';

/**
 * Returns true when Google Sheets credentials are configured.
 * When false, the app falls back to the bundled seed data so it runs out of the box.
 */
export function sheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY,
  );
}

let _client: sheets_v4.Sheets | null = null;

function getClient(): sheets_v4.Sheets {
  if (_client) return _client;
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // Support both raw and \n-escaped private keys (env files often escape newlines).
    key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  _client = google.sheets({ version: 'v4', auth });
  return _client;
}

const sheetId = () => process.env.GOOGLE_SHEET_ID as string;

/** Data rows only (excludes the header row). Range like Tracker!A2:L. */
const dataRange = () => `${TAB}!A2:L`;

/** Column index within a row for each editable Role field (SHEET_HEADERS order). */
const FIELD_COL: Record<string, number> = {
  co: 0,
  role: 1,
  src: 2,
  loc: 3,
  type: 4,
  sal: 5,
  track: 6,
  status: 7,
  prio: 8,
  contact: 9,
  next: 10,
  notes: 11,
};

/**
 * Read all roles. Falls back to seed data when Sheets is not configured.
 * The `source` flag lets the API tell the UI whether it's live.
 */
export async function readRoles(): Promise<{ roles: Role[]; source: 'sheets' | 'seed' }> {
  if (!sheetsConfigured()) {
    return { roles: seedRoles(), source: 'seed' };
  }
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: dataRange(),
  });
  const rows = res.data.values || [];
  const roles = rows
    .map((row, i) => rowToRole(row as string[], i))
    .filter((r) => r.co.trim() !== ''); // ignore blank trailing rows
  return { roles, source: 'sheets' };
}

/** Row number in the sheet for role id "rN" (N is 0-based data index; header is row 1). */
function sheetRowForId(id: string): number | null {
  const m = /^r(\d+)$/.exec(id);
  if (!m) return null;
  return Number(m[1]) + 2;
}

/**
 * Update a single role's status (and optionally other editable fields) in the sheet.
 * Throws if Sheets is not configured — callers should guard with sheetsConfigured().
 */
/** Fields the drawer editor / drag-and-drop may write back to the sheet. */
export type RolePatch = Partial<
  Pick<Role, 'co' | 'role' | 'track' | 'loc' | 'sal' | 'status' | 'prio' | 'contact' | 'next' | 'notes'>
>;

export async function updateRole(id: string, patch: RolePatch): Promise<void> {
  const rowNum = sheetRowForId(id);
  if (rowNum == null) throw new Error(`Invalid role id: ${id}`);
  const sheets = getClient();

  // Read the current row, apply the patch, write it back — keeps other columns intact.
  const cur = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: `${TAB}!A${rowNum}:L${rowNum}`,
  });
  const row = (cur.data.values?.[0] as string[]) || new Array(SHEET_HEADERS.length).fill('');
  while (row.length < SHEET_HEADERS.length) row.push('');

  (Object.keys(patch) as (keyof RolePatch)[]).forEach((k) => {
    const col = FIELD_COL[k];
    if (col != null && patch[k] != null) row[col] = patch[k] as string;
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId(),
    range: `${TAB}!A${rowNum}:L${rowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });
}

/** Delete a role's row from the tracker tab. */
export async function deleteRole(id: string): Promise<void> {
  const rowNum = sheetRowForId(id);
  if (rowNum == null) throw new Error(`Invalid role id: ${id}`);
  const sheets = getClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId() });
  const sh = (meta.data.sheets || []).find((s) => s.properties?.title === TAB);
  const gid = sh?.properties?.sheetId;
  if (gid == null) throw new Error(`Tab not found: ${TAB}`);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId(),
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId: gid, dimension: 'ROWS', startIndex: rowNum - 1, endIndex: rowNum },
          },
        },
      ],
    },
  });
}

/** Append a new role to the tracker. Returns the created role with its assigned id. */
export async function appendRole(role: Omit<Role, 'id'>): Promise<Role> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId(),
    range: dataRange(),
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [roleToRow({ ...role, id: 'tmp' } as Role)] },
  });
  // updatedRange looks like "Tracker!A57:K57" — recover the row number for the id.
  const updated = res.data.updates?.updatedRange || '';
  const m = /![A-Z]+(\d+):/.exec(updated);
  const rowNum = m ? Number(m[1]) : NaN;
  const id = Number.isFinite(rowNum) ? 'r' + (rowNum - 2) : 'r' + Date.now();
  return { ...role, id };
}
