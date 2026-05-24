import { expect, test } from '@playwright/test'

test('account page shows billing entry points', async ({ page }) => {
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'Account & Balance' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '会员状态' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '积分流水' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '订单记录' })).toBeVisible()
  await expect(page.getByRole('link', { name: '购买会员或积分' })).toHaveAttribute('href', '/pricing')
})
