<script setup lang="ts">
defineProps<{
  title: string;
  icon: string;
  workTitle?: string;
  role?: string;
  helpMessage?: string;
  helpImage?: string;
}>();
</script>
<template>
  <div
    v-if="workTitle"
    class="WorkTitle"
  >
    <i
      class="fas fa-book"
      aria-hidden="true"
    />
    <span>{{ workTitle }}</span>
  </div>
  <div class="ContentHeader WorkContentHeader">
    <h2 class="ContentTitle">
      <i
        class="fas"
        :class="icon"
        aria-hidden="true"
      />
      {{ title }}
      <InfoIconComponent
        v-if="helpMessage"
        :title="title"
        :message="helpMessage"
        :image-src="helpImage"
      />
    </h2>
    <span
      v-if="role"
      class="WorkRoleBadge"
    >
      <i
        class="fas fa-user-tag"
        aria-hidden="true"
      />
      {{ role }}
    </span>
  </div>
</template>
