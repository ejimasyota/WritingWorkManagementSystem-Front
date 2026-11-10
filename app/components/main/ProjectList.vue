<script setup lang="ts">
import { useOperationSpinner } from '../../composables/useOperationSpinner';

import { messageFormat } from '../../utils/messages';
import { onMounted, ref } from 'vue';
import type { BackendRequest, DownloadData, Project, SessionInfo } from '../../types/backend';
import type { PageDialogs } from '../../composables/usePageDialogs';
import type { TableColumn } from '../../composables/tableData';
import { formatDateTime, genreLabel } from '../../utils/mainView';
import { copyToClipboard, downloadBase64, fileAsBase64 } from '../../utils/files';
import { reportBackendError, requireSuccess } from '../../utils/backend';
const spinner = useOperationSpinner();

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
const fileInput = ref<{ openFilePicker: () => void; getFiles: () => File[]; setValue: (value: string) => void }>();
const table = ref<{
  reset: () => void;
}>();
const projectColumns = [
  {
    "key": "WorkTitle",
    "label": "作品名",
    "filterable": true,
    "sortable": true
  },
  {
    "key": "Genre",
    "label": "ジャンル",
    "filterable": true,
    "sortable": true
  },
  {
    "key": "RegistUser",
    "label": "登録者",
    "filterable": true,
    "sortable": true
  },
  {
    "key": "RegistDate",
    "label": "登録年月日",
    "filterable": false,
    "sortable": true,
    "style": "min-width:310px"
  },
  {
    "key": "UpdateUser",
    "label": "更新者",
    "filterable": true,
    "sortable": true
  },
  {
    "key": "UpdateDate",
    "label": "更新年月日",
    "filterable": false,
    "sortable": true,
    "style": "min-width:310px"
  },
  {
    "key": "Action",
    "label": "操作パレット",
    "filterable": false,
    "sortable": false,
    "style": "width:1%"
  }
];

