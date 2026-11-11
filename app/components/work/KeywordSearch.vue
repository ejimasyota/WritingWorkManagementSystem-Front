<script setup lang="ts">
import { nextTick, onMounted, onBeforeUnmount, ref } from 'vue';
import type { BackendRequest } from '../../types/backend';
import type { WorkInfo } from '../../types/work';
import type { SearchResult, SearchScreen, SearchQuery } from '../../types/search';
import type { PageDialogs } from '../../composables/usePageDialogs';
import type { TableColumn } from '../../composables/tableData';
import { useInputFields } from '../../composables/useInputFields';
import { useOperationSpinner } from '../../composables/useOperationSpinner';
import { readWorkAccess } from '../../utils/workAccess';
import { requireSuccess, reportBackendError } from '../../utils/backend';
import { messageFormat } from '../../utils/messages';
import { resolveWorkMenu, workLocation } from '../../utils/workNavigation';
const props = defineProps<{
  request: BackendRequest;
  dialogs: PageDialogs;
  isAdmin: boolean;
  hideMeta?: boolean;
}>();
const auth = useAuthSession();
const fields = useInputFields();
const spinner = useOperationSpinner();
const role = ref('');
const work = ref<WorkInfo>();
const canEdit = ref(false);
const busy = ref(false);
const screens = ref<SearchScreen[]>([]);
const rows = ref<SearchResult[]>([]);
const keyword = ref('');
const replaceMode = ref(false);
const collapsed = ref(false);
const errors = ref<Record<string, string>>({});
const preview = ref<SearchResult>();
const previewOpen = ref(false);
// 条件だけをユーザー・作品単位で保持する。戻ったときは現在のDBを再検索する。
const queries = useState<Record<string, SearchQuery>>('KeywordQueries:' + auth.user.value?.UserId, () => ({}));
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
});
const columns: TableColumn[] = [{
  key: 'ScreenName',
  label: '画面名',
  sortable: true,
  filterable: true
}, {
  key: 'MatchedColumnLabel',
  label: '対象列',
  sortable: true,
  filterable: true
}, {
  key: 'Content',
  label: '該当キーワード',
  sortable: true,
  filterable: true
}, {
  key: 'Action',
  label: '遷移',
  width: 120
}];

function selectAll() {
  const value = fields.getValue('All', true);
  for (const screen of screens.value) fields.setValue('Screen:' + screen.MenuId, value);
}

function readAll() {
  fields.setValue('All', screens.value.every(screen => fields.getValue('Screen:' + screen.MenuId, true)));
}

function changeReplaceMode() {
  replaceMode.value = fields.getValue('ReplaceMode', false);
}

function condition() {
  const value = fields.getValue('Keyword', keyword.value).trim();
  const menuIds = screens.value.filter(screen => fields.getValue('Screen:' + screen.MenuId, true)).map(screen => screen.MenuId);
  errors.value = {};
  if (!value) errors.value.Keyword = messageFormat('ERROR', 'E_0001', 'キーワード');
  if (value.length > 100) errors.value.Keyword = messageFormat('ERROR', 'E_0002', 'キーワード', 100);
  if (!menuIds.length) errors.value.Screens = messageFormat('ERROR', 'E_0060');
  if (Object.keys(errors.value).length) {
    fields.focus('Keyword');
    return null;
  }
  return {
    Keyword: value,
    MenuIds: menuIds
  };
}

async function query(payload: SearchQuery) {
  const data = requireSuccess(await props.request<{
    Results: SearchResult[];
  }>('/GetSearchKeyword.php', 'POST', payload), messageFormat('ERROR', 'E_0003', 'キーワード検索'));
  if (!Array.isArray(data?.Results)) throw new Error(messageFormat('ERROR', 'E_0026'));
  if (disposed) return;
  rows.value = data.Results.map((row, index) => ({
    ...row,
    ResultKey: index
  }));
  keyword.value = payload.Keyword;
  if (work.value) queries.value[work.value.WorkId] = payload;
  collapsed.value = true;
}

async function search() {
  if (busy.value) return;
  const payload = condition();
  if (!payload) return;
  busy.value = true;
  try {
    await spinner.run(async () => {
      await readWorkAccess(props.request, work.value?.WorkId);
      if (!disposed) await query(payload);
    });
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'キーワード検索'));
  } finally {
    busy.value = false;
  }
}

async function replace() {
  if (!canEdit.value || busy.value) return;
  const payload = condition();
  if (!payload) return;
  const word = fields.getValue('ReplaceWord', '');
  if (word.length > 100) {
    errors.value.ReplaceWord = messageFormat('ERROR', 'E_0002', '置換後文字列', 100);
    return;
  }
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0023')))) return;
  busy.value = true;
  let count: number | null = null;
  try {
    await spinner.run(async () => {
      const access = await readWorkAccess(props.request, work.value?.WorkId);
      if (disposed || !(props.isAdmin || access.isCreator)) return;
      const result = requireSuccess(await props.request<{
        Count: number;
      }>('/ReplaceKeyword.php', 'POST', {
        ...payload,
        ReplaceWord: word,
        CaseSensitive: fields.getValue('CaseSensitive', false),
        UpdateDate: access.work.UpdateDate
      }), messageFormat('ERROR', 'E_0003', 'キーワード置換'));
      count = result.Count;
    });
    if (count !== null && !disposed) {
      rows.value = [];
      replaceMode.value = false;
      fields.setValues({
        ReplaceMode: false,
        ReplaceWord: '',
        CaseSensitive: false
      });
      if (work.value) delete queries.value[work.value.WorkId];
      await props.dialogs.info(messageFormat('INFO', 'I_0011', '置換'), messageFormat('INFO', 'I_0077', count));
    }
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'キーワード置換'));
  } finally {
    busy.value = false;
  }
}

