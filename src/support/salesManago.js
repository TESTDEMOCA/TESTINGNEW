/**
 * SalesManago notification can appear on any PPL page (main frame or iframe).
 * Close via #smt-close-icon when present, then proceed.
 */

const SMT_CLOSE =
  '#smt-close-icon, a.smt-close, a.smt-close-icon, .smt-close-icon, .nxt-blank-state-close, #webmessagemodalbody a#smt-close-icon';

function salesManagoCloserScript() {
  if (window.__smtCloserInstalled) return;
  window.__smtCloserInstalled = true;
  const clickClose = () => {
    document.querySelectorAll(
      '#smt-close-icon, a.smt-close, a.smt-close-icon, .smt-close-icon, .nxt-blank-state-close, #webmessagemodalbody a#smt-close-icon',
    ).forEach((el) => {
      try {
        el.click();
      } catch (_) {
        /* ignore */
      }
    });
    const body = document.getElementById('webmessagemodalbody');
    if (body) {
      body.style.setProperty('display', 'none', 'important');
      body.style.setProperty('pointer-events', 'none', 'important');
    }
  };
  const start = () => {
    clickClose();
    new MutationObserver(clickClose).observe(document.documentElement, {
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

async function clickSalesManagoClose(page) {
  if (!page) return false;

  const clicked = await page
    .evaluate(() => {
      const nodes = document.querySelectorAll(
        '#webmessagemodalbody #smt-close-icon, #smt-close-icon, a.smt-close, a.smt-close-icon',
      );
      let n = 0;
      nodes.forEach((el) => {
        try {
          el.click();
          n += 1;
        } catch (_) {
          /* ignore */
        }
      });
      const body = document.getElementById('webmessagemodalbody');
      if (body) {
        body.style.setProperty('display', 'none', 'important');
        body.style.setProperty('pointer-events', 'none', 'important');
        const wrap = body.closest('.modal, [id*="smt"], [class*="webmessage"]');
        if (wrap) {
          wrap.style.setProperty('display', 'none', 'important');
          wrap.style.setProperty('pointer-events', 'none', 'important');
        }
      }
      return n;
    })
    .catch(() => 0);

  if (clicked) {
    console.log('[overlay] Clicked SalesManago close');
    return true;
  }

  const close = page.locator(SMT_CLOSE).first();
  if ((await close.count().catch(() => 0)) > 0) {
    await close.click({ force: true, timeout: 2_000 }).catch(() => {});
    console.log('[overlay] Clicked SalesManago close');
    return true;
  }
  for (const frame of page.frames()) {
    const framed = frame.locator(SMT_CLOSE).first();
    if ((await framed.count().catch(() => 0)) > 0) {
      await framed.click({ force: true, timeout: 2_000 }).catch(() => {});
      await frame
        .evaluate(() => {
          const el = document.querySelector('#smt-close-icon, #webmessagemodalbody #smt-close-icon');
          if (el) el.click();
          const body = document.getElementById('webmessagemodalbody');
          if (body) body.style.setProperty('display', 'none', 'important');
        })
        .catch(() => {});
      console.log('[overlay] Clicked SalesManago close in iframe');
      return true;
    }
  }
  return false;
}

async function installSalesManagoAutoClose(page) {
  if (!page || page._smtAutoClose) return;
  page._smtAutoClose = true;
  await page.addInitScript(salesManagoCloserScript);
  await page.evaluate(salesManagoCloserScript).catch(() => {});
  await page
    .addLocatorHandler(page.locator(SMT_CLOSE), async (locator) => {
      console.log('[overlay] Auto-closed SalesManago (#smt-close-icon)');
      await locator.click({ force: true }).catch(() => {});
    })
    .catch(() => {});
}

module.exports = {
  SMT_CLOSE,
  clickSalesManagoClose,
  installSalesManagoAutoClose,
};
