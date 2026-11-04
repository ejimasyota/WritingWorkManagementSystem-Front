<template>
  <div class="LoginContainer">
    <div class="LoginCard">
      <div class="LoginIcon">
        <i class="fas fa-book-open" aria-hidden="true" />
      </div>
      <h1 class="LoginTitle">
        創作管理システム
      </h1>
      <p class="LoginSubtitle">
        ログインしてください
      </p>
      <div id="LoginForm" class="LoginForm">
        <TextFieldComponent
          ref="RefUserId"
          input-id="UserId"
          label="ユーザーID"
          maxlength="12"
          autocomplete="username"
          :error="errorInfo.userId"
          required
        />

        <TextFieldComponent
          ref="RefPassword"
          input-id="Password"
          label="パスワード"
          type="password"
          maxlength="12"
          autocomplete="current-password"
          :error="errorInfo.password"
          required
        />

        <div
          id="LockCountdown"
          class="CountdownArea"
          :class="{ Active: userLockFlg }"
          role="status"
        >
          <i class="fas fa-lock" aria-hidden="true" />
          <span id="LockCountdownText">
            {{ countdownText }}
          </span>
        </div>

        <div class="LoginButtonGroup">
          <button
            id="LoginButton"
            type="button"
            class="ButtonClass PrimaryButton ButtonFull"
            :disabled="userLockFlg"
            @click="loginEvent"
          >
            <i class="fas fa-sign-in-alt" aria-hidden="true" />
            ログイン
          </button>

          <button
            id="RegisterButton"
            type="button"
            class="ButtonClass SuccessButton ButtonFull"
            :disabled="userLockFlg"
            @click="openRegistration"
          >
            <i class="fas fa-user-plus" aria-hidden="true" />
            会員登録
          </button>
        </div>
      </div>
    </div>
    <PageDialogHost :dialogs="dialogUtil" />
  </div>
</template>
<script setup lang="ts">
/* ==========================================================
 * モジュールインポート
 * ========================================================== */
// 1. vue関連
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
// 2. 定数関連
import {CONST_VARIABLE} from '../../config/Const';
// 3. ログイン認証型定義関連
import type { LoginResult } from '../../types/loginType';
// 4. バックエンド共通関連
import { backendError, errorMessage } from '../../utils/backend';
// 5. 認証関連
import { loginDestination, stashPendingJoinToken } from '../../utils/auth';
// 6. テキストフォールドコンポーネント
import TextFieldComponent from '../../components/TextFieldComponent.vue';
// 7. バリデーションチェック関連
import { validateFields } from '../../utils/validation';
// 8. 共通チェック関連
import { required, maxLength } from '../../utils/utilCheck';
// 9. メッセージ関連
import { messageFormat } from '../../utils/messages';
//10. API通信関連
import { useApi } from '../../utils/useApi';
//11. 共通型定義
import type { ApiResponse } from '../../types/utilType';

/* ==========================================================
 * ページ設定
 * ========================================================== */
/**
 * ヘッド情報を設定
 */
useHead({
  // 1. タイトルを設定
  title: CONST_VARIABLE.SYSTEM_NAME
});

/**
 * ページメタ情報を設定
 */
definePageMeta({
  // 1. ミドルウェアを設定
  middleware: ['guest'],
});

/* ==========================================================
 * 定義
 * ========================================================== */
/* ------------------------------
 * 1. 処理用
 * ------------------------------*/
// 1. ダイアログユーティリティ
const dialogUtil = usePageDialogs();
// 2. 認証セッション
const authInfo = useAuthSession();
// 3. ロック解除残り時間
const remaining = ref(0);
// 4. カウントダウンタイマー
let countdownTimer: ReturnType<typeof setInterval> | undefined;
// 5. エラー情報
const errorInfo = ref<Record<string, string>>({})

/* ------------------------------
 * 2. 入力用
 * ------------------------------*/
// 1. ユーザーID
const RefUserId = ref<InstanceType<typeof TextFieldComponent> | null>(null);
// 2. パスワード
const RefPassword = ref<InstanceType<typeof TextFieldComponent> | null>(null);

/* ==========================================================
 * 算出プロパティ
 * ========================================================== */
/**
 * ユーザーがロック中かどうかを判定するFLG
 */
const userLockFlg = computed(() => {
  // 1. 残り時間が0より大きいかどうかを返却
  return remaining.value > 0
});

/**
 * ロック解除までの残り時間を表示するテキスト
 */
const countdownText = computed(() => {
  // 1. 残り時間（分）
  const minutes = Math.floor(remaining.value / 60_000);
  // 2. 残り時間（秒）
  const seconds = Math.floor(remaining.value % 60_000 / 1000);
  // 3. 表示テキストを返却
  return `ロック解除まで ${minutes}分${String(seconds).padStart(2, '0')}秒`;
});

/**
 * マウント時処理
 */
onMounted(() => {
  // 1. 参加トークンを退避する
  stashPendingJoinToken();
});

/**
 * アンマウント時処理
 */
onBeforeUnmount(() => {
  /* ------------------------------
   * 1. カウントダウンが残っている場合
   * ------------------------------*/
  if (countdownTimer) {
    // 1. カウントダウンをクリア
    clearInterval(countdownTimer);
  }
});

/**
 * 会員登録ボタン押下時の処理
 */
const openRegistration = async() => {
  /* ------------------------------
   * 1. ロック中でない場合
   * ------------------------------*/
  if (!userLockFlg.value){
    // 1. 会員登録画面へ遷移する
    await navigateTo(CONST_VARIABLE.DISPLAY_PATH.REGISTER);
  }
}

