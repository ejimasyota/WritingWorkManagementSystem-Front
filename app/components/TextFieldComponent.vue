<script setup lang="ts">
import { useFieldValue } from '../composables/useFieldValue';
import { useInputFields } from '../composables/useInputFields';
import { fieldProps } from '../composables/componentProps';
import { computed, nextTick, ref, useId, watch, type PropType } from 'vue';
import { CONST_VARIABLE } from '../config/Const';
import type { DateMode } from '../types/date';

const inputFields = useInputFields();
defineOptions({
  inheritAttrs: false
});
const props = defineProps({
  ...fieldProps,
  inputId: String,
  inputReadonly: Boolean,
  numericOnly: Boolean,
  dateMode: String as PropType<DateMode>,
  textAreaFlg: Boolean,
  datePickerFlg: Boolean,
  colorPickerFlg: Boolean,
  type: String
});
const emit = defineEmits<{
  'value-change': [];
}>();
const generatedId = useId();
const id = computed(() => props.inputId || generatedId);
const input = ref<HTMLInputElement>();
const {
  value,
  setValue,
  getValue,
  updateValue
} = useFieldValue('', () => emit('value-change'));
// 色コードが不正・空欄の間は、旧実装と同じく最後の有効なピッカー色を維持する。
const pickerColor = ref(CONST_VARIABLE.COLOR_PICKER_INITIAL_VALUE);
watch(value, next => {
  if (/^#[0-9a-f]{6}$/i.test(next)) {
    pickerColor.value = next;
    inputFields.setValue('pickerColor', next);
  }
}, { immediate: true });
function updateColor() {
  const next = inputFields.getValue('pickerColor', pickerColor.value);
  if (props.disabled || props.readonly) return;
  updateValue(next);
}
const editorOpen = ref(false);
const calendarOpen = ref(false);
const draft = ref('');
function updateInput(event: Event) {
  if (props.type === 'file') return;
  const target = event.target as HTMLInputElement;
  const next = props.numericOnly ? target.value.replace(/[^0-9]/g, '') : target.value;
  target.value = next;
  updateValue(next);
}

/** 旧 ShowInputAreaDialog：開く時に値をコピーし、「完了」でだけ反映する。 */
function openEditor() {
  if (props.disabled) return;
  draft.value = value.value;
  inputFields.setValue('draft', draft.value);
  editorOpen.value = true;
}
function closeEditor() {
  editorOpen.value = false;
}
function commitEditor() {
  if (props.disabled || props.readonly) return;
  draft.value = inputFields.getValue('draft', '');
  updateValue(draft.value);
  closeEditor();
}
async function clearEditor() {
  if (props.disabled || props.readonly) return;
  draft.value = '';
  inputFields.setValue('draft', '');
  await nextTick();
  inputFields.focus('draft');
}
function openCalendar() {
  if (props.disabled) return;
  calendarOpen.value = true;
}

/** 旧 SetupDatePickerInputClick：日付欄自体のクリックでもピッカーを開く。 */
function handleInputClick() {
  if (props.datePickerFlg) openCalendar();
}

/** ファイル選択も共通入力部品から開き、同じファイルの再選択に対応する。 */
function openFilePicker() {
  if (props.disabled || !input.value) return;
  input.value.value = '';
  input.value.click();
}

/** 選択ファイルも親画面からrefで取得する。返す配列は内部状態から切り離す。 */
function getFiles(): File[] {
  return Array.from(input.value?.files || []);
}

/** ファイル入力は空文字のセット時にブラウザ側の選択も解除する。 */
function setInputValue(next: string) {
  setValue(next);
  if (props.type === 'file' && next === '' && input.value) input.value.value = '';
}

function focus() {
  input.value?.focus();
}

// 親からの値の読み書きはコンポーネントref経由で行う。
defineExpose({
  focus,
  openFilePicker,
  getFiles,
  setValue: setInputValue,
  getValue
});
</script>

<template>
  <FieldFrame
    :inline="inline"
    :label="label"
    :input-id="id"
    :required="required"
    :info-icon-flg="infoIconFlg"
    :info-title="infoTitle"
    :info-message="infoMessage"
    :error="error"
    :hint="hint"
  >
    <div :class="inline && !textAreaFlg && !datePickerFlg && !colorPickerFlg ? 'InlineField' : 'InputWithButton'">
      <input
        ref="input"
        :id="id"
        :class="[type === 'color' ? 'ColorPicker' : 'InputForm', { HasError: error }]"
        :type="type || 'text'"
        :value="type === 'file' ? undefined : value"
        :disabled="disabled"
        :readonly="readonly || inputReadonly"
        :required="required"
        :aria-invalid="!!error"
        v-bind="$attrs"
        @input="updateInput"
        @click="handleInputClick"
      >
      <TextFieldComponent
        v-if="colorPickerFlg" inline type="color" :ref="el => inputFields.register('pickerColor', el, pickerColor)"
        :aria-label="`${label}を選択`" :disabled="disabled || readonly"
        @value-change="updateColor"
      />
      <ButtonComponent
        v-if="textAreaFlg"
        type="button"
        variant="SecondaryButton ButtonSmall"
        :disabled="disabled"
        aria-label="詳細を開く"
        @click="openEditor"
      >
        <i class="fas" :class="readonly ? 'fa-eye' : 'fa-edit'" aria-hidden="true" />
      </ButtonComponent>
      <ButtonComponent
        v-if="datePickerFlg"
        type="button"
        variant="SecondaryButton ButtonSmall"
        :disabled="disabled"
        aria-label="日付選択"
        @click="openCalendar"
      >
        <i class="fas fa-calendar" aria-hidden="true" />
      </ButtonComponent>
    </div>

    <BaseDialog v-model="editorOpen" title="詳細" size="DialogMedium">
      <TextAreaComponent
        inline

        :ref="el => inputFields.register('draft', el, draft)"
        aria-label="詳細"
        class="InputAreaDialogText"
        :readonly="readonly || disabled"
      />
      <template #actions>
        <ButtonComponent type="button" variant="CloseButton" @click="closeEditor">
          <i class="fas fa-times" aria-hidden="true" /> 閉じる
        </ButtonComponent>
        <template v-if="!readonly && !disabled">
          <ButtonComponent type="button" variant="ClearButton" @click="clearEditor">
            <i class="fas fa-sync" aria-hidden="true" /> クリア
          </ButtonComponent>
          <ButtonComponent type="button" variant="SaveButton" @click="commitEditor">
            <i class="fas fa-save" aria-hidden="true" /> 完了
          </ButtonComponent>
        </template>
      </template>
    </BaseDialog>
    <DatePickerDialog
      v-model="calendarOpen"
      :value="value"
      :fixed-mode="dateMode"
      :readonly="readonly || disabled"
      @commit="updateValue"
    />
  </FieldFrame>
</template>
