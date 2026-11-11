export type WbsViewMode = 'Day' | 'Week' | 'Month';
export interface WbsTick {
  Date: Date;
  Offset: number;
  Label: string;
  Width: number;
  IsWeekend?: boolean;
  HolidayName?: string;
  IsToday?: boolean;
}
export interface WbsRange {
  StartDate: Date;
  EndDate: Date;
  DayWidth: number;
  ChartWidth: number;
  TodayOffset: number;
  Ticks: WbsTick[];
  Periods: {
    Offset: number;
    Width: number;
    Label: string;
  }[];
}
