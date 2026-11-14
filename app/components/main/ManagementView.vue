<script setup lang="ts">
import { useOperationSpinner } from "../../composables/useOperationSpinner";

import { useInputFields } from "../../composables/useInputFields";
import { messageFormat } from "../../utils/messages";
import { computed, onMounted, reactive, ref } from "vue";
import type { BackendRequest, SessionInfo } from "../../types/backend";
import type { PageDialogs } from "../../composables/usePageDialogs";
import type { TableRow, TableColumn } from "../../composables/tableData";
import { mainMenus, type MainMenuId } from "../../utils/mainMenus";
import {
  formatDateTime,
  unformatDate,
  getUtilPulldownLabel,
} from "../../utils/utilMethod";
import { CONST_VARIABLE } from "~/config/Const";
import { reportBackendError, requireSuccess } from "../../utils/backend";
const spinner = useOperationSpinner();

// この管理画面の一覧列定義。
const rawColumns = {
  ProjectColumns: [
    {
      key: "WorkTitle",
      label: "作品名",
      filterable: true,
      sortable: true,
    },
    {
      key: "Genre",
      label: "ジャンル",
      filterable: true,
      sortable: true,
    },
    {
      key: "RegistUser",
      label: "登録者",
      filterable: true,
      sortable: true,
    },
    {
      key: "RegistDate",
      label: "登録年月日",
      filterable: false,
      sortable: true,
      style: "min-width:310px",
    },
    {
      key: "UpdateUser",
      label: "更新者",
      filterable: true,
      sortable: true,
    },
    {
      key: "UpdateDate",
      label: "更新年月日",
      filterable: false,
      sortable: true,
      style: "min-width:310px",
    },
    {
      key: "Action",
      label: "操作パレット",
      filterable: false,
      sortable: false,
      style: "width:1%",
    },
  ],
  MemberColumns: [
    {
      key: "UserId",
      label: "ユーザーID",
      filterable: true,
      sortable: true,
    },
    {
      key: "RegistDate",
      label: "登録年月日",
      filterable: false,
      sortable: true,
      style: "min-width:310px",
    },
    {
      key: "UpdateDate",
      label: "更新年月日",
      filterable: false,
      sortable: true,
      style: "min-width:310px",
    },
    {
      key: "UpdateUser",
      label: "更新者",
      filterable: true,
      sortable: true,
    },
    {
      key: "Action",
      label: "操作パレット",
      filterable: false,
      sortable: false,
      style: "width:1%",
    },
  ],
  AdminColumns: [
    {
      key: "UserId",
      label: "ユーザーID",
      filterable: true,
      sortable: true,
    },
    {
      key: "RegistDate",
      label: "登録年月日",
      filterable: false,
      sortable: true,
      style: "min-width:310px",
    },
  ],
  WorkColumns: [
    {
      key: "WorkName",
      label: "作品名",
      filterable: true,
      sortable: true,
    },
    {
      key: "UserName",
      label: "所有者",
      filterable: true,
      sortable: true,
    },
    {
      key: "RegistDate",
      label: "登録年月日",
      filterable: false,
      sortable: true,
      style: "min-width:310px",
    },
    {
      key: "UpdateDate",
      label: "更新年月日",
      filterable: false,
      sortable: true,
      style: "min-width:310px",
    },
    {
      key: "Action",
      label: "操作パレット",
      filterable: false,
      sortable: false,
      style: "width:1%",
    },
  ],
  UserSysNotiColumns: [
    {
      key: "Title",
      label: "タイトル",
      filterable: false,
      sortable: false,
    },
    {
      key: "Message",
      label: "本文",
      filterable: false,
      sortable: false,
      style: "min-width:260px",
    },
    {
      key: "RegistDate",
      label: "投稿年月日",
      filterable: false,
      sortable: true,
      style: "min-width:190px",
    },
  ],
  SysNotiColumns: [
    {
      key: "Title",
      label: "タイトル",
      filterable: false,
      sortable: false,
    },
    {
      key: "Message",
      label: "本文",
      filterable: false,
      sortable: false,
      style: "min-width:260px",
    },
    {
      key: "ExpireDate",
      label: "有効期限",
      filterable: false,
      sortable: true,
      style: "min-width:150px",
    },
    {
      key: "RegistDate",
      label: "投稿年月日",
      filterable: false,
      sortable: true,
      style: "min-width:190px",
    },
  ],
  EraMasterColumns: [
    {
      key: "EraName",
      label: "元号名",
      filterable: true,
      sortable: true,
    },
    {
      key: "StartYear",
      label: "開始年",
      filterable: false,
      sortable: true,
    },
    {
      key: "EndYear",
      label: "終了年",
      filterable: false,
      sortable: true,
    },
    {
      key: "RegistDate",
      label: "登録年月日",
      filterable: false,
      sortable: true,
      style: "min-width:310px",
    },
    {
      key: "UpdateDate",
      label: "更新年月日",
      filterable: false,
      sortable: true,
      style: "min-width:310px",
    },
    {
      key: "RegistUser",
      label: "登録者",
      filterable: true,
      sortable: true,
    },
    {
      key: "UpdateUser",
      label: "更新者",
      filterable: true,
      sortable: true,
    },
  ],
  TemplateMasterColumns: [
    {
      key: "Edit",
      label: "編集",
      filterable: false,
      sortable: false,
      style: "width:70px",
    },
    {
      key: "DivisionLabel",
      label: "区分",
      filterable: true,
      sortable: true,
    },
    {
      key: "GenreLabel",
      label: "ジャンル",
      filterable: true,
      sortable: true,
    },
    {
      key: "RegistDate",
      label: "登録年月日",
      filterable: false,
      sortable: true,
      style: "min-width:310px",
    },
    {
      key: "UpdateDate",
      label: "更新年月日",
      filterable: false,
      sortable: true,
      style: "min-width:310px",
    },
    {
      key: "RegistUser",
      label: "登録者",
      filterable: true,
      sortable: true,
    },
    {
      key: "UpdateUser",
      label: "更新者",
      filterable: true,
      sortable: true,
    },
  ],
};

