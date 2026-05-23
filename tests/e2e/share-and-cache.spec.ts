import { expect, test } from '@playwright/test'

test('creates a public unlisted share link for the current path', async ({ page }) => {
  await page.route('**/api/page', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        page: {
          id: 'pg_00000000000000000000000000000002',
          imageUrl: '/generated/pg_00000000000000000000000000000002.png',
          parentId: null,
          parentClick: null,
          initialQuery: 'rag 是怎么工作的',
          style: 'watercolor_book',
          createdAt: '2026-05-23T00:00:00.000Z'
        }
      })
    })
  })
  await page.route('**/api/share', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ shareUrl: '/share/sh_demo' }) })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'RAG 是怎么工作的' }).click()
  await page.getByRole('button', { name: '生成图解' }).click()
  await page.getByRole('button', { name: '生成分享链接' }).click()

  await expect(page.getByRole('link', { name: '/share/sh_demo' })).toBeVisible()
})
