<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { activateDialog, dialogLayer, isTopDialog, releaseDialog } from '../utils/dialogStack';
interface Props {
  modelValue: boolean;
  title?: string;
  size?: string;
  titleIcon?: string;
  iconColor?: string;
  showTitle?: boolean;
  centeredActions?: boolean;
  closeOnEscape?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  title: '',
  size: 'DialogSmall',
  showTitle: true,
  closeOnEscape: true
});
const emit = defineEmits(['update:modelValue', 'close']);
const dialogId = Symbol('dialog');
const layer = computed(() => dialogLayer(dialogId));
let disposed = false;
const container = ref<HTMLElement>();
let previousFocus: HTMLElement | null = null;
function close() {
  emit('update:modelValue', false);
  emit('close');
}

/** 多重表示時は最前面のダイアログだけが Escape・Tab を処理する。 */
function handleKeydown(event: KeyboardEvent) {
  if (!props.modelValue || !isTopDialog(dialogId)) return;
  if (event.key === 'Escape') {
    if (props.closeOnEscape) {
      event.preventDefault();
      close();
    }
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = container.value?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]');
  if (!focusable?.length) {
    event.preventDefault();
    container.value?.focus();
    return;
  }
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

// DOMの構造・アニメーションは旧 DialogOverlay / DialogContainer をそのまま使用する。
watch(() => props.modelValue, async open => {
  if (typeof document === 'undefined') return;
  document.removeEventListener('keydown', handleKeydown);
  if (!open) return;
  previousFocus = document.activeElement as HTMLElement;
  activateDialog(dialogId);
  await nextTick();
  if (disposed || !props.modelValue) return;
  document.addEventListener('keydown', handleKeydown);
  const firstInput = container.value?.querySelector<HTMLElement>('input:not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled)');
  if (isTopDialog(dialogId)) (firstInput || container.value)?.focus();
}, {
  immediate: true,
  flush: 'post'
});
function restoreFocus() {
  if (releaseDialog(dialogId)) previousFocus?.focus();
}
onBeforeUnmount(() => {
  disposed = true;
  if (typeof document !== 'undefined') document.removeEventListener('keydown', handleKeydown);
  restoreFocus();
});
</script>

<template>
  <Teleport to="body">
    <Transition name="Dialog" @after-leave="restoreFocus">
      <div v-if="modelValue" class="DialogOverlay" :style="{ zIndex: layer }">
        <div
          ref="container"
          class="DialogContainer"
          :class="size"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
        >
          <div v-if="showTitle" class="DialogTitle">
            <i
              v-if="titleIcon"
              :class="titleIcon"
              :style="{ color: iconColor }"
              aria-hidden="true"
            />
            {{ title }}
          </div>
          <div class="DialogContent">
            <slot />
          </div>
          <div class="DialogButtonArea" :class="{ CenteredDialogActions: centeredActions }">
            <slot name="actions" :close="close">
              <ButtonComponent type="button" variant="CloseButton" @click="close">
                <i class="fas fa-times" aria-hidden="true" /> 閉じる
              </ButtonComponent>
            </slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
