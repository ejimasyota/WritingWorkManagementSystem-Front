<script setup lang="ts">
import { useOperationSpinner } from '../../composables/useOperationSpinner';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import type { BackendRequest } from '../../types/backend';
import type { WorkInfo } from '../../types/work';
import type { WorkSettingRow } from '../../types/workSettings';
import type { CharacterMasters, CharacterRow } from '../../types/character';
import type { PageDialogs } from '../../composables/usePageDialogs';
import { metadataColumns, type TableColumn } from '../../composables/tableData';
import { useInputFields } from '../../composables/useInputFields';
import { readWorkAccess } from '../../utils/workAccess';
import { requireSuccess, reportBackendError } from '../../utils/backend';
import { parseFlexibleDate, calculateAge, compareFlexibleDates } from '../../utils/dates';
import { messageFormat } from '../../utils/messages';
import TimelineChart from '../TimelineChart.vue';
import { parseTimelineDateValue } from '../../utils/timelineChart';
import { formatSettingDate } from '../../utils/dates';
import type { TimelineEntry } from '../../types/timeline';
import CharacterDialog from './character/CharacterDialog.vue';
const spinner = useOperationSpinner();
const props = defineProps<{
  request: BackendRequest;
  dialogs: PageDialogs;
  isAdmin: boolean;
  hideMeta?: boolean;
}>();
const emit = defineEmits<{
  navigate: [menu: string];
}>();
const fields = useInputFields();
const work = ref<WorkInfo>();
const isCreator = ref(false);
const initialized = ref(false);
const loading = ref(false);
const saving = ref(false);
const rows = ref<WorkSettingRow[]>([]);
const characters = ref<CharacterRow[]>([]);
const selected = ref<WorkSettingRow | null>(null);
const selectedCharacterId = ref('');
const form = reactive({
  CharaId: '',
  EventDate: '',
  Age: '',
  Content: ''
});
const errors = ref<Record<string, string>>({});
const formRevision = ref(0);
const opened = ref(false);
const dialogTitle = computed(() => {
  let mode = '新規登録';
  if (selected.value) mode = canEdit.value ? '編集' : '詳細';
  return '経歴一覧（' + mode + '）';
});
const chartVisible = ref(false);
const chartNames = ref<string[]>([]);
const chartFilterOpen = ref(false);
const chartFilterAnchor = ref<HTMLElement | null>(null);
const filteredRows = ref<WorkSettingRow[]>([]);
const detailOpen = ref(false);
const detailLoading = ref(false);
const detailRow = ref<CharacterRow>();
const detailMasters = ref<CharacterMasters>({});
const canEdit = computed(() => initialized.value && !!work.value && (props.isAdmin || isCreator.value));
const role = computed(() => props.isAdmin ? '管理者' : isCreator.value ? '作成者' : 'アシスタント');
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
});

/** 新規入力では生年月日のあるキャラを候補にし、保存済み行のキャラは閲覧用にも残す。 */
const characterOptions = computed(() => [{
  value: '',
  label: ''
}, ...characters.value.filter(row => String(row.BirthDate || '').trim() || String(row.CharaId) === selectedCharacterId.value).map(row => ({
  value: String(row.CharaId),
  label: String(row.CharaName)
}))]);
const columns: TableColumn[] = [{
  key: 'Detail',
  label: '詳細',
  width: 90
}, {
  key: 'CharaName',
  label: 'キャラ名',
  sortable: true,
  filterable: true
}, {
  key: 'EventDate',
  label: '年月日',
  sortable: true
}, {
  key: 'Age',
  label: '年齢',
  sortable: true,
  type: 'number'
}, {
  key: 'Content',
  label: '内容',
  sortable: true
}, ...metadataColumns()];

