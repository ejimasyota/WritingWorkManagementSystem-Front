<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import UtilLayout from '../../layouts/UtilLayout.vue';
import CharacterList from '../../components/work/character/CharacterList.vue';
import type { BackendRequest } from '../../types/backend';
import type { ApiResponse } from '../../types/utilType';
import { useApi } from '../../utils/useApi';
import { backendError, reportBackendError, requireSuccess } from '../../utils/backend';
import { CONST_VARIABLE } from '../../config/Const';

useHead({ title: CONST_VARIABLE.SYSTEM_NAME });
definePageMeta({ middleware: ['auth'], requiresAuth: true });

const route = useRoute();
const activeMenu = computed(() => route.query.menu === 'MenuCharacter' ? 'MenuCharacter' : 'MenuWorkInfo');
const hideMeta = ref(false);
const auth = useAuthSession();
const session = auth.user;
const nuxtApp = useNuxtApp();
const dialogs = usePageDialogs();
const settingsOpen = ref(false);
const notificationsOpen = ref(false);
const notificationCount = ref(0);
const workAvailable = ref(true);

/** 認証状態・作品へのアクセスが変わった後の、古い画面からの通信を止める。 */
const call = computed<BackendRequest>(() => {
  const identity = auth.identityVersion.value;
  const workAccess = auth.workAccessVersion.value;
  return async <T,>(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: unknown) => {
    if (identity !== auth.identityVersion.value || workAccess !== auth.workAccessVersion.value) {
      const error = new backendError('認証状態が変更されました', 401);
      error.handled = true;
      throw error;
    }
    return nuxtApp.runWithContext(() => useApi<ApiResponse<T>>(endpoint, method, data));
  };
});

onMounted(async () => {
  document.body.classList.toggle('DarkMode', localStorage.getItem(CONST_VARIABLE.LOCAL_STRAGE_KEY.DARK_MODE_FLG) === 'true');
  hideMeta.value = localStorage.getItem(CONST_VARIABLE.LOCAL_STRAGE_KEY.HIDE_META_FLG) === 'true';
  document.body.classList.toggle('HideMetaColumns', hideMeta.value);
  await refreshBadge();
});
onBeforeUnmount(() => {
  document.body.classList.remove('DarkMode', 'HideMetaColumns');
});
watch(auth.identityVersion, () => {
  dialogs.cancelAll();
  settingsOpen.value = false;
  notificationsOpen.value = false;
  notificationCount.value = 0;
});
watch(auth.workAccessVersion, () => {
  workAvailable.value = false;
  dialogs.cancelAll();
});

async function refreshBadge() {
  try {
    const data = requireSuccess(await call.value<{ TotalCnt: number }>('/GetNotificationSummary.php'), '通知サマリの取得に失敗しました');
    notificationCount.value = Math.min(data.TotalCnt || 0, 1000);
  } catch {
    // 通知取得の一時的な失敗では、作品共通情報の表示を妨げない。
  }
}

async function navigateMenu(id: string) {
  if (id === 'MenuBackToMain') return backToMain();
  // ページ側は遷移処理を担当し、メニューの表示項目は共通レイアウトで管理する。
  if (id !== 'MenuWorkInfo' && id !== 'MenuCharacter') return;
  try {
    if (!await auth.checkSession()) return;
    await navigateTo({ path: '/work', query: id === 'MenuCharacter' ? { menu: id } : {} });
  } catch (error) {
    await reportBackendError(dialogs, error, '画面を切り替えられませんでした');
  }
}

async function backToMain() {
  try {
    requireSuccess(await call.value('/ClearCurrentWork.php', 'POST', {}), '作品セッションの解除に失敗しました');
    await navigateTo('/main');
  } catch (error) {
    await reportBackendError(dialogs, error, 'メイン画面へ戻れませんでした');
  }
}

async function unavailable() {
  workAvailable.value = false;
  // 参加権限喪失時は、認証共通の通知を閉じた後にメインへ戻る。
  if (!auth.notice.value) await navigateTo('/main', { replace: true });
}

async function logout() {
  if (!await dialogs.confirm('ログアウトしますか？')) return;
  try {
    await auth.logout();
  } catch (error) {
    await reportBackendError(dialogs, error, 'ログアウトに失敗しました');
  }
}

async function moveToWork(workId: unknown, menuId?: string) {
  if (menuId && !['MenuWorkInfo', 'MenuCharacter'].includes(menuId)) {
    await dialogs.info('お知らせ', 'この画面はまだ利用できません');
    return;
  }
  try {
    requireSuccess(await call.value('/SetCurrentWork.php', 'POST', { WorkId: workId }), '作品セッションの設定に失敗しました');
    // 別作品のフォーム状態を破棄して、新しい作品を読み込む。
    window.location.assign(menuId === 'MenuCharacter' ? '/work?menu=MenuCharacter' : '/work');
  } catch (error) {
    await reportBackendError(dialogs, error, '作品の移動に失敗しました');
  }
}
</script>

<template>
  <div>
    <UtilLayout
      v-if="session" :session="session" menu-type="work" :active-menu="activeMenu"
      :notification-count="notificationCount"
      @navigate="navigateMenu"
      @settings="settingsOpen = true" @notifications="notificationsOpen = !notificationsOpen" @logout="logout"
    >
      <WorkCommonInfo
        v-if="workAvailable && activeMenu === 'MenuWorkInfo'" :key="auth.identityVersion.value" :request="call" :dialogs="dialogs"
        :is-admin="session.IsAdmin" @unavailable="unavailable"
      />
      <CharacterList
        v-if="workAvailable && activeMenu === 'MenuCharacter'" :key="'characters-' + auth.identityVersion.value"
        :request="call" :dialogs="dialogs" :is-admin="session.IsAdmin" :hide-meta="hideMeta"
        @unavailable="unavailable"
      />
    </UtilLayout>
    <SettingsDialog
      v-if="session" :key="'settings-' + auth.identityVersion.value" v-model="settingsOpen"
      :user-id="session.UserId" :request="call" :dialogs="dialogs" @appearance="hideMeta = $event"
    />
    <NotificationDialog
      v-if="session" :key="'notifications-' + auth.identityVersion.value" v-model="notificationsOpen"
      :request="call" :dialogs="dialogs" @count="notificationCount = $event" @refresh="refreshBadge" @move="moveToWork"
    />
    <PageDialogHost :dialogs="dialogs" />
  </div>
</template>
