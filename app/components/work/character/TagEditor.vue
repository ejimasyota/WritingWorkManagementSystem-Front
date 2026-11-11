<script setup lang="ts">
import { messageFormat } from '../../../utils/messages';
import { useFieldValue } from '../../../composables/useFieldValue';
import { computed, ref } from 'vue';
import type { CharacterMaster } from '../../../types/character';
import type { PageDialogs } from '../../../composables/usePageDialogs';
import { tagStyle } from '../../../utils/tagStyle';
const props = defineProps<{
  masters: CharacterMaster[];
  readonly: boolean;
  existing: boolean;
  dialogs: PageDialogs;
}>();
const emit = defineEmits<{
  'value-change': [];
  refresh: [];
  manage: [];
}>();
const {
  value,
  setValue,
  getValue,
  updateValue
} = useFieldValue<CharacterMaster[]>([], () => emit('value-change'));
defineExpose({
  setValue,
  getValue
});
const opened = ref(false);
const selection = ref<string[]>([]);
const tagHelp = messageFormat('INFO', 'I_0032');
const selectionHelp = messageFormat('INFO', 'I_0033');
const selectedIds = computed(() => value.value.map(tag => String(tag.TagId)));

function open() {
  if (props.readonly || value.value.length >= 10) return;
  emit('refresh');
  selection.value = [];
  opened.value = true;
}

function commit() {
  if (props.readonly) return;
  const added = props.masters.filter(tag => selection.value.includes(String(tag.TagId)) && !selectedIds.value.includes(String(tag.TagId)));
  // 旧タグ追加と同じく、マスタ順に重複を除き、残りの登録枠まで取り込む。
  updateValue([...value.value, ...added.slice(0, Math.max(0, 10 - value.value.length))]);
  opened.value = false;
}

async function remove(tag?: CharacterMaster) {
  if (props.readonly || !tag && !value.value.length) return;
  if (!(await props.dialogs.confirm(tag ? messageFormat('CONFIRM', 'C_0008') : messageFormat('CONFIRM', 'C_0009'))) || props.readonly) return;
  updateValue(tag ? value.value.filter(item => String(item.TagId) !== String(tag.TagId)) : []);
}

function toggleSelection(tag: CharacterMaster) {
  if (props.readonly || selectedIds.value.includes(String(tag.TagId))) return;
  const id = String(tag.TagId);
  selection.value = selection.value.includes(id) ? selection.value.filter(item => item !== id) : [...selection.value, id];
}
</script>

<template>
  <div>
    <div class="TagTabHeader">
      <span class="TagCountLabel">
        登録数:
        {{ value.length }}
        / 10
        <InfoIconComponent
          title="タグ"
          :message="tagHelp"
          label="タグの説明"
        />
      </span>
      <div
        v-if="!readonly"
        class="ButtonGroup TagTabButtonGroup"
      >
        <ButtonComponent
          type="button"
          variant="PrimaryButton ButtonSmall"
          :disabled="value.length >= 10"
          @click="open"
        >
          <i
            class="fas fa-plus"
            aria-hidden="true"
          />
          タグ追加
        </ButtonComponent>
        <ButtonComponent
          v-if="existing"
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
        <ButtonComponent
          type="button"
          variant="PrimaryButton ButtonSmall"
          @click="emit('manage')"
        >
          <i
            class="fas fa-tags"
            aria-hidden="true"
          />
          タグマスタ画面へ
        </ButtonComponent>
      </div>
    </div>
    <div class="CharaTagCardGrid">
      <div
        v-for="tag in value"
        :key="String(tag.TagId)"
        class="CharaTagCard"
        :style="tagStyle(tag)"
      >
        <ButtonComponent
          unstyled
          type="button"
          class="TagNameButton"
          @click="dialogs.info(String(tag.TagName || ''), String(tag.Description || messageFormat('INFO', 'I_0034')), 'left')"
        >
          <i
            class="fas fa-tag"
            aria-hidden="true"
          />
          {{ tag.TagName }}
        </ButtonComponent>
        <ButtonComponent
          unstyled
          v-if="!readonly"
          type="button"
          class="CharaTagCardClose"
          aria-label="タグを外す"
          @click="remove(tag)"
        >
          <i
            class="fas fa-times"
            aria-hidden="true"
          />
        </ButtonComponent>
      </div>
      <p
        v-if="!value.length"
        class="CharaTagCardEmpty"
      >{{ messageFormat('INFO', 'I_0062') }}</p>
    </div>
    <BaseDialog
      v-model="opened"
      title="タグ選択"
      size="DialogMedium"
    >
      <div class="TagTabHeader">
        <InfoIconComponent
          title="タグ選択"
          :message="selectionHelp"
          label="タグ選択の説明"
        />
      </div>
      <div
        v-if="masters.length"
        class="TagSelectDialogList"
      >
        <ButtonComponent
          v-for="tag in masters"
          :key="String(tag.TagId)"
          unstyled
          class="TagSelectChip"
          :class="{ Disabled: selectedIds.includes(String(tag.TagId)), Selected: selection.includes(String(tag.TagId)) }"
          :style="tagStyle({ ...tag, TagColor: tag.TagColor || '#cccccc' })"
          :disabled="readonly || selectedIds.includes(String(tag.TagId))"
          :aria-pressed="selection.includes(String(tag.TagId))"
          @click="toggleSelection(tag)"
        >
          <span class="TagSelectChipName">
            <i
              class="fa-solid fa-tag"
              aria-hidden="true"
            />
            {{ tag.TagName }}
          </span>
        </ButtonComponent>
      </div>
      <p
        v-else
        class="TagSelectEmpty"
      >{{ messageFormat('INFO', 'I_0051') }}</p>
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
          <i
            class="fas fa-check"
            aria-hidden="true"
          />
          選択 (
          {{ selection.length }}
          )
        </ButtonComponent>
      </template>
    </BaseDialog>
  </div>
</template>
