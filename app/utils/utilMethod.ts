/* ==========================================================
 * 汎用処理
 * ----------------------------------------------------------
 * ・共通利用可能な処理群を提供する
 * ----------------------------------------------------------
 * 更新履歴：
 *  - 2026-11-10 作成
 * ========================================================== */

/* ==========================================================
 * モジュールインポート
 * ========================================================== */
// 1. プルダウン型定義
import type { SelectOption } from '../types/utilType'
// 2. 定数
import { CONST_VARIABLE } from '~/config/Const'

/* ==========================================================
 * グローバル定数
 * ========================================================== */
// 1. 曜日配列
const WEEK_LIST: Array<string> = ['日', '月', '火', '水', '木', '金', '土']

/** 
 * 日付を「YYYY年mm月dd日（曜日）HH時mm分ss.ms秒」の形式に変換する
 */
export const formatDateTime = (value: unknown) => {
    /* ------------------------------
     * 1. 変換対象となる値が存在しない場合
     * ------------------------------*/
    if (!value) {
        // 1. 空文字を返却
        return ''
    }

    /* ------------------------------
     * 2. 事前処理
     * ------------------------------*/
    // 1. 値を文字列化
    const text = String(value)
    // 2. Date型に変換
    const date = new Date(text.replace(' ', 'T'))

    /* ------------------------------
     * 3. Date型への変換に失敗した場合
     * ------------------------------*/
    if (Number.isNaN(date.getTime())) {
        // 1. 元の文字列を返却
        return text
    }

    /* ------------------------------
     * 4. 戻り値の返却
     * ------------------------------*/
    // 1. 形式を整形して返却
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 (${WEEK_LIST[date.getDay()]})${date.getHours()}時${date.getMinutes()}分${date.getSeconds()}.${date.getMilliseconds()}秒`
}

/** 
 * 日付を「YYYY年mm月dd日（曜日）」の形式に変換する
 */
export const formatDateWithWeekday = (value: unknown) => {
    /* ------------------------------
     * 1. 変換対象となる値が存在しない場合
     * ------------------------------*/
    if (!value) {
        // 1. 空文字を返却
        return ''
    }

    /* ------------------------------
     * 2. 事前処理
     * ------------------------------*/
    // 1. 値を文字列化
    const text = String(value)
    // 2. Date型に変換
    const date = new Date(text.replace(' ', 'T'))

    /* ------------------------------
     * 3. Date型への変換に失敗した場合
     * ------------------------------*/
    if (Number.isNaN(date.getTime())) {
        // 1. 元の文字列を返却
        return text
    }

    /* ------------------------------
     * 4. 戻り値の返却
     * ------------------------------*/
    // 1. 形式を整形して返却
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 (${WEEK_LIST[date.getDay()]})`
}

/**
 * 汎用プルダウンを返却する（マスタ管理外のCD値）
 */
export const createUtilPulldown = (pulldownType: string): SelectOption[] => {
    /* ==========================================================
     * プルダウン種別ごとのリスト作成処理
     * ========================================================== */
    switch (pulldownType) {
        /* ------------------------------
         * 1. ジャンルプルダウン
         * ------------------------------*/
        case CONST_VARIABLE.PULLDOWN_TYPE.TYPE_GENRE:
            // 1. リストを返却
            return [
                { value: 0, label: '' },
                { value: 1, label: 'ホラー' },
                { value: 2, label: 'ファンタジー' },
                { value: 3, label: 'SF' },
                { value: 4, label: '恋愛' },
                { value: 5, label: '日常' },
                { value: 6, label: 'アクション' },
                { value: 7, label: '冒険' },
                { value: 8, label: 'ミステリー' },
                { value: 9, label: 'コメディ' },
                { value: 10, label: 'スポーツ' },
                { value: 11, label: '歴史' },
                { value: 12, label: '学園' },
                { value: 13, label: 'エッセイ' },
                { value: 14, label: 'その他' },
            ]

        /* ------------------------------
         * 2. 該当なし
         * ------------------------------*/
        default:
            // 1. 空配列を返却
            return []
    }
}

/**
 * 汎用プルダウンの区分値から表示名を取得する
 * @param pulldownType プルダウン種別
 * @param value        区分値
 * @returns 表示名
 */
export const getUtilPulldownLabel = (pulldownType: string, value: unknown): string => {
    /* ------------------------------
     * 1. 事前定義
     * ------------------------------*/
    // 1. プルダウン一覧を取得
    const options = createUtilPulldown(pulldownType)

    /* ------------------------------
     * 2. 表示名取得処理
     * ------------------------------*/
    // 1. 区分値に一致する選択肢を取得
    const option = options.find(option => Number(option.value) === Number(value))

    /* ------------------------------
     * 3. 戻り値の返却
     * ------------------------------*/
    // 1. 表示名を返却
    return option?.label || '未設定'
}

/** 作品一覧管理APIだけが Data.WorkList を返すため、既存の形式差を吸収する。 */
export function normalizeMainList(menuId: string, data: unknown): Record<string, unknown>[] {
    const list = menuId === CONST_VARIABLE.MENU_ID.PROJECT_MANAGEMENT
        ? (data as { WorkList?: Record<string, unknown>[] } | null)?.WorkList
        : data
    if (list == null) return []
    if (!Array.isArray(list)) throw new Error('一覧データの形式が不正です')
    return list
}

export function formatShortDate(value: unknown) {
    if (!value) return ''
    const text = String(value)
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
    return match ? `${match[1]}/${match[2]}/${match[3]}` : text
}

export function unformatDate(value: string) {
    const digits = value.replace(/[^0-9]/g, '')
    return digits.length === 8 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}` : value
}




