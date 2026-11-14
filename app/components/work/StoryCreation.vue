<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref } from 'vue';
import type { BackendRequest, DownloadData } from '../../types/backend';
import type { WorkSettingRow } from '../../types/workSettings';
import type { WorkInfo } from '../../types/work';
import type { PageDialogs } from '../../composables/usePageDialogs';
import type { ExportSettings } from '../../types/export';
import { useInputFields } from '../../composables/useInputFields';
import { useOperationSpinner } from '../../composables/useOperationSpinner';
import { readWorkAccess } from '../../utils/workAccess';
import { requireSuccess, reportBackendError } from '../../utils/backend';
import { messageFormat } from '../../utils/messages';
import { workLocation } from '../../utils/workNavigation';
import { downloadBase64, fileAsBase64 } from '../../utils/files';
const props = defineProps<{
  request: BackendRequest;
  dialogs: PageDialogs;
  isAdmin: boolean;
  hideMeta?: boolean;
  targetId?: string;
  targetParentId?: string;
}>();
const fields = useInputFields();
const spinner = useOperationSpinner();
const work = ref<WorkInfo>();
const isCreator = ref(false);
const ready = ref(false);
const busy = ref(false);
const selected = ref<WorkSettingRow | null>(null);
const folders = ref<WorkSettingRow[]>([]);
const rows = ref<WorkSettingRow[]>([]);
const hasTemplate = ref(false);
const infoOpen = ref(false);
const rowOpen = ref(false);
const exportOpen = ref(false);
const editingInfo = ref<WorkSettingRow | null>(null);
const editingRow = ref<WorkSettingRow | null>(null);
const errors = ref<Record<string, string>>({});
const revision = ref(0);
const dragged = ref<string | null>(null);
const touchTarget = ref<string | null>(null);
const production = ref('0');
const infoForm = reactive({
  Name: '',
  ProductionType: '0'
});
const rowForm = reactive({
  IndexNum: '',
  Content: ''
});
const canEdit = computed(() => ready.value && (props.isAdmin || isCreator.value));
const role = computed(() => props.isAdmin ? '管理者' : isCreator.value ? '作成者' : 'アシスタント');
const productionOptions = [{
  value: '0',
  label: ''
}, {
  value: '1',
  label: '投稿用'
}, {
  value: '2',
  label: '連載用'
}, {
  value: '3',
  label: '短編用'
}, {
  value: '4',
  label: '長編用'
}, {
  value: '5',
  label: 'その他'
}];

function productionLabel(value: unknown) {
  return productionOptions.find(option => option.value === String(value))?.label || messageFormat('INFO', 'I_0071');
}
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
});

async function verifyAccess() {
  const access = await readWorkAccess(props.request, work.value?.WorkId);
  if (disposed) return false;
  work.value = access.work;
  isCreator.value = access.isCreator;
  return props.isAdmin || access.isCreator;
}
/** フォルダ・行・テンプレートの有無を1操作の中で初期化する。 */


async function read(id: unknown = null) {
  const endpoint = '/GetStoryList.php' + (id ? '?StoryId=' + encodeURIComponent(String(id)) : '');
  const data = requireSuccess(await props.request<Record<string, unknown>>(endpoint), messageFormat('ERROR', 'E_0003', 'ストーリーの取得'));
  if (!Array.isArray(data?.StoryList) || !Array.isArray(data.StoryRowList)) throw new Error(messageFormat('ERROR', 'E_0026'));
  if (disposed) return;
  folders.value = data.StoryList as WorkSettingRow[];
  selected.value = id ? data.SelectedStory as WorkSettingRow : null;
  rows.value = data.StoryRowList as WorkSettingRow[];
  hasTemplate.value = data.HasTemplate === true;
  if (!Array.isArray(data.CharacterList) || !Array.isArray(data.PlotList)) throw new Error(messageFormat('ERROR', 'E_0026'));
  characters.value = data.CharacterList as WorkSettingRow[];
  plots.value = data.PlotList as WorkSettingRow[];
  ready.value = true;
}

