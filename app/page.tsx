'use client';

import { useEffect, useMemo, useRef, useState, CSSProperties } from 'react';
import type { Role, Listing } from '@/lib/types';
import {
  STATUS_META,
  statusMeta,
  PRIO_META,
  TERM_GROUPS,
  BOARD_GROUPS,
} from '@/lib/seed';
import { REC_TRACK_NAMES } from '@/lib/recTracks';

const LS_KEY = 'tsl-tracker-v1';

type Tab = 'pipeline' | 'recommended' | 'terms' | 'boards';
type View = 'board' | 'table';

const FOCUS_QUEUE = [
  { co: 'Affinity Group', action: 'Prepare for phone screen' },
  { co: 'Swissport — Procurement', action: 'Watch for response' },
  { co: "The Chefs' Warehouse", action: 'Watch for response' },
  { co: 'FreshPoint — Buyer', action: 'Watch for response' },
];

// ---- style helpers (ported verbatim from the prototype) ----
const mono = "'IBM Plex Mono', monospace";
const grotesk = "'Space Grotesk', sans-serif";
const sans = "'IBM Plex Sans', sans-serif";

function tabStyle(active: boolean): CSSProperties {
  return {
    fontFamily: sans,
    fontSize: 14,
    fontWeight: 600,
    padding: '10px 16px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    borderBottom: '2.5px solid ' + (active ? 'var(--accent)' : 'transparent'),
    color: active ? '#211f1b' : '#8a857b',
    marginBottom: -1,
  };
}
function segStyle(active: boolean): CSSProperties {
  return {
    fontFamily: sans,
    fontSize: 13,
    fontWeight: 600,
    padding: '6px 16px',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    background: active ? '#fffdf9' : 'transparent',
    color: active ? '#211f1b' : '#7a756b',
    boxShadow: active ? '0 1px 2px rgba(60,50,30,0.08)' : 'none',
  };
}
function chipStyle(active: boolean): CSSProperties {
  return {
    fontFamily: sans,
    fontSize: 12.5,
    fontWeight: 500,
    padding: '6px 12px',
    borderRadius: 20,
    cursor: 'pointer',
    border: '1px solid ' + (active ? 'var(--accent)' : '#ddd6c9'),
    background: active ? 'var(--accent)' : '#fffdf9',
    color: active ? '#fff' : '#55504a',
  };
}
const labelMono: CSSProperties = {
  fontFamily: mono,
  fontSize: 10,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#a39d90',
};

