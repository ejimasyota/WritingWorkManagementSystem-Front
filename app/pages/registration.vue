<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { errorMessage, requireSuccess } from '../utils/backend';
import { stashPendingJoinToken } from '../utils/auth';
useHead({
  title: '創作管理システム'
});
definePageMeta({
  alias: ['/Front/Html/Registration.html'],
  middleware: ['guest'],
  guestOnly: true
});
const {
  values,
  errors,
  validate
} = useCredentialForm(true);
const {
  request,
  busy
} = useBackendApi();
const dialogs = usePageDialogs();
const agreed = ref(false);
const termsOpen = ref(false);
const submitting = ref(false);
async function register() {
  if (!agreed.value || submitting.value) return;
  const input = await validate();
  if (!input) return;
  submitting.value = true;
  try {
    const response = await request('/Registration.php', 'POST', {
      UserId: input.userId,
      Password: input.password
    });
    requireSuccess(response, '登録に失敗しました');
    await dialogs.info('登録完了', '会員登録が完了しました。ログイン画面へ移動します。');
    await navigateTo('/');
  } catch (error) {
    await dialogs.error(errorMessage(error, '登録処理中にエラーが発生しました'));
  } finally {
    submitting.value = false;
  }
}
function openTerms() {
  termsOpen.value = true;
}
async function backToLogin() {
  await navigateTo('/');
}
onMounted(stashPendingJoinToken);
</script>

<template>
  <div class="RegistrationContainer">
    <div class="RegistrationCard">
      <div class="RegistrationIcon">
        <i class="fas fa-user-plus" aria-hidden="true" />
      </div>
      <h1 class="RegistrationTitle">
        会員登録
      </h1>
      <p class="RegistrationSubtitle">
        新規アカウントを作成してください
      </p>
      <form
        id="RegistrationForm"
        class="RegistrationForm"
        novalidate
        @submit.prevent="register"
      >
        <TextFieldComponent
          v-model="values.userId"
          input-id="UserId"
          label="ユーザーID"
          hint="数値を含む8桁以上のユーザーID"
          maxlength="12"
          autocomplete="username"
          :error="errors.userId"
          required
        />
        <TextFieldComponent
          v-model="values.password"
          input-id="Password"
          label="パスワード"
          hint="ユーザーIDと異なる数値を含んだ8桁以上のパスワード"
          type="password"
          maxlength="12"
          autocomplete="new-password"
          :error="errors.password"
          required
        />
        <TextFieldComponent
          v-model="values.confirmPassword"
          input-id="ConfirmPassword"
          label="確認用"
          type="password"
          maxlength="12"
          autocomplete="new-password"
          :error="errors.confirmPassword"
          required
        />
        <div class="FormGroup">
          <div class="CheckboxWrapper">
            <input id="TermsCheckbox" v-model="agreed" type="checkbox" class="CheckboxInput">
            <label for="TermsCheckbox">
              <a id="TermsLink" href="#" class="LinkText" @click.prevent="openTerms">
                利用規約
              </a>
              に同意する
            </label>
          </div>
        </div>
        <div class="RegistrationButtonGroup">
          <button
            id="RegisterButton"
            type="submit"
            class="ButtonClass SuccessButton ButtonFull"
            :disabled="!agreed || submitting"
          >
            <i class="fas fa-check" aria-hidden="true" />
            登録
          </button>
          <button
            id="BackToLoginButton"
            type="button"
            class="ButtonClass SecondaryButton ButtonFull"
            :disabled="submitting"
            @click="backToLogin"
          >
            <i class="fas fa-arrow-left" aria-hidden="true" />
            ログインへ
          </button>
        </div>
      </form>
    </div>
    <TermsDialog v-model="termsOpen" @error="dialogs.error" />
    <SpinnerOverlay :visible="busy" />
    <PageDialogHost :dialogs="dialogs" />
  </div>
</template>
