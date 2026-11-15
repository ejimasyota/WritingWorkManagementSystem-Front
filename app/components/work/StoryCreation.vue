<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useInputFields } from '../../composables/useInputFields';
import { useOperationSpinner } from '../../composables/useOperationSpinner';
import type { BackendRequest } from '../../types/backend';
import type { WorkInfo } from '../../types/work';
import type { WorkSettingRow } from '../../types/workSettings';
import type { NarrativeDraftRow } from '../../types/narrative';
import type { PageDialogs } from '../../composables/usePageDialogs';
import type { TableColumn } from '../../composables/tableData';
import { readWorkAccess } from '../../utils/workAccess';
import { requireSuccess, reportBackendError } from '../../utils/backend';
import { messageFormat } from '../../utils/messages';
import { placeNarrativeRow, dragNarrativeRow, narrativeText, narrativeRowPositions } from '../../utils/narrativeRows';
import PlotCreation from './PlotCreation.vue';
import { fileAsBase64 } from '../../utils/files';
const props = defineProps<{
  request: BackendRequest;
  dialogs: PageDialogs;
  isAdmin: boolean;
  hideMeta?: boolean;
  targetId?: string;
  targetParentId?: string;
  backStoryId?: string;
}>();
const fields = useInputFields();
const spinner = useOperationSpinner();
const work = ref<WorkInfo>();
const plotDetailId = ref('');
const importFile = ref<{
  setValue: (value: string) => void;
  openFilePicker: () => void;
  getFiles: () => File[];
}>();
const creator = ref(false);
const ready = ref(false);
const busy = ref(false);
const opened = ref(false);
const records = ref<WorkSettingRow[]>([]);
const selected = ref<WorkSettingRow | null>(null);
const rows = ref<NarrativeDraftRow[]>([]);
const snapshot = ref<Record<string, unknown>[]>([]);
const characters = ref<WorkSettingRow[]>([]);
const templates = ref<Record<string, unknown>[]>([]);
const plots = ref<WorkSettingRow[]>([]);
const plotOptions = computed(() => [{
  value: '',
  label: ''
}, ...plots.value.filter(row => Number(row.ProductionType || 0) === Number(form.ProductionType)).map(row => ({
  value: String(row.PlotId),
  label: String(row.PlotName)
}))]);
const errors = ref<Record<string, string>>({});
const revision = ref(0);
const form = reactive({
  Name: '',
  ProductionType: '0',
  PlotId: ''
});
const canEdit = computed(() => ready.value && (props.isAdmin || creator.value));
const role = computed(() => props.isAdmin ? '管理者' : creator.value ? '作成者' : 'アシスタント');
const title = computed(() => 'ストーリー登録（' + (selected.value ? canEdit.value ? '編集' : '詳細' : '新規登録') + '）');
let sequence = 0;
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
});
const productionOptions = [{
  value: '0',
  label: ''
}, {
  value: '1',
  label: '投稿用'
}, {
  value: '2',
  label: '連載用'
}, {
  value: '3',
  label: '短編用'
}, {
  value: '4',
  label: '長編用'
}, {
  value: '5',
  label: 'その他'
}];
const productionLabel = (value: unknown) => productionOptions.find(option => option.value === String(value))?.label || messageFormat('INFO', 'I_0071');
const characterOptions = computed(() => [{
  value: '',
  label: ''
}, ...characters.value.map(row => ({
  value: String(row.CharaId),
  label: String(row.CharaName)
}))]);
const rowFields = useInputFields();
const rowOpened = ref(false);
const editingRow = ref<NarrativeDraftRow | null>(null);
const rowRevision = ref(0);
const rowErrors = ref<Record<string, string>>({});
const rowForm = reactive({
  IndexNum: '1',
  Content: '',
  ActionLine: false,
  SpeakerFree: false,
  NarratorCharaId: '',
  Narrator: '',
  Monologue: false
});
const draggedRow = ref<number | null>(null);
const dragOverRow = ref<number | null>(null);
const columns: TableColumn[] = [{
  key: 'Detail',
  label: '詳細',
  width: 90
}, {
  key: 'Copy',
  label: 'コピー',
  width: 90
}, {
  key: 'StoryName',
  label: 'ストーリー名',
  sortable: true
}, {
  key: 'ProductionType',
  label: '制作区分',
  filterable: true,
  format: value => productionLabel(value)
}, {
  key: 'PlotName',
  label: '関連プロット',
  filterable: true
}, {
  key: 'RowCount',
  label: '登録行数',
  sortable: true,
  type: 'number'
}];

