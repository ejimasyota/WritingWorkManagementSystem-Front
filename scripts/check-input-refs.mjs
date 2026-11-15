import assert from 'node:assert/strict';
import { createRenderer, defineComponent, h, nextTick, reactive, ref } from 'vue';
import { modules } from './test-support.mjs';
const names = ['TextFieldComponent','SelectBoxComponent','TextAreaComponent','ButtonComponent','CheckBoxComponent','RadioButtonComponent','ToogleComponent','FieldFrame','EntryTableEditor','ImageListEditor','RelatedItemsEditor','WorkCreateDialog','ExportSettingsDialog','DialogSectionNavigation','TableComponent'];
const entries = Object.fromEntries(names.map(name=>[name,'app/components/'+name+'.vue']));
Object.assign(entries, { CommonInfo:'app/components/work/CommonInfo.vue', StoryCreation:'app/components/work/StoryCreation.vue', PlotCreation:'app/components/work/PlotCreation.vue', ExchangeSetting:'app/components/work/ExchangeSetting.vue', MoveSetting:'app/components/work/MoveSetting.vue',SerifSetting:'app/components/work/SerifSetting.vue', CharacterList:'app/components/work/character/CharacterList.vue', TimelineSetting:'app/components/work/TimelineSetting.vue', Wbs:'app/components/work/Wbs.vue', KeywordSearch:'app/components/work/KeywordSearch.vue', WorkPage:'app/pages/work/index.vue' });
const components = {...await modules(entries,{stubLayout:true}), ...await modules({UtilLayout:'app/layouts/UtilLayout.vue'})};
const states = new Map();
globalThis.useState = (key,initial) => { if(!states.has(key))states.set(key,ref(initial()));return states.get(key); };
const dialogs = { confirm:async()=>true,info:async()=>true,error:async()=>true,cancelAll(){} };
const auth = { user:ref({UserId:'user',IsAdmin:false}),identityVersion:ref(0),workAccessVersion:ref(0),notice:ref(null),checkSession:async()=>true };
globalThis.useAuthSession=()=>auth;
globalThis.usePageDialogs=()=>dialogs;
globalThis.useRuntimeConfig=()=>({public:{apiBase:'/Back/Api'}});
globalThis.definePageMeta=()=>{};globalThis.useHead=()=>{};
globalThis.useNuxtApp=()=>({$authSession:auth,runWithContext:fn=>fn()});
const route=reactive({query:{}});globalThis.useRoute=()=>route;
globalThis.navigateTo=async target=>Object.assign(route,{query:target.query||{}});
const classes=new Set();
globalThis.document={body:{classList:{contains:name=>classes.has(name),toggle:(name,on)=>on?classes.add(name):classes.delete(name),remove:(...names)=>names.forEach(name=>classes.delete(name))}}};
globalThis.window={addEventListener(){},removeEventListener(){},scrollTo(){}};
globalThis.localStorage={getItem:()=>null,setItem(){}};
globalThis.HTMLElement=class {};
function node(tag,text=''){return {tag,text,props:{},children:[],parent:null,style:{},focus(){},setAttribute(){},getBoundingClientRect:()=>({left:0,top:0,width:100,height:80})};}
const renderer=createRenderer({
  createElement:tag=>node(tag),createText:text=>node('#text',text),createComment:text=>node('#comment',text),
  setText:(el,text)=>el.text=text,setElementText:(el,text)=>{el.text=text;el.children=[];},patchProp:(el,key,prev,next)=>el.props[key]=next,
  insert(el,parent,anchor){if(el.parent)el.parent.children.splice(el.parent.children.indexOf(el),1);const index=anchor?parent.children.indexOf(anchor):-1;parent.children.splice(index<0?parent.children.length:index,0,el);el.parent=parent;},
  remove(el){if(el.parent)el.parent.children.splice(el.parent.children.indexOf(el),1);el.parent=null;},parentNode:el=>el.parent,nextSibling:el=>el.parent?.children[el.parent.children.indexOf(el)+1]||null,
  insertStaticContent(text,parent){const el=node('#static',text);el.parent=parent;parent.children.push(el);return [el,el];}
});
const Empty=defineComponent({setup:()=>()=>null});
const Dialog=defineComponent({props:['modelValue'],setup:(props,ctx)=>()=>props.modelValue?h('dialog',[ctx.slots.default?.(),ctx.slots.actions?.()]):null});
const Table=defineComponent({name:'TableComponent',props:['rows','columns','rowKey','pageSize'],setup:(props,ctx)=>()=>h('table',props.rows?.flatMap(row=>Object.entries(ctx.slots).filter(([name])=>name.startsWith('cell-')).map(([name,slot])=>slot({row,value:row[name.slice(5)]}))))});
function mount(name,props={},events={}) {
  const state=reactive(props);const host=node('host');let root;
  const app=renderer.createApp(defineComponent({setup:()=>()=>h(components[name],{...state,...events})}));
  for(const [key,value] of Object.entries(components))if(key!=='TableComponent')app.component(key,value);
  for(const key of ['DatePickerDialog','InfoIconComponent','ImageDialog','WorkContentHeader','TimelineChart','SettingsDialog','NotificationDialog','PageDialogHost','AnchoredDropdown'])app.component(key,Empty);
  app.component('BaseDialog',Dialog);app.component('TableComponent',Table);
  app.config.warnHandler=message=>{throw Error(message);};
  root=app.mount(host);
  function all(){const list=[];function visit(v){if(!v)return;if(v.component){list.push(v.component);visit(v.component.subTree);}else if(Array.isArray(v.children))v.children.forEach(visit);}visit(app._instance.subTree);return list;}
  function find(name,predicate=()=>true){const value=all().find(item=>(item.type.__name===name||item.type.name===name)&&predicate(item.props));assert.ok(value,'部品: '+name);return value;}
  function nodes(el=host){return [el,...el.children.flatMap(child=>nodes(child))];}
  return {state,all,find,nodes,field:label=>find('TextFieldComponent',props=>props.label===label),buttons:variant=>all().filter(item=>item.type.__name==='ButtonComponent'&&item.props.variant===variant),close:()=>app.unmount()};
}
async function settle(){for(let i=0;i<30;i++){await Promise.resolve();await nextTick();}}
const set=(instance,value)=>instance.exposed.setValue(value);
const get=instance=>instance.exposed.getValue();
async function click(instance){assert.ok(instance,'ボタン');instance.emit('click',{stopPropagation(){},preventDefault(){}});await settle();}
const ok=Data=>({Success:true,Data});
function requestFor(extra,writes=[]) {return async(url,method,payload)=>{
  if(url==='/GetWorkInfo.php')return ok({WorkId:'work',WorkTitle:'作品',Genre:3,UpdateDate:'work-v1',SettingDate:''});
  if(url==='/GetUserPermission.php')return ok({IsCreator:true});
  if(Object.hasOwn(extra,url))return ok(extra[url]);
  writes.push({url,payload});return ok({});
};}

