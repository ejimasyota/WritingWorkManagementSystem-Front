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
const creator = ref(false);
const ready = ref(false);
const busy = ref(false);
const opened = ref(false);
const records = ref<WorkSettingRow[]>([]);
const selected = ref<WorkSettingRow | null>(null);
const rows = ref<NarrativeDraftRow[]>([]);
const snapshot = ref<Record<string, unknown>[]>([]);
const characters = ref<WorkSettingRow[]>([]);
const serifs = ref<WorkSettingRow[]>([]);
const errors = ref<Record<string, string>>({});
const revision = ref(0);
const form = reactive({
  Name: '',
  Description: ''
});
const canEdit = computed(() => ready.value && (props.isAdmin || creator.value));
const role = computed(() => props.isAdmin ? '管理者' : creator.value ? '作成者' : 'アシスタント');
const title = computed(() => '掛け合い登録（' + (selected.value ? canEdit.value ? '編集' : '詳細' : '新規登録') + '）');
let sequence = 0;
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
});
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
  CharaId: '',
  Speaker: '',
  Monologue: false,
  ContentFree: true,
  SerifId: '',
  Feeling: ''
});
const draggedRow = ref<number | null>(null);
const dragOverRow = ref<number | null>(null);
const columns: TableColumn[] = [{
  key: 'Detail',
  label: '詳細',
  width: 110,
  minWidth: 110
}, {
  key: 'ExchangeName',
  label: '掛け合い名',
  sortable: true
}, {
  key: 'Description',
  width: 360,
  label: '概要'
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
  const data = requireSuccess(await props.request<Record<string, unknown>>('/GetExchangeList.php' + (id ? '?ExchangeId=' + encodeURIComponent(String(id)) : '')), messageFormat('ERROR', 'E_0003', '掛け合いの取得'));
  if (!Array.isArray(data?.ExchangeList) || !Array.isArray(data.ExchangeRowList)) throw new Error(messageFormat('ERROR', 'E_0026'));
  if (disposed) return null;
  records.value = data.ExchangeList as WorkSettingRow[];
  characters.value = Array.isArray(data.CharacterList) ? data.CharacterList as WorkSettingRow[] : [];
  serifs.value = Array.isArray(data.SerifList) ? data.SerifList as WorkSettingRow[] : [];
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
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '掛け合いの取得'));
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
    Content: row.Monologue && !row.SerifId ? String(row.Content || '').replace(/^（(.*)）$/us, '$1') : String(row.Content || row.SerifContent || ''),
    CharaId: String(row.CharaId || ''),
    Speaker: String(row.Speaker || ''),
    Monologue: !!row.Monologue,
    SpeakerFree: !!row.Speaker && !row.CharaId,
    SerifId: String(row.SerifId || ''),
    Feeling: String(row.Feeling || ''),
    ContentFree: !row.SerifId
  };
}

function clear() {
  if (busy.value) return;
  selected.value = null;
  Object.assign(form, {
    Name: '',
    Description: ''
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
      const data = await read(row.ExchangeId);
      if (!data || disposed) return;
      const parent = data.SelectedExchange as WorkSettingRow;
      if (!parent) throw new Error(messageFormat('ERROR', 'E_0026'));
      selected.value = {
        ...parent
      };
      Object.assign(form, {
        Name: String(parent.ExchangeName || ''),
        Description: String(parent.Description || '')
      });
      const source = data.ExchangeRowList as WorkSettingRow[];
      rows.value = source.map(localRow);
      snapshot.value = source.map(item => ({
        ExchangeRowId: item.ExchangeRowId,
        UpdateDate: item.UpdateDate
      }));
      fields.setValues(form);
      errors.value = {};
      revision.value++;
      opened.value = true;
    });
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '掛け合いの取得'));
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
    CharaId: '',
    Speaker: '',
    Monologue: false,
    ContentFree: true,
    SerifId: '',
    Feeling: ''
  });
  if (row) {
    Object.assign(rowForm, Object.fromEntries(Object.keys(rowForm).map(key => [key, row[key] ?? rowForm[key as keyof typeof rowForm]])), {
      IndexNum: String(rowPosition(row))
    });
    if (rowForm.SerifId) {
      const serif = serifs.value.find(item => String(item.SerifId) === String(rowForm.SerifId));
      rowForm.Content = String(serif?.Content || row.SerifContent || '');
      rowForm.Monologue = !!(serif?.Monologue ?? row.SerifMonologue);
    } else if (!rowForm.ActionLine && rowForm.Monologue) rowForm.Content = String(row.Content || '').replace(/^（(.*)）$/us, '$1');
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
  if (key === 'SerifId' || key === 'ContentFree' && !rowForm.ContentFree) {
    const serif = serifs.value.find(item => String(item.SerifId) === String(rowFields.getValue('SerifId', '')));
    rowForm.Content = String(serif?.Content || '');
    rowForm.Monologue = !!serif?.Monologue;
    rowFields.setValues({
      Content: rowForm.Content,
      Monologue: rowForm.Monologue
    });
  }
}