async function verifyAccess() {
  const access = await readWorkAccess(props.request, work.value?.WorkId);
  if (disposed) return false;
  work.value = access.work;
  creator.value = access.isCreator;
  return props.isAdmin || access.isCreator;
}

async function read(id: unknown = null) {
  const data = requireSuccess(await props.request<Record<string, unknown>>('/GetStoryList.php' + (id ? '?StoryId=' + encodeURIComponent(String(id)) : '')), messageFormat('ERROR', 'E_0003', 'ストーリーの取得'));
  if (!Array.isArray(data?.StoryList) || !Array.isArray(data.StoryRowList)) throw new Error(messageFormat('ERROR', 'E_0026'));
  if (disposed) return null;
  records.value = data.StoryList as WorkSettingRow[];
  characters.value = Array.isArray(data.CharacterList) ? data.CharacterList as WorkSettingRow[] : [];
  templates.value = Array.isArray(data.TemplateRows) ? data.TemplateRows as Record<string, unknown>[] : [];
  plots.value = Array.isArray(data.PlotList) ? data.PlotList as WorkSettingRow[] : [];
  ready.value = true;
  return data;
}

async function load() {
  if (busy.value || disposed) return;
  busy.value = true;
  try {
    await spinner.run(async () => {
      await verifyAccess();
      if (!disposed) await read();
    });
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'ストーリーの取得'));
  } finally {
    busy.value = false;
  }
}

function localRow(row: Record<string, unknown> = {}): NarrativeDraftRow {
  return {
    ...row,
    localKey: ++sequence,
    UpdateDate: String(row.UpdateDate || ''),
    ActionLine: !!row.ActionLine,
    Content: String(row.Content || ''),
    NarratorCharaId: String(row.NarratorCharaId || ''),
    Narrator: String(row.Narrator || ''),
    Monologue: !!row.Monologue,
    SpeakerFree: !!row.Narrator && !row.NarratorCharaId
  };
}

function clear() {
  if (busy.value) return;
  selected.value = null;
  Object.assign(form, {
    Name: '',
    ProductionType: '0',
    PlotId: ''
  });
  closeRow();
  rows.value = [];
  snapshot.value = [];
  errors.value = {};
  fields.setValues(form);
  revision.value++;
}

function openNew() {
  if (!canEdit.value || busy.value) return;
  clear();
  opened.value = true;
}

async function openDetail(row: WorkSettingRow) {
  if (busy.value) return;
  busy.value = true;
  try {
    await spinner.run(async () => {
      await verifyAccess();
      if (disposed) return;
      const data = await read(row.StoryId);
      if (!data || disposed) return;
      const parent = data.SelectedStory as WorkSettingRow;
      if (!parent) throw new Error(messageFormat('ERROR', 'E_0026'));
      selected.value = {
        ...parent
      };
      Object.assign(form, {
        Name: String(parent.StoryName || ''),
        ProductionType: String(parent.ProductionType || 0),
        PlotId: String(parent.PlotId || '')
      });
      const source = data.StoryRowList as WorkSettingRow[];
      rows.value = source.map(localRow);
      snapshot.value = source.map(item => ({
        StoryRowId: item.StoryRowId,
        UpdateDate: item.UpdateDate
      }));
      fields.setValues(form);
      errors.value = {};
      revision.value++;
      opened.value = true;
    });
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'ストーリーの取得'));
  } finally {
    busy.value = false;
  }
}

function close() {
  if (busy.value) return;
  opened.value = false;
  clear();
}

/** 行の編集はローカルのコピーを使い、「反映」で初めて親の一覧へ戻す。 */


function rowValue(row: NarrativeDraftRow) {
  return {
    ...row
  };
}
const rowPositions = computed(() => narrativeRowPositions(rows.value, false));

function rowPosition(row: NarrativeDraftRow) {
  return rowPositions.value.get(row.localKey) || 0;
}

function addRow() {
  if (!canEdit.value || busy.value) return;
  openRow(null);
}

