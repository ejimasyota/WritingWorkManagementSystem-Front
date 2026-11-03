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
const yearInput = ref<HTMLInputElement>();

// 開くたびに元の値を読み込み、閉じた場合は編集中の変更を破棄する。
watch(() => props.modelValue, open => {
  if (!open) return;
  const parsed = parseDateFields(props.value);
  year.value = parsed.year;
  month.value = parsed.month;
  day.value = parsed.day;
  mode.value = props.fixedMode || parsed.mode;
});

/** 旧 DatePicker と同じく数字以外を除去し、年月日それぞれの桁数に制限する。 */
function updateField(event: Event, field: 'year' | 'month' | 'day') {
  const input = event.target as HTMLInputElement;
  const maxLength = field === 'year' ? 4 : 2;
  const digits = input.value.replace(/[^0-9]/g, '').slice(0, maxLength);
  input.value = digits;
  if (field === 'year') year.value = digits;
  if (field === 'month') month.value = digits;
  if (field === 'day') day.value = digits;
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
    <select
      v-model="mode"
      class="SelectForm DatePickerMode"
      aria-label="入力モード"
      :disabled="readonly || !!fixedMode"
      @change="changeMode"
    >
      <option value="year">年</option>
      <option value="year-month">年月</option>
      <option value="date">年月日</option>
    </select>
    <label class="LabelStyle">日付</label>
    <div class="DatePickerFieldsRow">
      <div class="DatePickerField">
        <input
          ref="yearInput"
          :value="year"
          class="InputForm DatePickerFieldInput"
          aria-label="年"
          placeholder="YYYY"
          inputmode="numeric"
          maxlength="4"
          :readonly="readonly"
          @input="updateField($event, 'year')"
        >
        <span class="DatePickerSep">年</span>
      </div>
      <div v-if="mode !== 'year'" class="DatePickerField">
        <input
          :value="month"
          class="InputForm DatePickerFieldInput"
          aria-label="月"
          placeholder="MM"
          inputmode="numeric"
          maxlength="2"
          :readonly="readonly"
          @input="updateField($event, 'month')"
        >
        <span class="DatePickerSep">月</span>
      </div>
      <div v-if="mode === 'date'" class="DatePickerField">
        <input
          :value="day"
          class="InputForm DatePickerFieldInput"
          aria-label="日"
          placeholder="DD"
          inputmode="numeric"
          maxlength="2"
          :readonly="readonly"
          @input="updateField($event, 'day')"
        >
        <span class="DatePickerSep">日</span>
      </div>
    </div>
    <template #actions>
      <button type="button" class="ButtonClass CloseButton" @click="close">
        <i class="fas fa-times" aria-hidden="true" /> 閉じる
      </button>
      <template v-if="!readonly">
        <button type="button" class="ButtonClass ClearButton" @click="clear">
          <i class="fas fa-sync" aria-hidden="true" /> クリア
        </button>
        <button type="button" class="ButtonClass SaveButton" @click="commit">
          <i class="fas fa-save" aria-hidden="true" /> 決定
        </button>
      </template>
    </template>
  </BaseDialog>
</template>
