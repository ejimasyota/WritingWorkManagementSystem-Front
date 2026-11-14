import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { parse as parseVue } from '@vue/compiler-sfc';
import { parse } from '@babel/parser';
import { transform } from 'esbuild';
import { read, oldRoot, functions, modules } from './test-support.mjs';
const { dates, holidays, geometry } = await modules({ dates:'app/utils/dates.ts', holidays:'app/utils/holidays.ts', geometry:'app/utils/diagramGeometry.ts' });
const old = fs.readFileSync(path.join(oldRoot,'WorkManagement.Wbs.js'),'utf8');
const constants = parse(old,{sourceType:'module'}).program.body.filter(node => node.type === 'VariableDeclaration' && node.declarations.some(item => item.id.name?.startsWith('WBS_'))).map(node => old.slice(node.start,node.end)).join('\n');
const today = new Date(2026,10,13);
const context = vm.createContext({ Date, GetWbsToday:()=>today, GetJapaneseHolidayName:()=>'', BuildWbsChartGridHtml:()=>'' });
vm.runInContext(constants + '\n' + functions(old,['ParseWbsDate','DiffWbsDays','AddWbsDays','BuildWbsChartRange','SnapWbsRangeStart','SnapWbsRangeEnd','GetWbsWeekStartOffset','BuildWbsChartTicks','BuildWbsChartPeriods','SetWbsTodayTick','SetWbsSegmentWidths']),context);
const source = parseVue(read('app/components/work/Wbs.vue')).descriptor.scriptSetup.content;
const compiled = await transform(functions(source,['buildChartRange'],true),{loader:'ts'});
const current = vm.createContext({ Date, wbsDate:dates.parseCalendarDate, wbsDays:dates.calendarDayDifference, wbsAddDays:dates.addCalendarDays, japaneseHolidayName:holidays.japaneseHolidayName });
vm.runInContext(compiled.code,current);
const normalize = range => range && ({start:range.StartDate.toISOString(),end:range.EndDate.toISOString(),width:range.ChartWidth,today:range.TodayOffset,ticks:Array.from(range.Ticks,tick=>[tick.Date.toISOString(),tick.Offset,tick.Width,tick.Label,!!tick.IsToday,!!tick.IsWeekend]),periods:Array.from(range.Periods,tick=>[tick.Offset,tick.Width,tick.Label])});
let cases=0;
for(const rows of [[],[{StartDate:'2026-11-01',EndDate:'2026-11-30'}],[{StartDate:'2025-12-25',EndDate:'2027-01-05'}],[{StartDate:'不明',EndDate:''}]]) for(const mode of ['Day','Week','Month']) {
  context.FilteredWbsTaskList=rows;context.WbsChartViewMode=mode;
  assert.deepEqual(normalize(current.buildChartRange(rows,mode,today)),normalize(context.BuildWbsChartRange()));cases++;
}
// 実際の旧SVG描画関数を最小DOM上で実行し、線と矢尻の座標を比較する。
const relation = fs.readFileSync(path.join(oldRoot,'WorkManagement.Relation.js'),'utf8');
let nodes=[];
const svg = { set innerHTML(value){nodes=[];}, appendChild:node=>nodes.push(node) };
const canvas = { querySelector:()=>({offsetWidth:100,offsetHeight:80}) };
const document = { getElementById:id=>id==='RelationSvg'?svg:canvas, createElementNS:(_,tag)=>({tag,attributes:{},dataset:{},style:{},setAttribute(key,value){this.attributes[key]=String(value);}}) };
const rel = vm.createContext({ document, CanEdit:()=>false, UpdateRelationCanvasSize(){} });
vm.runInContext(functions(relation,['CalcEdgeDist','RenderRelationLines']),rel);
for(const arrow of [false,true]) for(const reverse of [false,true]) {
  rel.RelationObjects=[{ObjId:1,PosX:0,PosY:0},{ObjId:2,PosX:300,PosY:160}];
  rel.RelationLines=[{RelationId:1,SourceObjId:1,TargetObjId:2,LineType:arrow?1:2}];
  if(reverse)rel.RelationLines.push({RelationId:2,SourceObjId:2,TargetObjId:1,LineType:2});
  rel.RenderRelationLines();
  const actual=geometry.connectRectangles({x:0,y:0,width:100,height:80},{x:300,y:160,width:100,height:80},reverse?40:0,arrow);
  const paths=nodes.filter(node=>node.tag==='path');
  // Math.hypotと旧sqrtの浮動小数誤差だけを許容する。
  const comparePath=(a,b)=>{const numbers=text=>text.match(/-?\d+(?:\.\d+)?/g).map(Number);assert.equal(a.replace(/-?\d+(?:\.\d+)?/g,'#'),b.replace(/-?\d+(?:\.\d+)?/g,'#'));numbers(a).forEach((value,index)=>assert.ok(Math.abs(value-numbers(b)[index])<1e-8));};
  comparePath(actual.path,paths[0].attributes.d);
  if(arrow)comparePath(actual.arrow,paths[1].attributes.d);
}
console.log(`Legacy charts passed (WBS ${cases} cases; relation 4 cases).`);
