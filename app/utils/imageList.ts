import type { CharacterImage } from '../types/character'

export const imageListLimit = 5
export const imageBytesLimit = 5 * 1024 * 1024
export const imageCaptionLimit = 100

/** 旧画像一覧と同じく、選択分を一括で検証し、超過時は1枚も追加しない。 */
export function imageSelectionError(images: CharacterImage[], files: { name: string; size: number }[]): string {
  if (images.length + files.length > imageListLimit) return `画像は${imageListLimit}枚まで登録できます。\nあと${imageListLimit - images.length}枚まで追加できます`
  if (files.some(file => !/\.(jpg|jpeg|png|gif|webp)$/i.test(file.name))) return '画像ファイル（.jpg .jpeg .png .gif .webp）を選択してください'
  if (files.some(file => file.size > imageBytesLimit)) return '画像は1枚あたり5MBまでです'
  const pending = images.reduce((sum, image) => sum + (image.Data ? image.Size : 0), 0)
  if (pending + files.reduce((sum, file) => sum + file.size, 0) > imageBytesLimit) return '一度に追加できる画像は合計5MBまでです。\n一度保存してから追加してください'
  return ''
}

export function moveImage(images: CharacterImage[], from: number, to: number) {
  if (!images[from] || !images[to] || from === to) return images
  const next = [...images]
  const [image] = next.splice(from, 1)
  next.splice(to, 0, image!)
  return next
}
