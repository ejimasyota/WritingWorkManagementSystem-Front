<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, reactive, ref } from 'vue';
import { useOperationSpinner } from '../../composables/useOperationSpinner';
import { useInputFields } from '../../composables/useInputFields';
import type { BackendRequest } from '../../types/backend';
import type { WorkInfo } from '../../types/work';
import type { WorkSettingRow } from '../../types/workSettings';
import type { PageDialogs } from '../../composables/usePageDialogs';
import { readRelatedItems } from '../../utils/relatedItems';
import { formatDateTime } from '../../utils/mainView';
import { readWorkAccess } from '../../utils/workAccess';
import { requireSuccess, reportBackendError } from '../../utils/backend';
import { messageFormat } from '../../utils/messages';
const props = defineProps<{
  request: BackendRequest;
  dialogs: PageDialogs;
  isAdmin: boolean;
  hideMeta?: boolean;
  targetId?: string;
  targetParentId?: string;
}>();
const spinner = useOperationSpinner();
const fields = useInputFields();
const work = ref<WorkInfo>();
const isCreator = ref(false);
const initialized = ref(false);
const loading = ref(false);
const saving = ref(false);
const opened = ref(false);
const revision = ref(0);
const rows = ref<WorkSettingRow[]>([]);
const selected = ref<WorkSettingRow | null>(null);
const errors = ref<Record<string, string>>({});
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
});
const form = reactive({
  "IndexNum": "",
  "ChapterName": "",
  "Description": "",
  "TimeId": ""
});
const canAdd = computed(() => initialized.value && !!work.value && (props.isAdmin || isCreator.value));
const canEdit = canAdd;
const dialogTitle = computed(() => 'チャプター設定（' + (selected.value ? canEdit.value ? '編集' : '詳細' : '新規登録') + '）');
const role = computed(() => props.isAdmin ? '管理者' : isCreator.value ? '作成者' : 'アシスタント');
const timelineRows = ref<WorkSettingRow[]>([]);
const characters = ref<WorkSettingRow[]>([]);
const related = ref<Record<string, unknown>[]>([]);
const TimeIdOptions = computed(() => [{
  value: '',
  label: ''
}, ...timelineRows.value.map(row => ({
  value: String(row.TimeId),
  label: String(row.Title)
}))]);
const dragged = ref<string | null>(null);
const touchTarget = ref<string | null>(null);

function beginDrag(event: DragEvent, row: WorkSettingRow) {
  if (!canEdit.value) return;
  dragged.value = String(row.ChapterId);
  event.dataTransfer?.setData('text/plain', dragged.value);
}

function touchMove(event: TouchEvent) {
  const point = event.touches[0];
  if (!point || !dragged.value) return;
  event.preventDefault();
  const element = document.elementFromPoint(point.clientX, point.clientY)?.closest<HTMLElement>('[data-chapter-id]');
  touchTarget.value = element?.dataset.chapterId || null;
}

async function drop(target: string | null) {
  const from = dragged.value;
  dragged.value = null;
  touchTarget.value = null;
  if (!from || !target || from === target || saving.value || !canEdit.value) return;
  const source = rows.value.find(row => String(row.ChapterId) === from);
  const destination = rows.value.find(row => String(row.ChapterId) === target);
  if (!source || !destination) return;
  if (source.TimeId && destination.TimeId) {
    await props.dialogs.error(messageFormat('ERROR', 'E_0056'));
    return;
  }
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0016')))) return;
  const reordered = [...rows.value];
  const index = reordered.indexOf(source);
  reordered.splice(index, 1);
  reordered.splice(reordered.indexOf(destination) + (index < rows.value.indexOf(destination) ? 1 : 0), 0, source);
  saving.value = true;
  try {
    await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed) return;
      requireSuccess(await props.request('/UpdateChapterOrder.php', 'POST', {
        OrderList: reordered.map((row, index) => ({
          ChapterId: row.ChapterId,
          IndexNum: index + 1,
          UpdateDate: row.UpdateDate
        }))
      }), messageFormat('ERROR', 'E_0003', '並び順の更新'));
    });
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '並び順の更新'));
  } finally {
    saving.value = false;
  }
  if (!disposed) await load();
}
/** 初期化と保存直前の権限確認は、この画面の作品IDに照合する。 */


