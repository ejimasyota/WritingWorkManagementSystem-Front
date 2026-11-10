import { CONST_VARIABLE } from '../config/Const';
import type { WorkMenuId } from '../types/workNavigation';

/** 未指定は作品共通情報。不正な指定は画面側で通知できるようnullで返す。 */
export function resolveWorkMenu(value: unknown): WorkMenuId | null {
  if (value === undefined || value === null || value === '') return 'MenuWorkInfo';
  if (typeof value !== 'string' || !Object.hasOwn(CONST_VARIABLE.WORK_MENUS, value)) return null;
  return value as WorkMenuId;
}

/** 個別画面による分岐を持たず、すべての作品内画面を同じ形式で遷移する。 */
export function workLocation(menu: WorkMenuId) {
  return { path: CONST_VARIABLE.DISPLAY_PATH.WORK, query: { menu } };
}
