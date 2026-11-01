import * as THREE from 'three';
import { stoneMaterial, tileMaterial, stoneBox, stonePanel, gableRoof, TILE } from './castle-stone.js';

// The outside of the castle behind its pretty front: the two side walls of the gallery hall, the
// barrel roof over the vault, the memory room as a stone annex with a tiled roof, and the rear wall.
//
// These used to be flat cream panels, which from the garden (and from the lane) read as big blank
// boxes. Everything here is masonry at a real scale, with the things a stone wall of that size
// actually has: a plinth, buttresses, a string course, slit windows, quoins at the corners, and
// eaves. Normals and UVs are shared and cheap, so the count stays low.

const SEGMENTS = 24;

// A stone buttress: a pier with a weathered cap, standing proud of the wall.
function buttress(parent, mat, capMat, x, y0, y1, z, depth, width, facing = 1) {
  const h = y1 - y0;
  stoneBox(parent, mat, depth, h, width, x + (facing * depth) / 2, y0 + h / 2, z);
  // the cap: a short block set back a little, then a sloped top
  stoneBox(parent, capMat, depth * 1.15, 0.18, width * 1.15, x + (facing * depth) / 2, y1 + 0.09, z);
  const slope = stoneBox(parent, capMat, depth * 1.3, 0.3, width * 1.05, x + (facing * depth) / 2, y1 + 0.32, z);
  slope.rotation.z = facing * 0.35;
  return slope;
}

// An arrow loop: a deep dark slot in a projecting stone surround, with a sill under it and a lintel
// over it. On a long wall these are what give the eye a scale, so they are worth building properly.
function arrowSlit(parent, dark, surround, x, y, z, facing = 1, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  parent.add(g);
  // the surround stands proud of the wall, so it casts a line on its own
  stoneBox(g, surround, 0.14, 1.34, 0.56, facing * 0.05, 0, 0);
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.72), dark);
  hole.position.set(facing * 0.15, 0, 0);
  hole.rotation.y = facing > 0 ? Math.PI / 2 : -Math.PI / 2;
  g.add(hole);
  // the cross of an archer's loop, sunk in the dark
  const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1), dark);
  slot.position.set(facing * 0.155, 0.08, 0);
  slot.rotation.y = facing > 0 ? Math.PI / 2 : -Math.PI / 2;
  g.add(slot);
  // sill and lintel
  stoneBox(g, surround, 0.26, 0.11, 0.7, facing * 0.09, -0.7, 0);
  stoneBox(g, surround, 0.22, 0.11, 0.64, facing * 0.08, 0.71, 0);
  return g;
}