const columns: TableColumn[] = projectColumns.map(column => ({
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
    const finished = await spinner.run(async () => {
      projects.value = requireSuccess(await props.request<Project[]>('/GetProjectList.php'), messageFormat('ERROR', 'E_0003', 'プロジェクト一覧の取得')) || [];
      table.value?.reset();
      return true;
    });
    if (!finished) return;
  } catch (error) {
    await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'プロジェクト一覧の取得'));
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
    const finished = await spinner.run(async () => {
      requireSuccess(await props.request('/CreateWork.php', 'POST', data), messageFormat('ERROR', 'E_0003', '作品の作成'));
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(messageFormat('INFO', 'I_0023'), messageFormat('INFO', 'I_0001', '作品の作成'));
    await load();
  } catch (error) {
    await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '作品作成'));
  }
}
async function deleteProject(project: Project) {
  const creator = isCreator(project);
  if (!(await props.dialogs.confirm(creator ? messageFormat('CONFIRM', 'C_0001', 'この作品を削除') : messageFormat('CONFIRM', 'C_0001', 'この作品の制作から退出')))) return;
  if (creator && !(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0006', project.WorkTitle)))) return;
  try {
    const finished = await spinner.run(async () => {
      requireSuccess(await props.request('/DeleteProject.php', 'POST', {
        WorkId: project.WorkId,
        UpdateDate: project.UpdateDate || null,
        CreaterUpdateDate: project.CreaterUpdateDate || null
      }), creator ? messageFormat('ERROR', 'E_0003', '削除') : messageFormat('ERROR', 'E_0003', '退出'));
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(creator ? messageFormat('INFO', 'I_0011', '削除') : messageFormat('INFO', 'I_0011', '退出'), creator ? messageFormat('INFO', 'I_0001', '作品の削除') : messageFormat('INFO', 'I_0001', '作品の制作からの退出'));
    await load();
    emit('changed');
  } catch (error) {
    await reportBackendError(props.dialogs, error, creator ? messageFormat('ERROR', 'E_0004', '削除') : messageFormat('ERROR', 'E_0004', '退出'));
  }
}
async function issueUrl(project: Project) {
  try {
    const finished = await spinner.run(async () => {
      const data = requireSuccess(await props.request<{
        Token: string;
      }>('/IssueParticipationUrl.php', 'POST', {
        WorkId: project.WorkId
      }), messageFormat('ERROR', 'E_0003', '参加URLの発行'));
      const url = `${window.location.origin}/login?token=${encodeURIComponent(data.Token)}`;
      if (!(await copyToClipboard(url))) throw new Error(messageFormat('ERROR', 'E_0003', 'クリップボードへのコピー'));
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(messageFormat('INFO', 'I_0026'), messageFormat('INFO', 'I_0027'));
  } catch (error) {
    await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '参加URLの発行'));
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
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0007', type)))) return;
  exportOpen.value = false;
  try {
    const finished = await spinner.run(async () => {
      const data = requireSuccess(await props.request<DownloadData>('/ExportDocument.php', 'POST', {
        WorkId: project.WorkId,
        ...settings
      }), messageFormat('ERROR', 'E_0003', '出力'));
      downloadBase64(data);
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(messageFormat('INFO', 'I_0011', '出力'), messageFormat('INFO', 'I_0002', type + 'ファイル'));
  } catch (error) {
    await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '出力'));
  }
}
async function backup(project: Project) {
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'この作品のバックアップCSVを出力')))) return;
  try {
    const finished = await spinner.run(async () => {
      const data = requireSuccess(await props.request<DownloadData>('/GetBackupInfo.php', 'POST', {
        WorkId: project.WorkId
      }), messageFormat('ERROR', 'E_0003', 'バックアップ出力'));
      downloadBase64({
        ...data,
        MimeType: data.MimeType || 'text/csv',
        FileName: data.FileName || 'backup.csv'
      });
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(messageFormat('INFO', 'I_0011', '出力'), messageFormat('INFO', 'I_0001', 'バックアップCSVの出力'));
  } catch (error) {
    await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'バックアップ出力'));
  }
}
async function chooseRestore(project: Project) {
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'バックアップCSVから復元')))) return;
  restoreProject.value = project;
  if (fileInput.value) {
    fileInput.value.openFilePicker();
  }
}
async function restore() {
  const file = fileInput.value?.getFiles()[0];
  fileInput.value?.setValue('');
  const project = restoreProject.value;
  if (!file || !project) return;
  if (!file.name.toLowerCase().endsWith('.csv')) {
    await props.dialogs.error(messageFormat('ERROR', 'E_0027'));
    return;
  }
  try {
    const data = await fileAsBase64(file);
    if (!data) throw new Error(messageFormat('ERROR', 'E_0003', '選択したCSVの読み込み'));
    const finished = await spinner.run(async () => {
      requireSuccess(await props.request('/BackupRestoration.php', 'POST', {
        WorkId: project.WorkId,
        FileName: file.name,
        FileData: data
      }), messageFormat('ERROR', 'E_0003', '復元'));
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(messageFormat('INFO', 'I_0011', '復元'), messageFormat('INFO', 'I_0001', 'バックアップCSVからの復元'));
    await load();
  } catch (error) {
    await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '復元'));
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
      <ButtonComponent
        id="CreateWorkButton"
        type="button"
        variant="SuccessButton"
        @click="createOpen = true"
      >
        <i class="fas fa-plus" />
        作成
      </ButtonComponent>
    </div>
    <TableComponent
      ref="table"
      :rows="projects"
      :columns="columns"
      row-key="WorkId"
      :hide-meta="hideMeta"
    >
      <template #cell-Action="{ row }">
        <ButtonComponent
          type="button"
          variant="ButtonSmall PrimaryButton ProjectMoveButton"
          @click.stop="emit('move', row.WorkId)"
        >
          <i class="fas fa-arrow-right" />
          移動
        </ButtonComponent>
        <template v-if="isCreator(row as Project)">
          <ButtonComponent
            type="button"
            variant="ButtonSmall SuccessButton ProjectActionButton"
            @click.stop="openExport(row as Project)"
          >
            <i class="fas fa-file-word" />
            出力
          </ButtonComponent>
          <ButtonComponent
            type="button"
            variant="ButtonSmall WarningButton ProjectActionButton"
            @click.stop="issueUrl(row as Project)"
          >
            <i class="fas fa-link" />
            URL
          </ButtonComponent>
          <ButtonComponent
            type="button"
            variant="ButtonSmall BackupButton ProjectActionButton"
            @click.stop="backup(row as Project)"
          >
            <i class="fas fa-file-csv" />
            CSV
          </ButtonComponent>
          <ButtonComponent
            type="button"
            variant="ButtonSmall RestoreButton ProjectActionButton"
            @click.stop="chooseRestore(row as Project)"
          >
            <i class="fas fa-upload" />
            復元
          </ButtonComponent>
        </template>
        <ButtonComponent
          type="button"
          variant="ButtonSmall DeleteButton ProjectActionButton"
          @click.stop="deleteProject(row as Project)"
        >
          <i class="fas fa-trash" />
          {{ isCreator(row as Project) ? '削除' : '退出' }}
        </ButtonComponent>
      </template>
    </TableComponent>
    <TextFieldComponent inline ref="fileInput" type="file" class="Hidden" accept=".csv" @change="restore" />
    <WorkCreateDialog v-model="createOpen" @create="createWork" />
    <ExportSettingsDialog v-model="exportOpen" @export="exportDocument" />
  </div>
</template>
