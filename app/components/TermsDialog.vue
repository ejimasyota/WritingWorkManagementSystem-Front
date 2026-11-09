<template>
  <BaseDialog
    :close-on-escape="false"
    :model-value="modelValue"
    title="利用規約"
    title-icon="fas fa-file-contract"
    icon-color="#3498db"
    size="DialogMedium"
    centered-actions
    @update:model-value="close"
  >
    <div class="TermsContent">
      <h3>
        創作管理システム利用規約
      </h3>
      <section v-for="(section, index) in sections" :key="index">
        <h4>
          {{ section.SectionLabel }}
        </h4>
        <p v-if="section.Info">
          {{ section.Info }}
        </p>
        <p v-if="section.Important" class="TermsImportant">
          {{ section.Important }}
        </p>
        <ul v-if="section.List?.length">
          <li v-for="(item, itemIndex) in section.List" :key="itemIndex">
            {{ item.Info }}
          </li>
        </ul>
        <p v-if="section.ContactEmail" class="TermsContact">
          連絡先：
          <a :href="'mailto:' + section.ContactEmail">
            {{ section.ContactEmail }}
          </a>
        </p>
      </section>
    </div>
    <template #actions>
      <ButtonComponent
        type="button"
        variant="PrimaryButton"
        @click="close"
      >
        <i class="fas fa-check" aria-hidden="true" />
        確認しました
      </ButtonComponent>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
/* ==========================================================
 * モジュールインポート
 * ========================================================== */
// 1. 利用規約メッセージ
import termsMessages from '../config/messages.json'
// 2. 利用規約型定義
import type { TermsSection } from '../types/termsDialogType'

/* ==========================================================
 * Props定義
 * ========================================================== */
/**
 * props定義
 */
defineProps<{
  // 1. ダイアログ表示状態
  modelValue: boolean
}>()

/**
 * Emit定義
 */
const emit = defineEmits(['update:modelValue', 'error'])

/* ==========================================================
 * 事前定義
 * ========================================================== */
// 1. 利用規約メッセージを取得
const sections: TermsSection[] = Array.isArray(termsMessages.Terms) ? termsMessages.Terms : []

/**
 * 利用規約ダイアログを閉じる
 */
const close = (): void => {
  /* ==========================================================
   * ダイアログを閉じる
   * ========================================================== */
  // 1. 親コンポーネントにダイアログを閉じるよう通知
  emit('update:modelValue', false)
}
</script>