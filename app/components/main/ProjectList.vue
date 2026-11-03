<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { BackendRequest, DownloadData, Project, SessionInfo } from '../../types/backend';
import type { PageDialogs } from '../../composables/usePageDialogs';
import type { TableColumn } from '../../composables/tableData';
import rawColumns from '../../utils/mainColumns.json';
import { formatDateTime, genreLabel } from '../../utils/mainView';
import { copyToClipboard, downloadBase64, fileAsBase64 } from '../../utils/files';
import { reportBackendError, requireSuccess } from '../../utils/backend';
const props = defineProps<{
  session: SessionInfo;
  request: BackendRequest;
  dialogs: PageDialogs;
  hideMeta: boolean;
}>();
const emit = defineEmits(['move', 'changed']);
const projects = ref<Project[]>([]);
const createOpen = ref(false);
const exportOpen = ref(false);
const exportProject = ref<Project>();
const restoreProject = ref<Project>();
const fileInput = ref<HTMLInputElement>();
const table = ref<{
  reset: () => void;
}>();
const columns: TableColumn[] = rawColumns.ProjectColumns.map(column => ({
  ...column,
  className: column.key === 'Action' ? 'ActionCol' : undefined,
  meta: ['登録年月日', '更新年月日', '登録者', '更新者'].includes(column.label),
  style: column.style ? Object.fromEntries(column.style.split(';').filter(Boolean).map(part => part.split(':'))) : undefined,
  format: (value: unknown) => {
    if (column.key === 'Genre') return genreLabel(value);
    if (column.key.endsWith('Date')) return formatDateTime(value) || '未設定';
    return value || '未設定';
  }
}));
async function load() {
  try {
    projects.value = requireSuccess(await props.request<Project[]>('/GetProjectList.php'), 'プロジェクト一覧の取得に失敗しました') || [];
    table.value?.reset();
  } catch (error) {
    await reportBackendError(props.dialogs, error, 'プロジェクト一覧の取得中にエラーが発生しました');
  }
}
function isCreator(project: Project) {
  return project.RegistUser === props.session.UserId;
}
async function createWork(data: {
  WorkTitle: string;
  Genre: number;
}) {
  try {
    requireSuccess(await props.request('/CreateWork.php', 'POST', data), '作品の作成に失敗しました');
    await props.dialogs.info('作品作成', '作品を作成しました');
    await load();
  } catch (error) {
    await reportBackendError(props.dialogs, error, '作品作成中にエラーが発生しました');
  }
}
async function deleteProject(project: Project) {
  const creator = isCreator(project);
  if (!(await props.dialogs.confirm(creator ? 'この作品を削除しますか？' : 'この作品の制作から退出しますか？'))) return;
  if (creator && !(await props.dialogs.confirm(`下記の作品を削除します。本当によろしいですか？\n ${project.WorkTitle}`))) return;
  try {
    requireSuccess(await props.request('/DeleteProject.php', 'POST', {
      WorkId: project.WorkId,
      UpdateDate: project.UpdateDate || null,
      CreaterUpdateDate: project.CreaterUpdateDate || null
    }), creator ? '削除に失敗しました' : '退出に失敗しました');
    await props.dialogs.info(creator ? '削除完了' : '退出完了', creator ? '作品を削除しました' : '作品の制作から退出しました');
    await load();
    emit('changed');
  } catch (error) {
    await reportBackendError(props.dialogs, error, creator ? '削除中にエラーが発生しました' : '退出中にエラーが発生しました');
  }
}
async function issueUrl(project: Project) {
  try {
    const data = requireSuccess(await props.request<{
      Token: string;
    }>('/IssueParticipationUrl.php', 'POST', {
      WorkId: project.WorkId
    }), '参加URLの発行に失敗しました');
    const url = `${window.location.origin}/?token=${encodeURIComponent(data.Token)}`;
    if (!(await copyToClipboard(url))) throw new Error('クリップボードへのコピーに失敗しました');
    await props.dialogs.info('URL発行', 'プロジェクト参加URLをクリップボードに保存しました。\nプロジェクトに参加を行うメンバーへ共有を行ってください。');
  } catch (error) {
    await reportBackendError(props.dialogs, error, '参加URLの発行中にエラーが発生しました');
  }
}
function openExport(project: Project) {
  exportProject.value = project;
  exportOpen.value = true;
}
async function exportDocument(settings: Record<string, unknown>) {
  const project = exportProject.value;
  if (!project) return;
  const type = settings.ExportType === 'html' ? 'HTML' : 'Word';
  if (!(await props.dialogs.confirm(`この設定で資料を${type}出力しますか？`))) return;
  exportOpen.value = false;
  try {
    const data = requireSuccess(await props.request<DownloadData>('/ExportDocument.php', 'POST', {
      WorkId: project.WorkId,
      ...settings
    }), '出力に失敗しました');
    downloadBase64(data);
    await props.dialogs.info('出力完了', `${type}ファイルをダウンロードしました`);
  } catch (error) {
    await reportBackendError(props.dialogs, error, '出力中にエラーが発生しました');
  }
}
async function backup(project: Project) {
  if (!(await props.dialogs.confirm('この作品のバックアップCSVを出力しますか？'))) return;
  try {
    const data = requireSuccess(await props.request<DownloadData>('/GetBackupInfo.php', 'POST', {
      WorkId: project.WorkId
    }), 'バックアップ出力に失敗しました');
    downloadBase64({
      ...data,
      MimeType: data.MimeType || 'text/csv',
      FileName: data.FileName || 'backup.csv'
    });
    await props.dialogs.info('出力完了', 'バックアップCSVをダウンロードしました');
  } catch (error) {
    await reportBackendError(props.dialogs, error, 'バックアップ出力中にエラーが発生しました');
  }
}
async function chooseRestore(project: Project) {
  if (!(await props.dialogs.confirm('バックアップCSVから復元しますか？'))) return;
  restoreProject.value = project;
  if (fileInput.value) {
    fileInput.value.value = '';
    fileInput.value.click();
  }
}
async function restore(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  const project = restoreProject.value;
  if (!file || !project) return;
  if (!file.name.toLowerCase().endsWith('.csv')) {
    await props.dialogs.error('CSV以外のファイルは選択できません');
    return;
  }
  try {
    const data = await fileAsBase64(file);
    if (!data) throw new Error('選択したCSVの読み込みに失敗しました');
    requireSuccess(await props.request('/BackupRestoration.php', 'POST', {
      WorkId: project.WorkId,
      FileName: file.name,
      FileData: data
    }), '復元に失敗しました');
    await props.dialogs.info('復元完了', 'バックアップCSVから復元しました');
    await load();
  } catch (error) {
    await reportBackendError(props.dialogs, error, '復元中にエラーが発生しました');
  }
}
onMounted(load);
defineExpose({
  load
});
</script>

