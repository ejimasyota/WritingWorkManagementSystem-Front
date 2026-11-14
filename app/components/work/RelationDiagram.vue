<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, reactive, ref } from 'vue';
import type { BackendRequest } from '../../types/backend';
import type { WorkInfo } from '../../types/work';
import type { WorkSettingRow } from '../../types/workSettings';
import type { RelationObject, RelationLine } from '../../types/relation';
import type { PageDialogs } from '../../composables/usePageDialogs';
import { useInputFields } from '../../composables/useInputFields';
import { useOperationSpinner } from '../../composables/useOperationSpinner';
import { readWorkAccess } from '../../utils/workAccess';
import { requireSuccess, reportBackendError } from '../../utils/backend';
import { messageFormat } from '../../utils/messages';
import { connectRectangles, rectanglesOverlap } from '../../utils/diagramGeometry';
import { downloadSvgPng, fileAsBase64 } from '../../utils/files';
import { CONST_VARIABLE } from '../../config/Const';
const props = defineProps<{
  request: BackendRequest;
  dialogs: PageDialogs;
  isAdmin: boolean;
  hideMeta?: boolean;
}>();
const fields = useInputFields();
const spinner = useOperationSpinner();
const role = ref('');
const work = ref<WorkInfo>();
const canEdit = ref(false);
const busy = ref(false);
const objects = ref<RelationObject[]>([]);
const lines = ref<RelationLine[]>([]);
const characters = ref<WorkSettingRow[]>([]);
const originalObjects = new Map<string, RelationObject>();
const originalLines = new Map<string, RelationLine>();
const organizations = ref<WorkSettingRow[]>([]);
const teams = ref<WorkSettingRow[]>([]);
const canvas = ref<HTMLElement>();
const svg = ref<SVGSVGElement>();
const trash = ref<HTMLElement>();
const elements = new Map<string, HTMLElement>();
const sizes = ref(new Map<string, {
  width: number;
  height: number;
}>());
const zoom = ref(1);
const lineType = ref('1');
const startObject = ref<string | null>(null);
const trashActive = ref(false);
const dragPoint = ref<{
  x: number;
  y: number;
  name: string;
} | null>(null);
const groupOpen = ref(false);
const editingGroup = ref<RelationObject | null>(null);
const groupSource = ref('none');
const groupForm = reactive({
  Label: '',
  BgColor: CONST_VARIABLE.COLOR_PICKER_INITIAL_VALUE,
  OrgIdGrpName: '',
  TeamIdGrpName: ''
});
const errors = ref<Record<string, string>>({});
const revision = ref(0);
const arrowTypes = [{
  name: '好意',
  color: '#ff0a23'
}, {
  name: '敵意',
  color: '#808080'
}, {
  name: '疑心',
  color: '#783c90'
}, {
  name: '友情',
  color: '#3498db'
}, {
  name: '信仰',
  color: '#751a30'
}, {
  name: '尊敬',
  color: '#00b841'
}, {
  name: '依存',
  color: '#1c4dce'
}, {
  name: '利用',
  color: '#f39c12'
}, {
  name: '嫉妬',
  color: '#6e2c00'
}, {
  name: '恐怖',
  color: '#2c3e50'
}, {
  name: '嫌悪',
  color: '#556b2f'
}, {
  name: '執着',
  color: '#8e44ad'
}, {
  name: '憧憬',
  color: '#f1c40f'
}];
const relationTypes = [{
  name: '友人',
  color: '#3498db'
}, {
  name: '恋人',
  color: '#e74c3c'
}, {
  name: '家族',
  color: '#27ae60'
}, {
  name: '同僚',
  color: '#1c4dce'
}, {
  name: '上司・部下',
  color: '#9b59b6'
}, {
  name: '師弟',
  color: '#1abc9c'
}, {
  name: 'ライバル',
  color: '#f39c12'
}, {
  name: '因縁',
  color: '#c0392b'
}, {
  name: '共犯',
  color: '#2ecc71'
}];
const typeOptions = computed(() => (lineType.value === '1' ? arrowTypes : relationTypes).map(row => ({
  value: row.name,
  label: row.name
})));
const orgOptions = computed(() => [{
  value: '',
  label: ''
}, ...organizations.value.map(row => ({
  value: String(row.OrgId),
  label: String(row.OrgName)
}))]);
const teamOptions = computed(() => [{
  value: '',
  label: ''
}, ...teams.value.map(row => ({
  value: String(row.TeamId),
  label: String(row.TeamName)
}))]);
let sequence = 0;
let disposed = false;
let gesture: {
  pointer: number;
  row: RelationObject | null;
  character: WorkSettingRow | null;
  direction: string;
  x: number;
  y: number;
  left: number;
  top: number;
  width: number;
  height: number;
  moved: boolean;
  children: {
    row: RelationObject;
    x: number;
    y: number;
  }[];
} | null = null;
onBeforeUnmount(() => {
  disposed = true;
  gesture = null;
});

