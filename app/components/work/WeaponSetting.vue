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
  "WeaponName": "",
  "Description": ""
});
const canAdd = computed(() => initialized.value && !!work.value && (props.isAdmin || isCreator.value));
const canEdit = canAdd;
const dialogTitle = computed(() => '武器設定（' + (selected.value ? canEdit.value ? '編集' : '詳細' : '新規登録') + '）');
const role = computed(() => props.isAdmin ? '管理者' : isCreator.value ? '作成者' : 'アシスタント');
const images = ref<CharacterImage[]>([]);
const readingImages = ref(false);
const columns: TableColumn[] = [{
  "key": "Detail",
  "label": "詳細",
  "width": 90
}, {
  "key": "WeaponName",
  "label": "武器名",
  "sortable": true,
  "filterable": true
}, {
  "key": "Description",
  "label": "説明",
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
      const data = requireSuccess(await props.request<Record<string, WorkSettingRow[]>>('/GetWeaponList.php'), messageFormat('ERROR', 'E_0003', '武器設定の取得'));
      if (!Array.isArray(data?.WeaponList)) throw new Error(messageFormat('ERROR', 'E_0026'));
      if (disposed) return;
      rows.value = data.WeaponList;
      initialized.value = true;
    });
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '武器設定の取得'));
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
  form.WeaponName = String(row.WeaponName ?? '');
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
    "WeaponName": "",
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
  if (!values.WeaponName.trim()) errors.value.WeaponName = messageFormat('ERROR', 'E_0001', '武器名');
  if (values.WeaponName.length > 50) errors.value.WeaponName = messageFormat('ERROR', 'E_0002', '武器名', 50);
  const first = Object.keys(errors.value)[0];
  if (first) {
    await nextTick();
    fields.focus(first);
    return;
  }
  const payload: Record<string, unknown> = {
    ...values,
    WeaponId: selected.value?.WeaponId ?? null,
    UpdateDate: selected.value?.UpdateDate ?? null
  };
  payload.Images = imagePayload(fields.getValue('Images', [] as CharacterImage[]));
  await persist('/SaveWeapon.php', payload, '保存');
}

async function remove() {
  const row = selected.value;
  if (!row || !canEdit.value || saving.value || loading.value) return;
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'この武器設定を削除'))) || disposed) return;
  await persist('/DeleteWeapon.php', {
    WeaponId: row.WeaponId,
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
      requireSuccess(await props.request(endpoint, 'POST', payload), messageFormat('ERROR', 'E_0003', '武器設定の' + operation));
      if (!disposed) completed = true;
    });
    if (completed && !disposed) await props.dialogs.info(messageFormat('INFO', 'I_0011', operation), messageFormat('INFO', 'I_0001', '武器設定の' + operation));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '武器設定の' + operation));
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
    const target = rows.value.find(row => String(row.WeaponId) === props.targetId);
    if (target) selectRow(target);
  }
});
</script>

<template>
  <div>
    <WorkContentHeader
      title="武器設定"
      icon="fa-shield-alt"
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
      row-key="WeaponId"
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
          <TextFieldComponent
            :ref="el => fields.register('WeaponName', el, form.WeaponName)"
            label="武器名"
            :readonly="!canEdit"
            :error="errors.WeaponName"
            :maxlength="50"
            required
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
