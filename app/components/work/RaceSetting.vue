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
import type { CharacterEntry, EntryDefinition } from '../../types/character';
import { parseEntry } from '../../utils/entryData';
const spinner = useOperationSpinner();
const props = defineProps<{
  request: BackendRequest;
  dialogs: PageDialogs;
  isAdmin: boolean;
  hideMeta?: boolean;
  targetId?: string;
  targetParentId?: string;
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
  return '種族設定（' + mode + '）';
});
const form = reactive({
  RaceName: '',
  Description: ''
});
const canEdit = computed(() => initialized.value && !!work.value && (props.isAdmin || isCreator.value));
const role = computed(() => props.isAdmin ? '管理者' : isCreator.value ? '作成者' : 'アシスタント');
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
});
const features = ref<CharacterEntry[]>([]);
const featureDefinition: EntryDefinition = {
  key: 'PhysicalFeature',
  label: '身体特徴',
  section: 'detail',
  columns: [{
    key: 'Content',
    label: '特徴',
    required: true,
    maxLength: 255
  }, {
    key: 'Detail',
    label: '特徴詳細',
    multiline: true
  }]
};
const columns: TableColumn[] = [{
  key: 'Detail',
  label: '詳細',
  width: 90
}, {
  key: 'RaceName',
  label: '種族名',
  sortable: true,
  filterable: true
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
      const data = requireSuccess(await props.request<Record<string, WorkSettingRow[]>>('/GetRaceList.php'), messageFormat('ERROR', 'E_0003', '種族一覧の取得'));
      if (!Array.isArray(data?.RaceList)) throw new Error(messageFormat('ERROR', 'E_0026'));
      if (disposed) return;
      rows.value = data.RaceList!;
      initialized.value = true;
      return true;
    });
    if (!finished) return;
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '種族一覧の取得'));
  } finally {
    if (!disposed) loading.value = false;
  }
}

/** 選択行をコピーし、公開メソッドで入力部品へセットする。更新日時は読み込み直さない。 */


function selectRow(row: WorkSettingRow) {
  if (saving.value) return;
  selected.value = {
    ...row
  };
  Object.assign(form, {
    RaceName: String(row.RaceName ?? ''),
    Description: String(row.Description ?? '')
  });
  fields.setValues(form);
  features.value = parseEntry(row.PhysicalFeature, featureDefinition);
  fields.setValue('PhysicalFeature', features.value);
  errors.value = {};
  opened.value = true;
}

/** 入力値、選択ID、更新日時と補助入力の内部状態をまとめて初期化する。 */


function clear() {
  if (!canEdit.value || saving.value) return;
  selected.value = null;
  Object.assign(form, {
    RaceName: '',
    Description: ''
  });
  fields.setValues(form);
  features.value = [];
  errors.value = {};
  formRevision.value++;
}

async function save() {
  if (!canEdit.value || saving.value || loading.value) return;
  const values = fields.getValues(form);
  errors.value = {};
  if (!values.RaceName.trim()) errors.value.RaceName = messageFormat('ERROR', 'E_0001', '種族名');
  if (values.RaceName.length > 50) errors.value.RaceName = messageFormat('ERROR', 'E_0002', '種族名', 50);
  const first = Object.keys(errors.value)[0];
  if (first) {
    await nextTick();
    fields.focus(first);
    return;
  }
  const payload: Record<string, unknown> = {
    ...values,
    RaceName: values.RaceName.trim(),
    RaceId: selected.value?.RaceId ?? null,
    UpdateDate: selected.value?.UpdateDate ?? null
  };
  const entries = fields.getValue('PhysicalFeature', [] as CharacterEntry[]);
  payload.PhysicalFeature = entries.length ? JSON.stringify({
    PhysicalFeature: entries
  }) : '';
  saving.value = true;
  let completed = false;
  try {
    const finished = await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed) return;
      requireSuccess(await props.request('/SaveRace.php', 'POST', payload), messageFormat('ERROR', 'E_0003', '種族の保存'));
      if (disposed) return;
      completed = true;
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(messageFormat('INFO', 'I_0011', '保存'), messageFormat('INFO', 'I_0001', '種族情報の保存'));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '種族の保存'));
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
  if (!row || !canEdit.value || saving.value || loading.value) return;
  saving.value = true;
  let completed = false;
  try {
    if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'この種族を削除'))) || disposed) return;
    const finished = await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed) return;
      requireSuccess(await props.request('/DeleteRace.php', 'POST', {
        RaceId: row.RaceId,
        UpdateDate: row.UpdateDate
      }), messageFormat('ERROR', 'E_0003', '種族の削除'));
      if (disposed) return;
      completed = true;
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(messageFormat('INFO', 'I_0011', '削除'), messageFormat('INFO', 'I_0001', '種族の削除'));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '種族の削除'));
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
onMounted(async () => {
  await load();
  if (!disposed && props.targetId) {
    const target = rows.value.find(row => String(row.RaceId) === props.targetId);
    if (target) selectRow(target);
  }
});
</script>

<template>
  <div>
    <WorkContentHeader
      title="種族設定"
      icon="fa-dna"
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
      row-key="RaceId"
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
        :aria-label="selected ? '種族編集' : '種族新規登録'"
      >
        <h3 class="FormSectionTitle">基本</h3>
        <div class="FormGrid">
          <TextFieldComponent
            :ref="el => fields.register('RaceName', el, form.RaceName)"
            label="種族名"
            :readonly="!canEdit"
            :error="errors.RaceName"
            required
            :maxlength="50"
          />
          <TextFieldComponent
            :ref="el => fields.register('Description', el, form.Description)"
            label="説明"
            :readonly="!canEdit"
            :error="errors.Description"
            text-area-flg
          />
        </div>
        <EntryTableEditor
          :ref="el => fields.register('PhysicalFeature', el, features)"
          :definition="featureDefinition"
          :readonly="!canEdit"
          :dialogs="dialogs"
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
