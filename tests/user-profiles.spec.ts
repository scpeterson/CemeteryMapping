import { expect, test } from '@playwright/test';
import { cemeteryId, fixture, geometry, showApplicationActions } from './fixtures/cemetery';
const otherId = '22222222-2222-4222-8222-222222222222';
const cemeteries = [{ id: cemeteryId, name: 'Test Cemetery' }, { id: otherId, name: 'Second Cemetery' }];

test('profile saves contact details, preserves identity, and guards unsaved changes', async ({ page }, testInfo) => {
  await fixture(page);
  let saved: Record<string, unknown> | undefined;
  await page.route('**/api/me/profile', async route => {
    if (route.request().method() === 'PUT') saved = route.request().postDataJSON();
    await route.fulfill({ json: saved ?? { displayName: 'Test User', email: 'member@example.test', phone: '', organization: '', preferredCemeteryId: '', createdAt: '2026-11-04T12:00:00Z' } });
  });
  await page.goto('/');
  await showApplicationActions(page);
  await page.getByRole('button', { name: 'My profile', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'My profile' });
  await expect(panel.getByLabel('Email', { exact: true })).toHaveAttribute('readonly', '');
  await expect(panel.getByLabel('Display name', { exact: true })).toHaveCSS('height', '38px');
  await panel.getByLabel('Display name', { exact: true }).fill('Updated User');
  page.once('dialog', dialog => dialog.dismiss());
  await panel.getByRole('button', { name: 'Close profile', exact: true }).click();
  await expect(panel).toBeVisible();
  await panel.getByLabel('Organization (optional)').fill('Cemetery volunteers');
  await panel.getByRole('button', { name: 'Save profile' }).click();
  await expect(panel.getByRole('status')).toHaveText('Profile saved.');
  expect(saved?.displayName).toBe('Updated User');
  expect(saved?.organization).toBe('Cemetery volunteers');
  const save = panel.getByRole('button', { name: 'Save profile' });
  await expect(save).toHaveCSS('min-height', '38px');
  await expect(panel.getByRole('button', { name: 'Close profile' })).toHaveClass(/icon-button/);
  await expect(panel.getByRole('status')).toHaveClass(/ui-notice--success/);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await save.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`profile-${width}.png`) });
  }
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
});

test('admin manages independent cemetery roles and filters user activity', async ({ page }, testInfo) => {
  await fixture(page);
  const user = { id: cemeteryId, externalSubject: 'auth0|member', displayName: 'Volunteer User', email: 'member@example.test', role: 'cemetery-admin', assignedCemeteryIds: [cemeteryId, otherId], cemeteryMemberships: [{ cemeteryId, role: 'cemetery-admin' }, { cemeteryId: otherId, role: 'reader' }], isActive: true, createdAt: '2026-11-04T12:00:00Z', lastActiveAt: '2026-11-04T13:00:00Z', updatedAt: '2026-11-04T12:00:00Z' };
  let saved: Record<string, unknown> | undefined;
  await page.route('**/api/admin/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = [];
    if (path.endsWith('/access-request-stats')) json = { pending: 0, lastHour: 0, limits: { pending: 100, hourly: 100 } };
    else if (path.endsWith('/roles')) json = ['reader','power-user','cemetery-admin','admin'].map(name => ({ name, description: name, userCount: 0 }));
    else if (path.endsWith('/cemetery-records')) json = { cemeteries, sections: [], lots: [] };
    else if (path.endsWith('/activity')) json = [{ id: 'activity-1', tableName: 'burials', operation: 'UPDATE', changedAt: '2026-11-04T13:00:00Z', reason: 'Corrected birth location' }];
    else if (path === '/api/admin/users') { const q = new URL(route.request().url()).searchParams.get('q')?.toLowerCase() ?? ''; json = `${user.displayName} ${user.email}`.toLowerCase().includes(q) ? [user] : []; }
    else if (path === `/api/admin/users/${cemeteryId}`) { saved = route.request().postDataJSON(); json = { ...user, ...saved }; }
    await route.fulfill({ json });
  });
  await page.goto('/');
  await showApplicationActions(page);
  await page.getByRole('button', { name: /^Open administration:/ }).click();
  const panel = page.getByRole('dialog', { name: 'Admin management' });
  await panel.locator('.admin-user-edit').filter({ hasText: 'Volunteer User' }).click();
  const memberships = panel.getByRole('group', { name: 'Cemetery memberships' });
  await expect(memberships.getByRole('combobox', { name: 'Cemetery role', exact: true }).nth(0)).toHaveValue('cemetery-admin');
  await expect(memberships.getByRole('combobox', { name: 'Cemetery role', exact: true }).nth(1)).toHaveValue('reader');
  await expect(memberships.getByRole('button', { name: 'Remove membership' }).first()).toHaveCSS('min-height', '38px');
  await memberships.getByRole('combobox', { name: 'Cemetery role', exact: true }).nth(1).selectOption('power-user');
  await panel.getByRole('button', { name: 'Save user', exact: true }).click();
  await expect(panel.getByRole('status').filter({ hasText: 'member@example.test saved.' })).toBeVisible();
  expect(saved?.cemeteryMemberships).toEqual([{ cemeteryId, role: 'cemetery-admin' }, { cemeteryId: otherId, role: 'power-user' }]);
  await panel.getByLabel('Search users').fill('does not exist');
  await expect(panel.getByRole('button', { name: 'View activity' })).toHaveCount(0);
  await panel.getByLabel('Search users').fill('Volunteer');
  await panel.getByRole('button', { name: 'View activity' }).click();
  await expect(panel).toContainText('Corrected birth location');
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('user-directory-mobile.png') });
});

