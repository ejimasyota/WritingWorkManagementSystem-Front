<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { BackendRequest, SessionInfo } from '../../types/backend';
import type { PageDialogs } from '../../composables/usePageDialogs';
import type { TableRow } from '../../composables/tableData';
import { mainColumns, mainMenus, type MainMenuId } from '../../utils/mainMenus';
import { genreLabel, normalizeMainList, unformatDate } from '../../utils/mainView';
import { reportBackendError, requireSuccess } from '../../utils/backend';
const props = defineProps<{
  menuId: MainMenuId;
  session: SessionInfo;
  request: BackendRequest;
  dialogs: PageDialogs;
  hideMeta: boolean;
}>();
const emit = defineEmits(['move', 'changed']);
const rows = ref<TableRow[]>([]);
const selected = ref<TableRow | null>(null);
const form = reactive({
  title: '',
  message: '',
  expire: '',
  eraName: '',
  startYear: '',
  endYear: ''
});
const errors = ref<Record<string, string>>({});
const templateOpen = ref(false);
const editingTemplate = ref<TableRow | null>(null);
const table = ref<{
  reset: () => void;
}>();
const menu = computed(() => mainMenus[props.menuId]);
const columns = computed(() => mainColumns(props.menuId));
const notificationForm = computed(() => props.menuId === 'MenuSystemNotificationAdmin');
const eraForm = computed(() => props.menuId === 'MenuEraMaster');
async function load() {
  try {
    const data = requireSuccess(await props.request<unknown>(menu.value.api), `${menu.value.title}の取得に失敗しました`);
    rows.value = normalizeMainList(props.menuId, data).map(row => props.menuId === 'MenuTemplateMaster' ? {
      ...row,
      DivisionLabel: Number(row.DivisionType) === 2 ? 'プロット' : 'ストーリー',
      GenreLabel: genreLabel(row.Genre)
    } : row);
    table.value?.reset();
  } catch (error) {
    await reportBackendError(props.dialogs, error, `${menu.value.title}の取得中にエラーが発生しました`);
  }
}
function clear() {
  selected.value = null;
  Object.assign(form, {
    title: '',
    message: '',
    expire: '',
    eraName: '',
    startYear: '',
    endYear: ''
  });
  errors.value = {};
}
async function selectRow(row: TableRow) {
  if (props.menuId === 'MenuSystemNotificationList') {
    await props.dialogs.info(String(row.Title || ''), String(row.Message || ''), 'left');
    return;
  }
  if (!notificationForm.value && !eraForm.value) return;
  selected.value = row;
  errors.value = {};
  Object.assign(form, {
    title: String(row.Title || ''),
    message: String(row.Message || ''),
    expire: row.ExpireDate ? String(row.ExpireDate).slice(0, 10).replace(/-/g, '/') : '',
    eraName: String(row.EraName || ''),
    startYear: String(row.StartYear || ''),
    endYear: String(row.EndYear || '')
  });
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}
async function toggleLock(row: TableRow) {
  const member = props.menuId === 'MenuMemberList';
  const locked = member ? row.AccountLockFlg : row.LockFlg;
  const action = locked ? '復旧' : 'ロック';
  if (!(await props.dialogs.confirm(`この${member ? 'アカウント' : '作品'}を${action}しますか？`))) return;
  try {
    const payload = member ? {
      UserId: row.UserId,
      AccountLockFlg: !locked,
      AdminUserId: props.session.UserId,
      UpdateDate: row.UpdateDate || null
    } : {
      WorkId: row.WorkId,
      LockFlg: !locked,
      UserId: props.session.UserId,
      UpdateDate: row.UpdateDate || null
    };
    requireSuccess(await props.request(member ? '/UpdateAccountLock.php' : '/UpdateProjectLock.php', 'POST', payload), '更新に失敗しました');
    await props.dialogs.info('更新完了', `${member ? 'アカウント' : '作品'}を${action}しました`);
    await load();
  } catch (error) {
    await reportBackendError(props.dialogs, error, '更新中にエラーが発生しました');
  }
}
function validateForm() {
  errors.value = {};
  if (notificationForm.value) {
    if (!form.title.trim()) errors.value.title = 'タイトルを入力してください';
    if (!form.message.trim()) errors.value.message = '本文を入力してください';
    if (form.expire) {
      const expiry = new Date(`${unformatDate(form.expire)}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (Number.isNaN(expiry.getTime()) || expiry <= today) errors.value.expire = '有効期限は明日以降の日付を指定してください';
    }
  } else {
    if (!form.eraName.trim()) errors.value.eraName = '元号名を入力してください';
    if (!form.startYear.trim()) errors.value.startYear = '開始年を入力してください';
  }
  return Object.keys(errors.value).length === 0;
}
async function notifyEra(eraName: string, operation: string) {
  if (!(await props.dialogs.confirm('変更を通知しますか？'))) return;
  const text = `${eraName}を${operation}しました。`;
  requireSuccess(await props.request('/PostSystemNotification.php', 'POST', {
    Title: text,
    Message: text,
    ExpireDate: null
  }), '通知の登録に失敗しました');
  await props.dialogs.info('通知完了', 'システム通知に登録しました');
}
async function save() {
  if (!validateForm()) return;
  const editing = !!selected.value;
  const eraName = form.eraName.trim();
  try {
    if (notificationForm.value) {
      const payload: Record<string, unknown> = {
        Title: form.title.trim(),
        Message: form.message.trim(),
        ExpireDate: form.expire || null
      };
      if (editing) Object.assign(payload, {
        NotificationId: selected.value!.NotificationId,
        UpdateDate: selected.value!.UpdateDate
      });
      requireSuccess(await props.request(editing ? '/UpdateSystemNotification.php' : '/PostSystemNotification.php', 'POST', payload), '保存に失敗しました');
      await props.dialogs.info('保存完了', editing ? 'システム通知を更新しました' : 'システム通知を投稿しました');
    } else {
      requireSuccess(await props.request('/SaveEraMaster.php', 'POST', {
        EraMasterId: selected.value?.EraMasterId || null,
        EraName: eraName,
        StartYear: form.startYear.trim() || null,
        EndYear: form.endYear.trim() || null,
        UpdateDate: selected.value?.UpdateDate || null
      }), '保存に失敗しました');
    }
    clear();
    await load();
    if (eraForm.value) await notifyEra(eraName, editing ? '更新' : '登録');
    emit('changed');
  } catch (error) {
    await reportBackendError(props.dialogs, error, '保存中にエラーが発生しました');
  }
}
async function remove() {
  const row = selected.value;
  if (!row) return;
  if (!(await props.dialogs.confirm(eraForm.value ? 'この元号マスタを削除しますか？' : 'このシステム通知を削除しますか？'))) return;
  const eraName = form.eraName;
  try {
    const payload = eraForm.value ? {
      EraMasterId: row.EraMasterId,
      UpdateDate: row.UpdateDate
    } : {
      NotificationId: row.NotificationId,
      UpdateDate: row.UpdateDate
    };
    requireSuccess(await props.request(eraForm.value ? '/DeleteEraMaster.php' : '/DeleteSystemNotification.php', 'POST', payload), '削除に失敗しました');
    clear();
    await load();
    if (eraForm.value) await notifyEra(eraName, '削除');else await props.dialogs.info('削除完了', 'システム通知を削除しました');
    emit('changed');
  } catch (error) {
    await reportBackendError(props.dialogs, error, '削除中にエラーが発生しました');
  }
}
function openTemplate(row: TableRow | null = null) {
  editingTemplate.value = row;
  templateOpen.value = true;
}
onMounted(load);
</script>

<template>
  <div>
    <div class="ContentHeader">
      <h2 class="ContentTitle">
        <i class="fas" :class="menu.icon" />
        {{ menu.title }}
      </h2>
    </div>
    <template v-if="notificationForm">
      <div class="FormRow">
        <TextFieldComponent
          v-model="form.title"
          input-id="SysNotiTitle"
          label="タイトル"
          maxlength="200"
          :error="errors.title"
          required
        />
        <TextFieldComponent
          v-model="form.expire"
          input-id="SysNotiExpire"
          label="有効期限"
          input-readonly
          date-picker-flg
          date-mode="date"
          info-icon-flg
          info-title="有効期限"
          info-message="未指定なら無期限"
          :error="errors.expire"
        />
      </div>
      <TextFieldComponent
        v-model="form.message"
        input-id="SysNotiMessage"
        label="本文"
        text-area-flg
        :error="errors.message"
        required
      />
    </template>
    <div v-if="eraForm" class="FormRow">
      <TextFieldComponent
        v-model="form.eraName"
        input-id="EraMasterName"
        label="元号名"
        maxlength="100"
        :error="errors.eraName"
        required
      />
      <TextFieldComponent
        v-model="form.startYear"
        input-id="EraMasterStartYear"
        label="開始年"
        input-readonly
        maxlength="20"
        date-picker-flg
        :error="errors.startYear"
        required
      />
      <TextFieldComponent
        v-model="form.endYear"
        input-id="EraMasterEndYear"
        label="終了年"
        input-readonly
        maxlength="20"
        date-picker-flg
      />
    </div>
    <div v-if="notificationForm || eraForm" class="ButtonGroup">
      <ButtonComponent type="button" variant="ClearButton" @click="clear">
        <i class="fas fa-sync" />
        クリア
      </ButtonComponent>
      <ButtonComponent type="button" variant="SaveButton" @click="save">
        <i class="fas fa-save" />
        保存
      </ButtonComponent>
      <ButtonComponent v-if="selected" type="button" variant="DeleteButton" @click="remove">
        <i class="fas fa-trash" />
        削除
      </ButtonComponent>
    </div>
    <div v-if="menuId === 'MenuTemplateMaster'" class="MarginBottom20">
      <ButtonComponent type="button" variant="SuccessButton" @click="openTemplate()">
        <i class="fas fa-plus" />
        追加
      </ButtonComponent>
    </div>
    <TableComponent
      ref="table"
      :rows="rows"
      :columns="columns"
      :row-key="menu.key"
      :hide-meta="hideMeta"
      :row-clickable="notificationForm || eraForm || menuId === 'MenuSystemNotificationList'"
      @row-click="selectRow"
    >
      <template #cell-Action="{ row }">
        <ButtonComponent
          v-if="menuId === 'MenuProjectManagement'"
          type="button"
          variant="ButtonSmall PrimaryButton ProjectMoveButton"
          @click.stop="emit('move', row.WorkId)"
        >
          <i class="fas fa-arrow-right" />
          移動
        </ButtonComponent>
        <ButtonComponent
          type="button"
          variant="ButtonSmall ProjectMoveButton"
          :class="(menuId === 'MenuMemberList' ? row.AccountLockFlg : row.LockFlg) ? 'SuccessButton' : 'DangerButton'"
          @click.stop="toggleLock(row)"
        >
          <i
            class="fas"
            :class="(menuId === 'MenuMemberList' ? row.AccountLockFlg : row.LockFlg) ? 'fa-unlock' : 'fa-lock'"
          />
          {{ (menuId === 'MenuMemberList' ? row.AccountLockFlg : row.LockFlg) ? '復旧' : 'ロック' }}
        </ButtonComponent>
      </template>
      <template #cell-Edit="{ row }">
        <ButtonComponent
          type="button"
          variant="PrimaryButton ButtonSmall"
          @click.stop="openTemplate(row)"
        >
          <i class="fas fa-edit" />
        </ButtonComponent>
      </template>
    </TableComponent>
    <TemplateMasterDialog
      v-model="templateOpen"
      :template="editingTemplate"
      :templates="rows"
      :request="request"
      :dialogs="dialogs"
      @changed="load"
    />
  </div>
</template>
