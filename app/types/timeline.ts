export interface TimelineEntry {
  Key: string | number;
  DateText: string;
  LabelText: string;
  TooltipText: string;
  StartValue: number;
  EndValue: number;
  HasPeriod: boolean;
  ParentKey?: string | number;
  IsChild?: boolean;
}
export interface TimelineCard {
  Entry: TimelineEntry;
  Left: number;
  Width: number;
  Side: number;
  Lane: number;
}
