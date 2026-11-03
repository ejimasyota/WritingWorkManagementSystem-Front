import { computed, ref } from 'vue'

/** APIの認証エラーはアプリ共通で扱い、画面固有の通信中表示だけをここで管理する。 */
export function useBackendApi() {
  const auth = useAuthSession()
  const requests = ref(0)
  const busy = computed(() => requests.value > 0)

  async function request<T>(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: unknown) {
    requests.value += 1
    try {
      return await auth.request<T>(endpoint, method, data)
    } finally {
      requests.value -= 1
    }
  }

  return { request, busy }
}
