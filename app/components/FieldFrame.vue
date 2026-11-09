<template>
  <div class="FormGroup">
    <label :for="inputId" class="LabelStyle" :class="{ Required: required }">
      {{ label }}
      <i
        v-if="infoIconFlg"
        class="fas fa-info-circle ContentHeaderHelpIcon"
        role="button"
        tabindex="0"
        :aria-label="label + 'の説明'"
        @click.stop.prevent="openInfo"
        @keydown.enter.prevent="openInfo"
        @keydown.space.prevent="openInfo"
      />
      <span v-if="error" class="FieldErrorIcon" tabindex="0" :data-for="inputId">
        <i class="fas fa-triangle-exclamation" aria-hidden="true" />
        <span class="ErrorTooltip" role="alert">{{ error }}</span>
      </span>
    </label>
    <slot />
    <p v-if="hint" class="HintText">{{ hint }}</p>
    <InfoDialog v-model="infoOpen" :title="infoTitle" :message="infoMessage" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { fieldProps } from '../composables/componentProps';
defineProps({
  ...fieldProps,
  inputId: String
});
const infoOpen = ref(false);
function openInfo() {
  infoOpen.value = true;
}
</script>


