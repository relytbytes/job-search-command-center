import { NextRequest, NextResponse } from 'next/server';
import { generate, generatorConfigured, type GenKind } from '@/lib/generate';
import type { Role } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // cover-letter generation can take a while

export async function POST(req: NextRequest) {
  if (!generatorConfigured()) {
    return NextResponse.json(
      { error: 'The writing assistant is not configured. Set ANTHROPIC_API_KEY to enable it.' },
      { status: 501 },
    );
  }
  try {
    const body = (await req.json()) as { kind?: GenKind; role?: Partial<Role>; extra?: string };
    const kind = body.kind === 'followup' ? 'followup' : 'cover';
    const role = body.role;
    if (!role?.co || !role?.role) {
      return NextResponse.json({ error: 'role.co and role.role are required' }, { status: 400 });
    }
    const text = await generate(kind, role as Role, body.extra);
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Generation failed' }, { status: 500 });
  }
}
