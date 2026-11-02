import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Opening a memory broke once because the card's code was edited into a shape that reads fine but throws at
// run time: the caption line was replaced by a title line and one variable went missing, so clicking a frame
// did nothing at all. A syntax check cannot see that, and neither can a test that only reads the data files.
//
// So this walks the body of showMemory() as text -- the function that every path into the card goes through
// (the E prompt, the frame tap, the pager, the photo button) -- and checks that every name it uses is either a
// parameter, a module-level binding, an element it just fetched, or declared inside the function itself.

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

/** The source of a top-level function declaration, from its `function` keyword to its closing brace. */
function body(name, source) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name}() is gone`);
  let depth = 0;
  let seen = false;
  for (let i = source.indexOf('{', start); i < source.length; i += 1) {
    if (source[i] === '{') { depth += 1; seen = true; }
    else if (source[i] === '}') {
      depth -= 1;
      if (seen && depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced braces in ${name}()`);
}

test('showMemory uses only names it can actually resolve', () => {
  const fn = body('showMemory', main);
  const params = new Set(['index']);
  // Module scope: imports, consts and the helpers declared around this part of main.js.
  for (const m of main.matchAll(/^(?:import\s+\{([^}]*)\}|const\s+([A-Za-z_$][\w$]*)\s*=|let\s+([A-Za-z_$][\w$]*)\s*=|function\s+([A-Za-z_$][\w$]*))/gm)) {
    if (m[1]) m[1].split(',').forEach((n) => params.add(n.trim().split(/\s+as\s+/).pop()));
    if (m[2]) params.add(m[2]);
    if (m[3]) params.add(m[3]);
    if (m[4]) params.add(m[4]);
  }
  // Locals it declares itself.
  for (const m of fn.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) params.add(m[1]);
  params.add('$'); // the query helper

  // A word inside a comment is not a name, so comment lines are dropped before anything is read.
  const code = fn.replace(/\/\/.*$/gm, '');
  const used = new Set();
  // Identifiers that are followed by a property access or used as a value: `text.title`, `memory.image`.
  for (const m of code.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*(?=\.)/g)) used.add(m[1]);
  // ... and the ones passed around bare (formatNumber(...), textFor(...)).
  for (const m of code.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) used.add(m[1]);

  const keywords = new Set(['if', 'for', 'while', 'return', 'function', 'typeof', 'new', 'catch', 'switch', 'Math', 'String', 'Number', 'Object', 'window', 'document']);
  const unknown = [...used].filter((n) => !params.has(n) && !keywords.has(n));
  assert.deepEqual(unknown, [], `showMemory() refers to undeclared names: ${unknown.join(', ')}`);
});

test('the card still has every element showMemory writes to', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const fn = body('showMemory', main);
  const ids = [...fn.matchAll(/\$\('#([\w-]+)'\)/g)].map((m) => m[1]);
  // The card keeps its name, its count and the photograph; anything else it used to write is gone on purpose.
  assert.ok(ids.length >= 2, 'showMemory stopped writing to the card');
  assert.ok(ids.includes('memory-title'), 'showMemory no longer writes the name');
  for (const id of ids) {
    assert.match(html, new RegExp(`id="${id}"`), `#${id} is not in index.html`);
  }
});

test('every way into the card goes through showMemory', () => {
  // The dialog is opened in four places (prompt, tap on a frame, pager, photo button). All of them must set the
  // card's content first, or a frame opens blank -- which is the other way this has broken before.
  const openers = [...main.matchAll(/openMemory\(/g)].length;
  assert.ok(openers >= 2, 'no caller opens the memory dialog');
  assert.match(main, /function openMemory\([\s\S]*?showMemory\(index\)[\s\S]*?openDialog\(dom\.memory\)/);
});
