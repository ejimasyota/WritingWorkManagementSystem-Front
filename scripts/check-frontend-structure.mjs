import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';
import { parse as parseScript } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { root, files, read, modules } from './test-support.mjs';
const traverse = traverseModule.default;
const globals = new Set(('window document navigator localStorage sessionStorage FileReader File Blob FormData URL URLSearchParams fetch AbortController HTMLElement HTMLInputElement HTMLSelectElement HTMLTextAreaElement KeyboardEvent PointerEvent MouseEvent Event EventTarget ResizeObserver requestAnimationFrame cancelAnimationFrame atob btoa defineProps defineEmits defineExpose defineOptions withDefaults definePageMeta defineNuxtConfig defineNuxtPlugin defineNuxtRouteMiddleware abortNavigation useState useHead useRoute useRouter useNuxtApp useRuntimeConfig useAuthSession usePageDialogs useBackendBusy navigateTo $fetch XMLSerializer Image').split(' '));
const failures = [];
const vueFiles = files(path.join(root, 'app')).filter(file => file.endsWith('.vue'));
for (const file of files(path.join(root, 'app')).filter(file => /\.(vue|ts)$/.test(file))) {
  const source = fs.readFileSync(file, 'utf8');
  const label = path.relative(root, file);
  if (/^(?:<<<<<<< |=======$|>>>>>>> )/m.test(source)) failures.push(label + ': コンフリクトマーカー');
  let code = source;
  if (file.endsWith('.vue')) {
    const { descriptor, errors } = parse(source, { filename: file });
    failures.push(...errors.map(error => label + ': ' + error));
    code = descriptor.scriptSetup?.content || descriptor.script?.content || '';
    const script = compileScript(descriptor, { id: label });
    const out = compileTemplate({ source: descriptor.template?.content || '', filename: file, id: label, compilerOptions: { bindingMetadata: script.bindings } });
    failures.push(...out.errors.map(error => label + ': ' + error));
    // 共通propsのspreadはcompilerのbinding一覧に展開されないため、共通宣言を加味する。
    const common = code.includes('...fieldProps') ? ['inline','label','required','infoIconFlg','infoTitle','infoMessage','error','hint','disabled','readonly'] : [];
    if (code.includes('...messageDialogProps')) common.push('modelValue','textAlign','message','imageSrc');
    for (const name of new Set([...out.code.matchAll(/_ctx\.([\w$]+)/g)].map(match => match[1])))
      if (!name.startsWith('$') && !common.includes(name)) failures.push(label + ': 未定義のテンプレート参照 ' + name);
    function check(node) {
      if (node.type === 1 && /^(TextField|TextArea|SelectBox|CheckBox|RadioButton|Toogle)Component$/.test(node.tag))
        if (node.props.some(prop => prop.type === 7 && prop.name === 'model')) failures.push(label + ': 入力部品のv-model ' + node.tag);
      node.children?.forEach(check);
    }
    check(descriptor.template?.ast || {});
  }
  const ast = parseScript(code, { sourceType: 'module', plugins: ['typescript'] });
  traverse(ast, {
    ReferencedIdentifier(p) {
      if (p.findParent(parent => parent.isTSType() || parent.isTSInterfaceDeclaration() || parent.isTSTypeAliasDeclaration())) return;
      const name = p.node.name;
      if (!p.scope.hasBinding(name) && !globals.has(name) && !Object.hasOwn(globalThis, name)) failures.push(label + ': 未定義の処理参照 ' + name);
    },
    ImportDeclaration(p) {
      const specifier = p.node.source.value;
      if (!specifier.startsWith('.') && !specifier.startsWith('~/')) return;
      const target = specifier.startsWith('~/') ? path.join(root, 'app', specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
      if (![target, target + '.ts', target + '.vue', target + '/index.ts'].some(fs.existsSync)) failures.push(label + ': 参照先なし ' + specifier);
    }
  });
}
const { messageModule } = await modules({messageModule:'app/utils/messages.ts'});
for (const file of files(path.join(root,'app')).filter(file => /\.(vue|ts)$/.test(file))) {
  const source = fs.readFileSync(file,'utf8');
  for (const match of source.matchAll(/messageFormat\(\s*['"](INFO|ERROR|CONFIRM)['"]\s*,\s*['"]([^'"]+)['"]/g))
    if (!messageModule.messages[match[1]]?.[match[2]]) failures.push(path.relative(root,file) + ': メッセージ未定義 ' + match[1] + '.' + match[2]);
}
const pkg = JSON.parse(read('package.json'));
for (const command of Object.values(pkg.scripts)) {
  const script = command.match(/^node (scripts\/\S+)/)?.[1];
  if (script && !fs.existsSync(path.join(root, script))) failures.push('検証スクリプトがありません: ' + script);
}
assert.deepEqual([...new Set(failures)], []);
console.log(`Frontend structure passed (${vueFiles.length} Vue files; imports, bindings, input refs, package scripts).`);
