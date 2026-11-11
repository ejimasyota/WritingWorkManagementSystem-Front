export interface HierarchyNode {
  key: string;
  row: Record<string, unknown>;
  children: HierarchyNode[];
}
