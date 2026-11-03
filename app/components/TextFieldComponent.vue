<script setup lang="ts">
import { fieldProps } from '../composables/componentProps';
import { computed, nextTick, ref, useId, type PropType } from 'vue';
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
const editorOpen = ref(false);
const calendarOpen = ref(false);
const draft = ref('');
const textArea = ref<HTMLTextAreaElement>();
function updateInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const next = props.numericOnly ? target.value.replace(/[^0-9]/g, '') : target.value;
  target.value = next;
  setValue(next);
}

/** 旧 ShowInputAreaDialog：開く時に値をコピーし、「完了」でだけ反映する。 */
function openEditor() {
  draft.value = value.value;
  editorOpen.value = true;
}
function closeEditor() {
  editorOpen.value = false;
}
function commitEditor() {
  setValue(draft.value);
  closeEditor();
}
async function clearEditor() {
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

function focus() {
  input.value?.focus();
}

// 公開APIとv-modelは共通の値更新処理を使用する。
defineExpose({
  focus,
  setValue,
  getValue
});
</script>

<template>
  <FieldFrame
    :label="label"
    :input-id="id"
    :required="required"
    :info-icon-flg="infoIconFlg"
    :info-title="infoTitle"
    :info-message="infoMessage"
    :error="error"
    :hint="hint"
  >
    <div class="InputWithButton">
      <input
        ref="input"
        :id="id"
        class="InputForm"
        :class="{ HasError: error }"
        :type="type || 'text'"
        :value="value"
        :disabled="disabled"
        :readonly="readonly || inputReadonly"
        :required="required"
        :aria-invalid="!!error"
        v-bind="$attrs"
        @input="updateInput"
        @click="handleInputClick"
      >
      <button
        v-if="textAreaFlg"
        type="button"
        class="ButtonClass SecondaryButton ButtonSmall"
        :disabled="disabled"
        aria-label="詳細を開く"
        @click="openEditor"
      >
        <i class="fas fa-edit" aria-hidden="true" />
      </button>
      <button
        v-if="datePickerFlg"
        type="button"
        class="ButtonClass SecondaryButton ButtonSmall"
        :disabled="disabled"
        aria-label="日付選択"
        @click="openCalendar"
      >
        <i class="fas fa-calendar" aria-hidden="true" />
      </button>
    </div>

    <BaseDialog v-model="editorOpen" title="詳細" size="DialogMedium">
      <textarea
        ref="textArea"
        v-model="draft"
        aria-label="詳細"
        class="TextAreaForm InputAreaDialogText"
        :readonly="readonly"
      />
      <template #actions>
        <button type="button" class="ButtonClass CloseButton" @click="closeEditor">
          <i class="fas fa-times" aria-hidden="true" /> 閉じる
        </button>
        <template v-if="!readonly">
          <button type="button" class="ButtonClass ClearButton" @click="clearEditor">
            <i class="fas fa-sync" aria-hidden="true" /> クリア
          </button>
          <button type="button" class="ButtonClass SaveButton" @click="commitEditor">
            <i class="fas fa-save" aria-hidden="true" /> 完了
          </button>
        </template>
      </template>
    </BaseDialog>
    <DatePickerDialog
      v-model="calendarOpen"
      :value="value"
      :fixed-mode="dateMode"
      :readonly="readonly"
      @commit="setValue"
    />
  </FieldFrame>
</template>
