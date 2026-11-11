<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, reactive, ref } from 'vue';
import { useOperationSpinner } from '../../composables/useOperationSpinner';
import { useInputFields } from '../../composables/useInputFields';
import { metadataColumns, type TableColumn } from '../../composables/tableData';
import type { BackendRequest } from '../../types/backend';
import type { WorkInfo } from '../../types/work';
import type { WorkSettingRow } from '../../types/workSettings';
import type { PageDialogs } from '../../composables/usePageDialogs';
import { readRelatedItems } from '../../utils/relatedItems';
import { readWorkAccess } from '../../utils/workAccess';
import { requireSuccess, reportBackendError } from '../../utils/backend';
import { messageFormat } from '../../utils/messages';
import { compareFlexibleDates, formatSettingDate, differenceFlexibleDays, shiftFlexibleDate } from '../../utils/dates';
import { parseTimelineDateValue } from '../../utils/timelineChart';
import type { TimelineEntry } from '../../types/timeline';
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
  Title: '',
  EventDate: '',
  EndDate: '',
  Content: ''
});
const canAdd = computed(() => initialized.value && !!work.value && (props.isAdmin || isCreator.value));
const canEdit = canAdd;
const dialogTitle = computed(() => '年表一覧（' + (selected.value ? canEdit.value ? '編集' : '詳細' : '新規登録') + '）');
const role = computed(() => props.isAdmin ? '管理者' : isCreator.value ? '作成者' : 'アシスタント');
const details = ref<(WorkSettingRow & {
  localKey: number;
})[]>([]);
const snapshot = ref<{
  TimeEventId: unknown;
  UpdateDate: string;
}[]>([]);
const calendars = ref<WorkSettingRow[]>([]);
const allDetails = ref<WorkSettingRow[]>([]);
const characters = ref<WorkSettingRow[]>([]);
const stages = ref<WorkSettingRow[]>([]);
const builds = ref<WorkSettingRow[]>([]);
const detailOpened = ref(false);
const detailDraft = ref<(WorkSettingRow & {
  localKey: number;
}) | null>(null);
const detailColumns: TableColumn[] = [{
  key: 'Detail',
  label: '詳細',
  width: 90
}, {
  key: 'Title',
  label: '出来事タイトル',
  sortable: true
}, {
  key: 'Period',
  label: '期間'
}, {
  key: 'Content',
  label: '内容',
  sortable: true
}];
let detailSequence = 0;
const chartVisible = ref(false);
const filteredRows = ref<WorkSettingRow[]>([]);
const timeline = computed(() => filteredRows.value.flatMap(row => {
  const start = parseTimelineDateValue(row.EventDate);
  if (!start) return [];
  const finish = parseTimelineDateValue(row.EndDate, true) || start;
  const entry: TimelineEntry = {
    Key: String(row.TimeId),
    DateText: parentPeriod(row),
    LabelText: String(row.Title),
    TooltipText: String(row.Title || '') + '\n' + parentPeriod(row),
    StartValue: start.Value,
    EndValue: Math.max(start.Value, finish.Value),
    HasPeriod: !!row.EndDate && finish.Value > start.Value
  };
  const children: TimelineEntry[] = allDetails.value.filter(detail => String(detail.TimeId) === String(row.TimeId)).flatMap(detail => {
    const date = parseTimelineDateValue(detail.StartDate);
    if (!date) return [];
    const end = parseTimelineDateValue(detail.EndDate, true) || date;
    return [{
      Key: 'detail:' + detail.TimeEventId,
      ParentKey: String(row.TimeId),
      IsChild: true,
      DateText: detailPeriod(detail),
      LabelText: '└ ' + String(detail.Title),
      TooltipText: String(detail.Title || '') + '\n' + detailPeriod(detail),
      StartValue: date.Value,
      EndValue: Math.max(date.Value, end.Value),
      HasPeriod: !!detail.EndDate && end.Value > date.Value
    }];
  });
  return [entry, ...children];
}));

