import { NextRequest, NextResponse } from 'next/server';
import { createDoc, docsConfigured } from '@/lib/gdocs';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  if (!docsConfigured()) {
    return NextResponse.json(
      { error: 'Google Docs export needs the Google service account (same one as Sheets).' },
      { status: 501 },
    );
  }
  try {
    const { title, text } = (await req.json()) as { title?: string; text?: string };
    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }
    const url = await createDoc(title || 'Job Search Document', text);
    return NextResponse.json({ url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create Google Doc' }, { status: 500 });
  }
}
