<script setup lang="ts">
import { useFieldValue } from '../../../composables/useFieldValue';
import { useInputFields } from '../../../composables/useInputFields';
import { messageFormat } from '../../../utils/messages';
import { computed, ref } from 'vue';
import type { CharacterMaster } from '../../../types/character';
import type { PageDialogs } from '../../../composables/usePageDialogs';

const inputFields = useInputFields();
const props = defineProps<{
  definition: { key: string; label: string; id: string; name: string; help: string };
  masters: CharacterMaster[];
  available: CharacterMaster[];
  readonly: boolean;
  dialogs: PageDialogs;
}>();
const emit = defineEmits<{ 'value-change': [] }>();
const { value, setValue, getValue, updateValue } = useFieldValue<string[]>([], () => emit('value-change'));
defineExpose({ setValue, getValue });
const opened = ref(false);
const selectedId = ref('');
const index = ref<number | null>(null);
const columns = [{ key: 'Name', label: '名称' }, { key: 'Description', label: '概要' }];
const rows = computed(() => value.value.flatMap((id, i) => {
  const master = props.masters.find(item => String(item[props.definition.id]) === id);
  return master ? [{ _index: i, Name: master[props.definition.name], Description: master.Description || '' }] : [];
}));
function optionsFor(current?: string) {
  const candidates = props.available.filter(item => !value.value.includes(String(item[props.definition.id])) || String(item[props.definition.id]) === current);
  if (current && !candidates.some(item => String(item[props.definition.id]) === current)) {
    const master = props.masters.find(item => String(item[props.definition.id]) === current);
    if (master) candidates.push(master);
  }
  return candidates.map(item => ({ value: String(item[props.definition.id]), label: String(item[props.definition.name] || '') }));
}
const options = computed(() => optionsFor(index.value == null ? undefined : value.value[index.value]));
const description = computed(() => props.masters.find(item => String(item[props.definition.id]) === selectedId.value)?.Description || '');
function open(i: number | null) {
  index.value = i;
  selectedId.value = i == null ? optionsFor()[0]?.value || '' : value.value[i] || '';
  inputFields.setValue('selectedId', selectedId.value);
  opened.value = true;
}
function commit() {
  selectedId.value = String(inputFields.getValue('selectedId', ''));
  if (props.readonly || !selectedId.value || !options.value.some(option => option.value === selectedId.value)) return;
  const next = [...value.value];
  if (index.value == null) next.push(selectedId.value);
  else next[index.value] = selectedId.value;
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
  <FieldFrame :label="definition.label" info-icon-flg :info-title="definition.label" :info-message="definition.help">
    <TableComponent :rows="rows" :columns="columns" row-key="_index" :page-size="5" :scroll-top-on-page-change="false" row-clickable @row-click="row => open(Number(row._index))" />
    <ButtonComponent v-if="!readonly" type="button" variant="PrimaryButton ButtonSmall" :disabled="!optionsFor().length" @click="open(null)"><i class="fas fa-plus" aria-hidden="true" /> 追加</ButtonComponent>
    <BaseDialog v-model="opened" :title="definition.label" size="DialogMedium">
      <SelectBoxComponent :ref="el => inputFields.register('selectedId', el, selectedId)" :label="definition.label" @value-change="selectedId = String(inputFields.getValue('selectedId', ''))" :options="options" :readonly="readonly" />
      <p class="PreserveLines">{{ description }}</p>
      <template #actions>
        <ButtonComponent type="button" variant="CloseButton" @click="opened = false">閉じる</ButtonComponent>
        <ButtonComponent v-if="!readonly && index !== null" type="button" variant="DeleteButton" @click="remove">削除</ButtonComponent>
        <ButtonComponent v-if="!readonly" type="button" variant="SaveButton" @click="commit">完了</ButtonComponent>
      </template>
    </BaseDialog>
  </FieldFrame>
</template>