// 作品作成と共通情報は、利用者が選んだジャンルを公開ref経由で送信する。
{
  let payload;const view=mount('WorkCreateDialog',{modelValue:false},{onCreate:value=>payload=value});
  view.state.modelValue=true;await settle();
  set(view.field('作品名'),'新しい作品');set(view.find('SelectBoxComponent'),7);
  await click(view.buttons('SaveButton')[0]);assert.deepEqual(payload,{WorkTitle:'新しい作品',Genre:7});view.close();
}
{
  const writes=[];const request=requestFor({},writes);let failed=true;
  const view=mount('CommonInfo',{request:async(...args)=>args[0]==='/UpdateWorkInfo.php'&&failed?(writes.push({url:args[0],payload:args[2]}),{Success:false,Message:'競合'}):request(...args),dialogs,isAdmin:false});
  await settle();assert.equal(view.all().filter(item=>item.type.__name==='SelectBoxComponent'&&item.props.label==='ジャンル').length,1);
  const genre=view.find('SelectBoxComponent',props=>props.label==='ジャンル');assert.equal(get(genre),3);assert.ok(genre.props.options.length>1);set(genre,7);
  set(view.field('作品名'),'更新作品');view.nodes().find(el=>el.tag==='form').props.onSubmit({preventDefault(){}});await settle();
  assert.equal(writes[0].payload.Genre,7);assert.equal(writes[0].payload.UpdateDate,'work-v1');assert.equal(get(view.field('作品名')),'更新作品');assert.equal(get(genre),7);
  failed=false;view.close();
}

