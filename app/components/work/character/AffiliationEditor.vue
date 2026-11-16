<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useFieldValue } from '../../../composables/useFieldValue';
import { useInputFields } from '../../../composables/useInputFields';
import type { CharacterAffiliation, CharacterMasters } from '../../../types/character';
import type { PageDialogs } from '../../../composables/usePageDialogs';
import { affiliationLabel, affiliationWarnings, sortAffiliations } from '../../../utils/affiliationData';
import { compareFlexibleDates } from '../../../utils/dates';
import { messageFormat } from '../../../utils/messages';
const props = defineProps<{ masters: CharacterMasters; readonly: boolean; dialogs: PageDialogs }>();
const fields = useInputFields();
const { value, setValue, getValue, updateValue } = useFieldValue<CharacterAffiliation[]>([]);
defineExpose({ setValue, getValue });
const opened = ref(false);
const index = ref<number | null>(null);
const draft = ref(empty());
const errors = ref<Record<string, string>>({});
const rows = computed(() => sortAffiliations(value.value).map(row => ({ ...row, _index: value.value.indexOf(row), Affiliation: affiliationLabel(row, props.masters), Warnings: affiliationWarnings(row, props.masters) })));
const columns = [
  { key: 'Affiliation', label: '所属' },
  { key: 'JoinedDate', label: '加入年月日' },
  { key: 'LeftDate', label: '脱退年月日' },
  { key: 'Note', label: '備考' }
];
const warnings = computed(() => affiliationWarnings(draft.value, props.masters));
function empty(): CharacterAffiliation {
  return { OrgId: '', OrgName: '', TeamId: '', TeamName: '', ClassId: '', ClassName: '', JoinedDate: '', LeftDate: '', Note: '' };
}
function options(kind: 'Organization' | 'Team' | 'Class') {
  const id = kind === 'Organization' ? 'OrgId' : kind + 'Id';
  const name = kind === 'Organization' ? 'OrgName' : kind + 'Name';
  const selectedId = draft.value[id as keyof CharacterAffiliation];
  const available = (props.masters[kind] || []).filter(item => kind === 'Organization' || String(item.OrgId || '') === draft.value.OrgId);
  const result = [{ value: '', label: '' }, ...available.map(item => ({ value: String(item[id]), label: String(item[name]) }))];
  if (selectedId && !result.some(item => item.value === selectedId))
    result.push({ value: selectedId, label: draft.value[name as keyof CharacterAffiliation] || selectedId });
  return result;
}
function open(i: number | null) {
  index.value = i;
  draft.value = i == null ? empty() : { ...value.value[i]! };
  errors.value = {};
  fields.setValues({ ...draft.value });
  opened.value = true;
}
function changed(key: keyof CharacterAffiliation) {
  if (props.readonly) return;
  draft.value[key] = fields.getValue(key, '');
  if (key === 'OrgId') {
    draft.value.TeamId = draft.value.TeamName = draft.value.ClassId = draft.value.ClassName = '';
    fields.setValues({ TeamId: '', ClassId: '' });
  }
}
async function commit() {
  if (props.readonly) return;
  Object.assign(draft.value, fields.getValues({ ...draft.value }));
  errors.value = {};
  if (!draft.value.OrgId && !draft.value.TeamId && !draft.value.ClassId) errors.value.OrgId = messageFormat('ERROR', 'E_0054', '所属');
  if (compareFlexibleDates(draft.value.LeftDate, draft.value.JoinedDate) === -1) errors.value.LeftDate = messageFormat('ERROR', 'E_0094');
  if (Object.keys(errors.value).length) { await nextTick(); fields.focus(Object.keys(errors.value)[0]!); return; }
  for (const [kind, id, name] of [['Organization', 'OrgId', 'OrgName'], ['Team', 'TeamId', 'TeamName'], ['Class', 'ClassId', 'ClassName']] as const) {
    draft.value[name] = draft.value[id] ? String(props.masters[kind]?.find(item => String(item[id]) === draft.value[id])?.[name] || draft.value[name]) : '';
  }
  const next = [...value.value];
  if (index.value == null) next.unshift({ ...draft.value }); else next[index.value] = { ...draft.value };
  updateValue(sortAffiliations(next));
  opened.value = false;
}
async function remove() {
  if (props.readonly || index.value == null) return;
  const target = index.value;
  if (!await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'この所属履歴を削除')) || props.readonly) return;
  updateValue(value.value.filter((_, i) => i !== target));
  opened.value = false;
}
</script>
<template>
  <TableComponent :rows="rows" :columns="columns" row-key="_index" :scroll-top-on-page-change="false" row-clickable @row-click="row => open(Number(row._index))">
    <template #cell-Affiliation="{row}">
      <span v-if="row.Warnings.length" class="AffiliationWarning" role="img" :aria-label="row.Warnings.join('\n')" :title="row.Warnings.join('\n')"><i class="fas fa-exclamation-circle" aria-hidden="true" /></span>
      {{ row.Affiliation }}
    </template>
  </TableComponent>
  <ButtonComponent v-if="!readonly" type="button" variant="PrimaryButton ButtonSmall" @click="open(null)"><i class="fas fa-plus" aria-hidden="true" />追加</ButtonComponent>
  <BaseDialog v-model="opened" title="所属履歴" size="DialogMedium">
    <SelectBoxComponent :ref="el => fields.register('OrgId', el, draft.OrgId)" label="組織" :options="options('Organization')" :readonly="readonly" :error="errors.OrgId" @value-change="changed('OrgId')" />
    <SelectBoxComponent :ref="el => fields.register('TeamId', el, draft.TeamId)" label="チーム" :options="options('Team')" :readonly="readonly" @value-change="changed('TeamId')" />
    <SelectBoxComponent :ref="el => fields.register('ClassId', el, draft.ClassId)" label="階級" :options="options('Class')" :readonly="readonly" @value-change="changed('ClassId')" />
    <div class="FormGrid">
      <TextFieldComponent :ref="el => fields.register('JoinedDate', el, draft.JoinedDate)" label="加入年月日" date-picker-flg :readonly="readonly" :error="errors.JoinedDate" @value-change="changed('JoinedDate')" />
      <TextFieldComponent :ref="el => fields.register('LeftDate', el, draft.LeftDate)" label="脱退年月日" date-picker-flg :readonly="readonly" :error="errors.LeftDate" @value-change="changed('LeftDate')" />
    </div>
    <p v-for="warning in warnings" :key="warning" class="AffiliationWarning"><i class="fas fa-exclamation-circle" aria-hidden="true" /> {{ warning }}</p>
    <TextAreaComponent :ref="el => fields.register('Note', el, draft.Note)" label="備考" :readonly="readonly" />
    <template #actions>
      <ButtonComponent type="button" variant="CloseButton" @click="opened = false">閉じる</ButtonComponent>
      <ButtonComponent v-if="!readonly && index !== null" type="button" variant="DeleteButton" @click="remove">削除</ButtonComponent>
      <ButtonComponent v-if="!readonly" type="button" variant="SaveButton" @click="commit">完了</ButtonComponent>
    </template>
  </BaseDialog>
</template>
