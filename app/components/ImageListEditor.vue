<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import type { CharacterImage } from '../types/character';
import type { PageDialogs } from '../composables/usePageDialogs';
import { imageCaptionLimit, imageListLimit, imageSelectionError, moveImage } from '../utils/imageList';
const props = withDefaults(defineProps<{ modelValue: CharacterImage[]; readonly?: boolean; dialogs: PageDialogs; placeholderIcon?: string }>(), { placeholderIcon: 'fa-image' });
const emit = defineEmits<{ 'update:modelValue': [value: CharacterImage[]]; reading: [value: boolean] }>();
const fileInput = ref<{ openFilePicker: () => void }>();
const reading = ref(false);
const index = ref<number | null>(null);
const opened = ref(false);
const caption = ref('');
const failed = ref(false);
const dragging = ref<number | null>(null);
const touchTarget = ref<number | null>(null);
const failedThumbnails = ref(new Set<string>());
const imageHelp = '画像は5枚まで登録できます\n1枚目の画像が代表画像となります\n画像をクリックすると説明文の入力・削除ができ、並び替えボタンをドラッグすると並び替えができます\n一度に追加できる画像は合計5MBまでです';
const current = computed(() => index.value == null ? undefined : props.modelValue[index.value]);
let disposed = false;
onBeforeUnmount(() => { disposed = true; });
function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    reader.readAsDataURL(file);
  });
}
async function add(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  input.value = '';
  if (props.readonly || reading.value || !files.length) return;
  const message = imageSelectionError(props.modelValue, files);
  if (message) { await props.dialogs.error(message); return; }
  const before = props.modelValue;
  reading.value = true;
  emit('reading', true);
  try {
    const added = await Promise.all(files.map(async file => ({ Path: '', Data: await readImage(file), Size: file.size, Caption: '' })));
    if (!disposed && !props.readonly && props.modelValue === before) emit('update:modelValue', [...before, ...added]);
  } catch (error) {
    if (!disposed) await props.dialogs.error(error instanceof Error ? error.message : '画像の読み込みに失敗しました');
  } finally {
    reading.value = false;
    emit('reading', false);
  }
}
function open(i: number) {
  index.value = i;
  caption.value = props.modelValue[i]?.Caption || '';
  failed.value = false;
  opened.value = true;
}
function commit() {
  if (props.readonly || index.value == null) return;
  emit('update:modelValue', props.modelValue.map((image, i) => i === index.value ? { ...image, Caption: caption.value.trim() } : image));
  opened.value = false;
}
async function remove() {
  if (props.readonly || index.value == null) return;
  const target = index.value;
  if (!await props.dialogs.confirm('この画像を削除しますか？') || props.readonly || disposed) return;
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== target));
  opened.value = false;
}
function reorder(from: number, to: number) {
  if (props.readonly || reading.value) return;
  emit('update:modelValue', moveImage(props.modelValue, from, to));
}
function drop(to: number) {
  if (dragging.value != null) reorder(dragging.value, to);
  dragging.value = null;
}
function touchMove(event: TouchEvent) {
  const touch = event.touches[0];
  if (!touch) return;
  const card = document.elementFromPoint(touch.clientX, touch.clientY)?.closest<HTMLElement>('[data-image-index]');
  touchTarget.value = card ? Number(card.dataset.imageIndex) : null;
}
function touchEnd() {
  if (dragging.value != null && touchTarget.value != null) reorder(dragging.value, touchTarget.value);
  dragging.value = null;
  touchTarget.value = null;
}
</script>

<template>
  <div>
    <div class="TagTabHeader">
      <span class="TagCountLabel">登録数: {{ modelValue.length }} / {{ imageListLimit }}
        <InfoIconComponent title="画像" :message="imageHelp" label="画像の説明" />
      </span>
    </div>
    <div class="ImageListGrid">
      <div v-for="(image, i) in modelValue" :key="i" class="ImageListCard SortableCard" :class="{ Dragging: dragging === i, DragOver: touchTarget === i }" :data-image-index="i" role="button" tabindex="0" :aria-label="`画像（${i === 0 ? '代表画像' : i + 1 + '枚目'}）を開く`" @click="open(i)" @keydown.enter.self.prevent="open(i)" @keydown.space.self.prevent="open(i)" @dragover.prevent @drop.prevent="drop(i)">
        <div class="ImageListThumb">
          <i v-if="failedThumbnails.has(image.Data || image.Path)" class="fa-solid fa-file-circle-xmark ImageMissingIcon" aria-label="画像がありません" />
          <img v-else :src="image.Data || image.Path" :alt="image.Caption" loading="lazy" @error="failedThumbnails.add(image.Data || image.Path)">
        </div>
        <div class="ImageListName" :title="image.Caption">{{ image.Caption || '説明文なし' }}</div>
        <div class="ImageListScreen">{{ i === 0 ? '代表画像' : `${i + 1}枚目` }}{{ image.Data ? '（未保存）' : '' }}</div>
        <div v-if="!readonly && modelValue.length > 1" class="ImageListScreen">
          <ButtonComponent unstyled type="button" class="DragHandle" draggable="true" title="並び替え" aria-label="並び替え" @click.stop @dragstart.stop="dragging = i" @dragend="dragging = null" @touchstart.stop.prevent="dragging = i" @touchmove.stop.prevent="touchMove" @touchend.stop.prevent="touchEnd" @touchcancel="dragging = null; touchTarget = null"><i class="fa-solid fa-hand" aria-hidden="true" /><span>並び替え</span></ButtonComponent>
        </div>
      </div>
      <div v-if="!readonly && modelValue.length < imageListLimit" class="ImageListCard" data-add="true" role="button" tabindex="0" aria-label="画像を追加" @click="fileInput?.openFilePicker()" @keydown.enter.prevent="fileInput?.openFilePicker()" @keydown.space.prevent="fileInput?.openFilePicker()">
        <div class="ImageListThumb"><div class="ImageBoxPlaceholder"><i class="fas fa-plus" aria-hidden="true" /><div>クリックで画像追加</div></div></div>
        <div class="ImageListName">画像を追加</div>
        <div class="ImageListScreen">残り{{ imageListLimit - modelValue.length }}枚（複数選択可）</div>
      </div>
      <div v-else-if="!modelValue.length" class="ImageBoxPlaceholder"><i class="fas" :class="placeholderIcon" aria-hidden="true" /><div>画像が登録されていません</div></div>
    </div>
    <TextFieldComponent inline ref="fileInput" type="file" class="Hidden" accept=".jpg,.jpeg,.png,.gif,.webp" multiple @change="add" />
    <BaseDialog v-model="opened" :title="index === 0 ? '画像（代表画像）' : `画像（${Number(index) + 1}枚目）`" size="DialogLarge">
      <div class="ImageDialogContent">
        <i v-if="failed" class="fa-solid fa-file-circle-xmark ImageMissingIcon ImageMissingIconLarge" aria-label="画像がありません" />
        <img v-else-if="current" :src="current.Data || current.Path" :alt="caption || '画像'" class="ImageDialogImage" @error="failed = true">
      </div>
      <TextAreaComponent v-model="caption" label="説明文" :maxlength="imageCaptionLimit" :readonly="readonly" />
      <template #actions>
        <ButtonComponent type="button" variant="CloseButton" @click="opened = false">閉じる</ButtonComponent>
        <ButtonComponent v-if="!readonly" type="button" variant="DeleteButton" @click="remove">削除</ButtonComponent>
        <ButtonComponent v-if="!readonly" type="button" variant="SaveButton" @click="commit">完了</ButtonComponent>
      </template>
    </BaseDialog>
  </div>
</template>
