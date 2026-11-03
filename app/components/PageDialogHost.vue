<script setup lang="ts">
import type { PageDialogs } from '../composables/usePageDialogs'

const props = defineProps<{ dialogs: PageDialogs }>()
const { current, visible, finish } = props.dialogs
</script>

<template>
  <InfoDialog
    :model-value="visible && current?.kind === 'info'"
    :title="current?.kind === 'info' ? current.title : undefined"
    :text-align="current?.textAlign"
    :message="current?.message"
    @confirm="finish(true)"
    @cancel="finish(false)"
  />
  <ErrorDialog
    :model-value="visible && current?.kind === 'error'"
    :message="current?.message"
    @confirm="finish(true)"
    @cancel="finish(false)"
  />
  <ConfirmDialog
    :model-value="visible && current?.kind === 'confirm'"
    :message="current?.message"
    @confirm="finish(true)"
    @cancel="finish(false)"
  />
</template>
