<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { SessionNotice } from '../utils/sessionManager'

const auth = useAuthSession()
const notice = auth.notice
const displayed = shallowRef<Readonly<SessionNotice> | null>(null)
// 終了アニメーション中も直前の文言を維持する。
watch(notice, value => { if (value) displayed.value = value }, { immediate: true })
const errorNotice = computed(() => {
  return !!notice.value && !['expired', 'signed-out'].includes(notice.value.kind)
})
</script>

<template>
  <InfoDialog
    :model-value="!!notice && !errorNotice"
    :title="displayed?.title"
    :message="displayed?.message"
    @confirm="auth.completeNotice"
    @cancel="auth.completeNotice"
  />
  <ErrorDialog
    :model-value="errorNotice"
    :message="displayed?.message"
    @confirm="auth.completeNotice"
    @cancel="auth.completeNotice"
  />
</template>
