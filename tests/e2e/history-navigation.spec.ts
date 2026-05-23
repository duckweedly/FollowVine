import { expect, test } from '@playwright/test'

test('history navigation does not generate and branching truncates later pages', async ({ page }) => {
  let requestCount = 0

  await page.route('**/api/page', async (route) => {
    requestCount += 1
    const isChild = 'parentId' in route.request().postDataJSON()
    const id = requestCount === 1 ? 'pg_00000000000000000000000000000002' : requestCount === 2 ? 'pg_00000000000000000000000000000003' : 'pg_00000000000000000000000000000004'

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        page: {
          id,
          imageUrl: `/generated/${id}.png`,
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

  await page.getByRole('button', { name: '返回上一页' }).click()
  expect(requestCount).toBe(2)
  await expect(page.getByAltText('rag 是怎么工作的')).toBeVisible()

  await page.getByRole('button', { name: '第 2 页' }).click()
  expect(requestCount).toBe(2)
  await expect(page.getByRole('heading', { name: '继续图解' })).toBeVisible()

  await page.getByRole('button', { name: '第 1 页' }).click()
  await page.getByAltText('rag 是怎么工作的').click({ position: { x: 20, y: 20 } })

  await expect(page.getByRole('button', { name: '第 3 页' })).toHaveCount(0)
  expect(requestCount).toBe(3)
})
