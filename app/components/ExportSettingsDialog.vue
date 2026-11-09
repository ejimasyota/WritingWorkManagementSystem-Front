<script setup lang="ts">
import { ref, watch } from 'vue';
import items from '../utils/exportItems.json';
const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits(['update:modelValue', 'export']);
const selected = ref<string[]>([]);
const type = ref('word');
const newLine = ref(true);
const sortOrder = ref('asc');
const font = ref('ＭＳ ゴシック');
const cover = ref(true);
const error = ref('');
const fonts = ['ＭＳ ゴシック', 'ＭＳ 明朝', 'ＭＳ Ｐゴシック', 'ＭＳ Ｐ明朝', 'メイリオ', '游ゴシック', '游明朝'];
watch(() => props.modelValue, open => {
  if (!open) return;
  selected.value = items.map(item => item.key);
  type.value = 'word';
  newLine.value = true;
  sortOrder.value = 'asc';
  font.value = 'ＭＳ ゴシック';
  cover.value = true;
  error.value = '';
});
function selectAll(event: Event) {
  selected.value = (event.target as HTMLInputElement).checked ? items.map(item => item.key) : [];
}
function close() {
  emit('update:modelValue', false);
}
function submit() {
  if (!selected.value.length) {
    error.value = '出力項目を1つ以上選択してください';
    return;
  }
  emit('export', {
    ExportItems: [...selected.value],
    ExportType: type.value,
    NewLine: newLine.value,
    SortOrder: sortOrder.value,
    Font: font.value,
    Cover: cover.value
  });
}
</script>

<template>
  <BaseDialog
    :close-on-escape="false"
    :model-value="modelValue"
    title="出力設定"
    title-icon="fas fa-cog"
    icon-color="#3498db"
    size="DialogMedium"
    @update:model-value="close"
  >
    <div class="DialogSection">
      <label class="DialogSectionTitle" for="ExportType">
        出力形式
      </label>
      <SelectBoxComponent v-model="type" inline input-id="ExportType" hide-list-button :options="[{ value: 'word', label: 'Word（.docx）' }, { value: 'html', label: 'HTML（.html）' }]" />
    </div>
    <div class="DialogSection">
      <label class="DialogSectionTitle">
        出力する項目の選択
      </label>
      <CheckBoxComponent inline wrapper-class="ExportSelectAll" :model-value="selected.length === items.length" @change="selectAll">すべて選択</CheckBoxComponent>
      <div class="ExportItemGrid">
        <CheckBoxComponent v-for="item in items" :key="item.key" v-model="selected" inline :option-value="item.key">{{ item.label }}</CheckBoxComponent>
      </div>
    </div>
    <div class="DialogSection">
      <label class="DialogSectionTitle">
        改行コードの認識
      </label>
      <CheckBoxComponent v-model="newLine" inline>改行コードを認識して出力する</CheckBoxComponent>
    </div>
    <div class="DialogSection">
      <label class="DialogSectionTitle">
        出力データの並び順
      </label>
      <RadioButtonComponent v-model="sortOrder" inline :options="[{ value: 'asc', label: '昇順' }, { value: 'desc', label: '降順' }]" />
    </div>
    <div class="DialogSection">
      <label class="DialogSectionTitle" for="ExportFont">
        出力時の文字フォント
      </label>
      <SelectBoxComponent v-model="font" inline input-id="ExportFont" hide-list-button :options="fonts.map(item => ({ value: item, label: item }))" />
    </div>
    <div class="DialogSection">
      <label class="DialogSectionTitle">
        表紙の出力
      </label>
      <CheckBoxComponent v-model="cover" inline>表紙を含めて出力する</CheckBoxComponent>
    </div>
    <p v-if="error" role="alert">
      {{ error }}
    </p>
    <template #actions>
      <ButtonComponent type="button" variant="CloseButton" @click="close">
        <i class="fas fa-times" />
        閉じる
      </ButtonComponent>
      <ButtonComponent type="button" variant="SuccessButton" @click="submit">
        <i class="fas fa-file-export" />
        出力
      </ButtonComponent>
    </template>
  </BaseDialog>
</template>
