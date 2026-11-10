import type { BackendRequest } from '../types/backend';
import type { WorkInfo, WorkPermission } from '../types/work';
import { backendError, requireSuccess } from './backend';
import { messageFormat } from './messages';

/** 作品を取得し直し、編集中の作品と権限を確かめる。画面の状態は呼び出し元が管理する。 */
export async function readWorkAccess(request: BackendRequest, expectedWorkId?: string) {
  const work = requireSuccess(await request<WorkInfo>('/GetWorkInfo.php'), messageFormat('ERROR', 'E_0003', '作品情報の取得'));
  const permission = requireSuccess(await request<WorkPermission>('/GetUserPermission.php'), messageFormat('ERROR', 'E_0003', '権限情報の取得'));
  if (!work || typeof work.WorkId !== 'string' || !work.WorkId || typeof work.WorkTitle !== 'string' || !permission || typeof permission.IsCreator !== 'boolean') {
    throw new backendError(messageFormat('ERROR', 'E_0026'), 502);
  }
  if (expectedWorkId && String(work.WorkId) !== String(expectedWorkId)) {
    throw new backendError(messageFormat('ERROR', 'E_0028'), 409);
  }
  return { work, isCreator: permission.IsCreator === true };
}
