/**
 * Book Now destinations crawled from staging:
 * - Where input: input#location[name="booknow-location-search"]
 * - Airport code: #selectedAirport
 * - Suggestion link text e.g. "Hong Kong International Airport (HKG)"
 * - Currency on lounge price nodes must start with destination currency:
 *   HKG → HKD…, KUL → MYR…, SIN → SGD…
 */

const DESTINATIONS = {
  HKG: {
    code: 'HKG',
    aliases: ['hkg', 'hong kong', 'hong kong international'],
    typeText: 'Hong Kong',
    suggestion: /Hong Kong International Airport\s*\(HKG\)/i,
    selectedValue: /Hong Kong International Airport\s*\(HKG\)/i,
    currency: 'HKD',
    moreAt: /More at HKG/i,
    viewAllProperties: /View all properties in Hong Kong International Airport/i,
    visitAllLounges: /Visit All Lounges in Hong Kong/i,
  },
  KUL: {
    code: 'KUL',
    aliases: ['kul', 'kuala lumpur', 'kuala lumpur international'],
    typeText: 'Kuala Lumpur',
    suggestion: /Kuala Lumpur International Airport\s*\(KUL\)/i,
    selectedValue: /Kuala Lumpur International Airport\s*\(KUL\)/i,
    // Book Now price currency code only (amount ignored).
    currency: 'MYR',
    moreAt: /More at KUL/i,
    viewAllProperties: /View all properties in Kuala Lumpur International Airport/i,
    visitAllLounges: /Visit All Lounges in Kuala Lumpur/i,
  },
  SIN: {
    code: 'SIN',
    aliases: ['sin', 'singapore', 'changi', 'singapore changi'],
    typeText: 'Singapore',
    suggestion: /Singapore Changi Airport\s*\(SIN\)/i,
    selectedValue: /Singapore Changi Airport\s*\(SIN\)/i,
    // Book Now price currency code only (amount ignored).
    currency: 'SGD',
    moreAt: /More at SIN/i,
    viewAllProperties: /View all properties in Singapore Changi Airport/i,
    visitAllLounges: /Visit All Lounges in Singapore/i,
  },
};

function resolveDestination(input) {
  const raw = String(input || '').trim();
  if (!raw) {
    throw new Error('Destination is required (HKG, KUL, SIN, or airport name)');
  }

  const key = raw.toUpperCase();
  if (DESTINATIONS[key]) return DESTINATIONS[key];

  const lowered = raw.toLowerCase();
  const match = Object.values(DESTINATIONS).find(
    (d) =>
      d.aliases.some((a) => lowered === a || lowered.includes(a)) ||
      d.selectedValue.test(raw) ||
      d.suggestion.test(raw),
  );
  if (match) return match;

  throw new Error(
    `Unknown destination "${input}". Supported: ${Object.keys(DESTINATIONS).join(', ')}`,
  );
}

module.exports = { DESTINATIONS, resolveDestination };
