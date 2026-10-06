// Verificación estática: todos los hooks usados deben estar importados, y todo
// componente importado debe existir.
//
// El bundler de Vite no avisa de un hook faltante (sólo rompe al runtime, en
// producción, con pantalla en blanco). Estas dos comprobaciones evitan que eso
// llegue a deploy.
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('src');
const HOOKS = ['useState', 'useEffect', 'useRef', 'useCallback', 'useMemo', 'useReducer', 'useContext', 'useLayoutEffect'];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = await walk(SRC);
const failures = [];
let checkedHooks = 0;
let checkedImports = 0;

for (const file of files) {
  const src = await readFile(file, 'utf8');
  const rel = path.relative(path.resolve('.'), file);
  const isTs = /\.tsx?$/.test(file);

  // --- Hooks usados pero no importados ---
  // Se ignoran las definiciones (`const useX =`) y las menciones en comentarios.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const hook of HOOKS) {
    const used = new RegExp(`(^|[^\\w.$])${hook}\\s*\\(`, 'm').test(code);
    if (!used) continue;
    checkedHooks += 1;
    // ¿está en la lista de import de react?
    const importsReact = /import\s+React\s*(,|from)/.test(src) &&
      new RegExp(`import\\s+[\\s\\S]*?\\b${hook}\\b[\\s\\S]*?from\\s+['"]react['"]`).test(src);
    const localDef = new RegExp(`(const|function)\\s+${hook}\\b`).test(code);
    const destructuredLocal = new RegExp(`\\b${hook}\\b\\s*[,}]`).test(code.split('\n')[0] || '');
    if (!importsReact && !localDef && !destructuredLocal) {
      failures.push(`${rel}: usa ${hook}() sin importarlo de 'react'`);
    }
  }

  // --- Importaciones a archivos que no existen ---
  const importRe = /from\s+['"](\.[^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(src))) {
    const spec = m[1];
    const base = path.resolve(path.dirname(file), spec);
    const candidates = [base, `${base}.js`, `${base}.jsx`, `${base}.ts`, `${base}.tsx`,
      path.join(base, 'index.js'), path.join(base, 'index.jsx')];
    checkedImports += 1;
    if (!candidates.some((c) => existsSync(c))) {
      failures.push(`${rel}: importa '${spec}' y ese archivo no existe`);
    }
  }
}

console.log(`Archivos analizados: ${files.length}`);
console.log(`Hooks verificados: ${checkedHooks} | Importaciones verificadas: ${checkedImports}`);
if (failures.length) {
  console.log(`\n${failures.length} problema(s):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('\nTodo ok: hooks importados e imports resolubles.');