<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { cellValue, filterValues, processTable, type TableColumn, type TableRow } from '../composables/tableData';
interface Props {
  rows?: TableRow[];
  columns: TableColumn[];
  rowKey?: string;
  pageSize?: number;
  canEdit?: boolean;
  selectable?: boolean;
  hideMeta?: boolean;
  loading?: boolean;
  scrollTopOnPageChange?: boolean;
  rowClickable?: boolean;
}
type DropdownKind = 'values' | 'sort-columns' | 'filter-columns';
const props = withDefaults(defineProps<Props>(), {
  rows: () => [],
  rowKey: 'id',
  pageSize: 15,
  scrollTopOnPageChange: true
});
const emit = defineEmits(['edit', 'delete', 'selection-change', 'row-click']);
const page = ref(1);
const sort = reactive({
  key: '',
  direction: ''
});
const filters = reactive<Record<string, string[]>>({});
const selected = ref<unknown[]>([]);
const widths = reactive<Record<string, number>>({});
const dropdownOpen = ref(false);
const dropdownKind = ref<DropdownKind>('values');
const dropdownAnchor = ref<HTMLElement | null>(null);
const activeFilter = ref<TableColumn>();
const columns = computed(() => props.columns.filter(column => !(props.hideMeta && column.meta)));
const sortableColumns = computed(() => columns.value.filter(column => column.sortable));
const filterableColumns = computed(() => columns.value.filter(column => column.filterable));
const activeFilterCount = computed(() => Object.keys(filters).length);

// 絞り込み・ソートを全件に適用してから、現在ページの行を取得する。
const result = computed(() => processTable(props.rows, props.columns, filters, sort));
const size = computed(() => Math.max(1, Math.floor(props.pageSize) || 15));
const pages = computed(() => Math.max(1, Math.ceil(result.value.length / size.value)));
const visible = computed(() => {
  const start = (page.value - 1) * size.value;
  return result.value.slice(start, start + size.value);
});
const pageNumbers = computed(() => {
  const first = Math.max(1, page.value - 2);
  const last = Math.min(pages.value, page.value + 2);
  return Array.from({
    length: last - first + 1
  }, (_, index) => first + index);
});
const allPageSelected = computed(() => {
  return visible.value.length > 0 && visible.value.every(isSelected);
});
const somePageSelected = computed(() => visible.value.some(isSelected));

/** 旧 ShowFilterDropdownCommon と同様、全件から候補を生成し、未設定を先頭に置く。 */
const filterOptions = computed(() => {
  const column = activeFilter.value;
  if (!column) return [];
  const values = props.rows.flatMap(row => filterValues(cellValue(row, column)));
  const uniqueValues = [...new Set(values)];
  const options = uniqueValues.filter(value => value !== '');
  options.sort((left, right) => left.localeCompare(right, 'ja'));
  if (uniqueValues.includes('')) options.unshift('');
  return options;
});
watch([() => props.rows, () => props.pageSize, filters, sort], () => {
  page.value = 1;
}, {
  deep: true
});
watch(pages, count => {
  page.value = Math.min(page.value, count);
});
watch(() => props.rows, rows => {
  selected.value = selected.value.filter(key => rows.some(row => row[props.rowKey] === key));
  emit('selection-change', [...selected.value]);
}, {
  deep: true
});

/** 旧 ApplySortCharacter 等と同じく、同じ列では昇順・降順を交互に切り替える。 */
function applySort(column: TableColumn) {
  if (!column.sortable) return;
  if (sort.key === column.key) {
    sort.direction = sort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    sort.key = column.key;
    sort.direction = 'asc';
  }
}
function sortIcon(column?: TableColumn) {
  if (!sort.direction || column && sort.key !== column.key) return 'fa-sort';
  return sort.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
}
function openDropdown(event: MouseEvent, kind: DropdownKind, column?: TableColumn) {
  dropdownAnchor.value = event.currentTarget as HTMLElement;
  dropdownKind.value = kind;
  activeFilter.value = column;
  dropdownOpen.value = true;
}
function openFilter(event: MouseEvent, column: TableColumn) {
  openDropdown(event, 'values', column);
}

