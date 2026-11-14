import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { parse as parseVue } from '@vue/compiler-sfc';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { files, root, backRoot, read, modules } from './test-support.mjs';
const failures = [];let count = 0;
for (const file of files(path.join(root, 'app')).filter(file => /\.(ts|vue)$/.test(file))) {
  let source = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.vue')) { const d = parseVue(source).descriptor; source = d.scriptSetup?.content || d.script?.content || ''; }
  traverseModule.default(parse(source, { sourceType:'module', plugins:['typescript'] }), { CallExpression(p) {
    const [endpoint, method] = p.node.arguments;
    if (endpoint?.type !== 'StringLiteral' || !/^\/[\w]+\.php(?:\?|$)/.test(endpoint.value)) return;
    const target = path.join(backRoot, 'Api', endpoint.value.slice(1).split('?')[0]);
    if (!fs.existsSync(target)) { failures.push(path.relative(root,file) + ': APIがありません ' + endpoint.value); return; }
    if (method && method.type !== 'StringLiteral') return;
    const expected = fs.readFileSync(target, 'utf8').match(/\$_SERVER\['REQUEST_METHOD'\]\s*!==\s*'(GET|POST)'/)?.[1];
    const actual = method?.value || 'GET';
    if (expected && actual !== expected) failures.push(`${path.relative(root,file)}: ${endpoint.value} ${actual} / PHP ${expected}`);
    count++;
  } });
}
const { navigation } = await modules({ navigation:'app/utils/workNavigation.ts' });
const screens = JSON.parse(fs.readFileSync(path.join(backRoot,'Config/Screens.json'),'utf8')).Screens;
const page = read('app/pages/work/index.vue');
for (const screen of screens) {
  assert.equal(navigation.resolveWorkMenu(screen.MenuId), screen.MenuId);
  assert.match(page, new RegExp('\\b' + screen.MenuId + ':'));
}
assert.deepEqual(failures, []);
console.log(`API contracts passed (${count} literal calls; ${screens.length} search destinations).`);
