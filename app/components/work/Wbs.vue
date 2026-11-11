<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref } from 'vue';
import type { BackendRequest, DownloadData } from '../../types/backend';
import type { WorkInfo } from '../../types/work';
import type { WorkSettingRow } from '../../types/workSettings';
import type { PageDialogs } from '../../composables/usePageDialogs';
import type { TableColumn, TableRow } from '../../composables/tableData';
import type { WbsViewMode } from '../../types/wbs';
import { useInputFields } from '../../composables/useInputFields';
import { useOperationSpinner } from '../../composables/useOperationSpinner';
import { readWorkAccess } from '../../utils/workAccess';
import { requireSuccess, reportBackendError } from '../../utils/backend';
import { messageFormat } from '../../utils/messages';
import { downloadBase64 } from '../../utils/files';
import { parseCalendarDate as wbsDate, calendarDayDifference as wbsDays, addCalendarDays as wbsAddDays, calendarDateText as wbsDateText } from '../../utils/dates';
import type { WbsRange, WbsTick } from '../../types/wbs';
import { japaneseHolidayName } from '../../utils/holidays';
import { CONST_VARIABLE } from '../../config/Const';
import { formatSettingDate } from '../../utils/dates';
const props = defineProps<{
  request: BackendRequest;
  dialogs: PageDialogs;
  isAdmin: boolean;
  hideMeta?: boolean;
}>();
const auth = useAuthSession();
const remembered = useState<Record<string, string>>(CONST_VARIABLE.STATE_KEY.WBS_SELECTION, () => ({}));
const fields = useInputFields();
const spinner = useOperationSpinner();
const role = ref('');
const work = ref<WorkInfo>();
const canEdit = ref(false);
const loginUserId = ref('');
const busy = ref(false);
const folders = ref<WorkSettingRow[]>([]);
const selected = ref<WorkSettingRow | null>(null);
const tasks = ref<WorkSettingRow[]>([]);
const filtered = ref<TableRow[]>([]);
const assignees = ref<WorkSettingRow[]>([]);
const parents = ref<WorkSettingRow[]>([]);
const collapsed = ref<string[]>([]);
const mode = ref<WbsViewMode>('Month');
const infoOpen = ref(false);
const taskOpen = ref(false);
const editingInfo = ref<WorkSettingRow | null>(null);
const editingTask = ref<WorkSettingRow | null>(null);
const errors = ref<Record<string, string>>({});
const revision = ref(0);
const related = ref<Record<string, unknown>[]>([]);
const infoForm = reactive({
  WbsName: '',
  Description: '',
  StartDate: '',
  EndDate: ''
});
const taskForm = reactive({
  TaskName: '',
  ParentTaskId: '',
  Description: '',
  StartDate: '',
  EndDate: '',
  Progress: '0'
});
const canProgress = computed(() => canEdit.value || !!editingTask.value && Array.isArray(editingTask.value.AssigneeIds) && editingTask.value.AssigneeIds.includes(loginUserId.value));
const parentOptions = computed(() => [{
  value: '',
  label: ''
}, ...parents.value.filter(row => String(row.TaskId) !== String(editingTask.value?.TaskId)).map(row => ({
  value: String(row.TaskId),
  label: String(row.TaskName)
}))]);
const range = computed(() => buildChartRange(filtered.value, mode.value));
const parentIds = computed(() => new Set(filtered.value.filter(row => row.ParentTaskId).map(row => String(row.ParentTaskId))));
const columns = computed<TableColumn[]>(() => [{
  key: 'TaskName',
  label: 'タスク名',
  filterable: true,
  width: 220,
  className: 'WbsFixedCol'
}, {
  key: 'AssigneeIds',
  label: '担当者',
  filterable: true,
  width: 140,
  className: 'WbsFixedCol',
  format: value => Array.isArray(value) ? value : []
}, {
  key: 'StatusLabel',
  label: '状態',
  filterable: true,
  sortable: true,
  width: 130,
  className: 'WbsFixedCol'
}, {
  key: 'Progress',
  label: '進捗率',
  sortable: true,
  width: 100,
  className: 'WbsFixedCol',
  type: 'number'
}, {
  key: 'Chart',
  label: '',
  width: range.value?.ChartWidth || 1,
  className: 'WbsChartCell',
  headerClassName: 'WbsChartHead',
  resizable: false
}]);
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
});
/** 絞込結果の参照が同じ場合は再代入しない。チャート幅の変更で表を再初期化しない。 */