async function load(id: unknown = null) {
  if (busy.value || disposed) return;
  busy.value = true;
  try {
    await spinner.run(async () => {
      await verifyAccess();
      if (!disposed) await read(id);
    });
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'ストーリーの取得'));
  } finally {
    busy.value = false;
  }
}
/** 成功時にだけ編集ダイアログを閉じる。行のUpdateDateは開いた時点のものを送る。 */


async function mutate(endpoint: string, payload: Record<string, unknown>, operation: string, folderId: unknown = selected.value?.StoryId ?? null) {
  if (!canEdit.value || busy.value || disposed) return false;
  busy.value = true;
  let completed = false;
  try {
    await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed) return;
      requireSuccess(await props.request(endpoint, 'POST', payload), messageFormat('ERROR', 'E_0003', 'ストーリーの' + operation));
      completed = true;
      await read(folderId);
    });
    if (completed && !disposed) await props.dialogs.info(messageFormat('INFO', 'I_0011', operation), messageFormat('INFO', 'I_0001', 'ストーリーの' + operation));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'ストーリーの' + operation));
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
  infoForm.Name = String(row?.StoryName || '');
  infoForm.ProductionType = String(row?.ProductionType || '0');
  production.value = infoForm.ProductionType;
  fields.setValues(infoForm);
  fields.setValue('PlotId', String(row?.PlotId || ''));
  errors.value = {};
  revision.value++;
  infoOpen.value = true;
}

async function saveInfo(applyTemplate = false) {
  if (!canEdit.value || busy.value) return;
  const values = fields.getValues(infoForm);
  errors.value = {};
  if (!values.Name.trim()) errors.value.Name = messageFormat('ERROR', 'E_0001', 'ストーリー名');
  if (values.Name.length > 30) errors.value.Name = messageFormat('ERROR', 'E_0002', 'ストーリー名', 30);
  const plot = plots.value.find(row => String(row.PlotId) === fields.getValue('PlotId', ''));
  if (plot && String(plot.ProductionType || 0) !== values.ProductionType) errors.value.PlotId = messageFormat('ERROR', 'E_0072');
  if (Object.keys(errors.value).length) {
    fields.focus('Name');
    return;
  }
  if (applyTemplate && !(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0017', 'ストーリー')))) return;
  const payload: Record<string, unknown> = {
    Mode: 'info',
    StoryId: editingInfo.value?.StoryId ?? null,
    StoryName: values.Name.trim(),
    ProductionType: values.ProductionType,
    ApplyTemplate: applyTemplate,
    UpdateDate: editingInfo.value?.UpdateDate ?? null
  };
  payload.PlotId = fields.getValue('PlotId', '');
  if (await mutate('/SaveStory.php', payload, '保存', null)) infoOpen.value = false;
}
/** 行の入力はダイアログで編集する。親情報と行情報の更新日時を混同しない。 */


function openRow(row: WorkSettingRow | null = null) {
  if (!selected.value || busy.value) return;
  editingRow.value = row ? {
    ...row
  } : null;
  rowForm.IndexNum = String(row?.IndexNum ?? rows.value.length + 1);
  rowForm.Content = String(row?.Content || '');
  fields.setValues(rowForm);
  freeInput.value = !!row?.Narrator && !row?.NarratorCharaId;
  Object.assign(narratorForm, {
    Narrator: String(row?.Narrator || ''),
    NarratorCharaId: String(row?.NarratorCharaId || ''),
    Monologue: row?.Monologue === true
  });
  fields.setValues(narratorForm);
  fields.setValue('FreeInput', freeInput.value);
  errors.value = {};
  revision.value++;
  rowOpen.value = true;
}

async function saveRow() {
  if (!canEdit.value || !selected.value || busy.value) return;
  const values = fields.getValues(rowForm);
  errors.value = {};
  if (!values.Content.trim()) errors.value.Content = messageFormat('ERROR', 'E_0001', '内容');
  if (!/^[1-9][0-9]{0,9}$/.test(values.IndexNum) || Number(values.IndexNum) > rows.value.length + (editingRow.value ? 0 : 1)) errors.value.IndexNum = messageFormat('ERROR', 'E_0050', '並び順', 10);
  if (Object.keys(errors.value).length) {
    fields.focus(Object.keys(errors.value)[0]!);
    return;
  }
  const payload: Record<string, unknown> = {
    ...values,
    Mode: 'row',
    StoryId: selected.value.StoryId,
    StoryRowId: editingRow.value?.StoryRowId ?? null,
    UpdateDate: editingRow.value?.UpdateDate ?? null
  };
  Object.assign(payload, fields.getValues(narratorForm));
  if (freeInput.value) payload.NarratorCharaId = null;else payload.Narrator = null;
  if (await mutate('/SaveStory.php', payload, '保存')) rowOpen.value = false;
}

async function removeInfo() {
  const row = editingInfo.value;
  if (!row || !canEdit.value || busy.value) return;
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'このストーリーを削除')))) return;
  if (await mutate('/DeleteStory.php', {
    Mode: 'info',
    StoryId: row.StoryId,
    UpdateDate: row.UpdateDate
  }, '削除', null)) infoOpen.value = false;
}

