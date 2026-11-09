<script setup lang="ts">
import { fieldProps } from '../composables/componentProps';
import { computed, nextTick, ref, useId, watch, type PropType } from 'vue';
import { CONST_VARIABLE } from '../config/Const';
import type { DateMode } from '../composables/dateFields';
defineOptions({
  inheritAttrs: false
});
const props = defineProps({
  ...fieldProps,
  modelValue: String,
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
  'update:modelValue': [value: string];
}>();
const generatedId = useId();
const id = computed(() => props.inputId || generatedId);
const input = ref<HTMLInputElement>();
const {
  value,
  setValue,
  getValue
} = useFieldValue(props, emit, '');
// 色コードが不正・空欄の間は、旧実装と同じく最後の有効なピッカー色を維持する。
const pickerColor = ref(CONST_VARIABLE.COLOR_PICKER_INITIAL_VALUE);
watch(value, next => {
  if (/^#[0-9a-f]{6}$/i.test(next)) pickerColor.value = next;
}, { immediate: true });
function updateColor(next: string) {
  if (props.disabled || props.readonly) return;
  setValue(next);
}
const editorOpen = ref(false);
const calendarOpen = ref(false);
const draft = ref('');
const textArea = ref<{ focus: () => void }>();
function updateInput(event: Event) {
  if (props.type === 'file') return;
  const target = event.target as HTMLInputElement;
  const next = props.numericOnly ? target.value.replace(/[^0-9]/g, '') : target.value;
  target.value = next;
  setValue(next);
}

/** 旧 ShowInputAreaDialog：開く時に値をコピーし、「完了」でだけ反映する。 */
function openEditor() {
  if (props.disabled) return;
  draft.value = value.value;
  editorOpen.value = true;
}
function closeEditor() {
  editorOpen.value = false;
}
function commitEditor() {
  if (props.disabled || props.readonly) return;
  setValue(draft.value);
  closeEditor();
}
async function clearEditor() {
  if (props.disabled || props.readonly) return;
  draft.value = '';
  await nextTick();
  textArea.value?.focus();
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

function focus() {
  input.value?.focus();
}

// 公開APIとv-modelは共通の値更新処理を使用する。
defineExpose({
  focus,
  openFilePicker,
  setValue,
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
        v-if="colorPickerFlg" inline type="color" :model-value="pickerColor"
        :aria-label="`${label}を選択`" :disabled="disabled || readonly"
        @update:model-value="updateColor"
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
        ref="textArea"
        v-model="draft"
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
      @commit="setValue"
    />
  </FieldFrame>
</template>
