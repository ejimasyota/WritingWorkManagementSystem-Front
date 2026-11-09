<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { formatDateFields, parseDateFields, type DateMode } from '../composables/dateFields';
interface Props {
  modelValue: boolean;
  value: string;
  readonly?: boolean;
  fixedMode?: DateMode;
}
const props = defineProps<Props>();
const emit = defineEmits(['update:modelValue', 'commit']);
const mode = ref<DateMode>('date');
const year = ref('');
const month = ref('');
const day = ref('');
const yearInput = ref<{ focus: () => void }>();

// 開くたびに元の値を読み込み、閉じた場合は編集中の変更を破棄する。
watch(() => props.modelValue, open => {
  if (!open) return;
  const parsed = parseDateFields(props.value);
  year.value = parsed.year;
  month.value = parsed.month;
  day.value = parsed.day;
  mode.value = props.fixedMode || parsed.mode;
}, { immediate: true });

/** 旧 DatePicker と同じく数字以外を除去し、年月日それぞれの桁数に制限する。 */
function updateField(value: string, field: 'year' | 'month' | 'day') {
  const maxLength = field === 'year' ? 4 : 2;
  const digits = value.replace(/[^0-9]/g, '').slice(0, maxLength);
  if (field === 'year') year.value = digits;
  if (field === 'month') month.value = digits;
  if (field === 'day') day.value = digits;
}
function updateMode(value: string | number) {
  mode.value = value as DateMode;
  void changeMode();
}
async function changeMode() {
  if (mode.value === 'year') month.value = '';
  if (mode.value !== 'date') day.value = '';
  await nextTick();
  yearInput.value?.focus();
}
function close() {
  emit('update:modelValue', false);
}
async function clear() {
  year.value = '';
  month.value = '';
  day.value = '';
  await nextTick();
  yearInput.value?.focus();
}
function commit() {
  if (props.readonly) return;
  emit('commit', formatDateFields(year.value, month.value, day.value, mode.value));
  close();
}
</script>

<template>
  <BaseDialog :model-value="modelValue" title="日付選択" @update:model-value="close">
    <label class="LabelStyle">入力モード</label>
    <SelectBoxComponent inline hide-list-button :model-value="mode" class="DatePickerMode" aria-label="入力モード" :disabled="readonly || !!fixedMode" :options="[{ value: 'year', label: '年' }, { value: 'year-month', label: '年月' }, { value: 'date', label: '年月日' }]" @update:model-value="updateMode" />
    <label class="LabelStyle">日付</label>
    <div class="DatePickerFieldsRow">
      <div class="DatePickerField">
        <TextFieldComponent inline numeric-only
          ref="yearInput"
          :model-value="year"
          class="DatePickerFieldInput"
          aria-label="年"
          placeholder="YYYY"
          inputmode="numeric"
          maxlength="4"
          :readonly="readonly"
          @update:model-value="value => updateField(value, 'year')"
        />
        <span class="DatePickerSep">年</span>
      </div>
      <div v-if="mode !== 'year'" class="DatePickerField">
        <TextFieldComponent inline numeric-only
          :model-value="month"
          class="DatePickerFieldInput"
          aria-label="月"
          placeholder="MM"
          inputmode="numeric"
          maxlength="2"
          :readonly="readonly"
          @update:model-value="value => updateField(value, 'month')"
        />
        <span class="DatePickerSep">月</span>
      </div>
      <div v-if="mode === 'date'" class="DatePickerField">
        <TextFieldComponent inline numeric-only
          :model-value="day"
          class="DatePickerFieldInput"
          aria-label="日"
          placeholder="DD"
          inputmode="numeric"
          maxlength="2"
          :readonly="readonly"
          @update:model-value="value => updateField(value, 'day')"
        />
        <span class="DatePickerSep">日</span>
      </div>
    </div>
    <template #actions>
      <ButtonComponent type="button" variant="CloseButton" @click="close">
        <i class="fas fa-times" aria-hidden="true" /> 閉じる
      </ButtonComponent>
      <template v-if="!readonly">
        <ButtonComponent type="button" variant="ClearButton" @click="clear">
          <i class="fas fa-sync" aria-hidden="true" /> クリア
        </ButtonComponent>
        <ButtonComponent type="button" variant="SaveButton" @click="commit">
          <i class="fas fa-save" aria-hidden="true" /> 決定
        </ButtonComponent>
      </template>
    </template>
  </BaseDialog>
</template>
