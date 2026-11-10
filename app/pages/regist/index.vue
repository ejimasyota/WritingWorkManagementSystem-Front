
<template>
  <div class="RegistrationContainer">
    <div class="RegistrationCard">
      <div class="RegistrationIcon">
        <i class="fas fa-user-plus" aria-hidden="true" />
      </div>
      <h1 class="RegistrationTitle">
        会員登録
      </h1>
      <p class="RegistrationSubtitle">
        {{ messageFormat('INFO', 'I_0054') }}
      </p>

      <div id="RegistrationForm" class="RegistrationForm">
        <TextFieldComponent
          ref="RefUserId"
          input-id="UserId"
          label="ユーザーID"
          :hint="messageFormat('INFO', 'I_0041')"
          maxlength="12"
          autocomplete="username"
          :error="errorInfo.userId"
          required
        />

        <TextFieldComponent
          ref="RefPassword"
          input-id="Password"
          label="パスワード"
          :hint="messageFormat('INFO', 'I_0042')"
          type="password"
          maxlength="12"
          autocomplete="new-password"
          :error="errorInfo.password"
          required
        />

        <TextFieldComponent
          ref="RefConfirmPassword"
          input-id="ConfirmPassword"
          label="確認用"
          type="password"
          maxlength="12"
          autocomplete="new-password"
          :error="errorInfo.confirmPassword"
          required
        />

        <div class="FormGroup">
          <CheckBoxComponent :ref="el => inputFields.register('agreedFlg', el, agreedFlg)" inline input-id="TermsCheckbox" @value-change="agreedFlg = inputFields.getValue('agreedFlg', false)" class="CheckboxInput">
            <span><a id="TermsLink" href="#" class="LinkText" @click.stop.prevent="openTerms">利用規約</a>に同意する</span>
          </CheckBoxComponent>
        </div>

        <div class="RegistrationButtonGroup">
          <ButtonComponent
            id="RegisterButton"
            type="button"
            variant="SuccessButton ButtonFull"
            :disabled="!agreedFlg"
            @click="registerEvent"
          >
            <i class="fas fa-check" aria-hidden="true" />
            登録
          </ButtonComponent>

          <ButtonComponent
            id="BackToLoginButton"
            type="button"
            variant="PrimaryButton ButtonFull"
            @click="backToLogin"
          >
            <i class="fas fa-arrow-left" aria-hidden="true" />
            ログインへ
          </ButtonComponent>
        </div>
      </div>
    </div>

    <TermsDialog v-model="termsOpenFlg" @error="dialogUtil.error" />
    <PageDialogHost :dialogs="dialogUtil" />
  </div>
</template>

<script setup lang="ts">
import { useOperationSpinner } from '../../composables/useOperationSpinner';

import { useInputFields } from '../../composables/useInputFields';
/* ==========================================================
 * モジュールインポート
 * ========================================================== */
// 1. Vue関連
import { onMounted, ref } from 'vue'
// 2. 定数関連
import { CONST_VARIABLE } from '../../config/Const'
// 3. バックエンド共通関連
import { errorMessage } from '../../utils/backend'
// 4. 認証関連
import { stashPendingJoinToken } from '../../utils/auth'
// 5. テキストフィールドコンポーネント
import TextFieldComponent from '../../components/TextFieldComponent.vue'
// 6. バリデーションチェック関連
import { validateFields } from '../../utils/validation'
// 7. 共通チェック関連
import { required, maxLength, minLength, matches, notMatches, containsNumber } from '../../utils/utilCheck'
// 8. API通信関連
import { useApi } from '../../utils/useApi'
// 9. 共通型定義
import type { ApiResponse } from '../../types/utilType';
//10. メッセージ共通処理
import { messageFormat } from '../../utils/messages';

const inputFields = useInputFields();

const spinner = useOperationSpinner();

/* ==========================================================
 * ページ設定
 * ========================================================== */
/**
 * ヘッド情報を設定
 */
useHead({
  // 1. タイトルを設定
  title: CONST_VARIABLE.SYSTEM_NAME
})

/**
 * ページメタ情報を設定
 */
definePageMeta({
  // 1. ミドルウェアを設定
  middleware: ['guest']
})

/* ==========================================================
 * 定義
 * ========================================================== */
/* ------------------------------
 * 1. 処理用
 * ------------------------------*/
// 1. ダイアログユーティリティ
const dialogUtil = usePageDialogs()
// 2. エラー情報
const errorInfo = ref<Record<string, string>>({})
// 3. 利用規約同意FLG
const agreedFlg = ref(false)
// 4. 利用規約ダイアログ表示FLG
const termsOpenFlg = ref(false)

