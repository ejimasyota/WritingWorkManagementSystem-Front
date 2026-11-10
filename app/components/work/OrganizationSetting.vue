<script setup lang="ts">
import { useOperationSpinner } from '../../composables/useOperationSpinner';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import type { BackendRequest } from '../../types/backend';
import type { WorkInfo } from '../../types/work';
import type { WorkSettingRow } from '../../types/workSettings';
import type { PageDialogs } from '../../composables/usePageDialogs';
import { metadataColumns, type TableColumn } from '../../composables/tableData';
import { useInputFields } from '../../composables/useInputFields';
import { readWorkAccess } from '../../utils/workAccess';
import { requireSuccess, reportBackendError } from '../../utils/backend';
import { messageFormat } from '../../utils/messages';
import type { CharacterImage } from '../../types/character';
import { restoreImages, imagePayload } from '../../utils/imageData';
import { compareFlexibleDates } from '../../utils/dates';
const spinner = useOperationSpinner();
const props = defineProps<{
  request: BackendRequest;
  dialogs: PageDialogs;
  isAdmin: boolean;
  hideMeta?: boolean;
}>();
const work = ref<WorkInfo>();
const isCreator = ref(false);
const initialized = ref(false);
const loading = ref(false);
const saving = ref(false);
const selected = ref<WorkSettingRow | null>(null);
const rows = ref<WorkSettingRow[]>([]);
const fields = useInputFields();
const errors = ref<Record<string, string>>({});
const formRevision = ref(0);
const opened = ref(false);
const dialogTitle = computed(() => {
  let mode = '新規登録';
  if (selected.value) mode = canEdit.value ? '編集' : '詳細';
  return '組織設定（' + mode + '）';
});
const form = reactive({
  OrgName: '',
  BaseBuildId: '',
  FoundedDate: '',
  PeopleNum: '',
  Purpose: '',
  Activity: '',
  Note: '',
  LeaderId: ''
});
const canEdit = computed(() => initialized.value && !!work.value && (props.isAdmin || isCreator.value));
const role = computed(() => props.isAdmin ? '管理者' : isCreator.value ? '作成者' : 'アシスタント');
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
});
const builds = ref<WorkSettingRow[]>([]);
const teams = ref<WorkSettingRow[]>([]);
const characters = ref<WorkSettingRow[]>([]);
const images = ref<CharacterImage[]>([]);
const readingImages = ref(false);
const buildOptions = computed(() => [{
  value: '',
  label: ''
}, ...builds.value.map(row => ({
  value: String(row.BuildId),
  label: String(row.BuildName)
}))]);
const leaderOptions = computed(() => [{
  value: '',
  label: ''
}, ...characters.value.map(row => ({
  value: String(row.CharaId),
  label: String(row.CharaName)
}))]);
const columns: TableColumn[] = [{
  key: 'Detail',
  label: '詳細',
  width: 90
}, {
  key: 'OrgName',
  label: '組織名',
  sortable: true,
  filterable: true
}, {
  key: 'LeaderName',
  label: 'リーダー',
  sortable: true,
  filterable: true
}, {
  key: 'BuildName',
  label: '拠点',
  sortable: true
}, {
  key: 'PeopleNum',
  label: '人数',
  sortable: true,
  type: 'number'
}, {
  key: 'FoundedDate',
  label: '設立日',
  sortable: true
}, ...metadataColumns()];

/** 初期表示と更新直前に作品・権限を確認する。別作品には編集中の値を送らない。 */


async function verifyAccess() {
  try {
    const access = await readWorkAccess(props.request, work.value?.WorkId);
    if (disposed) return false;
    work.value = access.work;
    isCreator.value = access.isCreator;
    return props.isAdmin || access.isCreator;
  } catch (error) {
    if (!disposed) {
      initialized.value = false;
      isCreator.value = false;
    }
    throw error;
  }
}

async function load() {
  if (disposed || loading.value || saving.value) return;
  loading.value = true;
  try {
    const finished = await spinner.run(async () => {
      await verifyAccess();
      if (disposed) return;
      const data = requireSuccess(await props.request<Record<string, WorkSettingRow[]>>('/GetOrganizationList.php'), messageFormat('ERROR', 'E_0003', '組織一覧の取得'));
      if (!Array.isArray(data?.OrganizationList) || !Array.isArray(data?.BuildList) || !Array.isArray(data?.CharaList) || !Array.isArray(data?.TeamList)) throw new Error(messageFormat('ERROR', 'E_0026'));
      if (disposed) return;
      rows.value = data.OrganizationList!;
      builds.value = data.BuildList!;
      characters.value = data.CharaList!;
      teams.value = data.TeamList!;
      initialized.value = true;
      return true;
    });
    if (!finished) return;
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '組織一覧の取得'));
  } finally {
    if (!disposed) loading.value = false;
  }
}

