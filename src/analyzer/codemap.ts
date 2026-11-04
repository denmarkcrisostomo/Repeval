import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  Node,
  Project,
  ts,
  type ArrowFunction,
  type FunctionDeclaration,
  type FunctionExpression,
  type Type,
} from 'ts-morph';
import type { FunctionInfo, ParamInfo, SkippedFile } from '../core/types.js';

const MAX_FILES = 1500;
const MAX_CASES = 6;

type FnNode = FunctionDeclaration | ArrowFunction | FunctionExpression;

/** Files that frameworks load themselves (pages, layouts, route handlers). Unit-testing them by import is misleading. */
const FRAMEWORK_FILE_RE = [
  /(^|\/)(src\/)?app\/(.*\/)?(page|layout|route|loading|error|not-found|template|default|head)\.[cm]?[jt]sx?$/,
  /(^|\/)(src\/)?pages\//,
  /(^|\/)(src\/)?middleware\.[jt]s$/,
  /(^|\/)src\/routes\/.*\+/,
  /(^|\/)app\/routes\//,
  /(^|\/)app\/(root|entry\.client|entry\.server)\.[jt]sx?$/,
];

/** Code in a function body that suggests calling it from a test has side effects or is not deterministic. */
const IMPURE: [RegExp, string][] = [
  [/\bfetch\s*\(/, 'makes network requests'],
  [/\baxios\b|\bgot\s*\(|\bky\s*\(/, 'makes network requests'],
  [/\b(fs|fsp|fsPromises)\.\w+|\b(readFile|writeFile|unlink|mkdir|rm)(Sync)?\s*\(/, 'uses the file system'],
  [/\bprocess\.(env|exit|argv|cwd|chdir|on)\b/, 'reads process state'],
  [/\b(prisma|db|knex|sequelize|mongoose|supabase|redis|pool|client)\s*\.\s*\w+\s*\(/, 'talks to a database or client'],
  [/\b(localStorage|sessionStorage|document|window|navigator)\b/, 'uses browser globals'],
  [/\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\bperformance\.now\s*\(/, 'depends on the current time'],
  [/\bMath\.random\s*\(|\bcrypto\.(randomUUID|getRandomValues|randomBytes)\s*\(/, 'uses randomness'],
  [/\b(setTimeout|setInterval|setImmediate)\s*\(/, 'uses timers'],
  [/\b(exec|execSync|spawn|spawnSync|fork)\s*\(|child_process/, 'runs shell commands'],
  [/\bawait\b/, 'awaits other work'],
  [/\bthis\b/, 'depends on `this`'],
];

export interface CodeMap {
  functions: FunctionInfo[];
  classes: { id: string; file: string; exportName: string }[];
  skippedFiles: SkippedFile[];
}

export function mapCode(root: string, files: string[]): CodeMap {
  const project = new Project({
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      jsx: ts.JsxEmit.Preserve,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
    skipAddingFilesFromTsConfig: true,
  });

  const functions: FunctionInfo[] = [];
  const classes: CodeMap['classes'] = [];
  const skippedFiles: SkippedFile[] = [];

  for (const file of files.slice(0, MAX_FILES)) {
    if (FRAMEWORK_FILE_RE.some((re) => re.test(file))) {
      skippedFiles.push({ file, reason: 'framework file (page, layout or route), covered by E2E tests' });
      continue;
    }
    const text = readFileSync(join(root, file), 'utf8');
    const sideEffect = importSideEffect(text);
    if (sideEffect) {
      skippedFiles.push({ file, reason: sideEffect });
      continue;
    }
    let sf;
    try {
      sf = project.addSourceFileAtPath(join(root, file));
    } catch {
      skippedFiles.push({ file, reason: 'could not be parsed' });
      continue;
    }

    const seen = new Set<string>();
    for (const [exportName, decls] of sf.getExportedDeclarations()) {
      for (const decl of decls) {
        if (decl.getSourceFile() !== sf) continue; // re-export from another file
        if (Node.isClassDeclaration(decl)) {
          classes.push({ id: `${file}#${exportName}`, file, exportName });
          continue;
        }
        let fn: FnNode | undefined;
        if (Node.isFunctionDeclaration(decl)) fn = decl;
        else if (Node.isVariableDeclaration(decl)) {
          const init = decl.getInitializer();
          if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) fn = init;
        }
        if (!fn || !fn.getBody() || seen.has(exportName)) continue;
        seen.add(exportName);
        functions.push(describeFunction(file, exportName, fn));
      }
    }
  }

  return { functions, classes, skippedFiles };
}

/** Return a reason when simply importing the file would start something (a server, a connection). */
function importSideEffect(text: string): string | null {
  if (/\.listen\s*\(/.test(text) || /\bcreateServer\s*\(/.test(text)) return 'starts a server when imported';
  if (/^\s*await\s/m.test(text)) return 'runs top-level await when imported';
  return null;
}

function describeFunction(file: string, exportName: string, fn: FnNode): FunctionInfo {
  const name = Node.isFunctionDeclaration(fn) ? (fn.getName() ?? exportName) : exportName;
  const body = fn.getText();
  const isAsync = fn.isAsync();
  const isComponent = /\.(tsx|jsx)$/.test(file) && /^[A-Z]/.test(exportName === 'default' ? name : exportName);

  const impureReasons: string[] = [];
  if (isAsync) impureReasons.push('is async');
  for (const [re, reason] of IMPURE) if (re.test(body) && !impureReasons.includes(reason)) impureReasons.push(reason);

  const params: ParamInfo[] = [];
  let paramsOk = true;
  for (const [i, p] of fn.getParameters().entries()) {
    if (p.isRestParameter()) break;
    const nameNode = p.getNameNode();
    const pname = Node.isIdentifier(nameNode) ? nameNode.getText() : `arg${i + 1}`;
    const type = p.getType();
    const optional = p.isOptional() || p.hasInitializer();
    let typeText = safeTypeText(type, fn);
    let samples = type.getCallSignatures().length > 0 ? null : samplesFor(type, fn, 0);
    if (samples && optional && !samples.includes('undefined')) samples = [...samples, 'undefined'];
    if (!samples && optional) samples = ['undefined'];
    if (type.getCallSignatures().length > 0) impureReasons.push('takes a callback');
    if (!samples) paramsOk = false;
    if (typeText.length > 80) typeText = typeText.slice(0, 77) + '...';
    params.push({ name: pname, type: typeText, optional, samples });
  }

  const callable = !isComponent && impureReasons.length === 0 && paramsOk;
  return {
    id: `${file}#${exportName}`,
    file,
    name,
    exportName,
    async: isAsync,
    params,
    returnType: truncate(safeTypeText(fn.getReturnType(), fn), 80),
    lines: fn.getEndLineNumber() - fn.getStartLineNumber() + 1,
    isComponent,
    impureReasons,
    callable,
    cases: callable ? buildCases(params) : [],
  };
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 3) + '...' : s;
}

function safeTypeText(type: Type, node: Node): string {
  try {
    return type.getText(node, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope);
  } catch {
    return 'unknown';
  }
}

/** Typical case first, then vary one argument at a time. */
export function buildCases(params: ParamInfo[]): string[][] {
  if (params.length === 0) return [[]];
  const lists = params.map((p) => p.samples ?? ['undefined']);
  const base = lists.map((l) => l[0]);
  const cases: string[][] = [base];
  for (let i = 0; i < lists.length && cases.length < MAX_CASES; i++) {
    for (const alt of lists[i].slice(1)) {
      if (cases.length >= MAX_CASES) break;
      const c = [...base];
      c[i] = alt;
      cases.push(c);
    }
  }
  // Drop trailing `undefined` arguments so calls read naturally.
  return cases.map((c) => {
    const out = [...c];
    while (out.length && out[out.length - 1] === 'undefined') out.pop();
    return out;
  });
}

const NUMBERS = ['2', '0', '-1', '1.5'];
const STRINGS = ["'hello'", "''", "'Hello World 123'"];

/** Sample values (as JavaScript source) for a TypeScript type, or null if there is no safe sample. */
export function samplesFor(type: Type, node: Node, depth: number): string[] | null {
  if (type.isAny() || type.isUnknown() || type.isNever()) return null;
  if (type.isBoolean()) return ['true', 'false'];
  if (type.isNumberLiteral() || type.isStringLiteral() || type.isBooleanLiteral()) return [literalText(type, node)];
  if (type.isNumber()) return NUMBERS;
  if (type.isString()) return STRINGS;
  if (type.isNull()) return ['null'];
  if (type.isUndefined()) return ['undefined'];

  if (type.isUnion()) {
    const out: string[] = [];
    let any = false;
    const members = type.getUnionTypes();
    // `boolean` shows up as `true | false` inside unions.
    const hasTrue = members.some((m) => m.isBooleanLiteral() && m.getText() === 'true');
    const hasFalse = members.some((m) => m.isBooleanLiteral() && m.getText() === 'false');
    for (const m of members) {
      if (m.isUndefined()) continue;
      if (hasTrue && hasFalse && m.isBooleanLiteral()) continue;
      const s = samplesFor(m, node, depth);
      if (s) {
        any = true;
        out.push(...s.slice(0, 2));
      }
    }
    if (hasTrue && hasFalse) {
      any = true;
      out.push('true', 'false');
    }
    if (!any) return null;
    return [...new Set(out)].slice(0, 4);
  }

  if (type.isArray()) {
    const el = type.getArrayElementType();
    const s = el ? samplesFor(el, node, depth + 1) : null;
    if (!s) return ['[]'];
    return [`[${s[0]}, ${s[1] ?? s[0]}]`, '[]', `[${s[0]}]`];
  }

  if (type.isTuple()) {
    const parts: string[] = [];
    for (const t of type.getTupleElements()) {
      const s = samplesFor(t, node, depth + 1);
      if (!s) return null;
      parts.push(s[0]);
    }
    return [`[${parts.join(', ')}]`];
  }

  const symbolName = type.getSymbol()?.getName();
  if (symbolName === 'Date') return ['new Date(0)', "new Date('2024-02-29T12:00:00Z')"];
  if (symbolName && ['Map', 'Set', 'Promise', 'RegExp', 'Function', 'Error'].includes(symbolName)) return null;

  if (type.isObject() && type.getCallSignatures().length === 0 && depth < 2) {
    const props = type.getProperties();
    if (props.length === 0 || props.length > 8) return null;
    const first: string[] = [];
    const second: string[] = [];
    for (const prop of props) {
      const decl = prop.getValueDeclaration() ?? prop.getDeclarations()[0];
      const pt = prop.getTypeAtLocation(decl ?? node);
      const optional = prop.isOptional();
      const s = pt.getCallSignatures().length > 0 ? null : samplesFor(pt, node, depth + 1);
      const key = /^[A-Za-z_$][\w$]*$/.test(prop.getName()) ? prop.getName() : JSON.stringify(prop.getName());
      if (!s) {
        if (optional) continue;
        return null;
      }
      const usable = s.filter((v) => v !== 'undefined');
      if (usable.length === 0) continue;
      first.push(`${key}: ${usable[0]}`);
      second.push(`${key}: ${usable[1] ?? usable[0]}`);
    }
    const a = `{ ${first.join(', ')} }`;
    const b = `{ ${second.join(', ')} }`;
    return a === b ? [a] : [a, b];
  }

  return null;
}

function literalText(type: Type, node: Node): string {
  const v = type.getLiteralValue();
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number') return String(v);
  return type.getText(node);
}
