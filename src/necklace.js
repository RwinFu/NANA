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
  // A white brilliant, not a pink bead. A gem reads as "bright" through contrast: almost no diffuse colour of
  // its own, a very hard specular, and a touch of self-light so it still glitters in shadow. `toneMapped:
  // false` on the sparkle keeps the highlight from being rolled off to a dull grey by the tone mapping.
  const stone = track(new THREE.MeshPhysicalMaterial({
    color: '#ffffff', roughness: 0.02, metalness: 0.0,
    clearcoat: 1, clearcoatRoughness: 0.0,
    emissive: '#ffffff', emissiveIntensity: 0.42,
    envMapIntensity: 1.6,
  }));
  const stoneLight = track(new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));

  const group = new THREE.Group();
  group.name = 'necklace';

  // ---- the chain ------------------------------------------------------------
  // A necklace, not a hoop. Her neck is only about five millimetres tall as a cylinder (radius 0.113 at
  // body y 1.68) and flares out to 0.20 immediately below, into the pearl collar of her bodice. A ring of any
  // visible width therefore cannot encircle her neck at all: it either sits inside the flare, where the dress
  // hides it, or exactly on her own gold choker, where it looks like part of the collar.
  //
  // So it is built the way a real necklace looks from the front: a strand that goes round the back of her neck
  // (thin, and hidden behind her hair and collar, as it is on a real person) and then *lies on her chest* --
  // out over the collar and down to the pendant in a shallow V. The strand is placed a few millimetres proud
  // of the fabric at every point, so it lies on her rather than in her.
  const STRAND = [
    [0, 0.006, -0.124],      // behind her neck
    [0.104, 0.004, -0.068],
    [0.126, 0.0, 0.012],     // the side of her throat, just outside her choker
    [0.108, -0.010, 0.155],
    [0.074, -0.026, 0.238],  // out over the pearl collar
    [0, -0.050, 0.262],      // the bottom of the V, where the pendant hangs
    [-0.074, -0.026, 0.238],
    [-0.108, -0.010, 0.155],
    [-0.126, 0.0, 0.012],
    [-0.104, 0.004, -0.068],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const strandCurve = new THREE.CatmullRomCurve3(STRAND, true, 'catmullrom', 0.35);
  // A little thicker than jewellery-scale: at the size these characters are drawn, a true-scale chain is a
  // hairline that reads as a drawing artefact rather than as gold.
  const chain = new THREE.Mesh(track(new THREE.TubeGeometry(strandCurve, 110, 0.0076, 8, true)), gold);
  chain.name = 'necklace-strand';
  group.add(chain);
  // links, so it catches the light the way a chain does instead of reading as a smooth wire
  const beads = new THREE.InstancedMesh(track(new THREE.SphereGeometry(0.0108, 8, 6)), goldLight, 34);
  {
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 34; i += 1) {
      const at = strandCurve.getPointAt(i / 34);
      dummy.position.copy(at);
      dummy.updateMatrix();
      beads.setMatrixAt(i, dummy.matrix);
    }
    beads.instanceMatrix.needsUpdate = true;
  }
  group.add(beads);

  // ---- the clasp, at the back ------------------------------------------------
  // A small knot at the nape, so the ring does not read as a closed loop with no way in.
  const clasp = new THREE.Mesh(track(new THREE.SphereGeometry(0.018, 10, 8)), goldLight);
  clasp.position.set(0, 0.006, -0.124);
  group.add(clasp);

  // ---- the heart ------------------------------------------------------------
  // An openwork heart: a heart-shaped outline in the vertical plane, with a stone set inside it. Built
  // from a curve, so it is a real heart and not a diamond.
  const heart = new THREE.Group();
  heart.name = 'necklace-heart';
  // the pendant hangs from a short length of chain, on the front of her throat
  const drop = new THREE.Mesh(track(new THREE.CylinderGeometry(0.005, 0.005, 0.05, 6)), gold);
  drop.position.set(0, 0.036, -0.004);
  heart.add(drop);

  const heartShape = new THREE.Shape();
  {
    // A proper heart in a 1 x 1 box, point down: two lobes over a notch, then down to the point. (The first
    // version's control points flattened the lobes into a blob, which is what it looked like on her chest.)
    const s = 0.070;
    heartShape.moveTo(0, -0.5 * s);
    heartShape.bezierCurveTo(-0.42 * s, -0.22 * s, -0.62 * s, 0.22 * s, -0.30 * s, 0.34 * s);
    heartShape.bezierCurveTo(-0.12 * s, 0.42 * s, 0, 0.24 * s, 0, 0.16 * s); // the notch
    heartShape.bezierCurveTo(0, 0.24 * s, 0.12 * s, 0.42 * s, 0.30 * s, 0.34 * s);
    heartShape.bezierCurveTo(0.62 * s, 0.22 * s, 0.42 * s, -0.22 * s, 0, -0.5 * s);
  }
  // A *solid* gold heart, not just its outline: at this size an openwork pendant is a few pixels wide and
  // reads as a smudge. It is extruded thin with a bevel, so it catches a highlight along its edge.
  {
    const plate = new THREE.ExtrudeGeometry(heartShape, {
      depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 13,
    });
    plate.center();
    const solid = new THREE.Mesh(track(plate), gold);
    solid.name = 'necklace-heart-plate';
    heart.add(solid);
  }
  // a raised rim around it, so the edge glints
  {
    const outlinePts = heartShape.getPoints(40);
    const curve = new THREE.CatmullRomCurve3(outlinePts.map((p) => new THREE.Vector3(p.x, p.y, 0.008)), true);
    heart.add(new THREE.Mesh(track(new THREE.TubeGeometry(curve, 48, 0.005, 6, true)), goldLight));
  }
  // the stone, a faceted drop set into the middle of the gold
  const gem = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.023, 1)), stone);
  gem.name = 'necklace-stone';
  gem.position.set(0, 0.004, 0.013);
  heart.add(gem);
  // A four-point glint on the face of the stone. A white gem at this size reads as "bright" through one hard
  // highlight far more than through its own colour, and a real sparkle has arms rather than a round dot.
  {
    const arm = new THREE.PlaneGeometry(0.058, 0.006);
    const armV = new THREE.PlaneGeometry(0.006, 0.058);
    const glintMat = track(new THREE.MeshBasicMaterial({
      color: '#ffffff', toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false,
    }));
    const star = new THREE.Group();
    star.name = 'necklace-glint';
    star.position.set(0, 0.005, 0.026);
    const h = new THREE.Mesh(arm, glintMat);
    const v = new THREE.Mesh(armV, glintMat);
    star.add(h, v);
    heart.add(star);
    const spark = new THREE.Mesh(track(new THREE.SphereGeometry(0.008, 8, 6)), stoneLight);
    spark.position.set(0, 0.005, 0.028);
    heart.add(spark);
  }
  const spark = new THREE.Mesh(track(new THREE.SphereGeometry(0.0055, 8, 6)), stoneLight);
  spark.position.set(-0.004, 0.008, 0.012);
  heart.add(spark);
  // The pendant hangs from its own pivot, at the chain, so it can swing on the neck while the chain stays
  // put. Rotating the whole necklace would spin the hoop round her throat, which is not what gold does.
  const pendantPivot = new THREE.Group();
  pendantPivot.name = 'necklace-pendant-pivot';
  // The pendant hangs from the *front* of the ring, not from its centre: hung from the middle it drops
  // straight into her bodice.
  pendantPivot.position.set(0, -0.052, 0.262);
  group.add(pendantPivot);
  // It hangs down the *front*: her bodice surface is at z ~= 0.21 here, so the pendant is offset forward of
  // the chain's own ring and tipped to lie on the fabric. Hung straight down from the ring it ended up
  // inside her throat, which is exactly what it looked like.
  // It hangs *in front of the chain*, and only slightly tipped. Her bodice flares out below the neck -- its
  // front face is at z ~0.19 while the chain sits at 0.145 -- so a pendant hung down the chain's own line is
  // always inside the fabric. Hanging it outside the chain (which is how the gold actually lies on a neck) and
  // tipping it only ~20 degrees keeps the heart's face toward the camera, so it reads as a heart and not as a
  // foreshortened U.
  heart.position.set(0, -0.062, 0.004);
  heart.rotation.x = -0.3;
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
    // a white sparkle: the small variation keeps it alive without tinting it
    const glint = 0.94 + Math.sin(t * 3.1) * 0.06;
    stoneLight.color.setRGB(glint, glint, glint);
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