function setFiltered(rows: TableRow[]) {
  if (rows.length !== filtered.value.length || rows.some((row, index) => row !== filtered.value[index])) filtered.value = rows;
}

function toggle(row: TableRow) {
  const id = String(row.TaskId);
  collapsed.value = collapsed.value.includes(id) ? collapsed.value.filter(value => value !== id) : [...collapsed.value, id];
}

function rowVisible(row: TableRow) {
  return !row.ParentTaskId || !collapsed.value.includes(String(row.ParentTaskId));
}

function changeMode() {
  mode.value = fields.getValue('ViewMode', 'Month') as WbsViewMode;
}

async function read(id: unknown = null, restore = false) {
  const access = await readWorkAccess(props.request, work.value?.WorkId);
  const memoryKey = String(auth.user.value?.UserId || '') + ':' + access.work.WorkId;
  if (restore) id = remembered.value[memoryKey] || null;
  const data = requireSuccess(await props.request<Record<string, unknown>>('/GetWbsTaskList.php' + (id ? '?WbsId=' + encodeURIComponent(String(id)) : '')), messageFormat('ERROR', 'E_0003', 'WBSの取得'));
  if (!Array.isArray(data?.WbsList) || !Array.isArray(data.TaskList) || !Array.isArray(data.AssigneeList) || !Array.isArray(data.ParentList)) throw new Error(messageFormat('ERROR', 'E_0026'));
  if (disposed) return;
  work.value = access.work;
  role.value = props.isAdmin ? '管理者' : access.isCreator ? '作成者' : 'アシスタント';
  canEdit.value = data.CanEdit === true;
  loginUserId.value = String(data.LoginUserId || '');
  folders.value = data.WbsList as WorkSettingRow[];
  selected.value = data.SelectedWbs as WorkSettingRow | null;
  if (selected.value) remembered.value[memoryKey] = String(selected.value.WbsId);else delete remembered.value[memoryKey];
  tasks.value = (data.TaskList as WorkSettingRow[]).map(row => ({
    ...row,
    StatusLabel: Number(row.Progress) >= 100 ? '完了' : row.IsDelayed ? '遅延' : Number(row.Progress) > 0 ? '進行中' : '未着手'
  }));
  assignees.value = data.AssigneeList as WorkSettingRow[];
  parents.value = data.ParentList as WorkSettingRow[];
}

async function load(id: unknown = null, restore = false) {
  if (busy.value) return;
  busy.value = true;
  try {
    await spinner.run(() => read(id, restore));
    collapsed.value = [];
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'WBSの取得'));
  } finally {
    busy.value = false;
  }
}
/** 権限はサーバーでも再確認する。担当者の進捗更新では他の項目を変更しない。 */


async function persist(endpoint: string, payload: Record<string, unknown>, operation: string, id: unknown) {
  if (busy.value || disposed) return false;
  busy.value = true;
  let completed = false;
  try {
    await spinner.run(async () => {
      await readWorkAccess(props.request, work.value?.WorkId);
      if (disposed) return;
      requireSuccess(await props.request(endpoint, 'POST', payload), messageFormat('ERROR', 'E_0003', operation));
      completed = true;
      await read(id);
    });
    if (completed && !disposed) await props.dialogs.info(messageFormat('INFO', 'I_0011', operation), messageFormat('INFO', 'I_0001', operation));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', operation));
  } finally {
    busy.value = false;
  }
  return completed;
}

function openInfo(row: WorkSettingRow | null = null) {
  if (!canEdit.value || busy.value) return;
  editingInfo.value = row ? {
    ...row
  } : null;
  Object.assign(infoForm, {
    WbsName: String(row?.WbsName || ''),
    Description: String(row?.Description || ''),
    StartDate: formatSettingDate(String(row?.StartDate || '')),
    EndDate: formatSettingDate(String(row?.EndDate || ''))
  });
  fields.setValues(infoForm);
  errors.value = {};
  revision.value++;
  infoOpen.value = true;
}

