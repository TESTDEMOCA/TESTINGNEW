/**
 * AMS staging order-summary lookup used before LMS booking search.
 * Captures orderId (e.g. HKBC-10218-62HVQP) and the numeric segment only (10218).
 */

const DEFAULT_AMS_BASE = 'https://ams-stg-api.allwaysvip.com';

function extractNumericOrderCode(orderId) {
  const raw = String(orderId || '').trim();
  if (!raw) {
    throw new Error('AMS orderId is empty — cannot extract numeric code');
  }
  const hyphenNumber = raw.split('-').find((part) => /^\d+$/.test(part));
  if (hyphenNumber) return hyphenNumber;
  const match = raw.match(/(\d+)/);
  if (match) return match[1];
  throw new Error(`AMS orderId "${raw}" has no numeric segment to capture`);
}

function readOrderIdFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return '';
  if (typeof payload.orderId === 'string' && payload.orderId.trim()) return payload.orderId.trim();
  if (payload.data && typeof payload.data.orderId === 'string') return payload.data.orderId.trim();
  if (payload.order && typeof payload.order.orderId === 'string') return payload.order.orderId.trim();
  if (typeof payload.orderID === 'string') return payload.orderID.trim();
  return '';
}

function readOrderIdFromText(text) {
  const match = String(text || '').match(/"orderId"\s*:\s*"([^"]+)"/i);
  return match ? match[1].trim() : '';
}

async function fetchAmsOrderSummary({ orderNo, firstName, clientKey, baseUrl }) {
  const bookingId = String(orderNo || '').trim();
  if (!bookingId) {
    throw new Error('No captured booking id to fetch AMS order summary');
  }
  const key = String(clientKey || '').trim();
  if (!key) {
    throw new Error('Set AMS_CLIENT_KEY in `.env` (clientkey JWT for ams-stg-api).');
  }

  const name = encodeURIComponent(String(firstName || 'test').trim() || 'test');
  const root = String(baseUrl || DEFAULT_AMS_BASE).replace(/\/$/, '');
  const url = `${root}/asopbooking/v1/orders/${encodeURIComponent(bookingId)}/summary?locale=en&firstName=${name}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
      clientkey: key,
      origin: 'https://uat-booking.plazapremiumlounge.com',
      referer: 'https://uat-booking.plazapremiumlounge.com/',
      'x-teco-client-key': 'clientKey',
      'x-teco-partner-code': 'PPL',
      'x-teco-user-id': 'userId',
      'x-teco-version': 'consumerApp',
    },
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(
      `AMS order summary failed (${res.status}) for ${bookingId}: ${bodyText.slice(0, 300)}`,
    );
  }

  let payload = null;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    payload = null;
  }

  const amsOrderId = readOrderIdFromPayload(payload) || readOrderIdFromText(bodyText);
  if (!amsOrderId) {
    throw new Error(`AMS summary for ${bookingId} did not include orderId. Body: ${bodyText.slice(0, 300)}`);
  }

  const amsOrderNumber = extractNumericOrderCode(amsOrderId);
  const orderItem = readFirstOrderItem(payload);
  return { amsOrderId, amsOrderNumber, payload, orderItem };
}

function readFirstOrderItem(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const items = payload.orderItems || payload.data?.orderItems;
  if (Array.isArray(items) && items.length) return items[0];
  return null;
}

module.exports = {
  DEFAULT_AMS_BASE,
  extractNumericOrderCode,
  fetchAmsOrderSummary,
  readFirstOrderItem,
};
