<script setup lang="ts">
import { computed, ref } from 'vue';
import type { CharacterMaster } from '../../../types/character';
import type { PageDialogs } from '../../../composables/usePageDialogs';
const props = defineProps<{
  modelValue: string[];
  definition: { key: string; label: string; id: string; name: string; help: string };
  masters: CharacterMaster[];
  available: CharacterMaster[];
  readonly: boolean;
  dialogs: PageDialogs;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();
const opened = ref(false);
const selectedId = ref('');
const index = ref<number | null>(null);
const columns = [{ key: 'Name', label: '名称' }, { key: 'Description', label: '概要' }];
const rows = computed(() => props.modelValue.flatMap((id, i) => {
  const master = props.masters.find(item => String(item[props.definition.id]) === id);
  return master ? [{ _index: i, Name: master[props.definition.name], Description: master.Description || '' }] : [];
}));
function optionsFor(current?: string) {
  const candidates = props.available.filter(item => !props.modelValue.includes(String(item[props.definition.id])) || String(item[props.definition.id]) === current);
  if (current && !candidates.some(item => String(item[props.definition.id]) === current)) {
    const master = props.masters.find(item => String(item[props.definition.id]) === current);
    if (master) candidates.push(master);
  }
  return candidates.map(item => ({ value: String(item[props.definition.id]), label: String(item[props.definition.name] || '') }));
}
const options = computed(() => optionsFor(index.value == null ? undefined : props.modelValue[index.value]));
const description = computed(() => props.masters.find(item => String(item[props.definition.id]) === selectedId.value)?.Description || '');
function open(i: number | null) {
  index.value = i;
  selectedId.value = i == null ? optionsFor()[0]?.value || '' : props.modelValue[i] || '';
  opened.value = true;
}
function commit() {
  if (props.readonly || !selectedId.value || !options.value.some(option => option.value === selectedId.value)) return;
  const next = [...props.modelValue];
  if (index.value == null) next.push(selectedId.value);
  else next[index.value] = selectedId.value;
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
  <FieldFrame :label="definition.label" info-icon-flg :info-title="definition.label" :info-message="definition.help">
    <TableComponent :rows="rows" :columns="columns" row-key="_index" :page-size="5" :scroll-top-on-page-change="false" row-clickable @row-click="row => open(Number(row._index))" />
    <ButtonComponent v-if="!readonly" type="button" variant="PrimaryButton ButtonSmall" :disabled="!optionsFor().length" @click="open(null)"><i class="fas fa-plus" aria-hidden="true" /> 追加</ButtonComponent>
    <BaseDialog v-model="opened" :title="definition.label" size="DialogMedium">
      <SelectBoxComponent v-model="selectedId" :label="definition.label" :options="options" :readonly="readonly" />
      <p class="PreserveLines">{{ description }}</p>
      <template #actions>
        <ButtonComponent type="button" variant="CloseButton" @click="opened = false">閉じる</ButtonComponent>
        <ButtonComponent v-if="!readonly && index !== null" type="button" variant="DeleteButton" @click="remove">削除</ButtonComponent>
        <ButtonComponent v-if="!readonly" type="button" variant="SaveButton" @click="commit">完了</ButtonComponent>
      </template>
    </BaseDialog>
  </FieldFrame>
</template>