/** チェックを変更した時点で適用する。適用ボタン・確認ダイアログは設けない。 */
function toggleFilter(value: string, event: Event) {
  const column = activeFilter.value;
  if (!column) return;
  const checked = (event.target as HTMLInputElement).checked;
  const current = filters[column.key] || [];
  const next = checked ? [...current, value] : current.filter(item => item !== value);
  if (next.length) {
    filters[column.key] = next;
  } else {
    delete filters[column.key];
  }
}
function clearColumnFilter() {
  if (activeFilter.value) delete filters[activeFilter.value.key];
}
function clearFilters() {
  Object.keys(filters).forEach(key => delete filters[key]);
  dropdownOpen.value = false;
}

/** モバイルは列選択後、同じフィルタボタン直下に候補リストを表示する。 */
function chooseFilterColumn(column: TableColumn) {
  activeFilter.value = column;
  dropdownKind.value = 'values';
}
function chooseSortColumn(column: TableColumn) {
  applySort(column);
  dropdownOpen.value = false;
}
function filterSummary(column: TableColumn) {
  const values = (filters[column.key] || []).map(value => value || '(未設定)');
  if (values.length <= 2) return values.join(', ');
  return `${values[0]} +${values.length - 1}件`;
}
function isSelected(row: TableRow) {
  return selected.value.includes(row[props.rowKey]);
}
function selectRow(row: TableRow, event: Event) {
  const key = row[props.rowKey];
  const checked = (event.target as HTMLInputElement).checked;
  selected.value = checked ? [...new Set([...selected.value, key])] : selected.value.filter(value => value !== key);
  emit('selection-change', [...selected.value]);
}
function selectPage(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  const keys = visible.value.map(row => row[props.rowKey]);
  selected.value = checked ? [...new Set([...selected.value, ...keys])] : selected.value.filter(key => !keys.includes(key));
  emit('selection-change', [...selected.value]);
}

