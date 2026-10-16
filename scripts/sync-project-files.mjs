#!/usr/bin/env node
// Two-way sync between the Claude project's shared folder and project/ in the repo.
//
// Claude threads write to the shared folder; agents in other tools edit project/ through pull
// requests. project/.sync-state.json records a hash of each file on both sides at the last sync,
// so this script can tell which side changed:
//   - only the shared folder changed: copy it into project/
//   - only project/ changed: copy it back to the shared folder
//   - both changed: three-way merge against project/ as of the last sync (progress logs keep
//     both sides' entries); a real conflict is reported, both copies stay as they are, and the
//     script exits 1 so PM merges that file by hand
// Links to the shared folder are written as repo-root links (/project/...) and back.
//
// Usage, from the repo root: node scripts/sync-project-files.mjs [--prefer-repo] [shared folder]
// (default /mnt/project-files). --prefer-repo settles files changed on both sides by taking
// project/, after PM has merged them there by hand. Commit project/ afterwards, including
// .sync-state.json.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

const args = process.argv.slice(2);
const preferRepo = args.includes('--prefer-repo');
const src = (args.find((arg) => !arg.startsWith('--')) ?? '/mnt/project-files').replace(/\/$/, '');
const dest = 'project';
const dirs = ['pm', 'design', 'qa', 'research', 'social'];
const stateFile = join(dest, '.sync-state.json');

const toRepo = (text) =>
  text.replaceAll(`${src}/security/`, '/docs/security/').replaceAll(`${src}/`, '/project/');
const toShared = (text) =>
  text
    .replace(/(?<=[(\s`"'[<])\/docs\/security\//g, `${src}/security/`)
    .replace(/(?<=[(\s`"'[<])\/project\//g, `${src}/`);
const hash = (text) => createHash('sha256').update(text).digest('hex');
const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null);
const write = (path, text) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};
// Loaded after the shared-folder check, so tools without node_modules can still run the script.
let prettier;
const format = async (path, text) => {
  prettier ??= await import('prettier');
  return prettier.format(text, { ...(await prettier.resolveConfig(path)), filepath: path });
};

function markdownFiles(root) {
  const found = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.md')) found.push(relative(root, path));
    }
  };
  for (const dir of dirs) walk(join(root, dir));
  return found;
}

// project/ as committed with the last sync state: the common ancestor for three-way merges.
function baseAtLastSync(rel) {
  try {
    const commit = execFileSync('git', ['log', '-1', '--format=%H', '--', stateFile], {
      encoding: 'utf8',
    }).trim();
    if (!commit) return null;
    return execFileSync('git', ['show', `${commit}:${dest}/${rel}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function mergeThreeWay(ours, base, theirs, union) {
  const dir = mkdtempSync(join(tmpdir(), 'sync-'));
  const [o, b, t] = ['ours', 'base', 'theirs'].map((name) => join(dir, name));
  writeFileSync(o, ours);
  writeFileSync(b, base);
  writeFileSync(t, theirs);
  const args = ['merge-file', '-p', ...(union ? ['--union'] : []), o, b, t];
  try {
    return { text: execFileSync('git', args, { encoding: 'utf8' }), clean: true };
  } catch (error) {
    return { text: error.stdout, clean: false };
  }
}

if (!existsSync(src)) {
  console.log(`No shared folder at ${src}; nothing to sync.`);
  process.exit(0);
}

const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {};
const files = [...new Set([...markdownFiles(src), ...markdownFiles(dest)])].sort();
const log = { toRepo: [], toShared: [], merged: [], conflicts: [] };

for (const rel of files) {
  const repoPath = join(dest, rel);
  const sharedPath = join(src, rel);
  const repo = read(repoPath);
  const shared = read(sharedPath);
  const fromShared = shared === null ? null : await format(repoPath, toRepo(shared));
  const last = state[rel];
  const repoChanged = repo !== null && hash(repo) !== last?.repo;
  const sharedChanged = shared !== null && hash(shared) !== last?.shared;

  let next = repo;
  if (fromShared === repo) {
    // Already the same.
  } else if (repo === null || (sharedChanged && !repoChanged)) {
    next = fromShared;
    write(repoPath, next);
    log.toRepo.push(rel);
  } else if (shared === null || preferRepo || (repoChanged && !sharedChanged)) {
    write(sharedPath, toShared(repo));
    log.toShared.push(rel);
  } else {
    const base = baseAtLastSync(rel) ?? '';
    const union = rel.startsWith('pm/progress/');
    const { text, clean } = mergeThreeWay(repo, base, fromShared, union);
    if (!clean) {
      log.conflicts.push(rel);
      continue;
    }
    next = await format(repoPath, text);
    write(repoPath, next);
    write(sharedPath, toShared(next));
    log.merged.push(rel);
  }
  state[rel] = { repo: hash(next), shared: hash(read(sharedPath)) };
}

write(stateFile, `${JSON.stringify(state, null, 2)}\n`);
for (const [what, list] of Object.entries(log)) {
  if (list.length) console.log(`${what}: ${list.join(', ')}`);
}
if (log.conflicts.length) {
  console.error(
    'Both sides changed these files and they could not be merged. Merge them by hand, then run again.',
  );
  process.exit(1);
}
console.log(`Synced ${src} and ${dest}/`);