function tempId() {
  return 'new_' + ++sequence;
}

function isNew(id: string) {
  return id.startsWith('new_');
}

function rect(row: RelationObject) {
  const size = sizes.value.get(row.ObjId);
  return {
    x: row.PosX,
    y: row.PosY,
    width: row.ObjType === 2 ? row.Width || 150 : size?.width || 100,
    height: row.ObjType === 2 ? row.Height || 100 : size?.height || 80
  };
}

function placed(id: unknown) {
  return objects.value.some(row => row.ObjType === 1 && String(row.TargetId) === String(id));
}

function character(row: RelationObject) {
  return characters.value.find(item => String(item.CharaId) === String(row.TargetId));
}

function register(id: string, element: unknown) {
  if (element instanceof HTMLElement) {
    elements.set(id, element);
    void measure();
  } else elements.delete(id);
}

async function measure() {
  await nextTick();
  if (disposed) return;
  const next = new Map<string, {
    width: number;
    height: number;
  }>();
  let changed = elements.size !== sizes.value.size;
  for (const [id, element] of elements) {
    const size = {
      width: element.offsetWidth,
      height: element.offsetHeight
    };
    next.set(id, size);
    const before = sizes.value.get(id);
    if (before?.width !== size.width || before?.height !== size.height) changed = true;
  }
  if (changed) sizes.value = next;
}
const extent = computed(() => {
  const size = Math.max(3000, ...objects.value.flatMap(row => [row.PosX + (row.Width || 150) + 100, row.PosY + (row.Height || 100) + 100]));
  return {
    width: size,
    height: size
  };
});
const connections = computed(() => lines.value.flatMap(line => {
  const source = objects.value.find(row => row.ObjId === line.SourceObjId),
    target = objects.value.find(row => row.ObjId === line.TargetObjId);
  if (!source || !target) return [];
  const same = lines.value.filter(row => row.SourceObjId === line.SourceObjId && row.TargetObjId === line.TargetObjId);
  const reverse = lines.value.some(row => row.SourceObjId === line.TargetObjId && row.TargetObjId === line.SourceObjId);
  const offset = same.length === 1 ? reverse ? 40 : 0 : (reverse ? 40 : 0) + (same.indexOf(line) - (same.length - 1) / 2) * 40;
  return [{
    line,
    ...connectRectangles(rect(source), rect(target), offset, line.LineType === 1)
  }];
}));

function changeLineType() {
  lineType.value = fields.getValue('LineType', '1');
  fields.setValue('RelationType', typeOptions.value[0]?.value || '');
}

async function load() {
  busy.value = true;
  try {
    await spinner.run(async () => {
      const access = await readWorkAccess(props.request);
      const data = requireSuccess(await props.request<{
        ObjectList: RelationObject[];
        RelationList: RelationLine[];
        CharacterList: WorkSettingRow[];
      }>('/GetRelationList.php'), messageFormat('ERROR', 'E_0003', '相関図の取得'));
      if (!Array.isArray(data?.ObjectList) || !Array.isArray(data.RelationList) || !Array.isArray(data.CharacterList)) throw new Error(messageFormat('ERROR', 'E_0026'));
      if (disposed) return;
      work.value = access.work;
      role.value = props.isAdmin ? '管理者' : access.isCreator ? '作成者' : 'アシスタント';
      canEdit.value = props.isAdmin || access.isCreator;
      characters.value = data.CharacterList;
      objects.value = data.ObjectList.map(row => ({
        ...row,
        Label: String(row.OrgIdGrpName && row.OrgGrpName || row.TeamIdGrpName && row.TeamGrpName || row.Label || ''),
        ObjId: String(row.ObjId),
        ObjType: Number(row.ObjType),
        PosX: Number(row.PosX),
        PosY: Number(row.PosY),
        Width: row.Width ? Number(row.Width) : null,
        Height: row.Height ? Number(row.Height) : null
      }));
      lines.value = data.RelationList.map(row => ({
        ...row,
        RelationId: String(row.RelationId),
        SourceObjId: String(row.SourceObjId),
        TargetObjId: String(row.TargetObjId),
        LineType: Number(row.LineType)
      }));
      for (const row of objects.value) originalObjects.set(row.ObjId, {
        ...row
      });
      for (const row of lines.value) originalLines.set(row.RelationId, {
        ...row
      });
    });
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '相関図の取得'));
  } finally {
    busy.value = false;
  }
}