async function verifyAccess() {
  try {
    const access = await readWorkAccess(props.request, work.value?.WorkId);
    if (disposed) return false;
    work.value = access.work;
    isCreator.value = access.isCreator;
    return props.isAdmin || access.isCreator;
  } catch (error) {
    initialized.value = false;
    isCreator.value = false;
    throw error;
  }
}

async function load() {
  if (disposed || loading.value || saving.value) return;
  loading.value = true;
  try {
    await spinner.run(async () => {
      await verifyAccess();
      if (disposed) return;
      const data = requireSuccess(await props.request<Record<string, WorkSettingRow[]>>('/GetChapterList.php', 'POST', {}), messageFormat('ERROR', 'E_0003', 'チャプター設定の取得'));
      if (!Array.isArray(data?.ChapterList)) throw new Error(messageFormat('ERROR', 'E_0026'));
      if (disposed) return;
      if (!Array.isArray(data.TimelineList) || !Array.isArray(data.CharacterList)) throw new Error(messageFormat('ERROR', 'E_0026'));
      timelineRows.value = data.TimelineList;
      characters.value = data.CharacterList;
      rows.value = data.ChapterList.map(row => ({
        ...row,
        CharaInfo: readRelatedItems(row.CharaInfo, 'CharaInfo', 'CharaId')
      }));
      initialized.value = true;
    });
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'チャプター設定の取得'));
  } finally {
    if (!disposed) loading.value = false;
  }
}

/** 行の更新日時を保持し、入力部品の公開メソッドへ初期値を渡す。 */


function selectRow(row: WorkSettingRow) {
  if (saving.value || loading.value) return;
  selected.value = {
    ...row
  };
  related.value = Array.isArray(row.CharaInfo) ? row.CharaInfo.map(item => ({
    ...item
  })) : [];
  form.IndexNum = String(row.IndexNum ?? '');
  form.ChapterName = String(row.ChapterName ?? '');
  form.Description = String(row.Description ?? '');
  form.TimeId = String(row.TimeId ?? '');
  fields.setValues(form);
  errors.value = {};
  revision.value++;
  opened.value = true;
}

function clear() {
  if (saving.value) return;
  related.value = [];
  selected.value = null;
  Object.assign(form, {
    "IndexNum": "",
    "ChapterName": "",
    "Description": "",
    "TimeId": ""
  });
  fields.setValues(form);
  errors.value = {};
  revision.value++;
}

function openNew() {
  if (!canAdd.value || saving.value || loading.value) return;
  clear();
  opened.value = true;
}

function close() {
  if (saving.value) return;
  opened.value = false;
  clear();
}

async function save() {
  if (!canEdit.value || saving.value || loading.value) return;
  const values = fields.getValues(form);
  errors.value = {};
  if (!values.IndexNum.trim()) errors.value.IndexNum = messageFormat('ERROR', 'E_0001', '並び順');
  if (values.IndexNum.length > 10) errors.value.IndexNum = messageFormat('ERROR', 'E_0002', '並び順', 10);
  if (!values.ChapterName.trim()) errors.value.ChapterName = messageFormat('ERROR', 'E_0001', 'チャプター名');
  if (values.ChapterName.length > 30) errors.value.ChapterName = messageFormat('ERROR', 'E_0002', 'チャプター名', 30);
  if (!/^[1-9][0-9]{0,9}$/.test(values.IndexNum)) errors.value.IndexNum = messageFormat('ERROR', 'E_0050', '並び順', 10);
  const first = Object.keys(errors.value)[0];
  if (first) {
    await nextTick();
    fields.focus(first);
    return;
  }
  const payload: Record<string, unknown> = {
    ...values,
    ChapterId: selected.value?.ChapterId ?? null,
    UpdateDate: selected.value?.UpdateDate ?? null
  };
  payload.CharaInfo = fields.getValue('CharaInfo', [] as Record<string, unknown>[]);
  await persist('/SaveChapter.php', payload, '保存');
}

