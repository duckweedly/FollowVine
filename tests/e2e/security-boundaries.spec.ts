import { expect, test } from '@playwright/test'

test('browser-visible responses do not expose credentials or prompt templates', async ({ page }) => {
  const responses: string[] = []

  await page.route('**/api/page', async (route) => {
    const body = JSON.stringify({
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
    responses.push(body)
    await route.fulfill({ contentType: 'application/json', body })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'RAG 是怎么工作的' }).click()
  await page.getByRole('button', { name: '生成图解' }).click()

  expect(responses.join('\n')).not.toContain('OPENAI_API_KEY')
  expect(responses.join('\n')).not.toContain('Compose a single 16:9 Chinese illustrated explainer')
  expect(await page.content()).not.toContain('OPENAI_API_KEY')
})
