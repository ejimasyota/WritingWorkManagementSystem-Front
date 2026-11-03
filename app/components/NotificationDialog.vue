<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { BackendRequest } from '../types/backend';
import type { PageDialogs } from '../composables/usePageDialogs';
import { reportBackendError, requireSuccess } from '../utils/backend';
import { formatShortDate } from '../utils/mainView';
interface SystemNotification {
  NotificationId: string;
  Title: string;
  Message: string;
  RegistDate: string;
}
interface WorkNotification {
  WorkId: string;
  WorkTitle: string;
  Count: number;
}
interface NotificationData {
  SystemNotifications: SystemNotification[];
  WorkUpdateNotifications: WorkNotification[];
  SystemTotalCnt?: number;
  WorkUpdateTotalCnt?: number;
}
const props = defineProps<{
  modelValue: boolean;
  request: BackendRequest;
  dialogs: PageDialogs;
}>();
const emit = defineEmits(['update:modelValue', 'count', 'move', 'refresh']);
const loaded = ref(false);
const data = ref<NotificationData>({
  SystemNotifications: [],
  WorkUpdateNotifications: []
});
const systemCount = computed(() => data.value.SystemTotalCnt ?? data.value.SystemNotifications.length);
const workCount = computed(() => data.value.WorkUpdateTotalCnt ?? data.value.WorkUpdateNotifications.reduce((sum, work) => sum + work.Count, 0));
watch(() => props.modelValue, async open => {
  if (!open) return;
  loaded.value = false;
  data.value = {
    SystemNotifications: [],
    WorkUpdateNotifications: []
  };
  try {
    data.value = requireSuccess(await props.request<NotificationData>('/GetNotificationList.php'), '通知の取得に失敗しました');
  } catch {
    // 旧 ShowNotificationPanel と同じく、取得失敗時も空のリストを表示する。
  } finally {
    loaded.value = true;
    emit('count', Math.min(systemCount.value + workCount.value, 1000));
  }
});
function close() {
  emit('update:modelValue', false);
}
async function dismiss(notification: SystemNotification) {
  try {
    requireSuccess(await props.request('/DismissSystemNotification.php', 'POST', {
      NotificationId: notification.NotificationId
    }), '削除に失敗しました');
    const count = Math.max(0, systemCount.value - 1);
    data.value.SystemNotifications = data.value.SystemNotifications.filter(item => item.NotificationId !== notification.NotificationId);
    data.value.SystemTotalCnt = count;
    emit('count', Math.min(count + workCount.value, 1000));
    emit('refresh');
  } catch (error) {
    await reportBackendError(props.dialogs, error, '削除に失敗しました');
  }
}
function move(work: WorkNotification) {
  close();
  emit('move', work.WorkId, 'MenuHistory');
}
</script>

<template>
  <BaseDialog
    :close-on-escape="false"
    :model-value="modelValue && loaded"
    title="通知"
    title-icon="fas fa-bell"
    icon-color="#f39c12"
    size="DialogMedium"
    centered-actions
    @update:model-value="close"
  >
    <div class="NotificationPanel">
      <div class="NotificationPanelSectionTitle">
        <i class="fas fa-bullhorn" />
        システムからのお知らせ ({{ systemCount }})
      </div>
      <div class="NotificationPanelSectionBody">
        <div
          v-for="notification in data.SystemNotifications"
          :key="notification.NotificationId"
          class="NotificationPanelItem"
        >
          <div
            class="NotificationPanelItemTitle"
            :title="notification.Title"
            role="button"
            tabindex="0"
            @click="dialogs.info(notification.Title, notification.Message, 'left')"
            @keydown.enter="dialogs.info(notification.Title, notification.Message, 'left')"
          >
            {{ notification.Title }}
          </div>
          <div class="NotificationPanelItemDate">
            {{ formatShortDate(notification.RegistDate) }}
          </div>
          <button
            type="button"
            class="NotificationPanelDismiss"
            title="削除"
            @click.stop="dismiss(notification)"
          >
            <i class="fas fa-times" />
          </button>
        </div>
        <div v-if="!systemCount" class="NotificationPanelEmpty">
          通知はありません
        </div>
      </div>
      <div class="NotificationPanelSectionTitle">
        <i class="fas fa-history" />
        作品の更新 ({{ workCount }})
      </div>
      <div class="NotificationPanelSectionBody">
        <div
          v-for="work in data.WorkUpdateNotifications"
          :key="work.WorkId"
          class="NotificationPanelItem"
          role="button"
          tabindex="0"
          @click="move(work)"
          @keydown.enter="move(work)"
        >
          <div class="NotificationPanelItemTitle" :title="work.WorkTitle">
            {{ work.WorkTitle }}
          </div>
          <span class="NotificationPanelItemCount">
            {{ work.Count }}
          </span>
        </div>
        <div v-if="!workCount" class="NotificationPanelEmpty">
          更新はありません
        </div>
      </div>
    </div>
    <template #actions>
      <button type="button" class="ButtonClass CloseButton" @click="close">
        <i class="fas fa-times" />
        閉じる
      </button>
    </template>
  </BaseDialog>
</template>
