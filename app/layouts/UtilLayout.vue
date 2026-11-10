<template>
  <div>
    <ButtonComponent unstyled
      id="MenuToggle"
      type="button"
      class="MenuToggle"
      aria-label="メニュー"
      :aria-expanded="open"
      @click="toggleMenu"
    >
      <i class="fas fa-bars" aria-hidden="true" />
    </ButtonComponent>
    <div id="SidebarOverlay" class="SidebarOverlay" :class="{ Open: open }" @click="closeMenu" />

    <div class="PageContainer">
      <nav id="Sidebar" class="Sidebar" :class="{ Open: open }" aria-label="メインメニュー">
        <div class="SidebarHeader">
          <h1><i class="fas fa-book-open" aria-hidden="true" /> 創作管理</h1>
          <ButtonComponent unstyled
            id="NotificationBellButton"
            type="button"
            class="NotificationBellButton"
            title="通知"
            @click="emit('notifications')"
          >
            <i class="fas fa-bell" aria-hidden="true" />
            <span
              id="NotificationBadge"
              class="NotificationBadge"
              :class="{ Hidden: !notificationCount }"
            >
              {{ notificationCount >= 1000 ? '999+' : notificationCount }}
            </span>
          </ButtonComponent>
          <ButtonComponent unstyled
            id="SettingsButton"
            type="button"
            class="SettingsButton"
            title="設定"
            @click="emit('settings')"
          >
            <i class="fas fa-cog" aria-hidden="true" />
          </ButtonComponent>
        </div>
        <div class="SidebarMenu">
          <ButtonComponent unstyled
            v-for="menu in visibleMenus"
            :id="menu.id"
            :key="menu.id"
            type="button"
            class="SidebarItem"
            :class="{ Active: activeMenu === menu.id }"
            :aria-current="activeMenu === menu.id ? 'page' : undefined"
            @click="navigate(menu.id)"
          >
            <i class="fas" :class="menu.icon" aria-hidden="true" /> {{ menu.label }}
          </ButtonComponent>
        </div>
        <div class="SidebarFooter">
          <ButtonComponent unstyled id="MenuLogout" type="button" class="SidebarItem" @click="emit('logout')">
            <i class="fas fa-sign-out-alt" aria-hidden="true" /> ログアウト
          </ButtonComponent>
          <div class="SidebarVersion">{{ version }}</div>
        </div>
      </nav>
      <main class="MainContentWrapper">
        <div id="ContentArea" class="ContentArea">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
<script setup lang="ts">
import { CONST_VARIABLE } from '../config/Const';
import { computed, ref } from 'vue';
interface SessionInfo {
  UserId?: string;
  IsAdmin?: boolean;
}
interface SidebarMenu {
  id: string;
  label: string;
  icon: string;
  admin?: boolean;
}
interface Props {
  /** メニュー項目の定義は共通レイアウトが保持し、ページは画面の区分だけを指定する。 */
  menuType?: 'main' | 'work';
  session?: SessionInfo;
  activeMenu?: string;
  version?: string;
  notificationCount?: number;
}
const props = withDefaults(defineProps<Props>(), {
  menuType: 'main',
  activeMenu: 'MenuWorkManagement',
  version: 'ver_1.0.0',
  notificationCount: 0
});
const emit = defineEmits(['navigate', 'logout', 'settings', 'notifications']);
const open = ref(false);

// 旧 Main.html の表示順・アイコンを維持する。
const defaultMenus: SidebarMenu[] = [{
  id: 'MenuWorkManagement',
  label: '作品管理',
  icon: 'fa-folder-open'
}, {
  id: 'MenuSystemNotificationList',
  label: 'システム通知一覧',
  icon: 'fa-bell'
}, {
  id: 'MenuMemberList',
  label: '会員一覧',
  icon: 'fa-users',
  admin: true
}, {
  id: 'MenuAdminList',
  label: '管理者一覧',
  icon: 'fa-user-shield',
  admin: true
}, {
  id: 'MenuSystemNotificationAdmin',
  label: 'システム通知管理',
  icon: 'fa-bullhorn',
  admin: true
}, {
  id: 'MenuEraMaster',
  label: '元号マスタ',
  icon: 'fa-calendar-alt',
  admin: true
}, {
  id: 'MenuTemplateMaster',
  label: 'テンプレートマスタ',
  icon: 'fa-file-lines',
  admin: true
}, {
  id: 'MenuProjectManagement',
  label: '作品一覧管理',
  icon: 'fa-cogs',
  admin: true
}];

// 作品内の表示名・ID・アイコンはルーティングと同じ定義を使用する。
const workMenus: SidebarMenu[] = [
  { id: 'MenuBackToMain', label: 'メインへ戻る', icon: 'fa-arrow-left' },
  ...Object.entries(CONST_VARIABLE.WORK_MENUS).map(([id, menu]) => ({ id, label: menu.label, icon: menu.icon })),
];

// 旧 Main.js の IsAdmin 判定を踏襲し、セッション未取得時も管理者メニューを表示しない。
const visibleMenus = computed(() => {
  const menus = props.menuType === 'work' ? workMenus : defaultMenus;
  return menus.filter(menu => !menu.admin || props.session?.IsAdmin === true);
});
function toggleMenu() {
  open.value = !open.value;
}
function closeMenu() {
  open.value = false;
}
function navigate(id: string) {
  if (!visibleMenus.value.some(menu => menu.id === id)) return;
  emit('navigate', id);
  closeMenu();
}
</script>
