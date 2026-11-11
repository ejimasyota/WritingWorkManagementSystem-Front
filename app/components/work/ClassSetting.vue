<script setup lang="ts">
import { useOperationSpinner } from '../../composables/useOperationSpinner';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import type { BackendRequest } from '../../types/backend';
import type { WorkInfo } from '../../types/work';
import type { WorkSettingRow } from '../../types/workSettings';
import type { PageDialogs } from '../../composables/usePageDialogs';
import { metadataColumns, type TableColumn } from '../../composables/tableData';
import { useInputFields } from '../../composables/useInputFields';
import { readWorkAccess } from '../../utils/workAccess';
import { requireSuccess, reportBackendError } from '../../utils/backend';
import { messageFormat } from '../../utils/messages';
const spinner = useOperationSpinner();
const props = defineProps<{
  request: BackendRequest;
  dialogs: PageDialogs;
  isAdmin: boolean;
  hideMeta?: boolean;
  targetId?: string;
  targetParentId?: string;
}>();
const work = ref<WorkInfo>();
const isCreator = ref(false);
const initialized = ref(false);
const loading = ref(false);
const saving = ref(false);
const selected = ref<WorkSettingRow | null>(null);
const rows = ref<WorkSettingRow[]>([]);
const fields = useInputFields();
const errors = ref<Record<string, string>>({});
const formRevision = ref(0);
const opened = ref(false);
const dialogTitle = computed(() => {
  let mode = '新規登録';
  if (selected.value) mode = canEdit.value ? '編集' : '詳細';
  return '階級設定（' + mode + '）';
});
const form = reactive({
  ClassName: '',
  OrgId: '',
  RankOrder: '',
  Description: ''
});
const canEdit = computed(() => initialized.value && !!work.value && (props.isAdmin || isCreator.value));
const role = computed(() => props.isAdmin ? '管理者' : isCreator.value ? '作成者' : 'アシスタント');
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
});
const organizations = ref<WorkSettingRow[]>([]);
const organizationOptions = computed(() => [{
  value: '',
  label: ''
}, ...organizations.value.map(row => ({
  value: String(row.OrgId),
  label: String(row.OrgName)
}))]);
const chartVisible = ref(false);
/** 組織ごとに分け、同じ序列は同じ段に並べる。序列未設定は末尾へ置く。 */
const hierarchy = computed(() => {
  const groups = new Map<string, {
    name: string;
    rows: WorkSettingRow[];
  }>();
  const common: WorkSettingRow[] = [];
  for (const row of rows.value) {
    if (!row.OrgId || !row.OrgName) {
      common.push(row);
      continue;
    }
    const key = String(row.OrgId);
    if (!groups.has(key)) groups.set(key, {
      name: String(row.OrgName),
      rows: []
    });
    groups.get(key)!.rows.push(row);
  }
  const source = Object.entries(Object.fromEntries(groups)).map(([key, group]) => ({
    key,
    name: group.name,
    rows: group.rows,
    icon: 'fa-building'
  }));
  if (common.length) source.unshift({
    key: '',
    name: '共通階級',
    rows: common,
    icon: 'fa-globe'
  });
  return source.map(group => {
    const ranks = new Map<string, WorkSettingRow[]>();
    for (const row of group.rows) {
      const rank = row.RankOrder == null || row.RankOrder === '' ? '' : String(row.RankOrder);
      if (!ranks.has(rank)) ranks.set(rank, []);
      ranks.get(rank)!.push(row);
    }
    const levels = [...ranks].sort(([left], [right]) => {
      if (left === '') return right === '' ? 0 : 1;
      if (right === '') return -1;
      return Number(left) - Number(right);
    }).map(([rank, items]) => ({
      rank,
      items
    }));
    return {
      ...group,
      levels
    };
  });
});
const columns: TableColumn[] = [{
  key: 'Detail',
  label: '詳細',
  width: 90
}, {
  key: 'ClassName',
  label: '階級名',
  sortable: true,
  filterable: true
}, {
  key: 'OrgName',
  label: '所属組織',
  sortable: true,
  filterable: true
}, {
  key: 'RankOrder',
  label: '序列',
  sortable: true,
  type: 'number'
}, {
  key: 'Description',
  label: '説明',
  sortable: true
}, ...metadataColumns()];

