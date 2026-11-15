<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import type { DialogSectionTarget } from '../types/dialog';
const props = defineProps<{
  target?: HTMLElement;
}>();
const sections = ref<DialogSectionTarget[]>([]);
let observer: MutationObserver | undefined;
watch(() => props.target, target => {
  observer?.disconnect();
  const refresh = () => {
    sections.value = target ? [...target.querySelectorAll<HTMLElement>('.FormSectionTitle')].map(element => ({
      label: element.textContent?.trim() || '',
      element
    })).filter(item => item.label) : [];
  };
  refresh();
  if (target && typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(refresh);
    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
}, {
  immediate: true,
  flush: 'post'
});
onBeforeUnmount(() => observer?.disconnect());

function move(section: DialogSectionTarget) {
  const target = props.target;
  if (!target) return;
  target.scrollTo({
    top: section.element.getBoundingClientRect().top - target.getBoundingClientRect().top + target.scrollTop,
    behavior: 'smooth'
  });
  section.element.setAttribute('tabindex', '-1');
  section.element.focus({
    preventScroll: true
  });
}
</script>
<template>
  <nav
    v-if="sections.length"
    class="DialogSectionNavigation"
    aria-label="入力セクション"
  >
    <button
      v-for="(section, index) in sections"
      :key="index"
      type="button"
      @click="move(section)"
    >{{ section.label }}</button>
  </nav>
</template>
