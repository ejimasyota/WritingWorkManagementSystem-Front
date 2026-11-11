<script setup lang="ts">
import { buildHierarchy, descendantIds, hierarchyPath } from '../../utils/hierarchy';
import { computed, nextTick, onMounted, onBeforeUnmount, reactive, ref } from 'vue';
import { useOperationSpinner } from '../../composables/useOperationSpinner';
import { useInputFields } from '../../composables/useInputFields';
import { metadataColumns, type TableColumn } from '../../composables/tableData';
import type { BackendRequest } from '../../types/backend';
import type { WorkInfo } from '../../types/work';
import type { WorkSettingRow } from '../../types/workSettings';
import type { PageDialogs } from '../../composables/usePageDialogs';
import { readWorkAccess } from '../../utils/workAccess';
import { backendError, requireSuccess, reportBackendError } from '../../utils/backend';
import { messageFormat } from '../../utils/messages';
import type { CharacterImage } from '../../types/character';
import { restoreImages, imagePayload } from '../../utils/imageData';
const props = defineProps<{
  request: BackendRequest;
  dialogs: PageDialogs;
  isAdmin: boolean;
  hideMeta?: boolean;
  targetId?: string;
  targetParentId?: string;
}>();
const spinner = useOperationSpinner();
const fields = useInputFields();
const work = ref<WorkInfo>();
const isCreator = ref(false);
const initialized = ref(false);
const loading = ref(false);
const saving = ref(false);
const opened = ref(false);
const revision = ref(0);
const rows = ref<WorkSettingRow[]>([]);
const selected = ref<WorkSettingRow | null>(null);
const errors = ref<Record<string, string>>({});
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
});
const form = reactive({
  "StageName": "",
  "StageType": "",
  "ParentStageId": "",
  "Population": "",
  "AreaSize": "",
  "Description": ""
});
const canAdd = computed(() => initialized.value && !!work.value && (props.isAdmin || isCreator.value));
const canEdit = canAdd;
const dialogTitle = computed(() => '舞台設定（' + (selected.value ? canEdit.value ? '編集' : '詳細' : '新規登録') + '）');
const role = computed(() => props.isAdmin ? '管理者' : isCreator.value ? '作成者' : 'アシスタント');
const images = ref<CharacterImage[]>([]);
const readingImages = ref(false);
const treeVisible = ref(false);
const StageTypeOptions = [{
  value: '0',
  label: ''
}, {
  value: '1',
  label: '都市'
}, {
  value: '2',
  label: '村・集落'
}, {
  value: '4',
  label: '施設'
}, {
  value: '5',
  label: '自然'
}, {
  value: '6',
  label: '異界'
}, {
  value: '8',
  label: '国'
}, {
  value: '9',
  label: '地方'
}, {
  value: '7',
  label: 'その他'
}];

function stageType(value: unknown) {
  return StageTypeOptions.find(option => option.value === String(value))?.label || '';
}
const ParentStageIdOptions = computed(() => {
  const excluded = selected.value ? descendantIds(rows.value, 'StageId', 'ParentStageId', selected.value.StageId) : new Set();
  return [{
    value: '',
    label: ''
  }, ...rows.value.filter(row => !excluded.has(String(row.StageId))).map(row => ({
    value: String(row.StageId),
    label: hierarchyPath(rows.value, 'StageId', 'ParentStageId', 'StageName', row.StageId)
  })).sort((a, b) => a.label.localeCompare(b.label, 'ja'))];
});
const roots = computed(() => buildHierarchy([...rows.value].sort((a, b) => String(a.StageName).localeCompare(String(b.StageName), 'ja')), 'StageId', 'ParentStageId'));
const columns: TableColumn[] = [{
  "key": "Detail",
  "label": "詳細",
  "width": 90
}, {
  "key": "StageName",
  "label": "舞台名",
  "sortable": true,
  "filterable": true
}, {
  "key": "StageType",
  "format": value => stageType(value),
  "label": "舞台区分",
  "sortable": true,
  "filterable": true
}, {
  "key": "ParentPath",
  "format": (_value, row) => hierarchyPath(rows.value, 'StageId', 'ParentStageId', 'StageName', row.ParentStageId),
  "label": "上位舞台",
  "sortable": true,
  "filterable": true
}, {
  "key": "Population",
  "label": "人口",
  "sortable": true,
  "filterable": false
}, {
  "key": "AreaSize",
  "label": "面積",
  "sortable": true,
  "filterable": false
}, {
  "key": "Description",
  "label": "説明",
  "sortable": true,
  "filterable": false
}, ...metadataColumns().map(column => ({
  ...column,
  filterable: !column.key.endsWith('Date')
}))];

/** 初期化と保存直前の権限確認は、この画面の作品IDに照合する。 */


async function verifyAccess() {
  try {
    const access = await readWorkAccess(props.request, work.value?.WorkId);
    if (disposed) return false;
    work.value = access.work;
    isCreator.value = access.isCreator;
    return props.isAdmin || access.isCreator;
  } catch (error) {
    initialized.value = false;
    isCreator.value = false;
    throw error;
  }
}

