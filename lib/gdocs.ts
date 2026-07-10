import { google } from 'googleapis';

/**
 * Appends generated text (interview prep, cover letters, follow-ups) to ONE
 * Google Doc that you own and share with the service account.
 *
 * Why append to a shared doc instead of creating a new one per save: a service
 * account has no Drive storage of its own and cannot create/own files. But it
 * CAN edit a doc you own and share with it (Editor) — exactly like the Sheet.
 *
 * Setup: create a Google Doc, share it with GOOGLE_SERVICE_ACCOUNT_EMAIL as
 * Editor, and put its ID (from the URL) in GOOGLE_DOC_ID. Requires the Google
 * Docs API enabled in the same project.
 */

export function docsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_DOC_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY,
  );
}

function authClient() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/documents'],
  });
}

function buildRequests(insertAt: number, heading: string, body: string) {
  const block = `\n\n${heading}\n${body}\n`;
  const requests: any[] = [{ insertText: { location: { index: insertAt }, text: block } }];

  // Bold + slightly enlarge the entry heading (it sits after the two newlines).
  const hStart = insertAt + 2;
  requests.push({
    updateTextStyle: {
      range: { startIndex: hStart, endIndex: hStart + heading.length },
      textStyle: { bold: true, fontSize: { magnitude: 13, unit: 'PT' } },
      fields: 'bold,fontSize',
    },
  });

  // Bold ALL-CAPS section headers inside the body (SNAPSHOT, LIKELY QUESTIONS, …).
  let offset = 2 + heading.length + 1; // start of body within block
  for (const line of body.split('\n')) {
    const dash = line.indexOf('—');
    const head = (dash >= 0 ? line.slice(0, dash) : line).trim();
    const isHeader = head.length >= 3 && head === head.toUpperCase() && /[A-Z]/.test(head);
    if (isHeader) {
      const s = insertAt + offset + line.indexOf(head);
      requests.push({
        updateTextStyle: {
          range: { startIndex: s, endIndex: s + head.length },
          textStyle: { bold: true },
          fields: 'bold',
        },
      });
    }
    offset += line.length + 1;
  }
  return requests;
}

/** Append a titled section to the shared doc; returns the doc URL. */
export async function appendToDoc(title: string, body: string): Promise<string> {
  const documentId = process.env.GOOGLE_DOC_ID as string;
  const docs = google.docs({ version: 'v1', auth: authClient() });

  const doc = await docs.documents.get({ documentId });
  const content = doc.data.body?.content || [];
  let endIndex = 1;
  for (const el of content) if (typeof el.endIndex === 'number') endIndex = el.endIndex;
  const insertAt = Math.max(1, endIndex - 1); // before the doc's trailing newline

  const date = new Date().toISOString().slice(0, 10);
  const heading = `${title} · ${date}`;

  await docs.documents.batchUpdate({
    documentId,
    requestBody: { requests: buildRequests(insertAt, heading, body) },
  });

  return `https://docs.google.com/document/d/${documentId}/edit`;
}
