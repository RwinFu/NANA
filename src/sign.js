import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import outline from './sign-outline.js';

// The house's name, in acrylic letters above the front door.
//
// The letterforms are not drawn here. `tools/make-sign.mjs` reads them out of Lalezar's own glyph outlines and
// writes src/sign-outline.js; this module turns those outlines into geometry. That is the whole point: the
// sign is made of the curves the type designer drew -- a round O, an R with a leg -- instead of being
// approximated from pixels, which is what it used to be. The old sign drew the line into a canvas, read the
// alpha channel back, and fitted rectangles over the ink; at any rectangle count cheap enough to render, the
// silhouette was wrong (the O came out a diamond) and the sign read as broken.
//
// Lalezar is a dependency of the page already, so the outline file is generated from the very font the
// headings use, and the two can never drift apart.

// Tall capitals, in metres. The band between the top of the arch's crown (6.6 m) and the top of the front wall
// (8.0 m) is where the name can live; at 0.46 m the line is a little wider than the doorway and reads from
// the gate, without crowding the moulding.
export const SIGN_CAP_HEIGHT = 0.46;
// Centre of the letter band, measured up from the doorstep.
export const SIGN_CENTRE_Y = 7.16;
// Thickness of the acrylic. The letters are solid pieces standing on the stone, so their sides catch the
// light and they throw their own small shadows -- a sign painted flat on the wall reads as a decal.
const THICKNESS = 0.085;
const BEVEL = 0.009;

const ACRYLIC = {
  // Pearl, not pink: a pale warm white with a hint of rose, so it belongs to the castle's cream and gold
  // rather than announcing itself in a colour the building does not use.
  color: '#fff1e6',
  roughness: 0.2,
  metalness: 0.0,
  // A little light of its own, so the name still reads when the facade is in shadow at night.
  emissive: '#ffd9c2',
  emissiveIntensity: 0.28,
};

/** Draw one contour of the outline file into a three.js path. */
function contourToPath(contour, path) {
  path.moveTo(...contour.start);
  for (const c of contour.curves) {
    if (c[0] === 'L') path.lineTo(c[1], c[2]);
    else if (c[0] === 'Q') path.quadraticCurveTo(c[1], c[2], c[3], c[4]);
    else if (c[0] === 'C') path.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]);
  }
}

/**
 * Group the contours into shapes and their holes.
 *
 * A letter like O arrives as two contours -- the ring and the counter inside it -- and the counter has to be a
 * hole in the ring or the front face comes out solid and the O reads as a blob. Which is which is decided by
 * nesting: a contour that lies inside another (and is smaller) is a hole in it, one that lies inside nothing
 * is a letter. Signed area alone is not enough, because three.js re-orients the contours it is handed and a
 * hole that is not attached to a shape gets filled in.
 */
export function shapesFromOutline(data) {
  const contours = data.subpaths;
  const boxes = contours.map((c) => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of [c.start, ...c.curves.map((k) => k.slice(-2))]) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    return { x0, y0, x1, y1 };
  });
  const inside = (a, b) => a.x0 >= b.x0 && a.x1 <= b.x1 && a.y0 >= b.y0 && a.y1 <= b.y1
    && (a.x0 > b.x0 || a.x1 < b.x1 || a.y0 > b.y0 || a.y1 < b.y1);
  const depth = contours.map((c, i) => contours.reduce((n, other, j) => (i !== j && inside(boxes[i], boxes[j]) ? n + 1 : n), 0));

  const shapes = [];
  const shapeAt = new Map();
  contours.forEach((contour, i) => {
    if (depth[i] % 2 !== 0) return;
    const shape = new THREE.Shape();
    contourToPath(contour, shape);
    shapeAt.set(i, shape);
    shapes.push(shape);
  });
  contours.forEach((contour, i) => {
    if (depth[i] % 2 === 0) return;
    // Attach the counter to the smallest letter that contains it.
    let parent = null;
    let parentArea = Infinity;
    contours.forEach((other, j) => {
      if (i === j || !shapeAt.has(j) || !inside(boxes[i], boxes[j])) return;
      const area = (boxes[j].x1 - boxes[j].x0) * (boxes[j].y1 - boxes[j].y0);
      if (area < parentArea) {
        parent = shapeAt.get(j);
        parentArea = area;
      }
    });
    if (!parent) return;
    const hole = new THREE.Path();
    contourToPath(contour, hole);
    parent.holes.push(hole);
  });
  return shapes;
}

/** The geometry of the name: one merged mesh, sized and centred, its back face on the wall. */
export function createSignGeometry(data = outline) {
  const shapes = shapesFromOutline(data);
  if (!shapes.length) return null;
  const pieces = shapes.map((shape) => new THREE.ExtrudeGeometry(shape, {
    depth: THICKNESS,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 1,
    curveSegments: 6,
    steps: 1,
  }));
  const merged = mergeGeometries(pieces);
  pieces.forEach((geo) => geo.dispose());

  // The outline is in font units; a capital is `data.capHeight` of them tall.
  const scale = SIGN_CAP_HEIGHT / data.capHeight;
  merged.scale(scale, scale, 1);
  merged.computeBoundingBox();
  const box = merged.boundingBox;
  // Centre the line on the doorway, centre the ink on the band, and turn the extrusion round so it grows out
  // of the wall (+z) instead of into it.
  merged.translate(-(box.max.x + box.min.x) / 2, -(box.max.y + box.min.y) / 2, 0);
  merged.computeBoundingBox();
  merged.computeVertexNormals();
  return merged;
}

/**
 * The sign, as a group whose origin is the centre of the letter band on the wall face: +z out of the facade,
 * +y up, +x to the viewer's right.
 */
export function createSign({ scene, track = (m) => m, data = outline } = {}) {
  const group = new THREE.Group();
  group.name = 'sign-letters';
  // The facade's outer face is at z = 0.3 (the wall is a 0.6 m box centred on the door plane); the letters
  // stand on it and grow outwards to z = 0.39, just inside the gold piping over the arch.
  group.position.set(0, SIGN_CENTRE_Y, 0.3);

  const geometry = createSignGeometry(data);
  if (geometry) {
    const letters = track(new THREE.Mesh(geometry, track(new THREE.MeshStandardMaterial(ACRYLIC))));
    letters.name = 'sign-name';
    group.add(letters);
  }

  scene?.add(group);
  return group;
}