async function removeRows(all = false) {
  const row = all ? selected.value : editingRow.value;
  if (!row || !selected.value || !canEdit.value || busy.value) return;
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', all ? '全ての行を削除' : 'この行を削除')))) return;
  if (await mutate('/DeleteStory.php', {
    Mode: 'row',
    StoryId: selected.value.StoryId,
    StoryRowId: all ? null : row.StoryRowId,
    UpdateDate: row.UpdateDate
  }, '削除')) rowOpen.value = false;
}

async function copy(row: WorkSettingRow) {
  if (!canEdit.value || busy.value || !(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0018', 'ストーリー')))) return;
  await mutate('/CopyStory.php', {
    StoryId: row.StoryId,
    UpdateDate: row.UpdateDate
  }, 'コピー', null);
}

async function output(settings: ExportSettings) {
  const folder = selected.value;
  if (!folder || busy.value) return;
  if (!rows.value.length) {
    await props.dialogs.error(messageFormat('ERROR', 'E_0057', 'ストーリー'));
    return;
  }
  busy.value = true;
  try {
    const data = await spinner.run(async () => {
      await verifyAccess();
      if (disposed) return;
      return requireSuccess(await props.request<DownloadData>('/ExportStory.php', 'POST', {
        ...settings,
        StoryId: folder.StoryId
      }), messageFormat('ERROR', 'E_0003', 'ストーリーの出力'));
    });
    if (data && !disposed) {
      downloadBase64(data);
      exportOpen.value = false;
    }
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'ストーリーの出力'));
  } finally {
    busy.value = false;
  }
}

function beginDrag(event: DragEvent, row: WorkSettingRow) {
  if (!canEdit.value) return;
  dragged.value = String(row.StoryRowId);
  event.dataTransfer?.setData('text/plain', dragged.value);
}

function touchMove(event: TouchEvent) {
  const point = event.touches[0];
  if (!point || !dragged.value) return;
  event.preventDefault();
  touchTarget.value = document.elementFromPoint(point.clientX, point.clientY)?.closest<HTMLElement>('[data-narrative-row]')?.dataset.narrativeRow || null;
}
/** ドラッグ時も、表示順を直接確定せず、元の親更新日時と全行の並び順をAPIへ送る。 */


async function reorder(target: string | null) {
  const from = dragged.value;
  dragged.value = null;
  touchTarget.value = null;
  if (!from || !target || from === target || busy.value || !selected.value || !canEdit.value) return;
  const sourceIndex = rows.value.findIndex(row => String(row.StoryRowId) === from);
  const targetIndex = rows.value.findIndex(row => String(row.StoryRowId) === target);
  if (sourceIndex < 0 || targetIndex < 0) return;
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0019', 'ストーリー')))) return;
  const order = [...rows.value];
  const moved = order.splice(sourceIndex, 1)[0]!;
  order.splice(targetIndex, 0, moved);
  await mutate('/UpdateStoryOrder.php', {
    StoryId: selected.value.StoryId,
    UpdateDate: selected.value.UpdateDate,
    OrderList: order.map((row, index) => ({
      StoryRowId: row.StoryRowId,
      IndexNum: index + 1
    }))
  }, '並び順の更新');
}
onMounted(async () => {
  await load(props.targetParentId || null);
  if (!disposed && props.targetId) {
    const row = rows.value.find(row => String(row.StoryRowId) === props.targetId);
    if (row) openRow(row);
  }
});
const characters = ref<WorkSettingRow[]>([]);
const plots = ref<WorkSettingRow[]>([]);
const freeInput = ref(false);
const narratorForm = reactive({
  Narrator: '',
  NarratorCharaId: '',
  Monologue: false
});
const plotOptions = computed(() => [{
  value: '',
  label: ''
}, ...plots.value.filter(row => production.value === '0' || String(row.ProductionType || 0) === production.value).map(row => ({
  value: String(row.PlotId),
  label: String(row.PlotName)
}))]);
const characterOptions = computed(() => [{
  value: '',
  label: ''
}, ...characters.value.map(row => ({
  value: String(row.CharaId),
  label: String(row.CharaName)
}))]);

