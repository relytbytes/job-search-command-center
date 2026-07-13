'use client';

import { useEffect, useMemo, useRef, useState, CSSProperties } from 'react';
import type { Role, Listing } from '@/lib/types';
import { STATUS_META, statusMeta, PRIO_META, prioRank, TERM_GROUPS, BOARD_GROUPS } from '@/lib/seed';
import { REC_TRACK_NAMES } from '@/lib/recTracks';

const LS_KEY = 'landed-tracker-v2';
const LS_OLD = 'tsl-tracker-v1';

type Tab = 'pipeline' | 'recommended' | 'terms' | 'boards';
type View = 'board' | 'table';
type SortKey = '' | 'co' | 'role' | 'track' | 'status' | 'prio' | 'loc' | 'sal';

const jost = "'Jost', sans-serif";
const sans = "'IBM Plex Sans', sans-serif";
const mono = "'IBM Plex Mono', monospace";

// ---- style helpers (new "Landed" palette) ----
function tabStyle(active: boolean): CSSProperties {
  return {
    fontFamily: jost,
    fontSize: 15,
    fontWeight: 600,
    padding: '10px 16px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    borderBottom: '2.5px solid ' + (active ? 'var(--accent)' : 'transparent'),
    color: active ? '#2f2a23' : '#9a8f77',
    marginBottom: -1,
  };
}
function segStyle(active: boolean): CSSProperties {
  return {
    fontFamily: jost,
    fontSize: 13.5,
    fontWeight: 600,
    padding: '6px 16px',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    background: active ? '#fdf7ea' : 'transparent',
    color: active ? '#2f2a23' : '#6e6455',
    boxShadow: active ? '0 1px 3px rgba(80,55,25,0.16)' : 'none',
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
    border: '1px solid ' + (active ? 'var(--accent)' : '#ddd0b5'),
    background: active ? 'var(--accent)' : '#fdf7ea',
    color: active ? '#fff' : '#574e40',
  };
}
const eyebrow: CSSProperties = {
  fontFamily: jost,
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.13em',
  textTransform: 'uppercase',
  color: '#a89d84',
};
const fieldLabel: CSSProperties = {
  fontFamily: jost,
  fontSize: 10.5,
  fontWeight: 500,
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  color: '#a89d84',
  display: 'block',
  marginBottom: 5,
};
const editInput: CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  border: '1px solid #ddd0b5',
  borderRadius: 9,
  background: '#fdf7ea',
  outline: 'none',
  color: '#2f2a23',
  fontFamily: sans,
};

const FLIGHT_STAGES = ['Ready to Apply', 'In Progress', 'Applied', 'Phone Screen', 'Interviewing', 'Offer'];
const SHORT_LABEL: Record<string, string> = {
  'Ready to Apply': 'Ready',
  'In Progress': 'In progress',
  Applied: 'Applied',
  'Phone Screen': 'Screen',
  Interviewing: 'Interview',
  Offer: 'Offer',
};

function loadLocalEdits(): Record<string, Partial<Role>> {
  try {
    const rawNew = localStorage.getItem(LS_KEY);
    if (rawNew) return JSON.parse(rawNew);
    const rawOld = localStorage.getItem(LS_OLD);
    if (rawOld) {
      const old = JSON.parse(rawOld) as Record<string, string>;
      const migrated: Record<string, Partial<Role>> = {};
      Object.keys(old).forEach((id) => (migrated[id] = { status: old[id] }));
      return migrated;
    }
  } catch {}
  return {};
}
function saveLocalEdits(ov: Record<string, Partial<Role>>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(ov));
  } catch {}
}

