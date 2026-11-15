import type { NarrativeDraftRow } from '../types/narrative';

/** 番号は1始まり。プロットでは起承転結内の番号として扱い、既存行のID・版を維持する。 */
export function placeNarrativeRow(rows: NarrativeDraftRow[], item: NarrativeDraftRow, index: number, grouped = false): NarrativeDraftRow[] {
  const next = rows.filter(row => row.localKey !== item.localKey);
  if (!grouped) {
    next.splice(Math.max(0, Math.min(next.length, index - 1)), 0, item);
    return next;
  }
  const group = Number(item.StructureType);
  const rank = (value: unknown) => Number(value) || 5;
  const groupRows = next.filter(row => Number(row.StructureType) === group);
  groupRows.splice(Math.max(0, Math.min(groupRows.length, index - 1)), 0, item);
  return [...next.filter(row => rank(row.StructureType) < rank(group)), ...groupRows, ...next.filter(row => rank(row.StructureType) > rank(group))];
}

/** 全カードの番号を一度に求める。大量行でも描画中に行ごとの全件探索を繰り返さない。 */
export function narrativeRowPositions(rows: NarrativeDraftRow[], grouped = false): Map<number, number> {
  const counts = new Map<number, number>();
  const positions = new Map<number, number>();
  for (const row of rows) {
    const group = grouped ? Number(row.StructureType) : 0;
    const index = (counts.get(group) || 0) + 1;
    counts.set(group, index);
    positions.set(row.localKey, index);
  }
  return positions;
}

/** 旧ドラッグの挿入位置と同じく、移動先の現在番号へ挿入する。 */
export function dragNarrativeRow(rows: NarrativeDraftRow[], source: number, target: number, grouped = false): NarrativeDraftRow[] | null {
  const item = rows.find(row => row.localKey === source);
  const destination = rows.find(row => row.localKey === target);
  if (!item || !destination || grouped && Number(item.StructureType) !== Number(destination.StructureType)) return null;
  const group = grouped ? rows.filter(row => Number(row.StructureType) === Number(item.StructureType)) : rows;
  return placeNarrativeRow(rows, item, group.findIndex(row => row.localKey === target) + 1, grouped);
}

/** 保存前のカードも保存済みの行と同じ本文形式で表示する。動作描写を括弧で加工しない。 */
export function narrativeText(row: Record<string, unknown>, kind: 'Story' | 'Exchange', serifs: Record<string, unknown>[] = []): string {
  const content = String(row.Content || '');
  if (row.ActionLine) return content;
  if (kind === 'Exchange') {
    const master = serifs.find(item => String(item.SerifId) === String(row.SerifId));
    const text = String(master?.Content ?? row.SerifContent ?? content);
    const monologue = row.SerifId ? master?.Monologue ?? row.SerifMonologue ?? row.Monologue : row.Monologue;
    return monologue ? '（' + text.replace(/^（(.*)）$/us, '$1') + '）' : text;
  }
  if (!row.Narrator && !row.NarratorCharaId) return content;
  const inner = content.replace(/^[「(（]/u, '').replace(/[」)）]$/u, '');
  return row.Monologue ? '(' + inner + ')' : '「' + inner + '」';
}
