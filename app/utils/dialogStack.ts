import { shallowReactive } from 'vue'

// Teleportの配置順ではなく、実際に開いた順を全ダイアログで共有する。
// スピナー（旧CSSの2000）は、このスタックより上に表示する。
const openedDialogs = shallowReactive<symbol[]>([])

export function activateDialog(id: symbol) {
  const index = openedDialogs.indexOf(id)
  if (index >= 0) openedDialogs.splice(index, 1)
  openedDialogs.push(id)
}

export function isTopDialog(id: symbol) {
  return openedDialogs[openedDialogs.length - 1] === id
}

export function dialogLayer(id: symbol) {
  return 1000 + Math.max(0, openedDialogs.indexOf(id))
}

/** 終了アニメーション中も順序を維持し、最前面を閉じた場合だけフォーカスを戻す。 */
export function releaseDialog(id: symbol) {
  const wasTop = isTopDialog(id)
  const index = openedDialogs.indexOf(id)
  if (index >= 0) openedDialogs.splice(index, 1)
  return wasTop
}
