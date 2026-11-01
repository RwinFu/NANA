import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// A blank page in the preview: one thrown error during the start-up block and nothing is ever drawn,
// so the canvas keeps the colour of the page background. The cause here was a `let` declared far
// below the block that first used it — "Cannot access 'bouquet' before initialization" is a
// ReferenceError, not an `undefined`, so it cannot be guarded with `??` or `if (x)`.
//
// This test reads main.js as text and checks the ordering: any module-level state the start-up block
// (the `if (renderer) { ... }` that builds the world) reads must be declared above it.

const src = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const lines = src.split('\n');

function startBlock() {
  const start = lines.findIndex((l) => l === 'if (renderer) {');
  assert.ok(start > 0, 'the start-up block "if (renderer) {" is missing from main.js');
  let depth = 0;
  for (let i = start; i < lines.length; i += 1) {
    depth += (lines[i].match(/{/g) || []).length;
    depth -= (lines[i].match(/}/g) || []).length;
    if (i > start && depth === 0) return { start, end: i };
  }
  assert.fail('the start-up block is not closed');
}

// Module-level declarations, with the line they start on.
function declarations() {
  const found = new Map();
  lines.forEach((line, i) => {
    const m = line.match(/^(let|const|var|function|class)\s+([A-Za-z_$][\w$]*)/);
    // `function` and `class` declarations hoist, so they are safe to call from above
    if (m && m[1] !== 'function' && m[1] !== 'class') found.set(m[2], i);
  });
  return found;
}

// Identifiers the block really reads: drop strings and comments, property accesses (`a.b`), object
// keys (`key:`), and the block's own local assignments.
function identifiersInBlock(block) {
  const body = lines.slice(block.start, block.end + 1);
  const names = new Set();
  for (const raw of body) {
    const code = raw
      .replace(/\/\/.*$/, '')
      .replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '""');
    for (const m of code.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)/g)) {
      const name = m[2];
      const after = code.slice(m.index + m[0].length).trimStart();
      if (after.startsWith(':')) continue; // an object key, not a read
      names.add(name);
    }
  }
  return names;
}

const block = startBlock();
const declared = declarations();

test('the start-up block reads no module-level state declared below it', () => {
  const read = identifiersInBlock(block);
  // names the block assigns itself are locals of the block
  const locals = new Set();
  for (const line of lines.slice(block.start, block.end + 1)) {
    const m = line.match(/^\s*(?:let|const|var)\s+([A-Za-z_$][\w$]*)/);
    if (m) locals.add(m[1]);
  }

  const problems = [];
  for (const [name, at] of declared) {
    if (locals.has(name)) continue;
    if (!read.has(name)) continue;
    if (at > block.start) problems.push(`${name} is used in the start-up block but declared below it (line ${at + 1})`);
  }
  assert.deepEqual(problems, [], `state used before it exists:\n${problems.join('\n')}`);
});

test('her bouquet state is declared above the start-up block', () => {
  // the specific regression: syncBouquet() reads both of these on the very first call, from inside
  // the start-up block, before the old declarations further down had been reached
  for (const name of ['bouquet', 'rosesBought']) {
    assert.ok(declared.has(name), `let ${name} is missing from main.js`);
    assert.ok(declared.get(name) < block.start, `let ${name} must be declared before the start-up block`);
  }
  assert.ok(
    lines.slice(block.start, block.end).some((l) => l.includes('syncBouquet()')),
    'the start-up block no longer calls syncBouquet(); update this test',
  );
});

test('a start-up failure is not silent: the player gets a message instead of a blank page', () => {
  assert.match(src, /window\.addEventListener\('error'/, 'uncaught start-up errors must be reported to the player');
  assert.match(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /id="webgl-error"/);
});