<template>
  <div>
    <div class="ContentHeader">
      <h2 class="ContentTitle">
        <i class="fas fa-folder-open" />
        創作管理
      </h2>
      <p class="WelcomeMessage">
        ようこそ、
        <span class="UserIdDisplay">
          {{ session.UserId }}
        </span>
        さん
      </p>
    </div>
    <div class="MarginBottom20">
      <button
        id="CreateWorkButton"
        type="button"
        class="ButtonClass SuccessButton"
        @click="createOpen = true"
      >
        <i class="fas fa-plus" />
        作成
      </button>
    </div>
    <TableComponent
      ref="table"
      :rows="projects"
      :columns="columns"
      row-key="WorkId"
      :hide-meta="hideMeta"
    >
      <template #cell-Action="{ row }">
        <button
          type="button"
          class="ButtonClass ButtonSmall PrimaryButton ProjectMoveButton"
          @click.stop="emit('move', row.WorkId)"
        >
          <i class="fas fa-arrow-right" />
          移動
        </button>
        <template v-if="isCreator(row as Project)">
          <button
            type="button"
            class="ButtonClass ButtonSmall SuccessButton ProjectActionButton"
            @click.stop="openExport(row as Project)"
          >
            <i class="fas fa-file-word" />
            出力
          </button>
          <button
            type="button"
            class="ButtonClass ButtonSmall WarningButton ProjectActionButton"
            @click.stop="issueUrl(row as Project)"
          >
            <i class="fas fa-link" />
            URL
          </button>
          <button
            type="button"
            class="ButtonClass ButtonSmall BackupButton ProjectActionButton"
            @click.stop="backup(row as Project)"
          >
            <i class="fas fa-file-csv" />
            CSV
          </button>
          <button
            type="button"
            class="ButtonClass ButtonSmall RestoreButton ProjectActionButton"
            @click.stop="chooseRestore(row as Project)"
          >
            <i class="fas fa-upload" />
            復元
          </button>
        </template>
        <button
          type="button"
          class="ButtonClass ButtonSmall DeleteButton ProjectActionButton"
          @click.stop="deleteProject(row as Project)"
        >
          <i class="fas fa-trash" />
          {{ isCreator(row as Project) ? '削除' : '退出' }}
        </button>
      </template>
    </TableComponent>
    <input ref="fileInput" type="file" class="Hidden" accept=".csv" @change="restore">
    <WorkCreateDialog v-model="createOpen" @create="createWork" />
    <ExportSettingsDialog v-model="exportOpen" @export="exportDocument" />
  </div>
</template>
