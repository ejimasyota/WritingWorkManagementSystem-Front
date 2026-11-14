import assert from 'node:assert/strict';
import { createRenderer, defineComponent, h, nextTick, reactive, ref } from 'vue';
import { modules } from './test-support.mjs';
const names = ['TextFieldComponent','SelectBoxComponent','TextAreaComponent','ButtonComponent','CheckBoxComponent','RadioButtonComponent','ToogleComponent','FieldFrame','EntryTableEditor','ImageListEditor','RelatedItemsEditor','WorkCreateDialog'];
const entries = Object.fromEntries(names.map(name=>[name,'app/components/'+name+'.vue']));
Object.assign(entries, { CommonInfo:'app/components/work/CommonInfo.vue', CharacterList:'app/components/work/character/CharacterList.vue', TimelineSetting:'app/components/work/TimelineSetting.vue', Wbs:'app/components/work/Wbs.vue', KeywordSearch:'app/components/work/KeywordSearch.vue', WorkPage:'app/pages/work/index.vue' });
const components = await modules(entries,{stubLayout:true});
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
  for(const [key,value] of Object.entries(components))app.component(key,value);
  for(const key of ['DatePickerDialog','InfoIconComponent','ImageDialog','WorkContentHeader','TimelineChart','SettingsDialog','NotificationDialog','PageDialogHost'])app.component(key,Empty);
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
assert.equal(states.get('BackendOperations').value,0,'画面を閉じた後にスピナーを残さない');
console.log('Input ref regressions passed (genre save, conflict retention, tag return, search target navigation, atomic timeline payload).');
