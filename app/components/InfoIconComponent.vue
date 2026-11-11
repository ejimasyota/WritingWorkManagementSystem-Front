<script setup lang="ts">
import { messageFormat } from '../utils/messages';
import { ref } from 'vue';
withDefaults(defineProps<{
  title?: string;
  message?: string;
  label?: string;
  imageSrc?: string;
}>(), {
  title: messageFormat('INFO', 'I_0056'),
  message: '',
  label: messageFormat('INFO', 'I_0057')
});
const opened = ref(false);
</script>

<template>
  <ButtonComponent
    unstyled
    class="InfoIconButton"
    :aria-label="label"
    @click.stop.prevent="opened = true"
  >
    <i
      class="fas fa-info-circle ContentHeaderHelpIcon"
      aria-hidden="true"
    />
  </ButtonComponent>
  <InfoDialog
    v-model="opened"
    :title="title"
    :message="message"
    :image-src="imageSrc"
  />
</template>
