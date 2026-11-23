import { expect, test, type Page } from '@playwright/test';
import { cemeteryId, fixture, detail, gravePath, select, geometry } from './fixtures/cemetery';

const owner = { id: 'ownership-party-33333333-3333-4333-8333-333333333333', version: '1:1', displayName: 'Mary Buyer', firstName: 'Mary', lastName: 'Buyer', fullAddress: '', municipality: '', state: '', zip: '', deedOnFile: true, deedRegisterOnFile: true };
async function setup(page: Page, { lostReply = false, unstructured = false, role = 'admin' } = {}) {
  await fixture(page);
  await page.route('**/api/headstone-lookups*', route => route.fulfill({ json: { burialRecordStatuses: [
    { id: 'interred', code: 'interred', label: 'Interred' },
    { id: 'pre-need', code: 'pre_need_inscription', label: 'Pre-need inscription' },
  ] } }));
  const holder = unstructured ? { ...owner, firstName: '', lastName: '', displayName: 'Mary and John Buyer' } : owner;
  const attempts: Record<string, unknown>[] = []; let saved: Record<string, unknown> | undefined; let ownershipWrites = 0;
  page.on('request', request => { if (request.method() !== 'GET' && /ownership|owners|deed/u.test(request.url())) ownershipWrites++; });
  await page.route('**/api/me', route => route.fulfill({ json: { role, assignedCemeteryIds: [cemeteryId], cemeteryMemberships: [{ cemeteryId, role: role === 'power-user' ? 'reader' : role }], permissions: {} } }));
  await page.route('**/api/cemetery-map', route => route.fulfill({ json: { boundaries: [{ type: 'Feature', properties: { id: cemeteryId, name: 'Test Cemetery' }, geometry }], sections: [], lots: [], graves: [{ ...detail('A-TEST'), status: saved?.recordStatusCode === 'interred' ? 'occupied' : 'sold' }], headstones: [] } }));
  await page.route(gravePath('A-TEST'), route => route.fulfill({ json: { ...detail('A-TEST'), status: saved?.recordStatusCode === 'interred' ? 'occupied' : 'sold', owners: [holder], currentOwnerIds: [holder.id], burials: saved ? [saved] : [] } }));
  await page.route(`**/api/cemeteries/${cemeteryId}/grave-spaces/A-TEST/burials`, async route => {
    const input = route.request().postDataJSON(); attempts.push(input);
    saved ??= { id: 'burial-added', version: '2', person: { id: 'person-added', firstName: input.firstName, lastName: input.lastName, birthDate: input.birthDate }, burialDate: input.burialDate, veteran: false, recordStatusCode: input.recordStatusCode, intermentType: input.intermentType };
    if (lostReply && attempts.length === 1) return route.abort('failed');
    return route.fulfill({ status: 201, json: saved });
  });
  await page.goto('/');
  if ((page.viewportSize()?.width ?? 1280) <= 760) await page.getByRole('navigation', { name: 'Workspace views' }).getByRole('button', { name: 'Search', exact: true }).click();
  await select(page, 'A-TEST'); await page.getByRole('tab', { name: 'People and ownership', exact: true }).click();
  return { attempts, ownershipWrites: () => ownershipWrites };
}

for (const width of [1280,390]) test(`deed holder burial preserves ownership and refreshes occupied status at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 }); const state = await setup(page);
  await page.getByRole('button', { name: 'Add burial', exact: true }).click();
  const form = page.getByRole('region', { name: 'Add burial', exact: true });
  await form.getByLabel('Person to record').selectOption(owner.id);
  await expect(form.getByLabel('First name', { exact: true })).toHaveValue('Mary');
  await expect(form.getByLabel('Last name', { exact: true })).toHaveValue('Buyer');
  await form.getByLabel('Burial date', { exact: true }).fill('2026-11-21');
  await form.getByRole('combobox', { name: 'Interment', exact: true }).selectOption('casket');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await form.getByRole('button', { name: 'Add burial', exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit burial Mary Buyer', exact: true })).toBeVisible();
  expect(state.attempts).toHaveLength(1);expect(state.attempts[0]).toMatchObject({ firstName: 'Mary', lastName: 'Buyer', sourceOwnerId: owner.id, sourceOwnerVersion: owner.version, recordStatusCode: 'interred', expectedVersion: '1' });
  expect(state.ownershipWrites()).toBe(0);
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await expect(page.locator('.detail-panel')).toContainText(/occupied/i);
});

test('another person can be buried without becoming an owner; lost response retry retains its request ID', async ({ page }) => {
  const state = await setup(page, { lostReply: true });
  await page.getByRole('button', { name: 'Add burial', exact: true }).click(); const form = page.getByRole('region', { name: 'Add burial', exact: true });
  await form.getByLabel('First name', { exact: true }).fill('Alex');await form.getByLabel('Last name', { exact: true }).fill('Relative');
  await form.getByRole('combobox', { name: 'Interment', exact: true }).selectOption('urn');
  await form.getByRole('button', { name: 'Add burial', exact: true }).click();
  await expect(form.getByRole('alert')).toBeVisible();await expect(form.getByLabel('First name', { exact: true })).toHaveValue('Alex');
  await form.getByRole('button', { name: 'Add burial', exact: true }).click();
  await expect(form).toHaveCount(0);expect(state.attempts).toHaveLength(2);expect(state.attempts[1]).toEqual(state.attempts[0]);
  expect(state.attempts[0].sourceOwnerId).toBeUndefined();expect(state.ownershipWrites()).toBe(0);
  await expect(page.getByRole('button', { name: 'Edit burial Alex Relative', exact: true })).toBeVisible();
});

test('joint legacy holder needs an individual name and cancel performs no write', async ({ page }) => {
  const state = await setup(page, { unstructured: true });await page.getByRole('button', { name: 'Add burial', exact: true }).click();
  const form = page.getByRole('region', { name: 'Add burial', exact: true });await form.getByLabel('Person to record').selectOption(owner.id);
  await expect(form).toContainText('Enter the individual');await expect(form.getByLabel('First name', { exact: true })).toHaveValue('');
  await expect(form.getByLabel('Last name', { exact: true })).toHaveValue('');
  await form.getByLabel('First name', { exact: true }).fill('Mary');page.once('dialog', dialog => dialog.accept());await form.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(form).toHaveCount(0);expect(state.attempts).toHaveLength(0);expect(state.ownershipWrites()).toBe(0);
});

for (const role of ['reader','power-user']) test(`${role} with a reader target membership cannot add a burial`, async ({ page }) => {
  await setup(page, { role });await expect(page.getByRole('button', { name: 'Add burial', exact: true })).toHaveCount(0);
});

test('pre-need inscription allows unknown interment during creation and does not mark a sold grave occupied', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: 'Add burial', exact: true }).click();
  const form = page.getByRole('region', { name: 'Add burial', exact: true });
  await form.getByLabel('First name', { exact: true }).fill('Future');
  await form.getByRole('combobox', { name: 'Record status', exact: true }).selectOption('pre_need_inscription');
  await form.getByRole('combobox', { name: 'Interment', exact: true }).selectOption('unknown');
  await form.getByRole('button', { name: 'Add burial', exact: true }).click();
  await expect(form).toHaveCount(0);
  expect(state.attempts[0]).toMatchObject({ recordStatusCode: 'pre_need_inscription', intermentType: 'unknown', burialDate: '' });
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await expect(page.locator('.detail-panel')).toContainText(/sold/i);
});
