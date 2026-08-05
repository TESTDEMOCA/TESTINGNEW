const { randomInt, randomUUID } = require('crypto');

function generateTestData() {
  const token = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  const stamp = Date.now().toString().slice(-6);

  return {
    token,
    uniqueName: `AUTO-${stamp}-${token.slice(0, 4)}`,
    email: `auto.${token.toLowerCase()}@example.com`,
    phone: String(randomInt(7000000000, 9999999999)),
    address: `Address-${token}`,
    notes: `Automation note ${token}`,
    booking: {
      date: '',
      time: '1700',
      adults: 1,
      children: 0,
      promoCode: '',
    },
    guest: {
      title: 'Mr.',
      firstName: 'TESTING',
      lastName: 'DEMO',
      country: '102',
      phone: '7788994455',
      email: 'test@dummy1234.com',
      flight: 'Cathay Pacific (CX)',
      flightNumber: '123',
    },
    payment: {
      number: '3700 000000 00002',
      expiry: '03/30',
      cvc: '7373',
      name: 'TEST',
    },
  };
}

module.exports = { generateTestData };
