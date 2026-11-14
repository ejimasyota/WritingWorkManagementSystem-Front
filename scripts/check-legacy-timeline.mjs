import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import { oldRoot, functions, modules } from './test-support.mjs';
const source = fs.readFileSync(path.join(oldRoot,'WorkManagement.Timeline.js'),'utf8');
const names = ['ParseTimelineDateValue','GetTimelineChartScale','BuildTimelineTickLabel','BuildTimelineChartTicks','EstimateTimelineLabelWidth','GetTimelineCardWidth','BuildTimelineSegments'];
// 定数も旧資源から読み、比較用の独自実装を持たない。
const constants = parse(source, { sourceType:'module' }).program.body.filter(node => node.type === 'VariableDeclaration' && node.declarations.some(item => item.id.name?.startsWith('TIMELINE_'))).map(node => source.slice(node.start,node.end)).join('\n');
const context = vm.createContext({});
vm.runInContext((constants || '') + '\n' + functions(source,names), context);
const { timeline } = await modules({timeline:'app/utils/timelineChart.ts'});
for (const text of ['', '不明','2000年','2000年2月','2000年2月29日','0001年1月1日','9999年12月31日']) for (const end of [false,true])
  assert.deepEqual(timeline.parseTimelineDateValue(text,end), JSON.parse(JSON.stringify(context.ParseTimelineDateValue(text,end))));
for (const [from,to] of [['2000年','2000年'],['2000年1月1日','2000年1月2日'],['2000年','2002年'],['2000年','2050年'],['1000年','9000年']]) {
  const start = timeline.parseTimelineDateValue(from).Value;
  const finish = timeline.parseTimelineDateValue(to,true).Value;
  const entry = { Key:'1',LabelText:'出来事',DateText:from,StartValue:start,EndValue:finish,HasPeriod:true };
  const actual = timeline.layoutTimeline([entry]);
  const oldTicks = context.BuildTimelineChartTicks(start,finish);
  const cardWidth = context.GetTimelineCardWidth({},entry.LabelText,entry.DateText);
  assert.equal(actual.cards[0].Entry.CardWidth,cardWidth);
  const segments = context.BuildTimelineSegments(oldTicks.Ticks, oldTicks.Scale.TickWidth,oldTicks.TickSpan,[{...entry,CardWidth:cardWidth}]);
  assert.deepEqual(actual.ticks.map(tick=>tick.label).slice(0,oldTicks.Ticks.length - 1), Array.from(oldTicks.Ticks,tick=>tick.Label).slice(0,-1));
  assert.equal(actual.width,Math.ceil(segments.Positions.at(-1)));
  oldTicks.Ticks.slice(0,-1).forEach((tick,index)=>{
    const left=segments.Positions[segments.Points.indexOf(tick.Value)];
    assert.equal(actual.ticks[index].left,Math.round(left*100)/100);
  });
}
console.log('Legacy timeline comparison passed (date parsing, ticks, period widths).');
