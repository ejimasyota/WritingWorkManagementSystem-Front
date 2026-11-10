<script setup lang="ts">
import { useInputFields } from '../composables/useInputFields';
import { nextTick, ref, watch } from 'vue';
import type { DateMode, DateFields } from '../types/date';

const inputFields = useInputFields();
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

// 開くたびに元の値を読み込み、閉じた場合は編集中の変更を破棄する。
watch(() => props.modelValue, open => {
  if (!open) return;
  const parsed = parseDateFields(props.value);
  year.value = parsed.year;
  month.value = parsed.month;
  day.value = parsed.day;
  mode.value = props.fixedMode || parsed.mode;
  inputFields.setValues({ year: year.value, month: month.value, day: day.value, mode: mode.value });
}, { immediate: true });

/** 旧 DatePicker と同じく数字以外を除去し、年月日それぞれの桁数に制限する。 */
function updateField(field: 'year' | 'month' | 'day') {
  const value = inputFields.getValue(field, '');
  const maxLength = field === 'year' ? 4 : 2;
  const digits = value.replace(/[^0-9]/g, '').slice(0, maxLength);
  if (field === 'year') year.value = digits;
  if (field === 'month') month.value = digits;
  if (field === 'day') day.value = digits;
  inputFields.setValue(field, digits);
}
function updateMode() {
  mode.value = inputFields.getValue('mode', 'date') as DateMode;
  void changeMode();
}
async function changeMode() {
  if (mode.value === 'year') month.value = '';
  if (mode.value !== 'date') day.value = '';
  inputFields.setValues({ month: month.value, day: day.value });
  await nextTick();
  inputFields.focus('year');
}
function close() {
  emit('update:modelValue', false);
}
async function clear() {
  year.value = '';
  month.value = '';
  day.value = '';
  inputFields.setValues({ year: '', month: '', day: '' });
  await nextTick();
  inputFields.focus('year');
}
function commit() {
  if (props.readonly) return;
  emit('commit', formatDateFields(inputFields.getValue('year', ''), inputFields.getValue('month', ''), inputFields.getValue('day', ''), mode.value));
  close();
}
/** 旧 DatePicker.FormatFromFields の範囲補正と和文表記を踏襲する。 */
function formatDateFields(
  year: string,
  month: string,
  day: string,
  mode: DateMode,
): string {
  const digits = (value: string) => value.replace(/[^0-9]/g, '')
  const yearValue = digits(year)
  const monthValue = digits(month)
  const dayValue = digits(day)

  if (!yearValue || yearValue.length > 4) return ''
  if (mode !== 'year' && !monthValue) return ''
  if (mode === 'date' && !dayValue) return ''

  const yearLabel = `${Number(yearValue)}年`
  if (mode === 'year') return yearLabel

  const monthNumber = Math.max(1, Math.min(12, Number(monthValue)))
  const monthLabel = `${String(monthNumber).padStart(2, '0')}月`
  if (mode === 'year-month') return yearLabel + monthLabel

  // 旧実装と同じく、2月は28日を上限とする。
  const maxDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const dayNumber = Math.max(1, Math.min(maxDays[monthNumber - 1]!, Number(dayValue)))
  return yearLabel + monthLabel + `${String(dayNumber).padStart(2, '0')}日`
}

/** 旧 ParseExistingValue / DetectModeFromValue の形式判定を移植する。 */
function parseDateFields(value: string): DateFields {
  let parts: string[] = []

  for (const pattern of [
    /^(\d+)年(\d+)月(\d+)日?$/,
    /^(\d+)年(\d+)月?$/,
    /^(\d+)年$/,
    /^(\d+)-(\d+)-(\d+)$/,
    /^(\d+)-(\d+)$/,
  ]) {
    const match = value.trim().match(pattern)
    if (match) {
      parts = match.slice(1)
      break
    }
  }

  if (!parts.length) {
    const digits = value.replace(/[^0-9]/g, '')
    if (digits.length >= 7 && digits.length <= 10) {
      parts = [digits.slice(0, -4), digits.slice(-4, -2), digits.slice(-2)]
    } else if (digits.length >= 5 && digits.length <= 8) {
      parts = [digits.slice(0, -2), digits.slice(-2)]
    } else if (digits.length >= 1 && digits.length <= 4) {
      parts = [digits]
    }
  }

  const year = parts[0] || ''
  const month = parts[1] || ''
  const day = parts[2] || ''
  return { year, month, day, mode: day ? 'date' : month ? 'year-month' : 'year' }
}
</script>

<template>
  <BaseDialog :model-value="modelValue" title="日付選択" @update:model-value="close">
    <label class="LabelStyle">入力モード</label>
    <SelectBoxComponent inline hide-list-button :ref="el => inputFields.register('mode', el, mode)" class="DatePickerMode" aria-label="入力モード" :disabled="readonly || !!fixedMode" :options="[{ value: 'year', label: '年' }, { value: 'year-month', label: '年月' }, { value: 'date', label: '年月日' }]" @value-change="updateMode" />
    <label class="LabelStyle">日付</label>
    <div class="DatePickerFieldsRow">
      <div class="DatePickerField">
        <TextFieldComponent inline numeric-only

          :ref="el => inputFields.register('year', el, year)"
          class="DatePickerFieldInput"
          aria-label="年"
          placeholder="YYYY"
          inputmode="numeric"
          maxlength="4"
          :readonly="readonly"
          @value-change="() => updateField('year')"
        />
        <span class="DatePickerSep">年</span>
      </div>
      <div v-if="mode !== 'year'" class="DatePickerField">
        <TextFieldComponent inline numeric-only
          :ref="el => inputFields.register('month', el, month)"
          class="DatePickerFieldInput"
          aria-label="月"
          placeholder="MM"
          inputmode="numeric"
          maxlength="2"
          :readonly="readonly"
          @value-change="() => updateField('month')"
        />
        <span class="DatePickerSep">月</span>
      </div>
      <div v-if="mode === 'date'" class="DatePickerField">
        <TextFieldComponent inline numeric-only
          :ref="el => inputFields.register('day', el, day)"
          class="DatePickerFieldInput"
          aria-label="日"
          placeholder="DD"
          inputmode="numeric"
          maxlength="2"
          :readonly="readonly"
          @value-change="() => updateField('day')"
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
