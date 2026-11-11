<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import type { BackendRequest } from '../../types/backend';
import type { WorkSettingRow } from '../../types/workSettings';
import type { WorkInfo } from '../../types/work';
import type { PageDialogs } from '../../composables/usePageDialogs';
import type { TableColumn } from '../../composables/tableData';
import { useOperationSpinner } from '../../composables/useOperationSpinner';
import { readWorkAccess } from '../../utils/workAccess';
import { requireSuccess, reportBackendError } from '../../utils/backend';
import { messageFormat } from '../../utils/messages';
import { parseHistoryDetail } from '../../utils/history';
const props = defineProps<{
  request: BackendRequest;
  dialogs: PageDialogs;
  isAdmin: boolean;
  hideMeta?: boolean;
}>();
const spinner = useOperationSpinner();
const role = ref('');
const work = ref<WorkInfo>();
const canEdit = ref(false);
const busy = ref(false);
const rows = ref<WorkSettingRow[]>([]);
const opened = ref(false);
const selected = ref<WorkSettingRow>();
const detail = computed(() => parseHistoryDetail(selected.value?.Detail));
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
});
const columns: TableColumn[] = [{
  key: 'RegistDate',
  label: '更新日時',
  sortable: true,
  filterable: true,
  type: 'date'
}, {
  key: 'FunctionName',
  label: '機能名',
  sortable: true,
  filterable: true
}, {
  key: 'Operation',
  label: '操作',
  sortable: true,
  filterable: true
}, {
  key: 'Detail',
  label: '詳細',
  sortable: true,
  filterable: true,
  format: value => parseHistoryDetail(value).Summary
}, {
  key: 'RegistUser',
  label: '更新者',
  sortable: true,
  filterable: true
}];

async function read() {
  const access = await readWorkAccess(props.request, work.value?.WorkId);
  const data = requireSuccess(await props.request<{
    HistoryList: WorkSettingRow[];
  }>('/GetUpdateHistoryList.php'), messageFormat('ERROR', 'E_0003', '更新履歴の取得'));
  if (!Array.isArray(data?.HistoryList)) throw new Error(messageFormat('ERROR', 'E_0026'));
  if (disposed) return;
  work.value = access.work;
  role.value = props.isAdmin ? '管理者' : access.isCreator ? '作成者' : 'アシスタント';
  canEdit.value = props.isAdmin || access.isCreator;
  rows.value = data.HistoryList;
}

async function load() {
  if (busy.value) return;
  busy.value = true;
  try {
    await spinner.run(read);
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '更新履歴の取得'));
  } finally {
    busy.value = false;
  }
}

function open(row: WorkSettingRow) {
  selected.value = {
    ...row
  };
  opened.value = true;
}

async function removeAll() {
  if (!canEdit.value || busy.value || !(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0022')))) return;
  busy.value = true;
  let completed = false;
  try {
    await spinner.run(async () => {
      const access = await readWorkAccess(props.request, work.value?.WorkId);
      if (disposed || !(props.isAdmin || access.isCreator)) return;
      requireSuccess(await props.request('/DeleteUpdateHistory.php', 'POST', {}), messageFormat('ERROR', 'E_0003', '更新履歴の削除'));
      completed = true;
      await read();
    });
    if (completed && !disposed) await props.dialogs.info(messageFormat('INFO', 'I_0011', '削除'), messageFormat('INFO', 'I_0001', '更新履歴の削除'));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '更新履歴の削除'));
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <div>
    <WorkContentHeader
      title="更新履歴"
      icon="fa-history"
      :work-title="work?.WorkTitle"
      :role="work ? role : undefined"
    />
    <div
      v-if="canEdit"
      class="ButtonGroup"
    >
      <ButtonComponent
        type="button"
        variant="DeleteButton"
        @click="removeAll"
      >
        <i
          class="fas fa-trash"
          aria-hidden="true"
        />
        全削除
      </ButtonComponent>
    </div>
    <TableComponent
      :rows="rows"
      :columns="columns"
      row-key="HistoryId"
      :loading="busy"
    >
      <template #cell-Detail="{row}">
        <ButtonComponent
          v-if="row.Detail"
          type="button"
          unstyled
          class="HistoryDetailCell"
          :title="parseHistoryDetail(row.Detail).Summary.slice(0,500)"
          @click="open(row as WorkSettingRow)"
        >{{ parseHistoryDetail(row.Detail).Summary.replace(/\s+/g,' ').slice(0,200) }}</ButtonComponent>
      </template>
    </TableComponent>
    <BaseDialog
      v-model="opened"
      :title="String(selected?.FunctionName || '') + '　' + String(selected?.Operation || '')"
      size="DialogMedium"
    >
      <div class="HistoryDiffBody">
        <template v-if="detail.Type === 'update'">
          <div class="HistoryDiffHead">
            {{ detail.Name }}
            のデータを更新
          </div>
          <div
            v-if="!detail.Changes.length"
            class="HistoryDiffEmpty"
          >{{ messageFormat('INFO','I_0075') }}</div>
          <div
            v-for="(change,index) in detail.Changes"
            :key="index"
            class="HistoryDiffField"
          >
            <div class="HistoryDiffLabel">{{ change.Label }}</div>
            <div class="HistoryDiffRow HistoryDiffOld">
              <span class="HistoryDiffMark">−</span>
              <span class="HistoryDiffVal">{{ change.Old }}</span>
            </div>
            <div class="HistoryDiffRow HistoryDiffNew">
              <span class="HistoryDiffMark">＋</span>
              <span class="HistoryDiffVal">{{ change.New }}</span>
            </div>
          </div>
        </template>
        <div
          v-else-if="detail.Type === 'register' || detail.Type === 'delete'"
          class="HistoryDiffRow"
          :class="detail.Type === 'register' ? 'HistoryDiffNew' : 'HistoryDiffOld'"
        >
          <span class="HistoryDiffMark">{{ detail.Type === 'register' ? '＋' : '−' }}</span>
          <span class="HistoryDiffVal">{{ detail.Summary }}</span>
        </div>
        <div
          v-else
          class="HistoryDiffPlain"
        >{{ detail.Raw || messageFormat('INFO','I_0076') }}</div>
      </div>
      <template #actions>
        <ButtonComponent
          type="button"
          variant="CloseButton"
          @click="opened = false"
        >OK</ButtonComponent>
      </template>
    </BaseDialog>
  </div>
</template>
