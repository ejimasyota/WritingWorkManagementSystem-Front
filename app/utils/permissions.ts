/** 管理者専用API。画面非表示だけに頼らず、送信時にもセッションの権限を確認する。 */
const adminEndpoints = new Set([
  '/GetMemberList.php', '/GetAdminList.php', '/GetAllWorkList.php',
  '/UpdateAccountLock.php', '/UpdateProjectLock.php',
  '/GetSystemNotificationAdminList.php', '/PostSystemNotification.php',
  '/UpdateSystemNotification.php', '/DeleteSystemNotification.php',
  '/GetEraMasterList.php', '/SaveEraMaster.php', '/DeleteEraMaster.php',
  '/GetTemplateMasterList.php', '/SaveTemplateMaster.php', '/DeleteTemplateMaster.php',
])

export function isPublicEndpoint(endpoint: string) {
  return ['/Login.php', '/Registration.php', '/Logout.php'].includes(endpoint.split('?')[0]!)
}

export function requiresAdmin(endpoint: string) {
  return adminEndpoints.has(endpoint.split('?')[0]!)
}
