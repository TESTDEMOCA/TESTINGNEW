# Copilot / AI context

Playwright + Cucumber BDD UI automation (Plaza Premium Lounge staging).
**Feature files own the flow. Follow step order exactly — do not skip, reorder, merge, or invent shortcuts.**

## Generic hard rules (all scenarios)

1. **Source of truth:** `features/*.feature` (and tags). Change page objects / step defs to match Gherkin — do not rewrite scenario order unless the user asks.
2. **Reuse first:** Prefer existing steps in `src/steps/` and page objects in `src/pages/` / `src/support/`. Add new steps only when no existing wording fits.
3. **One concern per change:** Fix the failing step or requested area; do not refactor unrelated flows.
4. **Shared helpers:** Put shared locators/actions on `BasePage` or shared support modules; avoid duplicating the same selector in multiple pages.
5. **External apps (e.g. Yopmail, LMS):** Use the existing session helpers. Yopmail uses a **separate browser** (`src/support/yopmailSession.js`) and gets its **own video** under `reports/videos/.../yopmail/`. Do not fold it into the app tab unless the user asks for one combined video.
6. **Video / reports:** Main app context = main `.webm`; secondary browsers = separate recordings. Do not commit `.env`, `node_modules`, or `reports/` artifacts.
7. **Run via scripts:** Use `npm run launch:<name>` from `package.json` (tag-based). Do not invent ad-hoc cucumber CLI flags unless asked.
8. **Data:** Capture product name, price, booking/order id, gate/location, credentials from the UI into world state; assert confirmation / email against those captured values.
9. **Waits:** Prefer Playwright locator waits / existing helpers over fixed long `sleep`s.
10. **Logging:** Keep short prefixed logs (`[passes]`, `[yopmail]`, `[cart]`, `[booking]`, `[video]`, `[session]`, etc.).

## Project layout

| Area | Path |
|------|------|
| Features (Gherkin) | `features/` |
| Step definitions | `src/steps/` |
| Page objects | `src/pages/` |
| Hooks / video | `src/hooks/hooks.js` |
| World / sessions | `src/support/` |
| Config | `src/config/`, `cucumber.cjs`, `.env` (local only) |
| Launch scripts | `package.json` |

## When adding or editing a scenario

1. Write/update the `.feature` steps in the intended business order.
2. Wire steps only if missing; reuse wording when the action is the same.
3. Implement in the correct page object; keep steps thin (delegate to pages).
4. Capture what later steps need (price, name, order id, email).
5. Assert at confirmation / email / LMS using captured data.
6. Run the matching `launch:*` script to verify.

## Domain notes (still follow feature order)

- **Book Now / mini-cart Check Out:** use `BasePage.MINICART_CHECKOUT_SELECTOR` / `miniCartCheckOutButton()` (and location match helpers where the feature requires them).
- **Passes:** capture name/price from the tile actually clicked; after login, prefer paid/cart total for confirmation when it differs from listing price.
- **Emails:** Booking Confirmation (PPL UAT) is common; **Unlock Your PPL Pass** only when the scenario/tag enables it (`expectUnlockPplPassEmail` — currently `@TC01_pass`, `@TC02_pass`, `@TC03_pass`).
- **Example pass tags:** `@TC01_pass` guest; `@TC02_pass` member + two same passes; `@TC03_pass` Smart Traveller exclusive → signup/activate → re-select → login → checkout. Always read the feature file for the exact step list.

## Do not

- Skip activation, login, checkout, payment, confirmation, or email steps “to save time.”
- Hardcode secrets into committed files.
- Rename step text casually (breaks existing scenarios).
- Change Video/Yopmail architecture without an explicit request.
