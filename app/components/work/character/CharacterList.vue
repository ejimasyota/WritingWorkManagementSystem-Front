<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { BackendRequest } from '../../../types/backend';
import type { CharacterMasters, CharacterRow, CharacterMaster } from '../../../types/character';
import type { WorkInfo, WorkPermission } from '../../../types/work';
import type { TableColumn } from '../../../composables/tableData';
import type { PageDialogs } from '../../../composables/usePageDialogs';
import { reportBackendError, requireSuccess } from '../../../utils/backend';
import { formatDateTime } from '../../../utils/mainView';
import { masterDefinitions } from '../../../utils/characterFields';
import { tagStyle } from '../../../utils/characterData';
import CharacterDialog from './CharacterDialog.vue';
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
  const results = await Promise.allSettled(masterDefinitions.map(async ([key]) => {
    const data = requireSuccess(await props.request<Record<string, CharacterMaster[]>>(`/Get${key}List.php`), `${key}の取得に失敗しました`);
    const list = data[`${key}List`];
    if (!Array.isArray(list)) throw new Error(`${key}の一覧形式が不正です`);
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
  const list = requireSuccess(await props.request<CharacterRow[]>('/GetCharacterList.php'), 'キャラ一覧の取得に失敗しました');
  if (!Array.isArray(list)) throw new Error('キャラ一覧の形式が不正です');
  if (!disposed) rows.value = list;
}
async function verifyWork() {
  const current = requireSuccess(await props.request<WorkInfo>('/GetWorkInfo.php'), '作品情報の取得に失敗しました');
  if (disposed) return;
  const permission = requireSuccess(await props.request<WorkPermission>('/GetUserPermission.php'), '権限情報の取得に失敗しました');
  if (disposed) return;
  if (work.value && current.WorkId !== work.value.WorkId) {
    work.value = undefined;
    isCreator.value = false;
    throw new Error('選択中の作品が変更されました。作品一覧から開き直してください');
  }
  work.value = current;
  isCreator.value = permission.IsCreator === true;
}
async function load() {
  loading.value = true;
  try {
    await verifyWork();
    if (disposed) return;
    await loadMasters();
    if (disposed) return;
    await loadList();
  } catch (error) {
    if (!disposed) {
      await reportBackendError(props.dialogs, error, 'キャラ設定の取得に失敗しました');
      if (!disposed) emit('unavailable');
    }
  } finally { loading.value = false; }
}
async function open(row?: CharacterRow) {
  if (loading.value || saving.value) return;
  loading.value = true;
  try {
    await verifyWork();
    if (disposed || (!row && !canEdit.value)) return;
    await loadMasters();
    if (disposed) return;
    selected.value = row ? { ...row } : undefined;
    dialogVersion.value++;
    opened.value = true;
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, 'キャラ設定を開けませんでした');
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
    await verifyWork();
    if (disposed || !canEdit.value) return;
    requireSuccess(await props.request('/SaveCharacter.php', 'POST', payload), '保存に失敗しました');
    if (disposed) return;
    await props.dialogs.info('保存完了', 'キャラ情報を保存しました');
    if (disposed) return;
    opened.value = false;
    await loadList();
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, '保存中にエラーが発生しました');
  } finally { saving.value = false; }
}
async function remove() {
  const row = selected.value;
  if (!row || !canEdit.value || saving.value) return;
  saving.value = true;
  try {
    if (!await props.dialogs.confirm('このキャラを削除しますか？') || disposed) return;
    await verifyWork();
    if (disposed || !canEdit.value) return;
    requireSuccess(await props.request('/DeleteCharacter.php', 'POST', { CharaId: row.CharaId, UpdateDate: row.UpdateDate }), '削除に失敗しました');
    if (disposed) return;
    await props.dialogs.info('削除完了', 'キャラを削除しました');
    if (disposed) return;
    opened.value = false;
    await loadList();
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, '削除中にエラーが発生しました');
  } finally { saving.value = false; }
}
async function refreshTags() {
  try {
    const data = requireSuccess(await props.request<{ TagList: CharacterMaster[] }>('/GetTagList.php'), 'タグ一覧の取得に失敗しました');
    if (!Array.isArray(data.TagList)) throw new Error('タグ一覧の形式が不正です');
    if (!disposed) masters.value = { ...masters.value, Tag: data.TagList };
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, 'タグ一覧の取得に失敗しました');
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