function overlap(row: RelationObject, x: number, y: number, width: number, height: number) {
  return objects.value.some(other => other !== row && other.ObjType === 2 && rectanglesOverlap({
    x,
    y,
    width,
    height
  }, rect(other)));
}
/** マウスとタッチを同じ座標系で処理し、グループ内のキャラも相対位置を保って移動する。 */


function begin(event: PointerEvent, row: RelationObject | null, direction = '', chara: WorkSettingRow | null = null) {
  if (!canEdit.value || busy.value || event.button !== 0 || chara && placed(chara.CharaId)) return;
  event.preventDefault();
  event.stopPropagation();
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  const bounds = row ? rect(row) : {
    x: 0,
    y: 0,
    width: 100,
    height: 80
  };
  gesture = {
    pointer: event.pointerId,
    row,
    character: chara,
    direction,
    x: event.clientX,
    y: event.clientY,
    left: bounds.x,
    top: bounds.y,
    width: bounds.width,
    height: bounds.height,
    moved: false,
    children: row?.ObjType === 2 ? objects.value.filter(item => item.ObjType === 1 && rectanglesOverlap(bounds, rect(item))).map(item => ({
      row: item,
      x: item.PosX - bounds.x,
      y: item.PosY - bounds.y
    })) : []
  };
}

function move(event: PointerEvent) {
  const current = gesture;
  if (!current || current.pointer !== event.pointerId) return;
  const dx = (event.clientX - current.x) / zoom.value,
    dy = (event.clientY - current.y) / zoom.value;
  if (Math.abs(event.clientX - current.x) > 5 || Math.abs(event.clientY - current.y) > 5) current.moved = true;
  if (!current.moved) return;
  if (current.character) {
    dragPoint.value = {
      x: event.clientX,
      y: event.clientY,
      name: String(current.character.CharaName)
    };
    return;
  }
  const row = current.row;
  if (!row) return;
  let x = Math.max(0, current.left + dx),
    y = Math.max(0, current.top + dy),
    width = current.width,
    height = current.height;
  if (current.direction) {
    x = current.left;
    y = current.top;
    const dir = current.direction;
    if (dir.includes('e')) width = Math.max(80, current.width + dx);
    if (dir.includes('s')) height = Math.max(60, current.height + dy);
    if (dir.includes('w') && current.width - dx >= 80) {
      x = Math.max(0, current.left + dx);
      width = current.width + (current.left - x);
    }
    if (dir.includes('n') && current.height - dy >= 60) {
      y = Math.max(0, current.top + dy);
      height = current.height + (current.top - y);
    }
  }
  if (row.ObjType === 2 && overlap(row, x, y, width, height)) return;
  row.PosX = x;
  row.PosY = y;
  if (current.direction) {
    row.Width = width;
    row.Height = height;
  } else for (const child of current.children) {
    child.row.PosX = x + child.x;
    child.row.PosY = y + child.y;
  }
  const target = trash.value?.getBoundingClientRect();
  trashActive.value = !!target && event.clientX >= target.left && event.clientX <= target.right && event.clientY >= target.top && event.clientY <= target.bottom;
}

