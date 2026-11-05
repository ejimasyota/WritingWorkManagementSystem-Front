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
    <SpinnerOverlay :visible="busy" />
    <PageDialogHost :dialogs="dialogs" />
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import UtilLayout from '../../layouts/UtilLayout.vue';
import type { BackendRequest } from '../../types/backend';
import { backendError, reportBackendError, requireSuccess } from '../../utils/backend';
import { stashPendingJoinToken } from '../../utils/auth';
import { canOpenMenu, type MainMenuId } from '../../utils/mainMenus';
// 2. 定数関連
import {CONST_VARIABLE} from '../../config/Const';
// 9. メッセージ関連
import { messageFormat } from '../../utils/messages';

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

const config = useRuntimeConfig();
const auth = useAuthSession();
const session = auth.user;
const { request, busy } = useBackendApi();
const dialogs = usePageDialogs();
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
      const error = new backendError('認証状態が変更されました', 401);
      error.handled = true;
      throw error;
    }
    return await request<T>(endpoint, method, data);
  };
});

async function refreshBadge() {
  try {
    const data = requireSuccess(await call.value<{ TotalCnt: number }>('/GetNotificationSummary.php'), '通知サマリの取得に失敗しました');
    notificationCount.value = Math.min(data.TotalCnt || 0, 1000);
  } catch {
    // 認証エラーは共通処理済み。一時的な通信失敗では現在のバッジを維持する。
  }
}

function switchMenu(id: string) {
  if (!session.value || !canOpenMenu(id, session.value.IsAdmin)) return;
  activeMenu.value = id;
  sessionStorage.setItem('MainActiveMenuId', id);
}

/** メニュー選択時にも再確認し、保存済みのメニューIDだけでは管理画面を開かない。 */
async function navigateMenu(id: string) {
  try {
    const verified = await auth.checkSession();
    if (!verified) return;
    if (!canOpenMenu(id, verified.IsAdmin)) {
      await dialogs.error('この画面を表示する権限がありません。');
      return;
    }
    switchMenu(id);
  } catch (error) {
    await reportBackendError(dialogs, error, '権限情報を確認できませんでした');
  }
}

async function moveToWork(workId: unknown, menuId?: string) {
  try {
    requireSuccess(await call.value('/SetCurrentWork.php', 'POST', { WorkId: workId }), '作品セッションの設定に失敗しました');
    if (menuId) sessionStorage.setItem('ActiveMenuId', menuId);
    window.location.assign(config.public.legacyWorkPath);
  } catch (error) {
    await reportBackendError(dialogs, error, '作品セッションの設定に失敗したため、画面遷移を中止しました');
  }
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
  if (!await dialogs.confirm('プロジェクトに参加しますか？')) return;
  try {
    requireSuccess(await call.value('/JoinProject.php', 'POST', { Token: token }), 'プロジェクト参加に失敗しました');
    await dialogs.info('参加完了', 'プロジェクトに参加しました');
    switchMenu('MenuWorkManagement');
    await nextTick();
    await projectList.value?.load();
    await refreshBadge();
  } catch (error) {
    await reportBackendError(dialogs, error, 'プロジェクト参加中にエラーが発生しました');
  }
}

// 降格・ユーザー切替時は、権限のない画面と前ユーザーの入力状態を破棄する。
watch(auth.identityVersion, () => {
  dialogs.cancelAll();
  notificationsOpen.value = false;
  settingsOpen.value = false;
  notificationCount.value = 0;
  if (!session.value || !canOpenMenu(activeMenu.value, session.value.IsAdmin)) {
    activeMenu.value = 'MenuWorkManagement';
    sessionStorage.removeItem('MainActiveMenuId');
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

onMounted(async () => {
  stashPendingJoinToken();
  document.body.classList.toggle('DarkMode', localStorage.getItem('DarkMode') === 'true');
  hideMeta.value = localStorage.getItem('HideMetaColumns') === 'true';
  document.body.classList.toggle('HideMetaColumns', hideMeta.value);
  const savedMenu = sessionStorage.getItem('MainActiveMenuId');
  if (savedMenu) switchMenu(savedMenu);
  await refreshBadge();
  await pendingJoin();
});

onBeforeUnmount(() => {
  document.body.classList.remove('DarkMode', 'HideMetaColumns');
});
</script>


