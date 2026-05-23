import { expect, test } from '@playwright/test'

test('clicking a generated image appends a child page and blocks duplicate clicks', async ({ page }) => {
  let requestCount = 0

  await page.route('**/api/page', async (route) => {
    requestCount += 1
    const body = route.request().postDataJSON()
    const isChild = 'parentId' in body

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        page: {
          id: isChild ? 'pg_00000000000000000000000000000005' : 'pg_00000000000000000000000000000002',
          imageUrl: isChild ? '/generated/pg_00000000000000000000000000000005.png' : '/generated/pg_00000000000000000000000000000002.png',
          parentId: isChild ? 'pg_00000000000000000000000000000002' : null,
          parentClick: isChild ? { x: 0.5, y: 0.5 } : null,
          initialQuery: isChild ? null : 'rag 是怎么工作的',
          style: 'watercolor_book',
          createdAt: '2026-05-23T00:00:00.000Z'
        }
      })
    })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'RAG 是怎么工作的' }).click()
  await page.getByRole('button', { name: '生成图解' }).click()
  await page.getByAltText('rag 是怎么工作的').click({ position: { x: 10, y: 10 } })

  await expect(page.getByRole('heading', { name: '继续图解' })).toBeVisible()
  expect(requestCount).toBe(2)
})
