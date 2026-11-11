<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, reactive, ref } from 'vue';
import { useOperationSpinner } from '../../composables/useOperationSpinner';
import { useInputFields } from '../../composables/useInputFields';
import { metadataColumns, type TableColumn } from '../../composables/tableData';
import type { BackendRequest } from '../../types/backend';
import type { WorkInfo } from '../../types/work';
import type { WorkSettingRow } from '../../types/workSettings';
import type { PageDialogs } from '../../composables/usePageDialogs';
import { readWorkAccess } from '../../utils/workAccess';
import { requireSuccess, reportBackendError } from '../../utils/backend';
import { messageFormat } from '../../utils/messages';
import type { CharacterEntry, EntryDefinition } from '../../types/character';
import { parseEntry, formatEntry } from '../../utils/entryData';
const props = defineProps<{
  request: BackendRequest;
  dialogs: PageDialogs;
  isAdmin: boolean;
  hideMeta?: boolean;
  targetId?: string;
  targetParentId?: string;
}>();
const spinner = useOperationSpinner();
const fields = useInputFields();
const work = ref<WorkInfo>();
const isCreator = ref(false);
const initialized = ref(false);
const loading = ref(false);
const saving = ref(false);
const opened = ref(false);
const revision = ref(0);
const rows = ref<WorkSettingRow[]>([]);
const selected = ref<WorkSettingRow | null>(null);
const errors = ref<Record<string, string>>({});
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
});
const form = reactive({
  "MoveName": "",
  "PowerId": "",
  "Description": ""
});
const canAdd = computed(() => initialized.value && !!work.value && (props.isAdmin || isCreator.value));
const canEdit = canAdd;
const dialogTitle = computed(() => '技設定（' + (selected.value ? canEdit.value ? '編集' : '詳細' : '新規登録') + '）');
const role = computed(() => props.isAdmin ? '管理者' : isCreator.value ? '作成者' : 'アシスタント');
const conditions = ref<CharacterEntry[]>([]);
const conditionsDefinition: EntryDefinition = {
  "key": "Conditions",
  "label": "発動条件",
  "section": "detail",
  "columns": [{
    "key": "Content",
    "label": "条件",
    "required": true,
    "maxLength": 255
  }, {
    "key": "Detail",
    "label": "条件詳細",
    "multiline": true
  }]
};
const risk = ref<CharacterEntry[]>([]);
const riskDefinition: EntryDefinition = {
  "key": "Risk",
  "label": "代償・副作用",
  "section": "detail",
  "columns": [{
    "key": "Content",
    "label": "代償・副作用",
    "required": true,
    "maxLength": 255
  }, {
    "key": "Detail",
    "label": "詳細",
    "multiline": true
  }]
};
const options = ref<WorkSettingRow[]>([]);
const PowerIdOptions = computed(() => [{
  value: '',
  label: ''
}, ...options.value.map(row => ({
  value: String(row.PowerId),
  label: String(row.PowerName)
}))]);
const selectedPowerId = ref('');

function changePower() {
  selectedPowerId.value = fields.getValue('PowerId', '');
}

async function showPowerDetail() {
  const power = options.value.find(row => String(row.PowerId) === fields.getValue('PowerId', ''));
  if (!power) return;
  const unset = messageFormat('INFO', 'I_0071');
  await props.dialogs.info(messageFormat('INFO', 'I_0079'), messageFormat('INFO', 'I_0080', power.PowerName || unset, power.Description || unset, formatEntry(power.Conditions, conditionsDefinition) || unset, formatEntry(power.Risk, riskDefinition) || unset), 'left');
}
const columns: TableColumn[] = [{
  "key": "Detail",
  "label": "詳細",
  "width": 90
}, {
  "key": "MoveName",
  "label": "技名",
  "sortable": true,
  "filterable": true
}, {
  "key": "PowerName",
  "label": "関連能力",
  "sortable": true,
  "filterable": true
}, {
  "key": "Description",
  "label": "説明",
  "sortable": true,
  "filterable": false
}, {
  "key": "Conditions",
  "format": value => formatEntry(value, conditionsDefinition),
  "label": "発動条件",
  "sortable": true,
  "filterable": false
}, {
  "key": "Risk",
  "format": value => formatEntry(value, riskDefinition),
  "label": "代償・副作用",
  "sortable": true,
  "filterable": false
}, ...metadataColumns()];

/** 初期化と保存直前の権限確認は、この画面の作品IDに照合する。 */


async function verifyAccess() {
  try {
    const access = await readWorkAccess(props.request, work.value?.WorkId);
    if (disposed) return false;
    work.value = access.work;
    isCreator.value = access.isCreator;
    return props.isAdmin || access.isCreator;
  } catch (error) {
    initialized.value = false;
    isCreator.value = false;
    throw error;
  }
}

async function load() {
  if (disposed || loading.value || saving.value) return;
  loading.value = true;
  try {
    await spinner.run(async () => {
      await verifyAccess();
      if (disposed) return;
      const data = requireSuccess(await props.request<Record<string, WorkSettingRow[]>>('/GetMoveList.php'), messageFormat('ERROR', 'E_0003', '技設定の取得'));
      if (!Array.isArray(data?.MoveList)) throw new Error(messageFormat('ERROR', 'E_0026'));
      if (!Array.isArray(data.PowerList)) throw new Error(messageFormat('ERROR', 'E_0026'));
      options.value = data.PowerList;
      if (disposed) return;
      rows.value = data.MoveList;
      initialized.value = true;
    });
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '技設定の取得'));
  } finally {
    if (!disposed) loading.value = false;
  }
}

