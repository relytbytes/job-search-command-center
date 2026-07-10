/**
 * Populate a Google Sheet with the tracker data, boolean search terms, and job boards.
 * Run once to migrate your spreadsheet into the app's backing store:
 *
 *   npm run seed-sheet
 *
 * Requires GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY in .env.local
 * and the service account must have Editor access to the sheet.
 */
import { google } from 'googleapis';
import { config } from 'dotenv';
import { seedRoles, roleToRow, TERM_GROUPS, BOARD_GROUPS } from '../lib/seed';
import { SHEET_HEADERS } from '../lib/types';

config({ path: '.env.local' });
config();

async function main() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Missing GOOGLE_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY');
  }

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const tab = process.env.SHEET_TAB || 'Tracker';

  // Ensure the required tabs exist.
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set((meta.data.sheets || []).map((s) => s.properties?.title));
  const wanted = [tab, 'Boolean Search Terms', 'Job Boards'];
  const toAdd = wanted.filter((t) => !existing.has(t));
  if (toAdd.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: toAdd.map((title) => ({ addSheet: { properties: { title } } })) },
    });
    console.log('Created tabs:', toAdd.join(', '));
  }

  // Tracker tab: header + roles.
  const roleRows = seedRoles().map(roleToRow);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [SHEET_HEADERS as unknown as string[], ...roleRows] },
  });
  console.log(`Wrote ${roleRows.length} roles to "${tab}".`);

  // Boolean Search Terms tab.
  const termRows: string[][] = [['Group', 'Search String']];
  TERM_GROUPS.forEach((g) => g.items.forEach((it) => termRows.push([g.title, it])));
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Boolean Search Terms!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: termRows },
  });
  console.log(`Wrote ${termRows.length - 1} search strings.`);

  // Job Boards tab.
  const boardRows: string[][] = [['Group', 'Board', 'URL', 'Best For', 'Notes']];
  BOARD_GROUPS.forEach((g) =>
    g.items.forEach((b) => boardRows.push([g.title, b[0], b[1], b[2], b[3]])),
  );
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Job Boards!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: boardRows },
  });
  console.log(`Wrote ${boardRows.length - 1} job boards.`);

  console.log('\nDone. Your sheet is now the live backing store for the app.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