async function commitRow() {
  if (!canEdit.value || busy.value) return;
  const values = rowFields.getValues(rowForm);
  rowErrors.value = {};
  if (!/^\d+$/.test(values.IndexNum) || Number(values.IndexNum) < 1) rowErrors.value.IndexNum = messageFormat('ERROR', 'E_0001', '並び順');
  if ((values.ActionLine || values.ContentFree) && !values.Content.trim()) rowErrors.value.Content = messageFormat('ERROR', 'E_0001', '内容');
  if (!values.ActionLine && !values.ContentFree && !values.SerifId) rowErrors.value.SerifId = messageFormat('ERROR', 'E_0001', 'セリフ');
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
  if (values.SpeakerFree) value.CharaId = null;else value.Speaker = null;
  if (values.ActionLine) {
    value.Monologue = false;
    value.Content = values.Content;
    value.CharaId = null;
    value.Speaker = null;
    value.SerifId = null;
    value.Feeling = null;
  } else if (values.ContentFree) value.SerifId = null;else {
    value.Content = '';
    value.Monologue = false;
    value.SerifContent = serifs.value.find(item => String(item.SerifId) === String(values.SerifId))?.Content || '';
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
  return String(characters.value.find(item => String(item.CharaId) === String(row.CharaId))?.CharaName || row.Speaker || messageFormat('INFO', 'I_0092'));
}

function characterImage(row: NarrativeDraftRow) {
  if (!row.CharaId) return '';
  const character = characters.value.find(item => String(item.CharaId) === String(row.CharaId));
  return String(character ? character.ImgPath || '' : row.CharaImgPath || '');
}
const speakerColors = computed(() => {
  const colors = new Map<string, string>();
  const palette = ['#3498db', '#9b59b6', '#e74c3c', '#2c3e50', '#7f8c8d', '#667eea'];
  for (const row of rows.value) {
    if (row.ActionLine) continue;
    const key = row.CharaId ? 'Chara:' + row.CharaId : 'Free:' + String(row.Speaker || '').trim();
    if (!colors.has(key)) colors.set(key, palette[colors.size % palette.length]!);
  }
  return colors;
});

function exchangeColor(row: NarrativeDraftRow) {
  return speakerColors.value.get(row.CharaId ? 'Chara:' + row.CharaId : 'Free:' + String(row.Speaker || '').trim()) || '#3498db';
}

async function save() {
  if (!canEdit.value || busy.value) return;
  const values = fields.getValues(form);
  const detail = rows.value.map(rowValue);
  errors.value = {};
  if (!values.Name.trim()) errors.value.Name = messageFormat('ERROR', 'E_0001', '掛け合い名');
  if (values.Name.length > 100) errors.value.Name = messageFormat('ERROR', 'E_0002', '掛け合い名', 100);
  detail.forEach((row, index) => {
    if (!String(row.Content || '').trim() && !row.SerifId) errors.value['row:' + rows.value[index]!.localKey] = messageFormat('ERROR', 'E_0001', '内容');
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
  let saved: Record<string, unknown> = {};
  try {
    await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed) return;
      saved = requireSuccess(await props.request<Record<string, unknown>>('/SaveExchange.php', 'POST', {
        Mode: 'bundle',
        ExchangeId: selected.value?.ExchangeId ?? null,
        UpdateDate: selected.value?.UpdateDate ?? null,
        ExchangeName: values.Name,
        Description: values.Description,
        Rows: detail,
        RowsSnapshot: snapshot.value
      }), messageFormat('ERROR', 'E_0003', '掛け合いの保存'));
      selected.value = { ...selected.value, ExchangeId: saved.ExchangeId ?? selected.value?.ExchangeId, UpdateDate: String(saved.UpdateDate ?? selected.value?.UpdateDate ?? '') };
      success = true;
    });
    if (success && !disposed) await props.dialogs.info(messageFormat('INFO', 'I_0011', '保存'), messageFormat('INFO', 'I_0001', '掛け合いの保存'));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '掛け合いの保存'));
  } finally {
    busy.value = false;
  }
  if (success && !disposed) {
    if (selected.value?.ExchangeId) await openDetail(selected.value);
    else await load();
  }
}

