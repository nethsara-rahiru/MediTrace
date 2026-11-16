import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const files = [];
async function collect(directory) {
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(relative);
    else if (/\.(?:ts|tsx|mts|cts)$/.test(entry.name)) {
      throw new Error(`TypeScript source remains: ${relative}`);
    } else if (/\.(?:js|mjs|cjs)$/.test(entry.name)) files.push(relative);
  }
}
for (const directory of ['app', 'src', 'tests', 'scripts']) await collect(directory);
files.push('playwright.config.js', 'metro.config.cjs');
async function exists(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}
function imports(node, values = []) {
  if (!node || typeof node !== 'object') return values;
  if (
    ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) &&
    node.source
  )
    values.push(node.source.value);
  if (node.type === 'ImportExpression' && node.source.type === 'StringLiteral')
    values.push(node.source.value);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'tokens' || key === 'comments') continue;
    if (Array.isArray(value)) for (const child of value) imports(child, values);
    else if (value && typeof value === 'object') imports(value, values);
  }
  return values;
}
for (const file of files) {
  const absolute = path.join(root, file);
  const ast = parse(await readFile(absolute, 'utf8'), {
    sourceType: 'unambiguous',
    plugins: ['jsx'],
    createImportExpressions: true,
  });
  for (const specifier of imports(ast)) {
    if (specifier.startsWith('.')) {
      const target = path.resolve(path.dirname(absolute), specifier);
      if (!(await exists(target))) throw new Error(`Missing import ${specifier} in ${file}`);
    } else if (specifier.startsWith('#')) {
      const entry = manifest.imports?.[specifier];
      if (!entry) throw new Error(`Missing package import ${specifier} in ${file}`);
      for (const target of typeof entry === 'string' ? [entry] : Object.values(entry)) {
        if (!(await exists(path.resolve(root, target))))
          throw new Error(`Missing conditional import target ${target}`);
      }
    }
  }
}
console.log(`JavaScript/JSX syntax and relative imports passed for ${files.length} files.`);
