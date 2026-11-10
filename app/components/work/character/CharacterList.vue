<script setup lang="ts">
import { useOperationSpinner } from '../../../composables/useOperationSpinner';

import { messageFormat } from '../../../utils/messages';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { BackendRequest } from '../../../types/backend';
import type { CharacterMasters, CharacterRow, CharacterMaster } from '../../../types/character';
import type { WorkInfo, WorkPermission } from '../../../types/work';
import type { TableColumn } from '../../../composables/tableData';
import type { PageDialogs } from '../../../composables/usePageDialogs';
import { reportBackendError, requireSuccess } from '../../../utils/backend';
import { formatDateTime } from '../../../utils/mainView';
// この一覧画面が取得するマスタ。入力欄の定義には依存させない。
const masterKeys = ['Organization', 'Team', 'Race', 'Class', 'Power', 'Weapon', 'Move', 'Tag', 'Stage'] as const;
import { tagStyle } from '../../../utils/tagStyle';
import CharacterDialog from './CharacterDialog.vue';
const spinner = useOperationSpinner();

const props = defineProps<{ request: BackendRequest; dialogs: PageDialogs; isAdmin: boolean; hideMeta?: boolean }>();
const emit = defineEmits(['unavailable']);
const work = ref<WorkInfo>();
const isCreator = ref(false);
const rows = ref<CharacterRow[]>([]);
const masters = ref<CharacterMasters>({});
const loading = ref(false);
const saving = ref(false);
const opened = ref(false);
const selected = ref<CharacterRow>();
const dialogVersion = ref(0);
const canEdit = computed(() => !!work.value && (props.isAdmin || isCreator.value));
const role = computed(() => props.isAdmin ? '管理者' : isCreator.value ? '作成者' : 'アシスタント');
let disposed = false;
onBeforeUnmount(() => { disposed = true; window.removeEventListener('focus', refreshTagsOnReturn); });

const columns: TableColumn[] = [
  { key: 'Detail', label: '詳細', width: 90 },
  { key: 'CharaName', label: 'キャラ名', filterable: true, sortable: true },
  { key: 'Furigana', label: 'フリガナ', sortable: true },
  { key: 'Gender', label: '性別', filterable: true, sortable: true, format: value => ['', '男性', '女性', 'その他'][Number(value)] || '' },
  { key: 'Age', label: '年齢', sortable: true, type: 'number' },
  { key: 'RaceName', label: '種族', filterable: true, sortable: true },
  { key: 'OrgName', label: '組織', filterable: true, sortable: true },
  { key: 'TagInfo', label: 'タグ', filterable: true, sortable: true, style: { minWidth: '200px' }, format: value => tagNames(value) },
  ...(['RegistDate', 'UpdateDate'] as const).map(key => ({ key, label: key === 'RegistDate' ? '登録年月日' : '更新年月日', sortable: true, meta: true, type: 'date' as const, style: { minWidth: '310px' }, format: formatDateTime })),
  ...(['RegistUser', 'UpdateUser'] as const).map(key => ({ key, label: key === 'RegistUser' ? '登録者' : '更新者', filterable: true, sortable: true, meta: true, style: { minWidth: '250px' } })),
];
function tags(value: unknown): CharacterMaster[] {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed?.TagInfo) ? parsed.TagInfo : [];
  } catch { return []; }
}
function tagNames(value: unknown) { return tags(value).map(tag => String(tag.TagName || '')); }
function resolveTag(tag: CharacterMaster) {
  return masters.value.Tag?.find(item => String(item.TagId) === String(tag.TagId)) || tag;
}