function validatePeriod(start: string, end: string) {
  for (const [key, value, label] of [['StartDate', start, '開始予定日'], ['EndDate', end, '終了予定日']]) {
    if (!value) errors.value[key!] = messageFormat('ERROR', 'E_0001', label!);else if (value < '1950-01-01' || value > '2100-12-31') errors.value[key!] = messageFormat('ERROR', 'E_0061', label!);
  }
  if (start && end && start > end) errors.value.EndDate = messageFormat('ERROR', 'E_0062');
}

async function saveInfo() {
  if (!canEdit.value || busy.value) return;
  const values = fields.getValues(infoForm);
  errors.value = {};
  const start = wbsDateText(values.StartDate);
  const end = wbsDateText(values.EndDate);
  if (!values.WbsName.trim()) errors.value.WbsName = messageFormat('ERROR', 'E_0001', 'WBS名');
  if (values.WbsName.length > 30) errors.value.WbsName = messageFormat('ERROR', 'E_0002', 'WBS名', 30);
  validatePeriod(start, end);
  if (Object.keys(errors.value).length) {
    fields.focus(Object.keys(errors.value)[0]!);
    return;
  }
  if (await persist('/SaveWbsInfo.php', {
    ...values,
    WbsId: editingInfo.value?.WbsId ?? null,
    UpdateDate: editingInfo.value?.UpdateDate ?? null,
    StartDate: start,
    EndDate: end
  }, '保存', null)) infoOpen.value = false;
}

function openTask(row: WorkSettingRow | null = null) {
  if (busy.value || !selected.value || !row && !canEdit.value) return;
  editingTask.value = row ? {
    ...row
  } : null;
  Object.assign(taskForm, {
    TaskName: String(row?.TaskName || ''),
    ParentTaskId: String(row?.ParentTaskId || ''),
    Description: String(row?.Description || ''),
    StartDate: formatSettingDate(String(row?.StartDate || selected.value.StartDate || '')),
    EndDate: formatSettingDate(String(row?.EndDate || selected.value.EndDate || '')),
    Progress: String(row?.Progress || '0')
  });
  related.value = Array.isArray(row?.AssigneeIds) ? row.AssigneeIds.map(UserId => ({
    UserId
  })) : [];
  fields.setValues(taskForm);
  errors.value = {};
  revision.value++;
  taskOpen.value = true;
}

function changeParent() {
  const id = fields.getValue('ParentTaskId', '');
  const row = tasks.value.find(row => String(row.TaskId) === id) || selected.value;
  if (row) fields.setValues({
    StartDate: formatSettingDate(String(row.StartDate || '')),
    EndDate: formatSettingDate(String(row.EndDate || ''))
  });
}

async function saveTask() {
  if (!canProgress.value || !selected.value || busy.value) return;
  const values = fields.getValues(taskForm);
  errors.value = {};
  const progress = Number(values.Progress);
  const ids = fields.getValue('AssigneeIds', related.value).map(row => String(row.UserId));
  const start = wbsDateText(values.StartDate);
  const end = wbsDateText(values.EndDate);
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) errors.value.Progress = messageFormat('ERROR', 'E_0063');
  if (canEdit.value) {
    if (!values.TaskName.trim()) errors.value.TaskName = messageFormat('ERROR', 'E_0001', 'タスク名');
    if (values.TaskName.length > 20) errors.value.TaskName = messageFormat('ERROR', 'E_0002', 'タスク名', 20);
    if (!ids.length) errors.value.AssigneeIds = messageFormat('ERROR', 'E_0064');
    validatePeriod(start, end);
    const parent = tasks.value.find(row => String(row.TaskId) === values.ParentTaskId);
    for (const bound of [selected.value, parent]) if (bound && (start < String(bound.StartDate) || end > String(bound.EndDate))) errors.value.EndDate = messageFormat('ERROR', 'E_0065');
  }
  if (Object.keys(errors.value).length) {
    fields.focus(Object.keys(errors.value)[0]!);
    return;
  }
  const payload: Record<string, unknown> = {
    TaskId: editingTask.value?.TaskId ?? null,
    WbsId: selected.value.WbsId,
    Progress: progress,
    UpdateDate: editingTask.value?.UpdateDate ?? null
  };
  if (canEdit.value) Object.assign(payload, values, {
    Progress: progress,
    StartDate: start,
    EndDate: end,
    AssigneeIds: ids
  });
  if (await persist('/SaveWbsTask.php', payload, '保存', selected.value.WbsId)) taskOpen.value = false;
}

