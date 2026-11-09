<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { CharacterMasters, CharacterRow } from '../../../types/character';
import type { PageDialogs } from '../../../composables/usePageDialogs';
import { characterEntries, characterFields, characterSkills, characterSections } from '../../../utils/characterFields';
import { characterOptions, characterPayload, createCharacterDraft, validMoveIds } from '../../../utils/characterData';
import { setFieldHandle } from '../../../utils/validation';
import { characterAge, characterDateError } from '../../../utils/characterDates';
import SkillEditor from './SkillEditor.vue';
import TagEditor from './TagEditor.vue';
const props = defineProps<{
  modelValue: boolean;
  row?: CharacterRow;
  masters: CharacterMasters;
  settingDate: string;
  canEdit: boolean;
  saving: boolean;
  dialogs: PageDialogs;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  save: [payload: Record<string, unknown>];
  delete: [];
  clear: [];
  'refresh-tags': [];
}>();
const draft = ref(createCharacterDraft());
// 補助入力・色・サブ一覧の内部状態も初期化するためのフォーム更新番号。
const formRevision = ref(0);
const errors = ref<Record<string, string>>({});
const fieldHandles = ref<Record<string, { focus: () => void }>>({});
const readingImages = ref(false);
const confirmingDate = ref(false);
const readOnly = computed(() => !props.canEdit);
const title = computed(() => `キャラ設定（${props.row ? props.canEdit ? '編集' : '詳細' : '新規登録'}）`);
watch(() => props.modelValue, open => {
  if (!open) return;
  draft.value = createCharacterDraft(props.row, props.masters);
  errors.value = {};
}, { immediate: true });

watch(() => draft.value.skills.Powers, powers => {
  draft.value.skills.Moves = validMoveIds(powers || [], draft.value.skills.Moves || [], props.masters.Move || []);
}, { deep: true });
watch(() => props.masters.Tag, tags => {
  // タグマスタから復帰した際、削除済みのタグを除去し、名称・色・説明を最新にする。
  draft.value.tags = draft.value.tags.flatMap(tag => {
    const latest = tags?.find(item => String(item.TagId) === String(tag.TagId));
    return latest ? [{ ...latest }] : [];
  });
});

/**
 * キャラ入力フォームを初期化する。
 * 旧ClearCharacterFormと同じく入力・表・技能・画像・タグ・エラーを消し、
 * 選択IDの解除は親へ通知する。外側のダイアログは閉じずに維持する。
 */
function clear() {
  if (readOnly.value || props.saving || readingImages.value || confirmingDate.value) return;
  // 1. 全入力と、表・技能・画像・タグを新規登録時の値へ戻す。
  draft.value = createCharacterDraft();
  // 2. バリデーションエラーを初期化する。
  errors.value = {};
  // 3. ピッカー初期色、補助ダイアログ、サブ一覧のページ等も初期化する。
  formRevision.value++;
  // 4. 旧実装と同様に選択ID・更新日時を解除し、新規登録モードへ戻す。
  emit('clear');
}

function close() {
  emit('update:modelValue', false);
}
async function updateField(key: string, value: string | number) {
  if (readOnly.value) return;
  const before = draft.value.fields[key] || '';
  const next = String(value);
  if (key === 'DeathDate' && before && !next && draft.value.fields.CauseOfDeath) {
    confirmingDate.value = true;
    const currentDraft = draft.value;
    try {
      if (!await props.dialogs.confirm('没年月日が空欄になっています。死因の内容が初期化されますがよろしいですか？')) {
        // 子入力欄に残った空値も元の没年月日へ戻す。
        draft.value.fields.DeathDate = '';
        await nextTick();
        if (draft.value === currentDraft) {
          draft.value.fields.DeathDate = before;
          draft.value.fields.Age = characterAge(draft.value.fields.BirthDate || '', before, props.settingDate);
        }
        return;
      }
      if (draft.value !== currentDraft || !props.modelValue || !props.canEdit) return;
    } finally {
      confirmingDate.value = false;
    }
  }
  draft.value.fields[key] = next;
  if (key === 'OrgId') {
    draft.value.fields.TeamId = '';
    draft.value.fields.ClassId = '';
  }
  if (key === 'BirthDate' || key === 'DeathDate') {
    if (key === 'DeathDate' && !next) draft.value.fields.CauseOfDeath = '';
    draft.value.fields.Age = characterAge(draft.value.fields.BirthDate || '', draft.value.fields.DeathDate || '', props.settingDate);
  }
}
function normalizeFurigana() {
  if (readOnly.value) return;
  draft.value.fields.Furigana = (draft.value.fields.Furigana || '').replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60));
}
async function save() {
  // 重複送信は処理側で止め、スピナーや確認表示を理由にフォームを非活性化しない。
  if (readOnly.value || props.saving || readingImages.value || confirmingDate.value) return;
  errors.value = {};
  if (!draft.value.fields.CharaName?.trim()) errors.value.CharaName = 'キャラ名を入力してください';
  const dateError = characterDateError(draft.value.fields.BirthDate || '', draft.value.fields.DeathDate || '');
  if (dateError) errors.value.DeathDate = dateError;
  const first = Object.keys(errors.value)[0];
  if (first) {
    await nextTick();
    fieldHandles.value[first]?.focus();
    return;
  }
  emit('save', characterPayload(draft.value, props.row));
}
function availableSkills(key: string, master: string) {
  const rows = props.masters[master] || [];
  return key === 'Moves' ? rows.filter(move => !move.PowerId || draft.value.skills.Powers?.includes(String(move.PowerId))) : rows;
}
</script>