async function remove() {
  const row = selected.value;
  if (!row || !canEdit.value || saving.value || loading.value) return;
  if (!(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0001', 'このチャプター設定を削除'))) || disposed) return;
  await persist('/DeleteChapter.php', {
    ChapterId: row.ChapterId,
    UpdateDate: row.UpdateDate
  }, '削除');
}
/** 1操作につき1回のスピナー。保存失敗時は入力と選択行を保持する。 */


async function persist(endpoint: string, payload: Record<string, unknown>, operation: string) {
  if (saving.value || disposed || !canEdit.value) return;
  saving.value = true;
  let completed = false;
  try {
    await spinner.run(async () => {
      if (!(await verifyAccess()) || disposed || !canEdit.value) return;
      requireSuccess(await props.request(endpoint, 'POST', payload), messageFormat('ERROR', 'E_0003', 'チャプター設定の' + operation));
      if (!disposed) completed = true;
    });
    if (completed && !disposed) await props.dialogs.info(messageFormat('INFO', 'I_0011', operation), messageFormat('INFO', 'I_0001', 'チャプター設定の' + operation));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'チャプター設定の' + operation));
  } finally {
    if (!disposed) saving.value = false;
  }
  if (completed && !disposed) {
    close();
    await load();
  }
}
onMounted(async () => {
  await load();
  if (!disposed && props.targetId) {
    const target = rows.value.find(row => String(row.ChapterId) === props.targetId);
    if (target) selectRow(target);
  }
});
</script>

