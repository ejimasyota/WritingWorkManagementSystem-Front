/** APIの配列形式と旧JSON包み形式を共通の関連項目配列へ復元する。 */
export function readRelatedItems(value: unknown, listKey: string, idKey: string): Record<string, unknown>[] {
  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  const items = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>)[listKey] : [];
  return Array.isArray(items) ? items.filter(item => item && typeof item === 'object' && item[idKey] != null && String(item[idKey]) !== '').map(item => ({
    ...item
  })) : [];
}
