import * as THREE from 'three';
import { stoneCanvas, roofCanvas, toTexture } from './town-art.js';
import { stoneNormal } from './architecture.js';

// Cut stone and roof tiles for the castle's outside, shared by the front (castle.js) and by the
// hall's outer walls (world.js).
//
// The maps are drawn once and reused. Mesh UVs are written in *metres* by `boxUV`, so one texture
// tile always covers the same patch of wall no matter how big the box is: without that, a 40 m wall
// and a 1 m pier would both get exactly one tile, and the wall would look like a smear.

const maps = new Map();
export const TILE = 1.6; // metres covered by one texture tile

export function masonryMap({ tone = 176, seed = 31, rows = 7 } = {}) {
  const key = `m${tone}:${seed}:${rows}`;
  if (!maps.has(key)) {
    const tex = toTexture(stoneCanvas({ seed, tone, rows, size: 256 }), 1, 1);
    tex.anisotropy = 8;
    maps.set(key, tex);
  }
  return maps.get(key);
}

export function tileMap({ tone = 120, seed = 33, rows = 9 } = {}) {
  const key = `t${tone}:${seed}:${rows}`;
  if (!maps.has(key)) {
    const tex = toTexture(roofCanvas({ seed, tone, rows, size: 256 }), 1, 1);
    tex.anisotropy = 8;
    maps.set(key, tex);
  }
  return maps.get(key);
}

// A gentle bump: the same stone drawing, so the joints sink and the faces of the blocks stand out
let bumpCache = null;
export function masonryBump(tone = 176) {
  const key = `b${tone}`;
  if (!bumpCache) bumpCache = new Map();
  if (!bumpCache.has(key)) {
    const map = masonryMap({ tone });
    const bump = map.clone();
    bump.colorSpace = THREE.NoColorSpace;
    bump.needsUpdate = true;
    bumpCache.set(key, bump);
  }
  return bumpCache.get(key);
}

// Two normal maps, shared, at 1 tile per TILE metres (the UVs are already in tiles)
let normalCache = null;
function wallNormal() {
  if (!normalCache) {
    const n = stoneNormal(1, 1).clone();
    n.repeat.set(1, 1);
    n.needsUpdate = true;
    normalCache = n;
  }
  return normalCache;
}

// A stone material. `color` tints the greyscale map, so one map serves pale ashlar and darker
// plinth courses.
export function stoneMaterial({
  color = '#f0e4d6',
  tone = 176,
  seed = 31,
  rows = 7,
  roughness = 0.9,
  normal = 0.5,
  metalness = 0,
} = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    map: masonryMap({ tone, seed, rows }),
    bumpMap: masonryBump(tone),
    bumpScale: 0.05,
    normalMap: wallNormal(),
    normalScale: new THREE.Vector2(normal, normal),
    roughness,
    metalness,
  });
}

export function tileMaterial({ color = '#e98fb1', tone = 120, seed = 33, roughness = 0.55 } = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    map: tileMap({ tone, seed }),
    bumpMap: masonryBump(140),
    bumpScale: 0.03,
    roughness,
  });
}

// Rewrite a box's UVs so one tile is `tile` metres wide on every face.
export function boxUV(geo, w, h, d, tile = TILE) {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  // BoxGeometry faces, in order: +x, -x, +y, -y, +z, -z (four vertices each)
  const spans = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f += 1) {
    const [su, sv] = spans[f];
    for (let i = 0; i < 4; i += 1) {
      const idx = f * 4 + i;
      uv.setXY(idx, (uv.getX(idx) * su) / tile, (uv.getY(idx) * sv) / tile);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

// A cone's UVs in metres: `u` round the circumference, `v` up the slope.
export function coneUV(geo, r, h, tile = TILE) {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  const around = (2 * Math.PI * r) / tile;
  const up = Math.hypot(h, r) / tile;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * around, uv.getY(i) * up);
  uv.needsUpdate = true;
  return geo;
}

// A cylinder's UVs in metres, for drums and towers.
export function cylinderUV(geo, r, h, tile = TILE) {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  const around = (2 * Math.PI * r) / tile;
  const up = h / tile;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * around, uv.getY(i) * up);
  uv.needsUpdate = true;
  return geo;
}

