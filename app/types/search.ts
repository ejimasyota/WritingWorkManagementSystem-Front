/** GetSearchScreens.phpの公開画面定義。SQL識別子はフロントの入力として使用しない。 */
export interface SearchScreen {
  MenuId: string;
  ScreenName: string;
}
export interface SearchQuery {
  Keyword: string;
  MenuIds: string[];
}
export interface SearchResult extends Record<string, unknown> {
  MenuId: string;
  ScreenName: string;
  TableName: string;
  RowIdColumn: string;
  RowId: string;
  ParentIdColumn: string | null;
  ParentId: string | null;
  MatchedColumn: string;
  MatchedColumnLabel: string;
  Content: string;
  ResultKey?: number;
}
