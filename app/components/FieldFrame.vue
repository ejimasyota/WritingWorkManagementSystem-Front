<template>
  <component :is="inline ? 'span' : 'div'" :class="inline ? 'InlineField' : 'FormGroup'">
    <label v-if="!inline || label || infoIconFlg || error" :for="inputId" class="LabelStyle" :class="{ Required: required }">
      {{ label }}
      <InfoIconComponent v-if="infoIconFlg" :title="infoTitle" :message="infoMessage" :label="label + 'の説明'" />
      <span v-if="error" class="FieldErrorIcon" tabindex="0" :data-for="inputId">
        <i class="fas fa-triangle-exclamation" aria-hidden="true" />
        <span class="ErrorTooltip" role="alert">{{ error }}</span>
      </span>
    </label>
    <slot />
    <p v-if="hint" class="HintText">{{ hint }}</p>
  </component>
</template>

<script setup lang="ts">
import { fieldProps } from '../composables/componentProps';
defineProps({
  ...fieldProps,
  inputId: String
});
</script>