async function load() {
  if (disposed || loading.value || saving.value) return;
  loading.value = true;
  try {
    await spinner.run(async () => {
      await verifyAccess();
      if (disposed) return;
      const data = requireSuccess(await props.request<Record<string, WorkSettingRow[]>>('/GetStageList.php'), messageFormat('ERROR', 'E_0003', '舞台設定の取得'));
      if (!Array.isArray(data?.StageList)) throw new Error(messageFormat('ERROR', 'E_0026'));
      if (disposed) return;
      rows.value = data.StageList;
      initialized.value = true;
    });
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '舞台設定の取得'));
  } finally {
    if (!disposed) loading.value = false;
  }
}

/** 行の更新日時を保持し、入力部品の公開メソッドへ初期値を渡す。 */


function selectRow(row: WorkSettingRow) {
  if (saving.value || loading.value) return;
  selected.value = {
    ...row
  };
  form.StageName = String(row.StageName ?? '');
  form.StageType = String(row.StageType ?? '');
  form.ParentStageId = String(row.ParentStageId ?? '');
  form.Population = String(row.Population ?? '');
  form.AreaSize = String(row.AreaSize ?? '');
  form.Description = String(row.Description ?? '');
  images.value = restoreImages(row);
  fields.setValues(form);
  errors.value = {};
  revision.value++;
  opened.value = true;
}

function clear() {
  if (saving.value) return;
  selected.value = null;
  Object.assign(form, {
    "StageName": "",
    "StageType": "",
    "ParentStageId": "",
    "Population": "",
    "AreaSize": "",
    "Description": ""
  });
  images.value = [];
  fields.setValues(form);
  errors.value = {};
  revision.value++;
}

function openNew() {
  if (!canAdd.value || saving.value || loading.value) return;
  clear();
  opened.value = true;
}

function close() {
  if (saving.value) return;
  opened.value = false;
  clear();
}

async function save() {
  if (!canEdit.value || saving.value || loading.value || readingImages.value) return;
  const values = fields.getValues(form);
  errors.value = {};
  if (!values.StageName.trim()) errors.value.StageName = messageFormat('ERROR', 'E_0001', '舞台名');
  if (values.StageName.length > 30) errors.value.StageName = messageFormat('ERROR', 'E_0002', '舞台名', 30);
  if (values.Population.length > 15) errors.value.Population = messageFormat('ERROR', 'E_0002', '人口', 15);
  if (values.Population && !/^\d{1,15}$/.test(values.Population)) errors.value.Population = messageFormat('ERROR', 'E_0050', '人口', 15);
  if (values.AreaSize.length > 15) errors.value.AreaSize = messageFormat('ERROR', 'E_0002', '面積', 15);
  const first = Object.keys(errors.value)[0];
  if (first) {
    await nextTick();
    fields.focus(first);
    return;
  }
  const payload: Record<string, unknown> = {
    ...values,
    StageId: selected.value?.StageId ?? null,
    UpdateDate: selected.value?.UpdateDate ?? null
  };
  payload.Images = imagePayload(fields.getValue('Images', [] as CharacterImage[]));
  await persist('/SaveStage.php', payload, '保存');
}

async function remove() {
  const row = selected.value;
  if (!row || !canEdit.value || saving.value || loading.value) return;
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'この舞台設定を削除'))) || disposed) return;
  await persist('/DeleteStage.php', {
    StageId: row.StageId,
    UpdateDate: row.UpdateDate
  }, '削除');
}
/** 1操作につき1回のスピナー。保存失敗時は入力と選択行を保持する。 */


async function persist(endpoint: string, payload: Record<string, unknown>, operation: string) {
  if (saving.value || disposed || !canEdit.value) return;
  saving.value = true;
  let completed = false;
  try {
    await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed || !canEdit.value) return;
      requireSuccess(await props.request(endpoint, 'POST', payload), messageFormat('ERROR', 'E_0003', '舞台設定の' + operation));
      if (!disposed) completed = true;
    });
    if (completed && !disposed) await props.dialogs.info(messageFormat('INFO', 'I_0011', operation), messageFormat('INFO', 'I_0001', '舞台設定の' + operation));
  } catch (error) {
    if (!disposed) {
      const data = error instanceof backendError && error.data && typeof error.data === 'object' ? error.data as Record<string, unknown> : null;
      const key = ({
        StagePopulation: 'Population',
        StageParentId: 'ParentStageId',
        StageName: 'StageName'
      } as Record<string, string>)[String(data?.FieldId || '')];
      if (key && error instanceof Error) {
        errors.value[key] = error.message;
        await nextTick();
        fields.focus(key);
      } else await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '舞台設定の' + operation));
    }
  } finally {
    if (!disposed) saving.value = false;
  }
  if (completed && !disposed) {
    close();
    await load();
  }
}
onMounted(async () => {
  await load();
  if (!disposed && props.targetId) {
    const target = rows.value.find(row => String(row.StageId) === props.targetId);
    if (target) selectRow(target);
  }
});
</script>

