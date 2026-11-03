import { shallowRef, watch } from 'vue'

/**
 * v-model と公開メソッドからの更新を同じ経路で処理する。
 * 選択値の配列は境界で複製し、親からの変更で内部状態が書き換わることを防ぐ。
 */
export function useFieldValue<T>(
  props: { modelValue?: T },
  emit: (event: 'update:modelValue', value: T) => void,
  fallback: T,
) {
  const copy = (v: T): T => Array.isArray(v) ? [...v] as T : v
  const value = shallowRef<T>(copy(props.modelValue === undefined ? fallback : props.modelValue))

  // 親からの再設定は反映だけを行い、update の往復による無限ループを避ける。
  watch(() => props.modelValue, v => {
    value.value = copy(v === undefined ? fallback : v)
  }, { deep: true })

  function setValue(v: T) {
    value.value = copy(v)
    emit('update:modelValue', copy(v))
  }

  function getValue(): T {
    return copy(value.value)
  }

  return { value, setValue, getValue }
}