export default function Page() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [source, setSource] = useState<'sheets' | 'seed'>('seed');
  const [writable, setWritable] = useState(false);

  const [tab, setTab] = useState<Tab>('pipeline');
  const [view, setView] = useState<View>('board');
  const [query, setQuery] = useState('');
  const [track, setTrack] = useState('All');
  const [prio, setPrio] = useState('All');
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragId = useRef<string | null>(null);

  async function loadRoles(): Promise<{ source: string; writable: boolean }> {
    const res = await fetch('/api/roles');
    const data = await res.json();
    let loaded: Role[] = data.roles || [];
    if (data.source === 'seed') {
      const ov = loadLocalEdits();
      loaded = loaded.map((r) => (ov[r.id] ? { ...r, ...ov[r.id] } : r));
    }
    setRoles(loaded);
    setSource(data.source);
    setWritable(!!data.writable);
    return { source: data.source, writable: !!data.writable };
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadRoles();
      } catch {
        if (!cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function persistPatch(id: string, patch: Partial<Role>) {
    setRoles((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    if (writable) {
      fetch(`/api/roles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }).catch(() => {});
    } else {
      const ov = loadLocalEdits();
      ov[id] = { ...ov[id], ...patch };
      saveLocalEdits(ov);
    }
  }

  function fieldChange(id: string, field: keyof Role, value: string) {
    const v = field === 'track' && value === 'Unassigned' ? '' : value;
    persistPatch(id, { [field]: v } as Partial<Role>);
  }

  async function addRole() {
    const blank = {
      co: 'New Company',
      role: 'New Role',
      src: '',
      loc: '',
      type: '',
      sal: '',
      track: '',
      status: 'Ready to Apply',
      prio: 'Medium',
      contact: '',
      next: '',
      notes: '',
    };
    if (writable) {
      try {
        const res = await fetch('/api/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(blank),
        });
        const data = await res.json();
        if (data.role) {
          setRoles((rs) => [...rs, data.role as Role]);
          setTab('pipeline');
          setSelected((data.role as Role).id);
        }
      } catch {}
    } else {
      const id = 'c' + Date.now();
      setRoles((rs) => [...rs, { id, ...blank } as Role]);
      setTab('pipeline');
      setSelected(id);
    }
  }

  async function removeRole(id: string) {
    setSelected(null);
    setRoles((rs) => rs.filter((r) => r.id !== id));
    if (writable) {
      try {
        await fetch(`/api/roles/${id}`, { method: 'DELETE' });
        await loadRoles(); // row deletion shifts positional ids — resync
      } catch {}
    } else {
      const ov = loadLocalEdits();
      delete ov[id];
      saveLocalEdits(ov);
    }
  }

  function setSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
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
    { label: 'Total Roles', value: roles.length, color: '#2f2a23' },
    { label: 'Active', value: activeCount, color: '#c15b34' },
    { label: 'Applied', value: countBy('Applied'), color: '#c15b34' },
    { label: 'In Conversation', value: responses, color: '#2e7d6e' },
    { label: 'Closed Out', value: countBy('Rejected') + countBy('Skip'), color: '#b0442c' },
  ];

  const momentum = useMemo(() => {
    const segments = FLIGHT_STAGES.map((k) => {
      const m = statusMeta(k);
      const count = roles.filter((r) => r.status === k).length;
      return { key: k, label: SHORT_LABEL[k], count, color: m.color };
    });
    const submitted =
      countBy('Applied') + responses + countBy('Rejected');
    const rate = submitted > 0 ? Math.round((responses / submitted) * 100) : 0;
    return { segments, rate };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles]);

  const focusItems = useMemo(() => {
    const rank = (r: Role): { w: number; a: string } | null => {
      if (r.status === 'Phone Screen' || r.status === 'Interviewing')
        return { w: 0, a: 'Prep — conversation booked' };
      if (r.status === 'In Progress') return { w: 1, a: 'In progress — finish & submit' };
      if (r.status === 'Applied' && r.prio === 'Very High') return { w: 2, a: 'Follow up — top priority' };
      if (r.status === 'Ready to Apply' && (r.prio === 'Very High' || r.prio === 'High'))
        return { w: 3, a: 'Ready — send it today' };
      if (r.status === 'Offer') return { w: -1, a: 'Offer on the table — respond' };
      return null;
    };
    return roles
      .map((r) => {
        const f = rank(r);
        return f
          ? { id: r.id, co: r.co, action: f.a, w: f.w, dot: statusMeta(r.status).color, rank: prioRank(r.prio) }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => a!.w - b!.w || a!.rank - b!.rank)
      .slice(0, 8) as { id: string; co: string; action: string; w: number; dot: string; rank: number }[];
  }, [roles]);

  const trackChips = useMemo(() => {
    const set: string[] = [];
    roles.forEach((r) => {
      const t = r.track || 'Unassigned';
      if (!set.includes(t)) set.push(t);
    });
    set.sort();
    return [{ key: 'All', label: 'All Tracks' }].concat(set.map((t) => ({ key: t, label: t })));
  }, [roles]);
  const trackOptions = useMemo(() => {
    const set = trackChips.filter((c) => c.key !== 'All').map((c) => c.key);
    return ['Unassigned'].concat(set.filter((t) => t !== 'Unassigned'));
  }, [trackChips]);
  const prioOptions = ['Very High', 'High', 'Medium', 'Low'];
  const prioFilter = ['All', 'Very High', 'High', 'Medium', 'Low'];

  const columns = useMemo(
    () =>
      STATUS_META.map((m) => ({
        key: m.key,
        label: m.key,
        color: m.color,
        cards: filtered.filter((r) => r.status === m.key),
      })),
    [filtered],
  );

  const stageIdx = (s: string) => STATUS_META.findIndex((m) => m.key === s);
  const tableRows = useMemo(() => {
    const rows = filtered.slice();
    if (sortKey) {
      rows.sort((a, b) => {
        let av: string | number, bv: string | number;
        if (sortKey === 'status') {
          av = stageIdx(a.status);
          bv = stageIdx(b.status);
        } else if (sortKey === 'prio') {
          av = prioRank(a.prio);
          bv = prioRank(b.prio);
        } else {
          av = (a[sortKey] || '').toString().toLowerCase();
          bv = (b[sortKey] || '').toString().toLowerCase();
        }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    } else rows.sort((a, b) => a.co.localeCompare(b.co));
    return rows;
  }, [filtered, sortKey, sortDir]);

  const tableCols: [SortKey, string][] = [
    ['co', 'Company'],
    ['role', 'Role'],
    ['track', 'Track'],
    ['status', 'Status'],
    ['prio', 'Priority'],
    ['loc', 'Location'],
    ['sal', 'Salary'],
  ];

  const selRole = selected ? roles.find((r) => r.id === selected) : null;
  const showingLabel =
    filtered.length === roles.length ? `${roles.length} roles` : `Showing ${filtered.length} of ${roles.length}`;

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
        color: '#2f2a23',
        background: '#f2e9d5',
        display: 'flex',
        flexDirection: 'column',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* HEADER */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'rgba(242,233,213,0.9)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid #e0d3b8',
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: '0 auto',
            padding: '20px 28px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            {/* logo lockup */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'linear-gradient(140deg, #e0913f, #c15b34)',
                  boxShadow: '0 5px 14px rgba(193,91,52,0.32)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="21" height="21" viewBox="0 0 24 24" style={{ transform: 'rotate(3deg)' }}>
                  <path d="M2.4 11.7 21.6 2.8l-7.1 18.7-3.9-7.5-8.2-2.3z" fill="#fdf7ea" />
                  <path d="m10.6 14 4.6-6.1-6.3 4.9z" fill="#f0cfa0" />
                </svg>
              </div>
              <div style={{ lineHeight: 1 }}>
                <div style={{ fontFamily: jost, fontWeight: 600, fontSize: 23, letterSpacing: '-0.005em' }}>
                  Landed
                </div>
                <div
                  style={{
                    fontFamily: jost,
                    fontSize: 11,
                    color: '#9a8f77',
                    marginTop: 4,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                  }}
                >
                  Job hunt, handled
                </div>
              </div>
            </div>

            {/* live status + user chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#6e6455' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2e7d6e' }} />
                {roles.length} roles · {source === 'sheets' ? 'live' : 'demo'}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#ece2cd',
                  padding: '5px 13px 5px 5px',
                  borderRadius: 22,
                }}
              >
                <span
                  style={{
                    width: 27,
                    height: 27,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    color: '#fff',
                    fontFamily: jost,
                    fontWeight: 600,
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  TS
                </span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Tyler Shelton</span>
              </div>
            </div>
          </div>

          <nav style={{ display: 'flex', gap: 2 }}>
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
                marginBottom: 14,
              }}
            >
              {stats.map((s) => (
                <div
                  key={s.label}
                  style={{ background: '#fdf7ea', border: '1px solid #e4d8bf', borderRadius: 16, padding: '16px 18px' }}
                >
                  <div
                    style={{ fontFamily: jost, fontSize: 34, fontWeight: 600, lineHeight: 1, letterSpacing: '-0.01em', color: s.color }}
                  >
                    {s.value}
                  </div>
                  <div
                    style={{
                      fontFamily: jost,
                      fontSize: 11,
                      fontWeight: 500,
                      letterSpacing: '0.13em',
                      textTransform: 'uppercase',
                      color: '#9a8f77',
                      marginTop: 9,
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* momentum bar */}
            <div
              style={{ background: '#fdf7ea', border: '1px solid #e4d8bf', borderRadius: 16, padding: '18px 20px', marginBottom: 14 }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 13,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <span style={{ ...eyebrow }}>Pipeline momentum</span>
                <span style={{ fontSize: 12.5, color: '#6e6455' }}>
                  Response rate&nbsp;&nbsp;
                  <b style={{ fontFamily: jost, color: '#2e7d6e', fontSize: 15, fontWeight: 600 }}>
                    {momentum.rate}%
                  </b>
                </span>
              </div>
              <div
                style={{ display: 'flex', height: 15, borderRadius: 8, overflow: 'hidden', background: '#ece2cd', gap: 2 }}
              >
                {momentum.segments.map((seg) => (
                  <div
                    key={seg.key}
                    title={`${seg.label}: ${seg.count}`}
                    style={{
                      flexGrow: seg.count,
                      flexBasis: 0,
                      minWidth: seg.count > 0 ? 5 : 0,
                      background: seg.color,
                      transition: 'flex-grow 0.4s ease',
                      animation: 'growBar 0.4s ease',
                    }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 14 }}>
                {momentum.segments.map((seg) => (
                  <div key={seg.key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: seg.color }} />
                    <span style={{ fontSize: 12, color: '#574e40' }}>{seg.label}</span>
                    <span style={{ fontFamily: jost, fontSize: 12.5, fontWeight: 600, color: '#2f2a23' }}>
                      {seg.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* focus queue (computed) */}
            {focusItems.length > 0 && (
              <div
                style={{
                  background: 'linear-gradient(120deg, #24463f, #1c332e)',
                  color: '#f2e9d5',
                  borderRadius: 16,
                  padding: '17px 22px',
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontFamily: jost,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: '#e6b455',
                    marginBottom: 14,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e6b455' }} />
                  Focus Queue · what needs you today
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10 }}>
                  {focusItems.map((q) => (
                    <div
                      key={q.id}
                      onClick={() => setSelected(q.id)}
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        borderLeft: '3px solid ' + q.dot,
                        borderRadius: 11,
                        padding: '11px 13px',
                        cursor: 'pointer',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    >
                      <div style={{ fontFamily: jost, fontSize: 14.5, fontWeight: 600, lineHeight: 1.15 }}>{q.co}</div>
                      <div style={{ fontSize: 11.5, color: '#a9c2b5', marginTop: 4 }}>{q.action}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* search + add + view toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <span
                  style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#a89d84', fontSize: 14 }}
                >
                  ⌕
                </span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search company, role, or location…"
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 32px',
                    border: '1px solid #ddd0b5',
                    borderRadius: 11,
                    background: '#fdf7ea',
                    fontFamily: sans,
                    fontSize: 14,
                    color: '#2f2a23',
                    outline: 'none',
                  }}
                />
              </div>
              <button
                onClick={addRole}
                style={{
                  fontFamily: jost,
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: '9px 16px',
                  border: 'none',
                  borderRadius: 11,
                  background: 'var(--accent)',
                  color: '#fff',
                  boxShadow: '0 3px 10px rgba(193,91,52,0.28)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add role
              </button>
              <div style={{ display: 'flex', background: '#ece2cd', borderRadius: 11, padding: 3 }}>
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
            {/* priority chips + showing */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 22, alignItems: 'center' }}>
              <span style={{ ...eyebrow, marginRight: 4 }}>Priority</span>
              {prioFilter.map((p) => (
                <button key={p} onClick={() => setPrio(p)} style={chipStyle(prio === p)}>
                  {p}
                </button>
              ))}
              <span style={{ marginLeft: 'auto', fontFamily: jost, fontSize: 12, color: '#9a8f77' }}>
                {showingLabel}
              </span>
            </div>

            {/* BOARD */}
            {view === 'board' && (
              <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
                {columns.map((col) => (
                  <div
                    key={col.key}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragId.current) persistPatch(dragId.current, { status: col.key });
                      dragId.current = null;
                    }}
                    style={{
                      flex: '0 0 272px',
                      width: 272,
                      background: '#ece2cd',
                      borderRadius: 16,
                      padding: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 9,
                      minHeight: 120,
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 2px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                        <span style={{ fontFamily: jost, fontWeight: 600, fontSize: 14, letterSpacing: '0.005em' }}>
                          {col.label}
                        </span>
                      </div>
                      <span style={{ fontFamily: jost, fontSize: 13, fontWeight: 500, color: '#9a8f77' }}>
                        {col.cards.length}
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
                          background: '#fdf7ea',
                          border: '1px solid #e4d8bf',
                          borderLeft: '3px solid ' + (PRIO_META[card.prio] || PRIO_META['']),
                          borderRadius: 13,
                          padding: '12px 13px',
                          cursor: 'pointer',
                          transition: 'box-shadow 0.12s, transform 0.12s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(80,55,25,0.12)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.transform = 'none';
                        }}
                      >
                        <div style={{ fontFamily: jost, fontWeight: 600, fontSize: 15, lineHeight: 1.2 }}>{card.co}</div>
                        <div style={{ fontSize: 12.5, color: '#6e6455', marginTop: 3, lineHeight: 1.35 }}>{card.role}</div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
                          {card.track && (
                            <span
                              style={{
                                fontFamily: jost,
                                fontSize: 10,
                                fontWeight: 500,
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                color: 'var(--accent)',
                                background: '#f7e7d8',
                                padding: '3px 7px',
                                borderRadius: 6,
                              }}
                            >
                              {card.track}
                            </span>
                          )}
                          {card.sal && <span style={{ fontFamily: mono, fontSize: 10, color: '#6e6455' }}>{card.sal}</span>}
                        </div>
                        {card.next && (
                          <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 9 }}>
                            <span style={{ fontSize: 9 }}>➜</span> {card.next}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: '#a89d84', marginTop: 8 }}>{card.loc}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* TABLE */}
            {view === 'table' && (
              <div style={{ background: '#fdf7ea', border: '1px solid #e4d8bf', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 820 }}>
                    <thead>
                      <tr style={{ background: '#efe6d3', textAlign: 'left' }}>
                        {tableCols.map(([key, label]) => {
                          const active = sortKey === key;
                          const caret = active ? (sortDir === 'asc' ? '  ↑' : '  ↓') : '';
                          return (
                            <th
                              key={key}
                              onClick={() => setSort(key)}
                              style={{
                                padding: '12px 16px',
                                fontFamily: jost,
                                fontSize: 11,
                                fontWeight: 600,
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                                color: active ? '#c15b34' : '#9a8f77',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                userSelect: 'none',
                              }}
                            >
                              {label}
                              {caret}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((r) => {
                        const m = statusMeta(r.status);
                        return (
                          <tr
                            key={r.id}
                            onClick={() => setSelected(r.id)}
                            style={{ borderTop: '1px solid #ece0c8', cursor: 'pointer' }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f6efe0')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <td style={{ padding: '12px 16px', fontWeight: 600, fontFamily: jost, fontSize: 14 }}>
                              {r.co}
                            </td>
                            <td style={{ padding: '12px 16px', color: '#6e6455' }}>{r.role}</td>
                            <td style={{ padding: '12px 16px', color: '#6e6455', fontSize: 12 }}>
                              {r.track || 'Unassigned'}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  padding: '3px 10px',
                                  borderRadius: 20,
                                  color: m.color,
                                  background: m.bg,
                                }}
                              >
                                {r.status}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#574e40' }}>
                                <span
                                  style={{ width: 8, height: 8, borderRadius: '50%', background: PRIO_META[r.prio] || PRIO_META[''] }}
                                />
                                {r.prio || '—'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#6e6455', fontSize: 12 }}>{r.loc}</td>
                            <td style={{ padding: '12px 16px', color: '#6e6455', fontFamily: mono, fontSize: 11 }}>
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
          <RecommendedTab existing={roles} writable={writable} onAdded={(role) => setRoles((rs) => [...rs, role])} />
        )}

        {/* SEARCH STRINGS */}
        {tab === 'terms' && (
          <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 28px 60px' }}>
            <p style={{ fontSize: 14, color: '#6e6455', margin: '0 0 26px', lineHeight: 1.55 }}>
              Paste directly into LinkedIn or Indeed keyword search — or into Google as{' '}
              <span style={{ fontFamily: mono, fontSize: 12.5, background: '#ece2cd', padding: '2px 6px', borderRadius: 5 }}>
                site:linkedin.com/jobs [string]
              </span>
            </p>
            {TERM_GROUPS.map((g, gi) => (
              <div key={g.title} style={{ marginBottom: 32 }}>
                <h3
                  style={{
                    fontFamily: jost,
                    fontSize: 16,
                    fontWeight: 600,
                    margin: '0 0 12px',
                    letterSpacing: '0.005em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span style={{ width: 4, height: 17, borderRadius: 2, background: 'var(--accent)' }} />
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
                          background: '#fdf7ea',
                          border: '1px solid #e4d8bf',
                          borderRadius: 12,
                          padding: '13px 14px',
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
                            color: '#3a332a',
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
                            fontFamily: jost,
                            fontSize: 12.5,
                            fontWeight: 600,
                            padding: '6px 13px',
                            borderRadius: 8,
                            border: '1px solid ' + (isCopied ? '#2e7d6e' : '#ddd0b5'),
                            background: isCopied ? '#dcefe9' : '#efe6d3',
                            color: isCopied ? '#2e7d6e' : '#574e40',
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
          <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 28px 60px' }}>
            <p style={{ fontSize: 14, color: '#6e6455', margin: '0 0 26px', lineHeight: 1.55 }}>
              Boards beyond Indeed / LinkedIn / ZipRecruiter, grouped by lane. Verify postings before relying on them.
            </p>
            {BOARD_GROUPS.map((g) => (
              <div key={g.title} style={{ marginBottom: 32 }}>
                <h3
                  style={{
                    fontFamily: jost,
                    fontSize: 15,
                    fontWeight: 600,
                    margin: '0 0 12px',
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span style={{ width: 4, height: 16, borderRadius: 2, background: 'var(--accent)' }} />
                  {g.title}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
                  {g.items.map((b) => {
                    const href = b[1].startsWith('http') ? b[1] : 'https://' + b[1].split(' ')[0];
                    return (
                      <div
                        key={b[0]}
                        style={{ background: '#fdf7ea', border: '1px solid #e4d8bf', borderRadius: 13, padding: '15px 16px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontFamily: jost, fontWeight: 600, fontSize: 15 }}>{b[0]}</span>
                          <a href={href} target="_blank" rel="noopener" style={{ fontFamily: mono, fontSize: 11 }}>
                            {b[1]} ↗
                          </a>
                        </div>
                        <div style={{ fontSize: 12.5, color: '#574e40', marginTop: 6, lineHeight: 1.45 }}>{b[2]}</div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: '#a89d84',
                            marginTop: 9,
                            lineHeight: 1.45,
                            borderTop: '1px solid #ece0c8',
                            paddingTop: 9,
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

      {/* EDITOR DRAWER */}
      {selRole && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(44,38,32,0.4)', zIndex: 40, animation: 'fadeIn 0.15s ease' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              height: '100%',
              width: 440,
              maxWidth: '92vw',
              background: '#fbf4e6',
              boxShadow: '-12px 0 40px rgba(44,38,32,0.2)',
              overflowY: 'auto',
              animation: 'slideIn 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '22px 24px',
                borderBottom: '1px solid #e4d8bf',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
                position: 'sticky',
                top: 0,
                background: '#fbf4e6',
                zIndex: 2,
              }}
            >
              <div style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    fontFamily: jost,
                    fontWeight: 600,
                    fontSize: 21,
                    lineHeight: 1.15,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {selRole.co}
                </div>
                <div style={{ fontSize: 14, color: '#6e6455', marginTop: 4 }}>{selRole.role}</div>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: '#ece2cd',
                  border: 'none',
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  fontSize: 16,
                  cursor: 'pointer',
                  color: '#6e6455',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '20px 24px 32px' }}>
              {/* stage */}
              <div style={{ ...eyebrow, letterSpacing: '0.12em', marginBottom: 10 }}>Stage</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 22 }}>
                {STATUS_META.map((m) => {
                  const cur = selRole.status === m.key;
                  return (
                    <button
                      key={m.key}
                      onClick={() => persistPatch(selRole.id, { status: m.key })}
                      style={{
                        fontFamily: sans,
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '6px 11px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: '1px solid ' + (cur ? m.color : '#ddd0b5'),
                        background: cur ? m.bg : '#fdf7ea',
                        color: cur ? m.color : '#9a8f77',
                      }}
                    >
                      {m.key}
                    </button>
                  );
                })}
              </div>

              {/* editable fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={fieldLabel}>Company</label>
                  <input
                    value={selRole.co}
                    onChange={(e) => fieldChange(selRole.id, 'co', e.target.value)}
                    style={{ ...editInput, fontSize: 14 }}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={fieldLabel}>Role</label>
                  <input
                    value={selRole.role}
                    onChange={(e) => fieldChange(selRole.id, 'role', e.target.value)}
                    style={{ ...editInput, fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={fieldLabel}>Track</label>
                  <select
                    value={selRole.track || 'Unassigned'}
                    onChange={(e) => fieldChange(selRole.id, 'track', e.target.value)}
                    style={{ ...editInput, fontSize: 13 }}
                  >
                    {trackOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={fieldLabel}>Priority</label>
                  <select
                    value={selRole.prio || 'Medium'}
                    onChange={(e) => fieldChange(selRole.id, 'prio', e.target.value)}
                    style={{ ...editInput, fontSize: 13 }}
                  >
                    {prioOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={fieldLabel}>Location</label>
                  <input
                    value={selRole.loc}
                    onChange={(e) => fieldChange(selRole.id, 'loc', e.target.value)}
                    style={{ ...editInput, fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={fieldLabel}>Salary</label>
                  <input
                    value={selRole.sal}
                    onChange={(e) => fieldChange(selRole.id, 'sal', e.target.value)}
                    style={{ ...editInput, fontSize: 14 }}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={fieldLabel}>Next action</label>
                  <input
                    value={selRole.next}
                    onChange={(e) => fieldChange(selRole.id, 'next', e.target.value)}
                    placeholder="e.g. Follow up with recruiter"
                    style={{ ...editInput, fontSize: 14, color: 'var(--accent)', fontWeight: 500 }}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={fieldLabel}>Notes</label>
                  <textarea
                    value={selRole.notes}
                    onChange={(e) => fieldChange(selRole.id, 'notes', e.target.value)}
                    rows={4}
                    placeholder="Contacts, prep notes, thoughts…"
                    style={{ ...editInput, fontSize: 13.5, resize: 'vertical', lineHeight: 1.5 }}
                  />
                </div>
              </div>

              <button
                onClick={() => removeRole(selRole.id)}
                style={{
                  marginTop: 20,
                  width: '100%',
                  padding: 10,
                  border: '1px solid #e0c3b8',
                  borderRadius: 9,
                  background: '#f7e7e2',
                  color: '#a8462f',
                  fontFamily: jost,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Remove this role
              </button>

              <DrawerAssistant key={selRole.id} role={selRole} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Application-writing assistant (in the detail drawer) ----
type GenKind = 'cover' | 'followup' | 'prep';
function DrawerAssistant({ role }: { role: Role }) {
  const [notes, setNotes] = useState('');
  const [kind, setKind] = useState<GenKind | null>(null);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [docUrl, setDocUrl] = useState('');
  const [docSaving, setDocSaving] = useState(false);
  const [docErr, setDocErr] = useState('');

  async function run(k: GenKind) {
    setKind(k);
    setLoading(true);
    setError('');
    setText('');
    setCopied(false);
    setDocUrl('');
    setDocErr('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: k, role, extra: notes.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setText(data.text || '');
    } catch (e: any) {
      setError(e?.message || 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  async function saveDoc() {
    setDocSaving(true);
    setDocErr('');
    const label = kind === 'prep' ? 'Interview Prep' : kind === 'cover' ? 'Cover Letter' : 'Follow-up';
    try {
      const res = await fetch('/api/gdoc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `${label} — ${role.co} — ${role.role}`, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setDocUrl(data.url);
    } catch (e: any) {
      setDocErr(e?.message || 'Failed to save');
    } finally {
      setDocSaving(false);
    }
  }

  const btn = (active: boolean): CSSProperties => ({
    fontFamily: sans,
    fontSize: 12.5,
    fontWeight: 600,
    padding: '8px 14px',
    borderRadius: 8,
    cursor: loading ? 'default' : 'pointer',
    border: '1px solid ' + (active ? 'var(--accent)' : '#ddd0b5'),
    background: active ? 'var(--accent)' : '#fdf7ea',
    color: active ? '#fff' : '#574e40',
    opacity: loading && !active ? 0.6 : 1,
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  });

  return (
    <div style={{ marginTop: 26, borderTop: '1px solid #e4d8bf', paddingTop: 20 }}>
      <div style={{ ...fieldLabel, marginBottom: 10 }}>Application Assistant</div>
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional: what to emphasize (e.g. wine program growth)…"
        style={{ ...editInput, fontSize: 12.5, marginBottom: 10 }}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => !loading && run('cover')} disabled={loading} style={btn(kind === 'cover')}>
          {loading && kind === 'cover' && <Spinner />}
          Cover letter
        </button>
        <button onClick={() => !loading && run('followup')} disabled={loading} style={btn(kind === 'followup')}>
          {loading && kind === 'followup' && <Spinner />}
          Follow-up email
        </button>
        <button onClick={() => !loading && run('prep')} disabled={loading} style={btn(kind === 'prep')}>
          {loading && kind === 'prep' && <Spinner />}
          Interview prep
        </button>
      </div>

      {error && <div style={{ fontSize: 12, color: '#a8462f', marginTop: 12, lineHeight: 1.45 }}>{error}</div>}

      {(loading || text) && (
        <div style={{ marginTop: 12, background: '#fdf7ea', border: '1px solid #e4d8bf', borderRadius: 10, padding: '12px 14px' }}>
          {loading ? (
            <div style={{ fontSize: 12.5, color: '#9a8f77' }}>
              Writing your {kind === 'cover' ? 'cover letter' : kind === 'prep' ? 'interview prep' : 'follow-up'}…
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: '#3a332a', lineHeight: 1.5, whiteSpace: 'pre-wrap', fontFamily: sans }}>
                {text}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => {
                    try {
                      navigator.clipboard.writeText(text);
                    } catch {}
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1400);
                  }}
                  style={{
                    fontFamily: sans,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid ' + (copied ? '#2e7d6e' : '#ddd0b5'),
                    background: copied ? '#dcefe9' : '#efe6d3',
                    color: copied ? '#2e7d6e' : '#574e40',
                    cursor: 'pointer',
                  }}
                >
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
                <button
                  onClick={() => kind && run(kind)}
                  style={{
                    fontFamily: sans,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid #ddd0b5',
                    background: '#efe6d3',
                    color: '#574e40',
                    cursor: 'pointer',
                  }}
                >
                  Regenerate
                </button>
                {docUrl ? (
                  <a
                    href={docUrl}
                    target="_blank"
                    rel="noopener"
                    style={{
                      fontFamily: sans,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: '1px solid #2e7d6e',
                      background: '#dcefe9',
                      color: '#2e7d6e',
                      textDecoration: 'none',
                    }}
                  >
                    Open in Google Docs ↗
                  </a>
                ) : (
                  <button
                    onClick={saveDoc}
                    disabled={docSaving}
                    style={{
                      fontFamily: sans,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: '1px solid #ddd0b5',
                      background: '#efe6d3',
                      color: '#574e40',
                      cursor: docSaving ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {docSaving && (
                      <span
                        style={{
                          width: 11,
                          height: 11,
                          border: '2px solid #cbbfa6',
                          borderTopColor: '#574e40',
                          borderRadius: '50%',
                          display: 'inline-block',
                          animation: 'spin 0.7s linear infinite',
                        }}
                      />
                    )}
                    {docSaving ? 'Saving…' : '📄 Save to Google Doc'}
                  </button>
                )}
              </div>
              {docErr && <div style={{ fontSize: 11.5, color: '#a8462f', marginTop: 8 }}>{docErr}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
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
  );
}

// ---- Recommended tab (resume-aligned lanes) ----
function RecommendedTab(props: { existing: Role[]; writable: boolean; onAdded: (role: Role) => void }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [provider, setProvider] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [added, setAdded] = useState<Record<string, 'saving' | 'done' | 'error'>>({});
  const [filter, setFilter] = useState('All');
  const [qText, setQText] = useState('');
  const [lastQ, setLastQ] = useState('');

  async function load(f: string = filter, customQ?: string) {
    const isCustom = customQ !== undefined || (f === '__custom' && !!lastQ);
    const q = customQ !== undefined ? customQ : lastQ;
    setFilter(isCustom ? '__custom' : f);
    if (customQ !== undefined) setLastQ(customQ);
    setLoading(true);
    try {
      const url = isCustom
        ? `/api/search?q=${encodeURIComponent(q)}`
        : f === 'All'
        ? '/api/search'
        : `/api/search?track=${encodeURIComponent(f)}`;
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
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 28px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <p style={{ fontSize: 14, color: '#6e6455', margin: 0, lineHeight: 1.55, maxWidth: 640 }}>
          New roles matched to your search tracks, pulled from a compliant job-search API (which indexes Indeed, LinkedIn
          &amp; ZipRecruiter postings). Add any to your pipeline in one click.
        </p>
        <button
          onClick={() => load()}
          disabled={loading}
          style={{
            fontFamily: jost,
            fontSize: 13.5,
            fontWeight: 600,
            padding: '9px 16px',
            borderRadius: 11,
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            boxShadow: '0 3px 10px rgba(193,91,52,0.28)',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {loading && <Spinner />}
          {loading ? 'Fetching…' : 'Refresh listings'}
        </button>
      </div>

      <div
        style={{
          fontFamily: mono,
          fontSize: 11,
          color: provider === 'sample' ? '#b8842a' : '#2e7d6e',
          background: provider === 'sample' ? '#f4e9cc' : '#dcefe9',
          border: '1px solid ' + (provider === 'sample' ? '#e6d3a0' : '#c3e3d6'),
          borderRadius: 8,
          padding: '8px 12px',
          marginBottom: 18,
          display: 'inline-block',
        }}
      >
        {providerLabel}
      </div>

      {/* free-text local search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!loading && qText.trim()) load(undefined, qText.trim());
        }}
        style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <span
            style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#a89d84', fontSize: 14 }}
          >
            ⌕
          </span>
          <input
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="Search any title or keyword in the Triangle (e.g. beverage director)…"
            style={{
              width: '100%',
              padding: '10px 14px 10px 32px',
              border: '1px solid #ddd0b5',
              borderRadius: 11,
              background: '#fdf7ea',
              fontFamily: sans,
              fontSize: 14,
              color: '#2f2a23',
              outline: 'none',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !qText.trim()}
          style={{
            fontFamily: jost,
            fontSize: 13.5,
            fontWeight: 600,
            padding: '9px 18px',
            borderRadius: 11,
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            cursor: loading || !qText.trim() ? 'default' : 'pointer',
            opacity: loading || !qText.trim() ? 0.6 : 1,
          }}
        >
          Search
        </button>
      </form>

      <div style={{ ...eyebrow, marginBottom: 8 }}>Or pick a lane</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 22 }}>
        {[{ key: 'All', label: 'All Tracks' }, ...REC_TRACK_NAMES.map((t) => ({ key: t, label: t }))].map((c) => (
          <button
            key={c.key}
            onClick={() => {
              if (loading) return;
              setQText('');
              setLastQ('');
              load(c.key);
            }}
            style={chipStyle(filter === c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {errors.length > 0 && (
        <div style={{ fontSize: 12, color: '#a8462f', marginBottom: 16 }}>Some queries failed: {errors.join('; ')}</div>
      )}

      {loading && listings.length === 0 && (
        <div style={{ color: '#9a8f77', fontSize: 14, padding: '30px 0' }}>Fetching listings…</div>
      )}
      {!loading && listings.length === 0 && loaded && (
        <div style={{ color: '#9a8f77', fontSize: 14, padding: '30px 0' }}>
          No listings returned. Try a different track or refresh.
        </div>
      )}

      {groups.map(([trackName, items]) => (
        <div key={trackName} style={{ marginBottom: 30 }}>
          <h3
            style={{
              fontFamily: jost,
              fontSize: 15,
              fontWeight: 600,
              margin: '0 0 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ width: 4, height: 16, borderRadius: 2, background: 'var(--accent)' }} />
            {trackName}
            <span style={{ fontFamily: mono, fontSize: 11, color: '#a89d84', fontWeight: 400 }}>{items.length}</span>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 10 }}>
            {items.map((l) => {
              const exists = existingKeys.has((l.co + '|' + l.role).toLowerCase());
              const st = added[l.id];
              return (
                <div
                  key={l.id}
                  style={{
                    background: '#fdf7ea',
                    border: '1px solid #e4d8bf',
                    borderRadius: 13,
                    padding: '15px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontFamily: jost, fontWeight: 600, fontSize: 15 }}>{l.co}</div>
                      <div style={{ fontSize: 12.5, color: '#574e40', marginTop: 2 }}>{l.role}</div>
                    </div>
                    <span
                      style={{
                        fontFamily: mono,
                        fontSize: 9.5,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: '#6e6455',
                        background: '#efe6d3',
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
                    <span style={{ color: '#a89d84' }}>{l.loc}</span>
                    {l.sal && <span style={{ fontFamily: mono, fontSize: 11, color: '#6e6455' }}>{l.sal}</span>}
                    {l.posted && <span style={{ color: '#a89d84' }}>· {l.posted}</span>}
                  </div>
                  {l.snippet && (
                    <div style={{ fontSize: 12, color: '#6e6455', lineHeight: 1.45 }}>
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
                      borderTop: '1px solid #ece0c8',
                      paddingTop: 10,
                    }}
                  >
                    {l.url && (
                      <a href={l.url} target="_blank" rel="noopener" style={{ fontFamily: mono, fontSize: 11.5 }}>
                        View posting ↗
                      </a>
                    )}
                    <div style={{ flex: 1 }} />
                    {exists || st === 'done' ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#2e7d6e' }}>
                        {st === 'done' ? 'Added ✓' : 'In pipeline'}
                      </span>
                    ) : (
                      <button
                        onClick={() => addToPipeline(l)}
                        disabled={!props.writable || st === 'saving'}
                        title={props.writable ? 'Add to your pipeline' : 'Connect a Google Sheet to add roles'}
                        style={{
                          fontFamily: sans,
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: '1px solid ' + (props.writable ? 'var(--accent)' : '#ddd0b5'),
                          background: props.writable ? '#f7e7d8' : '#efe6d3',
                          color: props.writable ? 'var(--accent)' : '#a89d84',
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
