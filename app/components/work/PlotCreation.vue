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
  backStoryId?: string;
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
  const endpoint = '/GetPlotList.php' + (id ? '?PlotId=' + encodeURIComponent(String(id)) : '');
  const data = requireSuccess(await props.request<Record<string, unknown>>(endpoint), messageFormat('ERROR', 'E_0003', 'プロットの取得'));
  if (!Array.isArray(data?.PlotList) || !Array.isArray(data.PlotRowList)) throw new Error(messageFormat('ERROR', 'E_0026'));
  if (disposed) return;
  folders.value = data.PlotList as WorkSettingRow[];
  selected.value = id ? data.SelectedPlot as WorkSettingRow : null;
  rows.value = data.PlotRowList as WorkSettingRow[];
  hasTemplate.value = data.HasTemplate === true;
  rows.value.sort((a, b) => Number(a.StructureType || 0) - Number(b.StructureType || 0) || Number(a.IndexNum) - Number(b.IndexNum));
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
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'プロットの取得'));
  } finally {
    busy.value = false;
  }
}
/** 成功時にだけ編集ダイアログを閉じる。行のUpdateDateは開いた時点のものを送る。 */


async function mutate(endpoint: string, payload: Record<string, unknown>, operation: string, folderId: unknown = selected.value?.PlotId ?? null) {
  if (!canEdit.value || busy.value || disposed) return false;
  busy.value = true;
  let completed = false;
  try {
    await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed) return;
      requireSuccess(await props.request(endpoint, 'POST', payload), messageFormat('ERROR', 'E_0003', 'プロットの' + operation));
      completed = true;
      await read(folderId);
    });
    if (completed && !disposed) await props.dialogs.info(messageFormat('INFO', 'I_0011', operation), messageFormat('INFO', 'I_0001', 'プロットの' + operation));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'プロットの' + operation));
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
  infoForm.Name = String(row?.PlotName || '');
  infoForm.ProductionType = String(row?.ProductionType || '0');
  production.value = infoForm.ProductionType;
  fields.setValues(infoForm);
  errors.value = {};
  revision.value++;
  infoOpen.value = true;
}

async function saveInfo(applyTemplate = false) {
  if (!canEdit.value || busy.value) return;
  const values = fields.getValues(infoForm);
  errors.value = {};
  if (!values.Name.trim()) errors.value.Name = messageFormat('ERROR', 'E_0001', 'プロット名');
  if (values.Name.length > 30) errors.value.Name = messageFormat('ERROR', 'E_0002', 'プロット名', 30);
  if (Object.keys(errors.value).length) {
    fields.focus('Name');
    return;
  }
  if (applyTemplate && !(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0017', 'プロット')))) return;
  const payload: Record<string, unknown> = {
    Mode: 'info',
    PlotId: editingInfo.value?.PlotId ?? null,
    PlotName: values.Name.trim(),
    ProductionType: values.ProductionType,
    ApplyTemplate: applyTemplate,
    UpdateDate: editingInfo.value?.UpdateDate ?? null
  };
  if (await mutate('/SavePlot.php', payload, '保存', null)) infoOpen.value = false;
}
/** 行の入力はダイアログで編集する。親情報と行情報の更新日時を混同しない。 */


function openRow(row: WorkSettingRow | null = null) {
  if (!selected.value || busy.value) return;
  editingRow.value = row ? {
    ...row
  } : null;
  rowForm.IndexNum = row ? String(rows.value.filter(item => Number(item.StructureType || 0) === Number(row.StructureType || 0)).findIndex(item => String(item.PlotRowId) === String(row.PlotRowId)) + 1) : '';
  rowForm.Content = String(row?.Content || '');
  fields.setValues(rowForm);
  fields.setValue('StructureType', String(row?.StructureType || '0'));
  errors.value = {};
  revision.value++;
  rowOpen.value = true;
}

async function saveRow() {
  if (!canEdit.value || !selected.value || busy.value) return;
  const values = fields.getValues(rowForm);
  errors.value = {};
  if (!values.Content.trim()) errors.value.Content = messageFormat('ERROR', 'E_0001', '内容');
  const structure = Number(fields.getValue('StructureType', '0'));
  const groupSize = rows.value.filter(row => Number(row.StructureType || 0) === structure && String(row.PlotRowId) !== String(editingRow.value?.PlotRowId)).length;
  if (structure < 1 || structure > 4) errors.value.StructureType = messageFormat('ERROR', 'E_0054', '起承転結');
  if (!/^[1-9][0-9]{0,9}$/.test(values.IndexNum) || Number(values.IndexNum) > groupSize + 1) errors.value.IndexNum = messageFormat('ERROR', 'E_0073');
  if (Object.keys(errors.value).length) {
    fields.focus(Object.keys(errors.value)[0]!);
    return;
  }
  const payload: Record<string, unknown> = {
    ...values,
    Mode: 'row',
    PlotId: selected.value.PlotId,
    PlotRowId: editingRow.value?.PlotRowId ?? null,
    UpdateDate: editingRow.value?.UpdateDate ?? null
  };
  payload.StructureType = fields.getValue('StructureType', '0');
  if (await mutate('/SavePlot.php', payload, '保存')) rowOpen.value = false;
}

async function removeInfo() {
  const row = editingInfo.value;
  if (!row || !canEdit.value || busy.value) return;
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'このプロットを削除')))) return;
  if (await mutate('/DeletePlot.php', {
    Mode: 'info',
    PlotId: row.PlotId,
    UpdateDate: row.UpdateDate
  }, '削除', null)) infoOpen.value = false;
}

