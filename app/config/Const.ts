/* ==========================================================
 * 定数管理
 * ----------------------------------------------------------
 * ・定数の定義を行う
 * ----------------------------------------------------------
 * 更新履歴：
 *  - 2026-11-04 作成
 * ========================================================== */

/**
 * 定数変数
 */
export const CONST_VARIABLE = {
  /**
   * システム名
   */
  SYSTEM_NAME: "創作管理システム",

  /** 
   * 色コードが未設定の場合のピッカー初期色
   */
  COLOR_PICKER_INITIAL_VALUE: "#9b59b6",

  /**
   * 画面パス
   */
  DISPLAY_PATH: {
    // 1. ログイン画面
    LOGIN: "/login",
    // 2. 会員登録画面
    REGISTER: "/regist",
    // 3. メイン画面
    MAIN: "/main",
    // 作品編集画面
    WORK: "/work",
    // 4. エラー画面
    ERROR: "/login",
  },

  /** 作品内の遷移先。サイドバーとルーティングが同じメニューIDを参照する。 */
  WORK_MENUS: {
    MenuWorkInfo: { label: '作品共通情報', icon: 'fa-info-circle' },
    MenuCharacter: { label: 'キャラ設定', icon: 'fa-user' },
    MenuOrganization: { label: '組織設定', icon: 'fa-building' },
    MenuTeam: { label: 'チーム設定', icon: 'fa-users' },
    MenuRace: { label: '種族設定', icon: 'fa-dna' },
    MenuClass: { label: '階級設定', icon: 'fa-sitemap' },
    MenuBiography: { label: '経歴一覧', icon: 'fa-stream' },
    MenuImage: { label: '画像一覧', icon: 'fa-images' },
  },

  /**
   * セッションキー
   */
  SESSION_KEY: {
    // 1. ログアウト前に表示されていた画面のパス
    LAST_PATH: "LastPath",
    // 2. メイン画面のアクティブなメニューID
    MAIN_ACTIVE_MENU_ID: "MainActiveMenuId",
  },

  /**
   * ローカルストレージキー
   */
  LOCAL_STRAGE_KEY: {
    // 1. ダークモードFLG
    DARK_MODE_FLG: "DarkMode",
    // 2. メタ情報非表示FLG
    HIDE_META_FLG: "HideMetaColumns"
  },

  /**
   * プルダウン種別
   */
  PULLDOWN_TYPE: {
    // 1. ジャンル
    TYPE_GENRE: "GENRE"
  },

  /**
   * メニューID
   */
  MENU_ID: {
    /* ------------------------------
     * 1. メイン画面
     * ------------------------------*/
    // 1. 作品一覧管理
    PROJECT_MANAGEMENT: "MenuProjectManagement",
    // 2. 作品管理
    WORK_MANAGEMENT: "MenuWorkManagement",
    // 3. システム通知一覧
    NOTIFICATION_LIST: "MenuSystemNotificationList",
    // 4. 会員一覧
    MEMBER_LIST: "MenuMemberList",
    // 5. 管理者一覧
    ADMIN_LIST: "MenuAdminList",
    // 6. システム通知管理
    NOTIFICATION_ADMIN: "MenuSystemNotificationAdmin",
    // 7. 元号マスタ
    ERA_MASTER: "MenuEraMaster",
    // 8. テンプレートマスタ
    TEMPLATE_MASTER: "MenuTemplateMaster",

    /* ------------------------------
     * 2. 作品管理画面
     * ------------------------------*/
    // 1. メインへ戻る
    BACK_TO_MAIN: "MenuBackToMain",
    // 2. 作品共通情報
    WORK_INFO: "MenuWorkInfo",
    // 3. キャラ設定
    CHARA_INFO: "MenuCharacter",
  }
}
