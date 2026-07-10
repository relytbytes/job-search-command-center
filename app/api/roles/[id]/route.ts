import { NextRequest, NextResponse } from 'next/server';
import { updateRole, deleteRole, sheetsConfigured, type RolePatch } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!sheetsConfigured()) {
    // In seed mode there is no backing store; the client persists to localStorage instead.
    return NextResponse.json({ ok: false, persisted: false, reason: 'seed-mode' }, { status: 200 });
  }
  try {
    const patch = (await req.json()) as RolePatch;
    await updateRole(params.id, patch);
    return NextResponse.json({ ok: true, persisted: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update role' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!sheetsConfigured()) {
    return NextResponse.json({ ok: false, persisted: false, reason: 'seed-mode' }, { status: 200 });
  }
  try {
    await deleteRole(params.id);
    return NextResponse.json({ ok: true, persisted: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete role' }, { status: 500 });
  }
}