// タグマスタへの移動は未保存入力を退避し、戻ったときに最新マスタで復元する。
{
  let tagName='旧タグ';const navigation=[];
  const request=async url=>{
    if(url==='/GetWorkInfo.php')return ok({WorkId:'tag-work',WorkTitle:'作品',SettingDate:'',UpdateDate:'work-v1'});
    if(url==='/GetUserPermission.php')return ok({IsCreator:true});
    if(url==='/GetCharacterList.php')return ok([]);
    const match=url.match(/^\/Get(.+)List.php$/);assert.ok(match,url);
    return ok({[match[1]+'List']:match[1]==='Tag'?[{TagId:'tag1',TagName:tagName,TagColor:'#123456'}]:[]});
  };
  let view=mount('CharacterList',{request,dialogs,isAdmin:false},{onNavigate:menu=>navigation.push(menu)});await settle();await click(view.buttons('SuccessButton')[0]);
  set(view.field('キャラ名'),'未保存キャラ');set(view.find('EntryTableEditor',p=>p.definition.key==='Likes'),[{Content:'読書',Reason:'落ち着く'}]);
  set(view.find('ImageListEditor'),[{Path:'saved.png',Data:null,Size:0,Caption:'保持'}]);set(view.find('TagEditor'),[{TagId:'tag1',TagName:tagName,TagColor:'#123456'}]);
  view.find('TagEditor').emit('manage');await settle();assert.deepEqual(navigation,['MenuTag']);view.close();
  tagName='新タグ';view=mount('CharacterList',{request,dialogs,isAdmin:false});await settle();
  assert.equal(get(view.field('キャラ名')),'未保存キャラ');assert.equal(get(view.find('TagEditor'))[0].TagName,'新タグ');assert.equal(get(view.find('ImageListEditor'))[0].Caption,'保持');
  assert.equal(get(view.find('EntryTableEditor',p=>p.definition.key==='Likes'))[0].Reason,'落ち着く');assert.equal(states.get('CharacterTagReturn').value,null);view.close();
}

// ページから対象IDを伝え、同一メニューの別行への移動でも対象行を開き直す。
{
  auth.request=requestFor({'/GetTermList.php':{TermList:[{TermId:9,TermName:'一件目',Description:'説明',UpdateDate:'v1'},{TermId:10,TermName:'二件目',UpdateDate:'v2'}]},'/GetNotificationSummary.php':{TotalCnt:0}});
  route.query={menu:'MenuTerm',row:'9',parent:'5'};const view=mount('WorkPage');await settle();assert.equal(get(view.field('用語名')),'一件目');
  const first=view.find('TermSetting');assert.equal(first.props.targetParentId,'5');
  route.query={menu:'MenuTerm',row:'10'};await settle();assert.equal(get(view.field('用語名')),'二件目');assert.notEqual(view.find('TermSetting'),first);view.close();
}

