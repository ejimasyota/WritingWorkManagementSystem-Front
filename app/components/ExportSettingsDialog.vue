<script setup lang="ts">
import { messageFormat } from '../utils/messages';
import { useInputFields } from '../composables/useInputFields';
import { ref, watch } from 'vue';
// この出力設定ダイアログが扱う項目。
const items = [{
  "key": "Characters",
  "label": "キャラ一覧"
}, {
  "key": "Biographies",
  "label": "経歴一覧"
}, {
  "key": "Calendars",
  "label": "元号一覧"
}, {
  "key": "Buildings",
  "label": "建物一覧"
}, {
  "key": "Stages",
  "label": "舞台一覧"
}, {
  "key": "Organizations",
  "label": "組織一覧"
}, {
  "key": "Classes",
  "label": "階級一覧"
}, {
  "key": "Teams",
  "label": "チーム一覧"
}, {
  "key": "Races",
  "label": "種族一覧"
}, {
  "key": "Tags",
  "label": "タグ一覧"
}, {
  "key": "Powers",
  "label": "能力一覧"
}, {
  "key": "Weapons",
  "label": "武器一覧"
}, {
  "key": "Items",
  "label": "アイテム一覧"
}, {
  "key": "Moves",
  "label": "技一覧"
}, {
  "key": "Timelines",
  "label": "年表一覧"
}, {
  "key": "Chapters",
  "label": "チャプター一覧"
}, {
  "key": "Clues",
  "label": "伏線一覧"
}, {
  "key": "Serifs",
  "label": "セリフメモ一覧"
}, {
  "key": "Exchanges",
  "label": "掛け合い一覧"
}, {
  "key": "Terms",
  "label": "作中用語一覧"
}, {
  "key": "WorkMemos",
  "label": "作品作成用メモ一覧"
}];
const inputFields = useInputFields();
const props = withDefaults(defineProps<{
  modelValue: boolean;
  showItems?: boolean;
}>(), {
  showItems: true
});
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
  inputFields.setValues({
    type: type.value,
    newLine: newLine.value,
    sortOrder: sortOrder.value,
    font: font.value,
    cover: cover.value,
    all: true
  });
  for (const item of items) inputFields.setValue('item:' + item.key, true);
});

function selectAll() {
  const checked = inputFields.getValue('all', false);
  for (const item of items) inputFields.setValue('item:' + item.key, checked);
  readItems();
}

function readItems() {
  selected.value = items.filter(item => inputFields.getValue('item:' + item.key, false)).map(item => item.key);
  inputFields.setValue('all', selected.value.length === items.length);
}

function close() {
  emit('update:modelValue', false);
}

function submit() {
  readItems();
  if (props.showItems !== false && !selected.value.length) {
    error.value = messageFormat('ERROR', 'E_0013');
    return;
  }
  emit('export', {
    ExportItems: [...selected.value],
    ExportType: inputFields.getValue('type', type.value),
    NewLine: inputFields.getValue('newLine', newLine.value),
    SortOrder: inputFields.getValue('sortOrder', sortOrder.value),
    Font: inputFields.getValue('font', font.value),
    Cover: inputFields.getValue('cover', cover.value)
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
      <label
        class="DialogSectionTitle"
        for="ExportType"
      >出力形式</label>
      <SelectBoxComponent
        :ref="el => inputFields.register('type', el, type)"
        inline
        input-id="ExportType"
        hide-list-button
        :options="[{ value: 'word', label: 'Word（.docx）' }, { value: 'html', label: 'HTML（.html）' }]"
      />
    </div>
    <div
      v-if="showItems !== false"
      class="DialogSection"
    >
      <label class="DialogSectionTitle">出力する項目の選択</label>
      <CheckBoxComponent
        inline
        wrapper-class="ExportSelectAll"
        :ref="el => inputFields.register('all', el, selected.length === items.length)"
        @change="selectAll"
      >すべて選択</CheckBoxComponent>
      <div class="ExportItemGrid">
        <CheckBoxComponent
          v-for="item in items"
          :key="item.key"
          :ref="el => inputFields.register('item:' + item.key, el, selected.includes(item.key))"
          inline
          @change="readItems"
        >{{ item.label }}</CheckBoxComponent>
      </div>
    </div>
    <div class="DialogSection">
      <label class="DialogSectionTitle">改行コードの認識</label>
      <CheckBoxComponent
        :ref="el => inputFields.register('newLine', el, newLine)"
        inline
      >改行コードを認識して出力する</CheckBoxComponent>
    </div>
    <div class="DialogSection">
      <label class="DialogSectionTitle">出力データの並び順</label>
      <RadioButtonComponent
        :ref="el => inputFields.register('sortOrder', el, sortOrder)"
        inline
        :options="[{ value: 'asc', label: '昇順' }, { value: 'desc', label: '降順' }]"
      />
    </div>
    <div class="DialogSection">
      <label
        class="DialogSectionTitle"
        for="ExportFont"
      >出力時の文字フォント</label>
      <SelectBoxComponent
        :ref="el => inputFields.register('font', el, font)"
        inline
        input-id="ExportFont"
        hide-list-button
        :options="fonts.map(item => ({ value: item, label: item }))"
      />
    </div>
    <div class="DialogSection">
      <label class="DialogSectionTitle">表紙の出力</label>
      <CheckBoxComponent
        :ref="el => inputFields.register('cover', el, cover)"
        inline
      >表紙を含めて出力する</CheckBoxComponent>
    </div>
    <p
      v-if="error"
      role="alert"
    >{{ error }}</p>
    <template #actions>
      <ButtonComponent
        type="button"
        variant="CloseButton"
        @click="close"
      >
        <i class="fas fa-times" />
        閉じる
      </ButtonComponent>
      <ButtonComponent
        type="button"
        variant="SuccessButton"
        @click="submit"
      >
        <i class="fas fa-file-export" />
        出力
      </ButtonComponent>
    </template>
  </BaseDialog>
</template>
