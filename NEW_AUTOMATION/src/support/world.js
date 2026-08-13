const { setWorldConstructor } = require('@cucumber/cucumber');

class AppWorld {
  constructor({ attach, parameters }) {
    this.attach = attach;
    this.parameters = parameters;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.settings = null;
    this.testData = null;
    this.device = null;
    this.browserName = null;
    this.orderNo = null;
    /** LMS outlet gate: '35' | '60' | null */
    this.lmsGate = null;
    /** Site currency chosen via Language modal (e.g. INR); overrides destination default. */
    this.selectedCurrency = null;
  }
}

setWorldConstructor(AppWorld);
