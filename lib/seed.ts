import type { Role, StatusMeta, TermGroup, BoardGroup } from './types';

/** Pipeline stages, in order, with their card/pill colors. Ported from the prototype. */
export const STATUS_META: StatusMeta[] = [
  { key: 'Ready to Apply', color: '#5b57d6', bg: '#eceafa' },
  { key: 'In Progress', color: '#b07000', bg: '#f8eeda' },
  { key: 'Applied', color: '#2f6bb0', bg: '#e6eef8' },
  { key: 'Phone Screen', color: '#1f8a6d', bg: '#e1f2ec' },
  { key: 'Interviewing', color: '#1f8a5b', bg: '#e1f2e8' },
  { key: 'Offer', color: '#9a7500', bg: '#f7efd6' },
  { key: 'Hold', color: '#6f6a60', bg: '#ede9e0' },
  { key: 'Skip', color: '#8a857b', bg: '#ece8df' },
  { key: 'Rejected', color: '#a8443a', bg: '#f5e5e1' },
];

export function statusMeta(k: string): StatusMeta {
  return STATUS_META.find((s) => s.key === k) || { key: k, color: '#8a857b', bg: '#ece8df' };
}

export const PRIO_META: Record<string, string> = {
  'Very High': '#b0542f',
  High: '#cf8a3a',
  Medium: '#9a9488',
  Low: '#c3bdb0',
  '': '#d8d2c5',
};