async function removeRows(all = false) {
  const row = all ? selected.value : editingRow.value;
  if (!row || !selected.value || !canEdit.value || busy.value) return;
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', all ? '全ての行を削除' : 'この行を削除')))) return;
  if (await mutate('/DeletePlot.php', {
    Mode: 'row',
    PlotId: selected.value.PlotId,
    PlotRowId: all ? null : row.PlotRowId,
    UpdateDate: row.UpdateDate
  }, '削除')) rowOpen.value = false;
}

async function copy(row: WorkSettingRow) {
  if (!canEdit.value || busy.value || !(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0018', 'プロット')))) return;
  await mutate('/CopyPlot.php', {
    PlotId: row.PlotId,
    UpdateDate: row.UpdateDate
  }, 'コピー', null);
}

async function output(settings: ExportSettings) {
  const folder = selected.value;
  if (!folder || busy.value) return;
  if (!rows.value.length) {
    await props.dialogs.error(messageFormat('ERROR', 'E_0057', 'プロット'));
    return;
  }
  busy.value = true;
  try {
    const data = await spinner.run(async () => {
      await verifyAccess();
      if (disposed) return;
      return requireSuccess(await props.request<DownloadData>('/ExportPlot.php', 'POST', {
        ...settings,
        PlotId: folder.PlotId
      }), messageFormat('ERROR', 'E_0003', 'プロットの出力'));
    });
    if (data && !disposed) {
      downloadBase64(data);
      exportOpen.value = false;
    }
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'プロットの出力'));
  } finally {
    busy.value = false;
  }
}

function beginDrag(event: DragEvent, row: WorkSettingRow) {
  if (!canEdit.value) return;
  dragged.value = String(row.PlotRowId);
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
  const sourceIndex = rows.value.findIndex(row => String(row.PlotRowId) === from);
  const targetIndex = rows.value.findIndex(row => String(row.PlotRowId) === target);
  if (sourceIndex < 0 || targetIndex < 0) return;
  if (Number(rows.value[sourceIndex]?.StructureType || 0) !== Number(rows.value[targetIndex]?.StructureType || 0)) {
    await props.dialogs.error(messageFormat('ERROR', 'E_0059'));
    return;
  }
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0019', 'プロット')))) return;
  const order = [...rows.value];
  const moved = order.splice(sourceIndex, 1)[0]!;
  order.splice(targetIndex, 0, moved);
  await mutate('/UpdatePlotOrder.php', {
    PlotId: selected.value.PlotId,
    UpdateDate: selected.value.UpdateDate,
    OrderList: order.map((row, index) => ({
      PlotRowId: row.PlotRowId,
      IndexNum: index + 1,
      StructureType: Number(row.StructureType) || 0
    }))
  }, '並び順の更新');
}
onMounted(async () => {
  await load(props.targetParentId || null);
  if (!disposed && props.targetId) {
    const row = rows.value.find(row => String(row.PlotRowId) === props.targetId);
    if (row) openRow(row);
  }
});

