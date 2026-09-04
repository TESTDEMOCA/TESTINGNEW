const LMS_HKG_GATES = ['1', '35', '60'];

/**
 * Shared LMS gate helpers used by all booking features (TC01–TC04, Locations).
 * Captured gate drives LMS outlet change: HKG - PPL - G1 / G35 / G60.
 */

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

/**
 * Capture "Near Gate 1/35/60" from the current page and store on world.lmsGate.
 * A successful capture overwrites a previous value (lounge detail beats search widget).
 * @param {object} world
 * @param {{ captureGateNumber: (timeout?: number) => Promise<string|null> }} pageObj
 * @param {string} source
 * @param {number} [timeout]
 */
async function captureAndSetLmsGate(world, pageObj, source, timeout = 8_000) {
  if (!pageObj || typeof pageObj.captureGateNumber !== 'function') {
    return world.lmsGate || null;
  }
  const gate = await pageObj.captureGateNumber(timeout);
  if (setLmsGate(world, gate, source)) {
    return world.lmsGate;
  }
  if (LMS_HKG_GATES.includes(String(world.lmsGate || ''))) {
    console.log(`[gate] Keep existing LMS gate ${world.lmsGate} (no new capture at ${source})`);
    return world.lmsGate;
  }
  console.log(`[gate] No LMS gate captured at ${source}`);
  return null;
}

module.exports = { LMS_HKG_GATES, setLmsGate, captureAndSetLmsGate };
