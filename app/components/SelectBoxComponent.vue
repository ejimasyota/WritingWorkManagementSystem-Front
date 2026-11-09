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
    <div :class="inline && hideListButton ? 'InlineField' : 'InputWithButton'">
      <select
        ref="inputElement"
        :id="id"
        class="SelectForm"
        :class="{ HasError: error }"
        :value="value"
        :disabled="readOnlyFlg"
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
      <ButtonComponent
        v-if="!hideListButton"
        type="button"
        variant="SecondaryButton ButtonSmall"
        :disabled="!hasOptionFlg || readOnlyFlg"
        aria-label="一覧から選択"
        @click="openListDialog"
      >
        <i class="fas fa-list" aria-hidden="true" />
      </ButtonComponent>
    </div>

    <BaseDialog v-model="listDialogOpenFlg" :title="listTitle" size="DialogMedium">
      <div class="OptionSearchArea">
        <TextFieldComponent v-model="searchKeyWord" inline aria-label="検索" placeholder="検索" />
      </div>
      <div class="OptionSearchList">
        <div
          v-for="option in filteredOptions"
          :key="option.value"
          class="OptionSearchItem"
          :class="{
            Selected: String(value) === String(option.value),
            Unset: option.label === '',
            ReadOnly: readOnlyFlg || option.disabled,
          }"
          :title="option.label || '(未選択)'"
          role="button"
          :tabindex="readOnlyFlg || option.disabled ? -1 : 0"
          :aria-disabled="readOnlyFlg || option.disabled"
          @click="selectOption(option)"
          @keydown.enter.prevent="selectOption(option)"
          @keydown.space.prevent="selectOption(option)"
        >{{ option.label || '(未選択)' }}</div>
        <div v-if="!filteredOptions.length" class="OptionSearchEmpty">
          {{ searchKeyWord.trim() ? messageFormat("ERROR","E_0009") : messageFormat("ERROR","E_0010") }}
        </div>
      </div>
    </BaseDialog>
  </FieldFrame>
</template>
<script setup lang="ts">
/* ==========================================================
 * モジュールインポート
 * ========================================================== */
// 1. Vue関連（型）
import type { PropType } from 'vue';
// 2. 共通型定義
import type { SelectOption } from '../types/utilType';
// 3. フォーム共通定義
import { fieldProps } from '../composables/componentProps';
// 4. Vue関連
import { computed, ref, useId } from 'vue';
// 5. メッセージ共通処理
import { messageFormat } from '../utils/messages';

/* ==========================================================
 * 属性定義
 * ========================================================== */
defineOptions({
  // 1. 親からの属性を引き継がない
  inheritAttrs: false
});

/* ==========================================================
 * props定義
 * ========================================================== */
const props = defineProps({
  // 1. フォーム共通定義
  ...fieldProps,
  // 2. 値
  modelValue: [String, Number],
  // 呼出元が入力要素のIDを指定する場合に使用
  inputId: String,
  // 3. リストダイアログ表示ボタン表示制御FLG
  hideListButton: Boolean,
  // 4. 項目
  options: {
    type: Array as PropType<SelectOption[]>,
    default: () => []
  }
});

/* ==========================================================
 * emit定義
 * ========================================================== */
const emit = defineEmits<{
  // 1. 選択値
  'update:modelValue': [value: string | number];
}>();

/* ==========================================================
 * 定義
 * ========================================================== */
// 1. 一意のIDを生成
const generatedId = useId();
const id = computed(() => props.inputId || generatedId);
// 2. 共通処理群を取得
const { value, setValue, getValue } = useFieldValue<string | number>(props, emit, '');
// 3. リストダイアログ表示制御FLG
const listDialogOpenFlg = ref(false);
// 4. 検索語句
const searchKeyWord = ref('');
// 5. 入力フォーム要素
const inputElement = ref<HTMLSelectElement>();

/* ==========================================================
 * 算出プロパティ
 * ========================================================== */
/**
 * 選択可能な項目が存在するかを判定するFLG
 */
// 数値の0は有効な選択肢として扱う。
const hasOptionFlg = computed(() => {
  // 1. 選択肢の配列を確認し、空文字列ではない値を持つ項目が1つでもあればTRUE、なければFALSEを返却する
  return props.options.some(option => String(option.value) !== '')
});

/**
 * リストダイアログのタイトル設定
 */
const listTitle = computed(() => {
  // 1. 指定があれば「〇〇の一覧」形式で表示を行い、そうでなければデフォルトのタイトルを表示
  return props.label ? `${props.label}の一覧` : '一覧から選択'
});

/**
 * 読み取り専用FLG
 */
const readOnlyFlg = computed(() => {
  // 1. 非活性又は読み取り専用となっている場合
  return props.disabled || props.readonly
});

/**
 * 入力キーワードに一致するリストの設定
 */
const filteredOptions = computed(() => {
  // 1. 入力されたキーワードを取得
  const keyword = searchKeyWord.value.trim().toLowerCase();
  // 2. 一致するリストを返却
  return props.options.filter(option => option.label.toLowerCase().includes(keyword));
});

/**
 * リストダイアログ表示処理
 */
function openListDialog() {
  /* ------------------------------
   * 1. 選択不可の項目が存在する場合
   * ------------------------------*/
  // 非活性・読み取り専用の場合も一覧を開かない
  if (readOnlyFlg.value || !hasOptionFlg.value){
    // 1. 処理終了
    return;
  }

  /* ------------------------------
   * 2. リストダイアログ表示処理
   * ------------------------------*/
  // 1. 検索キーワードを初期化
  searchKeyWord.value = '';
  // 2. リストダイアログを表示
  listDialogOpenFlg.value = true;
}

/**
 * 項目を選択した際の処理
 * @param option 選択項目
 */
function selectOption(option: SelectOption) {
  /* ------------------------------
   * 1. 読み取り専用または非活性の場合
   * ------------------------------*/
  if (readOnlyFlg.value || option.disabled) {
    // 1. 処理終了
    return;
  }

  /* ------------------------------
   * 2. 終了時処理
   * ------------------------------*/
  // 通常の選択欄と一覧ダイアログで更新処理を共用する。
  // 1. 選択された値の設定
  setValue(option.value);
  // 2. リストダイアログを削除
  listDialogOpenFlg.value = false;
}

/**
 * 値の変更時イベント
 * @param event DOM
 */
function updateSelect(event: Event) {
  /* ------------------------------
   * 1. 値の設定処理
   * ------------------------------*/
  // DOMの文字列値ではなく元の選択肢を使い、数値型を維持する。
  // 1. 選択された項目のインデックスを取得
  const index = (event.target as HTMLSelectElement).selectedIndex;
  // 2. 選択された項目を保持
  const option = props.options[index];

  /* ------------------------------
   * 2. 選択された項目が存在する場合
   * ------------------------------*/
  if (option) {
    // 1. 選択された項目を設定
    selectOption(option);
  }
}

/**
 * フォーカス設定
 */
function focus() {
  // 1. 入力フォームへフォーカスを設定
  inputElement.value?.focus();
}

/* ==========================================================
 * 公開メソッド
 * ========================================================== */
defineExpose({
  // 1. フォーカス設定
  focus,
  // 2. セット処理
  setValue,
  // 3. 取得処理
  getValue
});
</script>
