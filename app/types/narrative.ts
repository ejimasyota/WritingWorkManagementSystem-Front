import type { WorkSettingRow } from './workSettings';
/** 保存前の明細。localKeyはDOMと入力refの識別専用。 */
export interface NarrativeDraftRow extends WorkSettingRow { localKey: number; }
