import { getCurrentScope, onScopeDispose } from 'vue';

/** API単位ではなく、画面の読込・保存など一つの操作の間だけ表示する。 */
export function useOperationSpinner() {
  const operations = useState<number>('BackendOperations', () => 0);
  const pending = new Set<object>();
  function release(token: object) {
    if (pending.delete(token)) operations.value--;
  }
  // 画面を離れた後の通信待ちが、次の画面のオーバーレイを残さないようにする。
  if (getCurrentScope()) onScopeDispose(() => { for (const token of pending) release(token); });
  async function run<T>(operation: () => Promise<T>): Promise<T> {
    const token = {};
    pending.add(token);
    operations.value++;
    try { return await operation(); }
    finally { release(token); }
  }
  return { run };
}
