import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { classifyChanges } from './lib/ci-policy.mjs';
const paths = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', process.env.CI_BASE_SHA, 'HEAD'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const flags = classifyChanges(paths, process.env.GITHUB_EVENT_NAME);
appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(flags).map(([key, value]) => `${key}=${value}\n`).join(''));
