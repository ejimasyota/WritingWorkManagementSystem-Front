<script setup lang="ts">
import { useInputFields } from '../../../composables/useInputFields';
import { computed, nextTick, ref, watch } from 'vue';
import type { CharacterMasters, CharacterRow, CharacterDraft, CharacterEntry, CharacterImage, CharacterMaster, EntryDefinition } from '../../../types/character';
import type { PageDialogs } from '../../../composables/usePageDialogs';
import { parseEntry } from '../../../utils/entryData';
import { restoreImages, imagePayload } from '../../../utils/imageData';
import { parseFlexibleDate, calculateAge } from '../../../utils/dates';
import { messageFormat } from '../../../utils/messages';
import SkillEditor from './SkillEditor.vue';
import TagEditor from './TagEditor.vue';

const inputFields = useInputFields();
const reason = (label: string) => [
  { key: 'Content', label: '内容', required: true, maxLength: 255 },
  { key: 'Reason', label, multiline: true },
]
const characterEntries: EntryDefinition[] = [
  { key: 'Likes', label: '好きな物', section: 'inner1', columns: reason('理由') },
  { key: 'Dislikes', label: '嫌いな物', section: 'inner1', columns: reason('理由') },
  { key: 'Landmine', label: '地雷', section: 'inner2', columns: reason('理由') },
  { key: 'StrongPoint', label: '長所', section: 'inner2', columns: reason('具体例') },
  { key: 'WeakPoint', label: '短所', section: 'inner2', columns: reason('具体例') },
  { key: 'FirstPerson', label: '一人称', section: 'detail', columns: [
    { key: 'Situation', label: '状況', maxLength: 255 },
    { key: 'Content', label: '一人称', required: true, maxLength: 50 },
  ] },
  { key: 'SecondPerson', label: '二人称', section: 'detail', columns: [
    { key: 'Situation', label: '状況', maxLength: 255 },
    { key: 'Content', label: '二人称', required: true, maxLength: 50 },
  ] },
  { key: 'Habit', label: '癖', section: 'detail2', columns: reason('具体例') },
  { key: 'Hobby', label: '趣味', section: 'detail2', columns: reason('きっかけ') },
  { key: 'Transition', label: '変遷', section: 'detail3', maxRows: 1, helpMessage: messageFormat('INFO', 'I_0009'), columns: [
    { key: 'Early', label: '序盤', required: true, multiline: true },
    { key: 'Late', label: '中盤', multiline: true },
    { key: 'Final', label: '最終的', multiline: true },
  ] },
]

const characterSkills = [
  { key: 'Weapons', label: '武器', master: 'Weapon', id: 'WeaponId', name: 'WeaponName', help: messageFormat('INFO', 'I_0006') },
  { key: 'Powers', label: '能力', master: 'Power', id: 'PowerId', name: 'PowerName', help: messageFormat('INFO', 'I_0007') },
  { key: 'Moves', label: '技', master: 'Move', id: 'MoveId', name: 'MoveName', help: messageFormat('INFO', 'I_0008') },
]
const masterDefinitions = [
  ['Organization', 'OrgId', 'OrgName'], ['Team', 'TeamId', 'TeamName'], ['Race', 'RaceId', 'RaceName'],
  ['Class', 'ClassId', 'ClassName'], ['Power', 'PowerId', 'PowerName'], ['Weapon', 'WeaponId', 'WeaponName'],
  ['Move', 'MoveId', 'MoveName'], ['Tag', 'TagId', 'TagName'], ['Stage', 'StageId', 'StageName'],
] as const


const entryDefinitions = Object.fromEntries(characterEntries.map(definition => [definition.key, definition]));
const skillDefinitions = Object.fromEntries(characterSkills.map(definition => [definition.key, definition]));

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
const readingImages = ref(false);
const confirmingDate = ref(false);
const readOnly = computed(() => !props.canEdit);
const title = computed(() => `キャラ設定（${props.row ? props.canEdit ? '編集' : '詳細' : '新規登録'}）`);
watch(() => props.modelValue, open => {
  if (!open) return;
  draft.value = createCharacterDraft(props.row, props.masters);
  inputFields.setValues(draft.value.fields);
  inputFields.setValues(draft.value.entries);
  inputFields.setValues(draft.value.skills);
  inputFields.setValue('tags', draft.value.tags);
  inputFields.setValue('images', draft.value.images);
  errors.value = {};
}, { immediate: true });

