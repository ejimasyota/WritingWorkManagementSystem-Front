import { shallowRef } from 'vue';

/**
 * 入力値は部品内部で保持し、親は公開したsetValue/getValueをref経由で呼び出す。
 * プログラムからのセットと利用者の操作を分け、初期化時に変更処理を発火させない。
 * 配列は読み書きの境界で複製する。
 */
export function useFieldValue<T>(fallback: T, changed: () => void = () => {}) {
  const copy = (value: T): T => Array.isArray(value) ? [...value] as T : value;
  const value = shallowRef<T>(copy(fallback));

  function setValue(next: T) {
    value.value = copy(next);
  }

  function getValue(): T {
    return copy(value.value);
  }

  function updateValue(next: T) {
    setValue(next);
    changed();
  }

  return { value, setValue, getValue, updateValue };
}
