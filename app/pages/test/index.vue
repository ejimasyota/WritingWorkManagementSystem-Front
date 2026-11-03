<script setup lang="ts">
import { computed, ref } from 'vue';
import UtilLayout from '../../layouts/UtilLayout.vue';
import type { TableColumn } from '../../composables/tableData';

definePageMeta({ middleware: ['auth'], requiresAuth: true, requiresAdmin: true });
const admin = ref(false);
const active = ref('MenuWorkManagement');
const message = ref('');
const text = ref('入力例');
const select = ref<string | number>('novel');
const toggle = ref(true);
const check = ref(false);
const radio = ref<string | number>('asc');
const memo = ref('複数行の入力例\n改行を保持します');
const textRef = ref<{
  setValue: (v: string) => void;
  getValue: () => string;
}>();
const info = ref(false);
const error = ref(false);
const confirm = ref(false);
const image = ref(false);
const hideMeta = ref(false);
const editable = ref(true);
const loading = ref(false);
const options = [{
  label: '(未選択)',
  value: ''
}, {
  label: '小説',
  value: 'novel'
}, {
  label: '漫画',
  value: 'comic'
}, {
  label: '選択不可',
  value: 'disabled',
  disabled: true
}];
const columns: TableColumn[] = [{
  key: 'id',
  label: '番号',
  sortable: true,
  type: 'number'
}, {
  key: 'name',
  label: '作品名',
  sortable: true,
  filterable: true
}, {
  key: 'tags',
  label: 'タグ',
  filterable: true
}, {
  key: 'updateDate',
  label: '更新日時',
  sortable: true,
  type: 'date',
  meta: true
}];
const rows = ref(Array.from({
  length: 27
}, (_, i) => ({
  id: i + 1,
  name: '作品 ' + (i + 1),
  tags: i % 3 === 0 ? [] : i % 2 ? ['小説', '冒険'] : ['漫画'],
  updateDate: `2026-10-${String(i + 1).padStart(2, '0')}`
})));
const session = computed(() => ({
  UserId: 'test',
  IsAdmin: admin.value
}));
function handleNavigate(menuId: string) {
  active.value = menuId;
  message.value = '選択: ' + menuId;
}
</script>
<template>
  <UtilLayout
    :session="session"
    :active-menu="active"
    @navigate="handleNavigate"
    @logout="message = 'ログアウトイベント'"
    @settings="message = '設定イベント'"
    @notifications="message = '通知イベント'"
  >
    <div class="ComponentList">
      <h1>
        コンポーネントリスト
      </h1>
      <p role="status">
        {{ message }}
      </p>
      <section class="ComponentSection">
        <h2>
          表示権限
        </h2>
        <ToogleComponent
          v-model="admin"
          label="管理者メニュー"
          info-icon-flg
          info-message="旧フロントと同様、IsAdmin が true の場合に管理者メニューを表示します。"
        />
      </section>
      <section class="ComponentSection">
        <h2>
          入力フォーム
        </h2>
        <div class="ComponentGrid">
          <TextFieldComponent
            ref="textRef"
            v-model="text"
            label="通常入力・詳細編集"
            required
            text-area-flg
            info-icon-flg
            info-message="詳細ボタンで複数行を編集できます。閉じる場合は変更を反映しません。"
          />
          <TextFieldComponent label="未入力" placeholder="入力してください" />
          <TextFieldComponent model-value="編集不可" label="無効" disabled text-area-flg />
          <TextFieldComponent model-value="参照値" label="読み取り専用" readonly text-area-flg />
          <TextFieldComponent label="エラー" error="必須項目を入力してください" required />
          <TextFieldComponent model-value="2026-11-02" label="日付" date-picker-flg />
          <TextFieldComponent model-value="2026" label="日付（年・参照）" date-picker-flg readonly />
          <SelectBoxComponent
            v-model="select"
            :options="options"
            label="セレクト"
            info-icon-flg
            info-message="一覧ボタンで候補を検索できます。"
          />
          <SelectBoxComponent
            model-value="novel"
            :options="options"
            label="セレクト（無効・一覧参照）"
            disabled
          />
          <SelectBoxComponent label="候補なし" :options="[]" />
          <ToogleComponent
            v-model="toggle"
            label="切替"
            info-icon-flg
            info-message="有効・無効を切り替えます。"
          />
          <ToogleComponent label="切替（無効）" disabled />
          <RadioButtonComponent
            v-model="radio"
            label="ラジオ"
            :options="[{label:'昇順',value:'asc'},{label:'降順',value:'desc'}]"
            info-icon-flg
            info-message="いずれか一つを選択します。"
          />
          <RadioButtonComponent
            model-value="asc"
            label="ラジオ（無効）"
            :options="[{label:'昇順',value:'asc'}]"
            disabled
          />
          <CheckBoxComponent
            v-model="check"
            label="チェック"
            info-icon-flg
            info-message="選択状態を保持します。"
          />
          <CheckBoxComponent :model-value="true" label="チェック（無効）" disabled />
          <TextAreaComponent
            v-model="memo"
            label="テキストエリア"
            info-icon-flg
            info-message="改行を含む文章を入力します。"
          />
          <TextAreaComponent model-value="参照用の文章" label="テキストエリア（参照）" readonly />
          <TextAreaComponent model-value="変更不可" label="テキストエリア（無効）" disabled />
        </div>
        <div class="DialogExamples">
          <ButtonComponent model-value="公開メソッドで値を設定" @click="textRef?.setValue('公開メソッドで設定しました')" />
          <ButtonComponent
            model-value="公開メソッドで値を取得"
            variant="SecondaryButton"
            @click="message = textRef?.getValue() || '(空白)'"
          />
          <ButtonComponent model-value="無効ボタン" disabled />
        </div>
      </section>
      <section class="ComponentSection">
        <h2>
          ダイアログ
        </h2>
        <div class="DialogExamples">
          <ButtonComponent model-value="インフォ" @click="info = true" />
          <ButtonComponent model-value="エラー" variant="DeleteButton" @click="error = true" />
          <ButtonComponent model-value="確認" @click="confirm = true" />
          <ButtonComponent model-value="画像" @click="image = true" />
        </div>
        <InfoDialog v-model="info" title="項目説明" message="旧フロントのデザインに準拠した説明です。&#10;改行も保持します。" />
        <ErrorDialog v-model="error" message="入力内容を確認してください。" />
        <ConfirmDialog
          v-model="confirm"
          message="この内容で実行しますか？"
          @confirm="message = 'はいを選択しました'"
          @cancel="message = '確認をキャンセルしました'"
        />
        <ImageDialog
          v-model="image"
          src="/images/sample.png"
          alt="サンプル画像"
          can-delete
          @delete="message = '画像削除イベント'"
        />
      </section>
      <section class="ComponentSection">
        <h2>
          一覧
        </h2>
        <div class="DialogExamples">
          <CheckBoxComponent v-model="hideMeta" label="メタ情報非表示" />
          <CheckBoxComponent v-model="editable" label="編集権限" />
          <CheckBoxComponent v-model="loading" label="読み込み中" />
        </div>
        <TableComponent
          :rows="rows"
          :columns="columns"
          :page-size="5"
          :can-edit="editable"
          :hide-meta="hideMeta"
          :loading="loading"
          selectable
          @edit="message = '編集: ' + $event.name"
          @delete="message = '削除要求: ' + $event.name"
          @selection-change="message = '選択: ' + $event.join(', ')"
        >
          <template #cell-name="{ value }">
            <strong>
              {{ value }}
            </strong>
          </template>
        </TableComponent>
        <h3>
          空の一覧・参照専用
        </h3>
        <TableComponent :rows="[]" :columns="columns" />
      </section>
    </div>
  </UtilLayout>
</template>