<template>
  <div>
    <WorkContentHeader
      title="舞台設定"
      icon="fa-map-marked-alt"
      :work-title="work?.WorkTitle"
      :role="work ? role : undefined"
    />
    <div
      v-if="canAdd"
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
    <div class="ButtonGroup ViewToggleButtonGroup">
      <ButtonComponent
        type="button"
        variant="SecondaryButton"
        @click="treeVisible = !treeVisible"
      >
        <i
          :class="treeVisible ? 'fas fa-table' : 'fas fa-sitemap'"
          aria-hidden="true"
        />
        {{ treeVisible ? '一覧表示' : 'ツリー表示' }}
      </ButtonComponent>
    </div>
    <div v-show="!treeVisible">
      <TableComponent
        :rows="rows"
        :columns="columns"
        row-key="StageId"
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
    </div>
    <div
      v-if="treeVisible"
      class="StageTreeArea"
    >
      <div class="ClassChart">
        <div
          v-for="node in roots"
          :key="node.key"
          class="ClassChartGroup"
        >
          <div
            class="ClassChartGroupTitle ClassChartItem StageTreeRootTitle"
            role="button"
            tabindex="0"
            @click="selectRow(node.row as WorkSettingRow)"
            @keydown.enter="selectRow(node.row as WorkSettingRow)"
          >
            <i
              class="fas fa-map-marked-alt"
              aria-hidden="true"
            />
            <span
              v-if="stageType(node.row.StageType)"
              class="StageTreeRootType"
            >{{ stageType(node.row.StageType) }}</span>
            <span class="StageTreeRootName">{{ node.row.StageName }}</span>
          </div>
          <HierarchyBranch
            :nodes="node.children"
            children-class="StageTreeChildren"
          >
            <template #default="{node:child}">
              <div
                class="ClassChartItem"
                role="button"
                tabindex="0"
                @click="selectRow(child.row as WorkSettingRow)"
                @keydown.enter="selectRow(child.row as WorkSettingRow)"
              >
                <div class="ClassChartNode">
                  <div
                    v-if="stageType(child.row.StageType)"
                    class="ClassChartRank"
                  >{{ stageType(child.row.StageType) }}</div>
                  <div class="ClassChartName">{{ child.row.StageName }}</div>
                </div>
              </div>
            </template>
          </HierarchyBranch>
          <div
            v-if="!node.children.length"
            class="ClassChartHierarchy"
          >
            <div class="ClassChartDesc">{{ messageFormat('INFO','I_0070') }}</div>
          </div>
        </div>
      </div>
      <p v-if="!roots.length">{{ messageFormat('INFO','I_0048') }}</p>
    </div>
    <BaseDialog
      v-model="opened"
      :title="dialogTitle"
      size="DialogLarge"
    >
      <section
        :key="revision"
        class="FormSection"
      >
        <h3 class="FormSectionTitle">基本</h3>
        <div class="FormGrid">
          <TextFieldComponent
            :ref="el => fields.register('StageName', el, form.StageName)"
            label="舞台名"
            :readonly="!canEdit"
            :error="errors.StageName"
            :maxlength="30"
            required
          />
          <SelectBoxComponent
            :ref="el => fields.register('StageType', el, form.StageType)"
            label="舞台区分"
            :options="StageTypeOptions"
            :disabled="!canEdit"
            :error="errors.StageType"
          />
          <SelectBoxComponent
            :ref="el => fields.register('ParentStageId', el, form.ParentStageId)"
            label="親舞台"
            info-icon-flg
            :info-message="messageFormat('INFO','I_0084')"
            :options="ParentStageIdOptions"
            :disabled="!canEdit"
            :error="errors.ParentStageId"
          />
          <TextFieldComponent
            :ref="el => fields.register('Population', el, form.Population)"
            label="人口"
            info-icon-flg
            :info-message="messageFormat('INFO','I_0085')"
            :readonly="!canEdit"
            :error="errors.Population"
            :maxlength="15"
            numeric-only
            inputmode="numeric"
          />
          <TextFieldComponent
            :ref="el => fields.register('AreaSize', el, form.AreaSize)"
            label="面積"
            :readonly="!canEdit"
            :error="errors.AreaSize"
            :maxlength="15"
            type="number"
            min="0"
            max="999999999999999"
          />
          <TextFieldComponent
            :ref="el => fields.register('Description', el, form.Description)"
            label="説明"
            :readonly="!canEdit"
            :error="errors.Description"
            text-area-flg
          />
        </div>
        <section class="FormSection">
          <h3 class="FormSectionTitle">画像</h3>
          <ImageListEditor
            :ref="el => fields.register('Images', el, images)"
            :readonly="!canEdit"
            :dialogs="dialogs"
            @reading="value => readingImages = value"
          />
        </section>
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
      </template>
    </BaseDialog>
  </div>
</template>
