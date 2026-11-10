<script setup lang="ts">
import { useOperationSpinner } from '../../composables/useOperationSpinner';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { BackendRequest } from '../../types/backend';
import type { WorkInfo } from '../../types/work';
import type { WorkImageRow } from '../../types/workSettings';
import type { PageDialogs } from '../../composables/usePageDialogs';
import { useInputFields } from '../../composables/useInputFields';
import { readWorkAccess } from '../../utils/workAccess';
import { requireSuccess, reportBackendError } from '../../utils/backend';
import { messageFormat } from '../../utils/messages';
const spinner = useOperationSpinner();
const props = defineProps<{
  request: BackendRequest;
  dialogs: PageDialogs;
  isAdmin: boolean;
}>();
const fields = useInputFields();
const work = ref<WorkInfo>();
const isCreator = ref(false);
const rows = ref<WorkImageRow[]>([]);
const loading = ref(false);
const screen = ref('');
const displayedImage = ref<WorkImageRow>();
const imageOpen = ref(false);
const failedImages = ref(new Set<string>());
const screenOptions = ['', 'キャラクター', '組織', 'チーム', '舞台', '建物', '武器', 'アイテム', '作品メモ'].map(label => ({
  value: label,
  label
}));
const visibleImages = computed(() => rows.value.filter(row => !screen.value || row.Screen === screen.value));
const role = computed(() => props.isAdmin ? '管理者' : isCreator.value ? '作成者' : 'アシスタント');
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
});

async function load() {
  if (disposed || loading.value) return;
  loading.value = true;
  try {
    const finished = await spinner.run(async () => {
      const access = await readWorkAccess(props.request, work.value?.WorkId);
      if (disposed) return;
      const data = requireSuccess(await props.request<WorkImageRow[]>('/GetImageList.php'), messageFormat('ERROR', 'E_0003', '画像一覧の取得'));
      if (!Array.isArray(data) || data.some(row => !row || typeof row.ImgPath !== 'string' || typeof row.Screen !== 'string')) throw new Error(messageFormat('ERROR', 'E_0026'));
      if (disposed) return;
      work.value = access.work;
      isCreator.value = access.isCreator;
      rows.value = data;
      failedImages.value = new Set();
      return true;
    });
    if (!finished) return;
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '画像一覧の取得'));
  } finally {
    if (!disposed) loading.value = false;
  }
}

/** 検索ボタンを押した時点の選択値で絞り込む。入力中の選択変更では表示を動かさない。 */


function search() {
  screen.value = String(fields.getValue('Screen', ''));
}

function openImage(row: WorkImageRow) {
  displayedImage.value = row;
  imageOpen.value = true;
}
onMounted(load);
</script>

<template>
  <div>
    <WorkContentHeader
      title="画像一覧"
      icon="fa-images"
      :work-title="work?.WorkTitle"
      :role="work ? role : undefined"
    />
    <SelectBoxComponent
      :ref="el => fields.register('Screen', el, screen)"
      label="画面"
      :options="screenOptions"
    />
    <div class="ButtonGroup">
      <ButtonComponent
        type="button"
        variant="PrimaryButton"
        :disabled="loading"
        @click="search"
      >
        <i
          class="fas fa-search"
          aria-hidden="true"
        />
        検索
      </ButtonComponent>
    </div>
    <p
      v-if="!loading && !visibleImages.length"
      class="Card"
    >{{ messageFormat('INFO', 'I_0058') }}</p>
    <div
      v-else
      class="ImageListGrid"
      :aria-busy="loading"
    >
      <ButtonComponent
        v-for="(image, index) in visibleImages"
        :key="image.ImgPath + ':' + index"
        unstyled
        type="button"
        class="ImageListCard"
        :aria-label="image.Name"
        @click="openImage(image)"
      >
        <div class="ImageListThumb">
          <i
            v-if="failedImages.has(image.ImgPath)"
            class="fa-solid fa-file-circle-xmark ImageMissingIcon"
            :aria-label="messageFormat('INFO', 'I_0058')"
          />
          <img
            v-else
            :src="image.ImgPath"
            :alt="image.Name"
            loading="lazy"
            @error="failedImages.add(image.ImgPath)"
          />
        </div>
        <div
          class="ImageListName"
          :title="image.Name"
        >{{ image.Name || '未設定' }}</div>
        <div class="ImageListScreen">{{ image.Screen }}</div>
      </ButtonComponent>
    </div>
    <ImageDialog
      v-model="imageOpen"
      :src="displayedImage?.ImgPath"
      :alt="displayedImage?.Name"
      :img-delete-flg="false"
    />
  </div>
</template>
