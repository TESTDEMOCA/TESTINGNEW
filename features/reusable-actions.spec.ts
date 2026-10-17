import { commonSteps } from '../src/steps/common.steps';
import { expect, test } from '../fixtures/test.fixture';

test('opens example.com through reusable navigation', async ({ page, actions }) => {
  await actions.navigate('https://example.com');
  await expect(page).toHaveTitle(/Example Domain/);
  await expect(page.getByRole('link', { name: 'Learn more' })).toBeVisible();
});

test('reusable actions fill, click, and assert', async ({ page, actions }) => {
  await page.setContent(`
    <label for="name">Name</label>
    <input id="name" />
    <button id="save">Save</button>
    <p id="result" hidden></p>
    <script>
      document.getElementById('save').addEventListener('click', () => {
        const result = document.getElementById('result');
        result.hidden = false;
        result.textContent = document.getElementById('name').value;
      });
    </script>
  `);

  await commonSteps.enterText(actions, '#name', 'Diwakar');
  await commonSteps.click(actions, '#save');
  await commonSteps.verifyText(actions, '#result', 'Diwakar');
  await actions.shouldHaveValue('#name', 'Diwakar');
});

test('browser manager can open another tab from the test browser', async ({ browserManager, page }) => {
  await page.setContent('<h1>First</h1>');
  const second = await browserManager.newTab();
  await second.setContent('<h1>Second</h1>');
  expect(browserManager.pages()).toHaveLength(2);
  await browserManager.switchToTab(0);
  await expect(page.getByRole('heading')).toHaveText('First');
});