/** 能力の変更時だけ公開APIから取得し、選択できなくなった技を除去する。 */
function updatePowers() {
  draft.value.skills.Powers = inputFields.getValue('Powers', [] as string[]);
  draft.value.skills.Moves = validMoveIds(draft.value.skills.Powers, inputFields.getValue('Moves', [] as string[]), props.masters.Move || []);
  inputFields.setValue('Moves', draft.value.skills.Moves);
}
watch(() => props.masters.Tag, tags => {
  // タグマスタから復帰した際、削除済みのタグを除去し、名称・色・説明を最新にする。
  draft.value.tags = inputFields.getValue('tags', draft.value.tags).flatMap(tag => {
    const latest = tags?.find(item => String(item.TagId) === String(tag.TagId));
    return latest ? [{ ...latest }] : [];
  });
  inputFields.setValue('tags', draft.value.tags);
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
async function updateField(key: string) {
  if (readOnly.value) return;
  const before = draft.value.fields[key] || '';
  const next = String(inputFields.getValue(key, ''));
  if (key === 'DeathDate' && before && !next && inputFields.getValue('CauseOfDeath', '')) {
    confirmingDate.value = true;
    const currentDraft = draft.value;
    try {
      if (!await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0002'))) {
        // 子入力欄に残った空値も元の没年月日へ戻す。
        await nextTick();
        if (draft.value === currentDraft) {
          draft.value.fields.DeathDate = before;
          inputFields.setValue('DeathDate', before);
          draft.value.fields.Age = characterAge(draft.value.fields.BirthDate || '', before, props.settingDate);
          inputFields.setValue('Age', draft.value.fields.Age);
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
    inputFields.setValues({ TeamId: '', ClassId: '' });
  }
  if (key === 'BirthDate' || key === 'DeathDate') {
    draft.value.fields.BirthDate = inputFields.getValue('BirthDate', '');
    draft.value.fields.DeathDate = inputFields.getValue('DeathDate', '');
    if (key === 'DeathDate' && !next) {
      draft.value.fields.CauseOfDeath = '';
      inputFields.setValue('CauseOfDeath', '');
    }
    draft.value.fields.Age = characterAge(draft.value.fields.BirthDate || '', draft.value.fields.DeathDate || '', props.settingDate);
    inputFields.setValue('Age', draft.value.fields.Age);
  }
}
function normalizeFurigana() {
  if (readOnly.value) return;
  draft.value.fields.Furigana = inputFields.getValue('Furigana', '').replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60));
  inputFields.setValue('Furigana', draft.value.fields.Furigana);
}
async function save() {
  // 重複送信は処理側で止め、スピナーや確認表示を理由にフォームを非活性化しない。
  if (readOnly.value || props.saving || readingImages.value || confirmingDate.value) return;
  // 保存直前に各入力部品の公開メソッドで最新値を取得する。
  draft.value.fields = Object.fromEntries(Object.entries(inputFields.getValues(draft.value.fields)).map(([key, value]) => [key, String(value)]));
  draft.value.entries = inputFields.getValues(draft.value.entries);
  draft.value.skills = inputFields.getValues(draft.value.skills);
  draft.value.tags = inputFields.getValue('tags', draft.value.tags);
  draft.value.images = inputFields.getValue('images', draft.value.images);
  errors.value = {};
  if (!draft.value.fields.CharaName?.trim()) errors.value.CharaName = messageFormat('ERROR', 'E_0001', 'キャラ名');
  const dateError = characterDateError(draft.value.fields.BirthDate || '', draft.value.fields.DeathDate || '');
  if (dateError) errors.value.DeathDate = dateError;
  const first = Object.keys(errors.value)[0];
  if (first) {
    await nextTick();
    inputFields.focus(first);
    return;
  }
  emit('save', characterPayload(draft.value, props.row));
}
function availableSkills(key: string, master: string) {
  const rows = props.masters[master] || [];
  return key === 'Moves' ? rows.filter(move => !move.PowerId || draft.value.skills.Powers?.includes(String(move.PowerId))) : rows;
}
/** 表形式移行前のフリーテキストも、旧コントローラと同様に必須列へ復元する。 */
function parseIds(value: unknown, key: string, id: string): string[] {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    const rows = parsed?.[key]
    if (!Array.isArray(rows)) return []
    return [...new Set(rows.filter(item => item && item[id] != null && String(item[id]) !== '').map(item => String(item[id])))]
  } catch { return [] }
}

/** 初回選択時は保存済み年齢を維持し、日付変更時だけ算出する旧動作を踏襲する。 */
function createCharacterDraft(row?: CharacterRow, masters: CharacterMasters = {}): CharacterDraft {
  // キャラ固有の初期値はフォームのデータ生成処理内で管理する。
  const initialValues = {
    CharaName: '',
    Furigana: '',
    Nickname: '',
    BirthDate: '',
    DeathDate: '',
    Age: '',
    Purpose: '',
    Gender: '0',
    BloodType: '0',
    HairColor: '',
    EyeColor: '',
    SkinColor: '',
    Model: '',
    Height: '',
    Weight: '',
    AppearanceRemarks: '',
    Personality: '',
    Belief: '',
    RaceId: '',
    OrgId: '',
    TeamId: '',
    ClassId: '',
    BirthplaceId: '',
    Biography: '',
    Alias: '',
    VerbalTic: '',
    RoleInfo: '',
    CauseOfDeath: '',
    PendingSetting: '',
    Note: '',
  }
  const fields = Object.fromEntries(Object.entries(initialValues).map(([key, initial]) => [key, String(row?.[key] ?? initial)]))
  const entries = Object.fromEntries(characterEntries.map(definition => [definition.key, parseEntry(row?.[definition.key], definition)]))
  const skills = Object.fromEntries(characterSkills.map(definition => [definition.key, parseIds(row?.[definition.key], definition.key, definition.id)]))
  // 削除済みマスタは旧技能一覧でも除外されるため、保存用の状態からも除く。
  for (const definition of characterSkills) {
    skills[definition.key] = skills[definition.key]!.filter(id => masters[definition.master]?.some(item => String(item[definition.id]) === id))
  }
  skills.Moves = validMoveIds(skills.Powers || [], skills.Moves || [], masters.Move || [])
  const tags = parseIds(row?.TagInfo, 'TagInfo', 'TagId').flatMap(id => {
    const master = masters.Tag?.find(item => String(item.TagId) === id)
    return master ? [{ ...master }] : []
  })
  return { fields, entries, skills, tags, images: restoreImages(row) }
}

function validMoveIds(powers: string[], moves: string[], masters: CharacterMaster[]) {
  return moves.filter(id => masters.some(move => String(move.MoveId) === id && (!move.PowerId || powers.includes(String(move.PowerId)))))
}

function stageOptions(stages: CharacterMaster[]) {
  const byId = new Map(stages.map(stage => [String(stage.StageId), stage]))
  return stages.map(stage => {
    const names: string[] = []
    const visited = new Set<string>()
    let current: CharacterMaster | undefined = stage
    while (current && !visited.has(String(current.StageId))) {
      visited.add(String(current.StageId))
      names.unshift(String(current.StageName))
      current = current.ParentStageId != null ? byId.get(String(current.ParentStageId)) : undefined
    }
    return { value: String(stage.StageId), label: names.join(' > ') }
  }).sort((left, right) => left.label.localeCompare(right.label, 'ja'))
}

function characterOptions(key: string, fields: Record<string, string>, masters: CharacterMasters) {
  if (key === 'Gender') return ['', '男性', '女性', 'その他'].map((label, index) => ({ value: String(index), label }))
  if (key === 'BloodType') return ['', 'A', 'B', 'O', 'AB'].map((label, index) => ({ value: String(index), label }))
  if (key === 'Stage') return [{ value: '', label: '' }, ...stageOptions(masters.Stage || [])]
  const definition = masterDefinitions.find(item => item[0] === key)
  if (!definition) return []
  let source = masters[key] || []
  if (key === 'Class' || key === 'Team') {
    source = source.filter(item => fields.OrgId ? String(item.OrgId) === fields.OrgId : !item.OrgId)
  }
  return [{ value: '', label: '' }, ...source.map(item => ({ value: String(item[definition[1]]), label: String(item[definition[2]] || '') }))]
}

function characterPayload(draft: CharacterDraft, row?: CharacterRow) {
  const payload: Record<string, unknown> = { ...draft.fields, CharaId: row?.CharaId ?? null, UpdateDate: row?.UpdateDate ?? null }
  for (const definition of characterEntries) {
    const rows = draft.entries[definition.key] || []
    payload[definition.key] = rows.length ? JSON.stringify({ [definition.key]: rows }) : ''
  }
  for (const definition of characterSkills) {
    const ids = draft.skills[definition.key] || []
    payload[definition.key] = ids.length ? JSON.stringify({ [definition.key]: ids.map(id => ({ [definition.id]: id })) }) : ''
  }
  payload.TagInfo = draft.tags.map(tag => ({ TagId: tag.TagId }))
  payload.Images = imagePayload(draft.images)
  return payload
}


/** 旧 CalculateAgeFromBirthDate：死亡日と舞台設定日のうち過去の日時を基準にする。 */
function characterAge(birthText: string, deathText: string, settingText: string): string {
  const birth = parseFlexibleDate(birthText)
  if (!birth) return ''
  const setting = parseFlexibleDate(settingText)
  const death = parseFlexibleDate(deathText)
  const reference = death ? (setting && death > setting ? setting : death) : setting
  if (!reference) return ''
  const age = calculateAge(reference, birth)
  return age >= 0 ? String(age) : ''
}

/** 保存前の旧判定も維持する。粒度を補完した日付比較へ勝手に変更しない。 */
function characterDateError(birth: string, death: string): string {
  const birthNumber = birth.replace(/[^0-9]/g, '')
  const deathNumber = death.replace(/[^0-9]/g, '')
  return birthNumber && deathNumber && deathNumber < birthNumber
    ? messageFormat('ERROR', 'E_0011') : ''
}

</script>

<template>
  <BaseDialog :model-value="modelValue" :title="title" size="DialogLarge CharacterSettingDialog" @update:model-value="close">
    <div :key="formRevision" class="CharacterSections">
      <section class="FormSection" aria-label="基本">
        <h3 class="FormSectionTitle">基本</h3>
        <div class="FormGrid">
          <div class="FormGridItem">
            <TextFieldComponent
              :ref="el => inputFields.register('CharaName', el, draft.fields.CharaName)" label="キャラ名" :readonly="readOnly"
               :error="errors.CharaName" required
              :maxlength="100"
            />
          </div>
          <div class="FormGridItem">
            <TextFieldComponent
              :ref="el => inputFields.register('Furigana', el, draft.fields.Furigana)" label="フリガナ" :readonly="readOnly"
              :maxlength="255"
              @blur="normalizeFurigana"
            />
          </div>
          <div class="FormGridItem">
            <TextFieldComponent
              :ref="el => inputFields.register('Nickname', el, draft.fields.Nickname)" label="ニックネーム" :readonly="readOnly"
              :maxlength="255"
            />
          </div>
          <div class="FormGridItem">
            <TextFieldComponent
              :ref="el => inputFields.register('BirthDate', el, draft.fields.BirthDate)" label="生年月日" :readonly="readOnly"
              :date-picker-flg="canEdit" input-readonly
              @value-change="updateField('BirthDate')"
            />
          </div>
          <div class="FormGridItem">
            <TextFieldComponent
              :ref="el => inputFields.register('DeathDate', el, draft.fields.DeathDate)" label="没年月日" :readonly="readOnly"
               :error="errors.DeathDate"
              :date-picker-flg="canEdit" input-readonly
              @value-change="updateField('DeathDate')"
            />
          </div>
          <div class="FormGridItem">
            <TextFieldComponent
              :ref="el => inputFields.register('Age', el, draft.fields.Age)" label="年齢" :readonly="readOnly"
              type="number"
              info-icon-flg info-title="年齢" :info-message="messageFormat('INFO', 'I_0004')"
            />
          </div>
          <div class="FormGridItem FormGridFullWidth">
            <TextFieldComponent
              :ref="el => inputFields.register('Purpose', el, draft.fields.Purpose)" label="目的" :readonly="readOnly"
              text-area-flg
            />
          </div>
        </div>
      </section>
      <section class="FormSection" aria-label="身体">
        <h3 class="FormSectionTitle">身体</h3>
        <div class="FormGrid">
          <SelectBoxComponent
            :ref="el => inputFields.register('Gender', el, draft.fields.Gender)" label="性別"
            :options="characterOptions('Gender', draft.fields, masters)" :disabled="readOnly"
          />
          <SelectBoxComponent
            :ref="el => inputFields.register('BloodType', el, draft.fields.BloodType)" label="血液型"
            :options="characterOptions('BloodType', draft.fields, masters)" :disabled="readOnly"
          />
          <div class="FormGridItem">
            <TextFieldComponent
              :ref="el => inputFields.register('HairColor', el, draft.fields.HairColor)" label="髪色" :readonly="readOnly"
              :maxlength="7"
              color-picker-flg
            />
          </div>
          <div class="FormGridItem">
            <TextFieldComponent
              :ref="el => inputFields.register('EyeColor', el, draft.fields.EyeColor)" label="目の色" :readonly="readOnly"
              :maxlength="7"
              color-picker-flg
            />
          </div>
          <div class="FormGridItem">
            <TextFieldComponent
              :ref="el => inputFields.register('SkinColor', el, draft.fields.SkinColor)" label="肌の色" :readonly="readOnly"
              :maxlength="7"
              color-picker-flg
            />
          </div>
          <div class="FormGridItem">
            <TextFieldComponent
              :ref="el => inputFields.register('Model', el, draft.fields.Model)" label="モデル" :readonly="readOnly"
              :maxlength="100"
            />
          </div>
          <div class="FormGridItem">
            <TextFieldComponent
              :ref="el => inputFields.register('Height', el, draft.fields.Height)" label="身長" :readonly="readOnly"
              :maxlength="50"
            />
          </div>
          <div class="FormGridItem">
            <TextFieldComponent
              :ref="el => inputFields.register('Weight', el, draft.fields.Weight)" label="体重" :readonly="readOnly"
              :maxlength="50"
            />
          </div>
          <div class="FormGridItem FormGridFullWidth">
            <TextFieldComponent
              :ref="el => inputFields.register('AppearanceRemarks', el, draft.fields.AppearanceRemarks)" label="身体備考" :readonly="readOnly"
              text-area-flg
            />
          </div>
        </div>
      </section>
      <section class="FormSection" aria-label="内面①">
        <h3 class="FormSectionTitle">内面①</h3>
        <div class="FormGrid">
          <div class="FormGridItem FormGridFullWidth">
            <TextFieldComponent
              :ref="el => inputFields.register('Personality', el, draft.fields.Personality)" label="性格" :readonly="readOnly"
              text-area-flg
            />
          </div>
          <div class="FormGridItem FormGridFullWidth">
            <TextFieldComponent
              :ref="el => inputFields.register('Belief', el, draft.fields.Belief)" label="信念・思想" :readonly="readOnly"
              text-area-flg
            />
          </div>
        </div>
        <div class="FormGrid">
          <EntryTableEditor :ref="el => inputFields.register('Likes', el, draft.entries.Likes || [])" :definition="entryDefinitions.Likes!" :readonly="readOnly" :dialogs="dialogs" />
          <EntryTableEditor :ref="el => inputFields.register('Dislikes', el, draft.entries.Dislikes || [])" :definition="entryDefinitions.Dislikes!" :readonly="readOnly" :dialogs="dialogs" />
        </div>
      </section>
      <section class="FormSection" aria-label="内面②">
        <h3 class="FormSectionTitle">内面②</h3>
        <div class="FormGrid">
          <EntryTableEditor :ref="el => inputFields.register('Landmine', el, draft.entries.Landmine || [])" :definition="entryDefinitions.Landmine!" :readonly="readOnly" :dialogs="dialogs" />
          <EntryTableEditor :ref="el => inputFields.register('StrongPoint', el, draft.entries.StrongPoint || [])" :definition="entryDefinitions.StrongPoint!" :readonly="readOnly" :dialogs="dialogs" />
          <EntryTableEditor :ref="el => inputFields.register('WeakPoint', el, draft.entries.WeakPoint || [])" :definition="entryDefinitions.WeakPoint!" :readonly="readOnly" :dialogs="dialogs" />
        </div>
      </section>
      <section class="FormSection" aria-label="所属">
        <h3 class="FormSectionTitle">所属</h3>
        <div class="FormGrid">
          <SelectBoxComponent
            :ref="el => inputFields.register('RaceId', el, draft.fields.RaceId)" label="種族"
            :options="characterOptions('Race', draft.fields, masters)" :disabled="readOnly"
          />
          <SelectBoxComponent
            :ref="el => inputFields.register('OrgId', el, draft.fields.OrgId)" label="組織"
            :options="characterOptions('Organization', draft.fields, masters)" :disabled="readOnly"
              @value-change="updateField('OrgId')"
          />
          <SelectBoxComponent
            :ref="el => inputFields.register('TeamId', el, draft.fields.TeamId)" label="チーム"
            :options="characterOptions('Team', draft.fields, masters)" :disabled="readOnly"
          />
          <SelectBoxComponent
            :ref="el => inputFields.register('ClassId', el, draft.fields.ClassId)" label="階級"
            :options="characterOptions('Class', draft.fields, masters)" :disabled="readOnly"
          />
        </div>
      </section>
      <section class="FormSection" aria-label="出身">
        <h3 class="FormSectionTitle">出身</h3>
        <div class="FormGrid">
          <SelectBoxComponent
            :ref="el => inputFields.register('BirthplaceId', el, draft.fields.BirthplaceId)" label="出身地"
            :options="characterOptions('Stage', draft.fields, masters)" :disabled="readOnly"
          />
          <div class="FormGridItem FormGridFullWidth">
            <TextFieldComponent
              :ref="el => inputFields.register('Biography', el, draft.fields.Biography)" label="生い立ち" :readonly="readOnly"
              text-area-flg
            />
          </div>
        </div>
      </section>
      <section class="FormSection" aria-label="技能">
        <h3 class="FormSectionTitle">技能</h3>
        <SkillEditor :ref="el => inputFields.register('Weapons', el, draft.skills.Weapons || [])" :definition="skillDefinitions.Weapons!" :masters="masters.Weapon || []" :available="availableSkills('Weapons', 'Weapon')" :readonly="readOnly" :dialogs="dialogs" />
        <SkillEditor :ref="el => inputFields.register('Powers', el, draft.skills.Powers || [])" @value-change="updatePowers" :definition="skillDefinitions.Powers!" :masters="masters.Power || []" :available="availableSkills('Powers', 'Power')" :readonly="readOnly" :dialogs="dialogs" />
        <SkillEditor :ref="el => inputFields.register('Moves', el, draft.skills.Moves || [])" :definition="skillDefinitions.Moves!" :masters="masters.Move || []" :available="availableSkills('Moves', 'Move')" :readonly="readOnly" :dialogs="dialogs" />
      </section>
      <section class="FormSection" aria-label="詳細①">
        <h3 class="FormSectionTitle">詳細①</h3>
        <div class="FormGrid">
          <div class="FormGridItem">
            <TextFieldComponent
              :ref="el => inputFields.register('Alias', el, draft.fields.Alias)" label="二つ名" :readonly="readOnly"
              :maxlength="255"
            />
          </div>
          <div class="FormGridItem FormGridFullWidth">
            <TextFieldComponent
              :ref="el => inputFields.register('VerbalTic', el, draft.fields.VerbalTic)" label="口癖" :readonly="readOnly"
              text-area-flg
            />
          </div>
        </div>
        <div class="FormGrid">
          <EntryTableEditor :ref="el => inputFields.register('FirstPerson', el, draft.entries.FirstPerson || [])" :definition="entryDefinitions.FirstPerson!" :readonly="readOnly" :dialogs="dialogs" />
          <EntryTableEditor :ref="el => inputFields.register('SecondPerson', el, draft.entries.SecondPerson || [])" :definition="entryDefinitions.SecondPerson!" :readonly="readOnly" :dialogs="dialogs" />
        </div>
      </section>
      <section class="FormSection" aria-label="詳細②">
        <h3 class="FormSectionTitle">詳細②</h3>
        <div class="FormGrid">
          <div class="FormGridItem FormGridFullWidth">
            <TextFieldComponent
              :ref="el => inputFields.register('RoleInfo', el, draft.fields.RoleInfo)" label="役割" :readonly="readOnly"
              text-area-flg
            />
          </div>
          <div class="FormGridItem FormGridFullWidth">
            <TextFieldComponent
              :ref="el => inputFields.register('CauseOfDeath', el, draft.fields.CauseOfDeath)" label="死因" :readonly="readOnly"
              text-area-flg
              :disabled="!draft.fields.DeathDate"
              info-icon-flg info-title="死因" :info-message="messageFormat('INFO', 'I_0005')"
            />
          </div>
        </div>
        <div class="FormGrid">
          <EntryTableEditor :ref="el => inputFields.register('Habit', el, draft.entries.Habit || [])" :definition="entryDefinitions.Habit!" :readonly="readOnly" :dialogs="dialogs" />
          <EntryTableEditor :ref="el => inputFields.register('Hobby', el, draft.entries.Hobby || [])" :definition="entryDefinitions.Hobby!" :readonly="readOnly" :dialogs="dialogs" />
        </div>
      </section>
      <section class="FormSection" aria-label="執筆用備考">
        <h3 class="FormSectionTitle">執筆用備考</h3>
        <div class="FormGrid">
          <div class="FormGridItem FormGridFullWidth">
            <TextFieldComponent
              :ref="el => inputFields.register('PendingSetting', el, draft.fields.PendingSetting)" label="検討中・未確定の設定" :readonly="readOnly"
              text-area-flg
            />
          </div>
          <div class="FormGridItem FormGridFullWidth">
            <TextFieldComponent
              :ref="el => inputFields.register('Note', el, draft.fields.Note)" label="備考" :readonly="readOnly"
              text-area-flg
            />
          </div>
        </div>
        <div class="FormGrid">
          <EntryTableEditor :ref="el => inputFields.register('Transition', el, draft.entries.Transition || [])" :definition="entryDefinitions.Transition!" :readonly="readOnly" :dialogs="dialogs" />
        </div>
      </section>
      <section class="FormSection" aria-label="タグ">
        <h3 class="FormSectionTitle">タグ</h3>
        <TagEditor :ref="el => inputFields.register('tags', el, draft.tags)" :masters="masters.Tag || []" :existing="!!row" :readonly="readOnly" :dialogs="dialogs" @refresh="emit('refresh-tags')" />
      </section>
      <section class="FormSection" aria-label="画像">
        <h3 class="FormSectionTitle">画像</h3>
        <ImageListEditor placeholder-icon="fa-user" :ref="el => inputFields.register('images', el, draft.images)" :readonly="readOnly" :dialogs="dialogs" @reading="readingImages = $event" />
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

