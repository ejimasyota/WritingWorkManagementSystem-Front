<script setup lang="ts">
import { ref, watch } from 'vue';
import { genreOptions } from '../utils/mainView';
const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits(['update:modelValue', 'create']);
const title = ref('');
const genre = ref<string | number>(0);
const error = ref('');
const titleField = ref<{
  focus: () => void;
}>();
watch(() => props.modelValue, open => {
  if (!open) return;
  title.value = '';
  genre.value = 0;
  error.value = '';
});
function close() {
  emit('update:modelValue', false);
}
function create() {
  if (!title.value.trim()) {
    error.value = '作品名を入力してください';
    titleField.value?.focus();
    return;
  }
  emit('create', {
    WorkTitle: title.value.trim(),
    Genre: Number(genre.value)
  });
  close();
}
</script>

<template>
  <BaseDialog :model-value="modelValue" title="作品作成" @update:model-value="close">
    <TextFieldComponent
      ref="titleField"
      v-model="title"
      label="作品名"
      maxlength="50"
      :error="error"
      required
    />
    <SelectBoxComponent v-model="genre" label="ジャンル" :options="genreOptions" />
    <template #actions>
      <ButtonComponent type="button" variant="CloseButton" @click="close">
        <i class="fas fa-times" />
        閉じる
      </ButtonComponent>
      <ButtonComponent type="button" variant="SaveButton" @click="create">
        <i class="fas fa-plus" />
        作成
      </ButtonComponent>
    </template>
  </BaseDialog>
</template>