/** APIごとのDataの入れ子と区分値は旧実装を維持する。取得失敗を空マスタとして保存しない。 */
async function loadMasters() {
  const results = await Promise.allSettled(masterKeys.map(async key => {
    const data = requireSuccess(await props.request<Record<string, CharacterMaster[]>>(`/Get${key}List.php`), messageFormat('ERROR', 'E_0003', key + 'の取得'));
    const list = data[`${key}List`];
    if (!Array.isArray(list)) throw new Error(messageFormat('ERROR', 'E_0030', key));
    return [key, list] as const;
  }));
  const next: CharacterMasters = {};
  let failure: unknown;
  for (const result of results) {
    if (result.status === 'fulfilled') next[result.value[0]] = result.value[1];
    else failure ||= result.reason;
  }
  if (failure) throw failure;
  if (!disposed) masters.value = next;
}
async function loadList() {
  const list = requireSuccess(await props.request<CharacterRow[]>('/GetCharacterList.php'), messageFormat('ERROR', 'E_0003', 'キャラ一覧の取得'));
  if (!Array.isArray(list)) throw new Error(messageFormat('ERROR', 'E_0031'));
  if (!disposed) rows.value = list;
}
async function verifyWork() {
  const current = requireSuccess(await props.request<WorkInfo>('/GetWorkInfo.php'), messageFormat('ERROR', 'E_0003', '作品情報の取得'));
  if (disposed) return;
  const permission = requireSuccess(await props.request<WorkPermission>('/GetUserPermission.php'), messageFormat('ERROR', 'E_0003', '権限情報の取得'));
  if (disposed) return;
  if (work.value && current.WorkId !== work.value.WorkId) {
    work.value = undefined;
    isCreator.value = false;
    throw new Error(messageFormat('ERROR', 'E_0028'));
  }
  work.value = current;
  isCreator.value = permission.IsCreator === true;
}
async function load() {
  loading.value = true;
  try {
    const finished = await spinner.run(async () => {
      await verifyWork();
      if (disposed) return;
      await loadMasters();
      if (disposed) return;
      await loadList();
      return true;
    });
    if (!finished) return;
  } catch (error) {
    if (!disposed) {
      await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0003', 'キャラ設定の取得'));
      if (!disposed) emit('unavailable');
    }
  } finally { loading.value = false; }
}
async function open(row?: CharacterRow) {
  if (loading.value || saving.value) return;
  loading.value = true;
  try {
    const finished = await spinner.run(async () => {
      await verifyWork();
      if (disposed || !row && !canEdit.value) return;
      await loadMasters();
      if (disposed) return;
      selected.value = row ? {
        ...row
      } : undefined;
      dialogVersion.value++;
      opened.value = true;
      return true;
    });
    if (!finished) return;
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0032'));
  } finally { loading.value = false; }
}
function clear() {
  if (!canEdit.value || saving.value) return;
  // 入力はCharacterDialog内で初期化済み。ここでは選択ID・更新日時だけを解除する。
  // ダイアログ自体は再生成せず、表示を維持する。
  selected.value = undefined;
}
async function save(payload: Record<string, unknown>) {
  if (!canEdit.value || saving.value) return;
  saving.value = true;
  try {
    const finished = await spinner.run(async () => {
      await verifyWork();
      if (disposed || !canEdit.value) return;
      requireSuccess(await props.request('/SaveCharacter.php', 'POST', payload), messageFormat('ERROR', 'E_0003', '保存'));
      if (disposed) return;
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(messageFormat('INFO', 'I_0011', '保存'), messageFormat('INFO', 'I_0001', 'キャラ情報の保存'));
    if (disposed) return;
    opened.value = false;
    await spinner.run(loadList);
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '保存'));
  } finally { saving.value = false; }
}
async function remove() {
  const row = selected.value;
  if (!row || !canEdit.value || saving.value) return;
  saving.value = true;
  try {
    if (!await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'このキャラを削除')) || disposed) return;
    const finished = await spinner.run(async () => {
      await verifyWork();
      if (disposed || !canEdit.value) return;
      requireSuccess(await props.request('/DeleteCharacter.php', 'POST', {
        CharaId: row.CharaId,
        UpdateDate: row.UpdateDate
      }), messageFormat('ERROR', 'E_0003', '削除'));
      if (disposed) return;
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(messageFormat('INFO', 'I_0011', '削除'), messageFormat('INFO', 'I_0001', 'キャラの削除'));
    if (disposed) return;
    opened.value = false;
    await spinner.run(loadList);
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '削除'));
  } finally { saving.value = false; }
}
async function refreshTags() {
  try {
    const finished = await spinner.run(async () => {
      const data = requireSuccess(await props.request<{
        TagList: CharacterMaster[];
      }>('/GetTagList.php'), messageFormat('ERROR', 'E_0003', 'タグ一覧の取得'));
      if (!Array.isArray(data.TagList)) throw new Error(messageFormat('ERROR', 'E_0033'));
      if (!disposed) masters.value = {
        ...masters.value,
        Tag: data.TagList
      };
      return true;
    });
    if (!finished) return;
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0003', 'タグ一覧の取得'));
  }
}
function refreshTagsOnReturn() { if (opened.value && !saving.value) void refreshTags(); }
onMounted(() => { void load(); window.addEventListener('focus', refreshTagsOnReturn); });
</script>

<template>
  <div>
    <WorkContentHeader title="キャラ設定" icon="fa-user" :work-title="work?.WorkTitle" :role="work ? role : undefined" />
    <div v-if="canEdit" class="ButtonGroup">
      <ButtonComponent type="button" variant="SuccessButton" @click="open()"><i class="fas fa-plus" aria-hidden="true" /> 追加</ButtonComponent>
    </div>
    <TableComponent :rows="rows" :columns="columns" row-key="CharaId" :hide-meta="hideMeta" :loading="loading">
      <template #cell-Detail="{ row }"><ButtonComponent type="button" variant="PrimaryButton ButtonSmall" @click.stop="open(row as CharacterRow)"><i class="fas fa-eye" aria-hidden="true" /> 詳細</ButtonComponent></template>
      <template #cell-Gender="{ value }">{{ value || '未設定' }}</template>
      <template #cell-Age="{ value }">{{ value === null || value === undefined || value === '' ? '未設定' : `${value}歳` }}</template>
      <template #cell-TagInfo="{ row }">
        <div class="TagChipList">
          <span v-for="tag in tags(row.TagInfo)" :key="String(tag.TagId)" class="TagChip" :style="tagStyle(resolveTag(tag))">{{ tag.TagName }}</span>
          <span v-if="!tags(row.TagInfo).length">未設定</span>
        </div>
      </template>
    </TableComponent>
    <CharacterDialog
      v-if="opened" :key="dialogVersion" v-model="opened" :row="selected" :masters="masters"
      :setting-date="work?.SettingDate || ''" :can-edit="canEdit" :saving="saving" :dialogs="dialogs"
      @save="save" @delete="remove" @clear="clear" @refresh-tags="refreshTags"
    />
  </div>
</template>
