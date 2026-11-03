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
      <select id="ExportType" v-model="type" class="InputForm">
        <option value="word">
          Word（.docx）
        </option>
        <option value="html">
          HTML（.html）
        </option>
      </select>
    </div>
    <div class="DialogSection">
      <label class="DialogSectionTitle">
        出力する項目の選択
      </label>
      <label class="CheckboxWrapper ExportSelectAll">
        <input type="checkbox" :checked="selected.length === items.length" @change="selectAll">
        すべて選択
      </label>
      <div class="ExportItemGrid">
        <label v-for="item in items" :key="item.key" class="CheckboxWrapper">
          <input v-model="selected" type="checkbox" :value="item.key">
          {{ item.label }}
        </label>
      </div>
    </div>
    <div class="DialogSection">
      <label class="DialogSectionTitle">
        改行コードの認識
      </label>
      <label class="CheckboxWrapper">
        <input v-model="newLine" type="checkbox">
        改行コードを認識して出力する
      </label>
    </div>
    <div class="DialogSection">
      <label class="DialogSectionTitle">
        出力データの並び順
      </label>
      <div class="ChoiceGroup">
        <label class="CheckboxWrapper">
          <input v-model="sortOrder" type="radio" value="asc">
          昇順
        </label>
        <label class="CheckboxWrapper">
          <input v-model="sortOrder" type="radio" value="desc">
          降順
        </label>
      </div>
    </div>
    <div class="DialogSection">
      <label class="DialogSectionTitle" for="ExportFont">
        出力時の文字フォント
      </label>
      <select id="ExportFont" v-model="font" class="InputForm">
        <option v-for="item in fonts" :key="item">
          {{ item }}
        </option>
      </select>
    </div>
    <div class="DialogSection">
      <label class="DialogSectionTitle">
        表紙の出力
      </label>
      <label class="CheckboxWrapper">
        <input v-model="cover" type="checkbox">
        表紙を含めて出力する
      </label>
    </div>
    <p v-if="error" role="alert">
      {{ error }}
    </p>
    <template #actions>
      <button type="button" class="ButtonClass CloseButton" @click="close">
        <i class="fas fa-times" />
        閉じる
      </button>
      <button type="button" class="ButtonClass SuccessButton" @click="submit">
        <i class="fas fa-file-export" />
        出力
      </button>
    </template>
  </BaseDialog>
</template>
