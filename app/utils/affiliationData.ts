import type { CharacterAffiliation, CharacterMasters } from '../types/character';
import { compareFlexibleDates, parseFlexibleDate } from './dates';
import { messageFormat } from './messages';

/** 同日の履歴・日付未設定の移行データは入力順を維持する。 */
export function sortAffiliations(rows: CharacterAffiliation[]): CharacterAffiliation[] {
  return [...rows].sort((a, b) => {
    const left = parseFlexibleDate(a.JoinedDate)?.getTime();
    const right = parseFlexibleDate(b.JoinedDate)?.getTime();
    return left == null ? right == null ? 0 : 1 : right == null ? -1 : right - left;
  });
}

export function parseAffiliations(value: unknown): CharacterAffiliation[] {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    const rows = Array.isArray(parsed) ? parsed : parsed?.Affiliations;
    if (!Array.isArray(rows)) return [];
    return sortAffiliations(rows.filter(row => row && typeof row === 'object').map(row => ({
      OrgId: String(row.OrgId ?? ''), OrgName: String(row.OrgName ?? ''),
      TeamId: String(row.TeamId ?? ''), TeamName: String(row.TeamName ?? ''),
      ClassId: String(row.ClassId ?? ''), ClassName: String(row.ClassName ?? ''),
      JoinedDate: String(row.JoinedDate ?? ''), LeftDate: String(row.LeftDate ?? ''), Note: String(row.Note ?? '')
    })));
  } catch { return []; }
}

export function affiliationLabel(row: CharacterAffiliation, masters?: CharacterMasters): string {
  return ([['Organization', 'OrgId', 'OrgName'], ['Team', 'TeamId', 'TeamName'], ['Class', 'ClassId', 'ClassName']] as const)
    .map(([kind, id, name]) => row[id] ? String(masters?.[kind]?.find(item => String(item[id]) === row[id])?.[name] || row[name]) : '')
    .filter(Boolean).join(' / ');
}

/** 存続期間は設立・結成前だけを判定する。脱退日はキャラ自身の履歴である。 */
export function affiliationWarnings(row: CharacterAffiliation, masters: CharacterMasters): string[] {
  const warnings: string[] = [];
  for (const [kind, id, name] of [['Organization', 'OrgId', 'OrgName'], ['Team', 'TeamId', 'TeamName'], ['Class', 'ClassId', 'ClassName']] as const) {
    if (!row[id]) continue;
    const master = masters[kind]?.find(item => String(item[id]) === row[id]);
    if (!master) { warnings.push(messageFormat('ERROR', 'E_0092', row[name] || row[id])); continue; }
    if (kind === 'Class') continue;
    for (const [date, label] of [[row.JoinedDate, '加入年月日'], [row.LeftDate, '脱退年月日']]) {
      if (compareFlexibleDates(date!, String(master.FoundedDate || '')) === -1)
        warnings.push(messageFormat('ERROR', 'E_0093', master[name], label));
    }
  }
  return warnings;
}
