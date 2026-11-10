<script setup lang="ts">
import { useOperationSpinner } from '../composables/useOperationSpinner';

import { messageFormat } from '../utils/messages';

import { useInputFields } from '../composables/useInputFields';
import { computed, reactive, ref, watch } from 'vue';
import type { BackendRequest } from '../types/backend';
import type { PageDialogs } from '../composables/usePageDialogs';
import type { TableColumn, TableRow } from '../composables/tableData';
import { genreOptions } from '../utils/mainView';
import { reportBackendError, requireSuccess } from '../utils/backend';
const spinner = useOperationSpinner();


const inputFields = useInputFields();
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
  inputFields.setValues(form);
  editingIndex.value = -1;
  errors.value = {};
}
watch(() => props.modelValue, open => {
  if (!open) return;
  genre.value = props.template ? Number(props.template.Genre) : '';
  division.value = props.template ? Number(props.template.DivisionType) : '';
  inputFields.setValues({ genre: genre.value, division: division.value });
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
  return !rows.value.length || (await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0003')));
}
async function changeGenre() {
  const value = inputFields.getValue<string | number>('genre', '');
  const previous = genre.value;
  genre.value = value;
  const keepsDivision = availableDivisions(value).some(option => String(option.value) === String(division.value));
  if (keepsDivision) return;
  if (!(await confirmDiscard())) {
    genre.value = previous;
    inputFields.setValue('genre', previous);
    return;
  }
  division.value = '';
  inputFields.setValue('division', '');
  rows.value = [];
  clearRow();
}
async function changeDivision() {
  const value = inputFields.getValue<string | number>('division', '');
  const previous = division.value;
  division.value = value;
  if (!(await confirmDiscard())) {
    division.value = previous;
    inputFields.setValue('division', previous);
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
  inputFields.setValues(form);
  errors.value = {};
}
function applyRow() {
  Object.assign(form, inputFields.getValues(form));
  errors.value = {};
  if (!form.index) errors.value.index = messageFormat('ERROR', 'E_0001', '並び順');
  if (!form.content.trim()) errors.value.content = messageFormat('ERROR', 'E_0001', '内容');
  if (isPlot.value && Number(form.structure) < 1) errors.value.structure = messageFormat('ERROR', 'E_0021');
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
  if (editingIndex.value < 0 || !(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'この行を削除')))) return;
  rows.value.splice(editingIndex.value, 1);
  clearRow();
}
function close() {
  emit('update:modelValue', false);
}
async function save() {
  genre.value = inputFields.getValue<string | number>('genre', '');
  division.value = inputFields.getValue<string | number>('division', '');
  errors.value = {};
  if (!genre.value) errors.value.genre = messageFormat('ERROR', 'E_0001', 'ジャンル');
  if (!division.value) errors.value.division = messageFormat('ERROR', 'E_0001', '区分');
  if (Object.keys(errors.value).length) return;
  if (!rows.value.length) {
    await props.dialogs.error(messageFormat('ERROR', 'E_0022'));
    return;
  }
  try {
    const finished = await spinner.run(async () => {
      requireSuccess(await props.request('/SaveTemplateMaster.php', 'POST', {
        TemplateId: props.template?.TemplateId || null,
        Genre: Number(genre.value),
        DivisionType: Number(division.value),
        TemplateRows: rows.value,
        UpdateDate: props.template?.UpdateDate || null
      }), messageFormat('ERROR', 'E_0003', '保存'));
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(messageFormat('INFO', 'I_0011', '保存'), messageFormat('INFO', 'I_0001', 'テンプレートの保存'));
    close();
    emit('changed');
  } catch (error) {
    await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '保存'));
  }
}
async function remove() {
  if (!props.template) return;
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0004')))) return;
  try {
    const finished = await spinner.run(async () => {
      requireSuccess(await props.request('/DeleteTemplateMaster.php', 'POST', {
        TemplateId: props.template.TemplateId,
        UpdateDate: props.template.UpdateDate
      }), messageFormat('ERROR', 'E_0003', '削除'));
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(messageFormat('INFO', 'I_0011', '削除'), messageFormat('INFO', 'I_0001', 'テンプレートの削除'));
    close();
    emit('changed');
  } catch (error) {
    await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '削除'));
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
          :ref="el => inputFields.register('genre', el, genre)"
          label="ジャンル"
          :options="genres"
          :disabled="editing"
          :hide-list-button="editing"
          :required="!editing"
          :info-icon-flg="!editing"
          info-title="ジャンル"
          :info-message="messageFormat('INFO', 'I_0014')"
          :error="errors.genre"
          @value-change="changeGenre"
        />
        <SelectBoxComponent
          :ref="el => inputFields.register('division', el, division)"
          label="区分"
          :options="divisions"
          :disabled="editing"
          :hide-list-button="editing"
          :required="!editing"
          :info-icon-flg="!editing"
          info-title="区分"
          :info-message="messageFormat('INFO', 'I_0015')"
          :error="errors.division"
          @value-change="changeDivision"
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
          @click="dialogs.info(messageFormat('INFO', 'I_0016'), messageFormat('INFO', 'I_0017'))"
          @keydown.enter="dialogs.info(messageFormat('INFO', 'I_0016'), messageFormat('INFO', 'I_0017'))"
        />
      </label>
      <div v-if="!isPlot" class="TemplateStoryChecks">
        <CheckBoxComponent :ref="el => inputFields.register('freeInput', el, form.freeInput)" inline>自由入力</CheckBoxComponent>
        <CheckBoxComponent :ref="el => inputFields.register('monologue', el, form.monologue)" inline>モノローグ</CheckBoxComponent>
      </div>
      <div class="FormRow">
        <TextFieldComponent
          :ref="el => inputFields.register('index', el, form.index)"
          label="並び順"
          numeric-only
          inputmode="numeric"
          maxlength="10"
          :error="errors.index"
          required
        />
        <SelectBoxComponent
          v-if="isPlot"
          :ref="el => inputFields.register('structure', el, form.structure)"
          label="起承転結"
          :options="structures.map((label, value) => ({ label, value }))"
          :error="errors.structure"
          required
        />
        <TextFieldComponent v-else :ref="el => inputFields.register('narrator', el, form.narrator)" label="語り手" maxlength="255" />
      </div>
      <TextFieldComponent
        :ref="el => inputFields.register('content', el, form.content)"
        label="内容"
        text-area-flg
        :error="errors.content"
        required
      />
      <div class="ButtonGroup">
        <ButtonComponent type="button" variant="ClearButton" @click="clearRow">
          <i class="fas fa-sync" />
          クリア
        </ButtonComponent>
        <ButtonComponent
          v-if="editingIndex >= 0"
          type="button"
          variant="DeleteButton"
          @click="removeRow"
        >
          <i class="fas fa-trash" />
          行削除
        </ButtonComponent>
        <ButtonComponent
          type="button"
          variant="PrimaryButton"
          :disabled="!division"
          @click="applyRow"
        >
          <i class="fas" :class="editingIndex >= 0 ? 'fa-check' : 'fa-plus'" />
          {{ editingIndex >= 0 ? '行更新' : '行追加' }}
        </ButtonComponent>
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
      <ButtonComponent type="button" variant="CloseButton" @click="close">
        <i class="fas fa-times" />
        閉じる
      </ButtonComponent>
      <ButtonComponent v-if="editing" type="button" variant="DeleteButton" @click="remove">
        <i class="fas fa-trash" />
        削除
      </ButtonComponent>
      <ButtonComponent type="button" variant="SaveButton" @click="save">
        <i class="fas fa-save" />
        保存
      </ButtonComponent>
    </template>
  </BaseDialog>
</template>
