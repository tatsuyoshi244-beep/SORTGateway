import { test, expect } from '@playwright/test';
import { loginAs, logout } from './helpers/auth';
import path from 'path';

test.describe('SORT Gateway Enterprise E2E', () => {
  test('login and logout', async ({ page }) => {
    await loginAs(page, 'employee@sortgateway.local');
    await expect(page.getByText(/ようこそ/)).toBeVisible();
    await logout(page);
    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible();
  });

  test('AI chat', async ({ page }) => {
    await loginAs(page, 'employee@sortgateway.local');
    await page.goto('/chat');
    const input = page.getByPlaceholder('質問を入力...');
    await input.fill('見積承認のルールを教えてください');
    await input.press('Enter');
    await expect(page.getByText('見積承認').first()).toBeVisible({ timeout: 30_000 });
  });

  test('document upload page', async ({ page }) => {
    await loginAs(page, 'admin@sortgateway.local');
    await page.goto('/admin/documents');
    await expect(page.getByRole('heading', { name: 'ドキュメント管理' })).toBeVisible();
    const fileInput = page.locator('input[type="file"]');
    if ((await fileInput.count()) > 0) {
      const sample = path.join(__dirname, 'fixtures', 'sample.txt');
      await fileInput.setInputFiles(sample);
    }
  });

  test('knowledge management', async ({ page }) => {
    await loginAs(page, 'admin@sortgateway.local');
    await page.goto('/admin/knowledge');
    await expect(page.getByRole('heading', { name: 'ナレッジ登録・編集' })).toBeVisible();
  });

  test('integrations and analytics', async ({ page }) => {
    await loginAs(page, 'admin@sortgateway.local');
    await page.goto('/admin/integrations');
    await expect(page.getByRole('heading', { name: '外部連携' })).toBeVisible();
    await page.goto('/admin/analytics');
    await expect(page.getByRole('heading', { name: '利用分析' })).toBeVisible();
    await expect(page.getByText('AI質問数')).toBeVisible({ timeout: 15_000 });
  });

  test('health API', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
