<script setup lang="ts">
import type { PropType } from 'vue';
import type { SelectOption } from '../types/utilType';
import { fieldProps } from '../composables/componentProps';
import { computed, ref, useId } from 'vue';
defineOptions({
  inheritAttrs: false
});
const props = defineProps({
  ...fieldProps,
  modelValue: [String, Number],
  hideListButton: Boolean,
  options: {
    type: Array as PropType<SelectOption[]>,
    default: () => []
  }
});
const emit = defineEmits<{
  'update:modelValue': [value: string | number];
}>();
const id = useId();
const {
  value,
  setValue,
  getValue
} = useFieldValue<string | number>(props, emit, '');
const hasOptions = computed(() => props.options.some(option => String(option.value) !== ''));
const listTitle = computed(() => props.label ? `${props.label}の一覧` : '一覧から選択');
const listOpen = ref(false);
const search = ref('');
const readOnly = computed(() => props.disabled || props.readonly);
const filteredOptions = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  return props.options.filter(option => option.label.toLowerCase().includes(keyword));
});
function openList() {
  if (!hasOptions.value) return;
  search.value = '';
  listOpen.value = true;
}
function selectOption(option: SelectOption) {
  if (readOnly.value || option.disabled) return;
  setValue(option.value);
  listOpen.value = false;
}
function updateSelect(event: Event) {
  const index = (event.target as HTMLSelectElement).selectedIndex;
  const option = props.options[index];
  if (option) selectOption(option);
}

// 旧 ShowOptionSearchDialog と同様、無効・参照時も一覧の閲覧はできる。
defineExpose({
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
  >
    <div class="InputWithButton">
      <select
        :id="id"
        class="SelectForm"
        :class="{ HasError: error }"
        :value="value"
        :disabled="readOnly"
        :required="required"
        :aria-invalid="!!error"
        v-bind="$attrs"
        @change="updateSelect"
      >
        <option
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          :disabled="option.disabled"
        >
          {{ option.label }}
        </option>
      </select>
      <button
        type="button"
        class="ButtonClass SecondaryButton ButtonSmall"
        v-if="!hideListButton"
        aria-label="一覧から選択"
        :disabled="!hasOptions"
        @click="openList"
      >
        <i class="fas fa-list" aria-hidden="true" />
      </button>
    </div>

    <BaseDialog v-model="listOpen" :title="listTitle" size="DialogMedium">
      <div class="OptionSearchArea">
        <input v-model="search" aria-label="検索" placeholder="検索" class="InputForm">
      </div>
      <div class="OptionSearchList">
        <div
          v-for="option in filteredOptions"
          :key="option.value"
          class="OptionSearchItem"
          :class="{
            Selected: String(value) === String(option.value),
            Unset: option.label === '',
            ReadOnly: readOnly || option.disabled,
          }"
          :title="option.label || '(未選択)'"
          role="button"
          :tabindex="readOnly || option.disabled ? -1 : 0"
          :aria-disabled="readOnly || option.disabled"
          @click="selectOption(option)"
          @keydown.enter.prevent="selectOption(option)"
          @keydown.space.prevent="selectOption(option)"
        >{{ option.label || '(未選択)' }}</div>
        <div v-if="!filteredOptions.length" class="OptionSearchEmpty">
          {{ search.trim() ? '該当する項目がありません' : '選択できる項目がありません' }}
        </div>
      </div>
    </BaseDialog>
  </FieldFrame>
</template>
