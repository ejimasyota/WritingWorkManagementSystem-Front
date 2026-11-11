<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import type { BackendRequest } from '../../types/backend';
import type { WorkInfo } from '../../types/work';
import type { WorkSettingRow } from '../../types/workSettings';
import type { PageDialogs } from '../../composables/usePageDialogs';
import type { TableColumn } from '../../composables/tableData';
import { useOperationSpinner } from '../../composables/useOperationSpinner';
import { readWorkAccess } from '../../utils/workAccess';
import { requireSuccess, reportBackendError } from '../../utils/backend';
import { messageFormat } from '../../utils/messages';
const props = defineProps<{
  request: BackendRequest;
  dialogs: PageDialogs;
  isAdmin: boolean;
  hideMeta?: boolean;
}>();
const auth = useAuthSession();
const spinner = useOperationSpinner();
const role = ref('');
const work = ref<WorkInfo>();
const rows = ref<WorkSettingRow[]>([]);
const canManage = ref(false);
const originalCreatorId = ref('');
const busy = ref(false);
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
});
const columns = computed<TableColumn[]>(() => [{
  key: 'UserId',
  label: 'ユーザーID',
  sortable: true,
  filterable: true
}, {
  key: 'IsCreator',
  label: '利用者区分',
  sortable: true,
  filterable: true,
  format: value => value ? '作成者' : 'アシスタント'
}, {
  key: 'RegistDate',
  label: '参加日',
  sortable: true,
  filterable: true,
  type: 'date'
}, ...(canManage.value ? [{
  key: 'Access',
  label: 'アクセス権限',
  width: 160
}, {
  key: 'Role',
  label: '権限付与',
  width: 150
}] : [])]);

function canChange(row: WorkSettingRow) {
  return canManage.value && String(row.UserId) !== originalCreatorId.value && !(props.isAdmin && String(row.UserId) === auth.user.value?.UserId);
}

async function read() {
  const access = await readWorkAccess(props.request, work.value?.WorkId);
  const data = requireSuccess(await props.request<{
    ParticipantList: WorkSettingRow[];
    CanManageRole: boolean;
    OriginalCreatorId: unknown;
  }>('/GetParticipantList.php'), messageFormat('ERROR', 'E_0003', '参加者一覧の取得'));
  if (!Array.isArray(data?.ParticipantList) || typeof data.CanManageRole !== 'boolean') throw new Error(messageFormat('ERROR', 'E_0026'));
  if (disposed) return;
  work.value = access.work;
  role.value = props.isAdmin ? '管理者' : access.isCreator ? '作成者' : 'アシスタント';
  rows.value = data.ParticipantList;
  canManage.value = data.CanManageRole;
  originalCreatorId.value = String(data.OriginalCreatorId || '');
}

async function load() {
  if (busy.value) return;
  busy.value = true;
  try {
    await spinner.run(read);
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '参加者一覧の取得'));
  } finally {
    busy.value = false;
  }
}
/** 取得時の更新日時で権限を変更する。原作成者と管理者本人は操作対象にしない。 */


async function change(row: WorkSettingRow, kind: 'access' | 'role') {
  if (!canChange(row) || busy.value || kind === 'role' && row.UserLockFlg) return;
  const operation = kind === 'access' ? row.UserLockFlg ? 'アクセス許可' : 'アクセス禁止' : row.IsCreator ? '権限剥奪' : '権限付与';
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0021', operation)))) return;
  busy.value = true;
  let completed = false;
  try {
    await spinner.run(async () => {
      await readWorkAccess(props.request, work.value?.WorkId);
      if (disposed) return;
      requireSuccess(await props.request(kind === 'access' ? '/UpdateParticipant.php' : '/UpdateCreatorRole.php', 'POST', {
        TargetUserId: row.UserId,
        WorkId: work.value?.WorkId,
        UpdateDate: row.UpdateDate
      }), messageFormat('ERROR', 'E_0003', operation));
      completed = true;
      await read();
    });
    if (completed && !disposed) await props.dialogs.info(messageFormat('INFO', 'I_0011', '更新'), messageFormat('INFO', 'I_0001', operation));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', operation));
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <div>
    <WorkContentHeader
      title="参加者一覧"
      icon="fa-user-friends"
      :work-title="work?.WorkTitle"
      :role="work ? role : undefined"
    />
    <TableComponent
      :rows="rows"
      :columns="columns"
      row-key="Id"
      :loading="busy"
    >
      <template #cell-Access="{row}">
        <ButtonComponent
          v-if="canChange(row as WorkSettingRow)"
          type="button"
          :variant="(row.UserLockFlg ? 'SuccessButton' : 'DangerButton') + ' ButtonSmall'"
          @click="change(row as WorkSettingRow,'access')"
        >
          <i
            :class="row.UserLockFlg ? 'fas fa-lock' : 'fas fa-unlock'"
            aria-hidden="true"
          />
          {{ row.UserLockFlg ? 'アクセス許可' : 'アクセス禁止' }}
        </ButtonComponent>
        <span v-else>{{ messageFormat('INFO','I_0074') }}</span>
      </template>
      <template #cell-Role="{row}">
        <ButtonComponent
          v-if="canChange(row as WorkSettingRow) && !row.UserLockFlg"
          type="button"
          :variant="(row.IsCreator ? 'DangerButton' : 'SuccessButton') + ' ButtonSmall'"
          @click="change(row as WorkSettingRow,'role')"
        >
          <i
            :class="row.IsCreator ? 'fas fa-user-minus' : 'fas fa-user-plus'"
            aria-hidden="true"
          />
          {{ row.IsCreator ? '権限剥奪' : '権限付与' }}
        </ButtonComponent>
        <span v-else>{{ messageFormat('INFO','I_0074') }}</span>
      </template>
    </TableComponent>
  </div>
</template>