/** 初期表示と更新直前に作品・権限を確認する。別作品には編集中の値を送らない。 */


async function verifyAccess() {
  try {
    const access = await readWorkAccess(props.request, work.value?.WorkId);
    if (disposed) return false;
    work.value = access.work;
    isCreator.value = access.isCreator;
    return props.isAdmin || access.isCreator;
  } catch (error) {
    if (!disposed) {
      initialized.value = false;
      isCreator.value = false;
    }
    throw error;
  }
}

async function load() {
  if (disposed || loading.value || saving.value) return;
  loading.value = true;
  try {
    const finished = await spinner.run(async () => {
      await verifyAccess();
      if (disposed) return;
      const data = requireSuccess(await props.request<Record<string, WorkSettingRow[]>>('/GetClassList.php'), messageFormat('ERROR', 'E_0003', '階級一覧の取得'));
      if (!Array.isArray(data?.ClassList) || !Array.isArray(data?.OrganizationList)) throw new Error(messageFormat('ERROR', 'E_0026'));
      if (disposed) return;
      rows.value = data.ClassList!;
      organizations.value = data.OrganizationList!;
      initialized.value = true;
      return true;
    });
    if (!finished) return;
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '階級一覧の取得'));
  } finally {
    if (!disposed) loading.value = false;
  }
}

/** 選択行をコピーし、公開メソッドで入力部品へセットする。更新日時は読み込み直さない。 */


function selectRow(row: WorkSettingRow) {
  if (saving.value) return;
  selected.value = {
    ...row
  };
  Object.assign(form, {
    ClassName: String(row.ClassName ?? ''),
    OrgId: String(row.OrgId ?? ''),
    RankOrder: String(row.RankOrder ?? ''),
    Description: String(row.Description ?? '')
  });
  fields.setValues(form);
  errors.value = {};
  opened.value = true;
}

/** 入力値、選択ID、更新日時と補助入力の内部状態をまとめて初期化する。 */


function clear() {
  if (!canEdit.value || saving.value) return;
  selected.value = null;
  Object.assign(form, {
    ClassName: '',
    OrgId: '',
    RankOrder: '',
    Description: ''
  });
  fields.setValues(form);
  errors.value = {};
  formRevision.value++;
}

async function save() {
  if (!canEdit.value || saving.value || loading.value) return;
  const values = fields.getValues(form);
  errors.value = {};
  if (!values.ClassName.trim()) errors.value.ClassName = messageFormat('ERROR', 'E_0001', '階級名');
  if (values.ClassName.length > 30) errors.value.ClassName = messageFormat('ERROR', 'E_0002', '階級名', 30);
  if (values.RankOrder && !/^\d{1,3}$/.test(values.RankOrder)) errors.value.RankOrder = messageFormat('ERROR', 'E_0050', '序列', 3);
  const first = Object.keys(errors.value)[0];
  if (first) {
    await nextTick();
    fields.focus(first);
    return;
  }
  const payload: Record<string, unknown> = {
    ...values,
    ClassName: values.ClassName.trim(),
    ClassId: selected.value?.ClassId ?? null,
    UpdateDate: selected.value?.UpdateDate ?? null
  };
  saving.value = true;
  let completed = false;
  try {
    const finished = await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed) return;
      requireSuccess(await props.request('/SaveClass.php', 'POST', payload), messageFormat('ERROR', 'E_0003', '階級の保存'));
      if (disposed) return;
      completed = true;
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(messageFormat('INFO', 'I_0011', '保存'), messageFormat('INFO', 'I_0001', '階級情報の保存'));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '階級の保存'));
  } finally {
    if (!disposed) saving.value = false;
  }
  if (completed && !disposed) {
    close();
    clear();
    await load();
  }
}

async function remove() {
  const row = selected.value;
  if (!row || !canEdit.value || saving.value || loading.value) return;
  saving.value = true;
  let completed = false;
  try {
    if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'この階級を削除'))) || disposed) return;
    const finished = await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed) return;
      requireSuccess(await props.request('/DeleteClass.php', 'POST', {
        ClassId: row.ClassId,
        UpdateDate: row.UpdateDate
      }), messageFormat('ERROR', 'E_0003', '階級の削除'));
      if (disposed) return;
      completed = true;
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(messageFormat('INFO', 'I_0011', '削除'), messageFormat('INFO', 'I_0001', '階級の削除'));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '階級の削除'));
  } finally {
    if (!disposed) saving.value = false;
  }
  if (completed && !disposed) {
    clear();
    await load();
  }
}
/** 新規登録は入力状態を初期化してから同じダイアログを開く。 */