function openRow(row: NarrativeDraftRow | null) {
  if (busy.value) return;
  editingRow.value = row ? {
    ...row
  } : null;
  Object.assign(rowForm, {
    IndexNum: '1',
    Content: '',
    ActionLine: false,
    SpeakerFree: false,
    NarratorCharaId: '',
    Narrator: '',
    Monologue: false
  });
  if (row) {
    Object.assign(rowForm, Object.fromEntries(Object.keys(rowForm).map(key => [key, row[key] ?? rowForm[key as keyof typeof rowForm]])), {
      IndexNum: String(rowPosition(row))
    });
    if (!rowForm.ActionLine && (rowForm.Narrator || rowForm.NarratorCharaId)) rowForm.Content = String(row.Content || '').replace(/^[「(（]/u, '').replace(/[」)）]$/u, '');
  } else rowForm.IndexNum = String(rows.value.length + 1);
  rowErrors.value = {};
  rowFields.setValues(rowForm);
  rowRevision.value++;
  rowOpened.value = true;
}

function changeRowField(key: keyof typeof rowForm) {
  Object.assign(rowForm, {
    [key]: rowFields.getValue(key, rowForm[key])
  });
}

async function commitRow() {
  if (!canEdit.value || busy.value) return;
  const values = rowFields.getValues(rowForm);
  rowErrors.value = {};
  if (!/^\d+$/.test(values.IndexNum) || Number(values.IndexNum) < 1) rowErrors.value.IndexNum = messageFormat('ERROR', 'E_0001', '並び順');
  if (!values.Content.trim()) rowErrors.value.Content = messageFormat('ERROR', 'E_0001', '内容');
  const first = Object.keys(rowErrors.value)[0];
  if (first) {
    await nextTick();
    rowFields.focus(first);
    return;
  }
  const value: NarrativeDraftRow = {
    ...localRow(values),
    ...editingRow.value,
    ...values
  };
  if (values.SpeakerFree) value.NarratorCharaId = null;else value.Narrator = null;
  if (values.ActionLine) {
    value.Monologue = false;
    value.Content = values.Content;
    value.NarratorCharaId = null;
    value.Narrator = null;
  }
  rows.value = placeNarrativeRow(rows.value, value, Number(values.IndexNum), false);
  rowOpened.value = false;
  editingRow.value = null;
}

function closeRow() {
  rowOpened.value = false;
  editingRow.value = null;
}

function removeRow() {
  if (!canEdit.value || busy.value || !editingRow.value) return;
  rows.value = rows.value.filter(item => item.localKey !== editingRow.value?.localKey);
  closeRow();
}

function beginRowDrag(event: DragEvent, row: NarrativeDraftRow) {
  if (!canEdit.value || busy.value) {
    event.preventDefault();
    return;
  }
  draggedRow.value = row.localKey;
  event.dataTransfer?.setData('text/plain', String(row.localKey));
}

async function dropRow(row: NarrativeDraftRow) {
  const source = draggedRow.value;
  draggedRow.value = null;
  dragOverRow.value = null;
  if (!canEdit.value || busy.value || source === null || source === row.localKey) return;
  const next = dragNarrativeRow(rows.value, source, row.localKey, false);
  if (!next) {
    await props.dialogs.error(messageFormat('ERROR', 'E_0059'));
    return;
  }
  rows.value = next;
}

function touchRowStart(event: TouchEvent, row: NarrativeDraftRow) {
  if (!canEdit.value || busy.value) return;
  event.preventDefault();
  draggedRow.value = row.localKey;
}

function touchRowMove(event: TouchEvent) {
  if (draggedRow.value === null) return;
  const point = event.touches[0];
  if (!point) return;
  event.preventDefault();
  const key = document.elementFromPoint(point.clientX, point.clientY)?.closest<HTMLElement>('[data-narrative-row]')?.dataset.narrativeRow;
  dragOverRow.value = key ? Number(key) : null;
}

function touchRowEnd() {
  const target = rows.value.find(row => row.localKey === dragOverRow.value);
  if (target) void dropRow(target);else {
    draggedRow.value = null;
    dragOverRow.value = null;
  }
}

function speakerName(row: NarrativeDraftRow) {
  return String(characters.value.find(item => String(item.CharaId) === String(row.NarratorCharaId))?.CharaName || row.Narrator || messageFormat('INFO', 'I_0073'));
}

function changeProduction() {
  form.ProductionType = fields.getValue('ProductionType', '0');
  fields.setValue('PlotId', '');
  form.PlotId = '';
}

