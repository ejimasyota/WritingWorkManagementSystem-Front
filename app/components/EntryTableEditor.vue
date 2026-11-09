<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue';
import { setFieldHandle } from '../utils/validation';
import type { CharacterEntry, EntryDefinition } from '../types/character';
import type { PageDialogs } from '../composables/usePageDialogs';
const props = defineProps<{ modelValue: CharacterEntry[]; definition: EntryDefinition; readonly?: boolean; dialogs: PageDialogs }>();
const emit = defineEmits<{ 'update:modelValue': [value: CharacterEntry[]] }>();
const opened = ref(false);
const index = ref<number | null>(null);
const draft = reactive<CharacterEntry>({});
const errors = reactive<Record<string, string>>({});
const fields = ref<Record<string, { focus: () => void }>>({});
const columns = computed(() => props.definition.columns.map(column => ({ key: column.key, label: column.label })));
const rows = computed(() => props.modelValue.map((row, i) => ({ ...row, _index: i })));
function open(i: number | null) {
  index.value = i;
  for (const key of Object.keys(errors)) delete errors[key];
  for (const column of props.definition.columns) draft[column.key] = i == null ? '' : props.modelValue[i]?.[column.key] || '';
  opened.value = true;
}
async function commit() {
  if (props.readonly) return;
  for (const key of Object.keys(errors)) delete errors[key];
  for (const column of props.definition.columns) {
    if (column.required && !draft[column.key]?.trim()) errors[column.key] = `${column.label}を入力してください`;
  }
  if (Object.keys(errors).length) {
    await nextTick();
    fields.value[Object.keys(errors)[0]!]?.focus?.();
    return;
  }
  const row = Object.fromEntries(props.definition.columns.map(column => [column.key, (draft[column.key] || '').trim()]));
  const next = props.modelValue.map(item => ({ ...item }));
  if (index.value == null) {
    if (props.definition.maxRows && next.length >= props.definition.maxRows) return;
    next.push(row);
  } else next[index.value] = row;
  emit('update:modelValue', next);
  opened.value = false;
}
async function remove() {
  if (props.readonly || index.value == null) return;
  const target = index.value;
  if (!await props.dialogs.confirm('この行を削除しますか？') || props.readonly) return;
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== target));
  opened.value = false;
}
</script>

<template>
  <FieldFrame :label="definition.label" :info-icon-flg="!!definition.helpMessage" :info-title="definition.label" :info-message="definition.helpMessage">
    <TableComponent :rows="rows" :columns="columns" row-key="_index" :page-size="5" :scroll-top-on-page-change="false" row-clickable @row-click="row => open(Number(row._index))" />
    <ButtonComponent v-if="!readonly" type="button" variant="PrimaryButton ButtonSmall" :disabled="!!definition.maxRows && modelValue.length >= definition.maxRows" @click="open(null)">
      <i class="fas fa-plus" aria-hidden="true" /> 追加
    </ButtonComponent>
    <BaseDialog v-model="opened" :title="definition.label" size="DialogMedium">
      <template v-for="column in definition.columns" :key="column.key">
        <TextAreaComponent v-if="column.multiline" :ref="el => setFieldHandle(fields, column.key, el)" v-model="draft[column.key]" :label="column.label" :required="column.required" :maxlength="column.maxLength" :readonly="readonly" :error="errors[column.key]" />
        <TextFieldComponent v-else :ref="el => setFieldHandle(fields, column.key, el)" v-model="draft[column.key]" :label="column.label" :required="column.required" :maxlength="column.maxLength" :readonly="readonly" :error="errors[column.key]" />
      </template>
      <template #actions>
        <ButtonComponent type="button" variant="CloseButton" @click="opened = false">閉じる</ButtonComponent>
        <ButtonComponent v-if="!readonly && index !== null" type="button" variant="DeleteButton" @click="remove">削除</ButtonComponent>
        <ButtonComponent v-if="!readonly" type="button" variant="SaveButton" @click="commit">完了</ButtonComponent>
      </template>
    </BaseDialog>
  </FieldFrame>
</template>