/**
 * カウントダウンを開始処理
 * @param milliseconds ロック解除までの残り時間（ミリ秒）
 */
function startCountdown(milliseconds: number) {
  /* ==========================================================
   * 事前処理
   * ========================================================== */
  /* ------------------------------
   * 1. 既存のカウントダウンタイマーが存在する場合
   * ------------------------------*/
  if (countdownTimer) {
    // 1. 既存のカウントダウンタイマーをクリア
    clearInterval(countdownTimer);
  }

  /* ==========================================================
   * 事前定義
   * ========================================================== */
  // 1. カウントダウン終了時刻を定義
  const end = Date.now() + Math.max(0, milliseconds);

  /* ==========================================================
   * 内部ヘルパー関数
   * ========================================================== */
  /**
   * カウントダウン更新処理
   */
  function updateCountdown() {
    /* ------------------------------
     * 1. 事前処理
     * ------------------------------*/
    // 1. 残り時間を更新
    remaining.value = Math.max(0, end - Date.now());

    /* ------------------------------
     * 2. カウントダウンが終了した場合
     * ------------------------------*/
    if (!remaining.value && countdownTimer) {
      // 1. カウントダウンタイマーをクリア
      clearInterval(countdownTimer);
      // 2. カウントダウンタイマーを未定義にする
      countdownTimer = undefined;
    }
  }

  /* ==========================================================
   * カウントダウン開始処理
   * ========================================================== */
  // 1. カウントダウンを更新
  updateCountdown();

  /* ==========================================================
   * 残り時間がある場合
   * ========================================================== */
  if (remaining.value) {
    // 1. カウントダウンタイマーを開始
    countdownTimer = setInterval(updateCountdown, 1000);
  }
}

/**
 * ユーザーのロック解除時間を表示する
 * @param response バックエンドからのレスポンス 
 */
const userLockEvent = (response: unknown) => {
  /* ------------------------------
   * 1. 事前処理
   * ------------------------------*/
  // 1. レスポンスをログイン結果型に変換
  const result = response as LoginResult | null;

  /* ------------------------------
   * 2. ユーザーがロックされている場合
   * ------------------------------*/
  if (result?.IsLocked) {
    // 1. ロック解除までのカウントダウンを開始
    startCountdown(Number(result.RemainingMs) || 0);
  }
}

/**
 * ログインボタン押下時の処理
 */
const loginEvent = async (): Promise<void> => {
  /* ==========================================================
   * 事前チェック
   * ========================================================== */
  /* ------------------------------
   * 1. ロック中の場合
   * ------------------------------*/
  if (userLockFlg.value){
    // 1. 処理終了
    return
  }

  /* ==========================================================
   * 入力値検証
   * ========================================================== */
  const checkInput = await validateFields([
    /* ------------------------------
     * 1. ユーザーID
     * ------------------------------*/
    {
      // 1. キー
      key: 'userId',
      // 2. 参照変数
      field: RefUserId,
      // 3. バリデーションルール
      rules: [
        required(messageFormat('ERROR', 'E_0001', 'ユーザーID')),
        maxLength(12, messageFormat('ERROR', 'E_0002', 'ユーザーID', 12))
      ]
    },
    /* ------------------------------
     * 2. パスワード
     * ------------------------------*/
    {
      // 1. キー
      key: 'password',
      // 2. 参照変数
      field: RefPassword,
      // 3. バリデーションルール
      rules: [
        required(messageFormat('ERROR', 'E_0001', 'パスワード'))
      ]
    }
  ], errorInfo)

  /* ------------------------------
   * 3. 入力値検証でエラーがある場合
   * ------------------------------*/
  if (!checkInput) {
    // 1. 処理終了
    return
  }

  /* ==========================================================
   * ログイン処理
   * ========================================================== */
  try {
    /* ------------------------------
     * 1. 認証処理実行
     * ------------------------------*/
    const response = await useApi<ApiResponse<LoginResult>>(
      '/Login.php',
      'POST',
      {
        UserId: checkInput.userId,
        Password: checkInput.password
      }
    )

    /* ------------------------------
     * 2. 認証に失敗した場合
     * ------------------------------*/
    if (!response.Success) {
      // 1. ユーザーのロック状態を反映
      userLockEvent(response.Data)
      // 2. エラーダイアログを表示
      await dialogUtil.error(response.Message || messageFormat('ERROR', 'E_0003', 'ログイン'))
      // 3. 処理終了
      return
    }

    /* ------------------------------
     * 3. 認証に成功した場合
     * ------------------------------*/
    // 1. 認証セッションを確立
    await authInfo.establishSession()
    // 2. 保留中の参加トークンを確認
    const pendingJoin = !!sessionStorage.getItem('PendingJoinToken')
    // 3. ログイン後の遷移先を決定
    const destination = loginDestination(sessionStorage.getItem('LastPath'), pendingJoin)
    // 4. 前回の遷移先情報を削除
    sessionStorage.removeItem('LastPath')

    /* ------------------------------
     * 4. 画面遷移
     * ------------------------------*/
    // 1. ログイン後の画面へ遷移
    await navigateTo(destination)

  /* ==========================================================
   * 例外処理
   * ========================================================== */
  } catch (error) {
    /* ------------------------------
     * 1. API例外の場合
     * ------------------------------*/
    if (error instanceof backendError) {
      // 1. ユーザーのロック状態を反映
      userLockEvent(error.data)
    }

    /* ------------------------------
     * 2. 終了時処理
     * ------------------------------*/
    // 1. エラーダイアログを表示
    await dialogUtil.error(errorMessage(error, messageFormat('ERROR', 'E_0004', 'ログイン')))
  }
}
</script>