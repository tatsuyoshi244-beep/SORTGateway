import { Page } from '@playwright/test';

export const DEMO_PASSWORD = 'SortGateway2026!';

export async function loginAs(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'サインイン' }).click();
  await page.waitForURL('**/dashboard');
}

export async function logout(page: Page) {
  await page.getByTestId('logout-button').click();
  await page.waitForURL('**/login');
}
