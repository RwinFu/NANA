import test from 'node:test';
import assert from 'node:assert/strict';

// The hall had a hole in its ceiling, right above the front door.
//
// The front wall stops at 8 m, where `LAYOUT.hallSpring` is 6.15 and the barrel vault over it carries on to
// 10.5 m. The keep, meanwhile, stood at x 0, z -0.6 -- straight over the front of the hall -- with its base
// at 8 m. So there was a two-metre gap the shape of the cap of a circle, and through it you saw the outside
// of the castle: the keep's ashlar courses and its plinth band, sitting on the ceiling, with the flank
// towers either side. It is the first thing anyone sees when they walk in and look up.
//
// Three separate pieces have to stay right for it to stay closed, and each one was wrong at some point
// during the fix, so each one is held here:
//
//   1. the vault's front mouth is capped (world.js),
//   2. the only thing built of the keep below the roof line is the half that faces the garden (castle.js),
//   3. that half keeps the drum's taper, so the castle looks the same from the garden as it always did.
//
// The geometry cannot be raycast here -- building the world needs a canvas -- so this reads the two files as
// text, like tests/hall-walls.test.js and tests/door-piping.test.js do.

const sources = await Promise.all([
  import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/world.js', import.meta.url), 'utf8')),
  import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/castle.js', import.meta.url), 'utf8')),
]);
const [world, castle] = sources;

test('the vault mouth over the front door is capped', () => {
  assert.match(world, /const facadeHeight = 8;/, 'the front wall still stops at 8 m');
  // the cap is built from the vault's own cross-section, from where the vault passes the top of the wall
  assert.match(world, /const tEdge = Math\.asin\(THREE\.MathUtils\.clamp\(\(top - S\) \/ R, -1, 1\)\)/);
  assert.match(world, /const cap = new THREE\.Shape\(\);/, 'a cap shape is built');
  assert.match(world, /new THREE\.Mesh\(capGeo, new THREE\.MeshStandardMaterial\(\{/, 'and a mesh fills it');
  // it must not change how the castle looks from the garden: interior only, no second skin outside
  assert.doesNotMatch(world, /const outer = new THREE\.Mesh\(capGeo/, 'no exterior skin on the cap');
  assert.doesNotMatch(world, /tympanum/, 'no gable was added to the outside of the front wall');
});

test('the keep is only built where the hall cannot see it', () => {
  // the roof ridge, from spring + the roof barrel's radius + the ridge cap
  assert.match(castle, /const keepHidden = 10\.75;/, 'the roof line is named');
  // below the roof line, half a cylinder, centred on +z -- the garden side -- and open
  assert.match(
    castle,
    /new THREE\.CylinderGeometry\(taper\(keepHidden\), KEEP\.r \* 1\.05, lowerH, 32, 1, true, -Math\.PI \/ 2, Math\.PI\)/,
    'the lower drum is the garden-facing half only',
  );
  // above it, a full drum: the hall sees the spire over the roof, which is what the garden sees too
  assert.match(castle, /new THREE\.CylinderGeometry\(KEEP\.r, taper\(upperBase\), upperH, 32\)/, 'the upper drum is whole');
});

test('splitting the keep does not change its silhouette from the garden', () => {
  // the single drum was r * 1.05 at the foot tapering to r at the top; each piece takes the radius the one
  // drum had at its own height, so the two together are the same solid
  assert.match(castle, /const taper = \(y\) => KEEP\.r \* \(1\.05 - \(0\.05 \* \(y - KEEP\.base\)\) \/ keepH\);/, 'the taper is kept');
  assert.match(castle, /taper\(upperBase\)/, 'the upper piece uses it at its foot');
  assert.match(castle, /taper\(keepHidden\)/, 'the lower piece uses it at its top');
  // and the map is still laid out from the base of the drum, so the courses run across the join
  assert.match(castle, /const shift = \(upperBase - KEEP\.base\) \/ TILE;/, 'the upper drum keeps the drum’s UV datum');
  // the keep has not been moved: the castle is the castle it always was
  assert.match(castle, /export const KEEP = \{ x: 0, z: -0\.6, r: 2\.3, base: 8, top: 19 \};/, 'same keep, same place');
});
