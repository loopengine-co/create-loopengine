// Regenerates template/adapters/http.ts from loopengine's own
// adapters/http.ts, so a project scaffolded or upgraded from this template
// runs the same server as the loopengine release it depends on.
//
//   npx tsx scripts/sync-template-adapter.ts [path/to/loopengine]
//
// loopengine's copy imports its internals by path (../core/..., #web/...);
// here they all come from the published package's own exports ('loopengine'),
// and agent-registry.ts sits at the project root. The template's header
// comment, which is written for a scaffolded project, is kept. Fails when
// the adapter imports a name loopengine's index doesn't export.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ts from 'typescript'

const loopengineDir = resolve(process.argv[2] ?? join(import.meta.dirname, '..', '..', 'loopengine'))
const templatePath = join(import.meta.dirname, '..', 'template', 'adapters', 'http.ts')
const source = readFileSync(join(loopengineDir, 'adapters', 'http.ts'), 'utf8')
const file = ts.createSourceFile('http.ts', source, ts.ScriptTarget.Latest, true)

// What the package exports, by the module each name comes from: a module
// (as core/foo, web/bar) to its names and the name each is exported as.
// A module re-exported whole (`export * from`) exports every name as is.
const moduleKey = (spec: string, from = '') => {
  const path = spec.startsWith('#') ? spec.slice(1) : join(from, spec)
  return path.replace(/^(\.\.\/|\.\/)+/, '').replace(/\.(js|ts)$/, '')
}
const named = new Map<string, Map<string, string>>()
const whole = new Set<string>()
const index = ts.createSourceFile('index.ts', readFileSync(join(loopengineDir, 'index.ts'), 'utf8'), ts.ScriptTarget.Latest, true)
for (const st of index.statements) {
  if (!ts.isExportDeclaration(st) || !st.moduleSpecifier) continue
  const key = moduleKey((st.moduleSpecifier as ts.StringLiteral).text)
  if (!st.exportClause) { whole.add(key); continue }
  if (!ts.isNamedExports(st.exportClause)) continue
  const names = named.get(key) ?? new Map<string, string>()
  for (const el of st.exportClause.elements) names.set((el.propertyName ?? el.name).text, el.name.text)
  named.set(key, names)
}
/** The name `name` from `spec` is exported as, if it is. */
function exportedAs(spec: string, name: string): string | undefined {
  const key = moduleKey(spec, 'adapters')
  return named.get(key)?.get(name) ?? (whole.has(key) ? name : undefined)
}

const isInternal = (spec: string) => /^(\.\.\/|#)(core|web|bin)\//.test(spec) && !/agent-registry\.js$/.test(spec)
const fromPackage: string[] = []
const kept: string[] = []
const missing: string[] = []
let firstImport = -1
let lastImportEnd = 0
for (const st of file.statements) {
  if (!ts.isImportDeclaration(st)) continue
  if (firstImport < 0) firstImport = st.getFullStart()
  lastImportEnd = st.getEnd()
  const spec = (st.moduleSpecifier as ts.StringLiteral).text
  if (!isInternal(spec)) {
    kept.push(st.getText(file).replace(/'\.\.\/core\/agent-registry\.js'/, "'../agent-registry.js'"))
    continue
  }
  const clause = st.importClause
  if (!clause || clause.name || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) throw new Error(`Can't rewrite: ${st.getText(file)}`)
  for (const el of clause.namedBindings.elements) {
    const name = (el.propertyName ?? el.name).text
    const local = el.name.text
    const as = exportedAs(spec, name)
    if (!as) { missing.push(`${name} (${spec})`); continue }
    const type = clause.isTypeOnly || el.isTypeOnly ? 'type ' : ''
    fromPackage.push(`  ${type}${as === local ? local : `${as} as ${local}`},`)
  }
}
if (missing.length) {
  console.error(`loopengine's index doesn't export:\n  ${missing.join('\n  ')}`)
  process.exit(1)
}

const templateHeader = readFileSync(templatePath, 'utf8').split(/^import /m)[0]
const imports = [...kept.filter((k) => !k.includes("from 'actauth'") && !/from '(loopengine)'/.test(k)), `import {\n${[...new Set(fromPackage)].join('\n')}\n} from 'loopengine'`, ...kept.filter((k) => k.includes("from 'actauth'"))]
const body = source.slice(lastImportEnd)
writeFileSync(templatePath, templateHeader + imports.join('\n') + body)
console.log(`template/adapters/http.ts: ${fromPackage.length} names from loopengine, ${kept.length} other imports`)
