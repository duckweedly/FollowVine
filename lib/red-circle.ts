import sharp from 'sharp'
import type { ParentClick } from './types'

type ImageSize = {
  width: number
  height: number
}

export function getClickPixelPosition(parentClick: ParentClick, imageSize: ImageSize): { x: number; y: number } {
  return {
    x: Math.round(parentClick.x * imageSize.width),
    y: Math.round(parentClick.y * imageSize.height)
  }
}

export async function createMarkedReferenceImage(input: Buffer, parentClick: ParentClick): Promise<Buffer> {
  const image = sharp(input)
  const metadata = await image.metadata()
  const width = metadata.width ?? 1536
  const height = metadata.height ?? 1024
  const center = getClickPixelPosition(parentClick, { width, height })
  const radius = Math.max(18, Math.round(Math.min(width, height) * 0.04))
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><circle cx="${center.x}" cy="${center.y}" r="${radius}" fill="none" stroke="#ff0000" stroke-width="${Math.max(6, Math.round(radius * 0.18))}"/><circle cx="${center.x}" cy="${center.y}" r="${Math.max(4, Math.round(radius * 0.16))}" fill="#ff0000"/></svg>`

  return image.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer()
}
