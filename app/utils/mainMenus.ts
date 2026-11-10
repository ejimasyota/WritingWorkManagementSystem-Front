
export const mainMenus = {
  MenuWorkManagement: { title: '創作管理', icon: 'fa-folder-open', api: '/GetProjectList.php', key: 'WorkId', columns: 'ProjectColumns', admin: false },
  MenuSystemNotificationList: { title: 'システム通知一覧', icon: 'fa-bell', api: '/GetUserSystemNotificationList.php', key: 'NotificationId', columns: 'UserSysNotiColumns', admin: false },
  MenuMemberList: { title: '会員一覧', icon: 'fa-users', api: '/GetMemberList.php', key: 'UserId', columns: 'MemberColumns', admin: true },
  MenuAdminList: { title: '管理者一覧', icon: 'fa-user-shield', api: '/GetAdminList.php', key: 'UserId', columns: 'AdminColumns', admin: true },
  MenuSystemNotificationAdmin: { title: 'システム通知管理', icon: 'fa-bullhorn', api: '/GetSystemNotificationAdminList.php', key: 'NotificationId', columns: 'SysNotiColumns', admin: true },
  MenuEraMaster: { title: '元号マスタ', icon: 'fa-calendar-alt', api: '/GetEraMasterList.php', key: 'EraMasterId', columns: 'EraMasterColumns', admin: true },
  MenuTemplateMaster: { title: 'テンプレートマスタ', icon: 'fa-file-lines', api: '/GetTemplateMasterList.php', key: 'TemplateId', columns: 'TemplateMasterColumns', admin: true },
  MenuProjectManagement: { title: '作品一覧管理', icon: 'fa-cogs', api: '/GetAllWorkList.php', key: 'WorkId', columns: 'WorkColumns', admin: true },
} as const

export type MainMenuId = keyof typeof mainMenus

export function canOpenMenu(id: string, isAdmin: boolean): id is MainMenuId {
  if (!Object.hasOwn(mainMenus, id)) return false
  return !mainMenus[id as MainMenuId].admin || isAdmin
}