// [co, role, src, loc, type, sal, track, status, prio, contact, next]
const RAW: string[][] = [
  ['Affinity Group', 'Key Account Specialist (Food Broker)', 'JazzHR / Company site', 'Raleigh, NC', 'Remote field', 'Competitive + bonus', 'Foodservice Sales', 'Phone Screen', 'Very High', 'Johnny', 'Prepare for phone screen'],
  ['Aramark', 'General Manager, Retail Dining — Duke Hospital', 'Company site', 'Durham, NC', 'Onsite', '', '', 'Applied', 'Medium', '', ''],
  ['Cheney Brothers', 'District Sales Representative', 'Company site', 'North Carolina', 'Field sales', '', '', 'Applied', 'High', '', ''],
  ['CLEAR', 'General Manager, Future Openings', 'Company site', 'All US / airport locations', 'Airport operations', 'Base + target bonus', 'Aviation / Airport Operations', 'Hold', 'High', '', ''],
  ['Club at 12 Oaks', 'Food and Beverage Director', 'Company site', 'Holly Springs, NC', 'Onsite', '', '', 'Applied', 'High', '', ''],
  ['Constellation Brands', 'Senior Market Development Manager', 'Company site', 'North Carolina', 'Field / Hybrid', '', '', 'Applied', 'High', '', ''],
  ['Cornerstone Caregiving', 'Director, Business Development & Operations', 'Company site', 'Raleigh / Durham', 'Field / Hybrid', '', '', 'Skip', 'Medium', '', ''],
  ['Crawford Hospitality', 'GM / F&B (any)', 'Company site', 'Raleigh, NC', 'Onsite', '$70K–$120K', 'F&B Director / GM', 'Applied', 'High', '', ''],
  ['Durham Bulls / Capitol Broadcasting', 'Baseball Account Executive', 'LinkedIn / Company site', 'Durham, NC', 'Onsite / Events', '', '', 'Hold', 'Low', '', ''],
  ['East of Texas', 'General Manager', 'Company site', 'North Carolina', 'Onsite', '', '', 'Applied', 'Medium', '', ''],
  ['Eurofins', 'Territory Sales Rep / Account Manager', 'Company site', 'Raleigh / Region', 'Field sales', '', '', 'In Progress', 'High', '', ''],
  ['FreshPoint / Sysco', 'Buyer', 'Company site', 'Morrisville, NC', 'Onsite', 'Target $78K–$84K', 'Procurement / Supply Chain', 'Applied', 'Very High', '', 'Watch for response'],
  ['Gilde Brewery', 'Sales Representative', 'Company site', 'North Carolina', 'Field sales', '', '', 'Applied', 'Medium', '', ''],
  ['Giorgios Hospitality Group', 'General Manager', 'Company site', 'Raleigh / Durham', 'Onsite', '', '', 'Applied', 'Medium', '', ''],
  ['Grapevine Distributing', 'Sales Representative', 'Company site', 'North Carolina', 'Field sales', '', '', 'Applied', 'Medium', '', ''],
  ['Grove Collaborative', 'Inventory Planner', 'Company site', 'Remote', 'Remote', '$75K–$90K', 'Procurement / Supply Chain', 'Applied', 'Very High', '', ''],
  ['Hotaling & Co.', 'Business Development Manager', 'Company site', 'North Carolina', 'Field sales', '', '', 'Applied', 'High', '', ''],
  ['Idahoan Foods', 'National Account Manager, Non-Commercial', 'Company site', 'Remote', 'Remote', '$140K–$175K + bonus', 'Foodservice Sales', 'Rejected', 'High', '', ''],
  ['Italian ingredient manufacturer', 'Sales Manager, Southeast', 'LinkedIn', 'Concord, NC + Southeast', 'Hybrid / 60% travel', 'Base + ~$30K KPI bonus', 'Foodservice Sales', 'Skip', 'Low', '', ''],
  ['Johnson Brothers', 'Sales Training Manager', 'Company site', 'North Carolina', 'Field / Hybrid', '', '', 'Applied', 'High', '', ''],
  ['Johnson Brothers', 'On-Premise Spirits District Manager', 'Company site', 'North Carolina', 'Field sales', '', '', 'Applied', 'High', '', ''],
  ['MaintainX', 'Customer Success Manager', 'Company site', 'Raleigh, NC', 'Hybrid', 'Target $95K', 'Remote Hospitality SaaS / Tech', 'Applied', 'High', '', ''],
  ['NC State Dining', 'Assistant Director', 'Company site', 'Raleigh, NC', 'Onsite', '', '', 'Applied', 'Medium', '', ''],
  ['Nextaff', 'Business Development & Partnerships Manager', 'Company site', 'Raleigh / Durham', 'Hybrid / Field', '', '', 'Applied', 'Medium', '', ''],
  ['North Carolina Courage', 'Merchandise Manager', 'Company site', 'Cary, NC', 'Onsite / Event', 'Est. $78K–$88K', 'Procurement / Supply Chain', 'Skip', 'Medium', '', ''],
  ['Novonesis', 'National Account Manager, East Territory', 'Company site', 'Remote', 'Remote', '$125K–$145K', 'Foodservice Sales', 'Applied', 'High', '', ''],
  ['Oak Steakhouse Raleigh (Indigo Road)', 'GM / Beverage Director', 'Networking', 'Raleigh, NC', 'Onsite', '', '', 'Hold', 'Medium', 'Nicholas Papas', ''],
  ['Paycom', 'Strategic Account Manager', 'Company site', 'Raleigh, NC', 'Field / Hybrid', '', '', 'Rejected', 'Medium', '', ''],
  ['Piper Companies', 'Operations Manager', 'Company site', 'Durham, NC', 'Hybrid', 'Target $95K', 'Operations / Business Development', 'Applied', 'High', '', ''],
  ['Prestonwood Country Club', 'Assistant Manager (Red Fox)', 'Direct application', 'Cary, NC', 'Onsite', '', '', 'Applied', 'Low', '', ''],
  ['Proof Wine & Spirits', 'Wine Sales Representative', 'Company site', 'North Carolina', 'Field sales', '', '', 'Applied', 'High', '', ''],
  ['Raleigh Marriott City Center', 'Catering Sales Manager', 'Company site', 'Raleigh, NC', 'Onsite', '', '', 'Applied', 'Medium', '', ''],
  ['Restaurant365', 'Account Executive', 'LinkedIn / Company site', 'Remote', 'Remote', '$90K–$120K', 'Remote Hospitality SaaS / Tech', 'Ready to Apply', 'Medium', '', ''],
  ['Rewards Network', 'Sales Account Executive', 'Company site', 'Raleigh / Durham', 'Field sales', '', '', 'Rejected', 'Medium', '', ''],
  ['SevenRooms', 'Account Development Executive', 'LinkedIn / Company site', 'Remote', 'Remote', '$90K–$120K', 'Remote Hospitality SaaS / Tech', 'Ready to Apply', 'Medium', '', ''],
  ['Sodexo Live', 'Director of Catering Sales — Raleigh Convention Center', 'Company site', 'Raleigh, NC', 'Onsite', '', '', 'Rejected', 'High', '', ''],
  ['Swissport', 'Strategic Procurement Manager', 'Company site', 'Raleigh, NC', 'Hybrid', '$110K–$113K', 'Procurement / Supply Chain', 'Applied', 'Very High', '', 'Watch for response'],
  ['Swissport', 'HQA Billing Analyst', 'Company site', 'Raleigh, NC', 'Onsite', '$50K–$64K', 'Aviation / Airport Operations', 'Skip', 'Low', '', ''],
  ["The Chefs' Warehouse", 'Sales Associate', 'Company site / Dayforce', 'Raleigh, NC', 'Field sales', '$60K–$100K + commission', 'Foodservice Sales', 'Applied', 'High', '', 'Watch for response'],
  ['The Durham Hotel', 'Director of Food & Beverage', 'Company site', 'Durham, NC', 'Onsite', '', '', 'Applied', 'High', '', ''],
  ['The Fresh Market', 'Co-Store Director', 'LinkedIn / Company site', 'Raleigh / Durham area', 'Onsite', '$75K–$90K', 'F&B Director / GM', 'Skip', 'Low', '', ''],
  ['Thermo Fisher Scientific', 'Marketing Meetings & Events Specialist', 'Company site', 'RTP / Raleigh', 'Hybrid', '', '', 'Applied', 'Medium', '', ''],
  ['Total Wine', 'Assistant Store Manager, Sales', 'Company site', 'Raleigh / Durham area', 'Onsite', 'Up to ~$70K', 'F&B Director / GM', 'Applied', 'Low', '', ''],
  ['Uline', 'Territory Sales Manager', 'Company site', 'Raleigh, NC', 'Field sales', '', '', 'Rejected', 'Medium', '', ''],
  ['Varonis', 'Procurement Buyer', 'Company site', 'Raleigh / Remote', '—', '', '', 'Applied', 'High', '', ''],
  ['ViiV / GSK', 'Sales Performance & Incentive Manager', 'Company site', 'Raleigh / RTP', 'Hybrid', '', '', 'Applied', 'Medium', '', ''],
  ['White Lodging', 'Sales Manager', 'Company site', 'Raleigh, NC', 'Onsite / Hybrid', '', '', 'Applied', 'Medium', '', ''],
  ['Oak View Group', 'GM / AGM', 'Company site', 'Durham, NC', 'Onsite', '$80K–$110K', 'F&B Director / GM', 'Applied', 'High', '', ''],
  ['Looma', 'Role TBD', '—', '—', '—', '', '', 'Ready to Apply', '', '', ''],
  ['Nanasteak', 'FOH / Management', 'Company site', 'Durham, NC', 'Onsite', '', '', 'Ready to Apply', '', '', ''],
  ['Osteria', 'FOH / Management', 'Company site', 'Durham, NC', 'Onsite', '', '', 'Ready to Apply', '', '', ''],
  ['Bluebird', 'Server', 'ZipRecruiter', 'Chapel Hill, NC', 'Onsite', '', '', 'Ready to Apply', '', '', ''],
  ['Rocket Farm', 'GM / AGM', 'Company site', 'Raleigh, NC', 'Onsite', '$70K–$120K', 'F&B Director / GM', 'Applied', 'High', '', ''],
  ['Sixty Vines', 'Restaurant Manager', 'Company site', 'Raleigh, NC', 'Onsite', 'Up to $75K', 'F&B Director / GM', 'Ready to Apply', 'Medium', '', ''],
  ['Nanas', 'Server', 'Indeed', 'Durham, NC', 'Onsite', '', '', 'Ready to Apply', '', '', ''],
];

