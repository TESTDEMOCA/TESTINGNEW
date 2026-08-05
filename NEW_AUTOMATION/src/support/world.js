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
  }
}

setWorldConstructor(AppWorld);
