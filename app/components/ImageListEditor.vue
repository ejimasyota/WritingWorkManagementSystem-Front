<script setup lang="ts">
import { messageFormat } from '../utils/messages';

import { useFieldValue } from '../composables/useFieldValue';
import { useInputFields } from '../composables/useInputFields';
import { computed, onBeforeUnmount, ref } from 'vue';
import type { CharacterImage } from '../types/character';
import type { PageDialogs } from '../composables/usePageDialogs';

const imageListLimit = 5
const imageBytesLimit = 5 * 1024 * 1024
const imageCaptionLimit = 100


const inputFields = useInputFields();
const props = withDefaults(defineProps<{ readonly?: boolean; dialogs: PageDialogs; placeholderIcon?: string }>(), { placeholderIcon: 'fa-image' });
const emit = defineEmits<{ 'value-change': []; reading: [value: boolean] }>();
const { value, setValue, getValue, updateValue } = useFieldValue<CharacterImage[]>([], () => emit('value-change'));
defineExpose({ setValue, getValue });
const fileInput = ref<{ openFilePicker: () => void; getFiles: () => File[]; setValue: (value: string) => void }>();
const reading = ref(false);
const index = ref<number | null>(null);
const opened = ref(false);
const caption = ref('');
const failed = ref(false);
const dragging = ref<number | null>(null);
const touchTarget = ref<number | null>(null);
const failedThumbnails = ref(new Set<string>());
const imageHelp = messageFormat('INFO', 'I_0010');
const current = computed(() => index.value == null ? undefined : value.value[index.value]);
let disposed = false;
onBeforeUnmount(() => { disposed = true; });
function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(messageFormat('ERROR', 'E_0003', '画像の読み込み')));
    reader.readAsDataURL(file);
  });
}
async function add() {
  const files = fileInput.value?.getFiles() || [];
  fileInput.value?.setValue('');
  if (props.readonly || reading.value || !files.length) return;
  const message = imageSelectionError(value.value, files);
  if (message) { await props.dialogs.error(message); return; }
  const before = value.value;
  reading.value = true;
  emit('reading', true);
  try {
    const added = await Promise.all(files.map(async file => ({ Path: '', Data: await readImage(file), Size: file.size, Caption: '' })));
    if (!disposed && !props.readonly && value.value === before) updateValue([...before, ...added]);
  } catch (error) {
    if (!disposed) await props.dialogs.error(error instanceof Error ? error.message : messageFormat('ERROR', 'E_0003', '画像の読み込み'));
  } finally {
    reading.value = false;
    emit('reading', false);
  }
}
function open(i: number) {
  index.value = i;
  caption.value = value.value[i]?.Caption || '';
  inputFields.setValue('caption', caption.value);
  failed.value = false;
  opened.value = true;
}
function commit() {
  if (props.readonly || index.value == null) return;
  caption.value = inputFields.getValue('caption', '');
  updateValue(value.value.map((image, i) => i === index.value ? { ...image, Caption: caption.value.trim() } : image));
  opened.value = false;
}
async function remove() {
  if (props.readonly || index.value == null) return;
  const target = index.value;
  if (!await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'この画像を削除')) || props.readonly || disposed) return;
  updateValue(value.value.filter((_, i) => i !== target));
  opened.value = false;
}
function reorder(from: number, to: number) {
  if (props.readonly || reading.value) return;
  updateValue(moveImage(value.value, from, to));
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
/** 旧画像一覧と同じく、選択分を一括で検証し、超過時は1枚も追加しない。 */
function imageSelectionError(images: CharacterImage[], files: { name: string; size: number }[]): string {
  if (images.length + files.length > imageListLimit) return messageFormat('ERROR', 'E_0014', imageListLimit, imageListLimit - images.length)
  if (files.some(file => !/\.(jpg|jpeg|png|gif|webp)$/i.test(file.name))) return messageFormat('ERROR', 'E_0015')
  if (files.some(file => file.size > imageBytesLimit)) return messageFormat('ERROR', 'E_0016')
  const pending = images.reduce((sum, image) => sum + (image.Data ? image.Size : 0), 0)
  if (pending + files.reduce((sum, file) => sum + file.size, 0) > imageBytesLimit) return messageFormat('ERROR', 'E_0017')
  return ''
}

function moveImage(images: CharacterImage[], from: number, to: number) {
  if (!images[from] || !images[to] || from === to) return images
  const next = [...images]
  const [image] = next.splice(from, 1)
  next.splice(to, 0, image!)
  return next
}
</script>

<template>
  <div>
    <div class="TagTabHeader">
      <span class="TagCountLabel">登録数: {{ value.length }} / {{ imageListLimit }}
        <InfoIconComponent title="画像" :message="imageHelp" label="画像の説明" />
      </span>
    </div>
    <div class="ImageListGrid">
      <div v-for="(image, i) in value" :key="i" class="ImageListCard SortableCard" :class="{ Dragging: dragging === i, DragOver: touchTarget === i }" :data-image-index="i" role="button" tabindex="0" :aria-label="`画像（${i === 0 ? '代表画像' : i + 1 + '枚目'}）を開く`" @click="open(i)" @keydown.enter.self.prevent="open(i)" @keydown.space.self.prevent="open(i)" @dragover.prevent @drop.prevent="drop(i)">
        <div class="ImageListThumb">
          <i v-if="failedThumbnails.has(image.Data || image.Path)" class="fa-solid fa-file-circle-xmark ImageMissingIcon" :aria-label="messageFormat('INFO', 'I_0058')" />
          <img v-else :src="image.Data || image.Path" :alt="image.Caption" loading="lazy" @error="failedThumbnails.add(image.Data || image.Path)">
        </div>
        <div class="ImageListName" :title="image.Caption">{{ image.Caption || messageFormat('INFO', 'I_0060') }}</div>
        <div class="ImageListScreen">{{ i === 0 ? '代表画像' : `${i + 1}枚目` }}{{ image.Data ? '（未保存）' : '' }}</div>
        <div v-if="!readonly && value.length > 1" class="ImageListScreen">
          <ButtonComponent unstyled type="button" class="DragHandle" draggable="true" title="並び替え" aria-label="並び替え" @click.stop @dragstart.stop="dragging = i" @dragend="dragging = null" @touchstart.stop.prevent="dragging = i" @touchmove.stop.prevent="touchMove" @touchend.stop.prevent="touchEnd" @touchcancel="dragging = null; touchTarget = null"><i class="fa-solid fa-hand" aria-hidden="true" /><span>並び替え</span></ButtonComponent>
        </div>
      </div>
      <div v-if="!readonly && value.length < imageListLimit" class="ImageListCard" data-add="true" role="button" tabindex="0" aria-label="画像を追加" @click="fileInput?.openFilePicker()" @keydown.enter.prevent="fileInput?.openFilePicker()" @keydown.space.prevent="fileInput?.openFilePicker()">
        <div class="ImageListThumb"><div class="ImageBoxPlaceholder"><i class="fas fa-plus" aria-hidden="true" /><div>{{ messageFormat('INFO', 'I_0061') }}</div></div></div>
        <div class="ImageListName">画像を追加</div>
        <div class="ImageListScreen">残り{{ imageListLimit - value.length }}枚（複数選択可）</div>
      </div>
      <div v-else-if="!value.length" class="ImageBoxPlaceholder"><i class="fas" :class="placeholderIcon" aria-hidden="true" /><div>{{ messageFormat('INFO', 'I_0059') }}</div></div>
    </div>
    <TextFieldComponent inline ref="fileInput" type="file" class="Hidden" accept=".jpg,.jpeg,.png,.gif,.webp" multiple @change="add" />
    <BaseDialog v-model="opened" :title="index === 0 ? '画像（代表画像）' : `画像（${Number(index) + 1}枚目）`" size="DialogLarge">
      <div class="ImageDialogContent">
        <i v-if="failed" class="fa-solid fa-file-circle-xmark ImageMissingIcon ImageMissingIconLarge" :aria-label="messageFormat('INFO', 'I_0058')" />
        <img v-else-if="current" :src="current.Data || current.Path" :alt="caption || '画像'" class="ImageDialogImage" @error="failed = true">
      </div>
      <TextAreaComponent :ref="el => inputFields.register('caption', el, caption)" label="説明文" :maxlength="imageCaptionLimit" :readonly="readonly" />
      <template #actions>
        <ButtonComponent type="button" variant="CloseButton" @click="opened = false">閉じる</ButtonComponent>
        <ButtonComponent v-if="!readonly" type="button" variant="DeleteButton" @click="remove">削除</ButtonComponent>
        <ButtonComponent v-if="!readonly" type="button" variant="SaveButton" @click="commit">完了</ButtonComponent>
      </template>
    </BaseDialog>
  </div>
</template>
