// Tests for scripts/state.mjs. Run with: node --test scripts/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { GRAPH, applyEdit, brief, parse, serialise, validate } from './state.mjs';

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
