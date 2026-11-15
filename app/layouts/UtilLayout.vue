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
          <ButtonComponent v-if="menuType === 'work'" unstyled type="button" class="SidebarItem SidebarBack" @click="navigate(CONST_VARIABLE.MENU_ID.BACK_TO_MAIN)">
            <i class="fas fa-arrow-left" aria-hidden="true" />メインへ戻る
          </ButtonComponent>
          <section v-for="(group,index) in visibleGroups" :key="group.label" class="SidebarGroup" :aria-labelledby="'SidebarGroup-' + menuType + '-' + index">
            <h2 :id="'SidebarGroup-' + menuType + '-' + index" class="SidebarGroupTitle">{{ group.label }}</h2>
            <ButtonComponent unstyled
              v-for="menu in group.menus"
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
          </section>
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
import type { SidebarMenu, SidebarGroup } from '../types/sidebar';
interface SessionInfo {
  UserId?: string;
  IsAdmin?: boolean;
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
  activeMenu: CONST_VARIABLE.MENU_ID.WORK_MANAGEMENT,
  version: 'ver_1.0.0',
  notificationCount: 0
});
const emit = defineEmits(['navigate', 'logout', 'settings', 'notifications']);
const open = ref(false);

// メイン画面のメニューと分類。管理者項目はセッションの権限で絞り込む。
const defaultMenus: SidebarMenu[] = [{
  id: CONST_VARIABLE.MENU_ID.WORK_MANAGEMENT,
  section: '管理',
  label: '作品管理',
  icon: 'fa-folder-open'
}, {
  id: CONST_VARIABLE.MENU_ID.NOTIFICATION_LIST,
  section: 'システム',
  label: 'システム通知一覧',
  icon: 'fa-bell'
}, {
  id: CONST_VARIABLE.MENU_ID.MEMBER_LIST,
  section: 'ユーザー管理',
  label: '会員一覧',
  icon: 'fa-users',
  admin: true
}, {
  id: CONST_VARIABLE.MENU_ID.ADMIN_LIST,
  section: 'ユーザー管理',
  label: '管理者一覧',
  icon: 'fa-user-shield',
  admin: true
}, {
  id: CONST_VARIABLE.MENU_ID.NOTIFICATION_ADMIN,
  section: '管理',
  label: 'システム通知管理',
  icon: 'fa-bullhorn',
  admin: true
}, {
  id: CONST_VARIABLE.MENU_ID.ERA_MASTER,
  section: 'マスタ管理',
  label: '元号マスタ',
  icon: 'fa-calendar-alt',
  admin: true
}, {
  id: CONST_VARIABLE.MENU_ID.TEMPLATE_MASTER,
  section: 'マスタ管理',
  label: 'テンプレートマスタ',
  icon: 'fa-file-lines',
  admin: true
}, {
  id: CONST_VARIABLE.MENU_ID.PROJECT_MANAGEMENT,
  section: '管理',
  label: '作品一覧管理',
  icon: 'fa-cogs',
  admin: true
}];

// 作品内の表示名・ID・アイコンはルーティングと同じ定義を使用する。
const workMenus: SidebarMenu[] = [
  { id: CONST_VARIABLE.MENU_ID.BACK_TO_MAIN, label: 'メインへ戻る', icon: 'fa-arrow-left' },
  ...Object.entries(CONST_VARIABLE.WORK_MENUS).map(([id, menu]) => ({ id, label: menu.label, icon: menu.icon, section: menu.section })),
];

// 旧 Main.js の IsAdmin 判定を踏襲し、セッション未取得時も管理者メニューを表示しない。
const visibleMenus = computed(() => {
  const menus = props.menuType === 'work' ? workMenus : defaultMenus;
  return menus.filter(menu => !menu.admin || props.session?.IsAdmin === true);
});
// 空の分類は作らない。管理者用の見出しも権限のない利用者には表示しない。
const visibleGroups = computed<SidebarGroup[]>(() => {
  const groups = new Map<string, SidebarMenu[]>();
  for (const menu of visibleMenus.value) {
    if (!menu.section) continue; // メインへ戻るは分類の外に置く。
    const items = groups.get(menu.section) || [];
    items.push(menu);
    groups.set(menu.section, items);
  }
  return [...groups].map(([label, menus]) => ({ label, menus }));
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
