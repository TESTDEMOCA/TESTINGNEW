const LMS_HKG_GATES = ['1', '35', '60'];

/**
 * Shared location/LMS helpers used by all booking features (TC01–TC04, Locations).
 * The full lounge location string is captured once and matched as a whole later.
 * Gate digits are derived from that stored context only for HKG LMS outlets.
 */

function normalizeLocationContext(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {object} world
 * @param {'1'|'35'|'60'|string|null|undefined} gate
 * @param {string} source
 */
function setLmsGate(world, gate, source = 'unknown') {
  const gateNum = String(gate || '').replace(/\D/g, '');
  if (!LMS_HKG_GATES.includes(gateNum)) return false;
  world.lmsGate = gateNum;
  console.log(`[gate] Set LMS gate ${gateNum} from ${source}`);
  return true;
}

function gateFromLocationContext(locationText) {
  const match = String(locationText || '').match(/Gate\s*(\d+)/i);
  return match ? match[1] : '';
}

/**
 * Capture the full location context (airport / hall / gate copy) and store it.
 * Later calls must match that same whole string — not a Gate-number regex.
 * @param {object} world
 * @param {{
 *   captureLoungeLocationContext?: (timeout?: number, expected?: string|null) => Promise<string|null>,
 *   matchLoungeLocationContext?: (expected: string, timeout?: number) => Promise<string|null>,
 *   captureGateNumber?: (timeout?: number) => Promise<string|null>,
 * }} pageObj
 * @param {string} source
 * @param {number} [timeout]
 */
async function captureAndSetLmsGate(world, pageObj, source, timeout = 8_000) {
  if (!pageObj) {
    return world.lmsGate || null;
  }

  const stored = normalizeLocationContext(world.bookNowLocationText);
  let locationText = null;

  if (stored && typeof pageObj.matchLoungeLocationContext === 'function') {
    locationText = await pageObj.matchLoungeLocationContext(stored, Math.min(timeout, 2_000));
  } else if (typeof pageObj.captureLoungeLocationContext === 'function') {
    locationText = await pageObj.captureLoungeLocationContext(timeout, stored || null);
  }

  if (!locationText) {
    if (stored) {
      console.log(`[gate] Keep existing location context at ${source}: "${stored}"`);
      return world.lmsGate || null;
    }
    console.log(`[gate] No location context captured at ${source}`);
    return null;
  }

  const got = normalizeLocationContext(locationText);
  if (stored) {
    if (stored !== got) {
      throw new Error(
        `Location context at ${source} does not match captured Book Now location.\n` +
          `Expected: "${stored}"\n` +
          `Actual:   "${got}"`,
      );
    }
    console.log(`[gate] Location context matches at ${source}: "${got}"`);
  } else {
    world.bookNowLocationText = got;
    console.log(`[gate] Captured location context from ${source}: "${got}"`);
  }

  setLmsGate(world, gateFromLocationContext(got), source);
  return world.lmsGate || null;
}

module.exports = {
  LMS_HKG_GATES,
  setLmsGate,
  captureAndSetLmsGate,
  normalizeLocationContext,
  gateFromLocationContext,
};
