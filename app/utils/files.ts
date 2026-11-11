import { messageFormat } from './messages';
import type { DownloadData } from '../types/backend';
export function downloadBase64(data: DownloadData) {
  const bytes = Uint8Array.from(atob(data.FileData), character => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], {
    type: data.MimeType || 'application/octet-stream'
  }));
  const link = document.createElement('a');
  link.href = url;
  link.download = data.FileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
export function fileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error(messageFormat('ERROR', 'E_0003', '選択したCSVの読み込み')));
    reader.readAsDataURL(file);
  });
}
export async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  }
}

/** 外部画像を埋め込んだSVGをPNGとして保存する。呼び出し元の表示倍率には依存しない。 */
export async function downloadSvgPng(svg: SVGSVGElement, width: number, height: number, fileName: string) {
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], {
    type: 'image/svg+xml;charset=utf-8'
  }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(messageFormat('ERROR', 'E_0003', '画像の作成')));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * 2);
    canvas.height = Math.ceil(height * 2);
    const context = canvas.getContext('2d');
    if (!context) throw new Error(messageFormat('ERROR', 'E_0003', '画像の作成'));
    context.scale(2, 2);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error(messageFormat('ERROR', 'E_0003', '画像の保存'))), 'image/png'));
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = fileName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
  } finally {
    URL.revokeObjectURL(url);
  }
}
