import { Command, Option } from 'commander';
import pc from 'picocolors';
import { doAnalyze, doGenerate, doInit, doPlan, doReport, doRun, doTest } from './core/pipeline.js';
import { log } from './core/log.js';
import { VERSION } from './core/paths.js';

const program = new Command();

const testsOption = () =>
  new Option('--tests <kind>', 'which tests to plan').choices(['all', 'unit', 'e2e', 'load']).default('all');
const aiOption = () => new Option('--ai <provider>', 'AI provider: none, anthropic, openai, ollama:<model>').default('none');
const outOption = () => new Option('--out <dir>', 'report folder').default('repeval-report');
const failOnOption = () =>
  new Option('--fail-on <level>', 'exit with code 1 when results include this').choices(['possible-bug', 'broken', 'never']).default('possible-bug');

program
  .name('repeval')
  .description('Generate and run unit and E2E tests for a JS/TS repo, with screenshots of every run.')
  .version(VERSION);

program
  .command('run', { isDefault: true })
  .description('Do everything: analyze, plan, generate, test and report')
  .argument('[dir]', 'project folder', '.')
  .addOption(testsOption())
  .addOption(aiOption())
  .addOption(outOption())
  .addOption(failOnOption())
  .option('-i, --interactive', 'review the plan before generating tests')
  .option('--no-install', 'do not install project dependencies when node_modules is missing')
  .option('--update-baselines', 'record new baselines instead of comparing')
  .action(async (dir, o) => {
    const { exitCode } = await doRun(dir, {
      tests: o.tests,
      ai: o.ai,
      out: o.out,
      failOn: o.failOn,
      interactive: o.interactive,
      install: o.install,
      updateBaselines: o.updateBaselines,
    });
    process.exitCode = exitCode;
  });

program
  .command('analyze')
  .description('Read the repo: stack, functions, pages, APIs and how to start it')
  .argument('[dir]', 'project folder', '.')
  .action((dir) => {
    doAnalyze(dir);
  });

program
  .command('plan')
  .description('Decide what to test (writes .repeval/repeval-plan.json)')
  .argument('[dir]', 'project folder', '.')
  .addOption(testsOption())
  .option('-i, --interactive', 'tick or untick targets in a checklist')
  .action(async (dir, o) => {
    await doPlan(dir, { tests: o.tests, interactive: o.interactive });
  });

program
  .command('generate')
  .description('Write the test files into .repeval/')
  .argument('[dir]', 'project folder', '.')
  .addOption(aiOption())
  .action(async (dir, o) => {
    await doGenerate(dir, { ai: o.ai });
  });

program
  .command('test')
  .description('Run the generated tests and write the report')
  .argument('[dir]', 'project folder', '.')
  .addOption(outOption())
  .addOption(failOnOption())
  .option('--no-install', 'do not install project dependencies when node_modules is missing')
  .option('--update-baselines', 'record new baselines instead of comparing')
  .action(async (dir, o) => {
    const { exitCode } = await doTest(dir, { out: o.out, failOn: o.failOn, install: o.install, updateBaselines: o.updateBaselines });
    process.exitCode = exitCode;
  });

program
  .command('report')
  .description('Rebuild the HTML report from the last run')
  .argument('[dir]', 'project folder', '.')
  .addOption(outOption())
  .action((dir, o) => {
    log.ok(`Report: ${doReport(dir, { out: o.out })}`);
  });

program
  .command('init')
  .description('Add .github/workflows/repeval.yml so Repeval can run in GitHub Actions')
  .argument('[dir]', 'project folder', '.')
  .option('--force', 'overwrite an existing workflow file')
  .action((dir, o) => {
    const file = doInit(dir, { force: o.force });
    log.ok(`Wrote ${file}`);
    log.info('Read it, commit it, then start it from the Actions tab or from the Repeval website.');
  });

program.parseAsync().catch((err: unknown) => {
  console.error(pc.red(`\n✖ ${err instanceof Error ? err.message : String(err)}`));
  process.exitCode = 1;
});
