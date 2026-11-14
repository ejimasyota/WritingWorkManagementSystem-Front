import { formatDateTime } from '../utils/utilMethod';
export type TableRow = Record<string, unknown>

export interface TableColumn {
  key: string
  label: string
  sortable?: boolean
  filterable?: boolean
  type?: 'text' | 'number' | 'date'
  meta?: boolean
  resizable?: boolean
  width?: number
  headerClassName?: string
  className?: string
  style?: Record<string, string>
  format?: (value: unknown, row: TableRow) => unknown
}

export interface TableSort {
  key: string
  direction: string
}

/** 表示値をセルとフィルタ候補で共有する。0・false も候補として保持する。 */
export function cellValue(row: TableRow, column: TableColumn): unknown {
  if (column.format) return column.format(row[column.key], row)
  return row[column.key] ?? ''
}

/** 複数値列を候補ごとに展開し、値のない配列は「未設定」に含める。 */
export function filterValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [String(value ?? '')]
  if (!value.length) return ['']
  return value.map(item => String(item ?? ''))
}

function matchesFilters(
  row: TableRow,
  columns: TableColumn[],
  filters: Record<string, string[]>,
) {
  // 同じ列で選んだ条件は OR、別の列の条件は AND。
  return columns.every(column => {
    const selectedValues = filters[column.key]
    if (!selectedValues?.length) return true
    const values = filterValues(cellValue(row, column))
    return values.some(value => selectedValues.includes(value))
  })
}

/** 旧 ApplyFilterAndSortCommon の日付・数値・日本語文字列の比較順を踏襲する。 */
function compareRows(left: TableRow, right: TableRow, column: TableColumn) {
  const leftValue = left[column.key] ?? ''
  const rightValue = right[column.key] ?? ''

  if (column.type === 'date' || column.key.toLowerCase().includes('date')) {
    const parseTime = (value: unknown) => Date.parse(String(value).replace(' ', 'T')) || 0
    return parseTime(leftValue) - parseTime(rightValue)
  }

  const leftNumber = Number.parseFloat(String(leftValue))
  const rightNumber = Number.parseFloat(String(rightValue))
  const bothNumeric = !Number.isNaN(leftNumber)
    && !Number.isNaN(rightNumber)
    && String(leftValue).trim() !== ''
    && String(rightValue).trim() !== ''

  if (bothNumeric) return leftNumber - rightNumber
  return String(leftValue).localeCompare(String(rightValue), 'ja')
}

/** 元のデータ配列を変更せず、フィルタとソートを適用した配列を返す。 */
export function processTable(
  rows: TableRow[],
  columns: TableColumn[],
  filters: Record<string, string[]>,
  sort: TableSort,
) {
  const filteredRows = rows.filter(row => matchesFilters(row, columns, filters))
  const sortColumn = columns.find(column => column.key === sort.key)
  if (!sortColumn || !sort.direction) return filteredRows

  return filteredRows.slice().sort((left, right) => {
    const comparison = compareRows(left, right, sortColumn)
    return sort.direction === 'asc' ? comparison : -comparison
  })
}

/** 各一覧で共通の登録・更新情報。列の配置順は画面側で決める。 */
export function metadataColumns(): TableColumn[] {
  return [
    { key: 'RegistDate', label: '登録年月日', sortable: true, meta: true, type: 'date', style: { minWidth: '310px' }, format: formatDateTime },
    { key: 'UpdateDate', label: '更新年月日', sortable: true, meta: true, type: 'date', style: { minWidth: '310px' }, format: formatDateTime },
    { key: 'RegistUser', label: '登録者', sortable: true, filterable: true, meta: true, style: { minWidth: '250px' } },
    { key: 'UpdateUser', label: '更新者', sortable: true, filterable: true, meta: true, style: { minWidth: '250px' } },
  ];
}
