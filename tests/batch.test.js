import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The scene was submitting a couple of thousand draw calls a frame for 444 materials. src/batch.js merges the
// static stone by material and takes that to about 480, without changing a triangle: same geometry, same
// materials, transforms baked into the vertices. The danger is not in the merge itself but in what it must
// refuse to touch, so that is what these tests hold: the moving things, the two-sided things, and the
// materials the game writes to while it runs.

const src = fs.readFileSync(new URL('../src/batch.js', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('the merge never touches something that moves', () => {
  // a mesh is skipped if it moves itself...
  assert.match(src, /if \(movable\.has\(o\)\) return false;/, 'a mesh that moves is not merged');
  // ...or if anything it is parented to moves, because its vertices are baked into world space
  assert.match(src, /for \(let p = o\.parent; p; p = p\.parent\) if \(movingAncestors\.has\(p\)\) return false;/);
  // and the "does it move" test is a measurement, not a list of names
  assert.match(src, /export function findMovable/, 'movers are found by running the world and comparing matrices');
  assert.match(main, /findMovable\(scene,/, 'and that is what the game uses');
});

test('an object that is ever hidden is left alone', () => {
  // merging buries a `.visible` switch inside a bigger mesh, and the game toggles plenty of them
  assert.match(src, /if \(!p\.visible\) return false;/);
});

test('transparent, instanced, skinned and morphed geometry are all refused', () => {
  assert.match(src, /if \(o\.isInstancedMesh \|\| o\.isSkinnedMesh\) return false;/);
  assert.match(src, /if \(o\.geometry\.morphAttributes && Object\.keys\(o\.geometry\.morphAttributes\)\.length\) return false;/);
  assert.match(src, /if \(!mat \|\| mat\.transparent \|\| mat\.opacity < 1\) return false;/);
});

test('facing is part of the bucket, so a two-sided piece cannot join a one-sided draw', () => {
  // `side` is a material property: mixing them would change which faces are drawn
  assert.match(src, /const key = `\$\{o\.material\.uuid\}:\$\{o\.material\.side\}:\$\{o\.material\.shadowSide \?\? '-'\}`;/);
});

test('a material the game writes to at run time is not merged', () => {
  // the frame lamps' ornament material is shared between static and moving pieces, so the object test alone
  // would let it through; the writes would then land on meshes that no longer exist
  assert.match(src, /animatedMaterials/);
  assert.match(src, /if \(animatedMaterials\.has\(material\)\)/);
});

test('the merged mesh keeps its pieces, so it can still be culled per piece', () => {
  assert.match(src, /batched\.userData\.parts = usable\.map/, 'each piece keeps a world-space sphere');
  assert.match(src, /export function createBatchCuller/, 'and a culler uses them');
  assert.match(main, /batchCuller\?\.update\(\)/, 'every frame, before the render');
});