/** 一覧で絞り込まれた行へ、年表側のキャラ名フィルタを重ねる。 */
const chartNameOptions = computed(() => [...new Set(filteredRows.value.map(row => String(row.CharaName || '')))].sort((left, right) => left.localeCompare(right, 'ja')));
const timeline = computed(() => {
  const target = filteredRows.value.filter(row => !chartNames.value.length || chartNames.value.includes(String(row.CharaName || '')));
  const entries: TimelineEntry[] = target.flatMap(row => {
    const date = parseTimelineDateValue(row.EventDate);
    if (!date) return [];
    const name = String(row.CharaName || '不明');
    const content = String(row.Content || '');
    const age = row.Age || row.Age === 0 ? '（' + Number(row.Age) + '歳）' : '';
    const dateText = formatSettingDate(String(row.EventDate || ''));
    return [{
      Key: String(row.BiographyId),
      DateText: dateText + age,
      LabelText: content ? name + '：' + content : name,
      TooltipText: name + age + '\n' + dateText + '\n' + content,
      StartValue: date.Value,
      EndValue: date.Value,
      HasPeriod: false
    }];
  });
  return {
    entries,
    skipped: target.length - entries.length,
    emptyMessage: target.length ? messageFormat('INFO', 'I_0069') : messageFormat('INFO', 'I_0068')
  };
});

function toggleChart() {
  chartVisible.value = !chartVisible.value;
  if (!chartVisible.value) {
    chartNames.value = [];
    chartFilterOpen.value = false;
  }
}

function openChartFilter(event: MouseEvent) {
  chartFilterAnchor.value = event.currentTarget as HTMLElement;
  chartFilterOpen.value = true;
}

function toggleChartName(name: string) {
  const checked = fields.getValue('ChartName:' + name, false);
  chartNames.value = checked ? [...new Set([...chartNames.value, name])] : chartNames.value.filter(item => item !== name);
}

function clearChartFilter() {
  chartNames.value = [];
  for (const name of chartNameOptions.value) fields.setValue('ChartName:' + name, false);
}

function selectTimelineRow(key: string) {
  const row = rows.value.find(item => String(item.BiographyId) === key);
  if (row) selectRow(row);
}

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
      const biography = requireSuccess(await props.request<WorkSettingRow[]>('/GetBiographyList.php'), messageFormat('ERROR', 'E_0003', '経歴一覧の取得'));
      if (disposed) return;
      const character = requireSuccess(await props.request<CharacterRow[]>('/GetCharacterList.php'), messageFormat('ERROR', 'E_0003', 'キャラ一覧の取得'));
      if (!Array.isArray(biography) || !Array.isArray(character)) throw new Error(messageFormat('ERROR', 'E_0026'));
      if (disposed) return;
      rows.value = biography;
      characters.value = character;
      initialized.value = true;
      return true;
    });
    if (!finished) return;
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '経歴一覧の取得'));
  } finally {
    if (!disposed) loading.value = false;
  }
}

/** 公開APIから選択値を読み、年齢欄へ算出結果をセットする。0歳も有効な入力値とする。 */


function updateAge() {
  selectedCharacterId.value = String(fields.getValue('CharaId', ''));
  const character = characters.value.find(row => String(row.CharaId) === selectedCharacterId.value);
  const date = parseFlexibleDate(fields.getValue('EventDate', ''));
  const birth = parseFlexibleDate(String(character?.BirthDate || ''));
  const age = date && birth ? calculateAge(date, birth) : -1;
  fields.setValue('Age', age >= 0 ? String(age) : '');
}

function selectRow(row: WorkSettingRow) {
  if (saving.value) return;
  selected.value = {
    ...row
  };
  Object.assign(form, {
    CharaId: String(row.CharaId ?? ''),
    EventDate: String(row.EventDate ?? ''),
    Age: String(row.Age ?? ''),
    Content: String(row.Content ?? '')
  });
  selectedCharacterId.value = form.CharaId;
  fields.setValues(form);
  errors.value = {};
  opened.value = true;
}

function clear() {
  if (!canEdit.value || saving.value) return;
  selected.value = null;
  selectedCharacterId.value = '';
  Object.assign(form, {
    CharaId: '',
    EventDate: '',
    Age: '',
    Content: ''
  });
  fields.setValues(form);
  errors.value = {};
  formRevision.value++;
}