// 年表詳細の反映・削除はローカルだけを変更し、本体保存で一括送信する。
{
  const writes=[];
  const request=requestFor({'/GetTimelineList.php':{TimelineList:[{TimeId:1,Title:'親',EventDate:'2000年',EndDate:'2001年',Content:'親内容',UpdateDate:'parent-v1'}],CalendarList:[]},'/GetTimelineEventList.php':{TimelineEventList:[{TimeEventId:2,TimeId:1,Title:'詳細',StartDate:'2000年',Content:'詳細内容',UpdateDate:'child-v1',CharaInfo:[],StageInfo:[],BuildInfo:[]}],CharacterList:[],StageList:[],BuildList:[]}},writes);
  const view=mount('TimelineSetting',{request,dialogs,isAdmin:false});await settle();await click(view.buttons('PrimaryButton ButtonSmall')[0]);
  const table=()=>view.find('TableComponent',p=>p.rowKey==='localKey');assert.equal(table().props.pageSize,5);assert.equal(table().props.rows.length,1);
  await click(view.buttons('PrimaryButton ButtonSmall').at(-1));set(view.all().filter(i=>i.type.__name==='TextFieldComponent'&&i.props.label==='内容').at(-1),'詳細変更');
  await click(view.buttons('SaveButton').at(-1));assert.equal(writes.length,0);assert.equal(table().props.rows[0].Content,'詳細変更');
  await click(view.buttons('SaveButton')[0]);assert.equal(writes.length,1);assert.equal(writes[0].url,'/SaveTimeline.php');assert.equal(writes[0].payload.Details[0].Content,'詳細変更');assert.deepEqual(writes[0].payload.DetailsSnapshot,[{TimeEventId:2,UpdateDate:'child-v1'}]);view.close();
}
// 前回修正した検索アコーディオンと担当者ラベルも統合後のソースで確認する。
{
  const request=requestFor({'/GetSearchScreens.php':[{MenuId:'MenuTerm',ScreenName:'作中用語'}]});
  const view=mount('KeywordSearch',{request,dialogs,isAdmin:false});await settle();
  const header=()=>view.nodes().find(el=>el.props.class==='AccordionHeader');
  assert.equal(header().tag,'div');assert.equal(header().props['aria-expanded'],true);
  header().props.onClick();await settle();assert.equal(header().props['aria-expanded'],false);
  for(const handler of [header().props.onKeydown].flat())handler({key:'Enter',preventDefault(){}});
  await settle();assert.equal(header().props['aria-expanded'],true);view.close();
}
{
  const folder={WbsId:1,WbsName:'制作',StartDate:'2026-01-01',EndDate:'2026-12-31',UpdateDate:'folder-v1'};
  const task={TaskId:2,TaskName:'執筆',StartDate:'2026-01-01',EndDate:'2026-02-01',Progress:10,AssigneeIds:['user'],UpdateDate:'task-v1'};
  const view=mount('Wbs',{request:requestFor({'/GetWbsTaskList.php':{WbsList:[folder],SelectedWbs:folder,TaskList:[task],AssigneeList:[{UserId:'user'}],ParentList:[],CanEdit:true,LoginUserId:'user'}}),dialogs,isAdmin:false});
  await settle();view.find('TableComponent').emit('row-click',task);await settle();
  assert.equal(view.all().filter(item=>item.type.__name==='FieldFrame'&&item.props.label==='担当者').length,1);
  assert.equal(view.find('RelatedItemsEditor',props=>props.label==='担当者').props.required,true);view.close();
}
// 行は子ダイアログで入力し、旧カードへ反映。番号指定・ドラッグも保存前のローカル操作。
for(const [kind,label] of [['Story','ストーリー'],['Plot','プロット'],['Exchange','掛け合い']]) {
  const writes=[];const parent={[kind+'Id']:1,[kind+'Name']:'登録済み',Description:'概要',ProductionType:1,UpdateDate:'parent-v1'};
  const child={[kind+'RowId']:2,Content:'保存済みの行',StructureType:1,UpdateDate:'child-v1'};
  const api=requestFor({});let fail=false;
  const request=async(url,method,payload)=>{
    if(url.startsWith('/Get'+kind+'List.php'))return ok({PlotList:[],[kind+'List']:[parent],['Selected'+kind]:url.includes('?')?parent:null,[kind+'RowList']:url.includes('?')?[child]:[],CharacterList:[],SerifList:[],TemplateRows:[{IndexNum:1,StructureType:1,Content:'雛形'}]});
    if(url.startsWith('/Save')){writes.push({url,payload});return fail?{Success:false,Message:'競合'}:ok({});}
    return api(url,method,payload);
  };
  const view=mount(kind==='Exchange'?'ExchangeSetting':kind+'Creation',{request,dialogs,isAdmin:false});await settle();
  const cards=()=>view.nodes().filter(el=>el.tag==='div'&&String(el.props.class).split(/\s+/).includes('StoryItem'));
  const text=el=>el.text+el.children.map(text).join('');
  const editCard=async(index)=>{cards()[index].props.onClick();await settle();};
  const commit=()=>click(view.buttons('SaveButton').at(-1));
  const add=()=>click(view.buttons('PrimaryButton ButtonSmall').at(-1));
  if(kind!=='Exchange')assert.ok(!view.find('TableComponent').props.columns.some(column=>column.key==='Description'));
  await click(view.buttons('SuccessButton')[0]);set(view.field(label+'名'),'新規'+label);
  assert.equal(cards().length,0);await add();assert.equal(cards().length,0,'追加時点では一覧を変更しない');
  if(kind==='Plot'){const structure=view.find('SelectBoxComponent',p=>p.label==='起承転結');set(structure,'1');structure.emit('value-change');await settle();}
  else {const action=view.find('ToogleComponent',p=>p.label==='動詞を入力する');assert.equal(get(action),false);set(action,true);action.emit('value-change');await settle();}
  set(view.find('TextAreaComponent',p=>p.label==='内容'),'最初の行');set(view.field('並び順'),'1');await commit();assert.equal(cards().length,1);
  assert.deepEqual(view.nodes().filter(el=>el.tag==='h3'&&el.props.class==='FormSectionTitle').map(text),['基本',label+'行'],'行ごとの見出しをパンくずに入れない');
  await add();if(kind==='Plot'){const structure=view.find('SelectBoxComponent',p=>p.label==='起承転結');set(structure,'1');structure.emit('value-change');await settle();}
  set(view.find('TextAreaComponent',p=>p.label==='内容'),'二番目の行');set(view.field('並び順'),'2');await commit();assert.equal(cards().length,2);
  const handle=view.nodes(cards()[0]).find(el=>el.tag==='button'&&el.props.class==='StoryDragHandle');
  handle.props.onDragstart({dataTransfer:{setData(){}},preventDefault(){}});await settle();cards()[1].props.onDrop({preventDefault(){}});await settle();
  assert.ok(text(cards()[0]).includes('二番目の行'),'ドラッグで順序を変更');
  await editCard(1);set(view.field('並び順'),'1');await commit();assert.ok(text(cards()[0]).includes('最初の行'),'番号で順序を変更');
  await editCard(0);set(view.find('TextAreaComponent',p=>p.label==='内容'),'破棄する編集');await click(view.buttons('CloseButton').at(-1));assert.ok(text(cards()[0]).includes('最初の行'),'閉じた編集は反映しない');
  assert.equal(writes.length,0,'保存前にDBへ書き込まない');
  fail=true;await click(view.buttons('SaveButton')[0]);assert.equal(writes[0].payload.Mode,'bundle');assert.equal(writes[0].payload.Rows.length,2);assert.deepEqual(writes[0].payload.RowsSnapshot,[]);
  if(kind!=='Plot')assert.equal(writes[0].payload.Rows[0].ActionLine,true);
  assert.equal(new Set(writes[0].payload.Rows.map(row=>row.localKey)).size,2,'既存行を編集した後もキーを重複させない');
  assert.equal(get(view.field(label+'名')),'新規'+label,'保存失敗時は入力を保持');
  fail=false;await click(view.buttons('SaveButton')[0]);
  await click(view.buttons('PrimaryButton ButtonSmall')[0]);await editCard(0);
  set(view.find('TextAreaComponent',p=>p.label==='内容'),'行変更');await commit();await click(view.buttons('SaveButton')[0]);
  assert.equal(writes.at(-1).payload.UpdateDate,'parent-v1');assert.equal(writes.at(-1).payload.Rows[0].UpdateDate,'child-v1');assert.deepEqual(writes.at(-1).payload.RowsSnapshot,[{[kind+'RowId']:2,UpdateDate:'child-v1'}]);view.close();
  const searchView=mount(kind==='Exchange'?'ExchangeSetting':kind+'Creation',{request,dialogs,isAdmin:false,targetId:'2',targetParentId:'1'});await settle();await settle();assert.equal(get(searchView.find('TextAreaComponent',p=>p.label==='内容')),'保存済みの行');searchView.close();
}
// マスタセリフにも独白区分を保存し、次に開いたときに復元する。
{
 const writes=[];const row={SerifId:1,Content:'セリフ',Monologue:true,UpdateDate:'serif-v1'};
 const view=mount('SerifSetting',{request:requestFor({'/GetSerifList.php':{SerifList:[row],CharacterList:[]}},writes),dialogs,isAdmin:false});await settle();await click(view.buttons('PrimaryButton ButtonSmall')[0]);
 const monologue=view.find('CheckBoxComponent',p=>p.label==='モノローグ');assert.equal(get(monologue),true);set(monologue,false);await click(view.buttons('SaveButton')[0]);assert.equal(writes[0].payload.Monologue,false);assert.equal(writes[0].payload.UpdateDate,'serif-v1');view.close();
}
// リサイズした幅は見出しと本文セルの両方へ反映する。本文に200pxの上限を持たせない。
{
 const view=mount('TableComponent',{rows:[{id:1,UpdateDate:'2026年11月15日（日）12時00分00秒'}],columns:[{key:'UpdateDate',label:'更新年月日',width:310}]});await settle();
 const th=view.nodes().find(el=>el.tag==='th'),td=view.nodes().find(el=>el.tag==='td');assert.equal(th.props.style.width,'310px');assert.equal(td.props.style.width,'310px');
 const resizer=view.nodes().find(el=>String(el.props.class).includes('ColumnResizer'));
 const events={};const handle={parentElement:{getBoundingClientRect:()=>({width:310})},setPointerCapture(){},classList:{add(){},remove(){}},addEventListener:(key,handler)=>events[key]=handler,removeEventListener(){}};
 resizer.props.onPointerdown({currentTarget:handle,clientX:0,pointerId:1,stopPropagation(){},preventDefault(){}});events.pointermove({clientX:200});await settle();assert.equal(th.props.style.width,'510px');assert.equal(td.props.style.width,'510px');events.pointermove({clientX:-1000});await settle();assert.equal(th.props.style.width,'64px');assert.equal(td.props.style.width,'64px');view.close();
}
// 見出し文字と両方のアイコンを実測し、拡大後でも文字幅を基準に縮められる。
{
 const view=mount('TableComponent',{rows:[{id:1,name:'値'}],columns:[{key:'name',label:'項目名',width:310,sortable:true,filterable:true}]});await settle();
 const events={};
 const label={scrollWidth:240,getBoundingClientRect:()=>({width:240}),classList:{contains:()=>true}};
 const icon=width=>({scrollWidth:width,getBoundingClientRect:()=>({width}),classList:{contains:()=>false}});
 const content={children:[label,icon(16),icon(28)]};
 const header={querySelector:()=>content,getBoundingClientRect:()=>({width:310})};
 const handle={parentElement:header,setPointerCapture(){},classList:{add(){},remove(){}},addEventListener:(key,handler)=>events[key]=handler,removeEventListener(){}};
 window.getComputedStyle=element=>({paddingLeft:'12px',paddingRight:'12px',columnGap:element===content?'8px':'0px',marginLeft:'0px',marginRight:'0px'});
 document.createRange=()=>({selectNodeContents(){},getBoundingClientRect:()=>({width:48})});
 try {
  const resizer=view.nodes().find(el=>String(el.props.class).includes('ColumnResizer'));
  resizer.props.onPointerdown({currentTarget:handle,clientX:0,pointerId:1,stopPropagation(){},preventDefault(){}});
  events.pointermove({clientX:-1000});await settle();
  const th=view.nodes().find(el=>el.tag==='th'),td=view.nodes().find(el=>el.tag==='td');
  assert.equal(th.props.style.width,'140px');assert.equal(td.props.style.width,'140px');
  events.pointermove({clientX:100});await settle();assert.equal(th.props.style.width,'410px');
 } finally {delete window.getComputedStyle;delete document.createRange;view.close();}
}
// 出力帳票ごとに、チェックボックスとリスト選択を切り替える。
{
 let payload;
 const view=mount('ExportSettingsDialog',{modelValue:false,workId:'work',request:requestFor({'/GetNarrativeExportOptions.php?WorkId=work':{StoryList:[{StoryId:1,StoryName:'本文'}],PlotList:[{PlotId:2,PlotName:'構成'}]}}),dialogs},{onExport:value=>payload=value});
 view.state.modelValue=true;await settle();
 const report=view.find('SelectBoxComponent',p=>p.options.some(option=>option.value==='Document'));
 set(report,'Story');report.emit('value-change');await settle();
 assert.equal(view.all().filter(i=>i.type.__name==='CheckBoxComponent').length,2);
 const story=view.find('SelectBoxComponent',p=>p.label==='ストーリー');assert.equal(story.props.hideListButton,false);set(story,'1');await click(view.buttons('SuccessButton')[0]);assert.equal(payload.ReportType,'Story');assert.equal(payload.StoryId,'1');
 set(report,'Plot');report.emit('value-change');await settle();const plot=view.find('SelectBoxComponent',p=>p.label==='プロット');assert.equal(plot.props.hideListButton,false);set(plot,'2');await click(view.buttons('SuccessButton')[0]);assert.equal(payload.PlotId,'2');
 view.close();
}
// 読み取り専用の選択値は非活性selectではなく、コピー可能なreadonly入力で表示する。
{
 const view=mount('SelectBoxComponent',{readonly:true,label:'性別',options:[{value:'1',label:'男性'}]});
 const instance=view.find('SelectBoxComponent');set(instance,'1');await settle();
 const input=view.nodes().find(el=>el.tag==='input');assert.ok(input.props.readonly!==undefined);assert.equal(input.props.value,'男性');assert.ok(!view.nodes().some(el=>el.tag==='select'));view.close();
}
// 能力詳細は同じ能力設定ダイアログを読み取り専用で開く。
{
 const power={PowerId:1,PowerName:'能力',Description:'説明',Conditions:'条件',Risk:'代償',UpdateDate:'power-v1'};
 const move={MoveId:2,MoveName:'技',PowerId:1,UpdateDate:'move-v1'};
 const request=requestFor({'/GetMoveList.php':{MoveList:[move],PowerList:[power]},'/GetPowerList.php':{PowerList:[power]}});
 const view=mount('MoveSetting',{request,dialogs,isAdmin:false});await settle();await click(view.buttons('PrimaryButton ButtonSmall')[0]);
 await click(view.buttons('SecondaryButton')[0]);
 assert.equal(view.find('PowerSetting').props.readonly,true);assert.equal(view.field('能力名').props.readonly,true);
 assert.equal(view.all().filter(item=>item.type.__name==='EntryTableEditor'&&item.props.readonly).length,2);
 view.close();
}
// セクション移動は対象本文だけをスクロールする。
{
 let moved;let focused=false;
 const heading={textContent:'明細',getBoundingClientRect:()=>({top:150}),setAttribute(){},focus(){focused=true;}};
 const target={querySelectorAll:()=>[heading],getBoundingClientRect:()=>({top:50}),scrollTop:20,scrollTo:options=>moved=options};
 const view=mount('DialogSectionNavigation',{target});await settle();view.nodes().find(el=>el.tag==='button').props.onClick();await settle();assert.equal(moved.top,120);assert.equal(focused,true);view.close();
}
assert.equal(states.get('BackendOperations').value,0,'画面を閉じた後にスピナーを残さない');