export function seedRoles(): Role[] {
  return RAW.map((r, i) => ({
    id: 'r' + i,
    co: r[0],
    role: r[1],
    src: r[2],
    loc: r[3],
    type: r[4],
    sal: r[5],
    track: r[6],
    status: r[7],
    prio: r[8],
    contact: r[9],
    next: r[10],
  }));
}

/** Convert a Role to a Sheet row in SHEET_HEADERS order. */
export function roleToRow(r: Role): string[] {
  return [r.co, r.role, r.src, r.loc, r.type, r.sal, r.track, r.status, r.prio, r.contact, r.next];
}

/** Convert a Sheet row (SHEET_HEADERS order) plus its row index into a Role. */
export function rowToRole(row: string[], index: number): Role {
  const g = (i: number) => (row[i] ?? '').toString();
  return {
    id: 'r' + index,
    co: g(0),
    role: g(1),
    src: g(2),
    loc: g(3),
    type: g(4),
    sal: g(5),
    track: g(6),
    status: g(7),
    prio: g(8),
    contact: g(9),
    next: g(10),
  };
}

export const TERM_GROUPS: TermGroup[] = [
  {
    title: 'Hospitality Leadership (F&B Director / GM / Beverage Director)',
    items: [
      '("Food and Beverage Director" OR "F&B Director" OR "Director of Food and Beverage") AND (steakhouse OR "fine dining" OR "luxury hospitality")',
      '("General Manager" OR "Restaurant General Manager" OR "GM") AND (restaurant OR steakhouse OR "fine dining") NOT "QSR"',
      '("Beverage Director" OR "Wine Director" OR "Director of Wine") AND (restaurant OR hospitality OR hotel)',
      '("Assistant General Manager" OR "AGM") AND (restaurant OR "country club" OR "private club") AND (Raleigh OR Durham OR "Chapel Hill" OR Triangle)',
      '("Restaurant Manager" OR "Operations Manager") AND ("fine dining" OR upscale OR luxury) AND (NC OR "North Carolina")',
    ],
  },
  {
    title: 'Wine & Spirits Distribution / Beverage Sales',
    items: [
      '("District Sales Manager" OR "Territory Manager" OR "Key Account Manager") AND (wine OR spirits OR "beverage alcohol")',
      '("Sales Representative" OR "Account Executive") AND (wine OR spirits OR distributor) AND (Carolinas OR "North Carolina" OR NC)',
      '("Market Development Manager" OR "Brand Ambassador" OR "Portfolio Manager") AND (wine OR spirits OR beverage)',
      '(sommelier OR "wine director" OR "beverage manager") AND ("on premise" OR "on-premise" account management)',
    ],
  },
  {
    title: 'Remote Hospitality SaaS / Tech Sales',
    items: [
      '("Account Executive" OR "Customer Success Manager" OR "Implementation Manager") AND (restaurant OR hospitality) AND (SaaS OR software) AND remote',
      '("Sales Development Representative" OR "Account Manager") AND ("restaurant technology" OR "hospitality technology" OR "POS")',
      '(restaurant OR hospitality) AND (SaaS OR platform) AND ("Account Executive" OR "Regional Sales Manager") AND remote',
    ],
  },
  {
    title: 'Aviation / Ops-Adjacent Management',
    items: [
      '("Operations Manager" OR "General Manager" OR "Station Manager") AND (aviation OR airport OR FBO OR "fixed base operator")',
      '("Customer Service Manager" OR "Ground Operations Manager") AND (airline OR airport OR aviation)',
      '("General Manager" OR "Director of Operations") AND ("private aviation" OR "business aviation" OR charter)',
    ],
  },
  {
    title: 'General Management (cross-industry)',
    items: [
      '("General Manager" OR "Operations Director" OR "Director of Operations") AND (hospitality OR luxury OR "guest experience")',
      '("Regional Manager" OR "Multi-Unit Manager") AND (restaurant OR hospitality OR retail) NOT franchise',
    ],
  },
  {
    title: 'Procurement / Supply Chain',
    items: [
      '("Strategic Procurement" OR "Procurement Manager" OR "Sourcing Manager") AND (Raleigh OR Durham OR "Research Triangle")',
      '("Buyer" OR "Purchasing Manager" OR "Category Manager") AND (foodservice OR hospitality OR aviation OR airport)',
      '("Inventory Planner" OR "Demand Planner" OR "Supply Planner") AND (food OR beverage OR CPG OR ecommerce)',
      '("Vendor Manager" OR "Supplier Manager" OR "Contracts Manager") AND (procurement OR sourcing OR supply)',
    ],
  },
  {
    title: 'Aviation, Airport & RDU-Adjacent',
    items: [
      '("Airport Operations" OR "Airport Manager" OR "Station Manager") AND (RDU OR Raleigh OR Durham OR Morrisville)',
      '("Commercial Manager" OR "Concessions Manager" OR "Revenue Manager") AND (airport OR aviation)',
      '("Procurement" OR "Contracts" OR "Supply Chain") AND (airport OR aviation OR airline OR "ground handling")',
      '("General Manager" OR "Operations Manager") AND (CLEAR OR Swissport OR "Signature Aviation" OR "Atlantic Aviation")',
    ],
  },
  {
    title: 'Foodservice Sales & Account Management',
    items: [
      '("Foodservice Sales" OR "Food Broker" OR "Key Account Specialist") AND (Raleigh OR Durham OR "North Carolina")',
      '("Territory Sales" OR "Account Manager") AND (restaurant OR culinary OR foodservice) AND (Raleigh OR Durham)',
      '("Wine Sales" OR "Spirits" OR "On Premise") AND ("North Carolina" OR Raleigh OR Durham)',
    ],
  },
];

