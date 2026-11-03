<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { BackendRequest } from '../types/backend';
import type { PageDialogs } from '../composables/usePageDialogs';
import type { TableColumn, TableRow } from '../composables/tableData';
import { genreOptions } from '../utils/mainView';
import { reportBackendError, requireSuccess } from '../utils/backend';
const props = defineProps<{
  modelValue: boolean;
  template: TableRow | null;
  templates: TableRow[];
  request: BackendRequest;
  dialogs: PageDialogs;
}>();
const emit = defineEmits(['update:modelValue', 'changed']);
const genre = ref<string | number>('');
const division = ref<string | number>('');
const rows = ref<TableRow[]>([]);
const editingIndex = ref(-1);
const form = reactive({
  index: '',
  narrator: '',
  structure: 0 as string | number,
  content: '',
  freeInput: false,
  monologue: false
});
const errors = ref<Record<string, string>>({});
const editing = computed(() => !!props.template);
const isPlot = computed(() => Number(division.value) === 2);
const structures = ['', '起', '承', '転', '結'];
const divisionOptions = [{
  value: 1,
  label: 'ストーリー'
}, {
  value: 2,
  label: 'プロット'
}];
function availableDivisions(value: string | number) {
  if (!value) return [];
  const used = props.templates.filter(item => String(item.Genre) === String(value)).map(item => Number(item.DivisionType));
  return divisionOptions.filter(option => !used.includes(option.value));
}
const genres = computed(() => editing.value ? genreOptions : [{
  value: '',
  label: ''
}, ...genreOptions.filter(option => option.value !== 0 && availableDivisions(option.value).length)]);
const divisions = computed(() => [{
  value: '',
  label: ''
}, ...(editing.value ? divisionOptions : availableDivisions(genre.value))]);
const columns = computed<TableColumn[]>(() => [{
  key: 'IndexNum',
  label: '並び順'
}, isPlot.value ? {
  key: 'StructureType',
  label: '起承転結',
  format: value => structures[Number(value)] || '未設定'
} : {
  key: 'Narrator',
  label: '語り手',
  format: value => value || '未設定'
}, {
  key: 'Content',
  label: '内容',
  format: value => value || '未設定'
}]);
const displayRows = computed(() => rows.value.map((row, index) => ({
  ...row,
  _index: index
})));
function clearRow() {
  Object.assign(form, {
    index: '',
    narrator: '',
    structure: 0,
    content: '',
    freeInput: false,
    monologue: false
  });
  editingIndex.value = -1;
  errors.value = {};
}
watch(() => props.modelValue, open => {
  if (!open) return;
  genre.value = props.template ? Number(props.template.Genre) : '';
  division.value = props.template ? Number(props.template.DivisionType) : '';
  try {
    const text = props.template?.TemplateText;
    const parsed = typeof text === 'string' ? JSON.parse(text) : text;
    rows.value = parsed && Array.isArray(parsed.Rows) ? parsed.Rows.map((row: TableRow) => ({
      ...row
    })) : [];
  } catch {
    rows.value = [];
  }
  clearRow();
});
async function confirmDiscard() {
  return !rows.value.length || (await props.dialogs.confirm('区分が変わるため、入力済みのテンプレート行は破棄されます。\nよろしいですか？'));
}
async function changeGenre(value: string | number) {
  const previous = genre.value;
  genre.value = value;
  const keepsDivision = availableDivisions(value).some(option => String(option.value) === String(division.value));
  if (keepsDivision) return;
  if (!(await confirmDiscard())) {
    genre.value = previous;
    return;
  }
  division.value = '';
  rows.value = [];
  clearRow();
}
async function changeDivision(value: string | number) {
  const previous = division.value;
  division.value = value;
  if (!(await confirmDiscard())) {
    division.value = previous;
    return;
  }
  rows.value = [];
  clearRow();
}
function selectRow(row: TableRow) {
  editingIndex.value = Number(row._index);
  Object.assign(form, {
    index: String(row.IndexNum || ''),
    narrator: String(row.Narrator || ''),
    structure: Number(row.StructureType || 0),
    content: String(row.Content || ''),
    freeInput: !!row.FreeInput,
    monologue: !!row.Monologue
  });
  errors.value = {};
}
function applyRow() {
  errors.value = {};
  if (!form.index) errors.value.index = '並び順を入力してください';
  if (!form.content.trim()) errors.value.content = '内容を入力してください';
  if (isPlot.value && Number(form.structure) < 1) errors.value.structure = '起承転結を選択してください';
  if (Object.keys(errors.value).length) return;
  const common = {
    IndexNum: Number(form.index),
    Content: form.content
  };
  const row = isPlot.value ? {
    ...common,
    StructureType: Number(form.structure)
  } : {
    ...common,
    FreeInput: form.freeInput,
    Monologue: form.monologue,
    Narrator: form.narrator.trim()
  };
  if (editingIndex.value >= 0) rows.value[editingIndex.value] = row;else rows.value.push(row);
  rows.value.sort((left, right) => Number(left.StructureType || 0) - Number(right.StructureType || 0) || Number(left.IndexNum) - Number(right.IndexNum));
  clearRow();
}
async function removeRow() {
  if (editingIndex.value < 0 || !(await props.dialogs.confirm('この行を削除しますか？'))) return;
  rows.value.splice(editingIndex.value, 1);
  clearRow();
}
function close() {
  emit('update:modelValue', false);
}
async function save() {
  errors.value = {};
  if (!genre.value) errors.value.genre = 'ジャンルを入力してください';
  if (!division.value) errors.value.division = '区分を入力してください';
  if (Object.keys(errors.value).length) return;
  if (!rows.value.length) {
    await props.dialogs.error('テンプレートを1行以上登録してください');
    return;
  }
  try {
    requireSuccess(await props.request('/SaveTemplateMaster.php', 'POST', {
      TemplateId: props.template?.TemplateId || null,
      Genre: Number(genre.value),
      DivisionType: Number(division.value),
      TemplateRows: rows.value,
      UpdateDate: props.template?.UpdateDate || null
    }), '保存に失敗しました');
    await props.dialogs.info('保存完了', 'テンプレートを保存しました');
    close();
    emit('changed');
  } catch (error) {
    await reportBackendError(props.dialogs, error, '保存中にエラーが発生しました');
  }
}
async function remove() {
  if (!props.template) return;
  if (!(await props.dialogs.confirm('テンプレートを削除しますか？\n※すでに該当テンプレートを使用して作成された作品に関しては削除されません'))) return;
  try {
    requireSuccess(await props.request('/DeleteTemplateMaster.php', 'POST', {
      TemplateId: props.template.TemplateId,
      UpdateDate: props.template.UpdateDate
    }), '削除に失敗しました');
    await props.dialogs.info('削除完了', 'テンプレートを削除しました');
    close();
    emit('changed');
  } catch (error) {
    await reportBackendError(props.dialogs, error, '削除中にエラーが発生しました');
  }
}
</script>

