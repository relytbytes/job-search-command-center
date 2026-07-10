import { google } from 'googleapis';

/**
 * Creates a Google Doc from generated text (interview prep, cover letters, …)
 * using the same service account as the Sheets sync. Native Google Docs don't
 * count against storage quota, so the service account can create them freely;
 * the doc is then shared so it shows up for you.
 *
 * Requires the **Google Docs API** and **Google Drive API** to be enabled in the
 * same Google Cloud project as the Sheets integration.
 */

export function docsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}

function authClient() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });
}

/** Build batch requests: insert the body, then bold ALL-CAPS section headers. */
function buildRequests(body: string) {
  const requests: any[] = [{ insertText: { location: { index: 1 }, text: body } }];
  let offset = 0;
  for (const line of body.split('\n')) {
    const dash = line.indexOf('—');
    const head = (dash >= 0 ? line.slice(0, dash) : line).trim();
    const isHeader = head.length >= 3 && head === head.toUpperCase() && /[A-Z]/.test(head);
    if (isHeader) {
      const start = offset + line.indexOf(head);
      const end = start + head.length;
      requests.push({
        updateTextStyle: {
          range: { startIndex: 1 + start, endIndex: 1 + end },
          textStyle: { bold: true },
          fields: 'bold',
        },
      });
    }
    offset += line.length + 1; // + newline
  }
  return requests;
}

export async function createDoc(title: string, body: string): Promise<string> {
  const auth = authClient();
  const docs = google.docs({ version: 'v1', auth });
  const drive = google.drive({ version: 'v3', auth });

  const created = await docs.documents.create({ requestBody: { title } });
  const id = created.data.documentId as string;

  await docs.documents.batchUpdate({ documentId: id, requestBody: { requests: buildRequests(body) } });

  // Share so the user can open it. If GOOGLE_DOC_SHARE_EMAIL is set, share
  // directly with that account (lands in "Shared with me"); otherwise fall back
  // to a link-shareable doc so the returned URL always opens.
  const email = process.env.GOOGLE_DOC_SHARE_EMAIL;
  if (email) {
    await drive.permissions.create({
      fileId: id,
      sendNotificationEmail: false,
      requestBody: { type: 'user', role: 'writer', emailAddress: email },
    });
  } else {
    await drive.permissions.create({
      fileId: id,
      requestBody: { type: 'anyone', role: 'writer' },
    });
  }

  return `https://docs.google.com/document/d/${id}/edit`;
}
