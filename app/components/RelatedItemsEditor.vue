<script setup lang="ts">
import { computed, ref } from 'vue';
import { useFieldValue } from '../composables/useFieldValue';
import { messageFormat } from '../utils/messages';
import type { PageDialogs } from '../composables/usePageDialogs';
const props = withDefaults(defineProps<{
  label: string;
  items: Record<string, unknown>[];
  idKey: string;
  nameKey: string;
  readonly?: boolean;
  required?: boolean;
  error?: string;
  dialogs: PageDialogs;
  icon?: string;
  showCount?: boolean;
  allowClear?: boolean;
  confirmRemoval?: boolean;
  addLabel?: string;
  emptyMessage?: string;
  emptySelectionMessage?: string;
}>(), {
  showCount: true,
  allowClear: true,
  confirmRemoval: true
});
const emit = defineEmits<{
  'value-change': [];
}>();
const {
  value,
  setValue,
  getValue,
  updateValue
} = useFieldValue<Record<string, unknown>[]>([], () => emit('value-change'));
defineExpose({
  setValue,
  getValue
});
const opened = ref(false);
const selection = ref<string[]>([]);
const ids = computed(() => value.value.map(row => String(row[props.idKey])));

async function open() {
  if (props.readonly) return;
  if (!props.items.length && props.emptySelectionMessage) {
    await props.dialogs.error(props.emptySelectionMessage);
    return;
  }
  selection.value = [];
  opened.value = true;
}

function toggle(row: Record<string, unknown>) {
  if (props.readonly || ids.value.includes(String(row[props.idKey]))) return;
  const id = String(row[props.idKey]);
  selection.value = selection.value.includes(id) ? selection.value.filter(value => value !== id) : [...selection.value, id];
}

function commit() {
  if (props.readonly) return;
  updateValue([...value.value, ...props.items.filter(row => selection.value.includes(String(row[props.idKey])) && !ids.value.includes(String(row[props.idKey])))].map(row => ({
    [props.idKey]: row[props.idKey],
    [props.nameKey]: row[props.nameKey]
  })));
  opened.value = false;
}

async function remove(id?: string) {
  if (props.readonly || !value.value.length) return;
  if (props.confirmRemoval && !(await props.dialogs.confirm(id == null ? messageFormat('CONFIRM', 'C_0009') : messageFormat('CONFIRM', 'C_0008'))) || props.readonly) return;
  updateValue(id == null ? [] : value.value.filter(row => String(row[props.idKey]) !== id));
}
</script>

<template>
  <FieldFrame
    :label="label"
    :required="required"
    :error="error"
  >
    <div class="TagTabHeader">
      <span
        v-if="showCount"
        class="TagCountLabel"
      >
        登録数:
        {{ value.length }}
      </span>
      <div
        v-if="!readonly"
        class="ButtonGroup TagTabButtonGroup"
      >
        <ButtonComponent
          type="button"
          variant="PrimaryButton ButtonSmall"
          @click="open"
        >
          <i
            class="fas fa-plus"
            aria-hidden="true"
          />
          {{ addLabel || label }}
        </ButtonComponent>
        <ButtonComponent
          v-if="allowClear && value.length"
          type="button"
          variant="PrimaryButton ButtonSmall"
          @click="remove()"
        >
          <i
            class="fas fa-eraser"
            aria-hidden="true"
          />
          全タグを外す
        </ButtonComponent>
      </div>
    </div>
    <div class="CharaTagCardGrid">
      <div
        v-for="item in value"
        :key="String(item[idKey])"
        class="CharaTagCard"
      >
        <span class="TagNameButton">
          <i
            :class="'fas ' + (icon || 'fa-tag')"
            aria-hidden="true"
          />
          {{ item[nameKey] }}
        </span>
        <ButtonComponent
          v-if="!readonly"
          unstyled
          type="button"
          class="CharaTagCardClose"
          aria-label="関連項目を外す"
          @click="remove(String(item[idKey]))"
        >
          <i
            class="fas fa-times"
            aria-hidden="true"
          />
        </ButtonComponent>
      </div>
      <p
        v-if="!value.length && emptyMessage"
        class="CharaTagCardEmpty"
      >{{ emptyMessage }}</p>
    </div>
    <BaseDialog
      v-model="opened"
      :title="label + '選択'"
      size="DialogMedium"
    >
      <div class="TagSelectDialogList">
        <ButtonComponent
          v-for="item in items"
          :key="String(item[idKey])"
          type="button"
          unstyled
          class="TagSelectChip"
          :class="{Selected:selection.includes(String(item[idKey])),Disabled:ids.includes(String(item[idKey]))}"
          :disabled="readonly || ids.includes(String(item[idKey]))"
          :aria-pressed="selection.includes(String(item[idKey]))"
          @click="toggle(item)"
        >
          <span class="TagSelectChipName">
            <i
              :class="'fas ' + (icon || 'fa-tag')"
              aria-hidden="true"
            />
            {{ item[nameKey] }}
          </span>
        </ButtonComponent>
      </div>
      <p
        v-if="!items.length"
        class="TagSelectEmpty"
      >{{ messageFormat('INFO', 'I_0048') }}</p>
      <template #actions>
        <ButtonComponent
          type="button"
          variant="CloseButton"
          @click="opened = false"
        >閉じる</ButtonComponent>
        <ButtonComponent
          type="button"
          variant="SaveButton"
          :disabled="readonly || !selection.length"
          @click="commit"
        >
          選択 (
          {{ selection.length }}
          )
        </ButtonComponent>
      </template>
    </BaseDialog>
  </FieldFrame>
</template>
