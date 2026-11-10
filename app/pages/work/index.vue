<script setup lang="ts">
import { useOperationSpinner } from '../../composables/useOperationSpinner';

import { messageFormat } from "../../utils/messages";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Component } from "vue";
import UtilLayout from "../../layouts/UtilLayout.vue";
import WorkCommonInfo from "../../components/work/CommonInfo.vue";
import OrganizationSetting from "../../components/work/OrganizationSetting.vue";
import TeamSetting from "../../components/work/TeamSetting.vue";
import RaceSetting from "../../components/work/RaceSetting.vue";
import ClassSetting from "../../components/work/ClassSetting.vue";
import BiographyList from "../../components/work/BiographyList.vue";
import ImageGallery from "../../components/work/ImageGallery.vue";
import type { WorkMenuId } from "../../types/workNavigation";
import { resolveWorkMenu, workLocation } from "../../utils/workNavigation";
import CharacterList from "../../components/work/character/CharacterList.vue";
import type { BackendRequest } from "../../types/backend";
import type { ApiResponse } from "../../types/utilType";
import { useApi } from "../../utils/useApi";
import {
  backendError,
  reportBackendError,
  requireSuccess,
} from "../../utils/backend";
import { CONST_VARIABLE } from "../../config/Const";
const spinner = useOperationSpinner();


useHead({ title: CONST_VARIABLE.SYSTEM_NAME });
definePageMeta({ middleware: ["auth"], requiresAuth: true });

const route = useRoute();
// 表示する部品の登録だけを行う。初期化・入力制御は各.vueが担当する。
const workViews: Record<WorkMenuId, Component> = {
  MenuWorkInfo: WorkCommonInfo,
  MenuCharacter: CharacterList,
  MenuOrganization: OrganizationSetting,
  MenuTeam: TeamSetting,
  MenuRace: RaceSetting,
  MenuClass: ClassSetting,
  MenuBiography: BiographyList,
  MenuImage: ImageGallery,
};
const activeMenu = computed(() => resolveWorkMenu(route.query.menu));
const workRevision = ref(0);
const switchingWork = ref(false);
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
  const revision = workRevision.value;
  return async <T,>(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    data?: unknown,
  ) => {
    if (
      identity !== auth.identityVersion.value ||
      workAccess !== auth.workAccessVersion.value ||
      revision !== workRevision.value
    ) {
      const error = new backendError(messageFormat('ERROR', 'E_0035'), 401);
      error.handled = true;
      throw error;
    }
    const response = await nuxtApp.runWithContext(() => useApi<ApiResponse<T>>(endpoint, method, data));
    // 切替前に送信したリクエストの応答は、新しい作品画面へ反映しない。
    if (revision !== workRevision.value) {
      const error = new backendError(messageFormat('ERROR', 'E_0028'), 409);
      error.handled = true;
      throw error;
    }
    return response;
  };
});

onMounted(async () => {
  document.body.classList.toggle(
    "DarkMode",
    localStorage.getItem(CONST_VARIABLE.LOCAL_STRAGE_KEY.DARK_MODE_FLG) ===
      "true",
  );
  hideMeta.value =
    localStorage.getItem(CONST_VARIABLE.LOCAL_STRAGE_KEY.HIDE_META_FLG) ===
    "true";
  document.body.classList.toggle("HideMetaColumns", hideMeta.value);
  await refreshBadge();
});
onBeforeUnmount(() => {
  document.body.classList.remove("DarkMode", "HideMetaColumns");
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
    const data = requireSuccess(
      await call.value<{ TotalCnt: number }>("/GetNotificationSummary.php"),
      messageFormat("ERROR", "E_0003", "通知サマリの取得"),
    );
    notificationCount.value = Math.min(data.TotalCnt || 0, 1000);
  } catch {
    // 通知取得の一時的な失敗では、作品共通情報の表示を妨げない。
  }
}

async function navigateMenu(id: string) {
  if (switchingWork.value) return;
  if (id === 'MenuBackToMain') return backToMain();
  const menu = resolveWorkMenu(id);
  if (!menu) {
    await dialogs.info(messageFormat('INFO', 'I_0035'), messageFormat('INFO', 'I_0036'));
    return;
  }
  try {
    if (!await auth.checkSession()) return;
    await navigateTo(workLocation(menu));
  } catch (error) {
    await reportBackendError(dialogs, error, messageFormat('ERROR', 'E_0038'));
  }
}

async function backToMain() {
  try {
    const finished = await spinner.run(async () => {
      requireSuccess(await call.value("/ClearCurrentWork.php", "POST", {}), messageFormat("ERROR", "E_0003", "作品セッションの解除"));
      workRevision.value++;
      workAvailable.value = false;
      await navigateTo(CONST_VARIABLE.DISPLAY_PATH.MAIN);
      return true;
    });
    if (!finished) return;
  } catch (error) {
    await reportBackendError(dialogs, error, messageFormat('ERROR', 'E_0039'));
  }
}

async function unavailable() {
  workAvailable.value = false;
  // 参加権限喪失時は、認証共通の通知を閉じた後にメインへ戻る。
  if (!auth.notice.value) await navigateTo(CONST_VARIABLE.DISPLAY_PATH.MAIN, { replace: true });
}

async function logout() {
  if (
    !(await dialogs.confirm(messageFormat("CONFIRM", "C_0001", "ログアウト")))
  )
    return;
  try {
    await auth.logout();
  } catch (error) {
    await reportBackendError(
      dialogs,
      error,
      messageFormat("ERROR", "E_0003", "ログアウト"),
    );
  }
}

/** 作品セッション変更後に表示部品を破棄し、同じURLへの移動でも新しい作品を読み直す。 */
async function moveToWork(workId: unknown, menuId?: string) {
  if (switchingWork.value) return;
  const menu = resolveWorkMenu(menuId);
  if (!menu) {
    await dialogs.info(messageFormat('INFO', 'I_0035'), messageFormat('INFO', 'I_0036'));
    return;
  }
  switchingWork.value = true;
  let changed = false;
  try {
    const finished = await spinner.run(async () => {
      requireSuccess(await call.value('/SetCurrentWork.php', 'POST', {
        WorkId: workId
      }), messageFormat('ERROR', 'E_0003', '作品セッションの設定'));
      changed = true;
      workAvailable.value = false;
      workRevision.value++;
      dialogs.cancelAll();
      notificationsOpen.value = false;
      settingsOpen.value = false;
      await nextTick();
      await navigateTo(workLocation(menu));
      return true;
    });
    if (!finished) return;
  } catch (error) {
    await reportBackendError(dialogs, error, messageFormat('ERROR', 'E_0003', '作品の移動'));
  } finally {
    if (changed) workAvailable.value = true;
    switchingWork.value = false;
  }
}

</script>

<template>
  <div>
    <UtilLayout
      v-if="session"
      :session="session"
      menu-type="work"
      :active-menu="activeMenu || undefined"
      :notification-count="notificationCount"
      @navigate="navigateMenu"
      @settings="settingsOpen = true"
      @notifications="notificationsOpen = !notificationsOpen"
      @logout="logout"
    >
      <component
        :is="workViews[activeMenu]"
        v-if="workAvailable && activeMenu"
        :key="auth.identityVersion.value + ':' + workRevision + ':' + activeMenu"
        :request="call"
        :dialogs="dialogs"
        :is-admin="session.IsAdmin"
        :hide-meta="hideMeta"
        @unavailable="unavailable"
        @navigate="navigateMenu"
      />
      <p v-else-if="!activeMenu">{{ messageFormat('INFO', 'I_0036') }}</p>
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
