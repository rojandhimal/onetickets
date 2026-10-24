// Tests for scripts/state.mjs. Run with: node --test scripts/
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  GRAPH,
  applyEdit,
  brief,
  claim,
  next,
  parse,
  release,
  serialise,
  stampClaim,
  staleClaims,
  validate,
} from './state.mjs';

const base = () => [
  {
    type: 'meta',
    id: 'meta',
    updated: '2026-10-22',
    by: 'test',
    main: 'abc1234',
    sprint: 'S2',
    phase: 'x',
  },
  { type: 'sprint', id: 'S2', name: 'Free tickets', status: 'in_progress' },
  { type: 'role', id: 'backend', name: 'BackendDev', now: '-', next: '-', blocked: 'nothing' },
  { type: 'role', id: 'qa', name: 'QA', now: '-', next: '-', blocked: 'nothing' },
  { type: 'item', id: 'S2-1', title: 'Holds', status: 'done', owner: 'backend', prs: [50] },
  {
    type: 'item',
    id: 'S2-2',
    title: 'Checkout',
    status: 'ready',
    owner: 'backend',
    deps: ['S2-1'],
  },
  { type: 'pr', id: '#50', title: 'S2-1', item: 'S2-1', branch: 'b', state: 'merged', reviews: {} },
];

test('the committed graph is valid and in canonical form', () => {
  const text = readFileSync(GRAPH, 'utf8');
  const { nodes, errors } = parse(text);
  assert.deepEqual(errors, []);
  assert.deepEqual(validate(nodes), []);
  assert.equal(serialise(nodes), text);
});

test('a well-formed graph passes', () => {
  assert.deepEqual(validate(base()), []);
});

