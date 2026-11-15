/** サイドバーの表示項目。権限制御と分類に共通で使用する。 */
export interface SidebarMenu { id: string; label: string; icon: string; admin?: boolean; section?: string; }
export interface SidebarGroup { label: string; menus: SidebarMenu[]; }