function eraPrefix(id: unknown, date: unknown) {
  const era = calendars.value.find(row => String(row.CaleId) === String(id));
  if (!era || !date) return '';
  const year = Number.parseInt(String(date).replace(/[^0-9]/g, '').slice(0, 4), 10);
  const start = Number.parseInt(String(era.StartYear || '').replace(/[^0-9]/g, '').slice(0, 4), 10);
  return String(era.EraName || '') + (Number.isNaN(year) || Number.isNaN(start) ? '' : year - start + 1 + '年 ');
}

function parentPeriod(row: WorkSettingRow) {
  const start = eraPrefix(row.CaleId, row.EventDate) + formatSettingDate(String(row.EventDate || ''));
  return row.EndDate ? start + ' 〜 ' + eraPrefix(row.EndCaleId, row.EndDate) + formatSettingDate(String(row.EndDate)) : start;
}

function detailPeriod(row: WorkSettingRow) {
  const start = formatSettingDate(String(row.StartDate || '')) + (row.StartTime ? ' ' + row.StartTime : '');
  return row.EndDate ? start + ' 〜 ' + formatSettingDate(String(row.EndDate)) + (row.EndTime ? ' ' + row.EndTime : '') : start;
}
const skippedCount = computed(() => filteredRows.value.reduce((total, row) => total + (!parseTimelineDateValue(row.EventDate) ? 1 : 0) + allDetails.value.filter(detail => String(detail.TimeId) === String(row.TimeId) && !parseTimelineDateValue(detail.StartDate)).length, 0));

function selectChart(key: string) {
  const id = key.startsWith('detail:') ? allDetails.value.find(row => String(row.TimeEventId) === key.slice(7))?.TimeId : key;
  const row = rows.value.find(row => String(row.TimeId) === String(id));
  if (row) selectRow(row);
}
const previousStart = ref('');
/** 親の期間変更時は、旧保存処理と同じ日数移動と終了日への丸めを、編集中の詳細へ適用する。 */


function followParentDates() {
  const start = fields.getValue('EventDate', '');
  const end = fields.getValue('EndDate', '');
  const days = differenceFlexibleDays(previousStart.value, start) || 0;
  for (const row of details.value) for (const key of ['StartDate', 'EndDate']) {
    const original = fields.getValue(detailKey(row, key), String(row[key] || ''));
    if (!original) continue;
    let shifted = shiftFlexibleDate(original, days) || original;
    if (end && compareFlexibleDates(shifted, end) === 1) shifted = end;
    fields.setValue(detailKey(row, key), shifted);
    row[key] = shifted;
  }
  previousStart.value = start;
}

function detailKey(row: {
  localKey: number;
}, key: string) {
  return 'detail:' + row.localKey + ':' + key;
}

function detailFieldRef(row: {
  localKey: number;
}, key: string, initial: unknown) {
  const id = detailKey(row, key);
  return (instance: unknown) => fields.register(id, instance, initial);
}

function addDetail() {
  if (!canEdit.value || saving.value) return;
  editDetail({
    localKey: ++detailSequence,
    UpdateDate: '',
    Title: '',
    StartDate: fields.getValue('EventDate', ''),
    StartTime: '',
    EndDate: '',
    EndTime: '',
    Content: '',
    CharaInfo: [],
    StageInfo: [],
    BuildInfo: []
  });
}

function editDetail(row: WorkSettingRow & {
  localKey: number;
}) {
  if (saving.value) return;
  // 関連項目も編集用に複製し、閉じた場合は一覧の値を変更しない。
  detailDraft.value = {
    ...row,
    ...Object.fromEntries(['CharaInfo', 'StageInfo', 'BuildInfo'].map(key => [key, Array.isArray(row[key]) ? row[key].map(item => ({
      ...item
    })) : []]))
  };
  errors.value = {};
  detailOpened.value = true;
}

function closeDetail() {
  detailOpened.value = false;
  detailDraft.value = null;
}