async function applyTemplate() {
  if (!canEdit.value || busy.value) return;
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0017', 'ストーリー')))) return;
  rows.value = templates.value.filter(row => String(row.Content || '').trim()).map(row => localRow({
    ...row,
    Narrator: row.FreeInput ? row.Narrator : '',
    NarratorCharaId: ''
  }));
}

async function copy(parent: WorkSettingRow) {
  if (!canEdit.value || busy.value) return;
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'このストーリーをコピー')))) return;
  busy.value = true;
  let success = false;
  try {
    await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed) return;
      requireSuccess(await props.request('/CopyStory.php', 'POST', {
        StoryId: parent.StoryId,
        UpdateDate: parent.UpdateDate
      }), messageFormat('ERROR', 'E_0003', 'コピー'));
      success = true;
    });
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'コピー'));
  } finally {
    busy.value = false;
  }
  if (success && !disposed) await load();
}

function chooseImport() {
  importFile.value?.openFilePicker();
}

async function importRows() {
  const file = importFile.value?.getFiles()[0];
  if (!file || !canEdit.value || busy.value) return;
  if (file.size > 2 * 1024 * 1024) {
    await props.dialogs.error(messageFormat('ERROR', 'E_0090'));
    return;
  }
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0017', 'ストーリー')))) return;
  busy.value = true;
  try {
    await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed) return;
      const data = requireSuccess(await props.request<{
        Rows: Record<string, unknown>[];
      }>('/ImportStory.php', 'POST', {
        Preview: true,
        FileName: file.name,
        FileData: await fileAsBase64(file)
      }), messageFormat('ERROR', 'E_0003', '取込'));
      if (!disposed) rows.value = data.Rows.map(localRow);
    });
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '取込'));
  } finally {
    busy.value = false;
    importFile.value?.setValue('');
  }
}

async function save() {
  if (!canEdit.value || busy.value) return;
  const values = fields.getValues(form);
  const detail = rows.value.map(rowValue);
  errors.value = {};
  if (!values.Name.trim()) errors.value.Name = messageFormat('ERROR', 'E_0001', 'ストーリー名');
  if (values.Name.length > 100) errors.value.Name = messageFormat('ERROR', 'E_0002', 'ストーリー名', 100);
  detail.forEach((row, index) => {
    if (!String(row.Content || '').trim()) errors.value['row:' + rows.value[index]!.localKey] = messageFormat('ERROR', 'E_0001', '内容');
  });
  const first = Object.keys(errors.value)[0];
  if (first) {
    await nextTick();
    const invalid = rows.value.find(row => 'row:' + row.localKey === first);
    if (invalid) openRow(invalid);else fields.focus(first);
    return;
  }
  busy.value = true;
  let success = false;
  try {
    await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed) return;
      requireSuccess(await props.request('/SaveStory.php', 'POST', {
        Mode: 'bundle',
        StoryId: selected.value?.StoryId ?? null,
        UpdateDate: selected.value?.UpdateDate ?? null,
        StoryName: values.Name,
        ProductionType: Number(values.ProductionType),
        PlotId: values.PlotId || null,
        Rows: detail,
        RowsSnapshot: snapshot.value
      }), messageFormat('ERROR', 'E_0003', 'ストーリーの保存'));
      success = true;
    });
    if (success && !disposed) await props.dialogs.info(messageFormat('INFO', 'I_0011', '保存'), messageFormat('INFO', 'I_0001', 'ストーリーの保存'));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'ストーリーの保存'));
  } finally {
    busy.value = false;
  }
  if (success && !disposed) {
    close();
    await load();
  }
}

