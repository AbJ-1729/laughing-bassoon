import { test, expect, type Page } from '@playwright/test';

async function loadExample(page: Page, name: RegExp) {
  await page.getByLabel('Load example').selectOption({ label: (await optionLabel(page, name)) });
}

async function optionLabel(page: Page, name: RegExp): Promise<string> {
  const options = await page.getByLabel('Load example').locator('option').allTextContents();
  const match = options.find((o) => name.test(o));
  if (!match) throw new Error(`No example option matching ${name}`);
  return match;
}

test.beforeEach(async ({ page }) => {
  // Destructive edits (e.g. removing a value that clues reference) now prompt a
  // confirm() before pruning clues; auto-accept so flows proceed.
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Logic-Grid Puzzle Solver' })).toBeVisible();
});

test('solves a puzzle end-to-end and scrubs the deduction chain', async ({ page }) => {
  await loadExample(page, /Race Day/);
  await page.getByRole('button', { name: 'Solve' }).click();

  await expect(page.getByText(/Unique solution found/)).toBeVisible({ timeout: 15_000 });

  // Deduction chain has steps; scrub forward.
  const firstStep = page.getByRole('button', { name: /^#1 / });
  await expect(firstStep).toBeVisible();
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.getByText(/^\d+ \/ \d+$/)).toBeVisible();

  // Clicking a step highlights it and shows citation pills.
  await firstStep.click();
  await expect(page.getByText(/from clue/).first()).toBeVisible();
});

test('over-constrained puzzle shows the MUS', async ({ page }) => {
  await loadExample(page, /Contradiction/);
  await page.getByRole('button', { name: 'Solve' }).click();
  await expect(page.getByText(/are contradictory/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Contradiction \(MUS\)/)).toBeVisible();
});

test('under-constrained puzzle reports ambiguity', async ({ page }) => {
  await loadExample(page, /Ambiguous/);
  await page.getByRole('button', { name: 'Solve' }).click();
  await expect(page.getByText(/Under-constrained/).first()).toBeVisible({ timeout: 15_000 });
});

test('ill-formed puzzle is rejected with a clear error', async ({ page }) => {
  await loadExample(page, /Coffee Shop/);
  // Break cardinality: remove a value from a non-position category.
  await page.getByLabel(/^Remove value Tea$/).click();
  await page.getByRole('button', { name: 'Solve' }).click();
  await expect(page.getByText(/not well-formed/i).first()).toBeVisible({ timeout: 15_000 });
});

test('clue editing: load a clue, change it, save (§6.1)', async ({ page }) => {
  await loadExample(page, /Coffee Shop/);
  await expect(page.getByText('Ann is at position 1.')).toBeVisible();
  await page.getByRole('button', { name: 'Edit clue 1' }).click();
  // The structured editor loads the clue; change the position to 2 and save.
  await page.getByLabel('Position', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Ann is at position 2.')).toBeVisible();
  await expect(page.getByText('Ann is at position 1.')).toHaveCount(0);
});

test('description field is editable (§5.1)', async ({ page }) => {
  await loadExample(page, /Coffee Shop/);
  const desc = page.getByLabel('Puzzle description');
  await desc.fill('My custom description');
  await expect(desc).toHaveValue('My custom description');
});

test('natural-language path: interpret, confirm, add clue (mocked LLM)', async ({ page }) => {
  await page.route('**/api/parse', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        clue: { type: 'C3', x: { category: 'Person', value: 'Bob' }, k: 2 },
      }),
    });
  });

  await loadExample(page, /Coffee Shop/);
  const before = await page.getByText(/^Clues \(/).textContent();

  await page.getByRole('tab', { name: 'Natural language' }).click();
  await page.getByLabel('Natural-language clue').fill('Bob sits in seat 2.');
  await page.getByRole('button', { name: 'Interpret' }).click();

  await expect(page.getByText(/Interpreted as:/)).toBeVisible();
  await page.getByRole('button', { name: /Confirm/ }).click();

  const after = await page.getByText(/^Clues \(/).textContent();
  expect(after).not.toEqual(before);
});
