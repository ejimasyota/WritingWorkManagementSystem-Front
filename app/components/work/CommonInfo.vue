<script setup lang="ts">
import { useOperationSpinner } from '../../composables/useOperationSpinner';

import { useInputFields } from '../../composables/useInputFields';
import { messageFormat } from '../../utils/messages';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import type { BackendRequest } from '../../types/backend';
import type { WorkInfo, WorkPermission, WorkInfoForm } from '../../types/work';
import type { PageDialogs } from '../../composables/usePageDialogs';
import { reportBackendError, requireSuccess } from '../../utils/backend';
import { genreOptions } from '../../utils/mainView';
import type { SelectOption } from '../../types/utilType';
const spinner = useOperationSpinner();


const inputFields = useInputFields();

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
const form = reactive({ WorkTitle: '', Genre: 0, SettingDate: '', Motif: 0, Theme: '', Description: '' });
const roleLabel = computed(() => props.isAdmin ? '管理者' : isCreator.value ? '作成者' : 'アシスタント');
const canEdit = computed(() => !!original.value && (isCreator.value || props.isAdmin));
let disposed = false;
onBeforeUnmount(() => { disposed = true; });

/** 情報と権限が両方取得できてから表示し、取得失敗を編集可能として扱わない。 */
async function load() {
  try {
    const finished = await spinner.run(async () => {
      const work = requireSuccess(await props.request<WorkInfo>('/GetWorkInfo.php'), messageFormat('ERROR', 'E_0003', '作品情報の取得'));
      if (disposed) return;
      const permission = requireSuccess(await props.request<WorkPermission>('/GetUserPermission.php'), messageFormat('ERROR', 'E_0003', '権限情報の取得'));
      if (disposed) return;
      original.value = work;
      isCreator.value = permission.IsCreator === true;
      Object.assign(form, workInfoForm(work));
      inputFields.setValues(form);
      titleError.value = '';
      return true;
    });
    if (!finished) return;
  } catch (error) {
    if (disposed) return;
    original.value = undefined;
    isCreator.value = false;
    await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '作品情報の取得'));
    if (!disposed) emit('unavailable');
  }
}

async function save() {
  const work = original.value;
  if (!work || !canEdit.value || saving.value) return;
  titleError.value = '';
  Object.assign(form, inputFields.getValues(form));
  const payload = workInfoPayload(form, work);
  if (!payload.WorkTitle) {
    titleError.value = messageFormat('ERROR', 'E_0001', '作品名');
    inputFields.focus('WorkTitle');
    return;
  }
  saving.value = true;
  try {
    const beforeDate = (work.SettingDate || '').trim();
    if (payload.SettingDate !== beforeDate
      && !await props.dialogs.confirm(settingDateConfirmation(beforeDate, payload.SettingDate))) return;
    if (disposed || !canEdit.value) return;

    // PHPの作品IDはセッション共用。別タブで作品が変わった場合は誤った作品へ保存しない。
    const finished = await spinner.run(async () => {
      const current = requireSuccess(await props.request<WorkInfo>('/GetWorkInfo.php'), messageFormat('ERROR', 'E_0003', '作品情報の取得'));
      if (disposed) return;
      const permission = requireSuccess(await props.request<WorkPermission>('/GetUserPermission.php'), messageFormat('ERROR', 'E_0003', '権限情報の取得'));
      if (disposed) return;
      isCreator.value = permission.IsCreator === true;
      if (current.WorkId !== work.WorkId) {
        throw new Error(messageFormat('ERROR', 'E_0028'));
      }
      if (!canEdit.value) throw new Error(messageFormat('ERROR', 'E_0029'));
      // 再確認で得た更新日時には置換しない。編集中の競合は既存APIの楽観ロックに委ねる。
      requireSuccess(await props.request('/UpdateWorkInfo.php', 'POST', payload), messageFormat('ERROR', 'E_0003', '保存'));
      if (disposed) return;
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(messageFormat('INFO', 'I_0011', '保存'), messageFormat('INFO', 'I_0001', '作品情報の保存'));
    if (!disposed) await load();
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '保存'));
  } finally {
    saving.value = false;
  }
}

onMounted(load);
/** 旧 Common.js / PullDownList('Motif') の区分値と表示順を維持する。 */
const motifOptions: SelectOption[] = [
  { value: 0, label: '' },
  ...['海賊', '忍者', '神話', 'エクソシスト', '侍・武士', '魔法・魔術', 'ロボット・メカ',
    '吸血鬼', '妖怪・怪異', '宇宙', '近未来・サイバーパンク', 'スチームパンク', 'ゾンビ',
    '軍事・ミリタリー', '探偵・ミステリー', '錬金術', '死神', '怪盗']
    .map((label, index) => ({ value: index + 1, label })),
]

function workInfoForm(work: WorkInfo) {
  return {
    WorkTitle: work.WorkTitle,
    Genre: Number(work.Genre),
    SettingDate: work.SettingDate || '',
    Motif: Number(work.Motif || 0),
    Theme: work.Theme || '',
    Description: work.Description || '',
  }
}


/** 入力欄と概要ダイアログは同じ値を共有し、保存時にだけ前後の空白を除く。 */
function workInfoPayload(form: WorkInfoForm, original: WorkInfo) {
  return {
    WorkTitle: form.WorkTitle.trim(),
    Genre: Number(form.Genre),
    SettingDate: form.SettingDate.trim(),
    Motif: Number(form.Motif),
    Theme: form.Theme.trim(),
    Description: form.Description.trim(),
    UpdateDate: original.UpdateDate,
  }
}

function settingDateConfirmation(before: string, after: string) {
  return messageFormat('CONFIRM', 'C_0011', before || '未設定', after || '未設定');
}
</script>

<template>
  <div>
    <WorkContentHeader title="作品共通情報" icon="fa-info-circle" :work-title="original?.WorkTitle" :role="original ? roleLabel : undefined" />
    <form v-if="original" novalidate :aria-busy="saving" @submit.prevent="save">
      <TextFieldComponent
         :ref="el => inputFields.register('WorkTitle', el, form.WorkTitle)" label="作品名" required maxlength="100"
        :error="titleError" :disabled="!canEdit"
      />
      <SelectBoxComponent :ref="el => inputFields.register('Genre', el, form.Genre)" label="ジャンル" :options="genreOptions" :disabled="!canEdit" />
      <TextFieldComponent
        :ref="el => inputFields.register('SettingDate', el, form.SettingDate)" label="舞台設定日" input-readonly
        :date-picker-flg="canEdit" :disabled="!canEdit"
      />
      <SelectBoxComponent :ref="el => inputFields.register('Motif', el, form.Motif)" label="題材・モチーフ" :options="motifOptions" :disabled="!canEdit" />
      <TextFieldComponent :ref="el => inputFields.register('Theme', el, form.Theme)" label="テーマ" maxlength="100" :disabled="!canEdit" />
      <!-- 閲覧者も概要を展開できるよう、disabledではなくreadonlyで制御する。 -->
      <TextFieldComponent
        :ref="el => inputFields.register('Description', el, form.Description)" label="概要" text-area-flg :readonly="!canEdit"
      />
      <div v-if="canEdit" class="ButtonGroup">
        <ButtonComponent type="submit" variant="SaveButton">
          <i class="fas fa-save" aria-hidden="true" /> 保存
        </ButtonComponent>
      </div>
    </form>
  </div>
</template>
