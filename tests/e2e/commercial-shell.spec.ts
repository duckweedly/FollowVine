import { expect, test } from '@playwright/test'

test('commercial workspace shell is available', async ({ page }) => {
  await page.goto('/workspace')
  await expect(page.getByRole('heading', { name: 'FollowVine Workspace' })).toBeVisible()
  await expect(page.getByLabel('知识主题')).toBeVisible()
  await expect(page.getByText('余额与预估消耗', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '创建生成任务' })).toBeVisible()
})

test('account shell shows commercial account sections', async ({ page }) => {
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'Account & Balance' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '会员状态' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '积分流水' })).toBeVisible()
})
