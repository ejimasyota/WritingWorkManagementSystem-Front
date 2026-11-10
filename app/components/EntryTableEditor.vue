<script setup lang="ts">
import { messageFormat } from '../utils/messages';

import { useFieldValue } from '../composables/useFieldValue';
import { computed, nextTick, reactive, ref } from 'vue';
import { useInputFields } from '../composables/useInputFields';
import type { CharacterEntry, EntryDefinition } from '../types/character';
import type { PageDialogs } from '../composables/usePageDialogs';

const inputFields = useInputFields();
const props = defineProps<{ definition: EntryDefinition; readonly?: boolean; dialogs: PageDialogs }>();
const emit = defineEmits<{ 'value-change': [] }>();
const { value, setValue, getValue, updateValue } = useFieldValue<CharacterEntry[]>([], () => emit('value-change'));
defineExpose({ setValue, getValue });
const opened = ref(false);
const index = ref<number | null>(null);
const draft = reactive<CharacterEntry>({});
const errors = reactive<Record<string, string>>({});
const columns = computed(() => props.definition.columns.map(column => ({ key: column.key, label: column.label })));
const rows = computed(() => value.value.map((row, i) => ({ ...row, _index: i })));
function open(i: number | null) {
  index.value = i;
  for (const key of Object.keys(errors)) delete errors[key];
  for (const column of props.definition.columns) draft[column.key] = i == null ? '' : value.value[i]?.[column.key] || '';
  inputFields.setValues(draft);
  opened.value = true;
}
async function commit() {
  if (props.readonly) return;
  Object.assign(draft, inputFields.getValues(draft));
  for (const key of Object.keys(errors)) delete errors[key];
  for (const column of props.definition.columns) {
    if (column.required && !draft[column.key]?.trim()) errors[column.key] = messageFormat('ERROR', 'E_0001', column.label);
  }
  if (Object.keys(errors).length) {
    await nextTick();
    inputFields.focus(Object.keys(errors)[0]!);
    return;
  }
  const row = Object.fromEntries(props.definition.columns.map(column => [column.key, (draft[column.key] || '').trim()]));
  const next = value.value.map(item => ({ ...item }));
  if (index.value == null) {
    if (props.definition.maxRows && next.length >= props.definition.maxRows) return;
    next.push(row);
  } else next[index.value] = row;
  updateValue(next);
  opened.value = false;
}
async function remove() {
  if (props.readonly || index.value == null) return;
  const target = index.value;
  if (!await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'この行を削除')) || props.readonly) return;
  updateValue(value.value.filter((_, i) => i !== target));
  opened.value = false;
}
</script>

<template>
  <FieldFrame :label="definition.label" :info-icon-flg="!!definition.helpMessage" :info-title="definition.label" :info-message="definition.helpMessage">
    <TableComponent :rows="rows" :columns="columns" row-key="_index" :page-size="5" :scroll-top-on-page-change="false" row-clickable @row-click="row => open(Number(row._index))" />
    <ButtonComponent v-if="!readonly" type="button" variant="PrimaryButton ButtonSmall" :disabled="!!definition.maxRows && value.length >= definition.maxRows" @click="open(null)">
      <i class="fas fa-plus" aria-hidden="true" /> 追加
    </ButtonComponent>
    <BaseDialog v-model="opened" :title="definition.label" size="DialogMedium">
      <template v-for="column in definition.columns" :key="column.key">
        <TextAreaComponent v-if="column.multiline" :ref="el => inputFields.register(column.key, el, draft[column.key] || '')" :label="column.label" :required="column.required" :maxlength="column.maxLength" :readonly="readonly" :error="errors[column.key]" />
        <TextFieldComponent v-else :ref="el => inputFields.register(column.key, el, draft[column.key] || '')" :label="column.label" :required="column.required" :maxlength="column.maxLength" :readonly="readonly" :error="errors[column.key]" />
      </template>
      <template #actions>
        <ButtonComponent type="button" variant="CloseButton" @click="opened = false">閉じる</ButtonComponent>
        <ButtonComponent v-if="!readonly && index !== null" type="button" variant="DeleteButton" @click="remove">削除</ButtonComponent>
        <ButtonComponent v-if="!readonly" type="button" variant="SaveButton" @click="commit">完了</ButtonComponent>
      </template>
    </BaseDialog>
  </FieldFrame>
</template>
