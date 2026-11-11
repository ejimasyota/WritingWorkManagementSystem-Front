<script setup lang="ts">
/** 階層データを入れ子で描画する。項目・権限・操作は呼び出し元のスロットが担当する。 */
import type { HierarchyNode } from '../types/hierarchy';
defineProps<{
  nodes: HierarchyNode[];
  childrenClass?: string;
}>();
</script>
<template>
  <div
    v-if="nodes.length"
    :class="childrenClass"
  >
    <div
      v-for="node in nodes"
      :key="node.key"
    >
      <slot :node="node" />
      <HierarchyBranch
        :nodes="node.children"
        :children-class="childrenClass"
      >
        <template #default="scope">
          <slot :node="scope.node" />
        </template>
      </HierarchyBranch>
    </div>
  </div>
</template>
