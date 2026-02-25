/**
 * Malaysia Standard Industrial Classification (MSIC) 2008 — Selected Codes
 * Used for LHDN MyInvois e-invoice submission and business profile
 * Source: Department of Statistics Malaysia
 */
export const MSIC_CODES = [
  // Section A — Agriculture, Forestry and Fishing
  { code: '01111', description: 'Growing of maize', section: 'A' },
  { code: '01119', description: 'Growing of other cereals', section: 'A' },
  { code: '01210', description: 'Growing of grapes', section: 'A' },
  { code: '01270', description: 'Growing of beverage crops', section: 'A' },
  { code: '01301', description: 'Growing of rubber trees (smallholding)', section: 'A' },
  { code: '01302', description: 'Growing of rubber trees (estate)', section: 'A' },
  { code: '01400', description: 'Animal production', section: 'A' },

  // Section C — Manufacturing
  { code: '10110', description: 'Processing and preserving of meat', section: 'C' },
  { code: '10200', description: 'Processing and preserving of fish', section: 'C' },
  { code: '10710', description: 'Manufacture of bread and bakery products', section: 'C' },
  { code: '13100', description: 'Preparation and spinning of textile fibres', section: 'C' },
  { code: '14100', description: 'Manufacture of wearing apparel', section: 'C' },
  { code: '16100', description: 'Sawmilling and planning of wood', section: 'C' },
  { code: '22110', description: 'Manufacture of rubber tyres and tubes', section: 'C' },
  { code: '26200', description: 'Manufacture of computers and peripherals', section: 'C' },
  { code: '27900', description: 'Manufacture of electrical equipment', section: 'C' },

  // Section F — Construction
  { code: '41001', description: 'Construction of residential buildings', section: 'F' },
  { code: '41002', description: 'Construction of non-residential buildings', section: 'F' },
  { code: '42101', description: 'Construction of roads and streets', section: 'F' },
  { code: '43110', description: 'Demolition work', section: 'F' },
  { code: '43210', description: 'Electrical installation', section: 'F' },
  { code: '43220', description: 'Plumbing, heat and air-conditioning', section: 'F' },
  { code: '43290', description: 'Other construction installation', section: 'F' },
  { code: '43300', description: 'Building completion and finishing', section: 'F' },

  // Section G — Wholesale and Retail Trade
  { code: '46100', description: 'Wholesale on a fee or contract basis', section: 'G' },
  { code: '46200', description: 'Wholesale of agricultural raw materials', section: 'G' },
  { code: '46310', description: 'Wholesale of food, beverages and tobacco', section: 'G' },
  { code: '46410', description: 'Wholesale of textiles and clothing', section: 'G' },
  { code: '46900', description: 'Non-specialised wholesale trade', section: 'G' },
  { code: '47110', description: 'Retail sale in non-specialised stores (supermarkets)', section: 'G' },
  { code: '47191', description: 'Retail sale in non-specialised stores (sundry shops)', section: 'G' },
  { code: '47210', description: 'Retail sale of food in specialised stores', section: 'G' },
  { code: '47250', description: 'Retail sale of beverages in specialised stores', section: 'G' },
  { code: '47410', description: 'Retail sale of computers and IT equipment', section: 'G' },
  { code: '47530', description: 'Retail sale of carpets and floor coverings', section: 'G' },
  { code: '47630', description: 'Retail sale of music and video recordings', section: 'G' },
  { code: '47710', description: 'Retail sale of clothing', section: 'G' },
  { code: '47730', description: 'Dispensing chemist (pharmacy)', section: 'G' },
  { code: '47820', description: 'Retail sale via stalls and markets (food)', section: 'G' },
  { code: '47910', description: 'Retail sale via mail order or internet', section: 'G' },

  // Section H — Transportation and Storage
  { code: '49100', description: 'Transport via railways', section: 'H' },
  { code: '49210', description: 'Urban and suburban passenger land transport', section: 'H' },
  { code: '49310', description: 'Urban and suburban passenger transport (taxi)', section: 'H' },
  { code: '49320', description: 'Taxi operation', section: 'H' },
  { code: '49400', description: 'Freight transport by road', section: 'H' },
  { code: '52100', description: 'Warehousing and storage', section: 'H' },
  { code: '53100', description: 'Postal activities', section: 'H' },
  { code: '53200', description: 'Courier activities', section: 'H' },

  // Section I — Accommodation and Food Service
  { code: '55100', description: 'Hotels and similar accommodation', section: 'I' },
  { code: '55201', description: 'Chalets', section: 'I' },
  { code: '56101', description: 'Restaurants and mobile food service activities', section: 'I' },
  { code: '56102', description: 'Hawker stalls and food courts', section: 'I' },
  { code: '56210', description: 'Event catering activities', section: 'I' },
  { code: '56290', description: 'Other food service activities (canteens)', section: 'I' },
  { code: '56300', description: 'Beverage serving activities', section: 'I' },

  // Section J — Information and Communication
  { code: '58110', description: 'Book publishing', section: 'J' },
  { code: '58130', description: 'Publishing of newspapers', section: 'J' },
  { code: '58200', description: 'Software publishing', section: 'J' },
  { code: '60100', description: 'Radio broadcasting', section: 'J' },
  { code: '60200', description: 'Television programming', section: 'J' },
  { code: '61100', description: 'Wired telecommunications activities', section: 'J' },
  { code: '61200', description: 'Wireless telecommunications activities', section: 'J' },
  { code: '62010', description: 'Computer programming activities', section: 'J' },
  { code: '62020', description: 'Computer consultancy activities', section: 'J' },
  { code: '62090', description: 'Other IT and computer service activities', section: 'J' },
  { code: '63110', description: 'Data processing and hosting', section: 'J' },
  { code: '63120', description: 'Web portals', section: 'J' },

  // Section K — Financial and Insurance Activities
  { code: '64190', description: 'Other monetary intermediation', section: 'K' },
  { code: '64300', description: 'Trusts, funds and similar financial entities', section: 'K' },
  { code: '65110', description: 'Life insurance', section: 'K' },
  { code: '66120', description: 'Security and commodity contracts dealership', section: 'K' },
  { code: '66190', description: 'Other auxiliary financial activities', section: 'K' },
  { code: '66220', description: 'Activities of insurance agents and brokers', section: 'K' },

  // Section L — Real Estate Activities
  { code: '68100', description: 'Real estate activities with own or leased property', section: 'L' },
  { code: '68200', description: 'Real estate activities on a fee or contract basis', section: 'L' },

  // Section M — Professional, Scientific and Technical Activities
  { code: '69100', description: 'Legal activities', section: 'M' },
  { code: '69200', description: 'Accounting, bookkeeping and auditing', section: 'M' },
  { code: '70100', description: 'Activities of head offices', section: 'M' },
  { code: '70200', description: 'Management consultancy activities', section: 'M' },
  { code: '71100', description: 'Architectural and engineering activities', section: 'M' },
  { code: '71200', description: 'Technical testing and analysis', section: 'M' },
  { code: '72100', description: 'Research and experimental development', section: 'M' },
  { code: '73100', description: 'Advertising agencies', section: 'M' },
  { code: '73200', description: 'Market research and public opinion polling', section: 'M' },
  { code: '74100', description: 'Specialized design activities', section: 'M' },
  { code: '74200', description: 'Photographic activities', section: 'M' },
  { code: '74900', description: 'Other professional, scientific and technical activities', section: 'M' },
  { code: '75000', description: 'Veterinary activities', section: 'M' },

  // Section N — Administrative and Support Service Activities
  { code: '77100', description: 'Renting and leasing of motor vehicles', section: 'N' },
  { code: '77200', description: 'Renting and leasing of personal and household goods', section: 'N' },
  { code: '78100', description: 'Activities of employment placement agencies', section: 'N' },
  { code: '78200', description: 'Temporary employment agency activities', section: 'N' },
  { code: '79110', description: 'Travel agency activities', section: 'N' },
  { code: '80100', description: 'Private security activities', section: 'N' },
  { code: '81100', description: 'Combined facilities support activities', section: 'N' },
  { code: '81210', description: 'General cleaning of buildings', section: 'N' },
  { code: '82110', description: 'Combined office administrative service activities', section: 'N' },
  { code: '82190', description: 'Photocopying, document preparation', section: 'N' },
  { code: '82300', description: 'Organisation of conventions and trade shows', section: 'N' },

  // Section P — Education
  { code: '85100', description: 'Pre-primary education', section: 'P' },
  { code: '85200', description: 'Primary education', section: 'P' },
  { code: '85410', description: 'Post-secondary non-tertiary education', section: 'P' },
  { code: '85491', description: 'Private tutoring', section: 'P' },
  { code: '85492', description: 'Other education n.e.c. (driving school)', section: 'P' },
  { code: '85500', description: 'Sports and recreation education', section: 'P' },
  { code: '85600', description: 'Educational support activities', section: 'P' },

  // Section Q — Human Health and Social Work
  { code: '86100', description: 'Hospital activities', section: 'Q' },
  { code: '86210', description: 'General medical practice activities', section: 'Q' },
  { code: '86220', description: 'Specialist medical practice activities', section: 'Q' },
  { code: '86900', description: 'Other human health activities', section: 'Q' },
  { code: '87100', description: 'Residential nursing care facilities', section: 'Q' },
  { code: '88100', description: 'Social work activities without accommodation', section: 'Q' },

  // Section R — Arts, Entertainment and Recreation
  { code: '90000', description: 'Creative, arts and entertainment activities', section: 'R' },
  { code: '93110', description: 'Operation of sports facilities', section: 'R' },
  { code: '93190', description: 'Other sports activities', section: 'R' },
  { code: '93210', description: 'Activities of amusement parks', section: 'R' },

  // Section S — Other Service Activities
  { code: '94110', description: 'Activities of business and employers membership organizations', section: 'S' },
  { code: '95110', description: 'Repair of computers and peripheral equipment', section: 'S' },
  { code: '95120', description: 'Repair of communication equipment', section: 'S' },
  { code: '95210', description: 'Repair of consumer electronics', section: 'S' },
  { code: '96010', description: 'Washing and dry-cleaning of textile and fur products', section: 'S' },
  { code: '96020', description: 'Hairdressing and other beauty treatment', section: 'S' },
  { code: '96040', description: 'Physical well-being activities (spa, massage)', section: 'S' },
  { code: '96090', description: 'Other personal service activities n.e.c.', section: 'S' },
];

/**
 * Get MSIC code details by code
 */
export function getMsicByCode(code) {
  return MSIC_CODES.find(m => m.code === code) || null;
}

/**
 * Search MSIC codes by description keyword
 */
export function searchMsic(keyword) {
  const q = keyword.toLowerCase();
  return MSIC_CODES.filter(m =>
    m.description.toLowerCase().includes(q) || m.code.includes(q)
  );
}
