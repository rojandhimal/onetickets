#!/usr/bin/env node
// Reads and updates the shared project state graph, project/state/graph.jsonl.
//
// The graph is one JSON node per line (meta, sprint, role, item, pr, decision, risk), so any AI
// tool can read it in one go, grep it, and merge it line by line. Edges are fields that name other
// nodes: item.deps, item.prs, item.owner, item.sprint, pr.item. No dependencies beyond Node 22.
//
// Usage, from the repo root (see project/state/README.md):
//   node scripts/state.mjs                    brief: what's active, open PRs, roles, what needs tegs
//   node scripts/state.mjs show <id>          one node with its edges in both directions
//   node scripts/state.mjs role <role>        a role's node and its unfinished items
//   node scripts/state.mjs list [k=v ...]     nodes matching every filter, e.g. type=item status=ready
//   node scripts/state.mjs set <id> k=v ...   update a node: k=v sets, k+=v appends, k-=v removes,
//                                             k= deletes; dotted keys reach nested objects
//                                             (reviews.qa=pass@abc1234). Values parse as JSON when
//                                             they can, so prs+=55 adds a number
//   node scripts/state.mjs add '<json>'       add a node: a PR goes after its item (or its branch's
//                                             last PR), anything else at the end
//   node scripts/state.mjs next [agent] [role] your unfinished items, then unassigned ready ones
//   node scripts/state.mjs claim <id> [agent] take an item: one at a time per agent and role
//   node scripts/state.mjs release <id>       PM: take the agent off an item (inactive > 5 days)
//   node scripts/state.mjs check              validate; exits 1 on an error (runs in pnpm lint)
// set meta also stamps meta.updated with today's date and meta.by with $STATE_BY when it is set.
// Other edits leave the meta line alone, so PRs that change different nodes don't collide on it.
// $STATE_BY is <agent>/<role>, e.g. codex/frontend; next and claim read their defaults from it.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const GRAPH = 'project/state/graph.jsonl';

export const SCHEMA = {
  meta: { required: ['updated', 'by', 'main', 'sprint', 'phase'] },
  sprint: { required: ['name', 'status'], status: ['planned', 'in_progress', 'done'] },
  role: { required: ['name', 'now', 'next', 'blocked'] },
  item: {
    required: ['title', 'status', 'owner'],
    status: ['backlog', 'ready', 'in_progress', 'review', 'blocked', 'done', 'dropped'],
  },
  pr: {
    required: ['title', 'state', 'branch'],
    state: ['draft', 'open', 'merged', 'closed'],
  },
  decision: { required: ['date', 'text', 'by'] },
  risk: { required: ['text', 'owner', 'status'], status: ['open', 'closed'] },
};

const ACTIVE = ['in_progress', 'review', 'blocked', 'ready'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Task assignment (working agreement section 5). An item's `agent` is the AI provider working on
// it (claude, codex, gemini, ...); no agent means unassigned. Each agent holds one task at a time
// per role: one item in progress or blocked. PM takes the agent off a task when it has had no
// activity for more than STALE_DAYS, so another agent can pick it up.
export const STALE_DAYS = 5;
const HELD = ['in_progress', 'blocked'];
const AGENT = /^[a-z][a-z0-9-]*$/;

export function parse(text) {
  const nodes = [];
  const errors = [];
  text.split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    try {
      nodes.push(JSON.parse(line));
    } catch (error) {
      errors.push(`line ${i + 1}: not valid JSON (${error.message})`);
    }
  });
  return { nodes, errors };
}

export const serialise = (nodes) => nodes.map((node) => JSON.stringify(node)).join('\n') + '\n';

