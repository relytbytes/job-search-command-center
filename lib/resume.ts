/**
 * Candidate profile used to tailor generated cover letters and follow-ups.
 *
 * This is the professional content from Tyler's resume — deliberately WITHOUT
 * phone number or personal email, since this file is committed to a public repo.
 * Override it at runtime with the CANDIDATE_PROFILE env var (e.g. to add contact
 * details on your own deployment) without changing code.
 */
export const CANDIDATE_NAME = 'Tyler Shelton';
export const CANDIDATE_LOCATION = 'Durham, NC';

const BUNDLED_PROFILE = `
Tyler Shelton — Durham, NC — linkedin.com/in/tylerjshelton

PROFESSIONAL SUMMARY
Revenue-driven sales and business development professional with 15+ years of experience growing
programs, building client relationships, and closing high-value deals across luxury hospitality and
B2B environments. Proven ability to drive measurable revenue growth through strategic account
management, product expertise, and consultative selling. Skilled in distributor and vendor
negotiation, team development, and leveraging CRM and analytics tools to identify and capture growth.

CORE COMPETENCIES
Revenue Growth & Sales Strategy · Account Management & Distributor Relations · Consultative Selling ·
Contract & Vendor Negotiation · B2B Relationship Development · Team Training & Development ·
Forecasting & Purchasing · P&L Management · CRM & Sales Analytics · New Business Development ·
Product Presentation & Education · Cost Control & Margin Optimization

EXPERIENCE
Wine Director — Mastro's Steakhouse, Chicago, IL (Jan 2026 – Jun 2026)
- Grew wine's share of total sales from 7% to 16%+ within three months via staff training and guest
  engagement strategy in a high-volume luxury steakhouse.
- Managed distributor relationships and vendor negotiations, achieving ~25% average cost reduction
  through strategic deal timing and case-pricing leverage.
- Directed beverage inventory and ordering; led and developed a team of 60+ front-of-house staff.

Beverage Director — Bavette's Bar & Boeuf, Chicago, IL (Jun 2025 – Jan 2026)
- Managed a $7.3M total beverage program (wine, spirits, cocktails) at a nationally recognized concept.
- Negotiated distributor pricing and secured allocated products via Southern Glazer's, Breakthru, and
  Republic National.
- Built inventory forecasting models that cut excess stock 20% while maintaining full availability.

Wine Director — The Capital Grille, Chicago, IL (Jul 2023 – Jun 2025)
- Grew wine revenue from $730K to $1.1M in year one (51%) and to $1.6M in year two (120% total) by
  expanding the list 100+ labels and adding Coravin and specialty by-the-glass programs.
- Built a portfolio of high-value guest relationships (wine-locker holders, private-dining clients).
- Collaborated with the Managing Partner on weekly P&L reviews; trained 45+ FOH staff.

Inventory Specialist — The Fresh Market, Asheville, NC (Jul 2021 – May 2022)
- Managed inventory control and purchasing for a specialty grocery retailer; reduced shrinkage and
  resolved supply-chain/pricing discrepancies.

Wholesale Product Specialist — The Sherwin-Williams Co., Asheville, NC (Jan 2019 – Jun 2021)
- Grew a portfolio of commercial accounts through consultative selling; exceeded monthly targets of
  $30K–$75K in all but two months, averaging 15%+ above goal (peak 200%+ in the spring 2020 surge).

Assistant Operations Manager — Eschelon Experiences, Raleigh, NC (Apr 2015 – Jul 2018)
- Supported multi-unit operations across high-volume restaurants and cocktail bars; contributed to
  vendor relationships, team development, new-location openings, hiring, and process standardization.

EDUCATION & CERTIFICATIONS
- WSET Level 2 Award in Wines — Pass with Merit (Jul 2025)
- Court of Master Sommeliers, Certified Sommelier (In Progress)
- B.S. Business Administration, Management Information Systems — East Carolina University (2022)
- Associate in Aviation Management — A-B Tech Community College (2020)

SYSTEMS & TOOLS
Salesforce CRM, Tripleseat, Delphi, BevSpot, Restaurant365, Uptown Network, FinTech, Toast,
Aloha/NCR Voyix, OpenTable, Resy, Tock, Trabon MenuNet, Advanced Excel, Google Sheets.
`.trim();

export function candidateProfile(): string {
  return process.env.CANDIDATE_PROFILE?.trim() || BUNDLED_PROFILE;
}
