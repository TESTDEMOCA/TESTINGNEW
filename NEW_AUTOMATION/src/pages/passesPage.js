const { expect } = require('@playwright/test');
const { BasePage } = require('./basePage');

class PassesPage extends BasePage {
  static #toNumber(value) {
    if (!value) return null;
    const numeric = String(value).replace(/[^\d.,-]/g, '').replace(/,/g, '');
    if (!numeric) return null;
    const parsed = Number(numeric);
    return Number.isFinite(parsed) ? parsed : null;
  }

  static #escapeRegex(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async navigateToPasses() {
    await expect(
      this.page.getByRole('link', { name: /^Passes$/i }).or(
        this.page.getByRole('button', { name: /^Passes$/i }),
      ).first(),
    ).toBeVisible({ timeout: 30_000 });
    await this.page
      .getByRole('link', { name: /^Passes$/i })
      .or(this.page.getByRole('button', { name: /^Passes$/i }))
      .first()
      .click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  // Returns the first visible pass card's add-to-cart button
  #addToCartButton() {
    return this.page
      .locator('button.btn.btn-primary.fullWidth, button.btn-primary.fullWidth')
      .filter({ hasText: /^Add to Cart$/i })
      .or(this.page.getByRole('button', { name: /^Add to Cart$/i }))
      .first();
  }

  /** Smart Traveller–only tiles: badge image + Exclusive button. */
  #smartTravellerBadgeImg() {
    return this.page.locator(
      'img[src*="smarttraveller-badge.png"], img[src*="smarttraveller-badge"]',
    );
  }

  #exclusiveSmartTravellerButtonIn(scope = this.page) {
    return scope
      .locator('div.btn-wrapper button.btn.btn-primary.fullWidth, button.btn.btn-primary.fullWidth, button')
      .filter({ hasText: /Exclusive to Smart Traveller Only/i });
  }

  #smartTravellerPassCard() {
    const badge = this.#smartTravellerBadgeImg();
    const exclusive = this.page
      .locator('button')
      .filter({ hasText: /Exclusive to Smart Traveller Only/i });

    // Prefer real product tiles over large page wrappers.
    const preferred = this.page
      .locator('.col, article, .card, .pass-card, li, section, [class*="pass"]')
      .filter({ has: badge })
      .filter({ has: exclusive });

    return preferred.first();
  }

  async #capturePassDetailsFromCard(card) {
    const nameEl = card.locator('h4.pass').first();
    const priceEl = card
      .locator('[class*="price"]')
      .filter({ hasText: /[A-Z]{3}\s*[\d,.]|[\d,.]+/ })
      .first();

    const name = await nameEl.textContent({ timeout: 10_000 }).catch(() => null);
    const price = await priceEl.textContent({ timeout: 10_000 }).catch(() => null);

    return {
      name: name ? name.trim() : null,
      price: price ? price.trim() : null,
    };
  }

  /**
   * Select a Smart Traveller–only pass tile (badge visible) and click
   * "Exclusive to Smart Traveller Only" (typically opens the login modal).
   */
  async selectMemberOnlyPass() {
    await this.waitBeforeTransition();

    // Wait until at least one Smart Traveller exclusive tile is present.
    await expect(this.#smartTravellerBadgeImg().first()).toBeVisible({ timeout: 60_000 });
    await expect(this.#exclusiveSmartTravellerButtonIn().first()).toBeVisible({ timeout: 60_000 });

    let card = this.#smartTravellerPassCard();
    if (!(await card.isVisible({ timeout: 3_000 }).catch(() => false))) {
      // Fallback: any ancestor of an Exclusive button that also contains the badge.
      card = this.page
        .locator('div')
        .filter({ has: this.#smartTravellerBadgeImg() })
        .filter({
          has: this.page.locator('button').filter({ hasText: /Exclusive to Smart Traveller Only/i }),
        })
        .last();
    }

    await expect(card).toBeVisible({ timeout: 30_000 });

    const details = await this.#capturePassDetailsFromCard(card);
    console.log(
      `[passes] Selecting Smart Traveller pass — name: "${details.name}", price: "${details.price}"`,
    );

    const exclusiveBtn = this.#exclusiveSmartTravellerButtonIn(card).first();
    await expect(exclusiveBtn).toBeVisible({ timeout: 30_000 });
    await exclusiveBtn.scrollIntoViewIfNeeded().catch(() => {});
    await exclusiveBtn.click();

    console.log('[passes] Clicked "Exclusive to Smart Traveller Only"');
    return details;
  }

  #passCardByDetails(details = {}) {
    if (details?.name) {
      const nameRe = new RegExp(PassesPage.#escapeRegex(String(details.name).trim()), 'i');
      return this.page
        .locator('article, .card, .pass-card, li, section, div')
        .filter({ hasText: nameRe })
        .first();
    }
    return this.page.locator('article, .card, .pass-card, li, section, div').first();
  }

  async #findAddButtonForSamePass(details = {}) {
    if (!details?.name) return this.#addToCartButton();

    const nameRe = new RegExp(PassesPage.#escapeRegex(String(details.name).trim()), 'i');
    // After a pass is already in the cart its button text changes from "Add to Cart" to "Add More".
    const addMoreBtn = () => this.page.locator('button').filter({ hasText: /Add More/i });

    const containerSelectors = ['article', 'li', '[class*="pass-card"]', '[class*="card"]', '.col', 'section', 'div'];

    for (const sel of containerSelectors) {
      const candidates = this.page
        .locator(sel)
        .filter({ hasText: nameRe })
        .filter({ has: addMoreBtn() });

      const candidateCount = await candidates.count();
      for (let i = 0; i < candidateCount; i++) {
        const card = candidates.nth(i);
        // Exactly one "Add More" button means this is a single pass card, not a parent wrapper.
        const btnsInCard = await card.locator('button').filter({ hasText: /Add More/i }).count();
        if (btnsInCard !== 1) continue;

        const btn = card.locator('button').filter({ hasText: /Add More/i }).first();
        if (await btn.isVisible({ timeout: 1_000 }).catch(() => false)) {
          console.log(`[passes] Found "Add More" button inside "${sel}" for "${details.name}"`);
          return btn;
        }
      }
    }

    // Direct search without container scoping as last resort
    const directBtn = this.page.locator('button').filter({ hasText: /Add More/i }).first();
    if (await directBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      console.log(`[passes] Found "Add More" button via direct search for "${details.name}"`);
      return directBtn;
    }

    console.log(`[passes] "Add More" button not found for "${details?.name}", falling back to first "Add to Cart"`);
    return this.#addToCartButton();
  }

  async #tryOpenMiniCart() {
    const checkOutButton = this.page
      .locator('[data-guest-checkout-url="/en-uk/guest-checkout"]')
      .or(this.page.getByRole('button', { name: /^Check Out$/i }))
      .first();

    if (await checkOutButton.isVisible({ timeout: 1_000 }).catch(() => false)) return true;

    const toggles = [
      this.page.locator('button[aria-label*="cart" i], a[aria-label*="cart" i]').first(),
      this.page
        .locator(
          'button[id*="minicart" i], a[id*="minicart" i], button[class*="minicart" i], a[class*="minicart" i]',
        )
        .first(),
      this.page
        .locator('button[class*="cart" i], a[class*="cart" i]')
        .filter({ hasNotText: /check\s*out/i })
        .first(),
    ];

    for (const toggle of toggles) {
      if (await toggle.isVisible({ timeout: 1_500 }).catch(() => false)) {
        await toggle.click().catch(() => {});
        if (await checkOutButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
          return true;
        }
      }
    }

    return checkOutButton.isVisible({ timeout: 2_000 }).catch(() => false);
  }

  async #dismissBlockingNotice() {
    const ok = this.page.locator('button').filter({ hasText: /^OK$/i }).first();
    if (await ok.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await ok.click().catch(() => {});
      await this.page.waitForTimeout(500);
    }

    const notice = this.page.getByText(/Notice/i).first();
    if (await notice.isVisible({ timeout: 500 }).catch(() => false)) {
      await this.page.keyboard.press('Escape').catch(() => {});
      await this.page.waitForTimeout(250);
    }

    await this.page.evaluate(() => {
      document.querySelectorAll('.modal.show, .modal-backdrop, .swal2-container, [role="dialog"]').forEach((el) => {
        if ('remove' in el) el.remove();
        else el.style.display = 'none';
      });
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-right');
    });
  }

  async captureFirstPassDetails() {
    // H4.pass holds the pass product name; price element uses a currency pattern
    const nameEl = this.page.locator('h4.pass').first();
    const priceEl = this.page
      .locator('[class*="price"]')
      .filter({ hasText: /[A-Z]{3}\s*[\d,.]|[\d,.]+/ })
      .first();

    const name = await nameEl.textContent({ timeout: 10_000 }).catch(() => null);
    const price = await priceEl.textContent({ timeout: 10_000 }).catch(() => null);

    return {
      name: name ? name.trim() : null,
      price: price ? price.trim() : null,
    };
  }

  async addFirstPassToCart() {
    await this.waitBeforeTransition();
    const addBtn = this.#addToCartButton();
    await expect(addBtn).toBeVisible({ timeout: 60_000 });

    // Capture details before clicking so we can verify on confirmation page
    const details = await this.captureFirstPassDetails();
    console.log(`[passes] Adding pass — name: "${details.name}", price: "${details.price}"`);

    await addBtn.click();

    // Wait for mini-cart or cart indicator to update
    await expect(
      this.page
        .locator('[data-guest-checkout-url="/en-uk/guest-checkout"]')
        .or(this.page.getByRole('button', { name: 'Check Out' }))
        .or(this.page.getByRole('heading', { name: /cart/i }))
        .first(),
    ).toBeVisible({ timeout: 60_000 });

    console.log('[passes] Pass added to cart — Check Out is visible');
    return details;
  }

  async closeMiniCartAndAddAnotherPass(existingProducts = []) {
    await this.#dismissBlockingNotice();

    const checkOutButton = this.page
      .locator('[data-guest-checkout-url="/en-uk/guest-checkout"]')
      .or(this.page.getByRole('button', { name: /^Check Out$/i }))
      .first();

    const miniCartRoot = checkOutButton.locator('xpath=ancestor::*[self::aside or self::div][1]').first();
    const closeCandidates = [
      miniCartRoot
        .locator(
          'button[aria-label*="close" i], button[title*="close" i], .btn-close, .close, [class*="close"] button',
        )
        .first(),
      this.page
        .locator('button[aria-label*="close" i], button[title*="close" i]')
        .filter({ hasNotText: /^Check Out$/i })
        .first(),
      this.page.locator('div:has-text("Cart") button').first(),
    ];

    let closeAttempted = false;
    for (const candidate of closeCandidates) {
      if (await candidate.isVisible({ timeout: 1_500 }).catch(() => false)) {
        await candidate.click().catch(() => {});
        closeAttempted = true;
        break;
      }
    }

    if (!closeAttempted) {
      await this.page.keyboard.press('Escape').catch(() => {});
    }

    // Some environments keep the mini-cart open; don't hard-fail if add-to-cart is still actionable.
    const becameHidden = await checkOutButton
      .isHidden({ timeout: 5_000 })
      .catch(() => false);
    if (!becameHidden) {
      await this.page.keyboard.press('Escape').catch(() => {});
    }

    await this.waitBeforeTransition();
    const previousPass = existingProducts[0] || null;

    // Always navigate back to a fresh passes listing so we find the correct card, not mini-cart DOM.
    await this.navigateToPasses();

    // Cart may auto-open after navigation since it already has an item — close it before searching.
    await this.#dismissBlockingNotice();
    const miniCartAfterNav = this.page
      .locator('[data-guest-checkout-url="/en-uk/guest-checkout"]')
      .or(this.page.getByRole('button', { name: /^Check Out$/i }))
      .first();
    if (await miniCartAfterNav.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await this.page.keyboard.press('Escape').catch(() => {});
      await miniCartAfterNav.isHidden({ timeout: 3_000 }).catch(() => {});
    }

    const addBtn = await this.#findAddButtonForSamePass(previousPass || {});
    await expect(addBtn).toBeVisible({ timeout: 30_000 });

    // secondPass is always the same object as previousPass to guarantee identical name/price
    const secondPass = previousPass || (await this.captureFirstPassDetails());
    console.log(
      `[passes] Adding second (same) pass — name: "${secondPass.name}", price: "${secondPass.price}"`,
    );

    await addBtn.click({ force: true });

    // Retry opening the mini-cart so Check Out is visible before the checkout step runs.
    await this.#dismissBlockingNotice();
    for (let attempt = 0; attempt < 3; attempt++) {
      if (await checkOutButton.isVisible({ timeout: 6_000 }).catch(() => false)) break;
      console.log(`[passes] Check Out not visible after second add (attempt ${attempt + 1}/3) — retrying open`);
      await this.#tryOpenMiniCart();
      await this.waitBeforeTransition();
    }

    return [...existingProducts, secondPass];
  }

  async verifyConfirmationDetails(expected = {}) {
    const products = Array.isArray(expected)
      ? expected
      : Array.isArray(expected.products)
        ? expected.products
        : expected && (expected.name || expected.price)
          ? [expected]
          : [];
    const orderNo = expected.orderNo ? String(expected.orderNo).trim() : '';

    // Passes flow shows "Pass Confirmed" heading on the confirmation page
    await expect(
      this.page.getByRole('heading', { name: /Pass Confirmed/i }).first(),
    ).toBeVisible({ timeout: 30_000 });
    console.log('[passes] "Pass Confirmed" heading verified');

    const pageText = await this.page.evaluate(() => document.body.innerText || '');

    if (orderNo) {
      // Order No may be in DOM but CSS-hidden / off-screen; assert attached + page text.
      const orderNoEl = this.page
        .locator('div.order-no, .order-no')
        .filter({ hasText: orderNo })
        .or(this.page.getByText(new RegExp(`Order\\s*No\\s*:?\\s*${PassesPage.#escapeRegex(orderNo)}`, 'i')))
        .first();
      await expect(orderNoEl).toBeAttached({ timeout: 15_000 });
      if (!new RegExp(PassesPage.#escapeRegex(orderNo), 'i').test(pageText)) {
        throw new Error(`Order No "${orderNo}" not found in confirmation page text`);
      }
      console.log(`[passes] Confirmed Order No on confirmation page: ${orderNo}`);
    }
    const isMultiPassFlow = products.length >= 2;

    for (const product of products) {
      if (!isMultiPassFlow && product?.price) {
        const numericPrice = String(product.price).replace(/[^\d.]/g, '');
        if (numericPrice && !pageText.includes(numericPrice)) {
          throw new Error(`Price "${product.price}" not found on confirmation page`);
        }
        if (numericPrice) {
          console.log(`[passes] Confirmed price ${product.price} present on confirmation page`);
        }
      }

      if (product?.name) {
        const shortName = String(product.name).split(/\s+/).slice(0, 4).join(' ');
        const nameRe = new RegExp(PassesPage.#escapeRegex(shortName), 'i');
        if (!nameRe.test(pageText)) {
          throw new Error(`Pass name "${product.name}" not found on confirmation page`);
        }
        console.log(`[passes] Confirmed product "${shortName}" visible on confirmation page`);
      }
    }

    if (isMultiPassFlow) {
      const uniqueNames = [...new Set(products.map((p) => p?.name).filter(Boolean))];
      if (uniqueNames.length === 1) {
        const expectedQty = products.length;
        // Confirmation page shows e.g. "Quantity 2" for two of the same pass
        const qtyPatterns = [
          new RegExp(`Quantity\\s*:?\\s*${expectedQty}\\b`, 'i'),
          new RegExp(`Qty\\s*:?\\s*${expectedQty}\\b`, 'i'),
          new RegExp(`${expectedQty}\\s*[x×]`, 'i'),
          new RegExp(`[x×]\\s*${expectedQty}\\b`, 'i'),
          new RegExp(`\\b${expectedQty}\\s+pass`, 'i'),
        ];
        const qtyFound = qtyPatterns.some((re) => re.test(pageText));
        if (!qtyFound) {
          throw new Error(
            `Expected quantity ${expectedQty} for pass "${uniqueNames[0]}" was not found on confirmation page`,
          );
        }
        console.log(`[passes] Confirmed quantity ${expectedQty} for repeated pass on confirmation page`);
      }
    }

    const numericPrices = products
      .map((p) => PassesPage.#toNumber(p?.price))
      .filter((p) => Number.isFinite(p));
    if (numericPrices.length >= 2) {
      const expectedTotal = numericPrices.reduce((sum, price) => sum + price, 0);
      const compactPageText = pageText.replace(/[\s,]/g, '');
      const totalCandidates = [
        expectedTotal.toFixed(2),
        String(Math.round(expectedTotal)),
        expectedTotal.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          useGrouping: true,
        }),
      ].map((value) => value.replace(/[\s,]/g, ''));

      const hasExpectedTotal = totalCandidates.some((candidate) => compactPageText.includes(candidate));
      if (!hasExpectedTotal) {
        throw new Error(
          `Expected total amount ${expectedTotal.toFixed(2)} (sum of added passes) was not found on confirmation page`,
        );
      }

      // Prefer explicit Total Paid label when present (Pass Confirmed page)
      const totalPaidRe = new RegExp(
        `Total\\s*Paid[\\s\\S]{0,40}${PassesPage.#escapeRegex(expectedTotal.toFixed(2))}`,
        'i',
      );
      if (totalPaidRe.test(pageText)) {
        console.log(`[passes] Confirmed Total Paid ${expectedTotal.toFixed(2)} on confirmation page`);
      } else {
        console.log(
          `[passes] Confirmed combined amount ${expectedTotal.toFixed(2)} present on confirmation page`,
        );
      }
    }

    // Backward compatibility for old callers that pass a single object.
    if (!products.length && expected.price) {
      const numericPrice = String(expected.price).replace(/[^\d.]/g, '');
      if (numericPrice && !pageText.includes(numericPrice)) {
        throw new Error(`Price "${expected.price}" not found on confirmation page`);
      }
      if (numericPrice) {
        console.log(`[passes] Confirmed price ${expected.price} present on confirmation page`);
      }
    }

    if (!products.length && expected.name) {
      const shortName = String(expected.name).split(/\s+/).slice(0, 4).join(' ');
      const nameRe = new RegExp(PassesPage.#escapeRegex(shortName), 'i');
      if (!nameRe.test(pageText)) {
        throw new Error(`Pass name "${expected.name}" not found on confirmation page`);
      }
      console.log(`[passes] Confirmed product "${shortName}" visible on confirmation page`);
    }
  }
}

module.exports = { PassesPage };