/** 行の更新日時を保持し、入力部品の公開メソッドへ初期値を渡す。 */


function selectRow(row: WorkSettingRow) {
  if (saving.value || loading.value) return;
  selected.value = {
    ...row
  };
  form.MoveName = String(row.MoveName ?? '');
  selectedPowerId.value = String(row.PowerId || '');
  form.PowerId = String(row.PowerId ?? '');
  form.Description = String(row.Description ?? '');
  conditions.value = parseEntry(row.Conditions, conditionsDefinition);
  risk.value = parseEntry(row.Risk, riskDefinition);
  fields.setValues(form);
  errors.value = {};
  revision.value++;
  opened.value = true;
}

function clear() {
  if (saving.value) return;
  selectedPowerId.value = '';
  selected.value = null;
  Object.assign(form, {
    "MoveName": "",
    "PowerId": "",
    "Description": ""
  });
  conditions.value = [];
  risk.value = [];
  fields.setValues(form);
  errors.value = {};
  revision.value++;
}

function openNew() {
  if (!canAdd.value || saving.value || loading.value) return;
  clear();
  opened.value = true;
}

function close() {
  if (saving.value) return;
  opened.value = false;
  clear();
}

async function save() {
  if (!canEdit.value || saving.value || loading.value) return;
  const values = fields.getValues(form);
  errors.value = {};
  if (!values.MoveName.trim()) errors.value.MoveName = messageFormat('ERROR', 'E_0001', '技名');
  if (values.MoveName.length > 50) errors.value.MoveName = messageFormat('ERROR', 'E_0002', '技名', 50);
  const first = Object.keys(errors.value)[0];
  if (first) {
    await nextTick();
    fields.focus(first);
    return;
  }
  const payload: Record<string, unknown> = {
    ...values,
    MoveId: selected.value?.MoveId ?? null,
    UpdateDate: selected.value?.UpdateDate ?? null
  };
  payload.Conditions = JSON.stringify({
    Conditions: fields.getValue('Conditions', [] as CharacterEntry[])
  });
  payload.Risk = JSON.stringify({
    Risk: fields.getValue('Risk', [] as CharacterEntry[])
  });
  await persist('/SaveMove.php', payload, '保存');
}

async function remove() {
  const row = selected.value;
  if (!row || !canEdit.value || saving.value || loading.value) return;
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'この技設定を削除'))) || disposed) return;
  await persist('/DeleteMove.php', {
    MoveId: row.MoveId,
    UpdateDate: row.UpdateDate
  }, '削除');
}
/** 1操作につき1回のスピナー。保存失敗時は入力と選択行を保持する。 */


async function persist(endpoint: string, payload: Record<string, unknown>, operation: string) {
  if (saving.value || disposed || !canEdit.value) return;
  saving.value = true;
  let completed = false;
  try {
    await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed || !canEdit.value) return;
      requireSuccess(await props.request(endpoint, 'POST', payload), messageFormat('ERROR', 'E_0003', '技設定の' + operation));
      if (!disposed) completed = true;
    });
    if (completed && !disposed) await props.dialogs.info(messageFormat('INFO', 'I_0011', operation), messageFormat('INFO', 'I_0001', '技設定の' + operation));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '技設定の' + operation));
  } finally {
    if (!disposed) saving.value = false;
  }
  if (completed && !disposed) {
    close();
    await load();
  }
}
onMounted(async () => {
  await load();
  if (!disposed && props.targetId) {
    const target = rows.value.find(row => String(row.MoveId) === props.targetId);
    if (target) selectRow(target);
  }
});
</script>

<template>
  <div>
    <WorkContentHeader
      title="技設定"
      icon="fa-fire"
      :work-title="work?.WorkTitle"
      :role="work ? role : undefined"
    />
    <div
      v-if="canAdd"
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
      row-key="MoveId"
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
        :key="revision"
        class="FormSection"
      >
        <h3 class="FormSectionTitle">基本</h3>
        <div class="FormGrid">
          <TextFieldComponent
            :ref="el => fields.register('MoveName', el, form.MoveName)"
            label="技名"
            :readonly="!canEdit"
            :error="errors.MoveName"
            :maxlength="50"
            required
          />
          <SelectBoxComponent
            :ref="el => fields.register('PowerId', el, form.PowerId)"
            label="関連能力"
            :options="PowerIdOptions"
            :disabled="!canEdit"
            :error="errors.PowerId"
            @value-change="changePower"
          />
          <ButtonComponent
            type="button"
            variant="SecondaryButton"
            :disabled="!selectedPowerId"
            @click="showPowerDetail"
          >
            <i
              class="fas fa-info-circle"
              aria-hidden="true"
            />
            能力詳細
          </ButtonComponent>
          <TextFieldComponent
            :ref="el => fields.register('Description', el, form.Description)"
            label="説明"
            :readonly="!canEdit"
            :error="errors.Description"
            text-area-flg
          />
        </div>
        <EntryTableEditor
          :ref="el => fields.register('Conditions', el, conditions)"
          :definition="conditionsDefinition"
          :readonly="!canEdit"
          :dialogs="dialogs"
        />
        <EntryTableEditor
          :ref="el => fields.register('Risk', el, risk)"
          :definition="riskDefinition"
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