<template>
  <BaseDialog
    :close-on-escape="false"
    :model-value="modelValue"
    :title="editing ? 'テンプレート編集' : 'テンプレート追加'"
    size="DialogLarge"
    @update:model-value="close"
  >
    <div class="DialogSection">
      <label class="DialogSectionTitle">
        基本
      </label>
      <div class="FormRow">
        <SelectBoxComponent
          :model-value="genre"
          label="ジャンル"
          :options="genres"
          :disabled="editing"
          :hide-list-button="editing"
          :required="!editing"
          :info-icon-flg="!editing"
          info-title="ジャンル"
          info-message="ストーリー・プロットの両方のテンプレートが登録済みのジャンルは表示されません"
          :error="errors.genre"
          @update:model-value="changeGenre"
        />
        <SelectBoxComponent
          :model-value="division"
          label="区分"
          :options="divisions"
          :disabled="editing"
          :hide-list-button="editing"
          :required="!editing"
          :info-icon-flg="!editing"
          info-title="区分"
          info-message="ジャンルを選択すると、そのジャンルでまだテンプレートが登録されていない区分のみが表示されます"
          :error="errors.division"
          @update:model-value="changeDivision"
        />
      </div>
    </div>
    <div class="DialogSection">
      <label class="DialogSectionTitle">
        テンプレート
        <i
          class="fas fa-info-circle ContentHeaderHelpIcon"
          role="button"
          tabindex="0"
          @click="dialogs.info('テンプレート', '行の入力項目は区分によって変わるため、区分を選択するまで行は追加できません')"
          @keydown.enter="dialogs.info('テンプレート', '行の入力項目は区分によって変わるため、区分を選択するまで行は追加できません')"
        />
      </label>
      <div v-if="!isPlot" class="TemplateStoryChecks">
        <label class="CheckboxWrapper">
          <input v-model="form.freeInput" type="checkbox">
          自由入力
        </label>
        <label class="CheckboxWrapper">
          <input v-model="form.monologue" type="checkbox">
          モノローグ
        </label>
      </div>
      <div class="FormRow">
        <TextFieldComponent
          v-model="form.index"
          label="並び順"
          numeric-only
          inputmode="numeric"
          maxlength="10"
          :error="errors.index"
          required
        />
        <SelectBoxComponent
          v-if="isPlot"
          v-model="form.structure"
          label="起承転結"
          :options="structures.map((label, value) => ({ label, value }))"
          :error="errors.structure"
          required
        />
        <TextFieldComponent v-else v-model="form.narrator" label="語り手" maxlength="255" />
      </div>
      <TextFieldComponent
        v-model="form.content"
        label="内容"
        text-area-flg
        :error="errors.content"
        required
      />
      <div class="ButtonGroup">
        <button type="button" class="ButtonClass ClearButton" @click="clearRow">
          <i class="fas fa-sync" />
          クリア
        </button>
        <button
          v-if="editingIndex >= 0"
          type="button"
          class="ButtonClass DeleteButton"
          @click="removeRow"
        >
          <i class="fas fa-trash" />
          行削除
        </button>
        <button
          type="button"
          class="ButtonClass PrimaryButton"
          :disabled="!division"
          @click="applyRow"
        >
          <i class="fas" :class="editingIndex >= 0 ? 'fa-check' : 'fa-plus'" />
          {{ editingIndex >= 0 ? '行更新' : '行追加' }}
        </button>
      </div>
    </div>
    <div class="DialogSection">
      <label class="DialogSectionTitle">
        テンプレート行
      </label>
      <TableComponent
        :rows="displayRows"
        :columns="columns"
        row-key="_index"
        :page-size="5"
        :scroll-top-on-page-change="false"
        row-clickable
        @row-click="selectRow"
      />
    </div>
    <template #actions>
      <button type="button" class="ButtonClass CloseButton" @click="close">
        <i class="fas fa-times" />
        閉じる
      </button>
      <button v-if="editing" type="button" class="ButtonClass DeleteButton" @click="remove">
        <i class="fas fa-trash" />
        削除
      </button>
      <button type="button" class="ButtonClass SaveButton" @click="save">
        <i class="fas fa-save" />
        保存
      </button>
    </template>
  </BaseDialog>
</template>
