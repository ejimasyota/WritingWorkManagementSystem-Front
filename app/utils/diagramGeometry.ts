import type { DiagramConnection, DiagramRectangle } from '../types/diagram';
/** 矩形の端を結ぶ直線・二次曲線を求める。矢尻とラベル位置を同じ座標から生成する。 */
export function connectRectangles(source: DiagramRectangle, target: DiagramRectangle, offset: number, withArrow: boolean): DiagramConnection {
  const x1 = source.x + source.width / 2,
    y1 = source.y + source.height / 2,
    x2 = target.x + target.width / 2,
    y2 = target.y + target.height / 2;
  const dx = x2 - x1,
    dy = y2 - y1,
    length = Math.hypot(dx, dy) || 1,
    ux = dx / length,
    uy = dy / length;
  const edge = (width: number, height: number) => Math.abs(ux) < 0.001 && Math.abs(uy) < 0.001 ? 0 : Math.abs(ux) * height > Math.abs(uy) * width ? width / Math.abs(ux) : height / Math.abs(uy);
  const src = edge(source.width / 2, source.height / 2),
    dst = edge(target.width / 2, target.height / 2);
  const startX = x1 + ux * src,
    startY = y1 + uy * src,
    midX = (x1 + x2) / 2 - uy * offset,
    midY = (y1 + y2) / 2 + ux * offset;
  const curved = offset !== 0,
    sign = offset >= 0 ? 1 : -1;
  const endX = x2 - ux * dst - (withArrow && curved ? uy * sign * 5 : 0),
    endY = y2 - uy * dst + (withArrow && curved ? ux * sign * 5 : 0);
  let baseX = endX,
    baseY = endY,
    arrow = '';
  if (withArrow) {
    const ax = curved ? endX - midX : dx,
      ay = curved ? endY - midY : dy,
      al = Math.hypot(ax, ay) || 1,
      au = ax / al,
      av = ay / al;
    baseX = endX - au * 12;
    baseY = endY - av * 12;
    arrow = `M${endX},${endY} L${baseX - av * 7},${baseY + au * 7} L${baseX + av * 7},${baseY - au * 7} Z`;
  }
  return {
    path: curved ? `M${startX},${startY} Q${midX},${midY} ${baseX},${baseY}` : `M${startX},${startY} L${baseX},${baseY}`,
    arrow,
    labelX: curved ? midX : (x1 + x2) / 2,
    labelY: curved ? midY - 5 : (y1 + y2) / 2 - 5
  };
}
export function rectanglesOverlap(a: DiagramRectangle, b: DiagramRectangle) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
