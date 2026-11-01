import * as THREE from 'three';
import { outdoorNormal } from './outdoor-textures.js';
import {
  FAIR, FAIR_ZONE, FAIR_GATE, FAIR_GAP, FENCE, RIDES, STALLS, RIDE_ASK, RIDE_BAY, RIDE_PARK,
  LANE, FAIR_PATH_Z,
} from './fair-rules.js';

// The funfair east of the castle, at the end of a short grass lane from the front door.
//
// It is a small, warm, old-fashioned fair — the kind drawn in a storybook: a big wheel with candle-lit
// gondolas, a carousel of painted horses, swing boats, a helter-skelter, a row of little booths, bunting
// overhead and paper lanterns on every post. Nothing here is a new download: the wood, the striped
// canvas and the glows are the same kinds of material the town and the flower stall already use.
//
// What moves: the wheel (one group), the carousel (one group) and the swing boats (one group). Everything
// else is static geometry, so the whole fair costs a handful of matrix updates a frame rather than one
// per object.
//
// The couple can walk the lane, cross the ground between the rides, and ask for a go at each one; the
// rides are watched from the ground, which is how a storybook fair is enjoyed anyway.

const WOOD = '#7a4f33';
const WOOD_DARK = '#4b3020';
const WOOD_LIGHT = '#a9713f';
const GOLD = '#e8b662';
const CREAM = '#f7e6c8';
const CANVAS_A = '#ffd9e2';
const CANVAS_B = '#e8637f';
const LAMP = ['#ffcf8f', '#ff9dbd', '#ffe08a', '#a8e6ff', '#c9a7ff'];

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A diagonal candy stripe, for the booth awnings and the big top's skirt
function stripeTexture(a = CANVAS_A, b = CANVAS_B, stripes = 8) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = b;
    const band = w / stripes;
    ctx.save();
    ctx.translate(0, 0);
    for (let i = -stripes; i < stripes * 2; i += 2) {
      ctx.beginPath();
      ctx.moveTo(i * band, 0);
      ctx.lineTo((i + 1) * band, 0);
      ctx.lineTo((i + 1) * band + h, h);
      ctx.lineTo(i * band + h, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  });
}

// A soft round glow, for every lamp in the fair
function glowTexture(inner = 'rgba(255,214,150,1)', outer = 'rgba(255,190,120,0)') {
  return canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, inner);
    g.addColorStop(0.4, inner.replace(/[\d.]+\)$/, '0.32)'));
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}