const inputFields = useInputFields();
const props = defineProps<{
  menuId: MainMenuId;
  session: SessionInfo;
  request: BackendRequest;
  dialogs: PageDialogs;
  hideMeta: boolean;
}>();
const emit = defineEmits(["move", "changed"]);
const rows = ref<TableRow[]>([]);
const selected = ref<TableRow | null>(null);
const form = reactive({
  title: "",
  message: "",
  expire: "",
  eraName: "",
  startYear: "",
  endYear: "",
});
const errors = ref<Record<string, string>>({});
const templateOpen = ref(false);
const editingTemplate = ref<TableRow | null>(null);
const table = ref<{
  reset: () => void;
}>();
const menu = computed(() => mainMenus[props.menuId]);
const columns = computed(() => mainColumns(props.menuId));
const notificationForm = computed(
  () => props.menuId === CONST_VARIABLE.MENU_ID.NOTIFICATION_ADMIN,
);
const eraForm = computed(
  () => props.menuId === CONST_VARIABLE.MENU_ID.ERA_MASTER,
);
async function load() {
  try {
    const finished = await spinner.run(async () => {
      const data = requireSuccess(
        await props.request<unknown>(menu.value.api),
        messageFormat("ERROR", "E_0003", menu.value.title + "の取得"),
      );
      rows.value = normalizeMainList(props.menuId, data).map((row) =>
        props.menuId === "MenuTemplateMaster"
          ? {
              ...row,
              DivisionLabel:
                Number(row.DivisionType) === 2 ? "プロット" : "ストーリー",
              GenreLabel: getUtilPulldownLabel(
                CONST_VARIABLE.PULLDOWN_TYPE.TYPE_GENRE,
                row.Genre,
              ),
            }
          : row,
      );
      table.value?.reset();
      return true;
    });
    if (!finished) return;
  } catch (error) {
    await reportBackendError(
      props.dialogs,
      error,
      messageFormat("ERROR", "E_0004", menu.value.title + "の取得"),
    );
  }
}
function clear() {
  selected.value = null;
  Object.assign(form, {
    title: "",
    message: "",
    expire: "",
    eraName: "",
    startYear: "",
    endYear: "",
  });
  inputFields.setValues(form);
  errors.value = {};
}
async function selectRow(row: TableRow) {
  if (props.menuId === CONST_VARIABLE.MENU_ID.NOTIFICATION_LIST) {
    await props.dialogs.info(
      String(row.Title || ""),
      String(row.Message || ""),
      "left",
    );
    return;
  }
  if (!notificationForm.value && !eraForm.value) return;
  selected.value = row;
  errors.value = {};
  Object.assign(form, {
    title: String(row.Title || ""),
    message: String(row.Message || ""),
    expire: row.ExpireDate
      ? String(row.ExpireDate).slice(0, 10).replace(/-/g, "/")
      : "",
    eraName: String(row.EraName || ""),
    startYear: String(row.StartYear || ""),
    endYear: String(row.EndYear || ""),
  });
  inputFields.setValues(form);
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}
async function toggleLock(row: TableRow) {
  const member = props.menuId === CONST_VARIABLE.MENU_ID.MEMBER_LIST;
  const locked = member ? row.AccountLockFlg : row.LockFlg;
  const action = locked ? "復旧" : "ロック";
  if (
    !(await props.dialogs.confirm(
      messageFormat(
        "CONFIRM",
        "C_0005",
        member ? "アカウント" : "作品",
        action,
      ),
    ))
  )
    return;
  try {
    const payload = member
      ? {
          UserId: row.UserId,
          AccountLockFlg: !locked,
          AdminUserId: props.session.UserId,
          UpdateDate: row.UpdateDate || null,
        }
      : {
          WorkId: row.WorkId,
          LockFlg: !locked,
          UserId: props.session.UserId,
          UpdateDate: row.UpdateDate || null,
        };
    const finished = await spinner.run(async () => {
      requireSuccess(
        await props.request(
          member ? "/UpdateAccountLock.php" : "/UpdateProjectLock.php",
          "POST",
          payload,
        ),
        messageFormat("ERROR", "E_0003", "更新"),
      );
      return true;
    });
    if (!finished) return;
    await props.dialogs.info(
      messageFormat("INFO", "I_0011", "更新"),
      messageFormat("INFO", "I_0019", member ? "アカウント" : "作品", action),
    );
    await load();
  } catch (error) {
    await reportBackendError(
      props.dialogs,
      error,
      messageFormat("ERROR", "E_0004", "更新"),
    );
  }
}
function validateForm() {
  Object.assign(form, inputFields.getValues(form));
  errors.value = {};
  if (notificationForm.value) {
    if (!form.title.trim())
      errors.value.title = messageFormat("ERROR", "E_0001", "タイトル");
    if (!form.message.trim())
      errors.value.message = messageFormat("ERROR", "E_0001", "本文");
    if (form.expire) {
      const expiry = new Date(`${unformatDate(form.expire)}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (Number.isNaN(expiry.getTime()) || expiry <= today)
        errors.value.expire = messageFormat("ERROR", "E_0025");
    }
  } else {
    if (!form.eraName.trim())
      errors.value.eraName = messageFormat("ERROR", "E_0001", "元号名");
    if (!form.startYear.trim())
      errors.value.startYear = messageFormat("ERROR", "E_0001", "開始年");
  }
  return Object.keys(errors.value).length === 0;
}
async function notifyEra(eraName: string, operation: string) {
  if (
    !(await props.dialogs.confirm(
      messageFormat("CONFIRM", "C_0001", "変更を通知"),
    ))
  )
    return;
  const text = messageFormat("INFO", "I_0019", eraName, operation);
  requireSuccess(
    await spinner.run(() =>
      props.request("/PostSystemNotification.php", "POST", {
        Title: text,
        Message: text,
        ExpireDate: null,
      }),
    ),
    messageFormat("ERROR", "E_0003", "通知の登録"),
  );
  await props.dialogs.info(
    messageFormat("INFO", "I_0011", "通知"),
    messageFormat("INFO", "I_0001", "システム通知への登録"),
  );
}
async function save() {
  if (!validateForm()) return;
  const editing = !!selected.value;
  const eraName = form.eraName.trim();
  try {
    if (notificationForm.value) {
      const payload: Record<string, unknown> = {
        Title: form.title.trim(),
        Message: form.message.trim(),
        ExpireDate: form.expire || null,
      };
      if (editing)
        Object.assign(payload, {
          NotificationId: selected.value!.NotificationId,
          UpdateDate: selected.value!.UpdateDate,
        });
      requireSuccess(
        await spinner.run(() =>
          props.request(
            editing
              ? "/UpdateSystemNotification.php"
              : "/PostSystemNotification.php",
            "POST",
            payload,
          ),
        ),
        messageFormat("ERROR", "E_0003", "保存"),
      );
      await props.dialogs.info(
        messageFormat("INFO", "I_0011", "保存"),
        editing
          ? messageFormat("INFO", "I_0001", "システム通知の更新")
          : messageFormat("INFO", "I_0001", "システム通知の投稿"),
      );
    } else {
      requireSuccess(
        await spinner.run(() =>
          props.request("/SaveEraMaster.php", "POST", {
            EraMasterId: selected.value?.EraMasterId || null,
            EraName: eraName,
            StartYear: form.startYear.trim() || null,
            EndYear: form.endYear.trim() || null,
            UpdateDate: selected.value?.UpdateDate || null,
          }),
        ),
        messageFormat("ERROR", "E_0003", "保存"),
      );
    }
    clear();
    await load();
    if (eraForm.value) await notifyEra(eraName, editing ? "更新" : "登録");
    emit("changed");
  } catch (error) {
    await reportBackendError(
      props.dialogs,
      error,
      messageFormat("ERROR", "E_0004", "保存"),
    );
  }
}
async function remove() {
  const row = selected.value;
  if (!row) return;
  if (
    !(await props.dialogs.confirm(
      eraForm.value
        ? messageFormat("CONFIRM", "C_0001", "この元号マスタを削除")
        : messageFormat("CONFIRM", "C_0001", "このシステム通知を削除"),
    ))
  )
    return;
  const eraName = form.eraName;
  try {
    const payload = eraForm.value
      ? {
          EraMasterId: row.EraMasterId,
          UpdateDate: row.UpdateDate,
        }
      : {
          NotificationId: row.NotificationId,
          UpdateDate: row.UpdateDate,
        };
    const finished = await spinner.run(async () => {
      requireSuccess(
        await props.request(
          eraForm.value
            ? "/DeleteEraMaster.php"
            : "/DeleteSystemNotification.php",
          "POST",
          payload,
        ),
        messageFormat("ERROR", "E_0003", "削除"),
      );
      clear();
      await load();
      return true;
    });
    if (!finished) return;
    if (eraForm.value) await notifyEra(eraName, "削除");
    else
      await props.dialogs.info(
        messageFormat("INFO", "I_0011", "削除"),
        messageFormat("INFO", "I_0001", "システム通知の削除"),
      );
    emit("changed");
  } catch (error) {
    await reportBackendError(
      props.dialogs,
      error,
      messageFormat("ERROR", "E_0004", "削除"),
    );
  }
}
function openTemplate(row: TableRow | null = null) {
  editingTemplate.value = row;
  templateOpen.value = true;
}
onMounted(load);
/** 作品一覧管理APIだけが Data.WorkList を返すため、既存の形式差を吸収する。 */
function normalizeMainList(
  menuId: string,
  data: unknown,
): Record<string, unknown>[] {
  const list =
    menuId === "MenuProjectManagement"
      ? (data as { WorkList?: Record<string, unknown>[] } | null)?.WorkList
      : data;
  if (list == null) return [];
  if (!Array.isArray(list)) throw new Error(messageFormat("ERROR", "E_0026"));
  return list;
}
/** 旧Main.jsから抽出した列順と幅指定を共通テーブルへ渡す。 */
function mainColumns(menuId: MainMenuId): TableColumn[] {
  return rawColumns[mainMenus[menuId].columns].map((column) => ({
    ...column,
    className: column.key === "Action" ? "ActionCol" : undefined,
    meta: ["登録年月日", "更新年月日", "登録者", "更新者"].includes(
      column.label,
    ),
    style: column.style
      ? Object.fromEntries(
          column.style
            .split(";")
            .filter(Boolean)
            .map((part) => part.split(":")),
        )
      : undefined,
    format: (value: unknown) => {
      if (column.key === "Genre")
        return getUtilPulldownLabel(
          CONST_VARIABLE.PULLDOWN_TYPE.TYPE_GENRE,
          value,
        );
      if (column.key === "ExpireDate")
        return value
          ? String(value)?.split(" ")[0]?.replace(/-/g, "/")
          : "無期限";
      if (column.key.endsWith("Date")) return formatDateTime(value) || "未設定";
      return value === null || value === undefined || value === ""
        ? "未設定"
        : value;
    },
  }));
}
</script>

<template>
  <div>
    <div class="ContentHeader">
      <h2 class="ContentTitle">
        <i class="fas" :class="menu.icon" />
        {{ menu.title }}
      </h2>
    </div>
    <template v-if="notificationForm">
      <div class="FormRow">
        <TextFieldComponent
          :ref="(el) => inputFields.register('title', el, form.title)"
          input-id="SysNotiTitle"
          label="タイトル"
          maxlength="200"
          :error="errors.title"
          required
        />
        <TextFieldComponent
          :ref="(el) => inputFields.register('expire', el, form.expire)"
          input-id="SysNotiExpire"
          label="有効期限"
          input-readonly
          date-picker-flg
          date-mode="date"
          info-icon-flg
          info-title="有効期限"
          :info-message="messageFormat('INFO', 'I_0022')"
          :error="errors.expire"
        />
      </div>
      <TextFieldComponent
        :ref="(el) => inputFields.register('message', el, form.message)"
        input-id="SysNotiMessage"
        label="本文"
        text-area-flg
        :error="errors.message"
        required
      />
    </template>
    <div v-if="eraForm" class="FormRow">
      <TextFieldComponent
        :ref="(el) => inputFields.register('eraName', el, form.eraName)"
        input-id="EraMasterName"
        label="元号名"
        maxlength="100"
        :error="errors.eraName"
        required
      />
      <TextFieldComponent
        :ref="(el) => inputFields.register('startYear', el, form.startYear)"
        input-id="EraMasterStartYear"
        label="開始年"
        input-readonly
        maxlength="20"
        date-picker-flg
        :error="errors.startYear"
        required
      />
      <TextFieldComponent
        :ref="(el) => inputFields.register('endYear', el, form.endYear)"
        input-id="EraMasterEndYear"
        label="終了年"
        input-readonly
        maxlength="20"
        date-picker-flg
      />
    </div>
    <div v-if="notificationForm || eraForm" class="ButtonGroup">
      <ButtonComponent type="button" variant="ClearButton" @click="clear">
        <i class="fas fa-sync" />
        クリア
      </ButtonComponent>
      <ButtonComponent type="button" variant="SaveButton" @click="save">
        <i class="fas fa-save" />
        保存
      </ButtonComponent>
      <ButtonComponent
        v-if="selected"
        type="button"
        variant="DeleteButton"
        @click="remove"
      >
        <i class="fas fa-trash" />
        削除
      </ButtonComponent>
    </div>
    <div
      v-if="menuId === CONST_VARIABLE.MENU_ID.TEMPLATE_MASTER"
      class="MarginBottom20"
    >
      <ButtonComponent
        type="button"
        variant="SuccessButton"
        @click="openTemplate()"
      >
        <i class="fas fa-plus" />
        追加
      </ButtonComponent>
    </div>
    <TableComponent
      ref="table"
      :rows="rows"
      :columns="columns"
      :row-key="menu.key"
      :hide-meta="hideMeta"
      :row-clickable="
        notificationForm ||
        eraForm ||
        menuId === CONST_VARIABLE.MENU_ID.NOTIFICATION_LIST
      "
      @row-click="selectRow"
    >
      <template #cell-Action="{ row }">
        <ButtonComponent
          v-if="menuId === CONST_VARIABLE.MENU_ID.PROJECT_MANAGEMENT"
          type="button"
          variant="ButtonSmall PrimaryButton ProjectMoveButton"
          @click.stop="emit('move', row.WorkId)"
        >
          <i class="fas fa-arrow-right" />
          移動
        </ButtonComponent>
        <ButtonComponent
          type="button"
          variant="ButtonSmall ProjectMoveButton"
          :class="
            (
              menuId === CONST_VARIABLE.MENU_ID.MEMBER_LIST
                ? row.AccountLockFlg
                : row.LockFlg
            )
              ? 'SuccessButton'
              : 'DangerButton'
          "
          @click.stop="toggleLock(row)"
        >
          <i
            class="fas"
            :class="
              (
                menuId === CONST_VARIABLE.MENU_ID.MEMBER_LIST
                  ? row.AccountLockFlg
                  : row.LockFlg
              )
                ? 'fa-unlock'
                : 'fa-lock'
            "
          />
          {{
            (
              menuId === CONST_VARIABLE.MENU_ID.MEMBER_LIST
                ? row.AccountLockFlg
                : row.LockFlg
            )
              ? "復旧"
              : "ロック"
          }}
        </ButtonComponent>
      </template>
      <template #cell-Edit="{ row }">
        <ButtonComponent
          type="button"
          variant="PrimaryButton ButtonSmall"
          @click.stop="openTemplate(row)"
        >
          <i class="fas fa-edit" />
        </ButtonComponent>
      </template>
    </TableComponent>
    <TemplateMasterDialog
      v-model="templateOpen"
      :template="editingTemplate"
      :templates="rows"
      :request="request"
      :dialogs="dialogs"
      @changed="load"
    />
  </div>
</template>