/** 選択行をコピーし、公開メソッドで入力部品へセットする。更新日時は読み込み直さない。 */


function selectRow(row: WorkSettingRow) {
  if (saving.value || readingImages.value) return;
  selected.value = {
    ...row
  };
  Object.assign(form, {
    OrgName: String(row.OrgName ?? ''),
    BaseBuildId: String(row.BaseBuildId ?? ''),
    FoundedDate: String(row.FoundedDate ?? ''),
    PeopleNum: String(row.PeopleNum ?? ''),
    Purpose: String(row.Purpose ?? ''),
    Activity: String(row.Activity ?? ''),
    Note: String(row.Note ?? ''),
    LeaderId: String(row.LeaderId ?? '')
  });
  fields.setValues(form);
  images.value = restoreImages(row);
  fields.setValue('Images', images.value);
  errors.value = {};
  opened.value = true;
}

/** 入力値、選択ID、更新日時と補助入力の内部状態をまとめて初期化する。 */


function clear() {
  if (!canEdit.value || saving.value || readingImages.value) return;
  selected.value = null;
  Object.assign(form, {
    OrgName: '',
    BaseBuildId: '',
    FoundedDate: '',
    PeopleNum: '',
    Purpose: '',
    Activity: '',
    Note: '',
    LeaderId: ''
  });
  fields.setValues(form);
  images.value = [];
  errors.value = {};
  formRevision.value++;
}

async function save() {
  if (!canEdit.value || saving.value || loading.value || readingImages.value) return;
  const values = fields.getValues(form);
  errors.value = {};
  if (!values.OrgName.trim()) errors.value.OrgName = messageFormat('ERROR', 'E_0001', '組織名');
  if (values.OrgName.length > 50) errors.value.OrgName = messageFormat('ERROR', 'E_0002', '組織名', 50);
  if (values.PeopleNum && !/^\d{1,15}$/.test(values.PeopleNum)) errors.value.PeopleNum = messageFormat('ERROR', 'E_0050', '人数', 15);
  const invalidTeam = teams.value.find(team => selected.value && String(team.OrgId) === String(selected.value.OrgId) && compareFlexibleDates(values.FoundedDate, String(team.FoundedDate || '')) === 1);
  if (invalidTeam) errors.value.FoundedDate = messageFormat('ERROR', 'E_0051', invalidTeam.TeamName, invalidTeam.FoundedDate);
  const first = Object.keys(errors.value)[0];
  if (first) {
    await nextTick();
    fields.focus(first);
    return;
  }
  const payload: Record<string, unknown> = {
    ...values,
    OrgName: values.OrgName.trim(),
    OrgId: selected.value?.OrgId ?? null,
    UpdateDate: selected.value?.UpdateDate ?? null
  };
  payload.Images = imagePayload(fields.getValue('Images', [] as CharacterImage[]));
  saving.value = true;
  let completed = false;
  try {
    const finished = await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed) return;
      requireSuccess(await props.request('/SaveOrganization.php', 'POST', payload), messageFormat('ERROR', 'E_0003', '組織の保存'));
      if (disposed) return;
      completed = true;
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(messageFormat('INFO', 'I_0011', '保存'), messageFormat('INFO', 'I_0001', '組織情報の保存'));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '組織の保存'));
  } finally {
    if (!disposed) saving.value = false;
  }
  if (completed && !disposed) {
    close();
    clear();
    await load();
  }
}

async function remove() {
  const row = selected.value;
  if (!row || !canEdit.value || saving.value || loading.value || readingImages.value) return;
  saving.value = true;
  let completed = false;
  try {
    if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'この組織を削除'))) || disposed) return;
    const finished = await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed) return;
      requireSuccess(await props.request('/DeleteOrganization.php', 'POST', {
        OrgId: row.OrgId,
        UpdateDate: row.UpdateDate
      }), messageFormat('ERROR', 'E_0003', '組織の削除'));
      if (disposed) return;
      completed = true;
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(messageFormat('INFO', 'I_0011', '削除'), messageFormat('INFO', 'I_0001', '組織の削除'));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '組織の削除'));
  } finally {
    if (!disposed) saving.value = false;
  }
  if (completed && !disposed) {
    clear();
    await load();
  }
}
/** 新規登録は入力状態を初期化してから同じダイアログを開く。 */

