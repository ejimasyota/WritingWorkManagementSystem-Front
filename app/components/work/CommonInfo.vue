<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import type { BackendRequest } from '../../types/backend';
import type { WorkInfo, WorkPermission } from '../../types/work';
import type { PageDialogs } from '../../composables/usePageDialogs';
import { reportBackendError, requireSuccess } from '../../utils/backend';
import { genreOptions } from '../../utils/mainView';
import { motifOptions, settingDateConfirmation, workInfoForm, workInfoPayload } from '../../utils/workInfo';

const props = defineProps<{
  request: BackendRequest;
  dialogs: PageDialogs;
  isAdmin: boolean;
}>();
const emit = defineEmits(['unavailable']);
const original = ref<WorkInfo>();
const isCreator = ref(false);
const saving = ref(false);
const titleError = ref('');
const titleField = ref<{ focus: () => void }>();
const form = reactive({ WorkTitle: '', Genre: 0, SettingDate: '', Motif: 0, Theme: '', Description: '' });
const roleLabel = computed(() => props.isAdmin ? '管理者' : isCreator.value ? '作成者' : 'アシスタント');
const canEdit = computed(() => !!original.value && (isCreator.value || props.isAdmin));
let disposed = false;
onBeforeUnmount(() => { disposed = true; });

/** 情報と権限が両方取得できてから表示し、取得失敗を編集可能として扱わない。 */
async function load() {
  try {
    const work = requireSuccess(await props.request<WorkInfo>('/GetWorkInfo.php'), '作品情報の取得に失敗しました');
    if (disposed) return;
    const permission = requireSuccess(await props.request<WorkPermission>('/GetUserPermission.php'), '権限情報の取得に失敗しました');
    if (disposed) return;
    original.value = work;
    isCreator.value = permission.IsCreator === true;
    Object.assign(form, workInfoForm(work));
    titleError.value = '';
  } catch (error) {
    if (disposed) return;
    original.value = undefined;
    isCreator.value = false;
    await reportBackendError(props.dialogs, error, '作品情報の取得中にエラーが発生しました');
    if (!disposed) emit('unavailable');
  }
}

async function save() {
  const work = original.value;
  if (!work || !canEdit.value || saving.value) return;
  titleError.value = '';
  const payload = workInfoPayload(form, work);
  if (!payload.WorkTitle) {
    titleError.value = '作品名を入力してください';
    titleField.value?.focus();
    return;
  }
  saving.value = true;
  try {
    const beforeDate = (work.SettingDate || '').trim();
    if (payload.SettingDate !== beforeDate
      && !await props.dialogs.confirm(settingDateConfirmation(beforeDate, payload.SettingDate))) return;
    if (disposed || !canEdit.value) return;

    // PHPの作品IDはセッション共用。別タブで作品が変わった場合は誤った作品へ保存しない。
    const current = requireSuccess(await props.request<WorkInfo>('/GetWorkInfo.php'), '作品情報の取得に失敗しました');
    if (disposed) return;
    const permission = requireSuccess(await props.request<WorkPermission>('/GetUserPermission.php'), '権限情報の取得に失敗しました');
    if (disposed) return;
    isCreator.value = permission.IsCreator === true;
    if (current.WorkId !== work.WorkId) {
      throw new Error('選択中の作品が変更されました。作品一覧から開き直してください');
    }
    if (!canEdit.value) throw new Error('この作品を編集する権限がありません');
    // 再確認で得た更新日時には置換しない。編集中の競合は既存APIの楽観ロックに委ねる。
    requireSuccess(await props.request('/UpdateWorkInfo.php', 'POST', payload), '保存に失敗しました');
    if (disposed) return;
    await props.dialogs.info('保存完了', '作品情報を保存しました');
    if (!disposed) await load();
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, '保存中にエラーが発生しました');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <WorkContentHeader title="作品共通情報" icon="fa-info-circle" :work-title="original?.WorkTitle" :role="original ? roleLabel : undefined" />
    <form v-if="original" novalidate :aria-busy="saving" @submit.prevent="save">
      <TextFieldComponent
        ref="titleField" v-model="form.WorkTitle" label="作品名" required maxlength="100"
        :error="titleError" :disabled="!canEdit"
      />
      <SelectBoxComponent v-model="form.Genre" label="ジャンル" :options="genreOptions" :disabled="!canEdit" />
      <TextFieldComponent
        v-model="form.SettingDate" label="舞台設定日" input-readonly
        :date-picker-flg="canEdit" :disabled="!canEdit"
      />
      <SelectBoxComponent v-model="form.Motif" label="題材・モチーフ" :options="motifOptions" :disabled="!canEdit" />
      <TextFieldComponent v-model="form.Theme" label="テーマ" maxlength="100" :disabled="!canEdit" />
      <!-- 閲覧者も概要を展開できるよう、disabledではなくreadonlyで制御する。 -->
      <TextFieldComponent
        v-model="form.Description" label="概要" text-area-flg :readonly="!canEdit"
      />
      <div v-if="canEdit" class="ButtonGroup">
        <ButtonComponent type="submit" variant="SaveButton">
          <i class="fas fa-save" aria-hidden="true" /> 保存
        </ButtonComponent>
      </div>
    </form>
  </div>
</template>
