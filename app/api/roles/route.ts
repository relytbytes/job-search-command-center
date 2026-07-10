import { NextRequest, NextResponse } from 'next/server';
import { readRoles, appendRole, sheetsConfigured } from '@/lib/sheets';
import type { Role } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { roles, source } = await readRoles();
    return NextResponse.json({ roles, source, writable: sheetsConfigured() });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to read roles' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!sheetsConfigured()) {
    return NextResponse.json(
      { error: 'Google Sheets is not configured; adding roles requires a connected sheet.' },
      { status: 501 },
    );
  }
  try {
    const body = (await req.json()) as Partial<Role>;
    if (!body.co || !body.role) {
      return NextResponse.json({ error: 'co and role are required' }, { status: 400 });
    }
    const created = await appendRole({
      co: body.co,
      role: body.role,
      src: body.src || '',
      loc: body.loc || '',
      type: body.type || '',
      sal: body.sal || '',
      track: body.track || '',
      status: body.status || 'Ready to Apply',
      prio: body.prio || '',
      contact: body.contact || '',
      next: body.next || '',
    });
    return NextResponse.json({ role: created });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to add role' }, { status: 500 });
  }
}