function removeDetail(key: number) {
  if (!canEdit.value || saving.value) return;
  details.value = details.value.filter(row => row.localKey !== key);
  closeDetail();
}

async function commitDetail() {
  const row = detailDraft.value;
  if (!row || !canEdit.value || saving.value) return;
  errors.value = {};
  const value = readDetail(row);
  validateDetail(row, value, fields.getValues(form));
  const first = Object.keys(errors.value)[0];
  if (first) {
    await nextTick();
    fields.focus(first);
    return;
  }
  const committed = {
    ...row,
    ...value,
    UpdateDate: row.UpdateDate
  };
  const index = details.value.findIndex(item => item.localKey === row.localKey);
  if (index < 0) details.value.push(committed);else details.value[index] = committed;
  closeDetail();
}

function readDetail(row: WorkSettingRow & {
  localKey: number;
}) {
  const result: Record<string, unknown> = {
    TimeEventId: row.TimeEventId ?? null,
    UpdateDate: row.UpdateDate || null
  };
  for (const key of ['Title', 'StartDate', 'StartTime', 'EndDate', 'EndTime', 'Content']) result[key] = fields.getValue(detailKey(row, key), String(row[key] || ''));
  for (const kind of ['Chara', 'Stage', 'Build']) result[kind + 'Info'] = fields.getValue(detailKey(row, kind + 'Info'), row[kind + 'Info'] || []);
  return result;
}
const columns: TableColumn[] = [{
  key: 'Detail',
  label: '詳細',
  width: 90
}, {
  key: 'Title',
  label: 'タイトル',
  sortable: true,
  filterable: true
}, {
  key: 'EraName',
  label: '元号',
  sortable: true,
  filterable: true
}, {
  key: 'EventDate',
  label: '発生時期',
  sortable: true
}, {
  key: 'EndEraName',
  label: '終了時期元号',
  sortable: true,
  filterable: true
}, {
  key: 'EndDate',
  label: '終了時期',
  sortable: true
}, {
  key: 'Content',
  label: '内容',
  sortable: true
}, ...metadataColumns().map(column => ({
  ...column,
  filterable: !column.key.endsWith('Date')
}))];
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
      const data = requireSuccess(await props.request<Record<string, WorkSettingRow[]>>('/GetTimelineList.php', 'POST', {}), messageFormat('ERROR', 'E_0003', '年表一覧の取得'));
      if (!Array.isArray(data?.TimelineList)) throw new Error(messageFormat('ERROR', 'E_0026'));
      const events = requireSuccess(await props.request<Record<string, WorkSettingRow[]>>('/GetTimelineEventList.php', 'POST', {}), messageFormat('ERROR', 'E_0003', '年表詳細の取得'));
      if (!Array.isArray(events?.TimelineEventList) || !Array.isArray(events.CharacterList) || !Array.isArray(events.StageList) || !Array.isArray(events.BuildList)) throw new Error(messageFormat('ERROR', 'E_0026'));
      if (disposed) return;
      allDetails.value = events.TimelineEventList.map(row => ({
        ...row,
        CharaInfo: readRelatedItems(row.CharaInfo, 'CharaInfo', 'CharaId'),
        StageInfo: readRelatedItems(row.StageInfo, 'StageInfo', 'StageId'),
        BuildInfo: readRelatedItems(row.BuildInfo, 'BuildInfo', 'BuildId')
      }));
      characters.value = events.CharacterList;
      stages.value = events.StageList;
      builds.value = events.BuildList;
      if (disposed) return;
      calendars.value = Array.isArray(data.CalendarList) ? data.CalendarList : [];
      rows.value = data.TimelineList;
      initialized.value = true;
    });
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '年表一覧の取得'));
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
  form.Title = String(row.Title ?? '');
  form.EventDate = String(row.EventDate ?? '');
  previousStart.value = form.EventDate;
  form.EndDate = String(row.EndDate ?? '');
  form.Content = String(row.Content ?? '');
  const existing = allDetails.value.filter(detail => String(detail.TimeId) === String(row.TimeId));
  details.value = existing.map(detail => ({
    ...detail,
    localKey: ++detailSequence
  }));
  snapshot.value = existing.map(detail => ({
    TimeEventId: detail.TimeEventId,
    UpdateDate: detail.UpdateDate
  }));
  fields.setValues(form);
  errors.value = {};
  revision.value++;
  opened.value = true;
}