export const BOARD_GROUPS: BoardGroup[] = [
  {
    title: 'Hospitality / Restaurant — General',
    items: [
      ['Hcareers', 'hcareers.com', 'Hotel ops, F&B management, revenue management', '20+ years in the space; strong for salaried hotel/restaurant management roles'],
      ['Hospitality Online', 'hospitalityonline.com', 'Hotels, restaurants, casinos', 'Company profiles let you vet culture before applying'],
      ['iHireHospitality', 'ihirehospitality.com', 'Hospitality professionals broadly', 'Resume-matching, career-advice content'],
      ['Culinary Agents', 'culinaryagents.com', 'F&B, beverage & service roles incl. sommeliers/managers', '2M+ member community; paid posting means fewer low-effort applicants'],
      ['Poached Jobs', 'poachedjobs.com', 'Restaurant/bar roles, strongest West Coast/PNW', 'Good secondary channel, mobile-first'],
      ['OysterLink', 'oysterlink.com', 'Restaurant-only, fast-moving markets (NYC, Miami)', 'Newer, restaurant-only focus'],
      ['HospitalityCrossing', 'hospitalitycrossing.com', 'Broad reach via EmploymentCrossing network', 'Free posting tier exists; large resume database'],
      ['eHotelier Careers', 'ehotelier.com/careers', 'Hotel management, international', 'Good if open to hotel-side GM/ops roles'],
      ['BevNET / Beverage Careers', 'bevnet.com/jobs', 'Beverage/alcohol brand roles', 'Broader than wine — spirits, beer, non-alc too'],
    ],
  },
  {
    title: 'Wine & Beverage',
    items: [
      ['Winejobs.com', 'winejobs.com', 'Winery, distribution, on-premise wine sales', 'Industry-leading; 10,000+ postings/year, includes a comp/salary tracker'],
      ['Wine Jobs USA', 'winejobsusa.com', 'Wine + hospitality crossover roles', 'Run by a Master of Wine; smaller but curated'],
      ['Wine Industry Careers', 'wineindustrycareers.com', 'Winery/vineyard/tasting room, some corporate', 'Posts salary ranges on most listings'],
      ['BevForce', 'bevforce.com', 'Beverage-alcohol recruiting + job board', 'Also does executive search — worth a direct outreach'],
      ['SevenFifty Jobs', 'sevenfifty.com/jobs', 'Distributor/importer/on-premise buyer roles', 'Tied to the SevenFifty B2B marketplace used by distributors'],
      ['GuildSomm', 'guildsomm.com', 'Sommelier & beverage director roles', 'Best for credential-adjacent postings given your CMS track'],
    ],
  },
  {
    title: 'Aviation',
    items: [
      ['JSfirm.com', 'jsfirm.com', 'Aviation management, ops, sales, executive', 'Largest general-aviation board; free resume posting; dedicated management category'],
      ['Avjobs.com', 'avjobs.com', 'Airlines, airports, manufacturers, ground ops', 'Broad coverage; good if open to airport/ops-adjacent management'],
      ['Aviation Job Search', 'aviationjobsearch.com', 'Global airline/MRO/operator roles incl. management', 'Strong if open to relocation/international'],
      ['NBAA Career Center', 'jobs.nbaa.org', 'Business/private aviation incl. FBO & ops management', 'Private aviation trends hospitality-adjacent — a fit for your background'],
      ['Climbto350.com', 'climbto350.com', 'Airline hiring intel + listings', 'Useful more for market intel than management roles'],
    ],
  },
  {
    title: 'Sales (general + hospitality-adjacent)',
    items: [
      ['Rep Hunter', 'rephunter.net', 'B2B & manufacturer sales reps', 'Includes food/beverage/hospitality-adjacent sales roles'],
      ['Sales Gravy Jobs', 'salesgravyjobs.com', 'B2B sales roles across industries', 'Good for SaaS/tech sales cross-search'],
      ['HFTP Career Center', 'hftp.org', 'Hospitality finance, technology & ops leadership', 'Niche but well-matched to a tech-plus-hospitality profile'],
    ],
  },
  {
    title: 'Executive / Retained Search (GM, Director, F&B Director level)',
    items: [
      ['Gecko Hospitality', 'geckohospitality.com', 'Restaurant GM / F&B Director placements', 'Regional recruiters, often unlisted client roles — worth a direct call'],
      ['Goodwin Recruiting', 'goodwinrecruiting.com', 'Hospitality management search', 'Candidate-friendly, no cost to job seekers'],
      ['AETHOS Consulting Group', 'aethosconsulting.com', 'Senior hospitality/travel executive search', 'More hotel-executive skewed but worth being on their radar'],
      ['BlueSteps', 'bluesteps.com', 'Executive-level hospitality & travel careers', 'Membership-based; positions you for retained-search visibility'],
    ],
  },
];
