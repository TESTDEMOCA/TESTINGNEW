const { expect } = require('@playwright/test');
const { ActionEngine } = require('../utils/actionEngine');

class BasePage {
  static AFTER_SELECT_SETTLE_MS = 300;
  static TRANSITION_WAIT_MIN_MS = 2_000;
  static TRANSITION_WAIT_MAX_MS = 5_000;

  constructor(page, settings) {
    this.page = page;
    this.settings = settings;
    this.actions = new ActionEngine(page);
  }

  async settle(ms = BasePage.AFTER_SELECT_SETTLE_MS) {
    await this.page.waitForTimeout(ms);
  }

  async waitBeforeTransition(ms) {
    const min = BasePage.TRANSITION_WAIT_MIN_MS;
    const max = BasePage.TRANSITION_WAIT_MAX_MS;
    const delay =
      ms != null
        ? Number(ms)
        : min + Math.floor(Math.random() * (max - min + 1));
    await this.settle(delay);
  }

  async gotoPath(pathSuffix = '/') {
    const url = pathSuffix.startsWith('http')
      ? pathSuffix
      : `${this.settings.baseUrl}${pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`}`;
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  async isDatepickerOpen() {
    return this.page.evaluate(() => {
      const el = document.querySelector('#ui-datepicker-div');
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none';
    });
  }

  async openDatepicker(inputLocator) {
    await expect(inputLocator).toBeVisible({ timeout: 30_000 });
    await inputLocator.scrollIntoViewIfNeeded();
    await inputLocator.click();
    await this.settle(400);
    if (!(await this.isDatepickerOpen())) {
      await inputLocator.evaluate((el) => {
        el.focus();
        el.click();
        if (window.jQuery) {
          try {
            window.jQuery(el).datepicker('show');
          } catch (_) {
            /* ignore */
          }
        }
      });
      await this.settle(500);
    }
    for (let i = 0; i < 30; i += 1) {
      if (await this.isDatepickerOpen()) return;
      await this.settle(200);
    }
    throw new Error('Datepicker did not open after clicking the date input');
  }

  /**
   * Pick the day after the currently selected date in an open jQuery UI datepicker.
   * At month end, advances to day 1 of the next month.
   */
  async selectNextDayInOpenCalendar() {
    const calendar = this.page.locator('#ui-datepicker-div');
    for (let i = 0; i < 40; i += 1) {
      if (await this.isDatepickerOpen()) break;
      await this.settle(250);
    }
    if (!(await this.isDatepickerOpen())) {
      throw new Error('Datepicker is not open');
    }

    const result = await calendar.evaluate((root) => {
      const cells = Array.from(
        root.querySelectorAll(
          'td:not(.ui-datepicker-other-month):not(.ui-datepicker-unselectable):not(.ui-state-disabled)',
        ),
      ).filter((td) => td.querySelector('a'));

      // Prefer actively selected day; do not use "today" marker (can skip an extra day).
      let selectedIdx = cells.findIndex((td) => Boolean(td.querySelector('a.ui-state-active')));
      if (selectedIdx < 0) {
        selectedIdx = cells.findIndex((td) => td.classList.contains('ui-datepicker-current-day'));
      }

      if (selectedIdx >= 0 && selectedIdx < cells.length - 1) {
        cells[selectedIdx + 1].querySelector('a').click();
        return 'next-in-month';
      }
      return 'need-next-month';
    });

    if (result === 'need-next-month') {
      await calendar.locator('.ui-datepicker-next').click();
      const firstDay = calendar
        .locator('td:not(.ui-datepicker-other-month):not(.ui-datepicker-unselectable) a')
        .first();
      await firstDay.click({ force: true });
    }
  }
}

module.exports = { BasePage };