export default function Page() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [source, setSource] = useState<'sheets' | 'seed'>('seed');
  const [writable, setWritable] = useState(false);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<Tab>('pipeline');
  const [view, setView] = useState<View>('board');
  const [query, setQuery] = useState('');
  const [track, setTrack] = useState('All');
  const [prio, setPrio] = useState('All');
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragId = useRef<string | null>(null);

  // ---- load roles ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/roles');
        const data = await res.json();
        if (cancelled) return;
        let loaded: Role[] = data.roles || [];
        // In seed mode there is no server store; replay local status overrides.
        if (data.source === 'seed') {
          try {
            const raw = localStorage.getItem(LS_KEY);
            if (raw) {
              const ov = JSON.parse(raw) as Record<string, string>;
              loaded = loaded.map((r) => (ov[r.id] ? { ...r, status: ov[r.id] } : r));
            }
          } catch {}
        }
        setRoles(loaded);
        setSource(data.source);
        setWritable(!!data.writable);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function persistStatus(id: string, status: string) {
    // optimistic update
    setRoles((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    if (writable) {
      fetch(`/api/roles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).catch(() => {});
    } else {
      try {
        const raw = localStorage.getItem(LS_KEY);
        const ov = raw ? JSON.parse(raw) : {};
        ov[id] = status;
        localStorage.setItem(LS_KEY, JSON.stringify(ov));
      } catch {}
    }
  }

  // ---- derived data ----
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roles.filter((r) => {
      if (track !== 'All') {
        const t = r.track || 'Unassigned';
        if (t !== track) return false;
      }
      if (prio !== 'All' && r.prio !== prio) return false;
      if (q) {
        const hay = (r.co + ' ' + r.role + ' ' + r.loc + ' ' + r.track).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [roles, query, track, prio]);

  const countBy = (k: string) => roles.filter((r) => r.status === k).length;
  const activeCount =
    countBy('Ready to Apply') +
    countBy('In Progress') +
    countBy('Applied') +
    countBy('Phone Screen') +
    countBy('Interviewing') +
    countBy('Offer');
  const responses = countBy('Phone Screen') + countBy('Interviewing') + countBy('Offer');
  const stats = [
    { label: 'Total Roles', value: roles.length, color: '#211f1b' },
    { label: 'Active', value: activeCount, color: '#2f6bb0' },
    { label: 'Applied', value: countBy('Applied'), color: '#2f6bb0' },
    { label: 'In Conversation', value: responses, color: '#1f8a6d' },
    { label: 'Closed Out', value: countBy('Rejected') + countBy('Skip'), color: '#a8443a' },
  ];

  const trackChips = useMemo(() => {
    const set: string[] = [];
    roles.forEach((r) => {
      const t = r.track || 'Unassigned';
      if (!set.includes(t)) set.push(t);
    });
    set.sort();
    return [{ key: 'All', label: 'All Tracks' }].concat(set.map((t) => ({ key: t, label: t })));
  }, [roles]);
  const prioOptions = ['All', 'Very High', 'High', 'Medium', 'Low'];

  const columns = useMemo(() => {
    let keys = STATUS_META.map((m) => m.key);
    return keys.map((k) => {
      const m = statusMeta(k);
      const cards = filtered.filter((r) => r.status === k);
      return { key: k, label: k, color: m.color, count: cards.length, cards };
    });
  }, [filtered]);

  const tableRows = useMemo(
    () => filtered.slice().sort((a, b) => a.co.localeCompare(b.co)),
    [filtered],
  );

  const selRole = selected ? roles.find((r) => r.id === selected) : null;

  function doCopy(id: string, text: string) {
    try {
      navigator.clipboard.writeText(text);
    } catch {}
    setCopied(id);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), 1400);
  }

  return (
    <div
      data-tracker="1"
      style={{
        minHeight: '100vh',
        fontFamily: sans,
        color: '#211f1b',
        background: '#efeae1',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* HEADER */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'rgba(239,234,225,0.92)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid #ddd6c9',
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: '0 auto',
            padding: '18px 28px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: mono,
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--accent)',
                  fontWeight: 600,
                }}
              >
                Job Search · Command Center
              </div>
              <h1
                style={{
                  fontFamily: grotesk,
                  fontWeight: 600,
                  fontSize: 30,
                  margin: '4px 0 0',
                  letterSpacing: '-0.01em',
                }}
              >
                Tyler Shelton
              </h1>
            </div>
            <div
              style={{
                fontSize: 13,
                color: '#6f6a60',
                maxWidth: 340,
                textAlign: 'right',
                lineHeight: 1.5,
              }}
            >
              {roles.length} roles tracked ·{' '}
              {source === 'sheets' ? 'synced live with Google Sheets' : 'demo data (connect a sheet to go live)'}.
            </div>
          </div>
          <nav style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setTab('pipeline')} style={tabStyle(tab === 'pipeline')}>
              Pipeline
            </button>
            <button onClick={() => setTab('recommended')} style={tabStyle(tab === 'recommended')}>
              Recommended
            </button>
            <button onClick={() => setTab('terms')} style={tabStyle(tab === 'terms')}>
              Search Strings
            </button>
            <button onClick={() => setTab('boards')} style={tabStyle(tab === 'boards')}>
              Job Boards
            </button>
          </nav>
        </div>
      </header>

      <main style={{ flex: 1, width: '100%' }}>
        {/* PIPELINE */}
        {tab === 'pipeline' && (
          <div style={{ maxWidth: 1320, margin: '0 auto', padding: '22px 28px 60px' }}>
            {/* stats */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12,
                marginBottom: 20,
              }}
            >
              {stats.map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: '#fffdf9',
                    border: '1px solid #e4ded1',
                    borderRadius: 12,
                    padding: '14px 16px',
                  }}
                >
                  <div
                    style={{
                      fontFamily: grotesk,
                      fontSize: 30,
                      fontWeight: 600,
                      lineHeight: 1,
                      color: s.color,
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    style={{
                      fontFamily: mono,
                      fontSize: 10.5,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: '#8a857b',
                      marginTop: 8,
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* focus queue */}
            <div
              style={{
                background: '#211f1b',
                color: '#f4efe6',
                borderRadius: 14,
                padding: '16px 20px',
                marginBottom: 22,
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  fontFamily: mono,
                  fontSize: 10.5,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: '#d99a7f',
                  fontWeight: 600,
                }}
              >
                Focus Queue
              </div>
              <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', flex: 1 }}>
                {FOCUS_QUEUE.map((q) => (
                  <div key={q.co} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{q.co}</span>
                    <span style={{ fontSize: 12, color: '#b8b1a4' }}>{q.action}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* search + view toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 18,
              }}
            >
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search company, role, location…"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #ddd6c9',
                    borderRadius: 10,
                    background: '#fffdf9',
                    fontFamily: sans,
                    fontSize: 14,
                    color: '#211f1b',
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', background: '#e6e0d4', borderRadius: 10, padding: 3 }}>
                <button onClick={() => setView('board')} style={segStyle(view === 'board')}>
                  Board
                </button>
                <button onClick={() => setView('table')} style={segStyle(view === 'table')}>
                  Table
                </button>
              </div>
            </div>

            {/* track chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {trackChips.map((c) => (
                <button key={c.key} onClick={() => setTrack(c.key)} style={chipStyle(track === c.key)}>
                  {c.label}
                </button>
              ))}
            </div>
            {/* priority chips */}
            <div
              style={{
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
                marginBottom: 22,
                alignItems: 'center',
              }}
            >
              <span style={{ ...labelMono, marginRight: 4 }}>Priority</span>
              {prioOptions.map((p) => (
                <button key={p} onClick={() => setPrio(p)} style={chipStyle(prio === p)}>
                  {p}
                </button>
              ))}
            </div>

            {/* BOARD */}
            {view === 'board' && (
              <div
                style={{
                  display: 'flex',
                  gap: 14,
                  overflowX: 'auto',
                  paddingBottom: 16,
                  alignItems: 'flex-start',
                }}
              >
                {columns.map((col) => (
                  <div
                    key={col.key}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragId.current) persistStatus(dragId.current, col.key);
                      dragId.current = null;
                    }}
                    style={{
                      flex: '0 0 272px',
                      width: 272,
                      background: '#e8e2d6',
                      borderRadius: 14,
                      padding: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      minHeight: 120,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 6px 2px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{ width: 9, height: 9, borderRadius: 3, background: col.color }}
                        />
                        <span style={{ fontFamily: grotesk, fontWeight: 600, fontSize: 13.5 }}>
                          {col.label}
                        </span>
                      </div>
                      <span style={{ fontFamily: mono, fontSize: 12, color: '#8a857b' }}>
                        {col.count}
                      </span>
                    </div>
                    {col.cards.map((card) => (
                      <div
                        key={card.id}
                        draggable
                        onDragStart={(e) => {
                          dragId.current = card.id;
                          e.dataTransfer.effectAllowed = 'move';
                          (e.currentTarget as HTMLDivElement).style.opacity = '0.4';
                        }}
                        onDragEnd={(e) => {
                          (e.currentTarget as HTMLDivElement).style.opacity = '1';
                        }}
                        onClick={() => setSelected(card.id)}
                        style={{
                          background: '#fffdf9',
                          border: '1px solid #e4ded1',
                          borderLeft: '3px solid ' + (PRIO_META[card.prio] || PRIO_META['']),
                          borderRadius: 10,
                          padding: '11px 12px',
                          cursor: 'grab',
                          boxShadow: '0 1px 2px rgba(60,50,30,0.04)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 6,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: grotesk,
                              fontWeight: 600,
                              fontSize: 14,
                              lineHeight: 1.25,
                            }}
                          >
                            {card.co}
                          </span>
                        </div>
                        <div
                          style={{ fontSize: 12.5, color: '#55504a', marginTop: 3, lineHeight: 1.35 }}
                        >
                          {card.role}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            gap: 5,
                            flexWrap: 'wrap',
                            marginTop: 9,
                            alignItems: 'center',
                          }}
                        >
                          {card.track && (
                            <span
                              style={{
                                fontFamily: mono,
                                fontSize: 9.5,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                color: 'var(--accent)',
                                background: '#f7ede6',
                                padding: '2px 6px',
                                borderRadius: 5,
                              }}
                            >
                              {card.track}
                            </span>
                          )}
                          {card.sal && (
                            <span style={{ fontFamily: mono, fontSize: 10, color: '#6f6a60' }}>
                              {card.sal}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#a39d90', marginTop: 7 }}>{card.loc}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* TABLE */}
            {view === 'table' && (
              <div
                style={{
                  background: '#fffdf9',
                  border: '1px solid #e4ded1',
                  borderRadius: 14,
                  overflow: 'hidden',
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 13,
                      minWidth: 820,
                    }}
                  >
                    <thead>
                      <tr style={{ background: '#f0eadd', textAlign: 'left' }}>
                        {['Company', 'Role', 'Track', 'Status', 'Priority', 'Location', 'Salary'].map(
                          (h) => (
                            <th
                              key={h}
                              style={{
                                padding: '11px 14px',
                                fontFamily: mono,
                                fontSize: 10,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                color: '#8a857b',
                                fontWeight: 600,
                              }}
                            >
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((r) => {
                        const m = statusMeta(r.status);
                        return (
                          <tr
                            key={r.id}
                            onClick={() => setSelected(r.id)}
                            style={{ borderTop: '1px solid #efe9dc', cursor: 'pointer' }}
                          >
                            <td
                              style={{ padding: '11px 14px', fontWeight: 600, fontFamily: grotesk }}
                            >
                              {r.co}
                            </td>
                            <td style={{ padding: '11px 14px', color: '#55504a' }}>{r.role}</td>
                            <td style={{ padding: '11px 14px', color: '#6f6a60', fontSize: 12 }}>
                              {r.track || 'Unassigned'}
                            </td>
                            <td style={{ padding: '11px 14px' }}>
                              <span
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  padding: '3px 9px',
                                  borderRadius: 20,
                                  color: m.color,
                                  background: m.bg,
                                }}
                              >
                                {r.status}
                              </span>
                            </td>
                            <td style={{ padding: '11px 14px' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  fontSize: 12.5,
                                  color: '#55504a',
                                }}
                              >
                                <span
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: PRIO_META[r.prio] || PRIO_META[''],
                                  }}
                                />
                                {r.prio || '—'}
                              </span>
                            </td>
                            <td style={{ padding: '11px 14px', color: '#6f6a60', fontSize: 12 }}>
                              {r.loc}
                            </td>
                            <td
                              style={{
                                padding: '11px 14px',
                                color: '#6f6a60',
                                fontFamily: mono,
                                fontSize: 11,
                              }}
                            >
                              {r.sal || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RECOMMENDED */}
        {tab === 'recommended' && (
          <RecommendedTab
            existing={roles}
            writable={writable}
            onAdded={(role) => setRoles((rs) => [...rs, role])}
          />
        )}

        {/* SEARCH STRINGS */}
        {tab === 'terms' && (
          <div style={{ maxWidth: 960, margin: '0 auto', padding: '26px 28px 60px' }}>
            <p style={{ fontSize: 14, color: '#6f6a60', margin: '0 0 24px', lineHeight: 1.55 }}>
              Paste directly into LinkedIn or Indeed keyword search — or into Google as{' '}
              <span
                style={{
                  fontFamily: mono,
                  fontSize: 12.5,
                  background: '#e6e0d4',
                  padding: '2px 6px',
                  borderRadius: 5,
                }}
              >
                site:linkedin.com/jobs [string]
              </span>
            </p>
            {TERM_GROUPS.map((g, gi) => (
              <div key={g.title} style={{ marginBottom: 30 }}>
                <h3
                  style={{
                    fontFamily: grotesk,
                    fontSize: 16,
                    fontWeight: 600,
                    margin: '0 0 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span
                    style={{ width: 6, height: 18, borderRadius: 3, background: 'var(--accent)' }}
                  />
                  {g.title}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {g.items.map((text, ii) => {
                    const id = 'g' + gi + 'i' + ii;
                    const isCopied = copied === id;
                    return (
                      <div
                        key={id}
                        style={{
                          background: '#fffdf9',
                          border: '1px solid #e4ded1',
                          borderRadius: 10,
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                        }}
                      >
                        <code
                          style={{
                            flex: 1,
                            fontFamily: mono,
                            fontSize: 12.5,
                            lineHeight: 1.55,
                            color: '#33302b',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {text}
                        </code>
                        <button
                          onClick={() => doCopy(id, text)}
                          style={{
                            flexShrink: 0,
                            fontFamily: sans,
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: '1px solid ' + (isCopied ? '#1f8a6d' : '#ddd6c9'),
                            background: isCopied ? '#e1f2ec' : '#f2ede3',
                            color: isCopied ? '#1f8a6d' : '#55504a',
                            cursor: 'pointer',
                          }}
                        >
                          {isCopied ? 'Copied ✓' : 'Copy'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* JOB BOARDS */}
        {tab === 'boards' && (
          <div style={{ maxWidth: 1080, margin: '0 auto', padding: '26px 28px 60px' }}>
            <p style={{ fontSize: 14, color: '#6f6a60', margin: '0 0 24px', lineHeight: 1.55 }}>
              Boards beyond Indeed / LinkedIn / ZipRecruiter, grouped by lane. Verify postings before
              relying on them.
            </p>
            {BOARD_GROUPS.map((g) => (
              <div key={g.title} style={{ marginBottom: 30 }}>
                <h3
                  style={{
                    fontFamily: grotesk,
                    fontSize: 15,
                    fontWeight: 600,
                    margin: '0 0 12px',
                    letterSpacing: '0.02em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span
                    style={{ width: 6, height: 18, borderRadius: 3, background: 'var(--accent)' }}
                  />
                  {g.title}
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: 10,
                  }}
                >
                  {g.items.map((b) => {
                    const href = b[1].startsWith('http') ? b[1] : 'https://' + b[1].split(' ')[0];
                    return (
                      <div
                        key={b[0]}
                        style={{
                          background: '#fffdf9',
                          border: '1px solid #e4ded1',
                          borderRadius: 11,
                          padding: '14px 16px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <span style={{ fontFamily: grotesk, fontWeight: 600, fontSize: 14.5 }}>
                            {b[0]}
                          </span>
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener"
                            style={{ fontFamily: mono, fontSize: 11 }}
                          >
                            {b[1]} ↗
                          </a>
                        </div>
                        <div
                          style={{
                            fontSize: 12.5,
                            color: '#55504a',
                            marginTop: 6,
                            lineHeight: 1.45,
                          }}
                        >
                          {b[2]}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: '#a39d90',
                            marginTop: 8,
                            lineHeight: 1.45,
                            borderTop: '1px solid #efe9dc',
                            paddingTop: 8,
                          }}
                        >
                          {b[3]}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* DETAIL DRAWER */}
      {selRole && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(30,26,20,0.32)',
            zIndex: 40,
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              height: '100%',
              width: 420,
              maxWidth: '92vw',
              background: '#f7f3ec',
              boxShadow: '-12px 0 40px rgba(40,30,15,0.18)',
              overflowY: 'auto',
              animation: 'slideIn 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '22px 24px',
                borderBottom: '1px solid #e4ded1',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontFamily: grotesk, fontWeight: 600, fontSize: 21, lineHeight: 1.15 }}>
                  {selRole.co}
                </div>
                <div style={{ fontSize: 14, color: '#55504a', marginTop: 4 }}>{selRole.role}</div>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: '#e6e0d4',
                  border: 'none',
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  fontSize: 16,
                  cursor: 'pointer',
                  color: '#55504a',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <div style={{ ...labelMono, marginBottom: 10 }}>Move to stage</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
                {STATUS_META.map((m) => {
                  const cur = selRole.status === m.key;
                  return (
                    <button
                      key={m.key}
                      onClick={() => persistStatus(selRole.id, m.key)}
                      style={{
                        fontFamily: sans,
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '6px 11px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: '1px solid ' + (cur ? m.color : '#e0dacd'),
                        background: cur ? m.bg : '#fffdf9',
                        color: cur ? m.color : '#8a857b',
                      }}
                    >
                      {m.key}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {buildFields(selRole).map((f) => (
                  <div
                    key={f.label}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '110px 1fr',
                      gap: 12,
                      padding: '11px 0',
                      borderTop: '1px solid #eae4d7',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: mono,
                        fontSize: 10.5,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: '#a39d90',
                        paddingTop: 1,
                      }}
                    >
                      {f.label}
                    </span>
                    <span style={{ fontSize: 13.5, color: '#33302b', lineHeight: 1.45 }}>
                      {f.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildFields(r: Role): { label: string; value: string }[] {
  const f: { label: string; value: string }[] = [];
  f.push({ label: 'Track', value: r.track || 'Unassigned' });
  f.push({ label: 'Priority', value: r.prio || '—' });
  f.push({ label: 'Location', value: r.loc || '—' });
  if (r.type && r.type !== '—') f.push({ label: 'Work Type', value: r.type });
  if (r.sal) f.push({ label: 'Salary', value: r.sal });
  if (r.src && r.src !== '—') f.push({ label: 'Source', value: r.src });
  if (r.contact) f.push({ label: 'Contact', value: r.contact });
  if (r.next) f.push({ label: 'Next Action', value: r.next });
  return f;
}

// ---- Recommended tab ----
function RecommendedTab(props: {
  existing: Role[];
  writable: boolean;
  onAdded: (role: Role) => void;
}) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [provider, setProvider] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [added, setAdded] = useState<Record<string, 'saving' | 'done' | 'error'>>({});
  const [filter, setFilter] = useState('All');

  async function load(f: string = filter) {
    setFilter(f);
    setLoading(true);
    try {
      const url = f === 'All' ? '/api/search' : `/api/search?track=${encodeURIComponent(f)}`;
      const res = await fetch(url);
      const data = await res.json();
      setListings(data.listings || []);
      setProvider(data.provider || '');
      setErrors(data.errors || []);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!loaded) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const existingKeys = useMemo(
    () => new Set(props.existing.map((r) => (r.co + '|' + r.role).toLowerCase())),
    [props.existing],
  );

  async function addToPipeline(l: Listing) {
    if (!props.writable) return;
    setAdded((a) => ({ ...a, [l.id]: 'saving' }));
    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          co: l.co,
          role: l.role,
          src: l.src,
          loc: l.loc,
          sal: l.sal,
          track: l.track,
          status: 'Ready to Apply',
          prio: '',
          next: l.url ? 'Review posting: ' + l.url : '',
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      props.onAdded(data.role as Role);
      setAdded((a) => ({ ...a, [l.id]: 'done' }));
    } catch {
      setAdded((a) => ({ ...a, [l.id]: 'error' }));
    }
  }

  const providerLabel =
    provider === 'sample'
      ? 'Sample data — configure a job-search API key to pull live listings'
      : `Live via ${provider}`;

  // group listings by track
  const groups = useMemo(() => {
    const map = new Map<string, Listing[]>();
    listings.forEach((l) => {
      const arr = map.get(l.track) || [];
      arr.push(l);
      map.set(l.track, arr);
    });
    return Array.from(map.entries());
  }, [listings]);

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '26px 28px 60px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <p style={{ fontSize: 14, color: '#6f6a60', margin: 0, lineHeight: 1.55, maxWidth: 640 }}>
          New roles matched to your search tracks, pulled from a compliant job-search API (which
          indexes Indeed, LinkedIn &amp; ZipRecruiter postings). Add any to your pipeline in one
          click.
        </p>
        <button
          onClick={() => load()}
          disabled={loading}
          style={{
            fontFamily: sans,
            fontSize: 13,
            fontWeight: 600,
            padding: '9px 16px',
            borderRadius: 10,
            border: '1px solid var(--accent)',
            background: 'var(--accent)',
            color: '#fff',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {loading && (
            <span
              style={{
                width: 12,
                height: 12,
                border: '2px solid rgba(255,255,255,0.5)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 0.7s linear infinite',
              }}
            />
          )}
          {loading ? 'Fetching…' : 'Refresh listings'}
        </button>
      </div>

      <div
        style={{
          fontFamily: mono,
          fontSize: 11,
          color: provider === 'sample' ? '#b07000' : '#1f8a6d',
          background: provider === 'sample' ? '#f8eeda' : '#e1f2ec',
          border: '1px solid ' + (provider === 'sample' ? '#ecd9ab' : '#c3e3d6'),
          borderRadius: 8,
          padding: '8px 12px',
          marginBottom: 18,
          display: 'inline-block',
        }}
      >
        {providerLabel}
      </div>

      {/* track filter — resume-aligned recommendation lanes; clicking loads that lane */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 22 }}>
        {[{ key: 'All', label: 'All Tracks' }, ...REC_TRACK_NAMES.map((t) => ({ key: t, label: t }))].map(
          (c) => (
            <button
              key={c.key}
              onClick={() => {
                if (!loading) load(c.key);
              }}
              style={chipStyle(filter === c.key)}
            >
              {c.label}
            </button>
          ),
        )}
      </div>

      {errors.length > 0 && (
        <div style={{ fontSize: 12, color: '#a8443a', marginBottom: 16 }}>
          Some queries failed: {errors.join('; ')}
        </div>
      )}

      {loading && listings.length === 0 && (
        <div style={{ color: '#8a857b', fontSize: 14, padding: '30px 0' }}>Fetching listings…</div>
      )}
      {!loading && listings.length === 0 && loaded && (
        <div style={{ color: '#8a857b', fontSize: 14, padding: '30px 0' }}>
          No listings returned. Try a different track or refresh.
        </div>
      )}

      {groups.map(([trackName, items]) => (
        <div key={trackName} style={{ marginBottom: 30 }}>
          <h3
            style={{
              fontFamily: grotesk,
              fontSize: 15,
              fontWeight: 600,
              margin: '0 0 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ width: 6, height: 18, borderRadius: 3, background: 'var(--accent)' }} />
            {trackName}
            <span style={{ fontFamily: mono, fontSize: 11, color: '#a39d90', fontWeight: 400 }}>
              {items.length}
            </span>
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
              gap: 10,
            }}
          >
            {items.map((l) => {
              const exists = existingKeys.has((l.co + '|' + l.role).toLowerCase());
              const st = added[l.id];
              return (
                <div
                  key={l.id}
                  style={{
                    background: '#fffdf9',
                    border: '1px solid #e4ded1',
                    borderRadius: 11,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontFamily: grotesk, fontWeight: 600, fontSize: 14.5 }}>
                        {l.co}
                      </div>
                      <div style={{ fontSize: 12.5, color: '#55504a', marginTop: 2 }}>{l.role}</div>
                    </div>
                    <span
                      style={{
                        fontFamily: mono,
                        fontSize: 9.5,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: '#6f6a60',
                        background: '#f0eadd',
                        padding: '3px 7px',
                        borderRadius: 5,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {l.src}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11.5 }}>
                    <span style={{ color: '#a39d90' }}>{l.loc}</span>
                    {l.sal && (
                      <span style={{ fontFamily: mono, fontSize: 11, color: '#6f6a60' }}>{l.sal}</span>
                    )}
                    {l.posted && <span style={{ color: '#a39d90' }}>· {l.posted}</span>}
                  </div>
                  {l.snippet && (
                    <div style={{ fontSize: 12, color: '#6f6a60', lineHeight: 1.45 }}>
                      {l.snippet}
                      {l.snippet.length >= 180 ? '…' : ''}
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      marginTop: 4,
                      alignItems: 'center',
                      borderTop: '1px solid #efe9dc',
                      paddingTop: 10,
                    }}
                  >
                    {l.url && (
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener"
                        style={{ fontFamily: mono, fontSize: 11.5 }}
                      >
                        View posting ↗
                      </a>
                    )}
                    <div style={{ flex: 1 }} />
                    {exists || st === 'done' ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1f8a6d' }}>
                        {st === 'done' ? 'Added ✓' : 'In pipeline'}
                      </span>
                    ) : (
                      <button
                        onClick={() => addToPipeline(l)}
                        disabled={!props.writable || st === 'saving'}
                        title={
                          props.writable
                            ? 'Add to your pipeline'
                            : 'Connect a Google Sheet to add roles'
                        }
                        style={{
                          fontFamily: sans,
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: '1px solid ' + (props.writable ? 'var(--accent)' : '#ddd6c9'),
                          background: props.writable ? '#f7ede6' : '#f2ede3',
                          color: props.writable ? 'var(--accent)' : '#a39d90',
                          cursor: props.writable && st !== 'saving' ? 'pointer' : 'default',
                        }}
                      >
                        {st === 'saving' ? 'Adding…' : st === 'error' ? 'Retry' : '+ Add to pipeline'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
