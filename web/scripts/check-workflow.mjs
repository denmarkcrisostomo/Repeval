// Fails when web/lib/workflow.ts and the CLI's templates/repeval.yml no longer match.
import { readFileSync } from 'node:fs';
const template = readFileSync(new URL('../../templates/repeval.yml', import.meta.url), 'utf8');
const ts = readFileSync(new URL('../lib/workflow.ts', import.meta.url), 'utf8');
const inline = ts.slice(ts.indexOf('WORKFLOW_YAML = `') + 17, ts.indexOf('`;', ts.indexOf('WORKFLOW_YAML = `'))).replaceAll('\\${{', '${{');
if (inline !== template) {
  console.error('web/lib/workflow.ts is out of date with templates/repeval.yml');
  process.exit(1);
}
const name = /^name: (.+)$/m.exec(template)?.[1];
if (!ts.includes(`WORKFLOW_NAME = '${name}'`)) {
  console.error(`WORKFLOW_NAME in web/lib/workflow.ts must be '${name}', the name in templates/repeval.yml`);
  process.exit(1);
}
console.log('workflow file matches templates/repeval.yml');