function end(event: PointerEvent) {
  const current = gesture;
  if (!current || current.pointer !== event.pointerId) return;
  gesture = null;
  dragPoint.value = null;
  if (current.character) {
    const area = canvas.value;
    const bounds = area?.getBoundingClientRect();
    if (current.moved && area && bounds && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom && !placed(current.character.CharaId)) objects.value.push({
      ObjId: tempId(),
      ObjType: 1,
      TargetId: current.character.CharaId,
      Label: String(current.character.CharaName),
      PosX: Math.max(0, (event.clientX - bounds.left + area.scrollLeft) / zoom.value),
      PosY: Math.max(0, (event.clientY - bounds.top + area.scrollTop) / zoom.value),
      Width: null,
      Height: null
    });
    return;
  }
  const row = current.row;
  if (!row) return;
  if (trashActive.value) {
    objects.value = objects.value.filter(item => item !== row);
    lines.value = lines.value.filter(line => line.SourceObjId !== row.ObjId && line.TargetObjId !== row.ObjId);
    trashActive.value = false;
    startObject.value = null;
    return;
  }
  if (current.moved || current.direction) return;
  if (row.ObjType === 2) {
    void openGroup(row);
    return;
  }
  if (!startObject.value) {
    startObject.value = row.ObjId;
    return;
  }
  if (startObject.value !== row.ObjId) {
    const types = lineType.value === '1' ? arrowTypes : relationTypes;
    const type = types.find(item => item.name === fields.getValue('RelationType', types[0]!.name)) || types[0]!;
    lines.value.push({
      RelationId: tempId(),
      SourceObjId: startObject.value,
      TargetObjId: row.ObjId,
      LineType: Number(lineType.value),
      RelationType: type.name,
      Color: type.color
    });
  }
  startObject.value = null;
}

function cancel() {
  gesture = null;
  dragPoint.value = null;
  trashActive.value = false;
}

async function removeLine(line: RelationLine) {
  if (!canEdit.value || busy.value || !(await props.dialogs.confirm(messageFormat('CONFIRM', 'C_0026')))) return;
  lines.value = lines.value.filter(row => row !== line);
}

async function openGroup(row: RelationObject | null = null) {
  if (!canEdit.value || busy.value) return;
  busy.value = true;
  try {
    await spinner.run(async () => {
      await readWorkAccess(props.request, work.value?.WorkId);
      const org = requireSuccess(await props.request<{
        OrganizationList: WorkSettingRow[];
      }>('/GetOrganizationList.php'), messageFormat('ERROR', 'E_0003', '組織の取得'));
      const team = requireSuccess(await props.request<{
        TeamList: WorkSettingRow[];
      }>('/GetTeamList.php'), messageFormat('ERROR', 'E_0003', 'チームの取得'));
      if (!Array.isArray(org?.OrganizationList) || !Array.isArray(team?.TeamList)) throw new Error(messageFormat('ERROR', 'E_0026'));
      if (disposed) return;
      organizations.value = org.OrganizationList;
      teams.value = team.TeamList;
      editingGroup.value = row;
      groupSource.value = row?.OrgIdGrpName ? 'org' : row?.TeamIdGrpName ? 'team' : 'none';
      Object.assign(groupForm, {
        Label: String(row?.Label || ''),
        BgColor: String(row?.BgColor || CONST_VARIABLE.COLOR_PICKER_INITIAL_VALUE),
        OrgIdGrpName: String(row?.OrgIdGrpName || ''),
        TeamIdGrpName: String(row?.TeamIdGrpName || '')
      });
      fields.setValues(groupForm);
      fields.setValue('GroupSource', groupSource.value);
      errors.value = {};
      revision.value++;
      groupOpen.value = true;
    });
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', 'グループの取得'));
  } finally {
    busy.value = false;
  }
}
/** 選択した組織・チームの名称とIDを組として反映し、グループ同士の重なりを避けて配置する。 */


