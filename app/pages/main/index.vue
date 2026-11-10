<template>
  <div>
    <UtilLayout
      v-if="session"
      :key="auth.identityVersion.value"
      :session="session"
      :active-menu="activeMenu"
      :notification-count="notificationCount"
      @navigate="navigateMenu"
      @logout="logoutClickEvent"
      @settings="settingsOpen = true"
      @notifications="notificationsOpen = !notificationsOpen"
    >
      <MainProjectList
        v-if="activeMenu === 'MenuWorkManagement'"
        ref="projectList"
        :session="session"
        :request="call"
        :dialogs="dialogs"
        :hide-meta="hideMeta"
        @move="moveToWork"
        @changed="refreshBadge"
      />
      <MainManagementView
        v-else-if="canOpenMenu(activeMenu, session.IsAdmin)"
        :key="activeMenu"
        :menu-id="activeMenu"
        :session="session"
        :request="call"
        :dialogs="dialogs"
        :hide-meta="hideMeta"
        @move="moveToWork"
        @changed="refreshBadge"
      />
    </UtilLayout>
    <SettingsDialog
      v-if="session"
      :key="'settings-' + auth.identityVersion.value"
      v-model="settingsOpen"
      :user-id="session.UserId"
      :request="call"
      :dialogs="dialogs"
      @appearance="hideMeta = $event"
    />
    <NotificationDialog
      v-if="session"
      :key="'notifications-' + auth.identityVersion.value"
      v-model="notificationsOpen"
      :request="call"
      :dialogs="dialogs"
      @count="notificationCount = $event"
      @refresh="refreshBadge"
      @move="moveToWork"
    />
    <PageDialogHost :dialogs="dialogs" />
  </div>
</template>
<script setup lang="ts">
import { useOperationSpinner } from '../../composables/useOperationSpinner';

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import UtilLayout from '../../layouts/UtilLayout.vue';
import type { BackendRequest } from '../../types/backend';
import type { ApiResponse } from '../../types/utilType';
import { useApi } from '../../utils/useApi';
import { backendError, reportBackendError, requireSuccess } from '../../utils/backend';
import { stashPendingJoinToken } from '../../utils/auth';
import { resolveWorkMenu, workLocation } from '../../utils/workNavigation';
import { canOpenMenu, type MainMenuId } from '../../utils/mainMenus';
// 2. 定数関連
import {CONST_VARIABLE} from '../../config/Const';
// 9. メッセージ関連
import { messageFormat } from '../../utils/messages';
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
});

definePageMeta({
  middleware: ['auth'],
  requiresAuth: true,
});

const auth = useAuthSession();
const session = auth.user;
const nuxtApp = useNuxtApp();
const dialogs = usePageDialogs();
const switchingWork = ref(false);
const activeMenu = ref<MainMenuId>('MenuWorkManagement');
const hideMeta = ref(false);
const notificationsOpen = ref(false);
const settingsOpen = ref(false);
const notificationCount = ref(0);
const projectList = ref<{ load: () => Promise<void> }>();

/** 前の認証ユーザーの画面から、遅れて操作が再開されてもAPIへ送信しない。 */
const call = computed<BackendRequest>(() => {
  const identity = auth.identityVersion.value;
  return async <T,>(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: unknown) => {
    if (identity !== auth.identityVersion.value) {
      const error = new backendError(messageFormat('ERROR', 'E_0035'), 401);
      error.handled = true;
      throw error;
    }
    return await nuxtApp.runWithContext(() => useApi<ApiResponse<T>>(endpoint, method, data));
  };
});

/**
 * マウント時処理
 */
onMounted(async () => {
  /* ------------------------------
   * 1. 事前処理
   * ------------------------------*/
  // 1. トークンを退避
  stashPendingJoinToken();
  // 2. ダークモードの設定
  document.body.classList.toggle('DarkMode', localStorage.getItem(CONST_VARIABLE.LOCAL_STRAGE_KEY.DARK_MODE_FLG) === 'true');
  // 3. メタ情報非表示FLGを取得
  hideMeta.value = localStorage.getItem(CONST_VARIABLE.LOCAL_STRAGE_KEY.HIDE_META_FLG) === 'true';
  // 4. メタ情報の表示制御を設定
  document.body.classList.toggle('HideMetaColumns', hideMeta.value);
  // 5. 選択中メニューIDを取得
  const savedMenu = sessionStorage.getItem(CONST_VARIABLE.SESSION_KEY.MAIN_ACTIVE_MENU_ID);

  /* ------------------------------
   * 2. 選択中メニューIDが存在する場合
   * ------------------------------*/
  if (savedMenu){
    // 1. アクティブなメニューIDを設定
    switchMenu(savedMenu);
  }

  /* ------------------------------
   * 3. 終了時処理
   * ------------------------------*/
  await refreshBadge();
  await pendingJoin();
});

