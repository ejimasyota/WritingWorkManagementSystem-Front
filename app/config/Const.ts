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
    // 設定管理
    MenuWorkInfo: { label: '作品共通情報', icon: 'fa-info-circle', section: '設定管理' },
    MenuCharacter: { label: 'キャラ設定', icon: 'fa-user', section: '設定管理' },
    MenuOrganization: { label: '組織設定', icon: 'fa-building', section: '設定管理' },
    MenuTeam: { label: 'チーム設定', icon: 'fa-users', section: '設定管理' },
    MenuRace: { label: '種族設定', icon: 'fa-dna', section: '設定管理' },
    MenuClass: { label: '階級設定', icon: 'fa-sitemap', section: '設定管理' },
    MenuBiography: { label: '経歴一覧', icon: 'fa-stream', section: '設定管理' },
    MenuCalendar: { label: '元号設定', icon: 'fa-calendar-alt', section: '設定管理' },
    MenuTimeline: { label: '年表一覧', icon: 'fa-stream', section: '設定管理' },
    MenuChapter: { label: 'チャプター設定', icon: 'fa-layer-group', section: '設定管理' },
    MenuStage: { label: '舞台設定', icon: 'fa-map-marked-alt', section: '設定管理' },
    MenuBuilding: { label: '建物設定', icon: 'fa-landmark', section: '設定管理' },
    MenuPower: { label: '能力設定', icon: 'fa-bolt', section: '設定管理' },
    MenuMove: { label: '技設定', icon: 'fa-fire', section: '設定管理' },
    MenuWeapon: { label: '武器設定', icon: 'fa-shield-alt', section: '設定管理' },
    MenuItem: { label: 'アイテム設定', icon: 'fa-box', section: '設定管理' },
    MenuSerif: { label: 'セリフ設定', icon: 'fa-comment', section: '設定管理' },
    MenuExchange: { label: '掛け合い作成', icon: 'fa-comments', section: '設定管理' },
    // 執筆管理
    MenuStory: { label: 'ストーリー作成', icon: 'fa-book', section: '執筆管理' },
    MenuPlot: { label: 'プロット作成', icon: 'fa-sitemap', section: '執筆管理' },
    MenuClue: { label: '伏線メモ', icon: 'fa-puzzle-piece', section: '執筆管理' },
    MenuMemo: { label: '作品作成用メモ', icon: 'fa-sticky-note', section: '執筆管理' },
    MenuTerm: { label: '作中用語', icon: 'fa-book-reader', section: '執筆管理' },
    MenuRelation: { label: '相関図作成', icon: 'fa-project-diagram', section: '執筆管理' },
    MenuTag: { label: 'タグマスタ', icon: 'fa-tags', section: '執筆管理' },
    MenuImage: { label: '画像一覧', icon: 'fa-images', section: '執筆管理' },
    // 制作管理
    MenuReview: { label: '作品レビュー', icon: 'fa-star', section: '制作管理' },
    MenuWbs: { label: 'WBS', icon: 'fa-tasks', section: '制作管理' },
    MenuParticipants: { label: '参加者一覧', icon: 'fa-user-friends', section: '制作管理' },
    MenuHistory: { label: '更新履歴', icon: 'fa-history', section: '制作管理' },
    MenuKeywordSearch: { label: 'キーワード検索', icon: 'fa-search', section: '制作管理' },
  },

  /** 画面間で共有する一時状態のキー。 */
  STATE_KEY: { CHARACTER_TAG_RETURN: 'CharacterTagReturn', WBS_SELECTION: 'WbsSelection' },

  /** セッションストレージのキー。 */
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
