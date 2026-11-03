/** セレクトボックス・ラジオボタンに渡す選択肢。 */
export interface SelectOption {
  label: string
  value: string | number
  disabled?: boolean
}
