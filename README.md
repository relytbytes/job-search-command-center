# Job Search Command Center

An interactive job-search pipeline for Tyler Shelton — built from the Claude Design
prototype in `project/` and wired up to be **live**:

- **Google Sheets is the source of truth.** Edits in the sheet show up in the app, and status
  changes in the app write straight back to the sheet. Your spreadsheet stays the system of record.
- **Recommended listings** are pulled from a compliant job-search API (which indexes Indeed,
  LinkedIn & ZipRecruiter postings) and matched to your search "tracks." Add any to your pipeline
  in one click.

It runs out of the box with the 55 seeded roles as demo data — no credentials required — and turns
"live" the moment you add a Google Sheet and (optionally) a job-API key.

## What's in the app

| Tab | What it does |
| --- | --- |
| **Pipeline** | Drag-and-drop Kanban across 9 stages, plus a sortable table view. Live stats, focus queue, and filters by track & priority. Drag a card (or use the detail drawer) to change stage — it persists to your sheet. |
| **Recommended** | New roles pulled from the job-search API, grouped by track. "+ Add to pipeline" appends them to your sheet. Already-tracked companies are flagged so you don't double-add. |
| **Application Assistant** | Inside each role's detail drawer — one-click **cover letter** and **follow-up email** generation via Claude, tailored to that role and grounded in your resume (`lib/resume.ts`). Optional "what to emphasize" note; copy or regenerate. |
| **Search Strings** | Your boolean search strings, grouped by lane, each with one-click copy. |
| **Job Boards** | The curated board/recruiter directory beyond Indeed/LinkedIn/ZipRecruiter. |

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000  — works immediately with demo data
```

To go live, copy `.env.example` → `.env.local` and fill in the sections below.

## 1. Connect your Google Sheet (source of truth)

1. In [Google Cloud Console](https://console.cloud.google.com/): create a project and **enable the
   Google Sheets API**.
2. Create a **Service Account** and download its JSON key.
3. Create (or open) your spreadsheet and **Share it with the service account's email** as **Editor**.
4. Put these in `.env.local`:
   ```
   GOOGLE_SHEET_ID=<the id from the sheet URL: docs.google.com/spreadsheets/d/THIS_PART/edit>
   GOOGLE_SERVICE_ACCOUNT_EMAIL=<from the JSON: client_email>
   GOOGLE_PRIVATE_KEY="<from the JSON: private_key, keep the \n escapes>"
   ```
5. **Seed the sheet** with your tracker, search strings, and boards in the schema the app expects:
   ```bash
   npm run seed-sheet
   ```
   This writes a `Tracker` tab (11 columns — see `lib/types.ts` `SHEET_HEADERS`), a
   `Boolean Search Terms` tab, and a `Job Boards` tab. From then on, edit the sheet or the app —
   they stay in sync.

> The Tracker columns are: **Company, Role, Source, Location, Work Type, Salary, Track, Status,
> Priority, Contact, Next Action.** Keep that order; the app maps rows by position.

## 2. Enable recommended listings (job-search API)

Pick **one** provider and add its key. Without any key, the Recommended tab shows sample listings.

| Provider | Env vars | Notes |
| --- | --- | --- |
| **Adzuna** (recommended) | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Free tier at [developer.adzuna.com](https://developer.adzuna.com/). |
| **JSearch** (RapidAPI) | `JSEARCH_API_KEY` | Indexes Google-for-Jobs — includes LinkedIn/ZipRecruiter/Indeed postings. |
| **SerpAPI** | `SERPAPI_KEY` | Google Jobs engine. |

Optionally set `JOB_API_PROVIDER` to force one, and `JOB_SEARCH_LOCATION` (defaults to
`Raleigh, North Carolina`). The app distills each boolean search string down to keywords these APIs
accept, runs one query per track, and dedupes the results.

**A note on scraping:** Indeed, LinkedIn, and ZipRecruiter prohibit direct scraping in their Terms
(LinkedIn pursues it legally). This app never scrapes them — it uses aggregator APIs that are
licensed to index those postings, which is the compliant way to surface the same listings.

## 3. Enable the writing assistant (cover letters + follow-ups)

Add an **Anthropic API key** so the "Application Assistant" in each role's drawer can draft cover
letters and follow-up emails, tailored to the role and grounded in your resume:

```
ANTHROPIC_API_KEY=sk-ant-...        # from https://console.anthropic.com/
ANTHROPIC_MODEL=claude-opus-4-8     # optional (this is the default)
```

Your resume content lives in `lib/resume.ts` (professional history only — no phone/personal email,
since the repo is public). To change it without editing code, set `CANDIDATE_PROFILE` to your full
resume text. Without a key, the buttons show a "not configured" message.

## 4. Deploy (for the "automatic" part)

The app needs an always-on host to keep the sheet synced and serve fresh recommendations. It's a
standard Next.js app — [Vercel](https://vercel.com/) is the simplest target:

```bash
# push to GitHub, import the repo in Vercel, then add the same .env.local vars
# in the Vercel project settings. Done.
```

To make recommendations refresh **on a schedule** (e.g. every morning), add a
[Vercel Cron Job](https://vercel.com/docs/cron-jobs) hitting `/api/search`, or wire a small daily
job that POSTs high-priority matches into your sheet. The building blocks (`/api/search`,
`/api/roles`) are already in place.

## Architecture

```
app/
  layout.tsx            fonts + globals
  page.tsx              the whole UI (client) — pixel-ported from the prototype + Recommended tab
  api/
    roles/route.ts      GET list · POST append (to Sheet)
    roles/[id]/route.ts PATCH status/fields (to Sheet; localStorage fallback in demo mode)
    search/route.ts     GET recommendations from the job API
lib/
  types.ts              Role/Listing types + SHEET_HEADERS
  seed.ts               the 55 roles, term groups, board groups, status/priority meta
  sheets.ts             Google Sheets read/write (falls back to seed when unconfigured)
  jobapi.ts             Adzuna / JSearch / SerpAPI adapters (+ sample fallback)
scripts/
  seed-sheet.ts         one-time: push your data into a fresh Google Sheet
project/                the original Claude Design prototype + source spreadsheet (reference)
```

**Graceful degradation:** with no env vars the app serves seed data, persists status changes to
`localStorage`, and shows sample recommendations — so it always renders. Each capability lights up
independently as you add its credentials.
