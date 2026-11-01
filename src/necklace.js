import * as THREE from 'three';
import { NECK } from './gift.js';

// The necklace: a fine gold chain with a small openwork heart, and a pink stone inside it.
//
// It is built to *be worn*: the chain's own centre is the gold choker's height on the princess
// (NECK.y, and the body is scaled as a whole around it), the pendant hangs just under that, and the
// whole thing is small enough that it reads at arm's length instead of looking like a costume piece.
//
// The same object is used for the scene (it rises out of the fairy's box and turns in the air) and for
// the rest of the game (it stays on her neck). `createNecklace` builds it once; `worn` is the group that
// hangs on her body, `loose` is the group that flies about before it settles.

export function createNecklace(track = (o) => o) {
  const gold = track(new THREE.MeshStandardMaterial({
    color: '#f2c46a', metalness: 1, roughness: 0.16,
    emissive: '#6b4a12', emissiveIntensity: 0.12,
  }));
  const goldLight = track(new THREE.MeshStandardMaterial({
    color: '#ffe6a8', metalness: 0.95, roughness: 0.1,
    emissive: '#8a5f18', emissiveIntensity: 0.2,
  }));
  // MeshPhysicalMaterial (not Standard) for the stone: the clearcoat is what gives a cut gem its wet
  // highlight, and Standard silently drops it.
  const stone = track(new THREE.MeshPhysicalMaterial({
    color: '#ff6f9d', roughness: 0.06, metalness: 0.1,
    clearcoat: 1, clearcoatRoughness: 0.03,
    emissive: '#7a1230', emissiveIntensity: 0.5,
  }));
  const stoneLight = track(new THREE.MeshBasicMaterial({ color: '#ffd3e2', toneMapped: false }));

  const group = new THREE.Group();
  group.name = 'necklace';

  // ---- the chain ------------------------------------------------------------
  // A ring of small links: one torus would look like a wire hoop, so the chain is a thin torus for its
  // body plus a row of tiny beads, which is what makes it catch the light as it turns.
  const chain = new THREE.Mesh(track(new THREE.TorusGeometry(NECK.chainRadius, 0.0075, 8, 48)), gold);
  chain.rotation.x = Math.PI / 2;
  group.add(chain);
  const beadGeo = track(new THREE.SphereGeometry(0.0105, 8, 6));
  const beads = new THREE.InstancedMesh(beadGeo, goldLight, 24);
  {
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * NECK.chainRadius, 0, Math.sin(a) * NECK.chainRadius);
      dummy.updateMatrix();
      beads.setMatrixAt(i, dummy.matrix);
    }
    beads.instanceMatrix.needsUpdate = true;
  }
  group.add(beads);

  // ---- the clasp, at the back ------------------------------------------------
  // A small knot at the nape, so the ring does not read as a closed loop with no way in.
  const clasp = new THREE.Mesh(track(new THREE.SphereGeometry(0.018, 10, 8)), goldLight);
  clasp.position.set(0, 0, -NECK.chainRadius);
  group.add(clasp);

  // ---- the heart ------------------------------------------------------------
  // An openwork heart: a heart-shaped outline in the vertical plane, with a stone set inside it. Built
  // from a curve, so it is a real heart and not a diamond.
  const heart = new THREE.Group();
  heart.name = 'necklace-heart';
  // the pendant hangs from a short length of chain, on the front of her throat
  const drop = new THREE.Mesh(track(new THREE.CylinderGeometry(0.005, 0.005, 0.05, 6)), gold);
  drop.position.set(0, -0.028, 0);
  heart.add(drop);

  const heartShape = new THREE.Shape();
  {
    // a heart in a 1 x 1 box, point down, written as one smooth curve
    const s = 0.052;
    heartShape.moveTo(0, -0.5 * s);
    heartShape.bezierCurveTo(-0.55 * s, -0.05 * s, -0.5 * s, 0.45 * s, 0, 0.32 * s);
    heartShape.bezierCurveTo(0.5 * s, 0.45 * s, 0.55 * s, -0.05 * s, 0, -0.5 * s);
  }
  const outlinePts = heartShape.getPoints(48);
  const outline = new THREE.BufferGeometry().setFromPoints(outlinePts.map((p) => new THREE.Vector3(p.x, p.y, 0)));
  heart.add(new THREE.Line(outline, track(new THREE.LineBasicMaterial({ color: '#ffe0a6', transparent: true, opacity: 0.95 }))));
  // the outline again, as a real tube, so it has thickness at arm's length
  {
    const curve = new THREE.CatmullRomCurve3(outlinePts.map((p) => new THREE.Vector3(p.x, p.y, 0)), true);
    heart.add(new THREE.Mesh(track(new THREE.TubeGeometry(curve, 56, 0.0055, 6, true)), gold));
  }
  // the stone, a small faceted drop inside the heart
  const gem = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.017, 1)), stone);
  gem.name = 'necklace-stone';
  gem.position.set(0, 0.002, 0);
  heart.add(gem);
  const spark = new THREE.Mesh(track(new THREE.SphereGeometry(0.0055, 8, 6)), stoneLight);
  spark.position.set(-0.004, 0.008, 0.012);
  heart.add(spark);
  // The pendant hangs from its own pivot, at the chain, so it can swing on the neck while the chain stays
  // put. Rotating the whole necklace would spin the hoop round her throat, which is not what gold does.
  const pendantPivot = new THREE.Group();
  pendantPivot.name = 'necklace-pendant-pivot';
  pendantPivot.position.set(0.004, -0.02, NECK.chainRadius * 0.9);
  group.add(pendantPivot);
  heart.position.set(0, -0.042, 0);
  heart.rotation.x = -0.12; // it lies against her throat instead of standing up off it
  pendantPivot.add(heart);

  // A tiny gold hook where the pendant meets the chain
  const hook = new THREE.Mesh(track(new THREE.SphereGeometry(0.011, 8, 6)), goldLight);
  hook.position.copy(pendantPivot.position);
  group.add(hook);

  // ---- the hand-off ---------------------------------------------------------
  // `worn` is the group the couple's body owns. `loose` is what the scene moves through the air; when
  // the scene ends, the caller attaches `worn` to her body at NECK and it stays there for the game.
  const worn = new THREE.Group();
  worn.name = 'necklace-worn';
  worn.add(group);
  group.position.set(0, 0, 0);

  let glitter = 0;
  const sparkBase = 0.2;

  // A slow shimmer on the gold and the stone. Called every frame once it is on her neck; it never
  // allocates and never changes the geometry, so a necklace the rest of the game wears is free.
  // `swing` is the pendant's own rotation in radians (0 is at rest). The scene drives it while the
  // necklace is being put on; afterwards a settled necklace only breathes.
  function update(t, dt, wornLevel = 1, swing = null) {
    gold.emissiveIntensity = 0.12 + wornLevel * (0.1 + Math.sin(t * 1.7) * 0.05);
    stone.emissiveIntensity = 0.5 + wornLevel * (0.25 + Math.sin(t * 2.3 + 1) * 0.15);
    stoneLight.color.setRGB(1, 0.83 + Math.sin(t * 3.1) * 0.05, 0.89);
    glitter = sparkBase * wornLevel;
    spark.scale.setScalar(1 + glitter * Math.abs(Math.sin(t * 2.7)) * 0.9);
    // The pendant swings out from her throat and back, and a settled one only sways a hair with her
    // breathing. The inward half of the swing is heavily damped: a pendant can lift off a neck, but it
    // cannot pass through one, and the pivot is only a few centimetres from her skin.
    const target = swing === null ? Math.sin(t * 1.15) * 0.02 : (swing > 0 ? swing : swing * 0.25);
    pendantPivot.rotation.x += (target - pendantPivot.rotation.x) * Math.min(1, dt * 18);
  }

  // Counts: a test uses these to make sure the necklace is jewellery and not a wire hoop.
  const counts = (() => {
    let meshes = 0;
    let lines = 0;
    group.traverse((o) => {
      if (o.isMesh) meshes += 1;
      else if (o.isLine) lines += 1;
    });
    return { meshes, lines };
  })();

  return { group, worn, update, heart, counts };
}