// サイドバーの分類・順序と管理者権限を、実際の共通レイアウトで確認する。
{
 const groups = view => view.nodes().filter(el=>el.tag==='section' && el.props.class==='SidebarGroup').map(section=>({
   label:section.children.find(el=>el.tag==='h2').text,
   ids:section.children.filter(el=>el.tag==='button').map(el=>el.props.id)
 }));
 let view=mount('UtilLayout',{menuType:'main',session:{IsAdmin:false}});await settle();
 assert.deepEqual(groups(view).map(group=>group.label),['管理','システム']);
 assert.deepEqual(groups(view).flatMap(group=>group.ids),['MenuWorkManagement','MenuSystemNotificationList']);view.close();
 view=mount('UtilLayout',{menuType:'main',session:{IsAdmin:true}});await settle();
 assert.deepEqual(groups(view).map(group=>group.label),['管理','システム','ユーザー管理','マスタ管理']);
 assert.equal(groups(view)[0].ids.length,3);assert.equal(groups(view)[2].ids.length,2);assert.equal(groups(view)[3].ids.length,2);view.close();
 view=mount('UtilLayout',{menuType:'work'});await settle();
 assert.deepEqual(groups(view).map(group=>group.label),['設定管理','執筆管理','制作管理']);
 assert.deepEqual(groups(view).map(group=>group.ids.length),[18,8,5]);
 const ids=groups(view).flatMap(group=>group.ids);assert.equal(new Set(ids).size,31);view.close();
}
console.log('Input ref regressions passed (genre, tag return, search, timeline, row dialogs/numbering/drag/cancel, narrative bundle/conflicts, serif monologue, column resizing, exports, readonly details, section navigation).');
