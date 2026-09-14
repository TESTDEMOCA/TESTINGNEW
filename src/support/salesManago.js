/**
 * SalesManago / marketing notification can appear on any PPL page (main frame or iframe).
 * Click the popup X when present, then hide leftover notification shells so they
 * cannot intercept clicks (lounge-detail promos keep the close control inside the iframe).
 */

const SMT_CLOSE =
  '#smt-close-icon, a.smt-close, a.smt-close-icon, .smt-close-icon, .nxt-blank-state-close, #webmessagemodalbody a#smt-close-icon';

const MARKETING_SHELL =
  '#st_notification_banner, #st_notification_modal, [id^="st_notification"], iframe.st_preview_frame_modal, iframe.st_preview_frame_banner, iframe[id^="preview-notification-frame"], #smt-overlay, [smtmsgid], #webmessagemodalbody, iframe[title="Close message"]';

function salesManagoCloserScript() {
  if (window.__smtCloserInstalled) return;
  window.__smtCloserInstalled = true;
  const dismiss = () => {
    document.querySelectorAll(
      '#smt-close-icon, a.smt-close, a.smt-close-icon, .smt-close-icon, .nxt-blank-state-close, #webmessagemodalbody a#smt-close-icon',
    ).forEach((el) => {
      try {
        el.click();
      } catch (_) {
        /* ignore */
      }
    });
    document.querySelectorAll('iframe').forEach((iframe) => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        doc
          .querySelectorAll(
            '#smt-close-icon, a.smt-close, a.smt-close-icon, .smt-close-icon, .nxt-blank-state-close',
          )
          .forEach((el) => {
            try {
              el.click();
            } catch (_) {
              /* ignore */
            }
          });
      } catch (_) {
        /* cross-origin */
      }
    });
    document
      .querySelectorAll(
        '#st_notification_banner, #st_notification_modal, [id^="st_notification"], iframe.st_preview_frame_modal, iframe.st_preview_frame_banner, iframe[id^="preview-notification-frame"], #smt-overlay, [smtmsgid], #webmessagemodalbody, iframe[title="Close message"]',
      )
      .forEach((el) => {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
      });
  };
  const start = () => {
    dismiss();
    new MutationObserver(dismiss).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}

function checkOutClickableScript() {
  const isVisible = (el) => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const matches = (el) => /^Check Out$/i.test(text(el)) && isVisible(el);
  const preferred =
    [...document.querySelectorAll('button.btn.btn-primary.fullWidth.reserve-now-btn')].find(
      matches,
    ) || document.querySelector('button.js-minicart-checkout-upsell[data-guest-checkout-url]');
  if (matches(preferred)) return true;
  const confirm = [
    ...document.querySelectorAll(
      'a.btn.btn-primary.bookingBtn.mobile.mobile-reserve-now-btn, a.mobile-reserve-now-btn',
    ),
  ].find((el) => /confirm\s*&\s*proceed/i.test(text(el)) && isVisible(el));
  if (confirm) return true;
  return [...document.querySelectorAll('button')].some(matches);
}

async function isCheckOutClickable(page) {
  if (!page) return false;
  return page.evaluate(checkOutClickableScript).catch(() => false);
}

function isMarketingFrame(frame, page) {
  if (!frame) return false;
  if (frame === page.mainFrame()) return true;
  const url = frame.url() || '';
  const name = frame.name() || '';
  return /salesmanago|st_preview|preview-notification|smt|webmessage/i.test(`${url} ${name}`);
}

async function clickSalesManagoClose(page) {
  if (!page) return false;

  // Mini-cart Check Out is ready — do not scan iframes (stalls PWDEBUG and can close the cart).
  if (await isCheckOutClickable(page)) {
    return false;
  }

  let clicked = false;
  if (!/\/payment|adyen/i.test(page.url() || '')) {
    for (const frame of page.frames()) {
      if (!isMarketingFrame(frame, page)) continue;
      const close = frame.locator(SMT_CLOSE).first();
      if (await close.isVisible({ timeout: 250 }).catch(() => false)) {
        await close.click({ force: true, timeout: 1_500 }).catch(() => {});
        clicked = true;
      }
    }
  }

  const closeIframe = page.locator('iframe[title="Close message"]').first();
  if (await closeIframe.isVisible({ timeout: 300 }).catch(() => false)) {
    await closeIframe.click({ force: true, timeout: 1_000 }).catch(() => {});
    clicked = true;
  }

  const hidden = await page
    .evaluate((shellSel) => {
      const nodes = document.querySelectorAll(
        '#webmessagemodalbody #smt-close-icon, #smt-close-icon, a.smt-close, a.smt-close-icon, .smt-close-icon',
      );
      let clicks = 0;
      nodes.forEach((el) => {
        try {
          el.click();
          clicks += 1;
        } catch (_) {
          /* ignore */
        }
      });
      document.querySelectorAll('iframe').forEach((iframe) => {
        try {
          const doc = iframe.contentDocument;
          if (!doc) return;
          doc
            .querySelectorAll(
              '#smt-close-icon, a.smt-close, a.smt-close-icon, .smt-close-icon',
            )
            .forEach((el) => {
              try {
                el.click();
                clicks += 1;
              } catch (_) {
                /* ignore */
              }
            });
        } catch (_) {
          /* cross-origin */
        }
      });
      let shells = 0;
      document.querySelectorAll(shellSel).forEach((el) => {
        const style = window.getComputedStyle(el);
        const shown =
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.pointerEvents !== 'none';
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        if (shown) shells += 1;
      });
      return { clicks, shells };
    }, MARKETING_SHELL)
    .catch(() => ({ clicks: 0, shells: 0 }));

  if (clicked || hidden.clicks || hidden.shells) {
    console.log('[overlay] Closed marketing popup');
    return true;
  }

  return false;
}

async function installSalesManagoAutoClose(page) {
  if (!page || page._smtAutoClose) return;
  page._smtAutoClose = true;
  await page.addInitScript(salesManagoCloserScript);
  await page.evaluate(salesManagoCloserScript).catch(() => {});
  // Do not use addLocatorHandler for #smt-close-icon: in PWDEBUG it pauses on
  // Query count even when mini-cart Check Out is already clickable.
}

module.exports = {
  SMT_CLOSE,
  isCheckOutClickable,
  clickSalesManagoClose,
  installSalesManagoAutoClose,
};
