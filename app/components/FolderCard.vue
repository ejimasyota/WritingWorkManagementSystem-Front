<script setup lang="ts">
/** 旧CreateFolderCardHtmlと同じ構造。フォルダ固有の操作は呼び出し側で定義する。 */
defineProps<{
  title: string;
  badge?: string;
}>();
const emit = defineEmits<{
  open: [];
}>();
</script>
<template>
  <div
    class="StoryFolderCard"
    role="button"
    tabindex="0"
    @click="emit('open')"
    @keydown.enter.self="emit('open')"
    @keydown.space.self.prevent="emit('open')"
  >
    <div class="StoryFolderTab" />
    <div class="StoryFolderBody">
      <div class="StoryFolderTitle">{{ title }}</div>
      <div
        v-if="badge"
        class="StoryFolderBadge"
      >{{ badge }}</div>
      <div
        class="StoryFolderActions"
        @click.stop
        @keydown.stop
      >
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
