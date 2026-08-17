import { spawnSync } from 'node:child_process';

const commands: Array<[string, string[]]> = [
  ['npm', ['run', 'validate:cloudflare-local-config']],
  ['npm', ['run', 'validate:cloudflare-migrations']],
  ['npm', ['test']],
  ['npm', ['run', 'lint']],
  ['npm', ['run', 'smoke:cloudflare:local']]
];

for (const [command, args] of commands) {
  const result = spawnSync([command, ...args].join(' '), { stdio: 'inherit', shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