async function save() {
  if (!canEdit.value || saving.value || loading.value) return;
  const values = fields.getValues(form);
  errors.value = {};
  const character = characters.value.find(row => String(row.CharaId) === String(values.CharaId));
  if (!character || !String(character.BirthDate || '').trim()) errors.value.CharaId = messageFormat('ERROR', 'E_0054', '生年月日が登録されたキャラクター');
  if (!values.EventDate) errors.value.EventDate = messageFormat('ERROR', 'E_0001', '年月日');
  if (!values.Content.trim()) errors.value.Content = messageFormat('ERROR', 'E_0001', '内容');
  if (character && compareFlexibleDates(values.EventDate, String(character.BirthDate || '')) === -1) errors.value.EventDate = messageFormat('ERROR', 'E_0053');
  if (values.Age === '') errors.value.Age = messageFormat('ERROR', 'E_0055');
  const first = Object.keys(errors.value)[0];
  if (first) {
    await nextTick();
    fields.focus(first);
    return;
  }
  const payload = {
    ...values,
    BiographyId: selected.value?.BiographyId ?? null,
    UpdateDate: selected.value?.UpdateDate ?? null
  };
  saving.value = true;
  let completed = false;
  try {
    const finished = await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed) return;
      requireSuccess(await props.request('/SaveBiography.php', 'POST', payload), messageFormat('ERROR', 'E_0003', '経歴の保存'));
      if (disposed) return;
      completed = true;
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(messageFormat('INFO', 'I_0011', '保存'), messageFormat('INFO', 'I_0001', '経歴の保存'));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '経歴の保存'));
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
    if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'この経歴を削除'))) || disposed) return;
    const finished = await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed) return;
      requireSuccess(await props.request('/DeleteBiography.php', 'POST', {
        BiographyId: row.BiographyId,
        UpdateDate: row.UpdateDate
      }), messageFormat('ERROR', 'E_0003', '経歴の削除'));
      if (disposed) return;
      completed = true;
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(messageFormat('INFO', 'I_0011', '削除'), messageFormat('INFO', 'I_0001', '経歴の削除'));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '経歴の削除'));
  } finally {
    if (!disposed) saving.value = false;
  }
  if (completed && !disposed) {
    clear();
    await load();
  }
}

/** キャラ詳細は閲覧専用のダイアログで開き、経歴フォームの入力を維持する。 */


