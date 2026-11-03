<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { LoginResult } from '../types/backend';
import { BackendError, errorMessage } from '../utils/backend';
import { loginDestination, stashPendingJoinToken } from '../utils/auth';
useHead({
  title: '創作管理システム'
});
definePageMeta({
  alias: ['/login', '/index.html'],
  middleware: ['guest'],
  guestOnly: true
});
const {
  values,
  errors,
  validate
} = useCredentialForm();
const {
  request,
  busy
} = useBackendApi();
const dialogs = usePageDialogs();
const auth = useAuthSession();
const config = useRuntimeConfig();
const submitting = ref(false);
const remaining = ref(0);
let countdown: ReturnType<typeof setInterval> | undefined;
const locked = computed(() => remaining.value > 0);
const countdownText = computed(() => {
  const minutes = Math.floor(remaining.value / 60_000);
  const seconds = Math.floor(remaining.value % 60_000 / 1000);
  return `ロック解除まで ${minutes}分${String(seconds).padStart(2, '0')}秒`;
});

/** 旧 ShowLockCountdown：サーバーが返す残時間を使い、両方のボタンを無効にする。 */
function startCountdown(milliseconds: number) {
  if (countdown) clearInterval(countdown);
  const end = Date.now() + Math.max(0, milliseconds);
  function update() {
    remaining.value = Math.max(0, end - Date.now());
    if (!remaining.value && countdown) {
      clearInterval(countdown);
      countdown = undefined;
    }
  }
  update();
  if (remaining.value) countdown = setInterval(update, 1000);
}
function handleLock(data: unknown) {
  const result = data as LoginResult | null;
  if (result?.IsLocked) startCountdown(Number(result.RemainingMs) || 0);
}
async function login() {
  if (submitting.value || locked.value) return;
  const input = await validate();
  if (!input) return;
  submitting.value = true;
  try {
    const response = await request<LoginResult>('/Login.php', 'POST', {
      UserId: input.userId,
      Password: input.password
    });
    if (!response.Success) {
      handleLock(response.Data);
      await dialogs.error(response.Message || 'ログインに失敗しました');
      return;
    }
    await auth.establishSession();
    const pendingJoin = !!sessionStorage.getItem('PendingJoinToken');
    const destination = loginDestination(sessionStorage.getItem('LastPath'), pendingJoin, config.public.legacyWorkPath);
    sessionStorage.removeItem('LastPath');
    // 旧作品詳細へ復帰する場合だけ、Nuxt外の既存画面へ遷移する。
    if (destination.startsWith('/Front/')) window.location.assign(destination);else await navigateTo(destination);
  } catch (error) {
    if (error instanceof BackendError) handleLock(error.data);
    await dialogs.error(errorMessage(error, 'ログイン処理中にエラーが発生しました'));
  } finally {
    submitting.value = false;
  }
}
async function openRegistration() {
  if (!locked.value && !submitting.value) await navigateTo('/registration');
}
onMounted(stashPendingJoinToken);
onBeforeUnmount(() => {
  if (countdown) clearInterval(countdown);
});
</script>

<template>
  <div class="LoginContainer">
    <div class="LoginCard">
      <div class="LoginIcon">
        <i class="fas fa-book-open" aria-hidden="true" />
      </div>
      <h1 class="LoginTitle">
        創作管理システム
      </h1>
      <p class="LoginSubtitle">
        ログインしてください
      </p>
      <form id="LoginForm" class="LoginForm" novalidate @submit.prevent="login">
        <TextFieldComponent
          v-model="values.userId"
          input-id="UserId"
          label="ユーザーID"
          maxlength="12"
          autocomplete="username"
          :error="errors.userId"
          required
        />
        <TextFieldComponent
          v-model="values.password"
          input-id="Password"
          label="パスワード"
          type="password"
          maxlength="12"
          autocomplete="current-password"
          :error="errors.password"
          required
        />
        <div id="LockCountdown" class="CountdownArea" :class="{ Active: locked }" role="status">
          <i class="fas fa-lock" aria-hidden="true" />
          <span id="LockCountdownText">
            {{ countdownText }}
          </span>
        </div>
        <div class="LoginButtonGroup">
          <button
            id="LoginButton"
            type="submit"
            class="ButtonClass PrimaryButton ButtonFull"
            :disabled="locked || submitting"
          >
            <i class="fas fa-sign-in-alt" aria-hidden="true" />
            ログイン
          </button>
          <button
            id="RegisterButton"
            type="button"
            class="ButtonClass SuccessButton ButtonFull"
            :disabled="locked || submitting"
            @click="openRegistration"
          >
            <i class="fas fa-user-plus" aria-hidden="true" />
            会員登録
          </button>
        </div>
      </form>
    </div>
    <SpinnerOverlay :visible="busy" />
    <PageDialogHost :dialogs="dialogs" />
  </div>
</template>