function changeStructure() {
  if (editingRow.value) return;
  const type = Number(fields.getValue('StructureType', '0'));
  fields.setValue('IndexNum', type ? String(rows.value.filter(row => Number(row.StructureType || 0) === type).length + 1) : '');
}

async function back() {
  if (props.backStoryId) {
    await navigateTo({
      ...workLocation('MenuStory'),
      query: {
        menu: 'MenuStory',
        parent: props.backStoryId
      }
    });
    return;
  }
  await load();
}
const structureOptions = [{
  value: '0',
  label: ''
}, {
  value: '1',
  label: '起'
}, {
  value: '2',
  label: '承'
}, {
  value: '3',
  label: '転'
}, {
  value: '4',
  label: '結'
}];
const groups = computed(() => [1, 2, 3, 4, 0].map(type => ({
  type,
  label: structureOptions[type]?.label || messageFormat('INFO', 'I_0072'),
  rows: rows.value.filter(row => Number(row.StructureType || 0) === type)
})).filter(group => group.rows.length));

function structureClass(type: number) {
  return ['', 'ki', 'sho', 'ten', 'ketsu'][type];
}
</script>
<template>
  <div>
    <WorkContentHeader
      :title="selected ? String(selected.PlotName) : 'プロット作成'"
      icon="fa-sitemap"
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
          variant="PrimaryButton"
          @click="openInfo()"
        >
          <i
            class="fas fa-plus"
            aria-hidden="true"
          />
          プロット作成
        </ButtonComponent>
      </div>
      <div class="StoryFolderGrid">
        <FolderCard
          v-for="folder in folders"
          :key="String(folder.PlotId)"
          :title="String(folder.PlotName)"
          :badge="productionLabel(folder.ProductionType)"
          @open="load(folder.PlotId)"
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
          @click="back"
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
            v-for="group in groups"
            :key="group.type"
            class="PlotSection"
          >
            <div class="PlotSectionHeader">
              <span
                class="PlotBadge"
                :class="structureClass(group.type)"
              >{{ group.label }}</span>
            </div>
            <div
              v-for="(row,index) in group.rows"
              :key="String(row.PlotRowId)"
              class="StoryItem"
              :data-narrative-row="String(row.PlotRowId)"
              :class="{DragOver:touchTarget === String(row.PlotRowId)}"
              @click="openRow(row)"
              @dragover.prevent
              @drop.prevent="reorder(String(row.PlotRowId))"
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
                @touchstart.stop="dragged = String(row.PlotRowId)"
                @touchmove="touchMove"
                @touchend="reorder(touchTarget)"
              >
                <i
                  class="fa-solid fa-hand"
                  aria-hidden="true"
                />
              </ButtonComponent>
              <div class="StoryNumber">{{ index+1 }}</div>
              <div class="PlotRowContent">
                <span class="StoryText">{{ row.Content }}</span>
              </div>
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
      :title="editingInfo ? 'プロット情報編集' : 'プロット作成'"
      size="DialogMedium"
    >
      <section
        :key="revision"
        class="FormSection"
      >
        <TextFieldComponent
          :ref="el => fields.register('Name',el,infoForm.Name)"
          label="プロット名"
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
      :title="editingRow ? 'プロット行編集' : 'プロット行追加'"
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
        <SelectBoxComponent
          :ref="el => fields.register('StructureType',el,String(editingRow?.StructureType || '0'))"
          label="起承転結"
          required
          :error="errors.StructureType"
          @value-change="changeStructure"
          :options="structureOptions"
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
  </div>
</template>
