import { shallowRef } from 'vue';

/** 入力部品が親画面へ公開する値の操作。値の所有者は入力部品とする。 */
export interface InputFieldHandle<T = string> {
  setValue: (value: T) => void;
  getValue: () => T;
  focus?: () => void;
}

/**
 * 複数の入力部品のコンポーネントrefを管理する。
 * registerはマウント時だけ初期値をセットする。再描画で入力中の値を上書きしない。
 * 入力値の読み書きは、呼び出し元が検証・保存・クリア等のタイミングで明示的に行う。
 */
export function useInputFields() {
  const handles = shallowRef(new Map<string, InputFieldHandle<unknown>>());

  function register<T>(key: string, instance: unknown, initialValue: T) {
    if (!instance) {
      handles.value.delete(key);
      return;
    }
    if (typeof instance !== 'object' || !('getValue' in instance) || !('setValue' in instance)
      || typeof instance.getValue !== 'function' || typeof instance.setValue !== 'function') {
      throw new TypeError(`入力部品 ${key} に公開メソッドがありません`);
    }
    const field = instance as InputFieldHandle<unknown>;
    if (handles.value.get(key) === field) return;
    handles.value.set(key, field);
    field.setValue(initialValue);
  }

  function getValue<T>(key: string, fallback: T): T {
    const field = handles.value.get(key);
    return field ? field.getValue() as T : fallback;
  }

  function setValue<T>(key: string, value: T) {
    handles.value.get(key)?.setValue(value);
  }

  function setValues<T extends object>(values: T) {
    for (const [key, value] of Object.entries(values)) setValue(key, value);
  }

  function getValues<T extends object>(defaults: T): T {
    return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, getValue(key, value)])) as T;
  }

  function focus(key: string) {
    handles.value.get(key)?.focus?.();
  }

  return { register, getValue, setValue, setValues, getValues, focus };
}