function changeProduction() {
  production.value = fields.getValue('ProductionType', '0');
  const id = fields.getValue('PlotId', '');
  if (!plotOptions.value.some(option => option.value === id)) fields.setValue('PlotId', '');
}

function changeFreeInput() {
  freeInput.value = fields.getValue('FreeInput', false);
}
const linkedOpen = ref(false);
const linkedRows = ref<WorkSettingRow[]>([]);
const linkedName = ref('');

async function showLinkedPlot() {
  if (!selected.value?.PlotId || busy.value) return;
  busy.value = true;
  try {
    const data = await spinner.run(() => props.request<Record<string, unknown>>('/GetPlotList.php?PlotId=' + encodeURIComponent(String(selected.value!.PlotId))));
    const result = requireSuccess(data, messageFormat('ERROR', 'E_0003', '関連プロットの取得'));
    if (!Array.isArray(result.PlotRowList)) throw new Error(messageFormat('ERROR', 'E_0026'));
    if (disposed) return;
    linkedRows.value = result.PlotRowList as WorkSettingRow[];
    linkedName.value = String((result.SelectedPlot as WorkSettingRow)?.PlotName || '');
    linkedOpen.value = true;
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '関連プロットの取得'));
  } finally {
    busy.value = false;
  }
}

async function editLinkedPlot() {
  if (!selected.value?.PlotId || busy.value) return;
  await navigateTo({
    ...workLocation('MenuPlot'),
    query: {
      menu: 'MenuPlot',
      parent: String(selected.value.PlotId),
      backStory: String(selected.value.StoryId)
    }
  });
}
const importField = ref<{
  getFiles: () => File[];
  setValue: (value: string) => void;
  openFilePicker: () => void;
}>();

