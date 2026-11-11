export interface RelationObject extends Record<string, unknown> {
  ObjId: string;
  ObjType: number;
  TargetId?: unknown;
  Label: string;
  PosX: number;
  PosY: number;
  Width: number | null;
  Height: number | null;
  BgColor?: string;
  UpdateDate?: string;
}
export interface RelationLine extends Record<string, unknown> {
  RelationId: string;
  SourceObjId: string;
  TargetObjId: string;
  LineType: number;
  RelationType: string;
  Color: string;
  UpdateDate?: string;
}
