import { test, expect } from '@playwright/test'

test('generates from recommended demo topic', async ({ page }) => {
  await page.route('**/api/page', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        page: {
          id: 'pg_00000000000000000000000000000001',
          imageUrl: '/generated/pg_00000000000000000000000000000001.png',
          parentId: null,
          parentClick: null,
          initialQuery: 'rag 是怎么工作的',
          style: 'watercolor_book',
          createdAt: '2026-05-23T00:00:00.000Z'
        }
      })
    })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'RAG 是怎么工作的' }).click()
  await page.getByRole('button', { name: '生成图解' }).click()

  await expect(page.getByRole('heading', { name: 'rag 是怎么工作的' })).toBeVisible()
  await expect(page.getByAltText('rag 是怎么工作的')).toBeVisible()
})

test('shows validation errors for invalid manual topics', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: '知识主题' }).fill('')
  await page.getByRole('button', { name: '生成图解' }).click()

  await expect(page.getByText('请输入 1-300 个字符的知识主题。')).toBeVisible()
})