<template>
  <BaseDialog :model-value="modelValue" :title="title" size="DialogLarge CharacterSettingDialog" @update:model-value="close">
    <div :key="formRevision" class="CharacterSections">
      <section v-for="section in characterSections" :key="section[0]" class="FormSection" :aria-label="section[1]">
        <h3 class="FormSectionTitle">{{ section[1] }}</h3>
        <div class="FormGrid">
          <template v-for="field in characterFields.filter(item => item.section === section[0])" :key="field.key">
            <SelectBoxComponent
              v-if="field.type === 'select'" :model-value="draft.fields[field.key]" :label="field.label"
              :options="characterOptions(field.options!, draft.fields, masters)" :disabled="readOnly"
              @update:model-value="value => updateField(field.key, value)"
            />
            <div v-else class="FormGridItem" :class="{ FormGridFullWidth: field.type === 'long' }">
              <TextFieldComponent
                :ref="el => setFieldHandle(fieldHandles, field.key, el)"
                :model-value="draft.fields[field.key]" :label="field.label" :required="field.key === 'CharaName'"
                :maxlength="field.maxLength" :error="errors[field.key]" :type="field.type === 'number' ? 'number' : 'text'"
                :color-picker-flg="field.type === 'color'" :text-area-flg="field.type === 'long'" :date-picker-flg="field.type === 'date' && canEdit"
                :input-readonly="field.type === 'date'" :readonly="!canEdit"
                :disabled="field.key === 'CauseOfDeath' && !draft.fields.DeathDate"
                :info-icon-flg="!!field.help" :info-title="field.label" :info-message="field.help"
                @update:model-value="value => updateField(field.key, value)"
                @blur="field.key === 'Furigana' && normalizeFurigana()"
              />
            </div>
          </template>
        </div>
        <div class="FormGrid">
          <EntryTableEditor v-for="definition in characterEntries.filter(item => item.section === section[0])" :key="definition.key" :model-value="draft.entries[definition.key] || []" @update:model-value="value => draft.entries[definition.key] = value" :definition="definition" :readonly="readOnly" :dialogs="dialogs" />
        </div>
        <template v-if="section[0] === 'skill'">
          <SkillEditor v-for="definition in characterSkills" :key="definition.key" :model-value="draft.skills[definition.key] || []" @update:model-value="value => draft.skills[definition.key] = value" :definition="definition" :masters="masters[definition.master] || []" :available="availableSkills(definition.key, definition.master)" :readonly="readOnly" :dialogs="dialogs" />
        </template>
        <TagEditor v-if="section[0] === 'tag'" v-model="draft.tags" :masters="masters.Tag || []" :existing="!!row" :readonly="readOnly" :dialogs="dialogs" @refresh="emit('refresh-tags')" />
        <ImageListEditor placeholder-icon="fa-user" v-if="section[0] === 'image'" v-model="draft.images" :readonly="!canEdit" :dialogs="dialogs" @reading="readingImages = $event" />
      </section>
    </div>
    <template #actions>
      <ButtonComponent type="button" variant="CloseButton" @click="close"><i class="fas fa-times" aria-hidden="true" /> 閉じる</ButtonComponent>
      <template v-if="canEdit">
        <ButtonComponent type="button" variant="ClearButton" @click="clear"><i class="fas fa-sync" aria-hidden="true" /> クリア</ButtonComponent>
        <ButtonComponent v-if="row" type="button" variant="DeleteButton" @click="emit('delete')"><i class="fas fa-trash" aria-hidden="true" /> 削除</ButtonComponent>
        <ButtonComponent type="button" variant="SaveButton" @click="save"><i class="fas fa-save" aria-hidden="true" /> 保存</ButtonComponent>
      </template>
    </template>
  </BaseDialog>
</template>