export function buildCastleOuter(scene, track, { hallHalfWidth = 3.85, spring = 6.15, length = 40, room } = {}) {
  const group = new THREE.Group();
  group.name = 'castle-outer';
  scene.add(group);

  const wallStone = track(stoneMaterial({ color: '#ddd0c4', tone: 168, seed: 31, rows: 7, normal: 0.6 }));
  const plinthStone = track(stoneMaterial({ color: '#b9aca2', tone: 150, seed: 37, rows: 5, normal: 0.7 }));
  const trimStone = track(stoneMaterial({ color: '#efe4d8', tone: 182, seed: 43, rows: 8, normal: 0.45, roughness: 0.8 }));
  const wallStone2 = track(stoneMaterial({ color: '#d3c6ba', tone: 160, seed: 91, rows: 7, normal: 0.6 }));
  const roofTiles = track(tileMaterial({ color: '#d79ab0', tone: 126, seed: 51, roughness: 0.6 }));
  const roomTiles = track(tileMaterial({ color: '#8d9aa6', tone: 96, seed: 57, roughness: 0.62 }));
  // a slot: near-black, but with a little sheen, so it reads as depth rather than a cut-out
  const darkMat = track(new THREE.MeshStandardMaterial({ color: '#1b1420', roughness: 0.55, metalness: 0.15 }));
  // dark leaded glass, with a faint warm reflection so it is glass and not a black hole
  const paneMat = track(new THREE.MeshStandardMaterial({ color: '#241a2c', roughness: 0.25, metalness: 0.35, emissive: '#3a2418', emissiveIntensity: 0.35 }));
  // contact shadow at the foot of a wall, so the stone sits on the ground instead of floating on it
  const footShade = track(new THREE.MeshBasicMaterial({ color: '#0a0710', transparent: true, opacity: 0.3, depthWrite: false }));
  // a translucent smudge for weathered stone: no map, just a darker tint that fades upward
  const streakMat = track(new THREE.MeshBasicMaterial({ color: '#8f8074', transparent: true, opacity: 0.1, depthWrite: false }));

  const wallX = hallHalfWidth + 0.3; // the inside wall's outer face
  const wallT = 0.34; // the thickness of the stone we add outside it
  const cx = wallX + wallT / 2;
  const plinthTop = 0.95;
  const courseY = spring - 0.42;

  // ---- Side walls ---------------------------------------------------------
  // The hall's own walls run under the roof, so these are the visible outer faces. On the west the
  // memory room takes the middle of the run, and its own walls close that stretch.
  const segments = {
    1: [[0.35, -length]],
    [-1]: [[0.35, room.oz1], [room.oz0, -length]],
  };

  Object.entries(segments).forEach(([key, pieces]) => {
    const side = Number(key);
    pieces.forEach(([za, zb]) => {
      const len = za - zb;
      const zc = (za + zb) / 2;
      const x = side * cx;

      // each stretch gets one of two stone tones, so a 40 m run does not read as one slab
      const wallMat = Math.round(Math.abs(zc)) % 3 === 0 ? wallStone2 : wallStone;
      stoneBox(group, wallMat, wallT, spring, len, x, spring / 2, zc);
      // plinth, standing a little proud of the wall
      stoneBox(group, plinthStone, wallT + 0.14, plinthTop, len, x, plinthTop / 2, zc);
      stoneBox(group, trimStone, wallT + 0.2, 0.1, len, x, plinthTop + 0.05, zc);
      // string course, and the eaves the roof sits on
      stoneBox(group, trimStone, wallT + 0.1, 0.16, len, x, courseY, zc);
      stoneBox(group, trimStone, wallT + 0.26, 0.2, len + 0.2, x, spring - 0.1, zc);

      // buttresses, with a slit window between each pair
      const step = 4.4;
      let n = 0;
      for (let z = za - 1.0; z > zb + 0.6; z -= step) {
        buttress(group, plinthStone, trimStone, side * wallX, 0, spring - 0.35, z, 0.62, 0.72, side);
        const mid = z - step / 2;
        if (mid > zb + 1.1 && mid < za - 1.1) {
          arrowSlit(group, darkMat, trimStone, side * wallX, 3.3 + (n % 2) * 0.4, mid, side, side > 0 ? 0 : Math.PI);
        }
        n += 1;
      }
      // a soft contact shadow where the plinth meets the ground
      const foot = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.9), footShade);
      foot.position.set(side * (wallX + wallT + 0.02), 0.35, zc);
      foot.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(foot);
      // rain streaks running down from the eaves, darker at the top, faded out by mid-wall
      for (let k = 1; k < 6; k += 1) {
        const zz = za - (len * k) / 6 + 0.4;
        const g = new THREE.Mesh(new THREE.PlaneGeometry(0.5 + (k % 3) * 0.35, 3.6), streakMat);
        g.position.set(side * (wallX + wallT + 0.006), spring - 1.9, zz);
        g.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        group.add(g);
      }
      // a putlog hole or two, so the wall is not a single tone all the way along
      for (let k = 0; k < Math.max(1, Math.round(len / 6)); k += 1) {
        const zz = za - 2.5 - k * (len / Math.max(1, Math.round(len / 6)));
        if (zz < zb + 1) break;
        const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), darkMat);
        hole.position.set(side * (wallX + 0.005), 4.9, zz);
        hole.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        group.add(hole);
      }
    });
  });

  // ---- Barrel roof over the vault ----------------------------------------
  // The hall's ceiling is a half cylinder; outside it becomes a tiled roof, with a stone ridge and
  // eaves at both ends. This is the big surface you see from the garden.
  {
    const radius = hallHalfWidth + 0.5;
    const z0 = 0.45;
    const z1 = -length - 0.45;
    const pos = [];
    const uv = [];
    const idx = [];
    for (let ring = 0; ring < 2; ring += 1) {
      const z = ring === 0 ? z0 : z1;
      for (let i = 0; i <= SEGMENTS; i += 1) {
        const a = (i / SEGMENTS) * Math.PI;
        const arc = a * radius;
        pos.push(radius * Math.cos(a), spring + radius * Math.sin(a), z);
        uv.push(arc / TILE, (ring === 0 ? 0 : (z0 - z1) / TILE));
      }
    }
    // Wind the triangles so their fronts face out of the roof: with the default FrontSide material
    // the other way round, the tiled barrel is invisible from outside and the dark vault shows.
    for (let i = 0; i < SEGMENTS; i += 1) {
      const a = i;
      const b = i + 1;
      const c = SEGMENTS + 1 + i;
      const d = SEGMENTS + 2 + i;
      idx.push(a, c, b, b, c, d);
    }
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const roof = new THREE.Mesh(geo, roofTiles);
    group.add(roof);

    // ridge cap along the crown, and a stone verge at each end
    stoneBox(group, trimStone, 0.62, 0.22, z0 - z1, 0, spring + radius + 0.02, (z0 + z1) / 2);
    [z0, z1].forEach((z) => {
      const verge = new THREE.Mesh(track(new THREE.TorusGeometry(radius + 0.02, 0.11, 6, 32, Math.PI)), trimStone);
      verge.position.set(0, spring, z);
      group.add(verge);
    });
  }

  // ---- The memory room, as a stone annex ----------------------------------
  if (room) {
    const H = room.height;
    const { ox0, ox1, oz0, oz1 } = room;
    const t = 0.34;
    // The annex stops at the hall's own wall. `ox1` is the outer face of that wall (the room's east
    // side), so the annex's north and south walls have to end at the room's inner face `ix1`. Running
    // them on to ox1 puts a metre of stone, quoins and roof inside the hall, over the photo frames.
    const xStop = room.ix1 ?? ox1;
    const wSpan = xStop - ox0;
    const dSpan = oz1 - oz0;
    const xc = (ox0 + xStop) / 2;
    const zc = (oz0 + oz1) / 2;

    // three outer walls: west (x = ox0), south (z = oz0), north (z = oz1), all stopping at the hall
    stoneBox(group, wallStone, t, H, dSpan + t * 2, ox0 - t / 2, H / 2, zc);
    stoneBox(group, wallStone, wSpan, H, t, xc, H / 2, oz0 - t / 2);
    stoneBox(group, wallStone, wSpan, H, t, xc, H / 2, oz1 + t / 2);
    // plinth all round
    stoneBox(group, plinthStone, t + 0.14, plinthTop, dSpan + t * 2 + 0.14, ox0 - t / 2, plinthTop / 2, zc);
    stoneBox(group, plinthStone, wSpan + 0.14, plinthTop, t + 0.14, xc, plinthTop / 2, oz0 - t / 2);
    stoneBox(group, plinthStone, wSpan + 0.14, plinthTop, t + 0.14, xc, plinthTop / 2, oz1 + t / 2);
    // The hall's wall stops at the springline (6.15 m) but the annex's ceiling slab starts at 6.40 m,
    // which left a slot at the junction that you could see the roof through from inside the room.
    // This fills it exactly over the hall's own 0.3 m of wall: flush with the hall on its east and
    // with the room on its west, so it adds nothing inside either of them.
    // The hall's barrel roof overhangs its wall by 0.5 m, so its eave hangs 20 cm inside the room,
    // under the ceiling. This stone band absorbs that lip: to anyone in the room it is a cornice
    // along the top of the east wall, and the roof is hidden inside it.
    stoneBox(group, wallStone, 0.5, 0.28, dSpan + t * 2, -4.1, 6.27, zc);
    // a string course at the eaves
    stoneBox(group, trimStone, t + 0.1, 0.14, dSpan + t * 2, ox0 - t / 2, H - 0.28, zc);
    stoneBox(group, trimStone, wSpan, 0.14, t + 0.1, xc, H - 0.28, oz0 - t / 2);
    stoneBox(group, trimStone, wSpan, 0.14, t + 0.1, xc, H - 0.28, oz1 + t / 2);

    // quoins: long and short blocks at the two outside corners only. The east pair would sit against
    // (and slightly inside) the hall's wall.
    [[ox0, oz0], [ox0, oz1]].forEach(([qx, qz]) => {
      for (let k = 0; k < Math.floor(H / 0.72); k += 1) {
        const y = 0.36 + k * 0.72;
        const long = k % 2 === 0;
        const dz = (qz < zc ? -1 : 1) * (t / 2);
        const dx = -t / 2;
        stoneBox(group, trimStone, long ? 0.85 : 0.42, 0.62, 0.42, qx + dx, y, qz + dz);
        stoneBox(group, trimStone, 0.42, 0.62, long ? 0.42 : 0.85, qx + dx + 0.21, y, qz + dz);
      }
    });

    // contact shadow along the annex's west face
    {
      const foot = new THREE.Mesh(new THREE.PlaneGeometry(dSpan + t * 2, 0.9), footShade);
      foot.position.set(ox0 - t - 0.02, 0.35, zc);
      foot.rotation.y = -Math.PI / 2;
      group.add(foot);
    }
    // (these two stop at the hall wall as well: the room's floor runs on to x = ix1 there)
    [oz0 - t - 0.02, oz1 + t + 0.02].forEach((sz, i) => {
      const width = wSpan + t * 2 - 0.36;
      const foot = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.9), footShade);
      // its east edge stops at the hall wall, so it does not lie on the room's floor
      foot.position.set(ox0 - t + width / 2, 0.35, sz);
      foot.rotation.y = i === 0 ? Math.PI : 0;
      group.add(foot);
    });

    // buttresses on the west face, which is the one the lane sees
    [zc - dSpan * 0.28, zc + dSpan * 0.28].forEach((z) => {
      buttress(group, plinthStone, trimStone, ox0 - t, 0, H - 0.4, z, 0.56, 0.7, -1);
    });
    // one arched window on the west face and one on the north face, glazed and framed
    {
      const w = 1.0;
      const h = 1.9;
      const y = 3.5;
      const z = zc;
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2 - 0.18, -h / 2 - 0.18);
      shape.lineTo(w / 2 + 0.18, -h / 2 - 0.18);
      shape.lineTo(w / 2 + 0.18, h / 2);
      for (let i = 0; i <= 16; i += 1) {
        const a = (i / 16) * Math.PI;
        shape.lineTo(Math.cos(a) * (w / 2 + 0.18), h / 2 + Math.sin(a) * (w / 2 + 0.18));
      }
      shape.lineTo(-w / 2 - 0.18, h / 2);
      shape.closePath();
      const frame = stonePanel(group, trimStone, shape, ox0 - t - 0.02, y, z);
      frame.rotation.y = -Math.PI / 2;
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), paneMat);
      glass.position.set(ox0 - t - 0.035, y, z);
      glass.rotation.y = -Math.PI / 2;
      group.add(glass);
      // the arched head of the window
      const head = new THREE.Mesh(track(new THREE.CircleGeometry(w / 2, 20, 0, Math.PI)), paneMat);
      head.position.set(ox0 - t - 0.035, y + h / 2, z);
      head.rotation.y = -Math.PI / 2;
      group.add(head);
      // mullions and a transom, so the glass reads as leaded, not as a hole
      stoneBox(group, trimStone, 0.12, h + w / 2, 0.07, ox0 - t - 0.08, y + 0.1, z);
      stoneBox(group, trimStone, 0.12, 0.07, w, ox0 - t - 0.08, y + 0.15, z);
      // sill and keystone
      stoneBox(group, trimStone, 0.26, 0.13, w + 0.5, ox0 - t - 0.06, y - h / 2 - 0.1, z);
      stoneBox(group, trimStone, 0.2, 0.34, 0.26, ox0 - t - 0.06, y + h / 2 + w / 2 + 0.16, z);
    }

    // the north face, the one the garden sees: a second window, and a chimney at the far end
    {
      const w = 0.9;
      const h = 1.7;
      const yy = 3.2;
      const xx = xc + wSpan * 0.18;
      const zz = oz1 + t + 0.02;
      // glass first, then the stone ring in front of its edge. (The ring is a filled outline, so the
      // glass has to sit proud of it or it is hidden.)
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(w, h), paneMat);
      glow.position.set(xx, yy, zz + 0.06);
      group.add(glow);
      const head = new THREE.Mesh(track(new THREE.CircleGeometry(w / 2, 20, 0, Math.PI)), paneMat);
      head.position.set(xx, yy + h / 2, zz + 0.06);
      group.add(head);
      // a ring of stone round it
      const ringShape = new THREE.Shape();
      ringShape.moveTo(-w / 2 - 0.16, -h / 2 - 0.16);
      ringShape.lineTo(w / 2 + 0.16, -h / 2 - 0.16);
      ringShape.lineTo(w / 2 + 0.16, h / 2);
      for (let i = 0; i <= 16; i += 1) {
        const a = (i / 16) * Math.PI;
        ringShape.lineTo(Math.cos(a) * (w / 2 + 0.16), h / 2 + Math.sin(a) * (w / 2 + 0.16));
      }
      ringShape.lineTo(-w / 2 - 0.16, h / 2);
      ringShape.closePath();
      stonePanel(group, trimStone, ringShape, xx, yy, zz + 0.01);
      stoneBox(group, trimStone, 0.1, h + w / 2, 0.1, xx, yy + 0.1, zz + 0.1);
      stoneBox(group, trimStone, 0.1, 0.1, w, xx, yy + 0.15, zz + 0.1);
      stoneBox(group, trimStone, w + 0.5, 0.13, 0.26, xx, yy - h / 2 - 0.1, zz + 0.08);
    }
    // chimney: a stone stack with a cap, letting the room have a fire
    {
      const chx = xc - wSpan * 0.3;
      const chz = zc + 0.6;
      stoneBox(group, plinthStone, 0.62, 2.2, 0.62, chx, H + 1.1, chz);
      stoneBox(group, trimStone, 0.78, 0.16, 0.78, chx, H + 2.24, chz);
      stoneBox(group, darkMat, 0.34, 0.12, 0.34, chx, H + 2.36, chz);
    }

    // a tiled gable roof over the annex: it overhangs the garden, the west and the back, and butts
    // against the hall on the east instead of pushing tiles through its wall
    const roofW = wSpan + t * 2;
    gableRoof({
      parent: group,
      tiles: roomTiles,
      stone: trimStone,
      w: roofW,
      d: dSpan + t * 2,
      rise: 1.15,
      // its east edge lands against the hall's wall, a little short of it so no tile pokes through
      // into the hall; its west edge overhangs the garden side
      x: (ox0 - t + (xStop - 0.06)) / 2,
      // sat on top of the room's ceiling slab: at H the eave's underside poked through it and
      // showed a strip of tiles to anyone standing in the room
      y: H + 0.22,
      z: zc,
      along: 'x',
      overhangs: { x0: 0.42, x1: 0, z0: 0.42, z1: 0.42 },
      // (with x1 = 0 the east gable and ridge stop 6 cm short of the hall wall)
    });
  }

  // ---- Rear wall ----------------------------------------------------------
  // A round-topped wall closing the far end of the hall, with the same cross-section as the vault.
  {
    const R = hallHalfWidth + 0.5;
    const shape = new THREE.Shape();
    shape.moveTo(-R, 0);
    shape.lineTo(R, 0);
    shape.lineTo(R, spring);
    for (let i = 0; i <= 36; i += 1) {
      const a = (i / 36) * Math.PI;
      shape.lineTo(R * Math.cos(a), spring + R * Math.sin(a));
    }
    shape.closePath();
    const back = stonePanel(group, wallStone, shape, 0, 0, -length - 0.42);
    back.rotation.y = Math.PI;
    stoneBox(group, plinthStone, R * 2 + 0.2, plinthTop, 0.5, 0, plinthTop / 2, -length - 0.42);
    // The buttresses face outward. Facing them inward put a pier through the hall's end wall, a
    // couple of metres behind the heart window.
    [-R * 0.55, R * 0.55].forEach((x) => {
      const depth = 0.55;
      const width = 0.7;
      stoneBox(group, plinthStone, depth, 5.2, width, x, 2.6, -length - 0.42 - depth / 2);
      stoneBox(group, trimStone, depth * 1.15, 0.18, width * 1.15, x, 5.29, -length - 0.42 - depth / 2);
      const cap = stoneBox(group, trimStone, depth * 1.3, 0.3, width * 1.05, x, 5.52, -length - 0.42 - depth / 2);
      cap.rotation.x = -0.35; // shed the rain away from the wall
    });
    // a stone cross on the gable, so the rear end has a centre
    stoneBox(group, trimStone, 0.18, 1.5, 0.2, 0, spring + 2.2, -length - 0.45);
    stoneBox(group, trimStone, 0.7, 0.18, 0.2, 0, spring + 2.5, -length - 0.45);
  }

  return group;
}