// A painted panel for the carousel's drum: a rose window, in the fair's own colours
function drumTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#7d3450';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i += 1) {
      const x = (i + 0.5) * (w / 8);
      ctx.fillStyle = i % 2 ? '#a34562' : '#8c3a58';
      ctx.beginPath();
      ctx.arc(x, h * 0.5, h * 0.46, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = CREAM;
      ctx.beginPath();
      ctx.arc(x, h * 0.5, h * 0.17, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b8752f';
      ctx.lineWidth = 3;
      ctx.stroke();
      // a little rosette of petals in the middle
      for (let p = 0; p < 5; p += 1) {
        const a = (p / 5) * Math.PI * 2;
        ctx.fillStyle = p % 2 ? CANVAS_B : '#ffb7c9';
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * h * 0.1, h * 0.5 + Math.sin(a) * h * 0.1, h * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

// A ticket corner for the gate, with the fair's name in Persian on it
function signTexture() {
  return canvasTexture(512, 192, (ctx, w, h) => {
    ctx.fillStyle = '#2a1a24';
    ctx.fillRect(0, 0, w, h);
    const grd = ctx.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#ffe6b8');
    grd.addColorStop(0.5, '#ffd08a');
    grd.addColorStop(1, '#f7b56a');
    ctx.fillStyle = grd;
    ctx.fillRect(8, 8, w - 16, h - 16);
    ctx.strokeStyle = '#8a4a2a';
    ctx.lineWidth = 6;
    ctx.strokeRect(16, 16, w - 32, h - 32);
    ctx.fillStyle = '#5a2a2a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 74px Lalezar, Vazirmatn, sans-serif';
    ctx.fillText('شهربازیِ ما', w / 2, h * 0.44);
    ctx.font = '28px Vazirmatn, sans-serif';
    ctx.fillStyle = '#7a4436';
    ctx.fillText('هر شب، از غروب تا ستاره‌ها', w / 2, h * 0.74);
  });
}

export function buildFair(scene, track) {
  const group = new THREE.Group();
  group.name = 'funfair';
  scene.add(group);

  const woodMat = track(new THREE.MeshStandardMaterial({
    color: WOOD, roughness: 0.78, normalMap: outdoorNormal('bark', 2, 1), normalScale: new THREE.Vector2(0.35, 0.35),
  }));
  const woodDarkMat = track(new THREE.MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.85 }));
  const woodLightMat = track(new THREE.MeshStandardMaterial({
    color: WOOD_LIGHT, roughness: 0.6, normalMap: outdoorNormal('bark', 3, 1), normalScale: new THREE.Vector2(0.3, 0.3),
  }));
  const goldMat = track(new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.75, roughness: 0.28 }));
  const creamMat = track(new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.7 }));
  const stripeMat = track(new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.72, side: THREE.DoubleSide }));
  const stripeMat2 = track(new THREE.MeshStandardMaterial({ map: stripeTexture('#eaf4ff', '#6fa8dc'), roughness: 0.72, side: THREE.DoubleSide }));
  const drumMat = track(new THREE.MeshStandardMaterial({ map: drumTexture(), roughness: 0.55, metalness: 0.15 }));
  const glow = track(new THREE.SpriteMaterial({
    map: glowTexture(), transparent: true, opacity: 0.95, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false,
  }));
  const bulbGold = track(new THREE.MeshBasicMaterial({ color: LAMP[0], toneMapped: false }));
  const bulbPink = track(new THREE.MeshBasicMaterial({ color: LAMP[1], toneMapped: false }));
  const bulbBlue = track(new THREE.MeshBasicMaterial({ color: LAMP[3], toneMapped: false }));
  const bulbLit = [bulbGold, bulbPink, bulbBlue];

  const add = (geo, mat, x, y, z) => {
    const mesh = new THREE.Mesh(track(geo), mat);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  const addGroup = (x, y, z) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    group.add(g);
    return g;
  };

  // ---- the lane and the fairground's own floor --------------------------------
  // Paved lane from the garden to the gate, then packed earth and gravel inside the fence. Both are
  // single planes with a painted grain, not a tiled texture per slab.
  const laneLength = LANE.x1 - LANE.x0;
  const groundTex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8a7561';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i += 1) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const s = 1 + Math.random() * 3;
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,239,214,0.16)' : 'rgba(60,44,34,0.14)';
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(6, 6);
  const lane = add(
    new THREE.PlaneGeometry(laneLength, LANE.halfWidth * 2),
    track(new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 })),
    LANE.x0 + laneLength / 2, 0.045, FAIR_PATH_Z,
  );
  lane.rotation.x = -Math.PI / 2;
  // kerb stones either side of the lane
  [-1, 1].forEach((side) => {
    const kerb = add(new THREE.BoxGeometry(laneLength, 0.12, 0.22), creamMat,
      LANE.x0 + laneLength / 2, 0.05, FAIR_PATH_Z + side * (LANE.halfWidth + 0.1));
    kerb.material = creamMat;
  });
  // The fair's own levelled ground: one big apron from the castle's east wall out past the fence, so
  // the couple never step from grass onto paving in the middle of nowhere. Slightly wider than the
  // fence, because a fair's ground spills a little outside its own rail.
  const apronMat = track(new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.96 }));
  const apron = add(
    new THREE.PlaneGeometry(40, 30),
    apronMat,
    (FAIR_ZONE.x0 + FAIR_ZONE.x1) / 2 - 2, 0.035, FAIR_PATH_Z,
  );
  apron.rotation.x = -Math.PI / 2;
  apron.receiveShadow = true;
  // The garden itself is left exactly as it is: its lawn, beds and lamps are not something a fair day
  // should pave over. The earth only starts where the garden's own planting ends (x = 13.5), so the
  // couple cross their own lawn and then step onto the fair's ground.
  const PATH_X0 = 13.5;
  const pathLen = LANE.x1 - PATH_X0;
  const doorPath = add(
    new THREE.PlaneGeometry(pathLen, 4.2),
    apronMat,
    PATH_X0 + pathLen / 2, 0.03, FAIR_PATH_Z,
  );
  doorPath.rotation.x = -Math.PI / 2;
  // a low stone edge down each side, which is what makes it read as a made path instead of bare earth
  [-1, 1].forEach((side) => {
    const edge = add(new THREE.BoxGeometry(pathLen, 0.1, 0.18), creamMat,
      PATH_X0 + pathLen / 2, 0.06, FAIR_PATH_Z + side * 2.2);
    edge.name = 'path-edge';
  });

  // the lane's own little lanterns, so the walk east is lit like the walk west
  for (let x = LANE.x0 + 3; x < LANE.x1; x += 6.0) {
    [-1, 1].forEach((side) => {
      const post = add(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 8), woodDarkMat, x, 1.2, FAIR_PATH_Z + side * (LANE.halfWidth + 0.55));
      post.name = 'lane-post';
      const glowSprite = new THREE.Sprite(glow);
      glowSprite.position.set(x, 2.45, FAIR_PATH_Z + side * (LANE.halfWidth + 0.55));
      glowSprite.scale.setScalar(1.5);
      group.add(glowSprite);
      add(new THREE.SphereGeometry(0.1, 10, 8), bulbGold, x, 2.45, FAIR_PATH_Z + side * (LANE.halfWidth + 0.55));
    });
  }

  // ---- the fence, with its gate ----------------------------------------------
  // A rail fence: two rails between posts, with a picket top. Built in one instanced run for the
  // posts and one for the pickets, so a 40 m fence is not 200 draw calls.
  {
    const posts = [];
    const pickets = [];
    const along = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(2, Math.round(len / FENCE.postEvery));
      for (let i = 0; i <= n; i += 1) {
        const t = i / n;
        const x = x0 + (x1 - x0) * t;
        const z = z0 + (z1 - z0) * t;
        // the gate's opening: no posts, no pickets across it
        const inGate = Math.abs(x - FAIR_ZONE.x0) < 0.3 && z > FAIR_GAP.z0 - 0.2 && z < FAIR_GAP.z1 + 0.2;
        if (!inGate) posts.push({ x, z, rotY: Math.atan2(x1 - x0, z1 - z0) });
        // rails: one picket every 0.35 m
        const m = Math.round(len / 0.35);
        for (let k = 0; k < m; k += 1) {
          const tt = (k + 0.5) / m;
          const px = x0 + (x1 - x0) * tt;
          const pz = z0 + (z1 - z0) * tt;
          const gate = Math.abs(px - FAIR_ZONE.x0) < 0.3 && pz > FAIR_GAP.z0 && pz < FAIR_GAP.z1;
          if (!gate) pickets.push({ x: px, z: pz });
        }
      }
    };
    along(FAIR_ZONE.x0, FAIR_ZONE.z0, FAIR_ZONE.x0, FAIR_ZONE.z1); // west, with the gate
    along(FAIR_ZONE.x0, FAIR_ZONE.z0, FAIR_ZONE.x1, FAIR_ZONE.z0); // north
    along(FAIR_ZONE.x0, FAIR_ZONE.z1, FAIR_ZONE.x1, FAIR_ZONE.z1); // south
    along(FAIR_ZONE.x1, FAIR_ZONE.z0, FAIR_ZONE.x1, FAIR_ZONE.z1); // east

    const postGeo = track(new THREE.BoxGeometry(0.16, FENCE.height, 0.16));
    const postMesh = new THREE.InstancedMesh(postGeo, woodDarkMat, posts.length);
    const dummy = new THREE.Object3D();
    posts.forEach((p, i) => {
      dummy.position.set(p.x, FENCE.height / 2, p.z);
      dummy.rotation.set(0, p.rotY, 0);
      dummy.updateMatrix();
      postMesh.setMatrixAt(i, dummy.matrix);
    });
    postMesh.instanceMatrix.needsUpdate = true;
    group.add(postMesh);

    // pickets: short vertical slats with a pointed top, clustered in the classic zig-zag
    const picketGeo = track(new THREE.BoxGeometry(0.06, 0.9, 0.05));
    const picketMesh = new THREE.InstancedMesh(picketGeo, woodLightMat, pickets.length);
    pickets.forEach((p, i) => {
      dummy.position.set(p.x, 0.72, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      picketMesh.setMatrixAt(i, dummy.matrix);
    });
    picketMesh.instanceMatrix.needsUpdate = true;
    group.add(picketMesh);

    // the two rails, as long thin boxes on each of the four sides
    const rail = (x0, z0, x1, z1, y) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const r = add(new THREE.BoxGeometry(len, 0.08, 0.1), woodMat, (x0 + x1) / 2, y, (z0 + z1) / 2);
      r.rotation.y = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
    };
    const segs = [
      [FAIR_ZONE.x0, FAIR_ZONE.z0, FAIR_ZONE.x0, FAIR_GAP.z0 - 0.1],
      [FAIR_ZONE.x0, FAIR_GAP.z1 + 0.1, FAIR_ZONE.x0, FAIR_ZONE.z1],
      [FAIR_ZONE.x0, FAIR_ZONE.z0, FAIR_ZONE.x1, FAIR_ZONE.z0],
      [FAIR_ZONE.x0, FAIR_ZONE.z1, FAIR_ZONE.x1, FAIR_ZONE.z1],
      [FAIR_ZONE.x1, FAIR_ZONE.z0, FAIR_ZONE.x1, FAIR_ZONE.z1],
    ];
    segs.forEach(([x0, z0, x1, z1]) => {
      rail(x0, z0, x1, z1, 0.42);
      rail(x0, z0, x1, z1, 0.95);
    });
  }

  // ---- the gate ---------------------------------------------------------------
  // Two tall posts, a curved top with a small roof, lanterns, and a ticket sign. The opening is the
  // only gap in the fence, so this is what the couple walk under.
  {
    const gx = FAIR_ZONE.x0;
    const gz = FAIR_PATH_Z;
    [-1, 1].forEach((side) => {
      add(new THREE.BoxGeometry(0.34, FAIR_GATE.height, 0.34), woodDarkMat, gx, FAIR_GATE.height / 2, gz + side * (FAIR_GATE.halfWidth + 0.2));
      add(new THREE.SphereGeometry(0.16, 12, 10), goldMat, gx, FAIR_GATE.height + 0.2, gz + side * (FAIR_GATE.halfWidth + 0.2));
    });
    // the arch across the top: a shallow curved beam, as a torus segment
    const arch = add(new THREE.TorusGeometry(FAIR_GATE.halfWidth + 0.2, 0.09, 8, 24, Math.PI), woodMat,
      gx, FAIR_GATE.height - 0.1, gz);
    arch.rotation.y = Math.PI / 2;
    // a little gabled roof over the arch
    const roof = add(new THREE.ConeGeometry(FAIR_GATE.halfWidth + 0.9, 1.1, 4), stripeMat, gx, FAIR_GATE.height + 0.75, gz);
    roof.rotation.y = Math.PI / 4;
    roof.rotation.z = Math.PI / 2;
    // the sign, on the arch, facing west down the lane
    const sign = new THREE.Mesh(
      track(new THREE.PlaneGeometry(3.4, 1.28)),
      track(new THREE.MeshBasicMaterial({ map: signTexture(), toneMapped: false, side: THREE.DoubleSide })),
    );
    sign.position.set(gx - 0.22, FAIR_GATE.height + 0.05, gz);
    sign.rotation.y = -Math.PI / 2;
    group.add(sign);
    // lanterns on the gate posts
    [-1, 1].forEach((side) => {
      const sprite = new THREE.Sprite(glow);
      sprite.position.set(gx - 0.3, FAIR_GATE.height - 0.5, gz + side * (FAIR_GATE.halfWidth + 0.2));
      sprite.scale.setScalar(2.2);
      group.add(sprite);
      add(new THREE.SphereGeometry(0.16, 12, 10), bulbGold, gx - 0.3, FAIR_GATE.height - 0.5, gz + side * (FAIR_GATE.halfWidth + 0.2));
    });
  }

  // ---- the big wheel -----------------------------------------------------------
  // The wheel is its own group, turning slowly. Gondolas hang from the rim and counter-rotate, so they
  // stay upright; each one is one box, one roof and one glow, not a little building.
  const wheel = addGroup(RIDES.wheel.x, 0, RIDES.wheel.z);
  {
    const R = RIDES.wheel.r;
    const hubY = R + 1.2;
    // the two A-frames that hold the axle
    [-1, 1].forEach((side) => {
      const legLen = Math.hypot(4.2, hubY);
      const leg = new THREE.Mesh(track(new THREE.CylinderGeometry(0.13, 0.18, legLen, 8)), woodDarkMat);
      leg.position.set(0, hubY / 2, side * 2.1);
      leg.rotation.x = side * Math.atan2(4.2, hubY);
      wheel.add(leg);
      const leg2 = new THREE.Mesh(track(new THREE.CylinderGeometry(0.13, 0.18, legLen, 8)), woodDarkMat);
      leg2.position.set(0, hubY / 2, side * 2.1);
      leg2.rotation.x = -side * Math.atan2(4.2, hubY);
      wheel.add(leg2);
      // a foot for each leg
      const foot = new THREE.Mesh(track(new THREE.BoxGeometry(0.9, 0.2, 0.5)), woodDarkMat);
      foot.position.set(0, 0.1, side * 2.1 + side * 2.0);
      wheel.add(foot);
    });
    // the axle
    const axle = new THREE.Mesh(track(new THREE.CylinderGeometry(0.16, 0.16, 5.4, 10)), goldMat);
    axle.rotation.x = Math.PI / 2;
    axle.position.y = hubY;
    wheel.add(axle);

    const spin = new THREE.Group();
    spin.position.y = hubY;
    wheel.add(spin);
    // the rim: two rings, so the wheel has depth, and twelve spokes
    [-0.9, 0.9].forEach((z) => {
      const rim = new THREE.Mesh(track(new THREE.TorusGeometry(R, 0.1, 6, 48)), goldMat);
      rim.position.z = z;
      spin.add(rim);
      const inner = new THREE.Mesh(track(new THREE.TorusGeometry(R * 0.55, 0.06, 6, 36)), woodLightMat);
      inner.position.z = z;
      spin.add(inner);
    });
    // one spoke per angle, full depth: twice the metal for half the meshes, and from the lane the two
    // rims are edge-on anyway, so a pair of thin spokes read as one line either way
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      const spoke = new THREE.Mesh(track(new THREE.BoxGeometry(0.07, R, 1.8)), woodLightMat);
      spoke.position.set(Math.cos(a) * R / 2, Math.sin(a) * R / 2, 0);
      spoke.rotation.z = a + Math.PI / 2;
      spin.add(spoke);
    }
    // the crossing struts between the two rims
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      const strut = new THREE.Mesh(track(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 5)), woodDarkMat);
      strut.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      strut.rotation.x = Math.PI / 2;
      spin.add(strut);
    }
    // the hub, a gold rosette
    const hub = new THREE.Mesh(track(new THREE.CylinderGeometry(0.5, 0.5, 2.2, 16)), goldMat);
    hub.rotation.x = Math.PI / 2;
    spin.add(hub);
    const hubCap = new THREE.Mesh(track(new THREE.SphereGeometry(0.42, 16, 12)), bulbGold);
    hubCap.position.z = 1.16;
    spin.add(hubCap);
    const hubCap2 = hubCap.clone();
    hubCap2.position.z = -1.16;
    spin.add(hubCap2);

    // twelve gondolas, each hanging from the rim on two thin links
    const gondolas = [];
    const gondolaColours = ['#ff9dbd', '#ffd08a', '#a8e6ff', '#c9a7ff', '#ffe6b8', '#ffb18a'];
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      const holder = new THREE.Group();
      holder.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      spin.add(holder);
      const cabin = new THREE.Group();
      holder.add(cabin);
      // hang the cabin a little under the rim, and keep it upright as the wheel turns
      cabin.position.y = -0.85;
      const body = new THREE.Mesh(
        track(new THREE.BoxGeometry(1.05, 0.85, 1.15)),
        track(new THREE.MeshStandardMaterial({ color: gondolaColours[i % gondolaColours.length], roughness: 0.55, metalness: 0.08 })),
      );
      cabin.add(body);
      const roof = new THREE.Mesh(track(new THREE.ConeGeometry(0.92, 0.5, 4)), stripeMat);
      roof.position.y = 0.62;
      roof.rotation.y = Math.PI / 4;
      cabin.add(roof);
      const lamp = new THREE.Sprite(glow);
      lamp.scale.setScalar(1.1);
      lamp.position.y = 0.1;
      cabin.add(lamp);
      // A single short link up to the rim. Two were prettier in isolation and cost 24 meshes for a
      // detail nobody can resolve from the ground; the cabin still clearly hangs from the wheel.
      const link = new THREE.Mesh(track(new THREE.BoxGeometry(0.14, 0.86, 0.14)), goldMat);
      link.position.y = 0.43;
      cabin.add(link);
      gondolas.push({ cabin, phase: (i / 12) * Math.PI * 2 });
    }
    wheel.userData.gondolas = gondolas;
    wheel.userData.spin = spin;
    wheel.userData.hubY = hubY;
    // One gondola is theirs: it is painted with a little heart and always parked at the bottom of the
    // turn when nobody is on it, so the couple step in from the ground rather than being dropped into
    // the sky. It is the only seat a turn can use.
    const rideIndex = 0;
    const heart = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.34, 0.34, 0.06)),
      track(new THREE.MeshBasicMaterial({ color: '#ff7f9f', toneMapped: false })),
    );
    heart.position.set(0, 0.06, 0.6);
    heart.rotation.z = Math.PI / 4;
    gondolas[rideIndex].cabin.add(heart);
    gondolas[rideIndex].cabin.name = 'ride-cabin';
    wheel.userData.rideIndex = rideIndex;
  }

  // ---- the carousel ------------------------------------------------------------
  const carousel = addGroup(RIDES.carousel.x, 0, RIDES.carousel.z);
  {
    const R = RIDES.carousel.r;
    // the deck, a shallow drum with a painted skirt
    const deck = new THREE.Mesh(track(new THREE.CylinderGeometry(R, R * 0.96, 0.3, 32)), woodMat);
    deck.position.y = 0.15;
    carousel.add(deck);
    const skirt = new THREE.Mesh(track(new THREE.CylinderGeometry(R * 0.97, R * 0.9, 0.5, 32, 1, true)), stripeMat);
    skirt.position.y = 0.02;
    carousel.add(skirt);
    // the central drum, painted with the rose-window texture
    const drum = new THREE.Mesh(track(new THREE.CylinderGeometry(1.15, 1.15, 2.4, 24)), drumMat);
    drum.position.y = 1.5;
    carousel.add(drum);
    // the canopy: a cone of stripes with a scalloped edge and a gold spire
    const canopy = new THREE.Mesh(track(new THREE.ConeGeometry(R + 0.5, 1.9, 16)), stripeMat2);
    canopy.position.y = 3.6;
    carousel.add(canopy);
    const edge = new THREE.Mesh(track(new THREE.TorusGeometry(R + 0.42, 0.07, 6, 32)), goldMat);
    edge.rotation.x = Math.PI / 2;
    edge.position.y = 2.68;
    carousel.add(edge);
    const spire = new THREE.Mesh(track(new THREE.SphereGeometry(0.22, 14, 10)), goldMat);
    spire.position.y = 4.65;
    carousel.add(spire);
    // a ring of little lamps under the canopy edge
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const bulb = new THREE.Mesh(track(new THREE.SphereGeometry(0.09, 8, 6)), bulbLit[i % 3]);
      bulb.position.set(Math.cos(a) * (R - 0.1), 2.5, Math.sin(a) * (R - 0.1));
      carousel.add(bulb);
      if (i % 2 === 0) {
        const sp = new THREE.Sprite(glow);
        sp.position.copy(bulb.position);
        sp.scale.setScalar(0.9);
        carousel.add(sp);
      }
    }
    // the turning part: horses on brass poles
    const spin = new THREE.Group();
    spin.position.y = 0;
    carousel.add(spin);
    const horses = [];
    const horseColours = ['#ffe6c8', '#f7c1d4', '#e9d7ff', '#cbe7ff', '#ffe9a8', '#e6f4cf'];
    const horseCount = 6;
    for (let i = 0; i < horseCount; i += 1) {
      const a = (i / horseCount) * Math.PI * 2;
      const radius = R * 0.62;
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius;
      const pole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.05, 0.05, 2.9, 8)), goldMat);
      pole.position.set(x, 1.75, z);
      spin.add(pole);
      const horseGroup = new THREE.Group();
      horseGroup.position.set(x, 1.2, z);
      horseGroup.rotation.y = -a + Math.PI / 2;
      spin.add(horseGroup);
      const coat = track(new THREE.MeshStandardMaterial({ color: horseColours[i % horseColours.length], roughness: 0.42 }));
      const body = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.24, 0.52, 8, 16)), coat);
      body.rotation.z = Math.PI / 2;
      body.position.y = 0.42;
      horseGroup.add(body);
      const neck = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.13, 0.34, 8, 12)), coat);
      neck.position.set(0.42, 0.72, 0);
      neck.rotation.z = -0.5;
      horseGroup.add(neck);
      const head = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.11, 0.24, 8, 12)), coat);
      head.position.set(0.62, 0.9, 0);
      head.rotation.z = -0.9;
      horseGroup.add(head);
      // mane and tail: a few flat strands of a darker tone
      const maneMat = track(new THREE.MeshStandardMaterial({ color: '#7a4a2a', roughness: 0.6 }));
      {
        // one swept mane instead of four strands: same silhouette, a quarter of the meshes
        const mane = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 0.3, 0.09)), maneMat);
        mane.position.set(0.54, 0.86, 0);
        mane.rotation.z = -0.5;
        horseGroup.add(mane);
      }
      const tail = new THREE.Mesh(track(new THREE.ConeGeometry(0.08, 0.34, 8)), maneMat);
      tail.position.set(-0.42, 0.4, 0);
      tail.rotation.z = 0.6;
      horseGroup.add(tail);
      // two legs, one reaching forward and one back, as in mid-gallop: from any angle the couple see
      // this carousel from, a horse shows no more than that
      [-1, 1].forEach((side) => {
        const leg = new THREE.Mesh(track(new THREE.CylinderGeometry(0.055, 0.045, 0.5, 6)), coat);
        leg.position.set(side * 0.2, 0.2, 0.02);
        leg.rotation.x = 0.55 * side;
        horseGroup.add(leg);
      });
      // a saddle
      const saddle = new THREE.Mesh(track(new THREE.BoxGeometry(0.34, 0.1, 0.34)), track(new THREE.MeshStandardMaterial({ color: '#b8455f', roughness: 0.5 })));
      saddle.position.set(-0.02, 0.63, 0);
      horseGroup.add(saddle);
      horses.push({ group: horseGroup, baseY: 1.2, phase: a, radius });
    }
    carousel.userData.spin = spin;
    carousel.userData.horses = horses;
  }

  // ---- the swing boats ---------------------------------------------------------
  const swings = addGroup(RIDES.swings.x, 0, RIDES.swings.z);
  {
    // two tall posts with a crossbar, and two boats swinging under it in opposite phase
    [-1, 1].forEach((side) => {
      const post = new THREE.Mesh(track(new THREE.CylinderGeometry(0.16, 0.2, 6.4, 10)), woodDarkMat);
      post.position.set(0, 3.2, side * 2.4);
      swings.add(post);
      const cap = new THREE.Mesh(track(new THREE.SphereGeometry(0.16, 10, 8)), goldMat);
      cap.position.set(0, 6.5, side * 2.4);
      swings.add(cap);
    });
    const bar = new THREE.Mesh(track(new THREE.CylinderGeometry(0.1, 0.1, 5.2, 10)), woodMat);
    bar.rotation.x = Math.PI / 2;
    bar.position.y = 6.3;
    swings.add(bar);
    const boats = [];
    [-1, 1].forEach((side, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(0, 6.2, side * 1.1);
      swings.add(pivot);
      const ropeMat = track(new THREE.MeshStandardMaterial({ color: '#d9c4a1', roughness: 0.9 }));
      [-0.55, 0.55].forEach((x) => {
        const rope = new THREE.Mesh(track(new THREE.CylinderGeometry(0.025, 0.025, 4.4, 5)), ropeMat);
        rope.position.set(x, -2.2, 0);
        pivot.add(rope);
      });
      const boat = new THREE.Group();
      boat.position.y = -4.4;
      pivot.add(boat);
      const hull = new THREE.Mesh(track(new THREE.SphereGeometry(0.62, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), stripeMat);
      hull.scale.set(1.0, 0.9, 1.5);
      hull.rotation.x = Math.PI / 2;
      boat.add(hull);
      const rimBar = new THREE.Mesh(track(new THREE.TorusGeometry(0.6, 0.04, 6, 20)), goldMat);
      rimBar.rotation.x = Math.PI / 2;
      rimBar.scale.set(1, 1.5, 1);
      boat.add(rimBar);
      const seat = new THREE.Mesh(track(new THREE.BoxGeometry(0.9, 0.06, 0.3)), woodLightMat);
      seat.position.y = 0.08;
      boat.add(seat);
      boat.name = 'ride-boat';
      boats.push({ pivot, cabin: boat, phase: i * Math.PI });
    });
    swings.userData.boats = boats;
  }

  // ---- the helter-skelter ------------------------------------------------------
  {
    const g = addGroup(RIDES.helter.x, 0, RIDES.helter.z);
    const tower = new THREE.Mesh(track(new THREE.CylinderGeometry(0.9, 1.15, 7.2, 16)), stripeMat2);
    tower.position.y = 3.6;
    g.add(tower);
    // the slide, a helical rib around the tower, made of a torus sliced by scaling and stepping
    const slideMat = track(new THREE.MeshStandardMaterial({ color: '#ffe6b8', roughness: 0.5, side: THREE.DoubleSide }));
    {
      // the slide is one instanced ribbon: 48 slabs of the same geometry, in one draw call
      const turns = 3;
      const slabs = turns * 16;
      const slide = new THREE.InstancedMesh(track(new THREE.BoxGeometry(0.95, 0.06, 0.5)), slideMat, slabs);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < slabs; i += 1) {
        const t = i / slabs;
        const a = t * Math.PI * 2 * turns;
        dummy.position.set(Math.cos(a) * 1.5, 6.6 - t * 5.4, Math.sin(a) * 1.5);
        dummy.rotation.set(0, -a, -0.16);
        dummy.updateMatrix();
        slide.setMatrixAt(i, dummy.matrix);
      }
      slide.instanceMatrix.needsUpdate = true;
      g.add(slide);
    }
    // a striped tent roof, and a flag on top
    const roof = new THREE.Mesh(track(new THREE.ConeGeometry(1.7, 1.6, 12)), stripeMat);
    roof.position.y = 8.0;
    g.add(roof);
    const pole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6)), goldMat);
    pole.position.y = 9.2;
    g.add(pole);
    const flag = new THREE.Mesh(track(new THREE.PlaneGeometry(0.7, 0.4, 6, 1)), track(new THREE.MeshStandardMaterial({
      color: '#ff9dbd', side: THREE.DoubleSide, roughness: 0.7,
    })));
    flag.position.set(0.35, 9.55, 0);
    g.add(flag);
    g.userData.flag = flag;
  }

  // ---- the booths -------------------------------------------------------------
  // Little ticket and candy stalls against the fence: a striped awning over a counter, a shelf of jars,
  // and a lantern each. Cheap boxes and two shared materials, and they make the far side feel busy.
  const boothLights = [];
  STALLS.forEach((s, i) => {
    const g = addGroup(s.x, 0, s.z);
    g.rotation.y = s.rotY;
    const mat = i % 2 ? stripeMat2 : stripeMat;
    // counter
    const counter = new THREE.Mesh(track(new THREE.BoxGeometry(2.2, 1.0, 0.6)), woodMat);
    counter.position.set(0, 0.5, 0.5);
    g.add(counter);
    const top = new THREE.Mesh(track(new THREE.BoxGeometry(2.4, 0.08, 0.72)), woodLightMat);
    top.position.set(0, 1.04, 0.5);
    g.add(top);
    // back board and two posts
    const back = new THREE.Mesh(track(new THREE.BoxGeometry(2.3, 2.0, 0.12)), woodDarkMat);
    back.position.set(0, 1.0, -0.35);
    g.add(back);
    [-1, 1].forEach((side) => {
      const post = new THREE.Mesh(track(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 8)), woodDarkMat);
      post.position.set(side * 1.15, 1.3, 0.55);
      g.add(post);
    });
    const awning = new THREE.Mesh(track(new THREE.BoxGeometry(2.7, 0.06, 1.5)), mat);
    awning.position.set(0, 2.62, 0.35);
    awning.rotation.x = 0.2;
    g.add(awning);
    // a scalloped fringe
    for (let k = 0; k < 5; k += 1) {
      const scallop = new THREE.Mesh(track(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 10, 1, false, 0, Math.PI)), mat);
      scallop.rotation.z = Math.PI / 2;
      scallop.rotation.y = Math.PI / 2;
      scallop.position.set(-1.1 + (k + 0.5) * 0.55, 2.42, 1.05);
      g.add(scallop);
    }
    // jars of sweets on the counter: three little glass domes on a base
    for (let k = 0; k < 2; k += 1) {
      const jar = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.15, 12, 10)),
        track(new THREE.MeshStandardMaterial({ color: ['#ffb7c9', '#ffe6a8', '#bfe9ff'][k], roughness: 0.2, metalness: 0.05, transparent: true, opacity: 0.85 })),
      );
      jar.position.set(-0.4 + k * 0.8, 1.2, 0.5);
      g.add(jar);
      // the jar's own gold rim is painted into its silhouette by the shading, so no separate lid
    }
    // the booth's lantern, and a glow for it
    const lampSprite = new THREE.Sprite(glow);
    lampSprite.position.set(0, 2.3, 0.95);
    lampSprite.scale.setScalar(1.1);
    g.add(lampSprite);
    boothLights.push(lampSprite);
    // the seller's shadow behind the counter: a dark board with a warm rim, so the booth looks staffed
    const shadow = new THREE.Mesh(
      track(new THREE.PlaneGeometry(0.72, 1.25)),
      track(new THREE.MeshBasicMaterial({ color: '#2a1a20', transparent: true, opacity: 0.72 })),
    );
    shadow.position.set(0.1, 1.35, -0.28);
    g.add(shadow);
    // the seller's head is the top of that same dark board: one shape, no extra mesh
    shadow.scale.set(1, 1.12, 1);
  });

  // ---- bunting and lantern strings ---------------------------------------------
  // Two catenary strings of triangular flags over the lane, and one over the fair's own ground. Each is
  // a row of small flat triangles: no texture, one material, and they read immediately as a fair.
  const buntingMats = [
    track(new THREE.MeshStandardMaterial({ color: '#ff9dbd', side: THREE.DoubleSide, roughness: 0.7 })),
    track(new THREE.MeshStandardMaterial({ color: '#ffe08a', side: THREE.DoubleSide, roughness: 0.7 })),
    track(new THREE.MeshStandardMaterial({ color: '#a8e6ff', side: THREE.DoubleSide, roughness: 0.7 })),
    track(new THREE.MeshStandardMaterial({ color: '#c9a7ff', side: THREE.DoubleSide, roughness: 0.7 })),
  ];
  const buntingStrings = [];
  const addBunting = (x0, y0, z0, x1, y1, z1, count) => {
    const groupB = new THREE.Group();
    groupB.name = 'bunting';
    scene.add(groupB);
    const flags = [];
    for (let i = 0; i < count; i += 1) {
      const t = (i + 0.5) / count;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      // a catenary: the string dips in the middle
      const sag = Math.sin(t * Math.PI) * 0.9;
      const y = y0 + (y1 - y0) * t - sag;
      const flag = new THREE.Mesh(track(new THREE.PlaneGeometry(0.34, 0.44)), buntingMats[i % 4]);
      flag.position.set(x, y, z);
      flag.rotation.y = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
      groupB.add(flag);
      flags.push({ mesh: flag, phase: i * 0.55 });
    }
    // the string itself
    const mid = new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2 - 0.9, (z0 + z1) / 2);
    const len = new THREE.Vector3(x0, y0, z0).distanceTo(new THREE.Vector3(x1, y1, z1)) + 1.2;
    const string = new THREE.Mesh(track(new THREE.CylinderGeometry(0.012, 0.012, len, 4)), woodDarkMat);
    string.position.copy(mid);
    string.rotation.y = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
    string.rotation.z = Math.PI / 2;
    groupB.add(string);
    buntingStrings.push(flags);
  };
  addBunting(FAIR_ZONE.x0 + 0.5, 5.2, -4.5, FAIR_ZONE.x0 + 0.5, 5.2, 10.5, 10);
  addBunting(RIDES.carousel.x, 6.0, RIDES.carousel.z, RIDES.wheel.x - 2, 9.6, RIDES.wheel.z - 1, 10);
  addBunting(RIDES.wheel.x + 2, 9.4, RIDES.wheel.z + 1, FAIR_ZONE.x1 - 0.6, 5.0, 12.0, 10);

  // ---- paper lanterns over the fair -------------------------------------------
  // The same idea as the town's drifting lanterns, but these are tied: a string of paper lamps running
  // down the lane to the gate, glowing and swaying a little.
  const lanterns = [];
  for (let i = 0; i < 10; i += 1) {
    const t = i / 9;
    const x = FAIR_ZONE.x0 + 0.6 + t * (RIDES.wheel.x - FAIR_ZONE.x0 - 4);
    const z = FAIR_PATH_Z + Math.sin(t * Math.PI) * 1.4;
    const y = 5.6 + Math.sin(t * Math.PI) * 1.2;
    const shape = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.26, 12, 10)),
      track(new THREE.MeshBasicMaterial({ color: LAMP[i % LAMP.length], toneMapped: false, transparent: true, opacity: 0.92 })),
    );
    shape.scale.set(1, 1.15, 1);
    shape.position.set(x, y, z);
    group.add(shape);
    const sprite = new THREE.Sprite(glow);
    sprite.position.set(x, y, z);
    sprite.scale.setScalar(1.9);
    group.add(sprite);
    lanterns.push({ mesh: shape, sprite, phase: i * 0.7, baseY: y });
  }

  // ---- the signpost at the gate ------------------------------------------------
  // Four arms, one per ride, so the fair is understood at a glance rather than explored by trial.
  {
    const px = FAIR_ZONE.x0 + 4.5;
    const pz = FAIR_PATH_Z - 3.2;
    add(new THREE.CylinderGeometry(0.08, 0.1, 3.0, 8), woodDarkMat, px, 1.5, pz);
    const arms = [
      { y: 2.6, len: 1.5, rot: -0.5, colour: '#ff9dbd' },
      { y: 2.2, len: 1.3, rot: 2.2, colour: '#ffd08a' },
      { y: 1.8, len: 1.6, rot: -2.4, colour: '#a8e6ff' },
      { y: 1.4, len: 1.2, rot: 0.9, colour: '#c9a7ff' },
    ];
    arms.forEach((a) => {
      const arm = new THREE.Mesh(track(new THREE.BoxGeometry(a.len, 0.16, 0.05)),
        track(new THREE.MeshStandardMaterial({ color: a.colour, roughness: 0.6 })));
      arm.position.set(px + Math.cos(a.rot) * a.len / 2, a.y, pz + Math.sin(a.rot) * a.len / 2);
      arm.rotation.y = -a.rot;
      group.add(arm);
    });
    const cap = new THREE.Mesh(track(new THREE.SphereGeometry(0.12, 10, 8)), goldMat);
    cap.position.set(px, 3.06, pz);
    group.add(cap);
  }

  // ---- the fair's own night lights --------------------------------------------
  // Two real lights only: one over the gate, one in the middle of the ride ground. Everything else is a
  // sprite, which is what keeps a fair this size from costing half a dozen shadow-free lights.
  const gateLight = new THREE.PointLight('#ffcf96', 12, 26, 2);
  gateLight.position.set(FAIR_ZONE.x0 + 1.6, 4.5, FAIR_PATH_Z);
  scene.add(gateLight);
  const fairLight = new THREE.PointLight('#ffb98a', 16, 40, 2);
  fairLight.position.set(RIDES.wheel.x - 1, 9.0, RIDES.wheel.z + 1);
  scene.add(fairLight);

  // ---- the update --------------------------------------------------------------
  // Three groups turn: the wheel, the carousel and the boats. The gondolas are the only children that
  // need counter-rotation, and the flags and lanterns sway. All of it is arithmetic on transforms that
  // already exist, so nothing is allocated per frame.
  const RIDE_BOOST = 2.3;
  // how long a ride holds still while the couple get on, before it starts moving under them
  const BOARD_SECONDS = 0.9;


  const wheelGondolas = wheel.userData.gondolas;
  const wheelSpin = wheel.userData.spin;
  const carouselSpin = carousel.userData.spin;
  const carouselHorses = carousel.userData.horses;
  const boats = swings.userData.boats;

  // ---- parking ------------------------------------------------------------------
  // Every ride has a boarding pose: the rotation that brings its own seat over the boarding bay. These
  // are *measured* rather than hand-written: the ride is turned, its seat is read out in world space
  // exactly the way the couple read it, and the angle is corrected by the difference. A few passes land
  // within a centimetre, and it stays right if a horse's pole or a gondola's links are ever moved — a
  // hand-written angle would silently drift.
  function measurePark(id, apply, read) {
    const bay = RIDE_BAY[id];
    // sweep the possible poses and take the one whose seat lands nearest the bay. A sweep, not a
    // formula: a carousel horse also rises and falls on its pole, and a boat hangs under a pivot, so
    // the honest answer is the one the geometry gives.
    const p = new THREE.Vector3();
    let best = 0;
    let bestErr = Infinity;
    for (let angle = -Math.PI; angle <= Math.PI; angle += 0.02) {
      apply(angle);
      read(p);
      const err = Math.hypot(p.x - bay.x, p.z - bay.z);
      if (err < bestErr) { bestErr = err; best = angle; }
    }
    // refine around the coarse winner, so the seat lands within a millimetre
    for (let step = 0.01; step > 0.0002; step /= 2) {
      for (const candidate of [best - step, best + step]) {
        apply(candidate);
        read(p);
        const err = Math.hypot(p.x - bay.x, p.z - bay.z);
        if (err < bestErr) { bestErr = err; best = candidate; }
      }
    }
    apply(best);
    return best;
  }

  // the carousel: a horse parks over the bay
  // Which horse is theirs: the one whose own orbit comes nearest the bay, then the pose that brings it
  // there. Chosen once, so the turn is always ridden on the same horse.
  const carouselSeat = (() => {
    const bay = RIDE_BAY.carousel;
    const wantR = Math.hypot(bay.x - RIDES.carousel.x, bay.z - RIDES.carousel.z);
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < carouselHorses.length; i += 1) {
      const r = carouselHorses[i].radius;
      if (Math.abs(r - wantR) < bestD) { bestD = Math.abs(r - wantR); best = i; }
    }
    return best;
  })();
  const carouselPark = (() => {
    // The bay sits on the circle a horse sweeps, so the pose is simply the bay's bearing minus the
    // horse's own angle on the deck. Solved on the horse's *orbit*, not on its world position: the
    // horse's world position also carries the deck's own transform, which is what made the measured
    // sweep land a metre and a half short.
    const bay = RIDE_BAY.carousel;
    const bearing = Math.atan2(bay.z - RIDES.carousel.z, bay.x - RIDES.carousel.x);
    return bearing - carouselHorses[carouselSeat].phase;
  })();
  let carouselAngle = carouselPark;
  // the wheel: their gondola parks over the bay, which for a wheel means at the bottom of the turn
  const wheelPark = measurePark(
    'wheel',
    (angle) => { wheelSpin.rotation.z = angle; },
    (out) => wheelGondolas[wheel.userData.rideIndex].cabin.getWorldPosition(out),
  );
  let wheelRideAngle = wheelPark;
  let t = 0;

  function update(dt) {
    // A taken ride runs a little faster, so a turn is a ride rather than a wait. The wheel and the
    // carousel share the same clock, so they speed up together and nothing drifts.
    if (riding && riding.boarding > 0) riding.boarding -= dt;
    const boost = riding && riding.boarding <= 0 ? RIDE_BOOST : 1;
    t += dt * boost;
    // The wheel turns when nobody is on it, and eases back so their own gondola is at the bottom (the
    // ground, where they can step in) the moment a turn begins. While they are on it, the turn is the
    // ride: it keeps going, and their gondola is the one they sit in.
    if (riding && riding.id === 'wheel') {
      wheelRideAngle += dt * boost * (Math.PI * 2 / 42);
      wheelSpin.rotation.z = wheelRideAngle;
    } else {
      // Idling: the wheel rests with their gondola at the bottom, which is where the couple step in. It
      // does not sway — a swaying entrance is a moving step — but the gondolas rock a little and the
      // lamps breathe, so a stopped wheel still looks alive.
      wheelSpin.rotation.z = wheelPark;
    }
    // the gondolas hang from the rim: they turn with it, so cancel the spin to stay upright
    for (let i = 0; i < wheelGondolas.length; i += 1) {
      const g = wheelGondolas[i];
      g.cabin.rotation.z = -wheelSpin.rotation.z;
      g.cabin.rotation.x = Math.sin(t * 1.1 + g.phase) * 0.05;
    }
    // The carousel turns while it is free, and parks a horse at the boarding point while a couple is
    // getting on, so the seat they step onto is standing still under them.
    if (riding && riding.id === 'carousel' && riding.boarding <= 0) {
      // on the ride: it turns with them on it, fast enough to feel like a ride
      carouselAngle += dt * boost * (Math.PI * 2 / 22);
      carouselSpin.rotation.y = carouselAngle;
    } else {
      // free, or holding still for boarding: the horse that is nearest the bay is brought over it
      if (!(riding && riding.id === 'carousel')) carouselAngle += dt * (Math.PI * 2 / 58);
      const diff = Math.atan2(Math.sin(carouselPark - carouselAngle), Math.cos(carouselPark - carouselAngle));
      carouselAngle += diff * Math.min(1, dt * 2.4);
      carouselSpin.rotation.y = carouselAngle;
    }
    for (let i = 0; i < carouselHorses.length; i += 1) {
      const h = carouselHorses[i];
      h.group.position.y = h.baseY + Math.sin(t * 1.5 + h.phase) * 0.16;
    }
    // the boats swing in opposite phase, easing at the top of each arc
    for (let i = 0; i < boats.length; i += 1) {
      const b = boats[i];
      const swing = Math.sin(t * 0.85 + b.phase) * 0.42;
      // their boat is held still at the bottom of its arc while they get on
      if (i === 0 && riding && riding.id === 'swings' && riding.boarding > 0) {
        b.pivot.rotation.z += (0 - b.pivot.rotation.z) * Math.min(1, dt * 8);
      } else {
        b.pivot.rotation.z = swing;
      }
    }
    // the flags and the lanterns breathe
    for (let s = 0; s < buntingStrings.length; s += 1) {
      const flags = buntingStrings[s];
      for (let i = 0; i < flags.length; i += 1) {
        const f = flags[i];
        f.mesh.rotation.x = Math.sin(t * 1.6 + f.phase) * 0.18;
      }
    }
    for (let i = 0; i < lanterns.length; i += 1) {
      const l = lanterns[i];
      l.mesh.position.y = l.baseY + Math.sin(t * 0.9 + l.phase) * 0.09;
      l.sprite.position.y = l.mesh.position.y;
    }
    // the booth lamps flicker, very slightly, like candles
    for (let i = 0; i < boothLights.length; i += 1) {
      const l = boothLights[i];
      l.scale.setScalar(1.05 + Math.sin(t * 2.3 + i * 1.7) * 0.07);
    }
    // the two lights breathe with the lamps, so the ground under the fair is never flat
    gateLight.intensity = 11 + Math.sin(t * 1.7) * 1.6;
    fairLight.intensity = 15 + Math.sin(t * 1.1 + 1.3) * 2.2;
  }

  // Where the couple stands to ask for a go, per ride, plus the signpost's own point.
  // ---- taking a ride -----------------------------------------------------------
  // A ride can be "taken": one seat is handed to the couple, the ride speeds up, and the seat's world
  // position is reported every frame so the couple can be lifted onto it. The seat is the *lowest*
  // place on the ride, so the couple are picked up from the ground and set down on it again, never
  // teleported to the top of a turn.
  let riding = null; // { id, seat }
  const seatWorld = new THREE.Vector3();
  const topDeck = new THREE.Vector3();

  function takeRide(id) {
    if (!RIDES[id]) return false;
    riding = { id, boarding: BOARD_SECONDS };
    // Park the ride *now*, under the couple, and remember which seat is theirs. Both matter: a ride
    // eased into its parked pose under someone who is already standing on it reads as the seat sliding
    // out from under them, and re-picking "the nearest horse" every frame makes them jump between
    // horses as the deck turns.
    if (id === 'wheel') {
      wheelRideAngle = wheelPark;
      wheelSpin.rotation.z = wheelPark;
      riding.seat = wheel.userData.rideIndex;
    } else if (id === 'carousel') {
      carouselAngle = carouselPark;
      carouselSpin.rotation.y = carouselPark;
      riding.seat = nearestHorse();
    } else if (id === 'swings') {
      riding.seat = nearestBoat();
    }
    return true;
  }
  // Which horse is nearest the boarding bay right now (in the deck's own frame, not world space).
  function nearestHorse() {
    const bay = RIDE_BAY.carousel;
    const bearing = Math.atan2(bay.z - RIDES.carousel.z, bay.x - RIDES.carousel.x);
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < carouselHorses.length; i += 1) {
      const a = carouselHorses[i].phase; // the horse's own angle on the deck
      const d = Math.abs(Math.atan2(Math.sin(a - bearing), Math.cos(a - bearing)));
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }
  // Boat 0 hangs on the lane side of the ride (its pivot is at z = ride.z - 1.1), which is the one the
  // boarding bay is under. It is also the boat the idle sway holds at the bottom of its arc.
  function nearestBoat() {
    return 0;
  }

  function leaveRide() {
    if (riding && riding.id === 'wheel') {
      // and end parked, so the next turn starts from the ground again
      wheelRideAngle = wheelPark;
      wheelSpin.rotation.z = wheelPark;
    }
    riding = null;
  }

  // Where the couple sit on `id` right now, in world space. For the wheel it is a gondola at the
  // bottom of the turn; for the carousel, a horse on the near side; for the boats, the near boat.
  function seatPosition(id, out = seatWorld, progress = undefined) {
    if (id === 'wheel') {
      // their own gondola, the one with the heart: it is what the turn is ridden in, and it is parked
      // at the bottom of the wheel when the turn is not on
      const index = riding && riding.seat !== undefined ? riding.seat : wheel.userData.rideIndex;
      const g = wheelGondolas[index] || wheelGondolas[wheel.userData.rideIndex];
      g.cabin.getWorldPosition(out);
      // the cabin's own floor is a little below its centre, and the seat a little above that
      out.y -= 0.26;
      return out;
    }
    if (id === 'carousel') {
      // their own horse, chosen when they got on, for the whole turn
      const index = riding && riding.seat !== undefined ? riding.seat : nearestHorse();
      const horse = carouselHorses[index] || carouselHorses[0];
      horse.group.getWorldPosition(out);
      out.y += 0.62; // the saddle
      return out;
    }
    if (id === 'swings') {
      // their own boat, chosen when they got on. Its cabin hangs under the pivot, so the seat is read
      // off the boat's own world position rather than guessed from the pivot's height.
      const index = riding && riding.seat !== undefined ? riding.seat : nearestBoat();
      const boat = boats[index] || boats[0];
      boat.pivot.updateMatrixWorld(true);
      boat.cabin.getWorldPosition(out);
      out.y += 0.32; // the boat's floor
      return out;
    }
    // The helter-skelter is climbed: the stair passes the foot of the tower on the lane side, so the
    // boarding bay is at the stair's own foot, and the first third of the turn is the climb. The rest is
    // the platform and then the slide down, which is the ride.
    const bay = RIDE_BAY.helter;
    if (progress === undefined || progress <= 0) {
      // standing at the foot of the stair
      out.set(bay.x, 0.0, bay.z);
      return out;
    }
    if (progress < 0.5) {
      // Up the stair: a spiral round the tower that *starts at the bay* and ends on the platform.
      // Interpolating the angle from the bay's own bearing to the platform's is what keeps the couple on
      // the stair instead of sliding to it: a fixed starting angle left them a metre and a half behind.
      const k = progress / 0.5;
      const r0 = Math.hypot(bay.x - RIDES.helter.x, bay.z - RIDES.helter.z);
      const a0 = Math.atan2(bay.z - RIDES.helter.z, bay.x - RIDES.helter.x);
      const a1 = a0 - Math.PI * 2 * 2.4; // two and a half turns up
      const a = a0 + (a1 - a0) * k;
      const r = r0 + (1.6 - r0) * k;
      const ease = k * k * (3 - 2 * k);
      out.set(
        RIDES.helter.x + Math.cos(a) * r,
        0.1 + ease * 6.5,
        RIDES.helter.z + Math.sin(a) * r,
      );
      return out;
    }
    // the platform, then down the slide
    const k = (progress - 0.5) / 0.5;
    const a = -Math.PI * 2 * 2.4 + k * Math.PI * 2 * 3;
    const r = 1.6 - k * 0.2;
    out.set(
      RIDES.helter.x + Math.cos(a) * r,
      6.6 - k * 6.2,
      RIDES.helter.z + Math.sin(a) * r,
    );
    return out;
  }
  return {
    group,
    update,
    takeRide,
    leaveRide,
    seatPosition,
    get riding() {
      return riding ? riding.id : null;
    },
    // for the interaction prompt: where to stand, and what to call each ride
    asks: RIDE_ASK,
    rides: RIDES,
    gate: FAIR_GATE,
    zone: FAIR_ZONE,
    centre: { x: FAIR.x, z: FAIR.z },
    lanterns,
  };
}
