<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
interface Props {
  modelValue: boolean;
  anchor: HTMLElement | null;
  mobile?: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();
const dropdown = ref<HTMLElement>();
const position = ref({
  top: '0px',
  left: '0px'
});
const instanceId = Symbol('dropdown');

/** 旧 ShowFilterDropdownCommon と同じく、押下したボタンの直下に配置する。 */
function updatePosition() {
  if (!props.anchor) return;
  const rect = props.anchor.getBoundingClientRect();
  const left = props.mobile ? Math.min(rect.left, window.innerWidth - 200) : rect.left;
  position.value = {
    top: `${rect.bottom + window.scrollY}px`,
    left: `${left + window.scrollX}px`
  };
}
function close() {
  emit('update:modelValue', false);
}

/** リスト内のチェック操作では閉じず、外側をクリックした場合だけ閉じる。 */
function handleOutsideClick(event: MouseEvent) {
  const target = event.target as Node;
  if (dropdown.value?.contains(target) || props.anchor?.contains(target)) return;
  close();
}
function handleOtherDropdown(event: Event) {
  if ((event as CustomEvent).detail !== instanceId) close();
}
function removeListeners() {
  if (typeof document === 'undefined') return;
  document.removeEventListener('click', handleOutsideClick);
  window.removeEventListener('scroll', updatePosition, true);
  window.removeEventListener('resize', updatePosition);
  window.removeEventListener('table-dropdown-open', handleOtherDropdown);
}
watch([() => props.modelValue, () => props.anchor], async ([open]) => {
  if (typeof document === 'undefined') return;
  removeListeners();
  if (!open) return;

  // 旧 CloseAllFilterDropdowns と同様、別の一覧で開いたリストも閉じる。
  window.dispatchEvent(new CustomEvent('table-dropdown-open', {
    detail: instanceId
  }));
  window.addEventListener('table-dropdown-open', handleOtherDropdown);
  await nextTick();
  if (!props.modelValue) return;
  updatePosition();
  document.addEventListener('click', handleOutsideClick);
  window.addEventListener('scroll', updatePosition, true);
  window.addEventListener('resize', updatePosition);
});
onBeforeUnmount(() => {
  removeListeners();
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      ref="dropdown"
      class="FilterDropdown"
      :class="{ MobileDropdown: mobile }"
      :style="position"
      @click.stop
    >
      <slot />
    </div>
  </Teleport>
</template>
