import { NextRequest, NextResponse } from 'next/server';
import { appendToDoc, docsConfigured } from '@/lib/gdocs';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  if (!docsConfigured()) {
    return NextResponse.json(
      {
        error:
          'Google Docs export is not set up. Create a Google Doc, share it with the service account, and set GOOGLE_DOC_ID.',
      },
      { status: 501 },
    );
  }
  try {
    const { title, text } = (await req.json()) as { title?: string; text?: string };
    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }
    const url = await appendToDoc(title || 'Job Search Document', text);
    return NextResponse.json({ url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create Google Doc' }, { status: 500 });
  }
}