test('members with several cemeteries can change cemetery scope', async ({ page }) => {
  await fixture(page);
  await page.route('**/api/me', route => route.fulfill({ json: { role: 'cemetery-admin', assignedCemeteryIds: [cemeteryId, otherId], cemeteryMemberships: [{ cemeteryId, role: 'cemetery-admin' }, { cemeteryId: otherId, role: 'reader' }], permissions: {} } }));
  await page.route('**/api/cemetery-map', route => route.fulfill({ json: { boundaries: [], graves: cemeteries.map(cemetery => ({ id: 'grave', cemeteryId: cemetery.id, cemeteryName: cemetery.name, section: 'A', space: '1', lot: '', geometry, status: 'available' })), sections: [], lots: [], headstones: [] } }));
  await page.goto('/');
  const select = page.getByRole('combobox', { name: 'Cemetery', exact: true });
  await expect(select).toHaveValue(cemeteryId);
  await select.selectOption(otherId);
  await expect(select).toHaveValue(otherId);
  await expect(page.getByRole('banner')).toContainText('Second Cemetery');
});


test('user directory pages and searches on the server without overflowing mobile controls', async ({ page }, testInfo) => {
  await fixture(page);
  const users = Array.from({ length: 105 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12,'0')}`, externalSubject: `auth0|directory-${i}`, displayName: `Directory User ${String(i + 1).padStart(3,'0')}`, email: `directory-${i}@example.test`, role: 'reader', assignedCemeteryIds: [cemeteryId], cemeteryMemberships: [{ cemeteryId, role: 'reader' }], isActive: true, createdAt: '2026-11-04T12:00:00Z', updatedAt: '2026-11-04T12:00:00Z' }));
  await page.route('**/api/admin/**', async route => {
    const url = new URL(route.request().url()); let json: unknown = [];
    if (url.pathname.endsWith('/access-request-stats')) json = { pending: 0, lastHour: 0, limits: { pending: 100, hourly: 100 } };
    else if (url.pathname.endsWith('/roles')) json = [{ name: 'reader', description: 'Reader', userCount: 105 }];
    else if (url.pathname.endsWith('/cemetery-records')) json = { cemeteries, sections: [], lots: [] };
    else if (url.pathname === '/api/admin/users') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      const offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 101);
      json = users.filter(user => user.displayName.toLowerCase().includes(q)).slice(offset, offset + limit);
    }
    await route.fulfill({ json });
  });
  await page.goto('/'); await showApplicationActions(page);
  await page.getByRole('button', { name: /^Open administration:/ }).click();
  const panel = page.getByRole('dialog', { name: 'Admin management' });
  await expect(panel.locator('.admin-user-row')).toHaveCount(100);
  await panel.getByRole('button', { name: 'Next users', exact: true }).click();
  await expect(panel.locator('.admin-user-row')).toHaveCount(5);
  await expect(panel.getByRole('button', { name: 'Next users' })).toBeDisabled();
  await expect(panel).toContainText('Directory User 105');
  await panel.getByLabel('Search users').fill('Directory User 002');
  await expect(panel.locator('.admin-user-row')).toHaveCount(1);
  await expect(panel).toContainText('Page 1');
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('user-directory-paging-mobile.png') });
});