// A block of stone with world-scaled UVs: the workhorse for walls, plinths, quoins and piers.
export function stoneBox(parent, material, w, h, d, x, y, z, tile = TILE) {
  const geo = boxUV(new THREE.BoxGeometry(w, h, d), w, h, d, tile);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// A flat panel (gable end, door surround) whose UVs are metres as well, so the map carries on
// across the panel at the same scale as the walls around it.
export function stonePanel(parent, material, shape, x, y, z, tile = TILE) {
  const geo = new THREE.ShapeGeometry(shape, 24);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) {
    uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile);
  }
  uv.needsUpdate = true;
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// A gable roof: two tiled slopes with a ridge, a stone gable end at each side, and eaves that
// overhang the wall. `along` is 'x' (ridge runs left to right) or 'z'.
export function gableRoof({
  parent, tiles, stone, w, d, rise, x, y, z, along = 'x', overhang = 0.35, thickness = 0.16,
  // Per-side overhangs, for a roof that has to butt against another building on one side instead of
  // overhanging it (a symmetric overhang there would push tiles through its wall).
  overhangs = null,
}) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  parent.add(group);
  const oh = overhangs
    ? { x0: overhangs.x0 ?? overhang, x1: overhangs.x1 ?? overhang, z0: overhangs.z0 ?? overhang, z1: overhangs.z1 ?? overhang }
    : { x0: overhang, x1: overhang, z0: overhang, z1: overhang };
  const span = along === 'x' ? d : w; // the direction the slopes run down
  // the two ends of the ridge, and the middle of the roof, in the roof's own frame
  const endA = along === 'x' ? -(w / 2 + oh.x0) : -(d / 2 + oh.z0);
  const endB = along === 'x' ? w / 2 + oh.x1 : d / 2 + oh.z1;
  const centre = (endA + endB) / 2;
  const ridgeSpan = endB - endA;
  const acrossA = -(span / 2) - (along === 'x' ? oh.z0 : oh.x0);
  const acrossB = span / 2 + (along === 'x' ? oh.z1 : oh.x1);
  const acrossCentre = (acrossA + acrossB) / 2;
  const fullSpan = acrossB - acrossA;
  const half = fullSpan / 2;
  const slope = Math.hypot(half, rise);
  const angle = Math.atan2(rise, half);

  [-1, 1].forEach((side) => {
    const slopeW = along === 'x' ? ridgeSpan : slope;
    const slopeD = along === 'x' ? slope : ridgeSpan;
    const geo = boxUV(new THREE.BoxGeometry(slopeW, thickness, slopeD), slopeW, thickness, slopeD);
    const mesh = new THREE.Mesh(geo, tiles);
    const runSide = (side * fullSpan) / 4;
    mesh.position.set(along === 'x' ? centre : acrossCentre + runSide, rise / 2, along === 'x' ? acrossCentre + runSide : centre);
    if (along === 'x') mesh.rotation.x = side * angle;
    else mesh.rotation.z = -side * angle;
    group.add(mesh);
  });

  // stone gable ends, filling the triangles the slopes leave open
  [-1, 1].forEach((side) => {
    const shape = new THREE.Shape();
    shape.moveTo(acrossA, 0);
    shape.lineTo(acrossB, 0);
    shape.lineTo(acrossCentre, rise);
    shape.closePath();
    const at = side < 0 ? endA + 0.02 : endB - 0.02;
    const panel = stonePanel(group, stone, shape, along === 'x' ? at : acrossCentre, 0, along === 'x' ? acrossCentre : at);
    if (along === 'x') panel.rotation.y = side * Math.PI / 2;
  });

  // a stone ridge cap, so the two slopes do not meet in a bare line
  const capW = along === 'x' ? ridgeSpan : 0.42;
  const capD = along === 'x' ? 0.42 : ridgeSpan;
  stoneBox(group, stone, capW, 0.18, capD, along === 'x' ? centre : acrossCentre, rise + 0.04, along === 'x' ? acrossCentre : centre);
  return group;
}