function openNew() {
  if (!canEdit.value || saving.value || loading.value) return;
  clear();
  opened.value = true;
}

function close() {
  opened.value = false;
}
onMounted(load);
</script>

<template>
  <div>
    <WorkContentHeader
      title="組織設定"
      icon="fa-building"
      :work-title="work?.WorkTitle"
      :role="work ? role : undefined"
    />
    <div
      v-if="canEdit"
      class="ButtonGroup"
    >
      <ButtonComponent
        type="button"
        variant="SuccessButton"
        @click="openNew"
      >
        <i
          class="fas fa-plus"
          aria-hidden="true"
        />
        追加
      </ButtonComponent>
    </div>
    <TableComponent
      :rows="rows"
      :columns="columns"
      row-key="OrgId"
      :hide-meta="hideMeta"
      :loading="loading"
    >
      <template #cell-Detail="{ row }">
        <ButtonComponent
          type="button"
          variant="PrimaryButton ButtonSmall"
          @click.stop="selectRow(row as WorkSettingRow)"
        >
          <i
            class="fas fa-eye"
            aria-hidden="true"
          />
          詳細
        </ButtonComponent>
      </template>
    </TableComponent>
    <BaseDialog
      v-model="opened"
      :title="dialogTitle"
      size="DialogLarge"
    >
      <section
        :key="formRevision"
        class="FormSection"
        :aria-label="selected ? '組織編集' : '組織新規登録'"
      >
        <h3 class="FormSectionTitle">基本</h3>
        <div class="FormGrid">
          <TextFieldComponent
            :ref="el => fields.register('OrgName', el, form.OrgName)"
            label="組織名"
            :readonly="!canEdit"
            :error="errors.OrgName"
            required
            :maxlength="50"
          />
          <SelectBoxComponent
            :ref="el => fields.register('BaseBuildId', el, form.BaseBuildId)"
            label="拠点建物"
            :options="buildOptions"
            :disabled="!canEdit"
            :error="errors.BaseBuildId"
          />
          <TextFieldComponent
            :ref="el => fields.register('FoundedDate', el, form.FoundedDate)"
            label="設立日"
            :readonly="!canEdit"
            :error="errors.FoundedDate"
            input-readonly
            :date-picker-flg="canEdit"
          />
          <TextFieldComponent
            :ref="el => fields.register('PeopleNum', el, form.PeopleNum)"
            label="人数"
            :readonly="!canEdit"
            :error="errors.PeopleNum"
            :maxlength="15"
            numeric-only
            inputmode="numeric"
          />
          <TextFieldComponent
            :ref="el => fields.register('Purpose', el, form.Purpose)"
            label="目的"
            :readonly="!canEdit"
            :error="errors.Purpose"
            text-area-flg
          />
          <TextFieldComponent
            :ref="el => fields.register('Activity', el, form.Activity)"
            label="活動内容"
            :readonly="!canEdit"
            :error="errors.Activity"
            text-area-flg
          />
          <TextFieldComponent
            :ref="el => fields.register('Note', el, form.Note)"
            label="備考"
            :readonly="!canEdit"
            :error="errors.Note"
            text-area-flg
          />
          <SelectBoxComponent
            :ref="el => fields.register('LeaderId', el, form.LeaderId)"
            label="リーダー"
            :options="leaderOptions"
            :disabled="!canEdit"
            :error="errors.LeaderId"
          />
        </div>
        <ImageListEditor
          :ref="el => fields.register('Images', el, images)"
          :readonly="!canEdit"
          :dialogs="dialogs"
          @reading="readingImages = $event"
        />
      </section>
      <template #actions>
        <ButtonComponent
          type="button"
          variant="CloseButton"
          @click="close"
        >
          <i
            class="fas fa-times"
            aria-hidden="true"
          />
          閉じる
        </ButtonComponent>
        <template v-if="canEdit">
          <ButtonComponent
            type="button"
            variant="ClearButton"
            @click="clear"
          >
            <i
              class="fas fa-sync"
              aria-hidden="true"
            />
            クリア
          </ButtonComponent>
          <ButtonComponent
            v-if="selected"
            type="button"
            variant="DeleteButton"
            @click="remove"
          >
            <i
              class="fas fa-trash"
              aria-hidden="true"
            />
            削除
          </ButtonComponent>
          <ButtonComponent
            type="button"
            variant="SaveButton"
            @click="save"
          >
            <i
              class="fas fa-save"
              aria-hidden="true"
            />
            保存
          </ButtonComponent>
        </template>
      </template>
    </BaseDialog>
  </div>
</template>