async function navigate(row: SearchResult) {
  const menu = resolveWorkMenu(row.MenuId);
  if (!menu) return;
  await navigateTo({
    ...workLocation(menu),
    query: {
      menu,
      row: String(row.RowId),
      parent: row.ParentId ? String(row.ParentId) : undefined,
      fromSearch: '1'
    }
  });
}

async function load() {
  busy.value = true;
  try {
    await spinner.run(async () => {
      const access = await readWorkAccess(props.request);
      const config = requireSuccess(await props.request<SearchScreen[]>('/GetSearchScreens.php'), messageFormat('ERROR', 'E_0003', '検索対象の取得'));
      if (!Array.isArray(config)) throw new Error(messageFormat('ERROR', 'E_0026'));
      if (disposed) return;
      work.value = access.work;
      role.value = props.isAdmin ? '管理者' : access.isCreator ? '作成者' : 'アシスタント';
      canEdit.value = props.isAdmin || access.isCreator;
      screens.value = config;
      const saved = queries.value[access.work.WorkId];
      keyword.value = saved?.Keyword || '';
      await nextTick();
      fields.setValue('Keyword', keyword.value);
      for (const screen of screens.value) fields.setValue('Screen:' + screen.MenuId, saved ? saved.MenuIds.includes(screen.MenuId) : true);
      readAll();
      if (saved) await query(saved);
    });
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'キーワード検索の初期化'));
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <div>
    <WorkContentHeader
      title="キーワード検索"
      icon="fa-search"
      :work-title="work?.WorkTitle"
      :role="work ? role : undefined"
    />
    <div
      class="AccordionContainer"
      :class="{Collapsed:collapsed}"
    >
      <div
        role="button"
        tabindex="0"
        class="AccordionHeader"
        :aria-expanded="!collapsed"
        @click="collapsed = !collapsed"
        @keydown.enter.prevent="collapsed = !collapsed"
        @keydown.space.prevent="collapsed = !collapsed"
      >
        <span class="AccordionTitle">
          <i
            class="fa-solid fa-pen-to-square"
            aria-hidden="true"
          />
          検索条件
        </span>
        <i
          class="AccordionIcon fa-solid fa-angles-down"
          aria-hidden="true"
        />
      </div>
      <div class="AccordionBody">
        <div class="KeywordSearchFields">
          <ToogleComponent
            v-if="canEdit"
            :ref="el => fields.register('ReplaceMode',el,false)"
            label="置換モード"
            @value-change="changeReplaceMode"
          />
          <TextFieldComponent
            :ref="el => fields.register('Keyword',el,keyword)"
            label="キーワード"
            required
            :maxlength="100"
            :error="errors.Keyword"
          />
          <div v-show="replaceMode">
            <TextFieldComponent
              :ref="el => fields.register('ReplaceWord',el,'')"
              label="置換後文字列"
              :maxlength="100"
              :error="errors.ReplaceWord"
            />
            <CheckBoxComponent
              :ref="el => fields.register('CaseSensitive',el,false)"
              label="大文字小文字を区別する"
            />
          </div>
          <FieldFrame
            label="対象画面"
            :error="errors.Screens"
          >
            <CheckBoxComponent
              :ref="el => fields.register('All',el,true)"
              label="すべて選択"
              @value-change="selectAll"
            />
            <div class="KeywordSearchScreenCheckboxesGrid">
              <CheckBoxComponent
                v-for="screen in screens"
                :key="screen.MenuId"
                :ref="el => fields.register('Screen:' + screen.MenuId,el,true)"
                :label="screen.ScreenName"
                @value-change="readAll"
              />
            </div>
          </FieldFrame>
          <div class="ButtonGroup">
            <ButtonComponent
              type="button"
              variant="PrimaryButton"
              @click="search"
            >
              <i
                class="fas fa-search"
                aria-hidden="true"
              />
              検索
            </ButtonComponent>
            <ButtonComponent
              v-if="canEdit && replaceMode"
              type="button"
              variant="DangerButton"
              @click="replace"
            >
              <i
                class="fas fa-pen-to-square"
                aria-hidden="true"
              />
              置換
            </ButtonComponent>
          </div>
        </div>
      </div>
    </div>
    <TableComponent
      :rows="rows"
      :columns="columns"
      row-key="ResultKey"
      :loading="busy"
    >
      <template #cell-Content="{row}">
        <ButtonComponent
          type="button"
          unstyled
          class="KeywordSearchContentCell"
          :title="String(row.Content || '').slice(0,500)"
          @click="preview = row as SearchResult; previewOpen = true"
        >{{ String(row.Content || '').slice(0,200) }}</ButtonComponent>
      </template>
      <template #cell-Action="{row}">
        <ButtonComponent
          type="button"
          variant="PrimaryButton ButtonSmall"
          @click="navigate(row as SearchResult)"
        >
          <i
            class="fas fa-arrow-right"
            aria-hidden="true"
          />
          遷移
        </ButtonComponent>
      </template>
    </TableComponent>
    <BaseDialog
      v-model="previewOpen"
      :title="String(preview?.MatchedColumnLabel || preview?.MatchedColumn || '')"
      title-icon="fas fa-eye"
      icon-color="#3498db"
      size="DialogMedium"
    >
      <TextAreaComponent
        :ref="el => fields.register('Preview',el,String(preview?.Content || ''))"
        readonly
        class="KeywordContentPreview"
      />
      <template #actions>
        <ButtonComponent
          type="button"
          variant="CloseButton"
          @click="previewOpen = false"
        >閉じる</ButtonComponent>
      </template>
    </BaseDialog>
  </div>
</template>