async function showCharacter() {
  const row = characters.value.find(item => String(item.CharaId) === selectedCharacterId.value);
  if (!row || detailLoading.value) return;
  detailLoading.value = true;
  try {
    const keys = ['Organization', 'Team', 'Race', 'Class', 'Power', 'Weapon', 'Move', 'Tag', 'Stage'];
    const finished = await spinner.run(async () => {
      const results = await Promise.all(keys.map(async key => {
        const data = requireSuccess(await props.request<Record<string, Record<string, unknown>[]>>(`/Get${key}List.php`), messageFormat('ERROR', 'E_0003', 'キャラ詳細の取得'));
        if (!Array.isArray(data?.[key + 'List'])) throw new Error(messageFormat('ERROR', 'E_0026'));
        return [key, data[key + 'List']] as const;
      }));
      if (disposed) return;
      detailMasters.value = Object.fromEntries(results);
      detailRow.value = row;
      detailOpen.value = true;
      return true;
    });
    if (!finished) return;
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'キャラ詳細の取得'));
  } finally {
    if (!disposed) detailLoading.value = false;
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
      title="経歴一覧"
      icon="fa-stream"
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
    <div class="ButtonGroup">
      <ButtonComponent
        type="button"
        variant="SecondaryButton"
        :aria-pressed="chartVisible"
        @click="toggleChart"
      >
        <i
          class="fas"
          :class="chartVisible ? 'fa-table' : 'fa-stream'"
          aria-hidden="true"
        />
        {{ chartVisible ? '一覧表示' : '年表カード表示' }}
      </ButtonComponent>
      <ButtonComponent
        type="button"
        variant="PrimaryButton"
        @click="emit('navigate', 'MenuCharacter')"
      >
        <i
          class="fas fa-user"
          aria-hidden="true"
        />
        キャラ設定画面へ
      </ButtonComponent>
    </div>
    <TableComponent
      v-show="!chartVisible"
      :rows="rows"
      :columns="columns"
      row-key="BiographyId"
      @result-change="filteredRows = $event"
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
    <TimelineChart
      v-if="chartVisible"
      :entries="timeline.entries"
      @select="selectTimelineRow"
    >
      <template #controls>
        <div class="ChartFloatingControls">
          <ButtonComponent
            type="button"
            variant="SecondaryButton ButtonSmall"
            :class="{ FilterActive: chartNames.length > 0 }"
            @click="openChartFilter"
          >
            <i
              class="fas fa-filter"
              aria-hidden="true"
            />
            キャラ名
            {{ chartNames.length ? '（' + chartNames.length + '）' : '' }}
          </ButtonComponent>
        </div>
      </template>
      <template #empty>{{ timeline.emptyMessage }}</template>
      <template #note>
        <div
          v-if="timeline.skipped"
          class="TimelineChartNote"
        >
          <i
            class="fas fa-triangle-exclamation"
            aria-hidden="true"
          />
          {{ messageFormat('INFO', 'I_0066', timeline.skipped) }}
        </div>
      </template>
    </TimelineChart>
    <AnchoredDropdown
      v-model="chartFilterOpen"
      :anchor="chartFilterAnchor"
    >
      <ButtonComponent
        v-if="chartNames.length"
        unstyled
        type="button"
        class="FilterDropdownClear"
        @click="clearChartFilter"
      >
        <i
          class="fas fa-times"
          aria-hidden="true"
        />
        クリア
      </ButtonComponent>
      <CheckBoxComponent
        v-for="name in chartNameOptions"
        :key="name"
        :ref="el => fields.register('ChartName:' + name, el, chartNames.includes(name))"
        inline
        wrapper-class="FilterDropdownOption"
        @change="toggleChartName(name)"
      >
        <span :title="name || '(未設定)'">{{ name || '(未設定)' }}</span>
      </CheckBoxComponent>
    </AnchoredDropdown>
    <CharacterDialog
      v-if="detailOpen"
      v-model="detailOpen"
      :row="detailRow"
      :masters="detailMasters"
      :setting-date="work?.SettingDate || ''"
      :can-edit="false"
      :saving="false"
      :dialogs="dialogs"
    />
    <BaseDialog
      v-model="opened"
      :title="dialogTitle"
      size="DialogLarge"
    >
      <section
        :key="formRevision"
        class="FormSection"
        aria-label="経歴入力"
      >
        <h3 class="FormSectionTitle">基本</h3>
        <div class="FormGrid">
          <SelectBoxComponent
            :ref="el => fields.register('CharaId', el, form.CharaId)"
            label="キャラクター"
            required
            :options="characterOptions"
            :disabled="!canEdit"
            :error="errors.CharaId"
            info-icon-flg
            info-title="キャラクター"
            :info-message="messageFormat('INFO', 'I_0064')"
            @value-change="updateAge"
          />
          <TextFieldComponent
            :ref="el => fields.register('EventDate', el, form.EventDate)"
            label="年月日"
            required
            input-readonly
            :date-picker-flg="canEdit"
            :readonly="!canEdit"
            :error="errors.EventDate"
            @value-change="updateAge"
          />
          <TextFieldComponent
            :ref="el => fields.register('Age', el, form.Age)"
            label="年齢"
            readonly
            :error="errors.Age"
            info-icon-flg
            info-title="年齢"
            :info-message="messageFormat('INFO', 'I_0063')"
          />
          <TextFieldComponent
            :ref="el => fields.register('Content', el, form.Content)"
            label="内容"
            required
            text-area-flg
            :readonly="!canEdit"
            :error="errors.Content"
          />
        </div>
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
        <ButtonComponent
          type="button"
          variant="SecondaryButton"
          :disabled="!selectedCharacterId || detailLoading"
          @click="showCharacter"
        >
          <i
            class="fas fa-info-circle"
            aria-hidden="true"
          />
          キャラ詳細
        </ButtonComponent>
      </template>
    </BaseDialog>
  </div>
</template>