const prNumber = (ref) => Number(String(ref).replace(/^#/, ''));

export function validate(nodes) {
  const errors = [];
  const byId = new Map();
  for (const node of nodes) {
    const where = `${node.type ?? '?'} ${node.id ?? '?'}`;
    const schema = SCHEMA[node.type];
    if (!schema) {
      errors.push(`${where}: unknown type`);
      continue;
    }
    if (typeof node.id !== 'string' || !node.id) errors.push(`${where}: id must be a string`);
    else if (byId.has(node.id)) errors.push(`${where}: duplicate id`);
    else byId.set(node.id, node);
    for (const key of schema.required) {
      if (node[key] === undefined || node[key] === null) errors.push(`${where}: missing ${key}`);
    }
    for (const key of ['status', 'state']) {
      if (schema[key] && node[key] !== undefined && !schema[key].includes(node[key])) {
        errors.push(`${where}: ${key} "${node[key]}" is not one of ${schema[key].join(', ')}`);
      }
    }
    for (const key of ['updated', 'date', 'claimed', 'active']) {
      if (node[key] !== undefined && !DATE.test(node[key])) {
        errors.push(`${where}: ${key} must be YYYY-MM-DD`);
      }
    }
  }
  if (nodes.filter((node) => node.type === 'meta').length !== 1) {
    errors.push('graph needs exactly one meta node');
  }

  const expect = (where, ref, type) => {
    const target = byId.get(ref);
    if (!target) errors.push(`${where}: unknown ${type} "${ref}"`);
    else if (target.type !== type)
      errors.push(`${where}: "${ref}" is a ${target.type}, not ${type}`);
  };
  const prIds = new Set(nodes.filter((n) => n.type === 'pr').map((n) => prNumber(n.id)));
  for (const node of nodes) {
    const where = `${node.type} ${node.id}`;
    if (node.type === 'meta') expect(where, node.sprint, 'sprint');
    if (node.type === 'item') {
      expect(where, node.owner, 'role');
      if (node.sprint) expect(where, node.sprint, 'sprint');
      for (const dep of node.deps ?? []) expect(where, dep, 'item');
      for (const role of node.reviewers ?? []) expect(where, role, 'role');
      for (const n of node.prs ?? []) {
        if (!Number.isInteger(n)) errors.push(`${where}: prs holds PR numbers, got ${n}`);
      }
      if (node.agent !== undefined && !AGENT.test(node.agent)) {
        errors.push(`${where}: agent is a lowercase provider name like claude or codex`);
      }
    }
    if (node.type === 'pr') {
      if (!/^#\d+$/.test(node.id)) errors.push(`${where}: pr ids look like #54`);
      if (node.item) expect(where, node.item, 'item');
      if (node.author) expect(where, node.author, 'role');
    }
    if (node.type === 'risk') expect(where, node.owner.split(',')[0].trim(), 'role');
  }
  const held = new Map();
  for (const node of nodes) {
    if (node.type !== 'item' || !node.agent || !HELD.includes(node.status)) continue;
    const key = `${node.agent} ${node.owner}`;
    if (held.has(key)) {
      errors.push(
        `item ${node.id}: ${node.agent} already holds ${held.get(key)} as ${node.owner}; ` +
          'one task at a time, so finish or release one',
      );
    } else held.set(key, node.id);
  }
  for (const node of nodes) {
    if (node.type === 'item' && node.prs) {
      for (const n of node.prs) {
        const pr = byId.get(`#${n}`);
        if (prIds.has(n) && pr.item && pr.item !== node.id && !(pr.also ?? []).includes(node.id)) {
          errors.push(`item ${node.id}: lists #${n}, but #${n} points at ${pr.item}`);
        }
      }
    }
  }

  // Dependency cycles.
  const seen = new Map();
  const visit = (id, path) => {
    if (seen.get(id) === 'done') return;
    if (seen.get(id) === 'open') {
      errors.push(`dependency cycle: ${[...path, id].join(' -> ')}`);
      return;
    }
    seen.set(id, 'open');
    for (const dep of byId.get(id)?.deps ?? []) if (byId.has(dep)) visit(dep, [...path, id]);
    seen.set(id, 'done');
  };
  for (const node of nodes) if (node.type === 'item') visit(node.id, []);
  return errors;
}

// Applies one k=v, k+=v, k-=v or k= edit to a node, in place.
export function applyEdit(node, edit) {
  const match = /^([\w.-]+?)([+-]?)=(.*)$/s.exec(edit);
  if (!match) throw new Error(`can't read "${edit}"; use key=value, key+=value or key-=value`);
  const [, path, op, raw] = match;
  if (path === 'id' || path === 'type') throw new Error(`${path} can't be changed`);
  let value = raw;
  try {
    value = JSON.parse(raw);
  } catch {
    // Plain text.
  }
  const keys = path.split('.');
  const last = keys.pop();
  let target = node;
  for (const key of keys) {
    if (typeof target[key] !== 'object' || target[key] === null) target[key] = {};
    target = target[key];
  }
  if (op === '+') {
    const list = target[last] ?? [];
    if (!Array.isArray(list)) throw new Error(`${path} is not a list`);
    if (!list.includes(value)) list.push(value);
    target[last] = list;
  } else if (op === '-') {
    if (!Array.isArray(target[last])) throw new Error(`${path} is not a list`);
    target[last] = target[last].filter((entry) => entry !== value);
  } else if (raw === '') {
    delete target[last];
  } else {
    target[last] = value;
  }
}

const today = () => new Date().toISOString().slice(0, 10);

/** The agent and role named by $STATE_BY (<agent>/<role>). */
const stateBy = () => {
  const [agent, role] = (process.env.STATE_BY ?? '').split('/');
  return { agent: agent || undefined, role: role || undefined };
};

export const daysSince = (date, now = today()) =>
  Math.round((Date.parse(now) - Date.parse(date)) / 86_400_000);

const lastActive = (item) => item.active ?? item.claimed ?? item.updated;

/** Items whose agent has done nothing on them for more than STALE_DAYS. */
export function staleClaims(nodes, now = today()) {
  return nodes.filter(
    (n) =>
      n.type === 'item' &&
      n.agent &&
      HELD.includes(n.status) &&
      daysSince(lastActive(n), now) > STALE_DAYS,
  );
}

const depsDone = (nodes, item) =>
  (item.deps ?? []).every((dep) => nodes.find((n) => n.id === dep)?.status === 'done');

/** Ready items nobody holds, with their dependencies done. tegs's own items are not for agents. */
export function unassigned(nodes, role) {
  return nodes.filter(
    (n) =>
      n.type === 'item' &&
      n.status === 'ready' &&
      !n.agent &&
      n.owner !== 'tegs' &&
      (!role || n.owner === role) &&
      depsDone(nodes, n),
  );
}

/**
 * Keeps an item's claim dates in step after a set, in place: a new agent starts its claim today,
 * no agent clears the dates, and the agent's own edits ($STATE_BY) keep it active. Dates given in
 * the same set win.
 */
export function stampClaim(node, before, edited, by = stateBy().agent, now = today()) {
  if (node.type !== 'item') return;
  if (!node.agent) {
    delete node.claimed;
    delete node.active;
  } else if (node.agent !== before) {
    if (!edited.includes('claimed')) node.claimed = now;
    if (!edited.includes('active')) node.active = now;
  } else if (by === node.agent && !edited.includes('active')) node.active = now;
}

/** Gives an item to an agent, in place. Throws if someone else holds it or the agent is busy. */
export function claim(nodes, id, agent, now = today()) {
  const item = nodes.find((n) => n.id === id);
  if (!item || item.type !== 'item') throw new Error(`no item "${id}"`);
  if (!agent || !AGENT.test(agent)) {
    throw new Error('name the agent: a lowercase provider like claude or codex (or set STATE_BY)');
  }
  if (['done', 'dropped'].includes(item.status)) throw new Error(`${id} is ${item.status}`);
  if (item.agent && item.agent !== agent) {
    const days = daysSince(lastActive(item), now);
    throw new Error(
      `${id} is held by ${item.agent}, last active ${lastActive(item)}` +
        (days > STALE_DAYS ? `, ${days} days ago: ask PM to release it` : ''),
    );
  }
  const busy = nodes.find(
    (n) =>
      n !== item &&
      n.type === 'item' &&
      n.agent === agent &&
      n.owner === item.owner &&
      HELD.includes(n.status),
  );
  if (busy) {
    throw new Error(
      `${agent} already holds ${busy.id} as ${item.owner}. One task at a time: move it to review ` +
        `or done, or release it, first`,
    );
  }
  if (item.agent !== agent) item.claimed = now;
  item.agent = agent;
  item.active = now;
  if (['backlog', 'ready'].includes(item.status)) item.status = 'in_progress';
  return item;
}

/**
 * Adds a node, in place. A PR goes after its item and that item's other PRs, or with no item after
 * the last PR from its branch, so PRs for different work land on different lines and don't conflict
 * at the end of the file. Anything else goes last.
 */
export function insertNode(nodes, node) {
  const sameWork = node.item
    ? (n) => n.id === node.item || (n.type === 'pr' && n.item === node.item)
    : (n) => n.type === 'pr' && n.branch === node.branch;
  let at = -1;
  if (node.type === 'pr') {
    nodes.forEach((n, i) => {
      if (sameWork(n)) at = i;
    });
  }
  if (at === -1) nodes.push(node);
  else nodes.splice(at + 1, 0, node);
  return node;
}

/** Takes the agent off an item, in place, so another agent can claim it. */
export function release(nodes, id) {
  const item = nodes.find((n) => n.id === id);
  if (!item || item.type !== 'item') throw new Error(`no item "${id}"`);
  if (!item.agent) throw new Error(`${id} has no agent`);
  delete item.agent;
  delete item.claimed;
  delete item.active;
  if (item.status === 'in_progress') item.status = 'ready';
  return item;
}

/** What an agent should do at the start of a session: its own work first, then a free item. */
export function next(nodes, agent, role, now = today()) {
  const mine = nodes.filter(
    (n) =>
      n.type === 'item' &&
      n.agent === agent &&
      (!role || n.owner === role) &&
      !['done', 'dropped'].includes(n.status),
  );
  const out = [`${agent}${role ? ` as ${role}` : ''}: one task at a time per role.`, '', 'Yours:'];
  if (!mine.length) out.push('  none');
  for (const n of mine) {
    const prs = (n.prs ?? []).map((pr) => `#${pr}`).join(' ');
    const days = daysSince(lastActive(n), now);
    out.push(
      `  ${n.status.padEnd(11)} ${n.id.padEnd(8)} ${n.owner.padEnd(8)} ${short(n.title, 60)}` +
        `${prs ? ` [${prs}]` : ''}, last active ${lastActive(n)}` +
        (HELD.includes(n.status) && days > STALE_DAYS ? ` (${days} days: PM may release it)` : ''),
    );
  }
  const held = mine.filter((n) => HELD.includes(n.status));
  if (held.length) {
    out.push(
      '',
      `Finish ${held.map((n) => n.id).join(', ')} (or release it) before claiming more.`,
    );
    return out.join('\n');
  }
  out.push(
    '',
    `Unassigned and ready (claim one with: node scripts/state.mjs claim <id> ${agent}):`,
  );
  const free = unassigned(nodes, role);
  if (!free.length) out.push('  none');
  for (const n of free) out.push(`  ${n.id.padEnd(8)} ${n.owner.padEnd(8)} ${short(n.title, 80)}`);
  return out.join('\n');
}

function stamp(nodes) {
  const meta = nodes.find((node) => node.type === 'meta');
  if (!meta) return;
  meta.updated = today();
  if (process.env.STATE_BY) meta.by = process.env.STATE_BY;
}

function git(...args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

const short = (text, max = 110) => {
  const flat = String(text ?? '').replace(/\s+/g, ' ');
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

export function brief(nodes) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const of = (type) => nodes.filter((node) => node.type === type);
  const meta = byId.get('meta');
  const sprint = byId.get(meta.sprint);
  const out = [];

  const head =
    git('rev-parse', '--short=7', 'origin/main') ?? git('rev-parse', '--short=7', 'main');
  const drift =
    head && head.trim() !== meta.main
      ? ` (main is now ${head.trim()}: check what merged since)`
      : '';
  out.push(`OneTickets state, updated ${meta.updated} by ${meta.by}, at main ${meta.main}${drift}`);
  out.push(`Sprint: ${sprint.id} ${sprint.name} (${sprint.status}). ${meta.phase}`);

  out.push('', 'Active items (status, id, owner, agent, title, waiting on):');
  const items = of('item').filter((item) => ACTIVE.includes(item.status));
  items.sort((a, b) => ACTIVE.indexOf(a.status) - ACTIVE.indexOf(b.status));
  for (const item of items) {
    const open = (item.deps ?? []).filter((dep) => byId.get(dep)?.status !== 'done');
    const prs = (item.prs ?? []).map((n) => `#${n}`).join(' ');
    const waits = [open.length ? `deps ${open.join(', ')}` : '', item.waiting ?? '']
      .filter(Boolean)
      .join('; ');
    out.push(
      `  ${item.status.padEnd(11)} ${item.id.padEnd(8)} ${item.owner.padEnd(8)} ${(item.agent ?? '-').padEnd(7)} ${short(item.title, 60)}` +
        `${prs ? ` [${prs}]` : ''}${waits ? `, waiting on ${short(waits, 70)}` : ''}`,
    );
  }

  const stale = staleClaims(nodes);
  out.push('', `Claims for PM to check (no activity for more than ${STALE_DAYS} days):`);
  if (!stale.length) out.push('  none');
  for (const item of stale) {
    out.push(`  ${item.id} ${item.agent} as ${item.owner}, last active ${lastActive(item)}`);
  }
  const free = unassigned(nodes);
  out.push(
    '',
    `Unassigned and ready: ${free.map((item) => item.id).join(', ') || 'none'}` +
      ' (node scripts/state.mjs next <agent> <role>)',
  );

  const open = of('pr').filter((pr) => pr.state === 'open' || pr.state === 'draft');
  out.push('', 'Open PRs:');
  if (!open.length) out.push('  none');
  for (const pr of open) {
    const reviews = Object.entries(pr.reviews ?? {})
      .map(([role, verdict]) => `${role} ${verdict}`)
      .join(', ');
    out.push(
      `  ${pr.id} ${pr.state} ${pr.item ?? '-'} ${pr.branch}: ${short(pr.title, 60)}` +
        `. Reviews: ${reviews || 'none yet'}. CI: ${pr.ci ?? 'unknown'}`,
    );
  }

  out.push('', 'Roles (now | next | blocked):');
  for (const role of of('role').filter((role) => role.id !== 'tegs')) {
    out.push(
      `  ${role.id.padEnd(8)} ${short(role.now, 50)} | ${short(role.next, 60)} | ${short(role.blocked, 40)}`,
    );
  }

  const tegs = byId.get('tegs');
  const forTegs = of('item').filter(
    (item) => item.owner === 'tegs' && ACTIVE.includes(item.status),
  );
  out.push('', 'Needs tegs:');
  if (tegs?.next) out.push(`  ${short(tegs.next, 200)}`);
  for (const item of forTegs) out.push(`  ${item.id}: ${short(item.title, 90)}`);
  for (const risk of of('risk').filter((r) => r.status === 'open' && r.owner.startsWith('tegs'))) {
    out.push(`  ${risk.id}: ${short(risk.action, 100)}`);
  }

  const decisions = of('decision').slice(-5);
  out.push('', 'Latest decisions:');
  for (const d of decisions) out.push(`  ${d.date} ${d.id}: ${short(d.text, 120)} (${d.by})`);
  out.push(
    '',
    'More: node scripts/state.mjs show <id> | role <role> | list type=item status=backlog',
  );
  return out.join('\n');
}

export function show(nodes, id) {
  const node = nodes.find((n) => n.id === id || n.id === `#${id}`);
  if (!node) return null;
  const lines = [JSON.stringify(node, null, 2)];
  const linked = nodes.filter(
    (n) =>
      n !== node &&
      ((n.deps ?? []).includes(node.id) ||
        n.item === node.id ||
        (n.also ?? []).includes(node.id) ||
        n.owner === node.id ||
        n.sprint === node.id ||
        (node.type === 'pr' && (n.prs ?? []).includes(prNumber(node.id))) ||
        (node.prs ?? []).includes(prNumber(n.id))),
  );
  if (linked.length) {
    lines.push('Linked:');
    for (const n of linked)
      lines.push(
        `  ${n.type} ${n.id}: ${short(n.title ?? n.name ?? n.text, 90)} (${n.status ?? n.state ?? ''})`,
      );
  }
  return lines.join('\n');
}

export function filter(nodes, filters) {
  return nodes.filter((node) =>
    filters.every((f) => {
      const [key, value] = f.split('=');
      const field = node[key];
      return Array.isArray(field) ? field.map(String).includes(value) : String(field) === value;
    }),
  );
}

function main(argv) {
  const [command = 'brief', ...rest] = argv;
  const text = readFileSync(GRAPH, 'utf8');
  const { nodes, errors: parseErrors } = parse(text);
  const fail = (lines) => {
    console.error(lines.join('\n'));
    process.exit(1);
  };
  if (parseErrors.length) fail(parseErrors);

  const save = () => {
    const errors = validate(nodes);
    if (errors.length) fail(['Not saved:', ...errors]);
    writeFileSync(GRAPH, serialise(nodes));
  };

  switch (command) {
    case 'brief':
      console.log(brief(nodes));
      break;
    case 'check': {
      const errors = validate(nodes);
      if (text !== serialise(nodes))
        errors.push(`${GRAPH}: write one compact JSON node per line (run any set to rewrite it)`);
      if (errors.length) fail(errors);
      console.log(`${GRAPH}: ${nodes.length} nodes, valid`);
      break;
    }
    case 'show': {
      const out = show(nodes, rest[0]);
      if (!out) fail([`no node "${rest[0]}"`]);
      console.log(out);
      break;
    }
    case 'role': {
      const role = nodes.find((n) => n.type === 'role' && n.id === rest[0]);
      if (!role) fail([`no role "${rest[0]}"`]);
      console.log(JSON.stringify(role, null, 2));
      const mine = nodes.filter(
        (n) =>
          n.type === 'item' && n.owner === role.id && ACTIVE.concat('backlog').includes(n.status),
      );
      const reviewing = nodes.filter(
        (n) =>
          n.type === 'item' &&
          (n.reviewers ?? []).includes(role.id) &&
          ['in_progress', 'review'].includes(n.status),
      );
      for (const [label, list] of [
        ['Owns', mine],
        ['Reviews', reviewing],
      ]) {
        console.log(`${label}:`);
        for (const n of list)
          console.log(
            `  ${n.status.padEnd(11)} ${n.id}: ${short(n.title, 90)}${n.agent ? ` (${n.agent})` : ''}`,
          );
      }
      break;
    }
    case 'list':
      for (const n of filter(nodes, rest)) console.log(JSON.stringify(n));
      break;
    case 'set': {
      const [id, ...edits] = rest;
      const node = nodes.find((n) => n.id === id);
      if (!node) fail([`no node "${id}"; add it with: node scripts/state.mjs add '<json>'`]);
      const before = node.agent;
      for (const edit of edits) applyEdit(node, edit);
      if (node.type === 'meta') stamp(nodes);
      else if (node.type !== 'decision') node.updated = today();
      stampClaim(
        node,
        before,
        edits.map((edit) => edit.split(/[+-]?=/)[0]),
      );
      save();
      console.log(JSON.stringify(node));
      break;
    }
    case 'add': {
      const node = JSON.parse(rest.join(' '));
      if (node.type === 'item' || node.type === 'role') node.updated ??= today();
      insertNode(nodes, node);
      save();
      console.log(JSON.stringify(node));
      break;
    }
    case 'next': {
      const by = stateBy();
      const [agent = by.agent, role = by.role] = rest;
      if (!agent) fail(['usage: node scripts/state.mjs next <agent> [role] (or set STATE_BY)']);
      console.log(next(nodes, agent, role));
      break;
    }
    case 'claim':
    case 'release': {
      const [id, agent = stateBy().agent] = rest;
      let node;
      try {
        node = command === 'claim' ? claim(nodes, id, agent) : release(nodes, id);
      } catch (error) {
        fail([error.message]);
      }
      node.updated = today();
      save();
      console.log(JSON.stringify(node));
      break;
    }
    default:
      fail([
        `unknown command "${command}". Commands: brief, show, role, list, set, add, next, claim, release, check`,
      ]);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
