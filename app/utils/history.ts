import type { HistoryDetail } from '../types/history';
/** 構造化された変更履歴と旧形式の文字列を、どちらも欠落させず読み込む。 */
export function parseHistoryDetail(value: unknown): HistoryDetail {
  const raw = String(value ?? '').trim();
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.Type === 'string') return {
      Type: parsed.Type,
      Name: String(parsed.Name || ''),
      Summary: String(parsed.Summary || parsed.Name || ''),
      Changes: Array.isArray(parsed.Changes) ? parsed.Changes.filter((row: unknown) => row && typeof row === 'object') : [],
      Raw: raw
    };
  } catch {/* 旧履歴はJSONでないため、そのまま全文表示する。 */}
  return {
    Type: 'text',
    Name: '',
    Summary: raw,
    Changes: [],
    Raw: raw
  };
}