async function removeInfo() {
  const row = editingInfo.value;
  if (!row || !canEdit.value || busy.value || !(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0024', row.TaskCount || 0)))) return;
  if (await persist('/DeleteWbsInfo.php', {
    WbsId: row.WbsId,
    UpdateDate: row.UpdateDate
  }, '削除', null)) infoOpen.value = false;
}

async function removeTask() {
  const row = editingTask.value;
  if (!row || !selected.value || !canEdit.value || busy.value || !(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0025')))) return;
  if (await persist('/DeleteWbsTask.php', {
    TaskId: row.TaskId,
    UpdateDate: row.UpdateDate
  }, '削除', selected.value.WbsId)) taskOpen.value = false;
}

async function output() {
  if (!selected.value || busy.value) return;
  busy.value = true;
  try {
    const data = await spinner.run(async () => {
      await readWorkAccess(props.request, work.value?.WorkId);
      return requireSuccess(await props.request<DownloadData>('/ExportWbsExcel.php', 'POST', {
        WbsId: selected.value!.WbsId,
        ViewMode: mode.value
      }), messageFormat('ERROR', 'E_0003', 'WBSの出力'));
    });
    if (!disposed) downloadBase64(data);
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'WBSの出力'));
  } finally {
    busy.value = false;
  }
}
/** 旧WBSの余白・区切り・当日線・曜日表示の計算を共有する。 */


function buildChartRange(rows: Record<string, unknown>[], mode: WbsViewMode, now = new Date()): WbsRange | null {
  if (!rows.length) return null;
  const setting = {
    Day: {
      width: 34,
      padding: 3
    },
    Week: {
      width: 14,
      padding: 14
    },
    Month: {
      width: 4,
      padding: 45
    }
  }[mode];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let min = today;
  let max = today;
  for (const row of rows) {
    const start = wbsDate(row.StartDate);
    const end = wbsDate(row.EndDate);
    if (start && start < min) min = start;
    if (end && end > max) max = end;
  }
  let start = wbsAddDays(min, -setting.padding);
  let end = wbsAddDays(max, setting.padding);
  if (mode === 'Week') {
    start = wbsAddDays(start, -((start.getDay() + 6) % 7));
    end = wbsAddDays(end, 6 - (end.getDay() + 6) % 7);
  }
  if (mode === 'Month') {
    start = new Date(start.getFullYear(), start.getMonth(), 1);
    end = new Date(end.getFullYear(), end.getMonth() + 1, 0);
  }
  const total = wbsDays(start, end) + 1;
  const width = total * setting.width;
  const ticks: WbsTick[] = [];
  for (let index = 0; index < total; index++) {
    const date = wbsAddDays(start, index);
    if (mode === 'Day' || mode === 'Week' && date.getDay() === 1 || mode === 'Month' && date.getDate() === 1) ticks.push({
      Date: date,
      Offset: index * setting.width,
      Width: 0,
      Label: mode === 'Day' ? String(date.getDate()) : mode === 'Week' ? date.getMonth() + 1 + '/' + date.getDate() : date.getMonth() + 1 + '月',
      IsWeekend: mode === 'Day' && [0, 6].includes(date.getDay()),
      HolidayName: mode === 'Day' ? japaneseHolidayName(date) : ''
    });
  }
  const active = ticks.filter(tick => tick.Date <= today).at(-1);
  if (active) active.IsToday = true;
  const periods: {
    Offset: number;
    Width: number;
    Label: string;
  }[] = [];
  let previous = '';
  for (const tick of ticks) {
    const key = mode === 'Month' ? tick.Date.getFullYear() + '年' : tick.Date.getFullYear() + '年' + (tick.Date.getMonth() + 1) + '月';
    if (key !== previous) {
      periods.push({
        Offset: tick.Offset,
        Width: 0,
        Label: key
      });
      previous = key;
    }
  }
  for (const list of [ticks, periods]) list.forEach((segment, index) => {
    segment.Width = Math.max((list[index + 1]?.Offset ?? width) - segment.Offset, 0);
  });
  return {
    StartDate: start,
    EndDate: end,
    DayWidth: setting.width,
    ChartWidth: width,
    TodayOffset: wbsDays(start, today) * setting.width,
    Ticks: ticks,
    Periods: periods
  };
}

function taskBar(row: Record<string, unknown>, range: WbsRange) {
  const start = wbsDate(row.StartDate);
  const end = wbsDate(row.EndDate);
  if (!start || !end) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const overdue = wbsDays(end, today);
  return {
    left: wbsDays(range.StartDate, start) * range.DayWidth,
    width: Math.max((wbsDays(start, end) + 1) * range.DayWidth, 4),
    overdueLeft: (wbsDays(range.StartDate, end) + 1) * range.DayWidth,
    overdueWidth: row.IsDelayed && overdue > 0 ? Math.max(overdue * range.DayWidth, 4) : 0,
    overdueDays: overdue
  };
}
onMounted(() => load(null, true));
</script>
<template>
  <div>
    <WorkContentHeader
      :title="selected ? String(selected.WbsName) : 'WBS'"
      :help-message="selected ? messageFormat('INFO','I_0082') : undefined"
      icon="fa-tasks"
      :work-title="work?.WorkTitle"
      :role="work ? role : undefined"
    />
    <template v-if="!selected">
      <div
        v-if="canEdit"
        class="ButtonGroup"
      >
        <ButtonComponent
          type="button"
          variant="SaveButton"
          @click="openInfo()"
        >
          <i
            class="fas fa-plus"
            aria-hidden="true"
          />
          WBS作成
        </ButtonComponent>
      </div>
      <div class="WbsFolderGrid">
        <div
          v-for="folder in folders"
          :key="String(folder.WbsId)"
          class="WbsFolderCard"
          role="button"
          tabindex="0"
          @click="load(folder.WbsId)"
          @keydown.enter.self="load(folder.WbsId)"
        >
          <div class="WbsFolderTab" />
          <div class="WbsFolderBody">
            <div
              class="WbsFolderName"
              :title="String(folder.WbsName)"
            >{{ folder.WbsName }}</div>
            <div
              v-if="folder.DelayedCount"
              class="WbsFolderBadgeArea"
            >
              <span class="WbsFolderBadge Delayed">
                <i
                  class="fas fa-exclamation-triangle"
                  aria-hidden="true"
                />
                遅延
                {{ folder.DelayedCount }}
                件
              </span>
            </div>
            <div
              class="WbsFolderProgress"
              :title="'進捗率 ' + folder.Progress + '%'"
            >
              <div
                class="WbsFolderProgressBar"
                :style="{width:folder.Progress + '%'}"
              />
              <span class="WbsFolderProgressText">
                {{ folder.Progress }}
                %
              </span>
            </div>
            <div
              v-if="canEdit"
              class="WbsFolderActionArea"
            >
              <ButtonComponent
                type="button"
                variant="SecondaryButton ButtonSmall"
                @click.stop="openInfo(folder)"
              >
                <i
                  class="fas fa-pen"
                  aria-hidden="true"
                />
                編集
              </ButtonComponent>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="ButtonGroup WbsToolbar">
        <ButtonComponent
          type="button"
          variant="SecondaryButton"
          @click="load()"
        >
          <i
            class="fas fa-arrow-left"
            aria-hidden="true"
          />
          戻る
        </ButtonComponent>
        <SelectBoxComponent
          :ref="el => fields.register('ViewMode',el,mode)"
          inline
          hide-list-button
          class="WbsChartViewModeSelect"
          :options="[{value:'Day',label:'日'},{value:'Week',label:'週'},{value:'Month',label:'月'}]"
          @value-change="changeMode"
        />
        <ButtonComponent
          v-if="canEdit"
          type="button"
          variant="SaveButton"
          @click="openTask()"
        >
          <i
            class="fas fa-plus"
            aria-hidden="true"
          />
          タスク追加
        </ButtonComponent>
        <ButtonComponent
          type="button"
          variant="SaveButton"
          @click="output"
        >
          <i
            class="fas fa-file-excel"
            aria-hidden="true"
          />
          出力
        </ButtonComponent>
      </div>
      <TableComponent
        :rows="tasks"
        :columns="columns"
        row-key="TaskId"
        :page-size="Math.max(tasks.length,1)"
        :show-footer="false"
        table-class="WbsTaskTable"
        container-class="WbsTaskTableArea"
        :sticky-columns="4"
        :row-visible="rowVisible"
        row-clickable
        @row-click="row => openTask(row as WorkSettingRow)"
        @result-change="setFiltered"
      >
        <template #header-Chart>
          <div
            v-if="range"
            class="WbsChartScale"
            :style="{width:range.ChartWidth+'px'}"
          >
            <div class="WbsChartScaleUpper">
              <div
                v-for="segment in range.Periods"
                :key="segment.Offset"
                class="WbsChartScaleLabel"
                :style="{left:segment.Offset+'px',width:segment.Width+'px'}"
              >{{ segment.Label }}</div>
            </div>
            <div class="WbsChartScaleLower">
              <div
                v-for="tick in range.Ticks"
                :key="tick.Offset"
                class="WbsChartScaleLabel"
                :style="{left:tick.Offset+'px',width:tick.Width+'px'}"
              >{{ tick.Label }}</div>
            </div>
          </div>
        </template>
        <template #cell-TaskName="{row}">
          <ButtonComponent
            v-if="parentIds.has(String(row.TaskId))"
            unstyled
            type="button"
            class="WbsTaskToggle"
            :aria-expanded="!collapsed.includes(String(row.TaskId))"
            @click.stop="toggle(row)"
          >
            <i
              :class="collapsed.includes(String(row.TaskId)) ? 'fas fa-chevron-right' : 'fas fa-chevron-down'"
              aria-hidden="true"
            />
          </ButtonComponent>
          {{ (row.ParentTaskId ? '└ ' : '') + row.TaskName }}
        </template>
        <template #cell-Progress="{row}">
          {{ row.Progress || 0 }}
          %
        </template>
        <template #cell-Chart="{row}">
          <div
            v-if="range"
            class="WbsChartTrack"
            :style="{width:range.ChartWidth+'px'}"
          >
            <div class="WbsChartGrid">
              <div
                v-for="tick in range.Ticks"
                :key="tick.Offset"
                class="WbsChartGridUnit"
                :class="{Weekend:tick.IsWeekend,Holiday:!!tick.HolidayName,Today:tick.IsToday}"
                :style="{width:tick.Width+'px'}"
                :title="tick.HolidayName"
              />
            </div>
            <div
              class="WbsChartTodayLine"
              :style="{left:range.TodayOffset+'px'}"
            />
            <template
              v-for="bar in [taskBar(row,range)]"
              :key="String(row.TaskId)"
            >
              <template v-if="bar">
                <div
                  class="WbsChartBar"
                  :class="{WbsChartBarDone:Number(row.Progress)>=100,WbsChartBarDelayed:Number(row.Progress)<100 && row.IsDelayed}"
                  :style="{left:bar.left+'px',width:bar.width+'px'}"
                >
                  <div
                    class="WbsChartBarProgress"
                    :style="{width:Math.min(Math.max(Number(row.Progress)||0,0),100)+'%'}"
                  />
                  <div class="WbsChartBarLabel">{{ (row.ParentTaskId ? '└ ' : '') + row.TaskName }}</div>
                </div>
                <div
                  v-if="bar.overdueWidth"
                  class="WbsChartOverdue"
                  :style="{left:bar.overdueLeft+'px',width:bar.overdueWidth+'px'}"
                  :title="messageFormat('INFO','I_0078',bar.overdueDays)"
                />
              </template>
            </template>
          </div>
        </template>
      </TableComponent>
    </template>
    <BaseDialog
      v-model="infoOpen"
      :title="editingInfo ? 'WBS編集' : 'WBS登録'"
      title-icon="fas fa-tasks"
      size="DialogMedium"
    >
      <section
        :key="revision"
        class="FormSection"
      >
        <TextFieldComponent
          :ref="el => fields.register('WbsName',el,infoForm.WbsName)"
          label="WBS名"
          required
          :maxlength="30"
          :error="errors.WbsName"
        />
        <TextFieldComponent
          :ref="el => fields.register('Description',el,infoForm.Description)"
          label="内容"
          text-area-flg
        />
        <TextFieldComponent
          :ref="el => fields.register('StartDate',el,infoForm.StartDate)"
          label="開始予定日"
          input-readonly
          date-picker-flg
          date-mode="date"
          required
          :error="errors.StartDate"
        />
        <TextFieldComponent
          :ref="el => fields.register('EndDate',el,infoForm.EndDate)"
          label="終了予定日"
          input-readonly
          date-picker-flg
          date-mode="date"
          required
          :error="errors.EndDate"
        />
      </section>
      <template #actions>
        <ButtonComponent
          type="button"
          variant="CloseButton"
          @click="infoOpen = false"
        >閉じる</ButtonComponent>
        <ButtonComponent
          v-if="editingInfo"
          type="button"
          variant="DeleteButton"
          @click="removeInfo"
        >削除</ButtonComponent>
        <ButtonComponent
          type="button"
          variant="SaveButton"
          @click="saveInfo"
        >保存</ButtonComponent>
      </template>
    </BaseDialog>
    <BaseDialog
      v-model="taskOpen"
      :title="editingTask ? 'タスク編集' : 'タスク登録'"
      title-icon="fas fa-tasks"
      size="DialogMedium"
    >
      <section
        :key="revision"
        class="FormSection"
      >
        <div class="FormGrid">
          <TextFieldComponent
            :ref="el => fields.register('TaskName',el,taskForm.TaskName)"
            label="タスク名"
            :readonly="!canEdit"
            required
            :maxlength="20"
            :error="errors.TaskName"
          />
          <SelectBoxComponent
            :ref="el => fields.register('ParentTaskId',el,taskForm.ParentTaskId)"
            label="親タスク"
            :options="parentOptions"
            :disabled="!canEdit || !!editingTask?.ParentTaskId"
            @value-change="changeParent"
          />
        </div>
        <RelatedItemsEditor
          :ref="el => fields.register('AssigneeIds',el,related)"
          label="担当者"
          required
          :error="errors.AssigneeIds"
          :show-count="false"
          :allow-clear="false"
          :confirm-removal="false"
          add-label="担当者を選択"
          :empty-message="messageFormat('INFO','I_0088')"
          :empty-selection-message="messageFormat('ERROR','E_0071')"
          :items="assignees"
          id-key="UserId"
          name-key="UserId"
          icon="fa-user"
          :readonly="!canEdit"
          :dialogs="dialogs"
        />
        <TextFieldComponent
          :ref="el => fields.register('Description',el,taskForm.Description)"
          label="内容"
          text-area-flg
          :readonly="!canEdit"
        />
        <div class="FormGrid">
          <TextFieldComponent
            :ref="el => fields.register('StartDate',el,taskForm.StartDate)"
            label="開始予定日"
            input-readonly
            :date-picker-flg="canEdit"
            :readonly="!canEdit"
            date-mode="date"
            required
            :error="errors.StartDate"
          />
          <TextFieldComponent
            :ref="el => fields.register('EndDate',el,taskForm.EndDate)"
            label="終了予定日"
            input-readonly
            :date-picker-flg="canEdit"
            :readonly="!canEdit"
            date-mode="date"
            required
            :error="errors.EndDate"
          />
        </div>
        <TextFieldComponent
          :ref="el => fields.register('Progress',el,taskForm.Progress)"
          label="進捗率(%)"
          type="number"
          min="0"
          max="100"
          step="1"
          :maxlength="3"
          :readonly="!canProgress"
          :error="errors.Progress"
        />
        <div
          v-if="!canEdit"
          class="WbsPermissionNote"
        >
          <i
            class="fas fa-info-circle"
            aria-hidden="true"
          />
          {{ messageFormat('INFO','I_0089') }}
        </div>
      </section>
      <template #actions>
        <ButtonComponent
          type="button"
          variant="CloseButton"
          @click="taskOpen = false"
        >閉じる</ButtonComponent>
        <ButtonComponent
          v-if="canEdit && editingTask"
          type="button"
          variant="DeleteButton"
          @click="removeTask"
        >削除</ButtonComponent>
        <ButtonComponent
          v-if="canProgress"
          type="button"
          variant="SaveButton"
          @click="saveTask"
        >保存</ButtonComponent>
      </template>
    </BaseDialog>
  </div>
</template>
