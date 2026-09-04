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
    /** Full AMS orderId from summary API, e.g. HKBC-10218-62HVQP */
    this.amsOrderId = null;
    /** Numeric segment only from AMS orderId, e.g. 10218 */
    this.amsOrderNumber = null;
    /** LMS outlet title from Outlet master, e.g. HKG - PPL - East Hall (MAS) */
    this.lmsOutletName = null;
    /** Guest first name used at checkout (AMS summary query). */
    this.guestFirstName = null;
    /** LMS outlet gate: '1' | '35' | '60' | null */
    this.lmsGate = null;
    /** Site currency chosen via Language modal (e.g. INR); overrides destination default. */
    this.selectedCurrency = null;
    /** Dedicated Yopmail browser (separate from app browser for video capture). */
    this.yopmailBrowser = null;
    this.yopmailContext = null;
    this.yopmailPage = null;
    /** True when scenario selected Smart Traveller exclusive pass (TC03_pass). */
    this.smartTravellerPassFlow = false;
    /** Unlock Your PPL Pass email check — TC01_pass / TC02_pass / TC03_pass only. */
    this.expectUnlockPplPassEmail = false;
  }
}

setWorldConstructor(AppWorld);