function clear() {
  if (saving.value) return;
  closeDetail();
  selected.value = null;
  Object.assign(form, {
    Title: '',
    EventDate: '',
    EndDate: '',
    Content: ''
  });
  details.value = [];
  snapshot.value = [];
  previousStart.value = '';
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

function validateDetail(row: {
  localKey: number;
}, detail: Record<string, unknown>, values: {
  EventDate: string;
  EndDate: string;
}) {
  const title = String(detail.Title || '');
  const start = String(detail.StartDate || '');
  const end = String(detail.EndDate || '');
  const startTime = String(detail.StartTime || '');
  const endTime = String(detail.EndTime || '');
  if (!title.trim()) errors.value[detailKey(row, 'Title')] = messageFormat('ERROR', 'E_0001', '出来事タイトル');
  if (title.length > 30) errors.value[detailKey(row, 'Title')] = messageFormat('ERROR', 'E_0002', '出来事タイトル', 30);
  if (!start) errors.value[detailKey(row, 'StartDate')] = messageFormat('ERROR', 'E_0001', '開始年月日');
  if (!String(detail.Content || '').trim()) errors.value[detailKey(row, 'Content')] = messageFormat('ERROR', 'E_0001', '内容');
  const compare = compareFlexibleDates(end, start);
  if (end && (compare === -1 || compare === 0 && startTime && endTime && endTime < startTime)) errors.value[detailKey(row, 'EndDate')] = messageFormat('ERROR', 'E_0074');
  if (compareFlexibleDates(start, values.EventDate) === -1) errors.value[detailKey(row, 'StartDate')] = messageFormat('ERROR', 'E_0075');
  if (values.EndDate && compareFlexibleDates(end || start, values.EndDate) === 1) errors.value[detailKey(row, 'EndDate')] = messageFormat('ERROR', 'E_0076');
}

async function save() {
  if (!canEdit.value || saving.value || loading.value) return;
  const values = fields.getValues(form);
  errors.value = {};
  if (!values.Title.trim()) errors.value.Title = messageFormat('ERROR', 'E_0001', '出来事タイトル');
  if (values.Title.length > 30) errors.value.Title = messageFormat('ERROR', 'E_0002', '出来事タイトル', 30);
  if (!values.EventDate) errors.value.EventDate = messageFormat('ERROR', 'E_0001', '発生時期');
  if (compareFlexibleDates(values.EventDate, values.EndDate) === 1) errors.value.EndDate = messageFormat('ERROR', 'E_0077');
  const detailValues = details.value.map(readDetail);
  details.value.forEach((row, index) => {
    const detail = detailValues[index]!;
    validateDetail(row, detail, values);
  });
  const first = Object.keys(errors.value)[0];
  if (first) {
    const invalid = details.value.find(row => first.startsWith('detail:' + row.localKey + ':'));
    if (invalid) {
      detailDraft.value = {
        ...invalid
      };
      detailOpened.value = true;
    }
    await nextTick();
    fields.focus(first);
    return;
  }
  const payload: Record<string, unknown> = {
    ...values,
    TimeId: selected.value?.TimeId ?? null,
    UpdateDate: selected.value?.UpdateDate ?? null
  };
  payload.Details = detailValues;
  payload.DetailsSnapshot = snapshot.value;
  await persist('/SaveTimeline.php', payload, '保存');
}

async function remove() {
  const row = selected.value;
  if (!row || !canEdit.value || saving.value || loading.value) return;
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'この年表一覧を削除'))) || disposed) return;
  await persist('/DeleteTimeline.php', {
    TimeId: row.TimeId,
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
      requireSuccess(await props.request(endpoint, 'POST', payload), messageFormat('ERROR', 'E_0003', '年表一覧の' + operation));
      if (!disposed) completed = true;
    });
    if (completed && !disposed) await props.dialogs.info(messageFormat('INFO', 'I_0011', operation), messageFormat('INFO', 'I_0001', '年表一覧の' + operation));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '年表一覧の' + operation));
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
    const target = rows.value.find(row => String(row.TimeId) === props.targetId);
    if (target) selectRow(target);
  }
});
</script>

