import { nextTick, reactive, ref } from 'vue'
import { validateCredentials } from '../utils/auth'

/** ログイン・登録で共通の値と検証を管理する。パスワードは永続化しない。 */
export function useCredentialForm(registration = false) {
  const values = reactive({ userId: '', password: '', confirmPassword: '' })
  const errors = ref<Record<string, string>>({})

  async function validate() {
    const input = {
      userId: values.userId.trim(),
      password: values.password.trim(),
      confirmPassword: values.confirmPassword.trim(),
    }
    errors.value = validateCredentials(input, registration)
    const first = Object.keys(errors.value)[0]
    if (first) {
      await nextTick()
      const ids: Record<string, string> = {
        userId: 'UserId', password: 'Password', confirmPassword: 'ConfirmPassword',
      }
      document.getElementById(ids[first]!)?.focus()
      return null
    }
    return input
  }

  return { values, errors, validate }
}
