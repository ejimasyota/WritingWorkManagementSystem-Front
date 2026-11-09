<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import type { BackendRequest } from '../types/backend';
import type { PageDialogs } from '../composables/usePageDialogs';
import { reportBackendError, requireSuccess } from '../utils/backend';
import { formatDateWithWeekday } from '../utils/mainView';
const props = defineProps<{
  modelValue: boolean;
  userId: string;
  request: BackendRequest;
  dialogs: PageDialogs;
}>();
const emit = defineEmits(['update:modelValue', 'appearance']);
const registrationDate = ref('-');
const dark = ref(false);
const hideMeta = ref(false);
const passwordOpen = ref(false);
const password = reactive({
  current: '',
  next: '',
  confirm: ''
});
const errors = ref<Record<string, string>>({});
watch(() => props.modelValue, async open => {
  if (!open) return;
  dark.value = document.body.classList.contains('DarkMode');
  hideMeta.value = document.body.classList.contains('HideMetaColumns');
  registrationDate.value = '-';
  try {
    const data = requireSuccess(await props.request<{
      RegistDate: string;
    }>('/GetUserInfo.php'), '取得に失敗しました');
    registrationDate.value = formatDateWithWeekday(data.RegistDate);
  } catch {
    // 旧実装同様、作成日だけの取得失敗では設定操作を妨げない。
  }
});
function appearance() {
  document.body.classList.toggle('DarkMode', dark.value);
  document.body.classList.toggle('HideMetaColumns', hideMeta.value);
  localStorage.setItem('DarkMode', String(dark.value));
  localStorage.setItem('HideMetaColumns', String(hideMeta.value));
  emit('appearance', hideMeta.value);
}
function close() {
  emit('update:modelValue', false);
}
function openPassword() {
  password.current = '';
  password.next = '';
  password.confirm = '';
  errors.value = {};
  passwordOpen.value = true;
}
async function changePassword() {
  const current = password.current.trim();
  const next = password.next.trim();
  const confirm = password.confirm.trim();
  errors.value = {};
  if (current.length < 8) errors.value.current = '現在のパスワードは8桁以上で入力してください';
  if (next.length < 8 || !/[0-9]/.test(next) || next === current || next === props.userId) {
    errors.value.next = '新しいパスワードは現在のパスワードと異なる数値を含んだ8桁以上で、ユーザーIDとも異なる値を設定してください';
  }
  if (!confirm || confirm !== next) errors.value.confirm = '入力されたパスワードが一致しません';
  if (Object.keys(errors.value).length) return;
  passwordOpen.value = false;
  try {
    requireSuccess(await props.request('/ChangePassword.php', 'POST', {
      CurrentPassword: current,
      NewPassword: next
    }), 'パスワード変更に失敗しました');
    await props.dialogs.info('変更完了', 'パスワードを変更しました');
  } catch (error) {
    await reportBackendError(props.dialogs, error, 'パスワード変更中にエラーが発生しました');
  } finally {
    password.current = '';
    password.next = '';
    password.confirm = '';
  }
}
</script>

<template>
  <BaseDialog
    :model-value="modelValue"
    title="設定"
    title-icon="fas fa-cog"
    centered-actions
    @update:model-value="close"
  >
    <div class="SettingsSection">
      <div class="SettingsSectionTitle">
        アカウント
      </div>
      <div class="SettingsRow">
        <span class="SettingsRowLabel">
          アカウント作成日
        </span>
        <span class="ReadOnlyValue">
          {{ registrationDate }}
        </span>
      </div>
    </div>
    <div class="SettingsSection">
      <div class="SettingsSectionTitle">
        表示設定
      </div>
      <ToogleComponent v-model="dark" inline wrapper-class="SettingsRow SettingsDarkModeRow" aria-label="ダークモード" @change="appearance">
        <span class="SettingsRowLabel">ダークモード</span>
      </ToogleComponent>
      <ToogleComponent v-model="hideMeta" inline wrapper-class="SettingsRow" aria-label="メタ情報非表示" @change="appearance">
        <span class="SettingsRowLabel">メタ情報非表示</span>
      </ToogleComponent>
    </div>
    <div class="SettingsSection">
      <ButtonComponent type="button" variant="PrimaryButton ButtonFull" @click="openPassword">
        <i class="fas fa-key" />
        パスワード変更
      </ButtonComponent>
    </div>
    <template #actions>
      <ButtonComponent type="button" variant="CloseButton" @click="close">
        <i class="fas fa-times" />
        閉じる
      </ButtonComponent>
    </template>
  </BaseDialog>
  <BaseDialog v-model="passwordOpen" title="パスワード変更">
    <form id="ChangePasswordForm" novalidate @submit.prevent="changePassword">
      <TextFieldComponent
        v-model="password.current"
        label="現在のパスワード"
        type="password"
        maxlength="12"
        autocomplete="current-password"
        :error="errors.current"
        required
      />
      <TextFieldComponent
        v-model="password.next"
        label="新しいパスワード"
        type="password"
        maxlength="12"
        autocomplete="new-password"
        :error="errors.next"
        required
      />
      <TextFieldComponent
        v-model="password.confirm"
        label="確認用"
        type="password"
        maxlength="12"
        autocomplete="new-password"
        :error="errors.confirm"
        required
      />
    </form>
    <template #actions>
      <ButtonComponent type="button" variant="CloseButton" @click="passwordOpen = false">
        <i class="fas fa-times" />
        閉じる
      </ButtonComponent>
      <ButtonComponent type="submit" form="ChangePasswordForm" variant="SaveButton">
        <i class="fas fa-key" />
        変更
      </ButtonComponent>
    </template>
  </BaseDialog>
</template>