async function importFile() {
  const file = importField.value?.getFiles()[0];
  importField.value?.setValue('');
  if (!file || !selected.value || busy.value || !canEdit.value) return;
  if (!/\.(txt|docx)$/i.test(file.name) || file.size > 2 * 1024 * 1024) {
    await props.dialogs.error(messageFormat('ERROR', 'E_0058'));
    return;
  }
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0020')))) return;
  try {
    const data = await fileAsBase64(file);
    await mutate('/ImportStory.php', {
      StoryId: selected.value.StoryId,
      FileName: file.name,
      FileData: data,
      UpdateDate: selected.value.UpdateDate
    }, '取込');
  } catch (error) {
    await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '取込'));
  }
}
</script>
<template>
  <div>
    <WorkContentHeader
      :title="selected ? String(selected.StoryName) : 'ストーリー作成'"
      icon="fa-book"
      :help-message="selected && canEdit ? messageFormat('INFO','I_0083') : undefined"
      help-image="/images/story-import-guide.png"
      :work-title="work?.WorkTitle"
      :role="work ? role : undefined"
    />
    <template v-if="!selected">
      <div
        v-if="canEdit"
        class="ButtonGroup MarginBottom20"
      >
        <ButtonComponent
          type="button"
          variant="PrimaryButton"
          @click="openInfo()"
        >
          <i
            class="fas fa-plus"
            aria-hidden="true"
          />
          ストーリー作成
        </ButtonComponent>
      </div>
      <div class="StoryFolderGrid">
        <FolderCard
          v-for="folder in folders"
          :key="String(folder.StoryId)"
          :title="String(folder.StoryName)"
          :badge="productionLabel(folder.ProductionType)"
          @open="load(folder.StoryId)"
        >
          <template
            v-if="canEdit"
            #actions
          >
            <ButtonComponent
              type="button"
              variant="SecondaryButton ButtonSmall"
              @click="copy(folder)"
            >
              <i
                class="fas fa-copy"
                aria-hidden="true"
              />
              コピー
            </ButtonComponent>
            <ButtonComponent
              type="button"
              variant="SecondaryButton ButtonSmall"
              @click="openInfo(folder)"
            >
              <i
                class="fas fa-pen"
                aria-hidden="true"
              />
              編集
            </ButtonComponent>
          </template>
        </FolderCard>
      </div>
    </template>
    <template v-else>
      <div class="ButtonGroup MarginBottom20">
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
        <ButtonComponent
          v-if="canEdit"
          type="button"
          variant="PrimaryButton"
          @click="openRow()"
        >
          <i
            class="fas fa-plus"
            aria-hidden="true"
          />
          追加
        </ButtonComponent>
        <ButtonComponent
          type="button"
          variant="SuccessButton"
          @click="exportOpen = true"
        >
          <i
            class="fas fa-file-export"
            aria-hidden="true"
          />
          出力
        </ButtonComponent>
        <ButtonComponent
          type="button"
          variant="SecondaryButton"
          :disabled="!selected.PlotId"
          @click="showLinkedPlot"
        >
          <i
            class="fas fa-sitemap"
            aria-hidden="true"
          />
          プロット表示
        </ButtonComponent>
        <ButtonComponent
          v-if="canEdit"
          type="button"
          variant="SaveButton"
          @click="importField?.openFilePicker()"
        >
          <i
            class="fas fa-file-import"
            aria-hidden="true"
          />
          取込
        </ButtonComponent>
        <TextFieldComponent
          ref="importField"
          type="file"
          accept=".txt,.docx"
          class="Hidden"
          @value-change="importFile"
        />
        <ButtonComponent
          v-if="canEdit"
          type="button"
          variant="DeleteButton"
          @click="removeRows(true)"
        >
          <i
            class="fas fa-trash"
            aria-hidden="true"
          />
          消去
        </ButtonComponent>
      </div>
      <div class="StoryListViewport">
        <div class="StoryList">
          <div
            v-for="(row,index) in rows"
            :key="String(row.StoryRowId)"
            class="StoryItem"
            :data-narrative-row="String(row.StoryRowId)"
            :class="{DragOver:touchTarget === String(row.StoryRowId)}"
            @click="openRow(row)"
            @dragover.prevent
            @drop.prevent="reorder(String(row.StoryRowId))"
          >
            <ButtonComponent
              v-if="canEdit"
              unstyled
              type="button"
              class="StoryDragHandle"
              title="並び替え"
              aria-label="並び替え"
              draggable="true"
              @click.stop
              @dragstart="beginDrag($event,row)"
              @dragend="dragged = null"
              @touchstart.stop="dragged = String(row.StoryRowId)"
              @touchmove="touchMove"
              @touchend="reorder(touchTarget)"
            >
              <i
                class="fa-solid fa-hand"
                aria-hidden="true"
              />
            </ButtonComponent>
            <div class="StoryNumber">{{ index+1 }}</div>
            <div class="StoryContent">
              <div class="StoryNarrator">{{ row.NarratorDisplay || messageFormat('INFO','I_0073') }}</div>
              <div class="StoryText">{{ row.Content }}</div>
            </div>
          </div>
          <p v-if="!rows.length">{{ messageFormat('INFO','I_0048') }}</p>
        </div>
      </div>
      <div class="ListFooter">
        <span class="RecordCount">
          {{ rows.length }}
          件
        </span>
      </div>
    </template>
    <BaseDialog
      v-model="infoOpen"
      :title="editingInfo ? 'ストーリー情報編集' : 'ストーリー作成'"
      size="DialogMedium"
    >
      <section
        :key="revision"
        class="FormSection"
      >
        <TextFieldComponent
          :ref="el => fields.register('Name',el,infoForm.Name)"
          label="ストーリー名"
          :maxlength="30"
          required
          :readonly="!canEdit"
          :error="errors.Name"
        />
        <SelectBoxComponent
          :ref="el => fields.register('ProductionType',el,infoForm.ProductionType)"
          label="制作区分"
          :options="productionOptions"
          :disabled="!canEdit"
          @value-change="changeProduction"
        />
        <SelectBoxComponent
          :ref="el => fields.register('PlotId',el,String(editingInfo?.PlotId || ''))"
          label="関連プロット"
          :error="errors.PlotId"
          :options="plotOptions"
          :disabled="!canEdit"
        />
      </section>
      <template #actions>
        <ButtonComponent
          type="button"
          variant="CloseButton"
          @click="infoOpen = false"
        >閉じる</ButtonComponent>
        <template v-if="canEdit">
          <ButtonComponent
            v-if="editingInfo"
            type="button"
            variant="DeleteButton"
            @click="removeInfo"
          >削除</ButtonComponent>
          <ButtonComponent
            v-if="!editingInfo && hasTemplate"
            type="button"
            variant="PrimaryButton"
            @click="saveInfo(true)"
          >テンプレートから作成</ButtonComponent>
          <ButtonComponent
            type="button"
            variant="SaveButton"
            @click="saveInfo(false)"
          >保存</ButtonComponent>
        </template>
      </template>
    </BaseDialog>
    <BaseDialog
      v-model="rowOpen"
      :title="editingRow ? 'ストーリー行編集' : 'ストーリー行追加'"
      size="DialogMedium"
    >
      <section
        :key="revision"
        class="FormSection"
      >
        <TextFieldComponent
          :ref="el => fields.register('IndexNum',el,rowForm.IndexNum)"
          label="並び順"
          numeric-only
          :maxlength="10"
          :readonly="!canEdit"
          required
          :error="errors.IndexNum"
        />
        <CheckBoxComponent
          :ref="el => fields.register('FreeInput',el,freeInput)"
          label="自由入力"
          :disabled="!canEdit"
          @value-change="changeFreeInput"
        />
        <CheckBoxComponent
          :ref="el => fields.register('Monologue',el,narratorForm.Monologue)"
          label="モノローグ"
          :disabled="!canEdit"
        />
        <TextFieldComponent
          v-show="freeInput"
          :ref="el => fields.register('Narrator',el,narratorForm.Narrator)"
          label="語り手"
          :readonly="!canEdit"
        />
        <SelectBoxComponent
          v-show="!freeInput"
          :ref="el => fields.register('NarratorCharaId',el,narratorForm.NarratorCharaId)"
          label="語り手"
          :options="characterOptions"
          :disabled="!canEdit"
        />
        <TextAreaComponent
          :ref="el => fields.register('Content',el,rowForm.Content)"
          label="内容"
          :readonly="!canEdit"
          required
          :error="errors.Content"
        />
      </section>
      <template #actions>
        <ButtonComponent
          type="button"
          variant="CloseButton"
          @click="rowOpen = false"
        >閉じる</ButtonComponent>
        <template v-if="canEdit">
          <ButtonComponent
            v-if="editingRow"
            type="button"
            variant="DeleteButton"
            @click="removeRows(false)"
          >削除</ButtonComponent>
          <ButtonComponent
            type="button"
            variant="SaveButton"
            @click="saveRow"
          >保存</ButtonComponent>
        </template>
      </template>
    </BaseDialog>
    <ExportSettingsDialog
      v-model="exportOpen"
      :show-items="false"
      @export="output"
    />
    <BaseDialog
      v-model="linkedOpen"
      title="関連プロット"
      size="DialogLarge"
    >
      <h3>{{ linkedName }}</h3>
      <div class="StoryList">
        <div
          v-for="(row,index) in linkedRows"
          :key="String(row.PlotRowId)"
          class="StoryItem"
        >
          <div class="StoryNumber">{{ index+1 }}</div>
          <div class="PlotRowContent">
            <span class="StoryText">{{ row.Content }}</span>
          </div>
        </div>
      </div>
      <template #actions>
        <ButtonComponent
          type="button"
          variant="CloseButton"
          @click="linkedOpen = false"
        >閉じる</ButtonComponent>
        <ButtonComponent
          type="button"
          variant="PrimaryButton"
          @click="editLinkedPlot"
        >
          <i
            class="fas fa-edit"
            aria-hidden="true"
          />
          プロット編集
        </ButtonComponent>
      </template>
    </BaseDialog>
  </div>
</template>
