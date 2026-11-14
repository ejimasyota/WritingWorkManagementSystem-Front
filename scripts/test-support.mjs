import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { parse, compileScript } from '@vue/compiler-sfc';
import { parse as parseScript } from '@babel/parser';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const oldRoot = path.resolve(root, '../WritingWorkManagementSystem-Document/99_その他/旧フロント資源/Front/Js');
export const backRoot = path.resolve(root, '../WritingWorkManagementSystem-Back');
export const read = file => fs.readFileSync(path.resolve(root, file), 'utf8');
export function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
export function functions(source, names, typescript = false) {
  const ast = parseScript(source, { sourceType: 'module', plugins: typescript ? ['typescript'] : [] });
  const found = new Map();
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionDeclaration' && names.includes(node.id?.name)) found.set(node.id.name, source.slice(node.start, node.end));
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
  }
  visit(ast);
  for (const name of names) if (!found.has(name)) throw Error('関数がありません: ' + name);
  return names.map(name => found.get(name)).join('\n');
}

/** 実装をテスト用に複写せず、実際のVue/TSをコンパイルして読み込む。 */
export async function modules(entries, { stubLayout = false } = {}) {
  const cache = path.join(root, 'node_modules/.cache');
  fs.mkdirSync(cache, { recursive: true });
  const dir = fs.mkdtempSync(path.join(cache, 'source-check-'));
  const outfile = path.join(dir, 'test.mjs');
  try {
    const contents = Object.entries(entries).map(([name, file]) => file.endsWith('.vue')
      ? `export {default as ${name}} from ${JSON.stringify(path.resolve(root, file))};`
      : `export * as ${name} from ${JSON.stringify(path.resolve(root, file))};`).join('\n');
    await build({ stdin: { contents, resolveDir: root, loader: 'ts' }, outfile, bundle: true, format: 'esm', platform: 'node', external: ['vue'], logLevel: 'silent',
      define: { 'import.meta.client': 'true', 'import.meta.server': 'false' },
      plugins: [{ name: 'application-sources', setup(builder) {
        builder.onResolve({ filter: /^~\// }, args => ({ path: path.resolve(root, 'app', args.path.slice(2) + (path.extname(args.path) ? '' : '.ts')) }));
        builder.onLoad({ filter: /\.vue$/ }, args => {
          if (stubLayout && args.path.endsWith('/layouts/UtilLayout.vue')) return { contents: `import {defineComponent,h} from 'vue';export default defineComponent({setup:(_,ctx)=>()=>h('layout',ctx.slots.default?.())});`, loader: 'js' };
          const descriptor = parse(fs.readFileSync(args.path, 'utf8'), { filename: args.path }).descriptor;
          return { contents: compileScript(descriptor, { id: args.path, inlineTemplate: true }).content, loader: 'ts' };
        });
      } }] });
    return await import(pathToFileURL(outfile).href);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
