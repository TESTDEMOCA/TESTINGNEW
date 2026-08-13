const { expect } = require('@playwright/test');
const { randomInt } = require('crypto');

/**
 * Temporary inbox helper for signup email verification.
 * Flow from fixtures/codegen/tc08-desktop.js (stabilized: invent mailbox, skip ads/clipboard).
 */
class YopmailPage {
  constructor(page) {
    this.page = page;
  }

  static generateMailbox() {
    const stamp = Date.now().toString(36);
    const rand = randomInt(1000, 9999);
    return `pplauto${stamp}${rand}`;
  }

  /**
   * Open Yopmail and land on the inbox for a generated mailbox.
   * @returns {Promise<{ mailbox: string, email: string }>}
   */
  async openGeneratedInbox() {
    const mailbox = YopmailPage.generateMailbox();
    const email = `${mailbox}@yopmail.com`;

    await this.page.goto('https://yopmail.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await this.dismissAdsIfPresent();

    const login = this.page.locator('#login');
    await expect(login).toBeVisible({ timeout: 30_000 });
    await login.fill(mailbox);

    // codegen: getByRole('button', { name: 'Check Inbox' }) — icon-only label may vary
    const checkInbox = this.page
      .locator('#refreshbut')
      .or(this.page.getByRole('button', { name: /Check Inbox/i }))
      .first();
    await checkInbox.click();
    await this.page.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => {});
    await this.dismissAdsIfPresent();

    return { mailbox, email };
  }

  async dismissAdsIfPresent() {
    for (const frame of this.page.frames()) {
      const close = frame.getByRole('button', { name: /Close ad|Close/i }).first();
      if (await close.isVisible({ timeout: 800 }).catch(() => false)) {
        await close.click().catch(() => {});
      }
    }
    const overlayClose = this.page.locator('#dismiss-button, .fc-close, .close-btn').first();
    if (await overlayClose.isVisible({ timeout: 800 }).catch(() => false)) {
      await overlayClose.click().catch(() => {});
    }
  }

  async refreshInbox() {
    await this.dismissAdsIfPresent();
    const refresh = this.page.locator('#refresh');
    await expect(refresh).toBeVisible({ timeout: 30_000 });
    await refresh.click();
    await this.page.waitForTimeout(2_000);
  }

  /**
   * Re-open Yopmail for an existing mailbox and click Check Inbox.
   * @param {string} mailbox
   */
  async openInboxForMailbox(mailbox) {
    if (!mailbox) {
      throw new Error('Yopmail mailbox is required to open the inbox.');
    }

    await this.page.goto('https://yopmail.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await this.dismissAdsIfPresent();

    const login = this.page.locator('#login');
    await expect(login).toBeVisible({ timeout: 30_000 });
    await login.fill(mailbox);

    const checkInbox = this.page
      .locator('#refreshbut')
      .or(this.page.getByRole('button', { name: /Check Inbox/i }))
      .first();
    await checkInbox.click();
    await this.page.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => {});
    await this.dismissAdsIfPresent();
  }

  inboxFrame() {
    return this.page.frameLocator('iframe[name="ifinbox"]');
  }

  mailFrame() {
    return this.page.frameLocator('iframe[name="ifmail"]');
  }

