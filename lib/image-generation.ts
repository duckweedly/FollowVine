import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import OpenAI, { toFile } from 'openai'
import type { Page, ParentClick, StyleKey } from './types'
import { createChildPageId, createRootPageId, roundClickCoordinate } from './page-ids'
import { createMarkedReferenceImage } from './red-circle'
import { getStylePreset } from './styles'

const IMAGE_MODEL = 'gpt-image-2'

function getOpenAI(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

function storagePath(pageId: string): string {
  return join(process.cwd(), 'storage/generated', `${pageId}.png`)
}

async function writeGeneratedImage(pageId: string, b64Json: string | undefined): Promise<void> {
  if (!b64Json) throw new Error('Image generation returned no image data')

  await mkdir(join(process.cwd(), 'storage/generated'), { recursive: true })
  await writeFile(storagePath(pageId), Buffer.from(b64Json, 'base64'))
}

function styleDescription(style: StyleKey): string {
  return getStylePreset(style)?.description ?? ''
}

function rootPrompt(query: string, style: StyleKey): string {
  return `${styleDescription(style)}\n\nSubject: ${query}\n\nCompose a single 16:9 Chinese illustrated explainer page about the subject above. The image should teach the concept visually. Use clear Chinese title and short readable labels. Avoid dense paragraphs and tiny text. Output one 16:9 PNG image.`
}

function childPrompt(style: StyleKey): string {
  return `${styleDescription(style)}\n\nYou are continuing a Chinese illustrated explainer book. The provided image is the previous page. A red circle marks where the reader pointed. Generate the next 16:9 page by drilling into whatever the red circle is on: zoom in, expand its internal structure, show its mechanism, or explain its role. Match the same visual style, paper tone, line weight, palette, and title treatment. Do not include the red circle or cursor mark in the output. Use clear Chinese title and short readable labels. Avoid dense paragraphs and tiny text. Output one 16:9 PNG image.`
}

export async function generateRootPageImage(query: string, style: StyleKey): Promise<Page> {
  const id = createRootPageId(query, style)
  const result = await getOpenAI().images.generate({
    model: IMAGE_MODEL,
    prompt: rootPrompt(query, style),
    size: '1536x1024'
  })
  await writeGeneratedImage(id, result.data?.[0]?.b64_json)

  return {
    id,
    imageUrl: `/generated/${id}.png`,
    parentId: null,
    parentClick: null,
    initialQuery: query,
    style,
    createdAt: new Date().toISOString()
  }
}

export async function generateChildPageImage(parentPage: Page, parentClick: ParentClick): Promise<Page> {
  const roundedClick = {
    x: roundClickCoordinate(parentClick.x),
    y: roundClickCoordinate(parentClick.y)
  }
  const id = createChildPageId(parentPage.id, roundedClick, parentPage.style)
  const parentImage = await readFile(storagePath(parentPage.id))
  const markedReferenceImage = await createMarkedReferenceImage(parentImage, roundedClick)
  const result = await getOpenAI().images.edit({
    model: IMAGE_MODEL,
    prompt: childPrompt(parentPage.style),
    image: await toFile(markedReferenceImage, `${parentPage.id}-marked.png`),
    size: '1536x1024'
  })
  await writeGeneratedImage(id, result.data?.[0]?.b64_json)

  return {
    id,
    imageUrl: `/generated/${id}.png`,
    parentId: parentPage.id,
    parentClick: roundedClick,
    initialQuery: null,
    style: parentPage.style,
    createdAt: new Date().toISOString()
  }
}
