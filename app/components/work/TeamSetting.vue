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
  return 'チーム設定（' + mode + '）';
});
const form = reactive({
  TeamName: '',
  OrgId: '',
  LeaderId: '',
  PeopleNum: '',
  FoundedDate: '',
  Description: ''
});
const canEdit = computed(() => initialized.value && !!work.value && (props.isAdmin || isCreator.value));
const role = computed(() => props.isAdmin ? '管理者' : isCreator.value ? '作成者' : 'アシスタント');
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
});
const organizations = ref<WorkSettingRow[]>([]);
const characters = ref<WorkSettingRow[]>([]);
const images = ref<CharacterImage[]>([]);
const readingImages = ref(false);
const organizationOptions = computed(() => [{
  value: '',
  label: ''
}, ...organizations.value.map(row => ({
  value: String(row.OrgId),
  label: String(row.OrgName)
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
  key: 'TeamName',
  label: 'チーム名',
  sortable: true,
  filterable: true
}, {
  key: 'LeaderName',
  label: 'リーダー',
  sortable: true,
  filterable: true
}, {
  key: 'OrgName',
  label: '所属組織',
  sortable: true,
  filterable: true
}, {
  key: 'PeopleNum',
  label: '人数',
  sortable: true,
  type: 'number'
}, {
  key: 'FoundedDate',
  label: '結成日',
  sortable: true
}, {
  key: 'Description',
  label: '説明',
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
      const data = requireSuccess(await props.request<Record<string, WorkSettingRow[]>>('/GetTeamList.php'), messageFormat('ERROR', 'E_0003', 'チーム一覧の取得'));
      if (!Array.isArray(data?.TeamList) || !Array.isArray(data?.OrganizationList) || !Array.isArray(data?.CharaList)) throw new Error(messageFormat('ERROR', 'E_0026'));
      if (disposed) return;
      rows.value = data.TeamList!;
      organizations.value = data.OrganizationList!;
      characters.value = data.CharaList!;
      initialized.value = true;
      return true;
    });
    if (!finished) return;
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'チーム一覧の取得'));
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
    TeamName: String(row.TeamName ?? ''),
    OrgId: String(row.OrgId ?? ''),
    LeaderId: String(row.LeaderId ?? ''),
    PeopleNum: String(row.PeopleNum ?? ''),
    FoundedDate: String(row.FoundedDate ?? ''),
    Description: String(row.Description ?? '')
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
    TeamName: '',
    OrgId: '',
    LeaderId: '',
    PeopleNum: '',
    FoundedDate: '',
    Description: ''
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
  if (!values.TeamName.trim()) errors.value.TeamName = messageFormat('ERROR', 'E_0001', 'チーム名');
  if (values.TeamName.length > 50) errors.value.TeamName = messageFormat('ERROR', 'E_0002', 'チーム名', 50);
  if (values.PeopleNum && !/^\d{1,15}$/.test(values.PeopleNum)) errors.value.PeopleNum = messageFormat('ERROR', 'E_0050', '人数', 15);
  const organization = organizations.value.find(row => String(row.OrgId) === String(values.OrgId));
  if (organization && compareFlexibleDates(values.FoundedDate, String(organization.FoundedDate || '')) === -1) errors.value.FoundedDate = messageFormat('ERROR', 'E_0052', organization.FoundedDate);
  const first = Object.keys(errors.value)[0];
  if (first) {
    await nextTick();
    fields.focus(first);
    return;
  }
  const payload: Record<string, unknown> = {
    ...values,
    TeamName: values.TeamName.trim(),
    TeamId: selected.value?.TeamId ?? null,
    UpdateDate: selected.value?.UpdateDate ?? null
  };
  payload.Images = imagePayload(fields.getValue('Images', [] as CharacterImage[]));
  saving.value = true;
  let completed = false;
  try {
    const finished = await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed) return;
      requireSuccess(await props.request('/SaveTeam.php', 'POST', payload), messageFormat('ERROR', 'E_0003', 'チームの保存'));
      if (disposed) return;
      completed = true;
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(messageFormat('INFO', 'I_0011', '保存'), messageFormat('INFO', 'I_0001', 'チーム情報の保存'));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'チームの保存'));
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
    if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'このチームを削除'))) || disposed) return;
    const finished = await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed) return;
      requireSuccess(await props.request('/DeleteTeam.php', 'POST', {
        TeamId: row.TeamId,
        UpdateDate: row.UpdateDate
      }), messageFormat('ERROR', 'E_0003', 'チームの削除'));
      if (disposed) return;
      completed = true;
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(messageFormat('INFO', 'I_0011', '削除'), messageFormat('INFO', 'I_0001', 'チームの削除'));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'チームの削除'));
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
      title="チーム設定"
      icon="fa-users"
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
      row-key="TeamId"
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
        :aria-label="selected ? 'チーム編集' : 'チーム新規登録'"
      >
        <h3 class="FormSectionTitle">基本</h3>
        <div class="FormGrid">
          <TextFieldComponent
            :ref="el => fields.register('TeamName', el, form.TeamName)"
            label="チーム名"
            :readonly="!canEdit"
            :error="errors.TeamName"
            required
            :maxlength="50"
          />
          <SelectBoxComponent
            :ref="el => fields.register('OrgId', el, form.OrgId)"
            label="所属組織"
            :options="organizationOptions"
            :disabled="!canEdit"
            :error="errors.OrgId"
          />
          <SelectBoxComponent
            :ref="el => fields.register('LeaderId', el, form.LeaderId)"
            label="リーダー"
            :options="leaderOptions"
            :disabled="!canEdit"
            :error="errors.LeaderId"
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
            :ref="el => fields.register('FoundedDate', el, form.FoundedDate)"
            label="結成日"
            :readonly="!canEdit"
            :error="errors.FoundedDate"
            input-readonly
            :date-picker-flg="canEdit"
          />
          <TextFieldComponent
            :ref="el => fields.register('Description', el, form.Description)"
            label="説明"
            :readonly="!canEdit"
            :error="errors.Description"
            text-area-flg
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
