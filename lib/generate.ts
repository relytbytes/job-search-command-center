import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { Role } from './types';
import { candidateProfile, CANDIDATE_NAME } from './resume';

/**
 * The writing assistant works with EITHER an OpenAI or an Anthropic key —
 * whichever is configured. If both are set, OpenAI is preferred (set
 * GEN_PROVIDER to force one).
 */
type Provider = 'openai' | 'anthropic';

export function activeProvider(): Provider | null {
  const forced = (process.env.GEN_PROVIDER || '').toLowerCase();
  if (forced === 'openai' && process.env.OPENAI_API_KEY) return 'openai';
  if (forced === 'anthropic' && process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return null;
}

export function generatorConfigured(): boolean {
  return activeProvider() !== null;
}

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

let _openai: OpenAI | null = null;
let _anthropic: Anthropic | null = null;
const openai = () => (_openai ??= new OpenAI()); // reads OPENAI_API_KEY
const anthropic = () => (_anthropic ??= new Anthropic()); // reads ANTHROPIC_API_KEY

export type GenKind = 'cover' | 'followup' | 'prep';

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
    role.notes && `Candidate's notes on this role: ${role.notes}`,
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

function prepPrompt(role: Role, extra?: string): string {
  return `Create a concise, practical interview-prep primer for ${CANDIDATE_NAME}, who has a phone
screen or interview coming up for the role below. Use these short, labeled sections (plain text
headers, no markdown):

SNAPSHOT — 2-3 sentences on what this company likely does and what this role is really about, inferred
from the title and industry. If you're not certain of a company specific, say "verify" rather than
inventing it.
LIKELY QUESTIONS — 6-8 questions they may ask for this role and level, each with a one-line angle on
how ${CANDIDATE_NAME} should answer (drawing on the resume).
YOUR EDGE — 3-4 talking points that connect ${CANDIDATE_NAME}'s real resume achievements (use the
actual numbers) to what this role needs.
SMART QUESTIONS TO ASK — 4-5 thoughtful questions for the interviewer.
PREP CHECKLIST — 4-6 concrete things to review or research beforehand.

Ground "YOUR EDGE" strictly in the resume; never invent employers, metrics, or company facts.
${extra ? `\nExtra focus from the candidate: ${extra}` : ''}

=== TARGET ROLE ===
${roleContext(role)}

=== CANDIDATE RESUME ===
${candidateProfile()}`;
}

function promptFor(kind: GenKind, role: Role, extra?: string): string {
  if (kind === 'cover') return coverPrompt(role, extra);
  if (kind === 'followup') return followupPrompt(role, extra);
  return prepPrompt(role, extra);
}

export async function generate(kind: GenKind, role: Role, extra?: string): Promise<string> {
  const prompt = promptFor(kind, role, extra);
  const maxTokens = kind === 'prep' ? 2400 : 1600;
  const provider = activeProvider();

  if (provider === 'openai') {
    const res = await openai().chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt },
      ],
    });
    return (res.choices[0]?.message?.content || '').trim();
  }

  if (provider === 'anthropic') {
    const res = await anthropic().messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
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

  throw new Error('No writing-assistant API key configured (set OPENAI_API_KEY or ANTHROPIC_API_KEY).');
}
