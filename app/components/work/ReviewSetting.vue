<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, reactive, ref } from 'vue';
import { useOperationSpinner } from '../../composables/useOperationSpinner';
import { useInputFields } from '../../composables/useInputFields';
import { metadataColumns, type TableColumn } from '../../composables/tableData';
import type { BackendRequest } from '../../types/backend';
import type { WorkInfo } from '../../types/work';
import type { WorkSettingRow } from '../../types/workSettings';
import type { PageDialogs } from '../../composables/usePageDialogs';
import { readWorkAccess } from '../../utils/workAccess';
import { requireSuccess, reportBackendError } from '../../utils/backend';
import { messageFormat } from '../../utils/messages';
const props = defineProps<{
  request: BackendRequest;
  dialogs: PageDialogs;
  isAdmin: boolean;
  hideMeta?: boolean;
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
  "Evaluation": "0",
  "ReviewContent": ""
});
const auth = useAuthSession();
const owner = computed(() => !selected.value || String(selected.value.RegistUser) === auth.user.value?.UserId);
const canAdd = computed(() => initialized.value && !!work.value && (props.isAdmin || !isCreator.value));
const canEdit = computed(() => canAdd.value && owner.value);
const dialogTitle = computed(() => '作品レビュー（' + (selected.value ? canEdit.value ? '編集' : '詳細' : '新規登録') + '）');
const role = computed(() => props.isAdmin ? '管理者' : isCreator.value ? '作成者' : 'アシスタント');
const EvaluationOptions = [{
  value: '0',
  label: ''
}, {
  value: '1',
  label: '◎'
}, {
  value: '2',
  label: '〇'
}, {
  value: '3',
  label: '△'
}, {
  value: '4',
  label: '✕'
}];
const columns: TableColumn[] = [{
  "key": "Detail",
  "label": "詳細",
  "width": 90
}, {
  "key": "ReviewerName",
  "label": "レビュアー",
  "sortable": true,
  "filterable": true
}, {
  "key": "Evaluation",
  "format": value => EvaluationOptions.find(option => option.value === String(value))?.label || '',
  "label": "評価",
  "sortable": true,
  "filterable": true
}, {
  "key": "ReviewContent",
  "label": "内容",
  "sortable": true,
  "filterable": false
}, ...metadataColumns()];

/** 初期化と保存直前の権限確認は、この画面の作品IDに照合する。 */


async function verifyAccess() {
  try {
    const access = await readWorkAccess(props.request, work.value?.WorkId);
    if (disposed) return false;
    work.value = access.work;
    isCreator.value = access.isCreator;
    return props.isAdmin || !isCreator.value;
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
      const data = requireSuccess(await props.request<Record<string, WorkSettingRow[]>>('/GetReviewList.php', 'POST', {}), messageFormat('ERROR', 'E_0003', '作品レビューの取得'));
      if (!Array.isArray(data?.ReviewList)) throw new Error(messageFormat('ERROR', 'E_0026'));
      if (disposed) return;
      rows.value = data.ReviewList;
      initialized.value = true;
    });
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '作品レビューの取得'));
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
  form.Evaluation = String(row.Evaluation ?? 0);
  form.ReviewContent = String(row.ReviewContent ?? '');
  fields.setValues(form);
  errors.value = {};
  revision.value++;
  opened.value = true;
}

function clear() {
  if (saving.value) return;
  selected.value = null;
  Object.assign(form, {
    "Evaluation": "0",
    "ReviewContent": ""
  });
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
  if (!canEdit.value || saving.value || loading.value) return;
  const values = fields.getValues(form);
  errors.value = {};
  if (!values.Evaluation.trim() || values.Evaluation === '0') errors.value.Evaluation = messageFormat('ERROR', 'E_0001', '評価');
  if (!values.ReviewContent.trim()) errors.value.ReviewContent = messageFormat('ERROR', 'E_0001', 'レビュー内容');
  const first = Object.keys(errors.value)[0];
  if (first) {
    await nextTick();
    fields.focus(first);
    return;
  }
  const payload: Record<string, unknown> = {
    ...values,
    ReviewId: selected.value?.ReviewId ?? null,
    UpdateDate: selected.value?.UpdateDate ?? null
  };
  await persist('/SaveReview.php', payload, '保存');
}

async function remove() {
  const row = selected.value;
  if (!row || !canEdit.value || saving.value || loading.value) return;
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'この作品レビューを削除'))) || disposed) return;
  await persist('/DeleteReview.php', {
    ReviewId: row.ReviewId,
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
      requireSuccess(await props.request(endpoint, 'POST', payload), messageFormat('ERROR', 'E_0003', '作品レビューの' + operation));
      if (!disposed) completed = true;
    });
    if (completed && !disposed) await props.dialogs.info(messageFormat('INFO', 'I_0011', operation), messageFormat('INFO', 'I_0001', '作品レビューの' + operation));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '作品レビューの' + operation));
  } finally {
    if (!disposed) saving.value = false;
  }
  if (completed && !disposed) {
    close();
    await load();
  }
}
onMounted(load);
</script>

<template>
  <div>
    <WorkContentHeader
      title="作品レビュー"
      icon="fa-star"
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
    <TableComponent
      :rows="rows"
      :columns="columns"
      row-key="ReviewId"
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
          <SelectBoxComponent
            :ref="el => fields.register('Evaluation', el, form.Evaluation)"
            label="評価"
            :options="EvaluationOptions"
            :disabled="!canEdit"
            :error="errors.Evaluation"
            required
          />
          <TextFieldComponent
            :ref="el => fields.register('ReviewContent', el, form.ReviewContent)"
            label="レビュー内容"
            :readonly="!canEdit"
            :error="errors.ReviewContent"
            text-area-flg
            required
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
