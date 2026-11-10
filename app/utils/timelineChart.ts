import type { TimelineCard, TimelineEntry } from '../types/timeline';

// 旧RenderTimelineChartと同じ内部単位・表示寸法。画面ごとの独自スケールを持たせない。
const MONTH = 31;
const YEAR = 12 * MONTH;
const YEAR_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
export const TIMELINE_LANE_HEIGHT = 46;

export function parseTimelineDateValue(text: unknown, isEnd = false) {
  const digits = String(text || '').replace(/[^0-9]/g, '');
  if (digits.length < 4) return null;
  const year = Number.parseInt(digits.slice(0, 4), 10);
  let month = Number.parseInt(digits.slice(4, 6), 10);
  let day = Number.parseInt(digits.slice(6, 8), 10);
  if (!Number.isFinite(year)) return null;
  if (!Number.isFinite(month) || month < 1 || month > 12) month = isEnd ? 12 : 1;
  if (!Number.isFinite(day) || day < 1 || day > 31) day = isEnd ? 31 : 1;
  return { Year: year, Value: year * YEAR + (month - 1) * MONTH + day - 1 };
}

/** 文字幅を実測できない場合だけ、旧描画処理と同じ文字種別の概算を使用する。 */
function estimate(text: string, charWidth: number) {
  return [...text].reduce((width, char) => width + (/[\x20-\x7E｡-ﾟ]/.test(char) ? Math.round(charWidth * 0.6) : charWidth), 0) + 16;
}

/** 可変幅の区間、上下レーン、目盛り延長を旧RenderTimelineChartの順に計算する。 */
export function layoutTimeline(entries: TimelineEntry[], measure?: (text: string, kind: 'label' | 'date') => number) {
  if (!entries.length) return null;
  const prepared = entries.map(entry => ({
    ...entry,
    CardWidth: Math.min(Math.max(Math.max(
      measure?.(entry.LabelText, 'label') || estimate(entry.LabelText, 12),
      measure?.(entry.DateText, 'date') || estimate(entry.DateText, 10),
    ) + 5, 60), 420),
  }));
  let min = Math.min(...prepared.map(entry => entry.StartValue));
  let max = Math.max(...prepared.map(entry => entry.EndValue));
  if (min === max) { min -= MONTH; max += MONTH; }
  const years = (max - min) / YEAR;
  const monthly = years < 3;
  const step = YEAR_STEPS.find(value => years / value <= 24) || Math.ceil(years / 24 / 1000) * 1000;
  const tickSpan = monthly ? MONTH : step * YEAR;
  const tickWidth = monthly ? 64 : 90;
  const tickLabel = (value: number) => {
    if (!monthly) return Math.floor(value / YEAR) + '年';
    const monthIndex = Math.floor(value / MONTH);
    const month = monthIndex % 12 + 1;
    return month === 1 ? Math.floor(monthIndex / 12) + '年1月' : month + '月';
  };
  const start = Math.floor(min / tickSpan) * tickSpan;
  const end = (Math.floor(max / tickSpan) + 1) * tickSpan;
  const ticks: number[] = [];
  for (let value = start; value <= end; value += tickSpan) ticks.push(value);
  const points = [...new Set([...ticks, ...prepared.flatMap(entry => entry.HasPeriod ? [entry.StartValue, entry.EndValue] : [entry.StartValue])])]
    .filter(value => value >= start && value <= end).sort((left, right) => left - right);
  const widths = points.slice(0, -1).map((point, index) => Math.max((points[index + 1]! - point) / tickSpan * tickWidth, 10));
  const indexes = new Map(points.map((value, index) => [value, index]));
  for (const entry of prepared.filter(item => item.HasPeriod).sort((left, right) => left.StartValue - right.StartValue)) {
    const from = indexes.get(entry.StartValue);
    const to = indexes.get(entry.EndValue);
    if (from === undefined || to === undefined || to <= from) continue;
    const width = widths.slice(from, to).reduce((sum, value) => sum + value, 0);
    if (width <= 0 || width >= entry.CardWidth) continue;
    for (let index = from; index < to; index++) widths[index] = widths[index]! * entry.CardWidth / width;
  }
  const positions = [0];
  widths.forEach((width, index) => positions.push(positions[index]! + width));
  const position = (value: number) => {
    const exact = indexes.get(value);
    if (exact !== undefined) return Math.round(positions[exact]! * 100) / 100;
    let index = 0;
    while (index < widths.length - 1 && value >= points[index + 1]!) index++;
    return Math.round((positions[index]! + widths[index]! * (value - points[index]!) / (points[index + 1]! - points[index]!)) * 100) / 100;
  };
  const keys = new Set(prepared.map(entry => String(entry.Key)));
  const byStart = (left: typeof prepared[number], right: typeof prepared[number]) => left.StartValue - right.StartValue || left.EndValue - right.EndValue;
  const roots = prepared.filter(entry => entry.ParentKey == null || !keys.has(String(entry.ParentKey))).sort(byStart);
  const sorted = roots.flatMap(entry => [entry, ...prepared.filter(child => child.ParentKey != null && String(child.ParentKey) === String(entry.Key)).sort(byStart)]);
  const lanes: number[][] = [[], []];
  const byKey = new Map<string, TimelineCard>();
  let rightEdge = -Infinity;
  let side = 0;
  const cards: TimelineCard[] = sorted.map(entry => {
    const left = position(entry.StartValue);
    const width = entry.HasPeriod ? Math.max(position(entry.EndValue) - left, entry.CardWidth) : entry.CardWidth;
    const parent = entry.ParentKey == null ? undefined : byKey.get(String(entry.ParentKey));
    if (parent) side = parent.Side;
    else if (left < rightEdge) side = 1 - side;
    const sideLanes = lanes[side]!;
    const minLane = parent ? parent.Lane + 1 : 0;
    let lane = sideLanes.findIndex((edge, index) => index >= minLane && edge <= left);
    if (lane < 0) {
      lane = Math.max(minLane, sideLanes.length);
      while (sideLanes.length <= lane) sideLanes.push(0);
    }
    sideLanes[lane] = left + width + 8;
    rightEdge = Math.max(rightEdge, sideLanes[lane]!);
    const card = { Entry: entry, Left: left, Width: Math.round(width * 100) / 100, Side: side, Lane: lane };
    byKey.set(String(entry.Key), card);
    return card;
  });
  const maxRight = Math.max(...cards.map(card => card.Left + card.Width));
  let extended = 0;
  while (positions.at(-1)! < maxRight && extended < 50) {
    const next = ticks.at(-1)! + tickSpan;
    ticks.push(next); points.push(next); widths.push(tickWidth); positions.push(positions.at(-1)! + tickWidth);
    indexes.set(next, points.length - 1); extended++;
  }
  const tickPositions = ticks.map(position);
  return {
    width: Math.ceil(positions.at(-1)!),
    heights: lanes.map(items => items.length * TIMELINE_LANE_HEIGHT),
    ticks: ticks.slice(0, -1).map((value, index) => ({ label: tickLabel(value), left: tickPositions[index]!, width: Math.round((tickPositions[index + 1]! - tickPositions[index]!) * 100) / 100 })),
    cards,
  };
}
