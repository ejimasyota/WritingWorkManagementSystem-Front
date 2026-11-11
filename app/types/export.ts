export interface ExportSettings {
  ExportType: 'word' | 'html';
  SortOrder: 'asc' | 'desc';
  Font: string;
  NewLine: boolean;
  Cover: boolean;
  ExportItems?: string[];
}