test('validate reports bad ids, enums, references and cycles', () => {
  const nodes = base();
  nodes.push({ type: 'item', id: 'S2-1', title: 'again', status: 'done', owner: 'backend' });
  nodes.push({
    type: 'item',
    id: 'X-1',
    title: 'x',
    status: 'doing',
    owner: 'nobody',
    deps: ['S2-9'],
  });
  nodes.push({ type: 'pr', id: '51', title: 't', branch: 'b', state: 'open', item: 'S2-1' });
  nodes[5].deps.push('S2-3');
  nodes.push({
    type: 'item',
    id: 'S2-3',
    title: 'c',
    status: 'backlog',
    owner: 'qa',
    deps: ['S2-2'],
  });
  const errors = validate(nodes).join('\n');
  assert.match(errors, /item S2-1: duplicate id/);
  assert.match(errors, /status "doing"/);
  assert.match(errors, /unknown role "nobody"/);
  assert.match(errors, /unknown item "S2-9"/);
  assert.match(errors, /pr ids look like #54/);
  assert.match(errors, /dependency cycle: S2-2 -> S2-3 -> S2-2/);
});

test('an item cannot claim a PR that points at another item', () => {
  const nodes = base();
  nodes[5].prs = [50];
  assert.match(validate(nodes).join('\n'), /item S2-2: lists #50, but #50 points at S2-1/);
});

test('applyEdit sets, appends, removes, deletes and reaches nested keys', () => {
  const node = { type: 'pr', id: '#55', prs: [1], note: 'x' };
  applyEdit(node, 'state=open');
  applyEdit(node, 'prs+=55');
  applyEdit(node, 'prs+=55');
  applyEdit(node, 'prs-=1');
  applyEdit(node, 'note=');
  applyEdit(node, 'reviews.qa=pass@abc1234');
  applyEdit(node, 'title=Fix = sign');
  assert.deepEqual(node, {
    type: 'pr',
    id: '#55',
    state: 'open',
    prs: [55],
    reviews: { qa: 'pass@abc1234' },
    title: 'Fix = sign',
  });
  assert.throws(() => applyEdit(node, 'id=#56'), /can't be changed/);
  assert.throws(() => applyEdit(node, 'nonsense'), /key=value/);
});

test('brief lists active items with their unfinished dependencies', () => {
  const nodes = base();
  nodes[4].status = 'review';
  const out = brief(nodes);
  assert.match(out, /review\s+S2-1/);
  assert.match(out, /ready\s+S2-2 .*waiting on deps S2-1/);
});

test('claim gives an item to an agent and starts it', () => {
  const nodes = base();
  nodes[4].status = 'done';
  const item = claim(nodes, 'S2-2', 'codex', '2026-10-23');
  assert.deepEqual(
    { agent: item.agent, claimed: item.claimed, active: item.active, status: item.status },
    { agent: 'codex', claimed: '2026-10-23', active: '2026-10-23', status: 'in_progress' },
  );
  assert.deepEqual(validate(nodes), []);
  // Claiming again keeps the claim date and refreshes activity.
  claim(nodes, 'S2-2', 'codex', '2026-10-25');
  assert.equal(item.claimed, '2026-10-23');
  assert.equal(item.active, '2026-10-25');
});

test('claim refuses an item another agent holds, and says when PM can release it', () => {
  const nodes = base();
  claim(nodes, 'S2-2', 'codex', '2026-10-01');
  assert.throws(() => claim(nodes, 'S2-2', 'claude', '2026-10-03'), /held by codex/);
  assert.throws(() => claim(nodes, 'S2-2', 'claude', '2026-10-09'), /8 days ago: ask PM/);
  assert.throws(() => claim(nodes, 'S2-1', 'claude'), /S2-1 is done/);
  assert.throws(() => claim(nodes, 'S2-2', 'Claude Code'), /lowercase provider/);
});

test('an agent holds one task at a time per role', () => {
  const nodes = base();
  nodes.push({ type: 'item', id: 'S2-4', title: 'My tickets', status: 'ready', owner: 'backend' });
  nodes.push({ type: 'item', id: 'QA-9', title: 'Checklist', status: 'ready', owner: 'qa' });
  claim(nodes, 'S2-2', 'claude', '2026-10-23');
  assert.throws(() => claim(nodes, 'S2-4', 'claude'), /already holds S2-2 as backend/);
  // Another role, or another agent, is free to start.
  claim(nodes, 'QA-9', 'claude', '2026-10-23');
  claim(nodes, 'S2-4', 'codex', '2026-10-23');
  // Once S2-2 moves to review, the next one can start.
  nodes[5].status = 'review';
  release(nodes, 'S2-4');
  claim(nodes, 'S2-4', 'claude', '2026-10-24');
  // validate catches two held tasks written by hand.
  nodes[5].status = 'in_progress';
  assert.match(validate(nodes).join('\n'), /claude already holds S2-2 as backend; one task/);
});

test('release takes the agent off and puts an in-progress item back to ready', () => {
  const nodes = base();
  claim(nodes, 'S2-2', 'codex', '2026-10-01');
  const item = release(nodes, 'S2-2');
  assert.equal(item.status, 'ready');
  assert.equal(item.agent, undefined);
  assert.equal(item.claimed, undefined);
  assert.throws(() => release(nodes, 'S2-2'), /has no agent/);
});

test('a claim goes stale after more than five days without activity', () => {
  const nodes = base();
  claim(nodes, 'S2-2', 'codex', '2026-10-01');
  assert.deepEqual(staleClaims(nodes, '2026-10-06'), []);
  assert.deepEqual(
    staleClaims(nodes, '2026-10-07').map((n) => n.id),
    ['S2-2'],
  );
  nodes[5].status = 'review';
  assert.deepEqual(staleClaims(nodes, '2026-10-30'), []);
});

test('stampClaim dates a new agent, clears an unassigned item and tracks the agent own edits', () => {
  const item = { type: 'item', id: 'X', agent: 'gemini' };
  stampClaim(item, undefined, ['agent'], 'claude', '2026-10-23');
  assert.deepEqual([item.claimed, item.active], ['2026-10-23', '2026-10-23']);
  stampClaim(item, 'gemini', ['status'], 'claude', '2026-10-25');
  assert.equal(item.active, '2026-10-23');
  stampClaim(item, 'gemini', ['status'], 'gemini', '2026-10-25');
  assert.equal(item.active, '2026-10-25');
  const backfilled = { type: 'item', id: 'Y', agent: 'codex', claimed: '2026-10-20' };
  stampClaim(backfilled, undefined, ['agent', 'claimed'], 'claude', '2026-10-23');
  assert.deepEqual([backfilled.claimed, backfilled.active], ['2026-10-20', '2026-10-23']);
  delete item.agent;
  stampClaim(item, 'gemini', ['agent'], 'claude', '2026-10-25');
  assert.equal(item.claimed, undefined);
});

test('next shows your own work first, then free ready items', () => {
  const nodes = base();
  nodes[4].status = 'done';
  assert.match(
    next(nodes, 'codex', 'backend', '2026-10-23'),
    /Yours:\n {2}none[\s\S]*S2-2 +backend/,
  );
  claim(nodes, 'S2-2', 'codex', '2026-10-01');
  const out = next(nodes, 'codex', 'backend', '2026-10-23');
  assert.match(out, /in_progress S2-2 .*22 days: PM may release it/);
  assert.match(out, /Finish S2-2/);
  assert.doesNotMatch(out, /Unassigned/);
});

test('brief shows each item agent and claims that went quiet', () => {
  const nodes = base();
  nodes[4].status = 'done';
  claim(nodes, 'S2-2', 'codex', '2026-01-01');
  const out = brief(nodes);
  assert.match(out, /in_progress S2-2 +backend +codex/);
  assert.match(
    out,
    /Claims for PM to check[^\n]*\n {2}S2-2 codex as backend, last active 2026-01-01/,
  );
});

test('only set meta stamps the meta line, so edits to other nodes leave it alone', () => {
  const dir = mkdtempSync(join(tmpdir(), 'state-'));
  mkdirSync(join(dir, 'project/state'), { recursive: true });
  writeFileSync(join(dir, GRAPH), serialise(base()));
  const run = (...args) =>
    execFileSync(
      process.execPath,
      [fileURLToPath(new URL('state.mjs', import.meta.url)), ...args],
      {
        cwd: dir,
        env: { ...process.env, STATE_BY: 'codex/backend' },
      },
    );
  const meta = () => parse(readFileSync(join(dir, GRAPH), 'utf8')).nodes[0];

  run('set', 'S2-2', 'status=review');
  run('add', JSON.stringify({ type: 'risk', id: 'R1', text: 'x', owner: 'qa', status: 'open' }));
  run('claim', 'S2-2', 'codex');
  assert.deepEqual(meta(), base()[0]);

  run('set', 'meta', 'main=def5678');
  assert.equal(meta().main, 'def5678');
  assert.equal(meta().by, 'codex/backend');
  assert.notEqual(meta().updated, '2026-10-22');
  rmSync(dir, { recursive: true });
});
