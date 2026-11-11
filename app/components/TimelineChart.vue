<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { TimelineEntry } from '../types/timeline';
import { layoutTimeline, TIMELINE_LANE_HEIGHT } from '../utils/timelineChart';
const props = defineProps<{
  entries: TimelineEntry[];
  showLegend?: boolean;
  emptyIcon?: string;
}>();
const emit = defineEmits<{
  select: [key: string];
}>();
const labelMeasure = ref<HTMLElement>();
const dateMeasure = ref<HTMLElement>();
const measured = ref(new Map<string, number>());
const layout = computed(() => layoutTimeline(props.entries, (text, kind) => measured.value.get(kind + ':' + text) || 0));

async function measure() {
  await nextTick();
  const next = new Map<string, number>();
  for (const entry of props.entries) {
    for (const [kind, element, text] of [['label', labelMeasure.value, entry.LabelText], ['date', dateMeasure.value, entry.DateText]] as const) {
      if (!element) continue;
      element.textContent = text;
      next.set(kind + ':' + text, element.offsetWidth);
    }
  }
  measured.value = next;
}
onMounted(measure);
watch(() => props.entries, measure, {
  deep: true,
  flush: 'post'
});
</script>

<template>
  <div class="TimelineChart">
    <div
      v-if="showLegend && layout"
      class="TimelineChartLegend"
    >
      <span class="TimelineChartLegendItem">
        <span class="TimelineChartLegendMark" />
        期間（発生時期〜終了時期）
      </span>
      <span class="TimelineChartLegendItem">
        <span class="TimelineChartLegendMark Point" />
        時点（終了時期なし）
      </span>
    </div>
    <span
      ref="labelMeasure"
      class="TimelineChartBarLabel TimelineChartMeasure"
      aria-hidden="true"
    />
    <span
      ref="dateMeasure"
      class="TimelineChartBarDate TimelineChartMeasure"
      aria-hidden="true"
    />
    <div class="TimelineChartScroll">
      <slot name="controls" />
      <div
        v-if="layout"
        class="TimelineChartInner"
        :style="{ width: layout.width + 'px' }"
      >
        <template
          v-for="side in [0, 1]"
          :key="side"
        >
          <div
            v-if="side === 1"
            class="TimelineChartHead"
          >
            <div
              v-for="(tick, index) in layout.ticks"
              :key="index"
              class="TimelineChartScaleLabel"
              :style="{ left: tick.left + 'px', width: tick.width + 'px' }"
            >{{ tick.label }}</div>
          </div>
          <div
            class="TimelineChartBody"
            :style="{ height: layout.heights[side] + 'px' }"
          >
            <div class="TimelineChartGrid">
              <div
                v-for="(tick, index) in layout.ticks"
                :key="index"
                class="TimelineChartGridUnit"
                :style="{ width: tick.width + 'px' }"
              />
            </div>
            <div
              v-for="card in layout.cards.filter(item => item.Side === side)"
              :key="String(card.Entry.Key)"
              class="TimelineChartBar"
              :class="{ Point: !card.Entry.HasPeriod, Child: card.Entry.IsChild }"
              :data-key="card.Entry.Key"
              :title="card.Entry.TooltipText"
              :style="{ left: card.Left + 'px', width: card.Width + 'px', top: card.Lane * TIMELINE_LANE_HEIGHT + 'px' }"
              role="button"
              tabindex="0"
              @click="emit('select', String(card.Entry.Key))"
              @keydown.enter.prevent="emit('select', String(card.Entry.Key))"
              @keydown.space.prevent="emit('select', String(card.Entry.Key))"
            >
              <span class="TimelineChartBarDate">{{ card.Entry.DateText }}</span>
              <span class="TimelineChartBarLabel">{{ card.Entry.LabelText }}</span>
            </div>
          </div>
        </template>
      </div>
      <div
        v-else
        class="TimelineChartEmpty"
      >
        <i
          class="fas"
          :class="emptyIcon || 'fa-address-book'"
          aria-hidden="true"
        />
        <p>
          <slot name="empty" />
        </p>
      </div>
    </div>
    <slot name="note" />
  </div>
</template>
