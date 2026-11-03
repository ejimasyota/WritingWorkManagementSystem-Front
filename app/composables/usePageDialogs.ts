import { onBeforeUnmount, ref, shallowRef } from 'vue'

interface DialogRequest {
  kind: 'info' | 'error' | 'confirm'
  title: string
  message: string
  textAlign: 'left' | 'center' | 'right'
  resolve: (confirmed: boolean) => void
}

/** 旧 ShowInfoDialog 等と同じく、閉じるアニメーションの完了まで呼出元を待機させる。 */
export function usePageDialogs() {
  const current = shallowRef<DialogRequest | null>(null)
  const visible = ref(false)
  const queue: DialogRequest[] = []
  let closeTimer: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  function show(
    kind: DialogRequest['kind'],
    title: string,
    message: string,
    textAlign: DialogRequest['textAlign'] = 'center',
  ) {
    if (disposed) return Promise.resolve(false)
    return new Promise<boolean>((resolve) => {
      const dialog = { kind, title, message, textAlign, resolve }
      if (current.value) {
        queue.push(dialog)
      } else {
        current.value = dialog
        visible.value = true
      }
    })
  }

  function finish(confirmed: boolean) {
    if (!visible.value || !current.value) return
    visible.value = false
    const completed = current.value
    // BaseDialogの旧CSSによる終了アニメーションは200ms。
    closeTimer = setTimeout(() => {
      closeTimer = undefined
      current.value = queue.shift() || null
      visible.value = !!current.value
      completed.resolve(confirmed)
    }, 200)
  }

  /** 認証ユーザーが変わった場合、前のユーザーの確認ダイアログも破棄する。 */
  function cancelAll() {
    if (closeTimer) clearTimeout(closeTimer)
    closeTimer = undefined
    current.value?.resolve(false)
    queue.splice(0).forEach(dialog => dialog.resolve(false))
    current.value = null
    visible.value = false
  }

  onBeforeUnmount(() => {
    disposed = true
    cancelAll()
  })

  return {
    current,
    visible,
    finish,
    cancelAll,
    info: (title: string, message: string, textAlign: DialogRequest['textAlign'] = 'center') => show('info', title, message, textAlign),
    error: (message: string) => show('error', 'エラー', message),
    confirm: (message: string) => show('confirm', '確認', message),
  }
}

export type PageDialogs = ReturnType<typeof usePageDialogs>
