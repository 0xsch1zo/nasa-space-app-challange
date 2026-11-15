// Checks the external prerequisites (Node, Rust toolchain, PostgreSQL
// client/server) and the presence of `.env`.
// Only warns: it never fails `npm install`.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const run = (cmd) => {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
};
const version = (text) => text?.match(/(\d+)\.(\d+)/)?.slice(1).map(Number) ?? null;
const atLeast = (v, [maj, min]) => !!v && (v[0] > maj || (v[0] === maj && v[1] >= min));

const checks = [
  {
    name: 'Node.js 22',
    ok: version(process.version)?.[0] === 22,
    found: process.version,
    hint: 'use the version from .nvmrc (e.g. `nvm use`)',
  },
  {
    name: 'Rust ≥ 1.89 (cargo)',
    ...(() => {
      const out = run('cargo --version');
      return { ok: atLeast(version(out), [1, 89]), found: out ?? 'not found' };
    })(),
    hint: 'install via https://rustup.rs',
  },
  {
    name: 'PostgreSQL client (psql)',
    ...(() => {
      const out = run('psql --version');
      return { ok: !!out, found: out ?? 'not found' };
    })(),
    hint: 'install PostgreSQL 16 (see README); needed for `npm run db:create`',
  },
  {
    name: 'PostgreSQL server reachable on localhost:5432',
    ...(() => {
      const out = run('pg_isready -h localhost -p 5432');
      return { ok: !!out, found: out ?? 'not reachable (or pg_isready missing)' };
    })(),
    hint: 'start your local PostgreSQL 16 service',
  },
  {
    name: '.env file',
    ok: existsSync(new URL('../.env', import.meta.url)),
    found: existsSync(new URL('../.env', import.meta.url)) ? 'present' : 'missing',
    hint: 'cp .env.example .env',
  },
];

let missing = 0;
console.log('\nAstroHealth prerequisites:');
for (const c of checks) {
  console.log(`  ${c.ok ? '✔' : '✘'} ${c.name} — ${c.found}${c.ok ? '' : `\n      → ${c.hint}`}`);
  if (!c.ok) missing++;
}
console.log(missing ? `\n${missing} prerequisite(s) need attention (see README).\n` : '\nAll prerequisites found.\n');