function openNew() {
  if (!canEdit.value || saving.value || loading.value) return;
  clear();
  opened.value = true;
}

function close() {
  opened.value = false;
}
onMounted(async () => {
  await load();
  if (!disposed && props.targetId) {
    const target = rows.value.find(row => String(row.ClassId) === props.targetId);
    if (target) selectRow(target);
  }
});
</script>

<template>
  <div>
    <WorkContentHeader
      title="階級設定"
      icon="fa-sitemap"
      :work-title="work?.WorkTitle"
      :role="work ? role : undefined"
    />
    <div
      v-if="canEdit"
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
    <div class="ButtonGroup">
      <ButtonComponent
        type="button"
        variant="SecondaryButton"
        :aria-pressed="chartVisible"
        @click="chartVisible = !chartVisible"
      >
        <i
          class="fas fa-sitemap"
          aria-hidden="true"
        />
        {{ chartVisible ? '一覧表示' : '組織図' }}
      </ButtonComponent>
    </div>
    <TableComponent
      v-show="!chartVisible"
      :rows="rows"
      :columns="columns"
      row-key="ClassId"
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
    <div
      v-if="chartVisible"
      id="ClassVisualArea"
    >
      <div
        v-if="!hierarchy.length"
        class="ClassChartEmpty"
      >
        <i
          class="fas fa-sitemap"
          aria-hidden="true"
        />
        <p>{{ messageFormat('INFO', 'I_0067') }}</p>
      </div>
      <div
        v-else
        class="ClassChart"
      >
        <div
          v-for="group in hierarchy"
          :key="group.key"
          class="ClassChartGroup"
        >
          <div class="ClassChartGroupTitle">
            <i
              class="fas"
              :class="group.icon"
              aria-hidden="true"
            />
            {{ group.name }}
          </div>
          <div class="ClassChartHierarchy">
            <div
              v-for="level in group.levels"
              :key="level.rank"
              class="ClassChartRankRow"
            >
              <div class="ClassChartRankLabel">{{ level.rank === '' ? '序列なし' : '序列 ' + level.rank }}</div>
              <div
                v-for="item in level.items"
                :key="String(item.ClassId)"
                class="ClassChartItem"
                :data-classid="item.ClassId"
                role="button"
                tabindex="0"
                @click="selectRow(item)"
                @keydown.enter.prevent="selectRow(item)"
                @keydown.space.prevent="selectRow(item)"
              >
                <div class="ClassChartNode">
                  <div class="ClassChartName">{{ item.ClassName }}</div>
                  <div
                    v-if="item.Description"
                    class="ClassChartDesc"
                  >{{ item.Description }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <BaseDialog
      v-model="opened"
      :title="dialogTitle"
      size="DialogLarge"
    >
      <section
        :key="formRevision"
        class="FormSection"
        :aria-label="selected ? '階級編集' : '階級新規登録'"
      >
        <h3 class="FormSectionTitle">基本</h3>
        <div class="FormGrid">
          <TextFieldComponent
            :ref="el => fields.register('ClassName', el, form.ClassName)"
            label="階級名"
            :readonly="!canEdit"
            :error="errors.ClassName"
            required
            :maxlength="30"
          />
          <SelectBoxComponent
            :ref="el => fields.register('OrgId', el, form.OrgId)"
            label="所属組織"
            :options="organizationOptions"
            :disabled="!canEdit"
            :error="errors.OrgId"
          />
          <TextFieldComponent
            :ref="el => fields.register('RankOrder', el, form.RankOrder)"
            label="序列"
            :readonly="!canEdit"
            :error="errors.RankOrder"
            :maxlength="3"
            numeric-only
            inputmode="numeric"
            info-icon-flg
            info-title="序列"
            :info-message="messageFormat('INFO', 'I_0065')"
          />
          <TextFieldComponent
            :ref="el => fields.register('Description', el, form.Description)"
            label="説明"
            :readonly="!canEdit"
            :error="errors.Description"
            text-area-flg
          />
        </div>
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