<template>
  <div>
    <WorkContentHeader
      title="チャプター設定"
      icon="fa-layer-group"
      :work-title="work?.WorkTitle"
      :role="work ? role : undefined"
    />
    <div
      v-if="canAdd"
      class="ButtonGroup"
    >
      <ButtonComponent
        type="button"
        variant="SuccessButton"
        @click="openNew"
      >
        <i
          class="fas fa-plus"
          aria-hidden="true"
        />
        追加
      </ButtonComponent>
    </div>
    <div :class="rows.length ? 'TimelineVisual' : ''">
      <div
        v-for="(row,index) in rows"
        :key="String(row.ChapterId)"
        class="TimelineItem ChapterNode SortableCard"
        :class="[index % 2 === 0 ? 'TimelineLeft' : 'TimelineRight', {DropTarget:touchTarget === String(row.ChapterId)}]"
        :data-chapter-id="String(row.ChapterId)"
        @click="selectRow(row)"
        @dragover.prevent
        @drop.prevent="drop(String(row.ChapterId))"
      >
        <div class="TimelineContent">
          <div class="ChapterCardHeaderRow">
            <span class="ChapterCardIndex">{{ index+1 }}</span>
            <span
              class="TimelineTitle"
              :title="String(row.ChapterName)"
            >{{ row.ChapterName }}</span>
            <ButtonComponent
              v-if="canEdit"
              unstyled
              type="button"
              class="DragHandle"
              title="並び替え"
              aria-label="並び替え"
              draggable="true"
              @click.stop
              @dragstart="beginDrag($event,row)"
              @dragend="dragged = null"
              @touchstart.stop="dragged = String(row.ChapterId)"
              @touchmove="touchMove"
              @touchend="drop(touchTarget)"
            >
              <i
                class="fa-solid fa-hand"
                aria-hidden="true"
              />
            </ButtonComponent>
          </div>
          <div class="ChapterCardSection">
            <div class="ChapterCardSectionLabel">概要</div>
            <div class="TimelineDesc">{{ row.Description || messageFormat('INFO','I_0071') }}</div>
          </div>
          <div class="ChapterCardSection">
            <div class="ChapterCardSectionLabel">関連年表</div>
            <div
              class="TimelineDate"
              :title="String(row.TimelineTitle || '')"
            >
              <i
                v-if="row.TimelineTitle"
                class="fas fa-stream"
                aria-hidden="true"
              />
              {{ row.TimelineTitle || messageFormat('INFO','I_0071') }}
            </div>
          </div>
          <div class="ChapterCardSection">
            <div class="ChapterCardSectionLabel">主要キャラ</div>
            <div
              v-if="(row.CharaInfo as unknown[])?.length"
              class="CharaTagChipList"
            >
              <span
                v-for="chara in (row.CharaInfo as Record<string,unknown>[] || [])"
                :key="String(chara.CharaId)"
                class="CharaTagChip"
              >
                <i
                  class="fas fa-user"
                  aria-hidden="true"
                />
                {{ chara.CharaName }}
              </span>
            </div>
            <div
              v-if="!(row.CharaInfo as unknown[])?.length"
              class="TimelineDesc"
            >{{ messageFormat('INFO','I_0071') }}</div>
          </div>
          <div
            v-if="!hideMeta"
            class="ChapterCardSection ChapterCardMeta"
          >
            <div class="ChapterCardSectionLabel">メタ情報</div>
            登録年月日:
            {{ formatDateTime(row.RegistDate) }}
            <br />
            更新年月日:
            {{ formatDateTime(row.UpdateDate) }}
            <br />
            登録者:
            {{ row.RegistUser }}
            <br />
            更新者:
            {{ row.UpdateUser }}
          </div>
        </div>
      </div>
      <p
        v-if="!rows.length"
        class="ChapterCardEmpty"
      >{{ messageFormat('INFO','I_0048') }}</p>
    </div>
    <BaseDialog
      v-model="opened"
      :title="dialogTitle"
      size="DialogLarge"
    >
      <section
        :key="revision"
        class="FormSection"
      >
        <h3 class="FormSectionTitle">基本</h3>
        <div class="FormGrid">
          <TextFieldComponent
            :ref="el => fields.register('IndexNum', el, form.IndexNum)"
            label="並び順"
            info-icon-flg
            :info-message="messageFormat('INFO','I_0086')"
            :readonly="!canEdit"
            :error="errors.IndexNum"
            :maxlength="10"
            required
          />
          <TextFieldComponent
            :ref="el => fields.register('ChapterName', el, form.ChapterName)"
            label="チャプター名"
            :readonly="!canEdit"
            :error="errors.ChapterName"
            :maxlength="30"
            required
          />
          <TextFieldComponent
            :ref="el => fields.register('Description', el, form.Description)"
            label="概要"
            :readonly="!canEdit"
            :error="errors.Description"
            text-area-flg
          />
          <SelectBoxComponent
            :ref="el => fields.register('TimeId', el, form.TimeId)"
            label="関連年表"
            info-icon-flg
            :info-message="messageFormat('INFO','I_0087')"
            :options="TimeIdOptions"
            :disabled="!canEdit"
            :error="errors.TimeId"
          />
        </div>
        <RelatedItemsEditor
          :ref="el => fields.register('CharaInfo', el, related)"
          label="主要キャラ"
          :items="characters"
          id-key="CharaId"
          name-key="CharaName"
          :readonly="!canEdit"
          :dialogs="dialogs"
          icon="fa-user"
        />
      </section>
      <template #actions>
        <ButtonComponent
          type="button"
          variant="CloseButton"
          @click="close"
        >
          <i
            class="fas fa-times"
            aria-hidden="true"
          />
          閉じる
        </ButtonComponent>
        <template v-if="canEdit">
          <ButtonComponent
            type="button"
            variant="ClearButton"
            @click="clear"
          >
            <i
              class="fas fa-sync"
              aria-hidden="true"
            />
            クリア
          </ButtonComponent>
          <ButtonComponent
            v-if="selected"
            type="button"
            variant="DeleteButton"
            @click="remove"
          >
            <i
              class="fas fa-trash"
              aria-hidden="true"
            />
            削除
          </ButtonComponent>
          <ButtonComponent
            type="button"
            variant="SaveButton"
            @click="save"
          >
            <i
              class="fas fa-save"
              aria-hidden="true"
            />
            保存
          </ButtonComponent>
        </template>
      </template>
    </BaseDialog>
  </div>
</template>