async function remove() {
  const parent = selected.value;
  if (!parent || !canEdit.value || busy.value) return;
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'このストーリーを削除')))) return;
  busy.value = true;
  let success = false;
  try {
    await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed) return;
      requireSuccess(await props.request('/DeleteStory.php', 'POST', {
        Mode: 'info',
        StoryId: parent.StoryId,
        UpdateDate: parent.UpdateDate
      }), messageFormat('ERROR', 'E_0003', 'ストーリーの削除'));
      success = true;
    });
    if (success && !disposed) await props.dialogs.info(messageFormat('INFO', 'I_0011', '削除'), messageFormat('INFO', 'I_0001', 'ストーリーの削除'));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'ストーリーの削除'));
  } finally {
    busy.value = false;
  }
  if (success && !disposed) {
    close();
    await load();
  }
}
onMounted(async () => {
  await load();
  if (!disposed && props.targetId) {
    const parent = records.value.find(row => String(row.StoryId) === (props.targetParentId || props.targetId));
    if (parent) {
      await openDetail(parent);
      // 行を指す検索結果から移動した場合は、その行の入力ダイアログまで開く。
      if (!disposed && props.targetParentId) {
        const target = rows.value.find(row => String(row.StoryRowId) === props.targetId);
        if (target) openRow(target);
      }
    }
  }
});
</script>
<template>
  <div>
    <WorkContentHeader
      title="ストーリー作成"
      icon="fa-book"
      :work-title="work?.WorkTitle"
      :role="work ? role : undefined"
     />
    <div
      v-if="canEdit"
      class="ButtonGroup MarginBottom20"
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
      :rows="records"
      :columns="columns"
      row-key="StoryId"
      :loading="busy"
      :hide-meta="hideMeta"
    >
      <template #cell-Detail="{row}">
        <ButtonComponent
          type="button"
          variant="PrimaryButton ButtonSmall"
          @click="openDetail(row as WorkSettingRow)"
        >詳細</ButtonComponent>
      </template>
      <template #cell-Copy="{row}">
        <ButtonComponent
          v-if="canEdit"
          type="button"
          variant="SecondaryButton ButtonSmall"
          @click="copy(row as WorkSettingRow)"
        >コピー</ButtonComponent>
      </template>
    </TableComponent>
    <BaseDialog
      :close-on-escape="!busy"
      v-model="opened"
      :title="title"
      size="DialogLarge"
      section-navigation
      @close="close"
    >
      <div :key="revision">
        <section class="FormSection">
          <h3 class="FormSectionTitle">基本</h3>
          <div class="FormGrid">
            <TextFieldComponent
              :ref="el=>fields.register('Name',el,form.Name)"
              label="ストーリー名"
              required
              :maxlength="30"
              :readonly="!canEdit"
              :error="errors.Name"
             />
            <SelectBoxComponent
              :ref="el=>fields.register('ProductionType',el,form.ProductionType)"
              label="制作区分"
              :options="productionOptions"
              :readonly="!canEdit || !!selected"
              @value-change="changeProduction"
             />
            <SelectBoxComponent
              :ref="el=>fields.register('PlotId',el,form.PlotId)"
              label="関連プロット"
              :options="plotOptions"
              :readonly="!canEdit"
              @value-change="form.PlotId=fields.getValue('PlotId','')"
             />
            <ButtonComponent
              type="button"
              variant="SecondaryButton"
              :disabled="!form.PlotId"
              @click="plotDetailId=form.PlotId"
            >関連プロット詳細</ButtonComponent>
          </div>
        </section>
        <section class="FormSection">
          <h3 class="FormSectionTitle">ストーリー行</h3>
          <div
            v-if="canEdit"
            class="ButtonGroup MarginBottom20"
          >
            <ButtonComponent
              type="button"
              variant="PrimaryButton ButtonSmall"
              @click="addRow"
            >行を追加</ButtonComponent>
            <ButtonComponent
              type="button"
              variant="SecondaryButton ButtonSmall"
              @click="chooseImport"
            >取込</ButtonComponent>
            <TextFieldComponent
              inline
              ref="importFile"
              class="Hidden NarrativeImportInput"
              type="file"
              accept=".txt,.docx"
              @change="importRows"
             />
            <ButtonComponent
              v-if="templates.length"
              type="button"
              variant="SecondaryButton ButtonSmall"
              @click="applyTemplate"
            >テンプレートから作成</ButtonComponent>
          </div>
          <div class="StoryList">
            <template
              v-for="row in rows"
              :key="row.localKey"
            >
              <div
                class="StoryItem "
                :class="{Dragging:draggedRow===row.localKey,DragOver:dragOverRow===row.localKey,NarrativeAction:!!row.ActionLine}"
                :data-narrative-row="row.localKey"
                @click="openRow(row)"
                @dragover.prevent="dragOverRow=row.localKey"
                @drop.prevent="dropRow(row)"
              >
                <button
                  v-if="canEdit"
                  class="StoryDragHandle"
                  type="button"
                  draggable="true"
                  title="並び替え"
                  aria-label="並び替え"
                  @click.stop
                  @dragstart="beginRowDrag($event,row)"
                  @dragend="draggedRow=null;dragOverRow=null"
                  @touchstart="touchRowStart($event,row)"
                  @touchmove="touchRowMove"
                  @touchend="touchRowEnd"
                  @touchcancel="draggedRow=null;dragOverRow=null"
                >
                  <i
                    class="fa-solid fa-hand"
                    aria-hidden="true"
                   />
                </button>
                <div class="StoryNumber">{{ rowPosition(row) }}</div>
                <div class="StoryContent">
                  <div
                    v-if="!row.ActionLine"
                    class="StoryNarrator"
                  >{{ speakerName(row) }}</div>
                  <div class="StoryText">{{ narrativeText(row,'Story') }}</div>
                </div>
              </div>
            </template>
          </div>
        </section>
      </div>
      <template #actions>
        <ButtonComponent
          type="button"
          variant="CloseButton"
          @click="close"
        >閉じる</ButtonComponent>
        <template v-if="canEdit">
          <ButtonComponent
            type="button"
            variant="ClearButton"
            @click="clear"
          >クリア</ButtonComponent>
          <ButtonComponent
            v-if="selected"
            type="button"
            variant="DeleteButton"
            @click="remove"
          >削除</ButtonComponent>
          <ButtonComponent
            type="button"
            variant="SaveButton"
            @click="save"
          >保存</ButtonComponent>
        </template>
      </template>
    </BaseDialog>
    <PlotCreation
      v-if="plotDetailId"
      :key="plotDetailId"
      :request="request"
      :dialogs="dialogs"
      :is-admin="isAdmin"
      readonly
      :detail-id="plotDetailId"
      @close="plotDetailId=''"
     />
    <BaseDialog
      v-model="rowOpened"
      title="ストーリー行"
      size="DialogLarge"
      @close="closeRow"
    >
      <div :key="rowRevision">
        <ToogleComponent
          :ref="el=>rowFields.register('ActionLine',el,rowForm.ActionLine)"
          label="動詞を入力する"
          :readonly="!canEdit"
          @value-change="changeRowField('ActionLine')"
         />
        <TextFieldComponent
          :ref="el=>rowFields.register('IndexNum',el,rowForm.IndexNum)"
          label="並び順"
          numeric-only
          :maxlength="10"
          required
          :readonly="!canEdit"
          :error="rowErrors.IndexNum"
         />
        <div v-show="!rowForm.ActionLine">
          <ToogleComponent
            :ref="el=>rowFields.register('SpeakerFree',el,rowForm.SpeakerFree)"
            label="発言者を自由入力"
            :readonly="!canEdit"
            @value-change="changeRowField('SpeakerFree')"
           />
          <TextFieldComponent
            v-show="rowForm.SpeakerFree"
            :ref="el=>rowFields.register('Narrator',el,rowForm.Narrator)"
            label="語り手"
            :maxlength="255"
            :readonly="!canEdit"
           />
          <SelectBoxComponent
            v-show="!rowForm.SpeakerFree"
            :ref="el=>rowFields.register('NarratorCharaId',el,rowForm.NarratorCharaId)"
            label="語り手"
            :options="characterOptions"
            :readonly="!canEdit"
           />
          <div class="NarrativeContentControls">
            <CheckBoxComponent
              :ref="el=>rowFields.register('Monologue',el,rowForm.Monologue)"
              inline
              aria-label="モノローグ"
              :readonly="!canEdit "
            >モノローグ</CheckBoxComponent>
          </div>
        </div>
        <TextAreaComponent
          :ref="el=>rowFields.register('Content',el,rowForm.Content)"
          label="内容"
          :readonly="!canEdit "
          :required="true"
          :error="rowErrors.Content"
         />
      </div>
      <template #actions>
        <ButtonComponent
          type="button"
          variant="CloseButton"
          @click="closeRow"
        >閉じる</ButtonComponent>
        <template v-if="canEdit">
          <ButtonComponent
            v-if="editingRow"
            type="button"
            variant="DeleteButton"
            @click="removeRow"
          >削除</ButtonComponent>
          <ButtonComponent
            type="button"
            variant="SaveButton"
            @click="commitRow"
          >反映</ButtonComponent>
        </template>
      </template>
    </BaseDialog>
  </div>
</template>
