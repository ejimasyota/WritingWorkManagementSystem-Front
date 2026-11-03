<script setup lang="ts">
import { ref, watch } from 'vue';
import { errorMessage } from '../utils/backend';
interface TermsSection {
  SectionLabel?: string;
  Info?: string;
  Important?: string;
  List?: {
    Info?: string;
  }[];
  ContactEmail?: string;
}
const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits(['update:modelValue', 'error']);
const sections = ref<TermsSection[]>([]);
const loaded = ref(false);
const loading = ref(false);

/** 旧 LoadMessages のJSONをそのまま使用する。HTMLとして解釈せず描画する。 */
watch(() => props.modelValue, async open => {
  if (!open || loaded.value || loading.value) return;
  loading.value = true;
  try {
    const response = await fetch('/config/Messages.json', {
      cache: 'no-cache'
    });
    if (!response.ok) throw new Error('メッセージ定義の読込に失敗しました');
    const messages = await response.json();
    sections.value = Array.isArray(messages.Terms) ? messages.Terms : [];
    loaded.value = true;
  } catch (error) {
    emit('update:modelValue', false);
    emit('error', errorMessage(error, '利用規約の取得に失敗しました'));
  } finally {
    loading.value = false;
  }
});
function close() {
  emit('update:modelValue', false);
}
</script>

<template>
  <BaseDialog
    :close-on-escape="false"
    :model-value="modelValue && loaded"
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
      <button type="button" class="ButtonClass PrimaryButton" @click="close">
        <i class="fas fa-check" aria-hidden="true" />
        確認しました
      </button>
    </template>
  </BaseDialog>
  <SpinnerOverlay :visible="loading" />
</template>