  /**
   * Redirect to Yopmail, refresh inbox, and validate booking confirmation mail:
   * From: PPL UAT <uat.ibe@plazapremiumgroup.com>
   * Subject: Plaza Premium Lounge Booking Confirmation <orderNo>
   *
   * @param {string} mailbox
   * @param {string} orderNo booking id captured from confirmation page
   * @param {{ timeoutMs?: number }} [options]
   */
  async expectBookingConfirmationEmail(mailbox, orderNo, { timeoutMs = 240_000 } = {}) {
    const bookingId = String(orderNo || '').trim();
    if (!bookingId) {
      throw new Error('Booking order number is required to validate the Yopmail confirmation email.');
    }

    // Yopmail inbox list often masks middle chars (e.g. GCBC-STPPT-**ELIF).
    // Match confirmation subject + partial booking id in the list, then assert full id in opened mail.
    const idParts = bookingId.split('-').filter(Boolean);
    const idSuffix = (idParts[idParts.length - 1] || bookingId).slice(-4);
    const idPrefix = bookingId.slice(0, Math.min(11, bookingId.length)); // e.g. GCBC-STPPT
    const maskedIdHint = new RegExp(
      `${idPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[-\\w*]{0,12}${idSuffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      'i',
    );
    const confirmationSubject = /Plaza Premium Lounge Booking Confirmation/i;
    const expectedFrom = /PPL\s*UAT|uat\.ibe@plazapremiumgroup\.com/i;

    // Stay on existing inbox when possible; otherwise reopen mailbox
    const onYopmail = /yopmail\.com/i.test(this.page.url());
    if (!onYopmail) {
      await this.openInboxForMailbox(mailbox);
    } else {
      await this.dismissAdsIfPresent();
    }

    const deadline = Date.now() + timeoutMs;
    let lastInboxSnapshot = '';
    let lastError;

    while (Date.now() < deadline) {
      try {
        await this.refreshInbox();
        await this.dismissAdsIfPresent();

        const inbox = this.inboxFrame();
        lastInboxSnapshot = (
          (await inbox.locator('body').innerText({ timeout: 8_000 }).catch(() => '')) || ''
        ).trim();
        console.log(
          `[yopmail] Inbox refresh snapshot (looking for ${bookingId}): ${lastInboxSnapshot.slice(0, 300).replace(/\s+/g, ' ')}`,
        );

        const hasConfirmationInList =
          confirmationSubject.test(lastInboxSnapshot) &&
          (maskedIdHint.test(lastInboxSnapshot) || lastInboxSnapshot.includes(bookingId));
        const hasFromInList = expectedFrom.test(lastInboxSnapshot);

        if (!hasConfirmationInList || !hasFromInList) {
          lastError = new Error(
            `Booking confirmation not listed yet (need PPL UAT + confirmation subject + ${bookingId} / masked id). Inbox: ${lastInboxSnapshot.slice(0, 240) || '(empty)'}`,
          );
          await this.page.waitForTimeout(4_000);
          continue;
        }

        // Prefer Yopmail message rows (div.m) / subject nodes (.lms)
        const mailRow = inbox
          .locator('div.m')
          .filter({ hasText: confirmationSubject })
          .filter({ hasText: maskedIdHint })
          .or(inbox.locator('div.m').filter({ hasText: confirmationSubject }).filter({ hasText: expectedFrom }))
          .or(inbox.locator('.lms').filter({ hasText: confirmationSubject }))
          .or(inbox.getByText(confirmationSubject))
          .first();

        if (!(await mailRow.isVisible({ timeout: 5_000 }).catch(() => false))) {
          lastError = new Error(
            `Confirmation subject visible in inbox text but row not clickable. Inbox: ${lastInboxSnapshot.slice(0, 240)}`,
          );
          await this.page.waitForTimeout(4_000);
          continue;
        }

        const rowText = ((await mailRow.innerText().catch(() => '')) || '').trim();
        console.log(`[yopmail] Opening candidate mail row: ${rowText.replace(/\s+/g, ' ').slice(0, 180)}`);

        await mailRow.click();
        await this.page.waitForTimeout(1_500);
        await this.dismissAdsIfPresent();

        const mail = this.mailFrame();
        const expectedSubjectText = `Plaza Premium Lounge Booking Confirmation ${bookingId}`;

        // Opened-mail subject line:
        // <div class="ellipsis nw b f18">Plaza Premium Lounge Booking Confirmation GCBC-STPPT-...</div>
        const subjectEl = mail
          .locator('div.ellipsis.nw.b.f18')
          .filter({ hasText: expectedSubjectText });

        await expect(subjectEl).toBeVisible({ timeout: 15_000 });
        const subjectText = ((await subjectEl.first().innerText().catch(() => '')) || '').trim();

        if (!confirmationSubject.test(subjectText)) {
          throw new Error(
            `Opened-mail subject element missing "Plaza Premium Lounge Booking Confirmation". Actual: "${subjectText}"`,
          );
        }
        if (!subjectText.includes(bookingId)) {
          throw new Error(
            `Opened-mail subject does not contain captured booking id ${bookingId}. Actual: "${subjectText}"`,
          );
        }

        // Email body Order No:
        // <td>...<strong>Order No:</strong><br><span>GCBC-STPPT-...</span></td>
        const orderNoCell = mail.locator('td').filter({ hasText: /Order No:/i }).first();
        await expect(orderNoCell).toBeVisible({ timeout: 15_000 });

        const orderNoValue = orderNoCell.locator('span').filter({ hasText: bookingId }).first();
        await expect(orderNoValue).toBeVisible({ timeout: 15_000 });
        const orderNoText = ((await orderNoValue.innerText().catch(() => '')) || '').trim();
        if (orderNoText !== bookingId) {
          throw new Error(
            `Email body Order No does not match captured booking id ${bookingId}. Actual: "${orderNoText}"`,
          );
        }

        const mailText = ((await mail.locator('body').innerText({ timeout: 15_000 }).catch(() => '')) || '').trim();
        const combined = `${rowText}\n${subjectText}\n${mailText}\n${lastInboxSnapshot}`;

        if (!expectedFrom.test(combined)) {
          throw new Error(
            `Booking confirmation found, but sender was not PPL UAT <uat.ibe@plazapremiumgroup.com>. Snippet: ${combined.slice(0, 240)}`,
          );
        }

        console.log(
          `[yopmail] Validated subject "${subjectText}" and body Order No: ${bookingId} (from PPL UAT)`,
        );
        return;
      } catch (err) {
        lastError = err;
        console.log(`[yopmail] Confirmation mail check retry: ${err.message}`);
        await this.page.waitForTimeout(4_000);
      }
    }

    throw new Error(
      `Yopmail did not receive "Plaza Premium Lounge Booking Confirmation ${bookingId}" from PPL UAT in time: ${lastError?.message || 'unknown'}. Last inbox: ${lastInboxSnapshot.slice(0, 300) || '(empty)'}`,
    );
  }

  /**
   * Wait for the Smart Traveller verification mail, open activation link, assert success.
   * @param {import('@playwright/test').BrowserContext} context
   */
  async openActivationLinkAndConfirm(context, { timeoutMs = 180_000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let lastError;

    while (Date.now() < deadline) {
      try {
        await this.refreshInbox();
        await this.dismissAdsIfPresent();

        const mail = this.mailFrame();
        const verifyHint = mail.getByText(/verify your Smart|Account Activation|Hello Smart Traveller/i).first();
        if (!(await verifyHint.isVisible({ timeout: 5_000 }).catch(() => false))) {
          await this.page.waitForTimeout(3_000);
          continue;
        }

        // codegen: getByRole('link', { name: 'https://uat2-arrtureapi.' })
        const activationLink = mail
          .getByRole('link', { name: /https:\/\/.*arrture|activate|verify|confirm/i })
          .or(mail.locator('a[href*="arrture"], a[href*="activat"], a[href*="verify"]'))
          .first();

        await expect(activationLink).toBeVisible({ timeout: 10_000 });

        const popupPromise = context.waitForEvent('page', { timeout: 30_000 }).catch(() => null);
        await activationLink.click();
        let activationPage = await popupPromise;

        if (!activationPage) {
          // Link may navigate same tab or open without popup event timing
          const pages = context.pages();
          activationPage = pages[pages.length - 1];
        }

        await activationPage.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => {});
        await expect(
          activationPage.getByText(/Account Activation Successful/i),
        ).toBeVisible({ timeout: 60_000 });
        await activationPage.close().catch(() => {});
        return;
      } catch (err) {
        lastError = err;
        await this.page.waitForTimeout(4_000);
      }
    }

    throw new Error(
      `Yopmail activation email not found/opened in time: ${lastError?.message || 'unknown'}`,
    );
  }
}

module.exports = { YopmailPage };
