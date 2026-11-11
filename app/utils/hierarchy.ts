import type { HierarchyNode } from '../types/hierarchy';
/** 入力順を維持した階層を作成する。親がない行はルートとし、循環は打ち切る。 */
export function buildHierarchy(rows: Record<string, unknown>[], idKey: string, parentKey: string): HierarchyNode[] {
  const nodes = new Map(rows.map(row => [String(row[idKey]), {
    key: String(row[idKey]),
    row,
    children: [] as HierarchyNode[]
  }]));
  const roots: HierarchyNode[] = [];
  for (const node of nodes.values()) {
    const visited = new Set([node.key]);
    let parent = nodes.get(String(node.row[parentKey] ?? ''));
    const immediate = parent;
    let cyclic = false;
    while (parent) {
      if (visited.has(parent.key)) {
        cyclic = true;
        break;
      }
      visited.add(parent.key);
      parent = nodes.get(String(parent.row[parentKey] ?? ''));
    }
    if (immediate && !cyclic) immediate.children.push(node);else roots.push(node);
  }
  return roots;
}
/** 自身と配下のIDを列挙し、親の選択による循環を防ぐ。 */
export function descendantIds(rows: Record<string, unknown>[], idKey: string, parentKey: string, id: unknown): Set<string> {
  const found = new Set([String(id)]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) if (found.has(String(row[parentKey])) && !found.has(String(row[idKey]))) {
      found.add(String(row[idKey]));
      changed = true;
    }
  }
  return found;
}
/** 階層の名称を上位から連結する。循環データも有限長で返す。 */
export function hierarchyPath(rows: Record<string, unknown>[], idKey: string, parentKey: string, nameKey: string, id: unknown): string {
  const path: string[] = [];
  const seen = new Set<string>();
  let row = rows.find(row => String(row[idKey]) === String(id));
  while (row && !seen.has(String(row[idKey]))) {
    seen.add(String(row[idKey]));
    path.unshift(String(row[nameKey] || ''));
    row = rows.find(item => String(item[idKey]) === String(row![parentKey]));
  }
  return path.join(' > ');
}
