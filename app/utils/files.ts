import { messageFormat } from './messages';
import type { DownloadData } from '../types/backend'

export function downloadBase64(data: DownloadData) {
  const bytes = Uint8Array.from(atob(data.FileData), character => character.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: data.MimeType || 'application/octet-stream' }))
  const link = document.createElement('a')
  link.href = url
  link.download = data.FileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function fileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(new Error(messageFormat('ERROR', 'E_0003', '選択したCSVの読み込み')))
    reader.readAsDataURL(file)
  })
}

export async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    return copied
  }
}
