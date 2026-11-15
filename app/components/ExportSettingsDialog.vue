<script setup lang="ts">
import { messageFormat } from '../utils/messages';
import { useInputFields } from '../composables/useInputFields';
import { ref, watch } from 'vue';
import type { BackendRequest } from '../types/backend';
import type { PageDialogs } from '../composables/usePageDialogs';
import { useOperationSpinner } from '../composables/useOperationSpinner';
import { requireSuccess, reportBackendError } from '../utils/backend';
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
  workId?: string;
  request?: BackendRequest;
  dialogs?: PageDialogs;
}>(), {
  showItems: true
});
const emit = defineEmits(['update:modelValue', 'export']);
const selected = ref<string[]>([]);
const report = ref('Document');
const stories = ref<Record<string, unknown>[]>([]);
const plots = ref<Record<string, unknown>[]>([]);
const optionsReady = ref(false);
const spinner = useOperationSpinner();
let optionsVersion = 0;

function changeReport() {
  report.value = inputFields.getValue('report', 'Document');
  error.value = '';
}
const type = ref('word');
const newLine = ref(true);
const sortOrder = ref('asc');
const font = ref('ＭＳ ゴシック');
const cover = ref(true);
const error = ref('');
const fonts = ['ＭＳ ゴシック', 'ＭＳ 明朝', 'ＭＳ Ｐゴシック', 'ＭＳ Ｐ明朝', 'メイリオ', '游ゴシック', '游明朝'];
watch(() => [props.modelValue, props.workId] as const, async ([open]) => {
  const version = ++optionsVersion;
  if (!open) return;
  report.value = 'Document';
  stories.value = [];
  plots.value = [];
  optionsReady.value = false;
  selected.value = items.map(item => item.key);
  type.value = 'word';
  newLine.value = true;
  sortOrder.value = 'asc';
  font.value = 'ＭＳ ゴシック';
  cover.value = true;
  error.value = '';
  inputFields.setValues({
    report: 'Document',
    StoryId: '',
    PlotId: '',
    type: type.value,
    newLine: newLine.value,
    sortOrder: sortOrder.value,
    font: font.value,
    cover: cover.value,
    all: true
  });
  for (const item of items) inputFields.setValue('item:' + item.key, true);
  if (props.showItems && props.workId && props.request) {
    try {
      const request = props.request;
      const data = requireSuccess(await spinner.run(() => request<{
        StoryList: Record<string, unknown>[];
        PlotList: Record<string, unknown>[];
      }>('/GetNarrativeExportOptions.php?WorkId=' + encodeURIComponent(props.workId!))), messageFormat('ERROR', 'E_0003', '出力対象の取得'));
      if (version !== optionsVersion || !props.modelValue) return;
      if (!Array.isArray(data?.StoryList) || !Array.isArray(data.PlotList)) throw new Error(messageFormat('ERROR', 'E_0026'));
      stories.value = data.StoryList;
      plots.value = data.PlotList;
      optionsReady.value = true;
    } catch (error) {
      if (version === optionsVersion && props.dialogs) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '出力対象の取得'));
    }
  }
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
  if (report.value === 'Document') readItems();
  if (props.showItems && report.value !== 'Document') {
    const key = report.value === 'Story' ? 'StoryId' : 'PlotId';
    const value = inputFields.getValue(key, '');
    const candidates = report.value === 'Story' ? stories.value : plots.value;
    if (!optionsReady.value || !value || !candidates.some(item => String(item[key]) === String(value))) {
      error.value = messageFormat('ERROR', 'E_0091');
      return;
    }
  }
  if (props.showItems !== false && report.value === 'Document' && !selected.value.length) {
    error.value = messageFormat('ERROR', 'E_0013');
    return;
  }
  error.value = '';
  emit('export', {
    ReportType: report.value,
    StoryId: inputFields.getValue('StoryId', ''),
    PlotId: inputFields.getValue('PlotId', ''),
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
      <label class="DialogSectionTitle">出力帳票</label>
      <SelectBoxComponent
        :ref="el=>inputFields.register('report',el,report)"
        inline
        aria-label="出力帳票"
        :options="[{value:'Document',label:'作品資料'},{value:'Story',label:'ストーリー'},{value:'Plot',label:'プロット'}]"
        @value-change="changeReport"
       />
    </div>
    <div
      v-if="showItems !== false"
      class="DialogSection"
    >
      <label class="DialogSectionTitle">出力する項目の選択</label>
      <template v-if="report === 'Document'">
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
      </template>
      <SelectBoxComponent
        v-if="report === 'Story'"
        :ref="el=>inputFields.register('StoryId',el,'')"
        label="ストーリー"
        :hide-list-button="false"
        :options="[{value:'',label:''},...stories.map(item=>({value:String(item.StoryId),label:String(item.StoryName)}))]"
       />
      <SelectBoxComponent
        v-if="report === 'Plot'"
        :ref="el=>inputFields.register('PlotId',el,'')"
        label="プロット"
        :hide-list-button="false"
        :options="[{value:'',label:''},...plots.map(item=>({value:String(item.PlotId),label:String(item.PlotName)}))]"
       />
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
