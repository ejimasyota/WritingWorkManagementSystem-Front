export interface HistoryDetail {
  Type: string;
  Name: string;
  Summary: string;
  Changes: {
    Label: string;
    Old: unknown;
    New: unknown;
  }[];
  Raw: string;
}