/** 旧 CreatePagination のページ移動時と同じく、画面先頭へ戻す。 */
function changePage(nextPage: number) {
  page.value = nextPage;
  if (!props.scrollTopOnPageChange) return;
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

/** 旧 ColumnResizer のクラス・最小幅を引き継ぐ。 */
function resize(event: PointerEvent, column: TableColumn) {
  const handle = event.currentTarget as HTMLElement;
  const header = handle.parentElement!;
  const startX = event.clientX;
  const startWidth = header.getBoundingClientRect().width;
  handle.setPointerCapture(event.pointerId);
  handle.classList.add('Resizing');
  function move(pointer: PointerEvent) {
    widths[column.key] = Math.max(50, startWidth + pointer.clientX - startX);
  }
  function stop() {
    handle.classList.remove('Resizing');
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('lostpointercapture', stop);
  }
  handle.addEventListener('pointermove', move);
  handle.addEventListener('lostpointercapture', stop);
}
function columnStyle(column: TableColumn) {
  const width = widths[column.key] || column.width;
  return { ...column.style, ...(width ? { width: `${width}px`, minWidth: `${width}px` } : {}) };
}
function reset() {
  clearFilters();
  sort.key = '';
  sort.direction = '';
  page.value = 1;
}
function getSelectedKeys() {
  return [...selected.value];
}
defineExpose({
  reset,
  getSelectedKeys
});
</script>

<template>
  <section :aria-busy="loading">
    <slot name="toolbar" :selected-keys="selected" />

    <!-- 旧 CreateMobileTableToolbar：アイコンボタンから列の選択リストを開く。 -->
    <div v-if="sortableColumns.length || filterableColumns.length" class="MobileTableToolbar">
      <div class="MobileTableToolbarButtons">
        <ButtonComponent
          v-if="sortableColumns.length"
          type="button"
          variant="SecondaryButton ButtonSmall"
          aria-label="並び替え"
          @click.stop="openDropdown($event, 'sort-columns')"
        >
          <i class="fas" :class="sortIcon()" aria-hidden="true" />
        </ButtonComponent>
        <ButtonComponent
          v-if="filterableColumns.length"
          type="button"
          variant="SecondaryButton ButtonSmall MobileFilterButton"
          aria-label="絞り込み"
          @click.stop="openDropdown($event, 'filter-columns')"
        >
          <i class="fas fa-filter" aria-hidden="true" />
          <span v-if="activeFilterCount" class="MobileFilterCount">{{ activeFilterCount }}</span>
        </ButtonComponent>
      </div>
    </div>

    <div class="TableContainer">
      <table class="DataTable">
        <thead>
          <tr>
            <th v-if="selectable">
              <CheckBoxComponent
                inline
                aria-label="このページをすべて選択"
                :model-value="allPageSelected"
                :indeterminate="somePageSelected && !allPageSelected"
                :disabled="!visible.length"
                @change="selectPage"
              />
            </th>
            <th
              v-for="column in columns"
              :key="column.key"
              :class="[column.className, { MetaCol: column.meta }]"
              :style="columnStyle(column)"
              :aria-sort="sort.key === column.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'"
            >
              <div class="TableColumnHeader">
                <span
                  class="TableColumnLabel"
                  :class="{ Sortable: column.sortable }"
                  :role="column.sortable ? 'button' : undefined"
                  :tabindex="column.sortable ? 0 : undefined"
                  @click="applySort(column)"
                  @keydown.enter.prevent="applySort(column)"
                  @keydown.space.prevent="applySort(column)"
                >{{ column.label }}</span>
                <span v-if="column.sortable" class="TableSortIcon">
                  <i
                    class="fas"
                    :class="sortIcon(column)"
                    :style="{ color: sort.key === column.key ? '#007bff' : '#999' }"
                    aria-hidden="true"
                  />
                </span>
                <ButtonComponent unstyled
                  v-if="column.filterable"
                  type="button"
                  class="TableFilterButton"
                  :class="{ Active: filters[column.key]?.length }"
                  :aria-label="column.label + 'の絞り込み'"
                  @click.stop="openFilter($event, column)"
                >
                  <i class="fas fa-filter" aria-hidden="true" />
                  <span v-if="filters[column.key]?.length" class="TableFilterBadge" />
                </ButtonComponent>
              </div>
              <div class="ColumnResizer" @pointerdown.stop.prevent="resize($event, column)" />
            </th>
            <th v-if="canEdit">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visible" :key="String(row[rowKey])" :class="{ ClickableTableRow: rowClickable }" @click="emit('row-click', row)">
            <td v-if="selectable" data-label="選択" @click.stop>
              <CheckBoxComponent inline aria-label="行を選択" :model-value="isSelected(row)" @change="selectRow(row, $event)" />
            </td>
            <td
              v-for="column in columns"
              :key="column.key"
              :class="[column.className, { MetaCol: column.meta }]"
              :data-label="column.label"
              :title="filterValues(cellValue(row, column)).join('、')"
            >
              <slot :name="'cell-' + column.key" :row="row" :value="cellValue(row, column)">
                {{ filterValues(cellValue(row, column)).join('、') }}
              </slot>
            </td>
            <td v-if="canEdit" class="ActionCol" data-label="操作" @click.stop>
              <slot name="actions" :row="row">
                <ButtonComponent type="button" variant="EditButton" @click="emit('edit', row)">
                  <i class="fas fa-edit" aria-hidden="true" /> 編集
                </ButtonComponent>
                <ButtonComponent type="button" variant="DeleteButton" @click="emit('delete', row)">
                  <i class="fas fa-trash" aria-hidden="true" /> 削除
                </ButtonComponent>
              </slot>
            </td>
          </tr>
          <tr v-if="!visible.length && !loading">
            <td
              class="EmptyTableCell"
              :colspan="columns.length + Number(selectable) + Number(canEdit)"
            >
              データがありません
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 旧 ListFooter：件数は左端、ページネーションは中央に配置する。 -->
    <div class="ListFooter">
      <div class="RecordCount">{{ result.length.toLocaleString('ja-JP') }}件</div>
      <nav v-if="pages > 1" class="PaginationContainer" aria-label="ページ切替">
        <ButtonComponent unstyled
          type="button"
          class="PaginationButton"
          :disabled="page === 1"
          aria-label="最初のページ"
          @click="changePage(1)"
        >
          <i class="fas fa-angle-double-left" aria-hidden="true" />
        </ButtonComponent>
        <ButtonComponent unstyled
          type="button"
          class="PaginationButton"
          :disabled="page === 1"
          aria-label="前のページ"
          @click="changePage(page - 1)"
        >
          <i class="fas fa-chevron-left" aria-hidden="true" />
        </ButtonComponent>
        <ButtonComponent unstyled
          v-for="number in pageNumbers"
          :key="number"
          type="button"
          class="PaginationButton"
          :class="{ Active: page === number }"
          :disabled="page === number"
          @click="changePage(number)"
        >{{ number }}</ButtonComponent>
        <ButtonComponent unstyled
          type="button"
          class="PaginationButton"
          :disabled="page === pages"
          aria-label="次のページ"
          @click="changePage(page + 1)"
        >
          <i class="fas fa-chevron-right" aria-hidden="true" />
        </ButtonComponent>
        <ButtonComponent unstyled
          type="button"
          class="PaginationButton"
          :disabled="page === pages"
          aria-label="最後のページ"
          @click="changePage(pages)"
        >
          <i class="fas fa-angle-double-right" aria-hidden="true" />
        </ButtonComponent>
      </nav>
    </div>

    <AnchoredDropdown
      v-model="dropdownOpen"
      :anchor="dropdownAnchor"
      :mobile="dropdownKind !== 'values'"
    >
      <!-- 旧フィルタは検索・下書き・適用ボタンを持たず、チェックで即時反映する。 -->
      <template v-if="dropdownKind === 'values'">
        <ButtonComponent unstyled
          v-if="activeFilter && filters[activeFilter.key]?.length"
          type="button"
          class="FilterDropdownClear"
          @click="clearColumnFilter"
        >
          <i class="fas fa-times" aria-hidden="true" /> クリア
        </ButtonComponent>
        <CheckBoxComponent v-for="option in filterOptions" :key="option" inline wrapper-class="FilterDropdownOption" :model-value="!!(activeFilter && filters[activeFilter.key]?.includes(option))" @change="toggleFilter(option, $event)">
          <span :title="option || '(未設定)'">{{ option || '(未設定)' }}</span>
        </CheckBoxComponent>
      </template>
      <template v-else-if="dropdownKind === 'sort-columns'">
        <ButtonComponent unstyled
          v-for="column in sortableColumns"
          :key="column.key"
          type="button"
          class="MobileDropdownItem"
          @click="chooseSortColumn(column)"
        >
          <span>{{ column.label }}</span>
          <i
            v-if="sort.key === column.key"
            class="fas MobileSortIndicator"
            :class="sortIcon(column)"
          />
        </ButtonComponent>
      </template>
      <template v-else>
        <ButtonComponent unstyled
          v-for="column in filterableColumns"
          :key="column.key"
          type="button"
          class="MobileDropdownItem"
          @click="chooseFilterColumn(column)"
        >
          <span>{{ column.label }}</span>
          <span v-if="filters[column.key]?.length" class="MobileFilterSummary">{{ filterSummary(column) }}</span>
        </ButtonComponent>
        <ButtonComponent unstyled
          v-if="activeFilterCount"
          type="button"
          class="FilterDropdownClear"
          @click="clearFilters"
        >
          フィルタをクリア
        </ButtonComponent>
      </template>
    </AnchoredDropdown>
  </section>
</template>