function applyGroup() {
  if (!canEdit.value || busy.value) return;
  const values = fields.getValues(groupForm);
  errors.value = {};
  let label = values.Label.trim();
  let org: unknown = null,
    team: unknown = null;
  if (groupSource.value === 'org') {
    const row = organizations.value.find(row => String(row.OrgId) === values.OrgIdGrpName);
    label = String(row?.OrgName || '');
    org = row?.OrgId ?? null;
  }
  if (groupSource.value === 'team') {
    const row = teams.value.find(row => String(row.TeamId) === values.TeamIdGrpName);
    label = String(row?.TeamName || '');
    team = row?.TeamId ?? null;
  }
  if (!label) errors.value.Label = messageFormat('ERROR', 'E_0001', 'グループ名');
  if (label.length > 50) errors.value.Label = messageFormat('ERROR', 'E_0002', 'グループ名', 50);
  if (values.BgColor && !/^#[0-9a-f]{6}$/i.test(values.BgColor)) errors.value.BgColor = messageFormat('ERROR', 'E_0066');
  if (Object.keys(errors.value).length) return;
  const row = editingGroup.value || {
    ObjId: tempId(),
    ObjType: 2,
    Label: '',
    PosX: 100,
    PosY: 100,
    Width: 200,
    Height: 150
  };
  if (!editingGroup.value) {
    while (overlap(row, row.PosX, row.PosY, 200, 150)) {
      row.PosX += 220;
      if (row.PosX + 200 > 1200) {
        row.PosX = 100;
        row.PosY += 170;
      }
    }
    objects.value.push(row);
  }
  Object.assign(row, {
    Label: label,
    BgColor: values.BgColor || CONST_VARIABLE.COLOR_PICKER_INITIAL_VALUE,
    OrgIdGrpName: org,
    TeamIdGrpName: team
  });
  groupOpen.value = false;
}
/** 保存済み行の更新日時を保持したまま、削除→オブジェクト→線の順で保存する。途中失敗後も再試行可能にする。 */


async function save() {
  if (!canEdit.value || busy.value) return;
  busy.value = true;
  let completed = false;
  try {
    await spinner.run(async () => {
      const access = await readWorkAccess(props.request, work.value?.WorkId);
      if (disposed || !(props.isAdmin || access.isCreator)) return;
      for (const [id, row] of originalLines) if (!lines.value.some(item => item.RelationId === id)) {
        requireSuccess(await props.request('/DeleteRelation.php', 'POST', {
          RelationId: id,
          UpdateDate: row.UpdateDate
        }), messageFormat('ERROR', 'E_0003', '関係線の削除'));
        originalLines.delete(id);
      }
      for (const [id, row] of originalObjects) if (!objects.value.some(item => item.ObjId === id)) {
        requireSuccess(await props.request('/DeleteRelationObject.php', 'POST', {
          ObjId: id,
          UpdateDate: row.UpdateDate
        }), messageFormat('ERROR', 'E_0003', 'オブジェクトの削除'));
        originalObjects.delete(id);
      }
      for (const row of objects.value) {
        const before = originalObjects.get(row.ObjId);
        if (before && JSON.stringify(before) === JSON.stringify(row)) continue;
        const old = row.ObjId;
        const result = requireSuccess(await props.request<{
          ObjId: unknown;
          UpdateDate: string;
        }>('/SaveRelationObject.php', 'POST', {
          ...row,
          ObjId: isNew(old) ? null : old,
          UpdateDate: before?.UpdateDate ?? null
        }), messageFormat('ERROR', 'E_0003', 'オブジェクトの保存'));
        row.ObjId = String(result.ObjId);
        row.UpdateDate = result.UpdateDate;
        originalObjects.delete(old);
        originalObjects.set(row.ObjId, {
          ...row
        });
        for (const line of lines.value) {
          if (line.SourceObjId === old) line.SourceObjId = row.ObjId;
          if (line.TargetObjId === old) line.TargetObjId = row.ObjId;
        }
      }
      for (const row of lines.value) {
        const before = originalLines.get(row.RelationId);
        if (before && JSON.stringify(before) === JSON.stringify(row)) continue;
        const old = row.RelationId;
        const result = requireSuccess(await props.request<{
          RelationId: unknown;
          UpdateDate: string;
        }>('/SaveRelation.php', 'POST', {
          ...row,
          RelationId: isNew(old) ? null : old,
          UpdateDate: before?.UpdateDate ?? null
        }), messageFormat('ERROR', 'E_0003', '関係線の保存'));
        row.RelationId = String(result.RelationId);
        row.UpdateDate = result.UpdateDate;
        originalLines.delete(old);
        originalLines.set(row.RelationId, {
          ...row
        });
      }
      requireSuccess(await props.request('/SaveRelationHistory.php', 'POST', {}), messageFormat('ERROR', 'E_0003', '相関図の履歴保存'));
      completed = true;
    });
    if (completed && !disposed) await props.dialogs.info(messageFormat('INFO', 'I_0011', '保存'), messageFormat('INFO', 'I_0001', '相関図の保存'));
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0004', '相関図の保存'));
  } finally {
    busy.value = false;
  }
}
/** 配置範囲だけを等倍で描画し、画像も埋め込んだPNGを生成する。画面のズーム値は変更しない。 */


async function capture() {
  if (busy.value) return;
  if (!objects.value.length) {
    await props.dialogs.error(messageFormat('ERROR', 'E_0067'));
    return;
  }
  busy.value = true;
  try {
    await spinner.run(async () => {
      const ns = 'http://www.w3.org/2000/svg';
      const output = document.createElementNS(ns, 'svg');
      const left = Math.max(0, Math.floor(Math.min(...objects.value.map(row => row.PosX)) - 20)),
        top = Math.max(0, Math.floor(Math.min(...objects.value.map(row => row.PosY)) - 20));
      const width = Math.ceil(Math.max(...objects.value.map(row => row.PosX + rect(row).width)) + 20 - left),
        height = Math.ceil(Math.max(...objects.value.map(row => row.PosY + rect(row).height)) + 20 - top);
      output.setAttribute('width', String(width));
      output.setAttribute('height', String(height));
      output.setAttribute('viewBox', `${left} ${top} ${width} ${height}`);
      function element(name: string, attrs: Record<string, string | number>, text?: string) {
        const item = document.createElementNS(ns, name);
        for (const [key, value] of Object.entries(attrs)) item.setAttribute(key, String(value));
        if (text !== undefined) item.textContent = text;
        output.appendChild(item);
        return item;
      }
      for (const row of objects.value.filter(row => row.ObjType === 2)) {
        const box = rect(row);
        element('rect', {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          rx: 12,
          fill: '#9b59b6',
          'fill-opacity': 0.05,
          stroke: row.BgColor || '#9b59b6',
          'stroke-width': 2,
          'stroke-dasharray': '6 4'
        });
        element('rect', {
          x: box.x + 10,
          y: box.y - 12,
          width: row.Label.length * 12 + 16,
          height: 20,
          rx: 4,
          fill: row.BgColor || '#9b59b6'
        });
        element('text', {
          x: box.x + 18,
          y: box.y + 2,
          fill: '#fff',
          'font-size': 11
        }, row.Label);
      }
      if (svg.value) for (const child of Array.from(svg.value.childNodes)) output.appendChild(child.cloneNode(true));
      for (const row of objects.value.filter(row => row.ObjType === 1)) {
        const box = rect(row);
        element('rect', {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          rx: 8,
          fill: '#fff',
          stroke: '#3498db',
          'stroke-width': 2
        });
        const chara = character(row);
        if (chara?.ImgPath) {
          const response = await fetch(String(chara.ImgPath));
          if (!response.ok) throw new Error(messageFormat('ERROR', 'E_0003', '画像の取得'));
          const blob = await response.blob();
          const data = await fileAsBase64(new File([blob], 'image', {
            type: blob.type
          }));
          const clipId = 'capture-image-' + row.ObjId;
          const defs = element('defs', {});
          const clip = document.createElementNS(ns, 'clipPath');
          clip.setAttribute('id', clipId);
          const circle = document.createElementNS(ns, 'circle');
          circle.setAttribute('cx', String(box.x + box.width / 2));
          circle.setAttribute('cy', String(box.y + 35));
          circle.setAttribute('r', '25');
          clip.appendChild(circle);
          defs.appendChild(clip);
          element('image', {
            x: box.x + (box.width - 50) / 2,
            y: box.y + 10,
            width: 50,
            height: 50,
            'clip-path': 'url(#' + clipId + ')',
            preserveAspectRatio: 'xMidYMid slice',
            href: 'data:' + blob.type + ';base64,' + data
          });
        }
        element('text', {
          x: box.x + box.width / 2,
          y: box.y + box.height - 12,
          'text-anchor': 'middle',
          'font-size': 12,
          fill: '#222'
        }, String(chara?.CharaName || row.Label));
      }
      await downloadSvgPng(output, width, height, '相関図.png');
    });
  } catch (error) {
    if (!disposed) await reportBackendError(props.dialogs, error, messageFormat('ERROR', 'E_0003', '画像の保存'));
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <div>
    <WorkContentHeader
      title="相関図作成"
      icon="fa-project-diagram"
      :work-title="work?.WorkTitle"
      :role="work ? role : undefined"
    />
    <div
      v-if="canEdit"
      class="ButtonGroup MarginBottom20 RelationToolbar"
    >
      <ButtonComponent
        type="button"
        variant="PrimaryButton"
        @click="save"
      >
        <i
          class="fas fa-save"
          aria-hidden="true"
        />
        保存
      </ButtonComponent>
      <ButtonComponent
        type="button"
        variant="SuccessButton"
        @click="capture"
      >
        <i
          class="fas fa-image"
          aria-hidden="true"
        />
        撮影
      </ButtonComponent>
      <ButtonComponent
        type="button"
        variant="SecondaryButton"
        @click="openGroup()"
      >
        <i
          class="fas fa-object-group"
          aria-hidden="true"
        />
        グループ
      </ButtonComponent>
      <SelectBoxComponent
        :ref="el=>fields.register('LineType',el,'1')"
        inline
        hide-list-button
        :options="[{value:'1',label:'矢印線（感情）'},{value:'2',label:'直線（関係）'}]"
        @value-change="changeLineType"
      />
      <SelectBoxComponent
        :ref="el=>fields.register('RelationType',el,'好意')"
        inline
        hide-list-button
        :options="typeOptions"
      />
    </div>
    <div class="RelationContainer">
      <div class="RelationSidebar">
        <div class="RelationSidebarTitle">
          <i
            class="fas fa-users"
            aria-hidden="true"
          />
          キャラクター
        </div>
        <div class="RelationCharaListmWrapper">
          <div class="RelationCharaList">
            <div
              v-for="chara in characters"
              :key="String(chara.CharaId)"
              class="CharacterListItem"
              :class="{placed:placed(chara.CharaId)}"
              @pointerdown="begin($event,null,'',chara)"
              @pointermove="move"
              @pointerup="end"
              @pointercancel="cancel"
            >
              {{ chara.CharaName }}
              {{ placed(chara.CharaId) ? ' (配置済)' : '' }}
            </div>
          </div>
        </div>
      </div>
      <div class="RelationCanvasWrapper">
        <div class="RelationCanvasControls">
          <ButtonComponent
            unstyled
            type="button"
            class="ZoomButton"
            title="縮小"
            @click="zoom=Math.max(0.5,Number((zoom-0.1).toFixed(1)))"
          >
            <i
              class="fas fa-search-minus"
              aria-hidden="true"
            />
          </ButtonComponent>
          <ButtonComponent
            unstyled
            type="button"
            class="ZoomButton"
            title="拡大"
            @click="zoom=Math.min(2,Number((zoom+0.1).toFixed(1)))"
          >
            <i
              class="fas fa-search-plus"
              aria-hidden="true"
            />
          </ButtonComponent>
          <div
            v-if="canEdit"
            ref="trash"
            class="TrashZone"
            :class="{active:trashActive}"
          >
            <i
              class="fas fa-trash"
              aria-hidden="true"
            />
          </div>
        </div>
        <div
          ref="canvas"
          class="RelationCanvas"
        >
          <div
            class="RelationCanvasContent"
            :style="{width:extent.width+'px',height:extent.height+'px',transform:'scale('+zoom+')',transformOrigin:'top left'}"
          >
            <div
              v-for="row in objects.filter(row=>row.ObjType===2)"
              :key="row.ObjId"
              :ref="el=>register(row.ObjId,el)"
              class="RelationGroupBox"
              :style="{left:row.PosX+'px',top:row.PosY+'px',width:(row.Width||150)+'px',height:(row.Height||100)+'px',borderColor:row.BgColor}"
              @pointerdown="begin($event,row)"
              @pointermove="move"
              @pointerup="end"
              @pointercancel="cancel"
            >
              <div
                v-if="row.Label"
                class="RelationGroupLabel"
                :style="{background:row.BgColor}"
              >{{ row.Label }}</div>
              <template v-if="canEdit">
                <div
                  v-for="direction in ['se','sw','ne','nw','e','w','n','s']"
                  :key="direction"
                  class="RelationResizeHandle"
                  :class="'resize-'+direction"
                  @pointerdown.stop="begin($event,row,direction)"
                />
              </template>
            </div>
            <svg
              ref="svg"
              class="RelationCanvasSvg"
              :style="{width:extent.width+'px',height:extent.height+'px'}"
              :width="extent.width"
              :height="extent.height"
            >
              <g
                v-for="connection in connections"
                :key="connection.line.RelationId"
              >
                <path
                  :d="connection.path"
                  :stroke="connection.line.Color"
                  stroke-width="2"
                  fill="none"
                />
                <path
                  v-if="connection.arrow"
                  :d="connection.arrow"
                  :fill="connection.line.Color"
                  :stroke="connection.line.Color"
                  stroke-width="1"
                  stroke-linejoin="round"
                />
                <g @click.stop="removeLine(connection.line)">
                  <rect
                    :x="connection.labelX-(connection.line.RelationType.length*12+12)/2"
                    :y="connection.labelY-14"
                    :width="connection.line.RelationType.length*12+12"
                    height="24"
                    rx="4"
                    ry="4"
                    fill="#fff"
                    :stroke="connection.line.Color"
                    stroke-width="1"
                  />
                  <text
                    :x="connection.labelX"
                    :y="connection.labelY+4"
                    :fill="connection.line.Color"
                    font-size="12"
                    text-anchor="middle"
                  >{{ connection.line.RelationType || '×' }}</text>
                </g>
              </g>
            </svg>
            <div
              v-for="row in objects.filter(row=>row.ObjType===1)"
              :key="row.ObjId"
              :ref="el=>register(row.ObjId,el)"
              class="RelationObject"
              :class="{selected:startObject===row.ObjId}"
              :style="{left:row.PosX+'px',top:row.PosY+'px'}"
              @pointerdown="begin($event,row)"
              @pointermove="move"
              @pointerup="end"
              @pointercancel="cancel"
            >
              <img
                v-if="character(row)?.ImgPath"
                :src="String(character(row)?.ImgPath)"
                alt=""
                draggable="false"
                @load="measure"
              />
              <div>{{ character(row)?.CharaName || row.Label }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div
      v-if="dragPoint"
      class="RelationDragGhost"
      :style="{left:dragPoint.x+'px',top:dragPoint.y+'px'}"
    >{{ dragPoint.name }}</div>
    <BaseDialog
      v-model="groupOpen"
      title="グループ設定"
      size="DialogMedium"
    >
      <section
        :key="revision"
        class="FormSection"
      >
        <RadioButtonComponent
          :ref="el=>fields.register('GroupSource',el,groupSource)"
          label="グループ名の指定方法"
          :options="[{value:'none',label:'指定なし'},{value:'org',label:'既存組織'},{value:'team',label:'既存チーム'}]"
          @value-change="groupSource=fields.getValue('GroupSource','none')"
        />
        <TextFieldComponent
          v-show="groupSource==='none'"
          :ref="el=>fields.register('Label',el,groupForm.Label)"
          label="グループ名"
          required
          :maxlength="50"
          :error="errors.Label"
        />
        <SelectBoxComponent
          v-show="groupSource==='org'"
          :ref="el=>fields.register('OrgIdGrpName',el,groupForm.OrgIdGrpName)"
          label="組織"
          :options="orgOptions"
          required
          :error="errors.Label"
        />
        <SelectBoxComponent
          v-show="groupSource==='team'"
          :ref="el=>fields.register('TeamIdGrpName',el,groupForm.TeamIdGrpName)"
          label="チーム"
          :options="teamOptions"
          required
          :error="errors.Label"
        />
        <TextFieldComponent
          :ref="el=>fields.register('BgColor',el,groupForm.BgColor)"
          label="グループカラー"
          color-picker-flg
          :maxlength="7"
          :error="errors.BgColor"
        />
      </section>
      <template #actions>
        <ButtonComponent
          type="button"
          variant="CloseButton"
          @click="groupOpen=false"
        >閉じる</ButtonComponent>
        <ButtonComponent
          type="button"
          variant="SaveButton"
          @click="applyGroup"
        >決定</ButtonComponent>
      </template>
    </BaseDialog>
  </div>
</template>
