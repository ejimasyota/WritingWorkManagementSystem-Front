<script setup lang="ts">
import { messageFormat } from '../utils/messages';

import { useInputFields } from '../composables/useInputFields';
import { ref, watch } from 'vue';
import { genreOptions } from '../utils/mainView';

const inputFields = useInputFields();
const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits(['update:modelValue', 'create']);
const title = ref('');
const genre = ref<string | number>(0);
const error = ref('');
watch(() => props.modelValue, open => {
  if (!open) return;
  title.value = '';
  genre.value = 0;
  error.value = '';
  inputFields.setValues({ title: title.value, genre: genre.value });
});
function close() {
  emit('update:modelValue', false);
}
function create() {
  title.value = inputFields.getValue('title', '');
  genre.value = inputFields.getValue<string | number>('genre', 0);
  if (!title.value.trim()) {
    error.value = messageFormat('ERROR', 'E_0001', '作品名');
    inputFields.focus('title');
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

      :ref="el => inputFields.register('title', el, title)"
      label="作品名"
      maxlength="50"
      :error="error"
      required
    />
    <SelectBoxComponent :ref="el => inputFields.register('genre', el, genre)" label="ジャンル" :options="genreOptions" />
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