<template>
  <div>
    <WorkContentHeader
      title="年表一覧"
      icon="fa-stream"
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
    <div class="ButtonGroup ViewToggleButtonGroup">
      <ButtonComponent
        type="button"
        variant="SecondaryButton"
        @click="chartVisible = !chartVisible"
      >
        <i
          :class="chartVisible ? 'fas fa-table' : 'fas fa-stream'"
          aria-hidden="true"
        />
        {{ chartVisible ? '一覧表示' : '年表表示' }}
      </ButtonComponent>
    </div>
    <div v-show="!chartVisible">
      <TableComponent
        :rows="rows"
        :columns="columns"
        row-key="TimeId"
        :hide-meta="hideMeta"
        :loading="loading"
        @result-change="value => filteredRows = value"
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
    </div>
    <TimelineChart
      v-if="chartVisible"
      show-legend
      empty-icon="fa-stream"
      :entries="timeline"
      @select="selectChart"
    >
      <template #empty>{{ filteredRows.length ? messageFormat('INFO','I_0091') : messageFormat('INFO','I_0090') }}</template>
      <template #note>
        <div
          v-if="skippedCount && timeline.length"
          class="TimelineChartNote"
        >{{ messageFormat('INFO','I_0081',skippedCount) }}</div>
      </template>
    </TimelineChart>
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
            :ref="el => fields.register('Title', el, form.Title)"
            label="出来事タイトル"
            :readonly="!canEdit"
            :error="errors.Title"
            required
            :maxlength="30"
          />
          <TextFieldComponent
            :ref="el => fields.register('EventDate', el, form.EventDate)"
            label="発生時期"
            @value-change="followParentDates"
            :readonly="!canEdit"
            :error="errors.EventDate"
            input-readonly
            :date-picker-flg="canEdit"
            required
          />
          <TextFieldComponent
            :ref="el => fields.register('EndDate', el, form.EndDate)"
            label="終了時期"
            @value-change="followParentDates"
            :readonly="!canEdit"
            :error="errors.EndDate"
            input-readonly
            :date-picker-flg="canEdit"
          />
          <TextFieldComponent
            :ref="el => fields.register('Content', el, form.Content)"
            label="内容"
            :readonly="!canEdit"
            text-area-flg
          />
        </div>
      </section>
      <section class="FormSection">
        <h3 class="FormSectionTitle">年表詳細</h3>
        <ButtonComponent
          v-if="canEdit"
          type="button"
          variant="PrimaryButton ButtonSmall"
          @click="addDetail"
        >
          <i
            class="fas fa-plus"
            aria-hidden="true"
          />
          追加
        </ButtonComponent>
        <TableComponent
          :rows="details"
          :columns="detailColumns"
          row-key="localKey"
          :page-size="5"
          :scroll-top-on-page-change="false"
        >
          <template #cell-Detail="{ row }">
            <ButtonComponent
              type="button"
              variant="PrimaryButton ButtonSmall"
              @click="editDetail(row as WorkSettingRow & { localKey: number })"
            >詳細</ButtonComponent>
          </template>
          <template #cell-Period="{ row }">{{ detailPeriod(row as WorkSettingRow) }}</template>
        </TableComponent>
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
    <BaseDialog
      v-model="detailOpened"
      title="年表詳細"
      size="DialogLarge"
      @close="closeDetail"
    >
      <section
        v-if="detailDraft"
        :key="detailDraft.localKey"
        class="FormSection"
      >
        <div class="FormGrid">
          <TextFieldComponent
            :ref="detailFieldRef(detailDraft, 'Title', String(detailDraft.Title || ''))"
            :error="errors[detailKey(detailDraft, 'Title')]"
            label="出来事タイトル"
            :readonly="!canEdit"
            required
            :maxlength="30"
          />
          <TextFieldComponent
            :ref="detailFieldRef(detailDraft, 'StartDate', String(detailDraft.StartDate || ''))"
            :error="errors[detailKey(detailDraft, 'StartDate')]"
            label="開始年月日"
            :readonly="!canEdit"
            input-readonly
            :date-picker-flg="canEdit"
            required
          />
          <TextFieldComponent
            :ref="detailFieldRef(detailDraft, 'StartTime', String(detailDraft.StartTime || ''))"
            :error="errors[detailKey(detailDraft, 'StartTime')]"
            label="開始時分"
            type="time"
            :readonly="!canEdit"
            :maxlength="5"
          />
          <TextFieldComponent
            :ref="detailFieldRef(detailDraft, 'EndDate', String(detailDraft.EndDate || ''))"
            :error="errors[detailKey(detailDraft, 'EndDate')]"
            label="終了年月日"
            :readonly="!canEdit"
            input-readonly
            :date-picker-flg="canEdit"
          />
          <TextFieldComponent
            :ref="detailFieldRef(detailDraft, 'EndTime', String(detailDraft.EndTime || ''))"
            :error="errors[detailKey(detailDraft, 'EndTime')]"
            label="終了時分"
            type="time"
            :readonly="!canEdit"
            :maxlength="5"
          />
          <TextFieldComponent
            :ref="detailFieldRef(detailDraft, 'Content', String(detailDraft.Content || ''))"
            :error="errors[detailKey(detailDraft, 'Content')]"
            label="内容"
            :readonly="!canEdit"
            text-area-flg
            required
          />
        </div>
        <RelatedItemsEditor
          :ref="detailFieldRef(detailDraft, 'CharaInfo', detailDraft.CharaInfo || [])"
          label="関連キャラ"
          :items="characters"
          id-key="CharaId"
          name-key="CharaName"
          :readonly="!canEdit"
          :dialogs="dialogs"
          icon="fa-user"
        />
        <RelatedItemsEditor
          :ref="detailFieldRef(detailDraft, 'StageInfo', detailDraft.StageInfo || [])"
          label="関連舞台"
          :items="stages"
          id-key="StageId"
          name-key="StageName"
          :readonly="!canEdit"
          :dialogs="dialogs"
          icon="fa-map-marked-alt"
        />
        <RelatedItemsEditor
          :ref="detailFieldRef(detailDraft, 'BuildInfo', detailDraft.BuildInfo || [])"
          label="関連建物"
          :items="builds"
          id-key="BuildId"
          name-key="BuildName"
          :readonly="!canEdit"
          :dialogs="dialogs"
          icon="fa-landmark"
        />
      </section>
      <template #actions>
        <ButtonComponent
          type="button"
          variant="CloseButton"
          @click="closeDetail"
        >閉じる</ButtonComponent>
        <template v-if="canEdit && detailDraft">
          <ButtonComponent
            type="button"
            variant="ClearButton"
            @click="addDetail"
          >クリア</ButtonComponent>
          <ButtonComponent
            v-if="details.some(row => row.localKey === detailDraft?.localKey)"
            type="button"
            variant="DeleteButton ButtonSmall"
            @click="removeDetail(detailDraft.localKey)"
          >削除</ButtonComponent>
          <ButtonComponent
            type="button"
            variant="SaveButton"
            @click="commitDetail"
          >反映</ButtonComponent>
        </template>
      </template>
    </BaseDialog>
  </div>
</template>