/* ------------------------------
 * 2. 入力用
 * ------------------------------*/
// 1. ユーザーID
const RefUserId = ref<InstanceType<typeof TextFieldComponent> | null>(null)
// 2. パスワード
const RefPassword = ref<InstanceType<typeof TextFieldComponent> | null>(null)
// 3. 確認用パスワード
const RefConfirmPassword = ref<InstanceType<typeof TextFieldComponent> | null>(null)

/**
 * マウント時処理
 */
onMounted(() => {
  // 1. 参加トークンを退避
  stashPendingJoinToken()
})

/**
 * 利用規約リンク押下時の処理
 */
const openTerms = (): void => {
  // 1. 利用規約ダイアログを表示
  termsOpenFlg.value = true
}

/**
 * ログインへボタン押下時の処理
 */
const backToLogin = async (): Promise<void> => {
  // 1. ログイン画面へ遷移
  await navigateTo(CONST_VARIABLE.DISPLAY_PATH.LOGIN)
}

/**
 * 登録ボタン押下時の処理
 */
const registerEvent = async (): Promise<void> => {
  /* ==========================================================
   * 事前チェック
   * ========================================================== */
  /* ------------------------------
   * 1. 利用規約未同意の場合
   * ------------------------------*/
  agreedFlg.value = inputFields.getValue('agreedFlg', false);
  if (!agreedFlg.value) {
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
      key: 'userId',
      field: RefUserId,
      rules: [
        required(messageFormat('ERROR', 'E_0001', 'ユーザーID')),
        minLength(8, messageFormat('ERROR', 'E_0005', 'ユーザーID', 8)),
        maxLength(12, messageFormat('ERROR', 'E_0002', 'ユーザーID', 12)),
        containsNumber(messageFormat('ERROR', 'E_0008', 'ユーザーID'))
      ]
    },

    /* ------------------------------
     * 2. パスワード
     * ------------------------------*/
    {
      key: 'password',
      field: RefPassword,
      rules: [
        required(messageFormat('ERROR', 'E_0001', 'パスワード')),
        minLength(8, messageFormat('ERROR', 'E_0005', 'パスワード', 8)),
        maxLength(12, messageFormat('ERROR', 'E_0002', 'パスワード', 12)),
        containsNumber(messageFormat('ERROR', 'E_0008', 'パスワード')),
        notMatches('userId', messageFormat('ERROR', 'E_0007', 'パスワード', 'ユーザーID'))
      ]
    },

    /* ------------------------------
     * 3. 確認用パスワード
     * ------------------------------*/
    {
      key: 'confirmPassword',
      field: RefConfirmPassword,
      rules: [
        required(messageFormat('ERROR', 'E_0001', '確認用パスワード')),
        matches('password', messageFormat('ERROR', 'E_0006', 'パスワード'))
      ]
    }
  ], errorInfo)

  /* ------------------------------
   * 4. 入力値に問題がある場合
   * ------------------------------*/
  if (!checkInput) {
    // 1. 処理終了
    return
  }

  /* ==========================================================
   * 会員登録処理
   * ========================================================== */
  try {
    /* ------------------------------
     * 1. 会員登録API呼び出し
     * ------------------------------*/
    const response = await spinner.run(() => useApi<ApiResponse<unknown>>('/Registration.php', 'POST', {
      UserId: checkInput.userId,
      Password: checkInput.password
    }))

    /* ------------------------------
     * 2. 会員登録に失敗した場合
     * ------------------------------*/
    if (!response.Success) {
      // 1. エラーダイアログを表示
      await dialogUtil.error(
        response.Message || messageFormat('ERROR', 'E_0003', '登録処理')
      )

      // 2. 処理終了
      return
    }

    /* ------------------------------
     * 3. 登録成功時
     * ------------------------------*/
    // 1. 登録完了ダイアログを表示
    await dialogUtil.info(
      messageFormat('INFO', 'I_0011', '登録'),
      messageFormat('INFO', 'I_0040')
    )

    // 2. ログイン画面へ遷移
    await navigateTo(CONST_VARIABLE.DISPLAY_PATH.LOGIN)

  /* ==========================================================
   * 例外処理
   * ========================================================== */
  } catch (error) {
    // 1. エラーダイアログを表示
    await dialogUtil.error(
      errorMessage(error, messageFormat('ERROR', 'E_0004', '登録'))
    )
  }
}
</script>
