import Anthropic from '@anthropic-ai/sdk';
import type { Role } from './types';
import { candidateProfile, CANDIDATE_NAME } from './resume';

/** Anthropic is configured when an API key is present. */
export function generatorConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  return _client;
}

export type GenKind = 'cover' | 'followup';

function roleContext(role: Role): string {
  const lines = [
    `Company: ${role.co}`,
    `Role: ${role.role}`,
    role.loc && `Location: ${role.loc}`,
    role.track && `Track / focus area: ${role.track}`,
    role.type && `Work type: ${role.type}`,
    role.sal && `Salary: ${role.sal}`,
    role.src && role.src !== '—' && `Source: ${role.src}`,
    role.status && `Current pipeline stage: ${role.status}`,
    role.contact && `Contact: ${role.contact}`,
    role.next && `Next action noted: ${role.next}`,
  ].filter(Boolean);
  return lines.join('\n');
}

const SYSTEM = `You write job-application materials for a specific candidate. You are given the
candidate's full resume and a target role. Write in the candidate's voice: confident, specific,
and grounded ONLY in the resume — never invent employers, titles, metrics, dates, or credentials.
Prefer concrete achievements (real numbers from the resume) over generic claims. Match the letter to
the target role's industry and level. Keep it tight and human — no clichés ("I am writing to express
my interest"), no filler, no em-dash overuse. Output the finished text only, with no preamble,
notes, or markdown headers.`;

function coverPrompt(role: Role, extra?: string): string {
  return `Write a cover letter (about 250-350 words, 3-4 short paragraphs) for ${CANDIDATE_NAME}
applying to the role below.

Guidance:
- Open with a specific hook tying the candidate's strongest relevant experience to THIS role and company.
- Use 2-3 concrete achievements from the resume that map to what this role needs.
- Close with a confident, low-pressure call to action.
- Do not include the address block or date — start at "Dear Hiring Team," (or a named contact if given).
${extra ? `\nExtra instructions from the candidate: ${extra}` : ''}

=== TARGET ROLE ===
${roleContext(role)}

=== CANDIDATE RESUME ===
${candidateProfile()}`;
}

function followupPrompt(role: Role, extra?: string): string {
  return `Write a short, professional follow-up email (about 90-150 words) from ${CANDIDATE_NAME}
regarding the application below. Infer the right kind of follow-up from the current pipeline stage:
- "Applied" / "In Progress" → a brief note reaffirming interest and fit.
- "Phone Screen" / "Interviewing" → a thank-you that references the conversation and reinforces one
  key strength (keep specifics general since the interview details aren't provided).
- "Offer" → a warm, professional note advancing next steps.
Otherwise, write a courteous check-in.

Include a subject line as the first line ("Subject: ..."). Keep it warm but concise; one clear ask.
${extra ? `\nExtra instructions from the candidate: ${extra}` : ''}

=== TARGET ROLE ===
${roleContext(role)}

=== CANDIDATE RESUME (for grounding; do not paste wholesale) ===
${candidateProfile()}`;
}

export async function generate(kind: GenKind, role: Role, extra?: string): Promise<string> {
  const prompt = kind === 'cover' ? coverPrompt(role, extra) : followupPrompt(role, extra);
  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 1600,
    system: SYSTEM,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}