onBeforeUnmount(() => {
  document.body.classList.remove(CONST_VARIABLE.LOCAL_STRAGE_KEY.DARK_MODE_FLG, CONST_VARIABLE.LOCAL_STRAGE_KEY.HIDE_META_FLG);
});

// 降格・ユーザー切替時は、権限のない画面と前ユーザーの入力状態を破棄する。
watch(auth.identityVersion, () => {
  dialogs.cancelAll();
  notificationsOpen.value = false;
  settingsOpen.value = false;
  notificationCount.value = 0;
  if (!session.value || !canOpenMenu(activeMenu.value, session.value.IsAdmin)) {
    activeMenu.value = 'MenuWorkManagement';
    sessionStorage.removeItem(CONST_VARIABLE.SESSION_KEY.MAIN_ACTIVE_MENU_ID);
  }
});

watch(() => session.value?.UserId, async (current, previous) => {
  if (current && current !== previous) {
    await nextTick();
    await refreshBadge();
  }
});

watch(auth.workAccessVersion, async () => {
  dialogs.cancelAll();
  switchMenu('MenuWorkManagement');
  await nextTick();
  await projectList.value?.load();
});


async function refreshBadge() {
  try {
    const data = requireSuccess(await call.value<{ TotalCnt: number }>('/GetNotificationSummary.php'), messageFormat('ERROR', 'E_0003', '通知サマリの取得'));
    notificationCount.value = Math.min(data.TotalCnt || 0, 1000);
  } catch {
    // 認証エラーは共通処理済み。一時的な通信失敗では現在のバッジを維持する。
  }
}

/**
 * 
 * @param id 
 */
function switchMenu(id: string) {
  if (!session.value || !canOpenMenu(id, session.value.IsAdmin)) return;
  activeMenu.value = id;
  sessionStorage.setItem(CONST_VARIABLE.SESSION_KEY.MAIN_ACTIVE_MENU_ID, id);
}

/** メニュー選択時にも再確認し、保存済みのメニューIDだけでは管理画面を開かない。 */
async function navigateMenu(id: string) {
  try {
    const verified = await auth.checkSession();
    if (!verified) return;
    if (!canOpenMenu(id, verified.IsAdmin)) {
      await dialogs.error(messageFormat('ERROR', 'E_0036'));
      return;
    }
    switchMenu(id);
  } catch (error) {
    await reportBackendError(dialogs, error, messageFormat('ERROR', 'E_0037'));
  }
}

/** 通知・一覧からの移動は、共通のメニュー検証と遷移先組立てを使用する。 */
async function moveToWork(workId: unknown, menuId?: string) {
  if (switchingWork.value) return;
  const menu = resolveWorkMenu(menuId);
  if (!menu) {
    await dialogs.info(messageFormat('INFO', 'I_0035'), messageFormat('INFO', 'I_0036'));
    return;
  }
  switchingWork.value = true;
  try {
    const finished = await spinner.run(async () => {
      requireSuccess(await call.value('/SetCurrentWork.php', 'POST', {
        WorkId: workId
      }), messageFormat('ERROR', 'E_0003', '作品セッションの設定'));
      await navigateTo(workLocation(menu));
      return true;
    });
    if (!finished) return;
  } catch (error) {
    await reportBackendError(dialogs, error, messageFormat('ERROR', 'E_0003', '作品の移動'));
  } finally { switchingWork.value = false; }
}

/**
 * ログアウトボタンクリック時処理
 */
async function logoutClickEvent() {
  /* ------------------------------
   * 1. コンファームにて「いいえ」を選択した場合
   * ------------------------------*/
  if (!await dialogs.confirm(messageFormat("CONFIRM","C_0001","ログアウト"))) {
    // 1. 処理終了
    return;
  }

  /* ------------------------------
   * 2. ログアウト処理
   * ------------------------------*/
  try {
    // 1. ログアウト処理を呼び出し
    await auth.logout();

  /* ------------------------------
   * 3. 例外処理
   * ------------------------------*/
  } catch (error) {
    // 1. エラーを表示
    await reportBackendError(dialogs, error, messageFormat("ERROR","E_0003","ログアウト"));
  }
}

async function pendingJoin() {
  const token = sessionStorage.getItem('PendingJoinToken');
  if (!token) return;
  sessionStorage.removeItem('PendingJoinToken');
  if (!await dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'プロジェクトに参加'))) return;
  try {
    const finished = await spinner.run(async () => {
      requireSuccess(await call.value('/JoinProject.php', 'POST', {
        Token: token
      }), messageFormat('ERROR', 'E_0003', 'プロジェクト参加'));
      return true;
    });
    if (!finished) return;
    await dialogs.info(messageFormat('INFO', 'I_0011', '参加'), messageFormat('INFO', 'I_0001', 'プロジェクトへの参加'));
    switchMenu('MenuWorkManagement');
    await nextTick();
    await projectList.value?.load();
    await refreshBadge();
  } catch (error) {
    await reportBackendError(dialogs, error, messageFormat('ERROR', 'E_0004', 'プロジェクト参加'));
  }
}
</script>