async function remove() {
  const parent = selected.value;
  if (!parent || !canEdit.value || busy.value) return;
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'この掛け合いを削除')))) return;
  busy.value = true;
  let success = false;
  try {
    await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed) return;
      requireSuccess(await props.request('/DeleteExchange.php', 'POST', {
        Mode: 'info',
        ExchangeId: parent.ExchangeId,
        UpdateDate: parent.UpdateDate
      }), messageFormat('ERROR', 'E_0003', '掛け合いの削除'));
      success = true;
    });
    if (success && !disposed) await props.dialogs.info(messageFormat('INFO', 'I_0011', '削除'), messageFormat('INFO', 'I_0001', '掛け合いの削除'));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '掛け合いの削除'));
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
    const parent = records.value.find(row => String(row.ExchangeId) === (props.targetParentId || props.targetId));
    if (parent) {
      await openDetail(parent);
      // 行を指す検索結果から移動した場合は、その行の入力ダイアログまで開く。
      if (!disposed && props.targetParentId) {
        const target = rows.value.find(row => String(row.ExchangeRowId) === props.targetId);
        if (target) openRow(target);
      }
    }
  }
});
</script>
<template>
  <div>
    <WorkContentHeader
      title="掛け合い作成"
      icon="fa-comments"
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
      table-class="NarrativeTable"
      :rows="records"
      :columns="columns"
      row-key="ExchangeId"
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
            <div class="FormGridFullWidth">
              <TextFieldComponent
                :ref="el=>fields.register('Name',el,form.Name)"
                label="掛け合い名"
                required
                :maxlength="30"
                :readonly="!canEdit"
                :error="errors.Name"
               />
            </div>
          </div>
          <TextFieldComponent
            :ref="el=>fields.register('Description',el,form.Description)"
            label="概要"
            text-area-flg
            :readonly="!canEdit"
           />
        </section>
        <section class="FormSection">
          <h3 class="FormSectionTitle">掛け合い行</h3>

          <div class="StoryList">
            <template
              v-for="row in rows"
              :key="row.localKey"
            >
              <div
                class="StoryItem ExchangeItem"
                :style="{'--ExchangeSpeakerColor':exchangeColor(row)}"
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
                <div class="ExchangeBody">
                  <div
                    v-if="!row.ActionLine"
                    class="ExchangeSpeakerRow"
                  >
                    <span class="ExchangeAvatar">
                      <img
                        v-if="characterImage(row)"
                        :src="characterImage(row)"
                        :alt="speakerName(row)"
                       />
                      <i
                        v-else
                        class="fas fa-user"
                        aria-hidden="true"
                       />
                    </span>
                    <span class="ExchangeSpeaker">{{ speakerName(row) }}</span>
                  </div>
                  <div class="ExchangeBubble">{{ narrativeText(row,'Exchange',serifs) }}</div>
                  <div
                    v-if="!row.ActionLine && row.Feeling"
                    class="ExchangeFeeling"
                  >
                    心境:
                    {{ row.Feeling }}
                  </div>
                </div>
              </div>
            </template>
          </div>
        </section>
      </div>
      <template v-if="canEdit" #body-actions>
        <ButtonComponent
          type="button"
          variant="PrimaryButton ButtonSmall"
          @click="addRow"
        >行を追加</ButtonComponent>
      </template>
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
    <BaseDialog
      v-model="rowOpened"
      title="掛け合い行"
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
            :ref="el=>rowFields.register('Speaker',el,rowForm.Speaker)"
            label="発言者"
            :maxlength="255"
            :readonly="!canEdit"
           />
          <SelectBoxComponent
            v-show="!rowForm.SpeakerFree"
            :ref="el=>rowFields.register('CharaId',el,rowForm.CharaId)"
            label="発言者"
            :options="characterOptions"
            :readonly="!canEdit"
           />
          <SelectBoxComponent
            v-show="!rowForm.ContentFree"
            :ref="el=>rowFields.register('SerifId',el,rowForm.SerifId)"
            label="セリフ"
            :error="rowErrors.SerifId"
            @value-change="changeRowField('SerifId')"
            :options="[{value:'',label:''},...serifs.map(item=>({value:String(item.SerifId),label:String(item.Content)}))]"
            :readonly="!canEdit"
           />
          <TextFieldComponent
            :ref="el=>rowFields.register('Feeling',el,rowForm.Feeling)"
            label="心境"
            text-area-flg
            :readonly="!canEdit"
           />
          <div class="NarrativeContentControls">
            <CheckBoxComponent
              :ref="el=>rowFields.register('Monologue',el,rowForm.Monologue)"
              inline
              aria-label="モノローグ"
              :readonly="!canEdit || !rowForm.ContentFree"
            >モノローグ</CheckBoxComponent>
            <ToogleComponent
              :ref="el=>rowFields.register('ContentFree',el,rowForm.ContentFree)"
              inline
              aria-label="セリフを自由入力"
              wrapper-class="CheckboxWrapper"
              :readonly="!canEdit"
              @value-change="changeRowField('ContentFree')"
            >セリフを自由入力</ToogleComponent>
          </div>
        </div>
        <TextAreaComponent
          :ref="el=>rowFields.register('Content',el,rowForm.Content)"
          label="内容"
          :readonly="!canEdit || (!rowForm.ActionLine && !rowForm.ContentFree)"
          :required="rowForm.ActionLine || rowForm.ContentFree"
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
