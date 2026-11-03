import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { compileScript, parse } from 'vue/compiler-sfc'
import { createRenderer } from 'vue'

/** 追加のブラウザ依存を入れず、実際のSFCをVueのレンダラーで操作する。 */
export async function loadTableComponent() {
  const filename = new URL('../../app/components/TableComponent.vue', import.meta.url)
  const source = await readFile(filename, 'utf8')
  const { descriptor } = parse(source, { filename: filename.pathname })
  const script = compileScript(descriptor, { id: 'table-regression', inlineTemplate: true })
  const code = stripTypeScriptTypes(script.content, { mode: 'strip' })
    .replace(/from (["'])vue\1/g, `from '${import.meta.resolve('vue')}'`)
    .replace(/from (["'])\.\.\/composables\/tableData\1/g, `from '${new URL('../../app/composables/tableData.ts', import.meta.url)}'`)
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  return (await import(moduleUrl)).default
}

function createNode(type, text = '') {
  return { type, text, props: {}, children: [], parent: null }
}

export function createTestRenderer() {
  const renderer = createRenderer({
    createElement: type => createNode(type),
    createText: text => createNode('#text', text),
    createComment: text => createNode('#comment', text),
    setText: (node, text) => { node.text = text },
    setElementText: (node, text) => { node.text = text; node.children = [] },
    patchProp: (node, key, previous, next) => { node.props[key] = next },
    parentNode: node => node.parent,
    nextSibling: node => {
      if (!node.parent) return null
      return node.parent.children[node.parent.children.indexOf(node) + 1] || null
    },
    insert(node, parent, anchor = null) {
      if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1)
      const index = anchor ? parent.children.indexOf(anchor) : -1
      parent.children.splice(index < 0 ? parent.children.length : index, 0, node)
      node.parent = parent
    },
    remove(node) {
      if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1)
      node.parent = null
    },
  })
  return { ...renderer, root: createNode('root') }
}

export function findNodes(root, predicate) {
  return [root, ...root.children.flatMap(child => findNodes(child, () => true))].filter(predicate)
}

export function hasClass(node, className) {
  return String(node.props.class || '').split(/\s+/).includes(className)
}

export function nodeText(node) {
  return node.text + node.children.map(nodeText).join('')
}

export function click(node) {
  node.props.onClick({ currentTarget: node, target: node, stopPropagation() {}, preventDefault() {} })
}
