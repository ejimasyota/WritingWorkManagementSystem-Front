/** アプリ共通の認証状態。永続化したユーザーID・権限を認証の根拠には使用しない。 */
export function useAuthSession() {
  return useNuxtApp().$authSession
}
