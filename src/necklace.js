import * as THREE from 'three';
import { NECK } from './gift.js';

// The necklace: a fine silver chain with a round stone in a silver setting.
//
// It is built to *be worn*: the chain's own centre is the choker's height on the princess
// (NECK.y, and the body is scaled as a whole around it), the pendant hangs just under that, and the
// whole thing is small enough that it reads at arm's length instead of looking like a costume piece.
//
// The chain is silver and the stone is round. It used to be a gold chain with a heart-shaped pendant, and the
// shape of a heart is what made it read at arm's length; a round stone has to earn that by itself, so the mount
// round it is what does the work here: a bezel with claws over the stone's edge, which is what a round stone is
// set in. See `pendant` below.
//
// The same object is used for the scene (it rises out of the fairy's box and turns in the air) and for
// the rest of the game (it stays on her neck). `createNecklace` builds it once; `worn` is the group that
// hangs on her body, `loose` is the group that flies about before it settles.

// A round brilliant, in geometry: the profile is a lathe curve -- a flat table at the top, a girdle at the widest
// point, and a run of facets converging to the culet at the bottom. `r` is the girdle's radius, so the stone's own
// width is 2r, which is what the bezel is sized from. Lathed, so it also has a centre axis for the sparkle to sit
// on and it reads as round from every angle, edge-on included.
function roundBrilliant(r) {
  const table = r * 0.55;
  // Bottom to top: a lathe builds its surface in the order the profile is given, and its faces point outward only
  // when the profile climbs. Built the other way round, the stone is inside out -- you look through its front faces
  // at the inside of its back, and it reads as a pink glass bead with a dark seam across it.
  const prof = [
    [0, -r * 0.88],           // the culet
    [r * 0.38, -r * 0.74],
    [r * 0.80, -r * 0.40],    // the pavilion's facet ring
    [r, 0],                   // the girdle, the widest point
    [r * 0.985, r * 0.10],    // the crown's facet ring
    [table, r * 0.46],        // the table's edge
    [0, r * 0.46],            // the table's centre
  ].map(([x, y]) => new THREE.Vector2(x, y));
  // Twelve facets round, and lit flat: a brilliant is a cut solid, so its faces meet at edges that catch the
  // light separately. Smoothed, a lathe makes a pearl -- round and glossy, but with no sparkle in it.
  // (`computeVertexNormals` returns nothing in this three, so it cannot be chained onto the geometry.)
  const cut = new THREE.LatheGeometry(prof, 12).toNonIndexed();
  cut.computeVertexNormals();
  // And a cut stone is not one colour: each facet faces a little differently, catches the light or turns away from
  // it, and that alternation *is* the sparkle. Under the soft light of this garden, flat normals alone leave the
  // stone a white blob, so each facet is also given its own tint -- a cool pale grey on the ones that turn away and
  // near-white on the ones that face the light. Deterministic (facet index and band, never random), so the stone is
  // the same stone on every frame and in every screenshot.
  const pos = cut.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const tint = new THREE.Color();
  const away = new THREE.Color('#b3c6da');   // a facet the light misses: the stone's own cool grey
  const facing = new THREE.Color('#ffffff'); // a facet the light lands on
  // (these are sRGB hex, which three converts to the linear values a vertex colour has to be in, so the numbers
  // read back off the attribute are linear ones -- tests/gift.test.js compares them as such.)
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const around = Math.atan2(cz, cx);
    const facet = Math.floor(((around + Math.PI) / (Math.PI * 2)) * 12) % 12;
    const band = cy > r * 0.12 ? 0 : cy > -r * 0.12 ? 1 : 2; // table / crown / pavilion
    const k = (facet * 5 + band * 3) % 6;                     // 0-5, spread over the facets
    const lit = k === 0 || k === 3 ? 1 : k === 1 || k === 4 ? 0.3 : 0.62;
    tint.copy(away).lerp(facing, lit);
    for (let v = 0; v < 3; v += 1) colors.set([tint.r, tint.g, tint.b], (i + v) * 3);
  }
  cut.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return cut;
}

export function createNecklace(track = (o) => o) {
  // Silver, in the two tones a chain has: the strand is the quieter one and the links, the clasp and the setting
  // are polished, so the piece still catches a highlight without a warm colour to carry it. Silver's own tint is
  // a very slightly blue grey (not white), which is what keeps it off looking like chrome.
  const silver = track(new THREE.MeshStandardMaterial({
    color: '#dfe4ec', metalness: 1, roughness: 0.18,
    emissive: '#2b333d', emissiveIntensity: 0.1,
  }));
  const silverLight = track(new THREE.MeshStandardMaterial({
    color: '#f6f8fb', metalness: 0.98, roughness: 0.08,
    emissive: '#3d4753', emissiveIntensity: 0.16,
  }));
  // MeshPhysicalMaterial (not Standard) for the stone: the clearcoat is what gives a cut gem its wet
  // highlight, and Standard silently drops it.
  // A white brilliant, not a pink bead. A gem reads as "bright" through contrast: almost no diffuse colour of
  // its own, a very hard specular, and a touch of self-light so it still glitters in shadow. `toneMapped:
  // false` on the sparkle keeps the highlight from being rolled off to a dull grey by the tone mapping.
  const stone = track(new THREE.MeshPhysicalMaterial({
    color: '#ffffff', roughness: 0.04, metalness: 0.0, flatShading: true, vertexColors: true,
    clearcoat: 1, clearcoatRoughness: 0.0,
    emissive: '#dfeaf7', emissiveIntensity: 0.10,
    envMapIntensity: 0.9,
  }));
  const stoneLight = track(new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
  // Silver is the one colour here that is *made* of what it reflects: `metalness: 1` throws away almost all of the
  // material's own diffuse colour and shows the surroundings instead. With no environment map to reflect, a silver
  // chain has nothing to show and renders as a dark line with a few hard highlights -- which is exactly what a
  // black chain looks like. So the piece carries its own list of metals and is handed the scene's environment map
  // (the same soft studio one the characters' glossy parts use). See `setEnvironment`.
  const metals = [silver, silverLight];

  const group = new THREE.Group();
  group.name = 'necklace';

  // ---- the chain ------------------------------------------------------------
  // A necklace, not a hoop. Her neck is only about five millimetres tall as a cylinder (radius 0.113 at
  // body y 1.68) and flares out to 0.20 immediately below, into the pearl collar of her bodice. A ring of any
  // visible width therefore cannot encircle her neck at all: it either sits inside the flare, where the dress
  // hides it, or exactly on her own choker, where it looks like part of the collar.
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
  // hairline that reads as a drawing artefact rather than as metal.
  const chain = new THREE.Mesh(track(new THREE.TubeGeometry(strandCurve, 110, 0.0076, 8, true)), silver);
  chain.name = 'necklace-strand';
  group.add(chain);
  // links, so it catches the light the way a chain does instead of reading as a smooth wire
  const beads = new THREE.InstancedMesh(track(new THREE.SphereGeometry(0.0108, 8, 6)), silverLight, 34);
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
  const clasp = new THREE.Mesh(track(new THREE.SphereGeometry(0.018, 10, 8)), silverLight);
  clasp.position.set(0, 0.006, -0.124);
  group.add(clasp);

  // ---- the pendant: a round stone in a silver setting ------------------------
  // A round stone on a neck at this size has no heart's silhouette to be read by, so the *setting* is what makes
  // it a pendant: a bezel round the stone, four claws bent over its edge, and a bail at the top for the chain.
  // The whole thing is drawn, so to speak, edge-on to the camera the way a real pendant lies.
  const pendant = new THREE.Group();
  pendant.name = 'necklace-pendant';
  // The group is still called `heart` by everything that measured it (the gift film aims at `gem`, the tests at
  // `heart.position`), so it keeps the name -- but there is no heart in it any more. See ROUND below.
  const heart = pendant;
  // the short length of chain from the bail down to the stone
  const drop = new THREE.Mesh(track(new THREE.CylinderGeometry(0.005, 0.005, 0.05, 6)), silver);
  drop.name = 'necklace-drop';
  drop.position.set(0, 0.036, -0.004);
  pendant.add(drop);

  // ---- the setting ----------------------------------------------------------
  // A torus, not a cylinder: the stone sits *in* it, so the bezel has to be a ring around the stone's edge with a
  // hole in the middle. Its radius is the stone's own, and the tube is the metal's thickness.
  const ROUND = 0.023; // the stone's radius
  // A bezel closes *over* the stone's edge, so the ring does not lie in the girdle's plane behind the crown -- it
  // sits a little in front of it, where the stone is already narrower, and the metal covers the edge. That is what
  // makes the stone look set rather than resting in a hoop: you see metal, then stone inside it, on the same face.
  const BEZEL_TUBE = 0.0034;
  const bezel = new THREE.Mesh(
    track(new THREE.TorusGeometry(ROUND - 0.0022 + BEZEL_TUBE, BEZEL_TUBE, 10, 44)),
    silver,
  );
  bezel.name = 'necklace-bezel';
  bezel.position.set(0, 0.004, 0.017);
  pendant.add(bezel);
  // the back of the setting, a shallow dish the stone is seated on -- so the pendant is not a ring with a hole
  // through it when it turns edge-on
  {
    const seat = new THREE.Mesh(track(new THREE.SphereGeometry(ROUND - 0.0016, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5)), silver);
    seat.name = 'necklace-seat';
    seat.rotation.x = Math.PI / 2;
    seat.scale.set(1, 1, 0.38);
    seat.position.set(0, 0.004, 0.004);
    pendant.add(seat);
  }
  // Four claws over the stone's edge, at the diagonal, so they read as claws and not as a cross. Each one stands
  // *on* the bezel and bends inward over the crown, so the tip is the only part of it that crosses the stone.
  {
    const claw = new THREE.ConeGeometry(0.0040, 0.0095, 8);
    [45, 135, 225, 315].forEach((deg) => {
      const a = (deg * Math.PI) / 180;
      const m = new THREE.Mesh(track(claw.clone()), silverLight);
      m.name = 'necklace-claw';
      const r = ROUND - BEZEL_TUBE;
      m.position.set(Math.cos(a) * r, 0.004 + Math.sin(a) * r, 0.0195);
      // the tip bends inward over the stone
      m.rotation.set(Math.PI / 2 + Math.sin(a) * 0.85, 0, -Math.cos(a) * 0.85);
      pendant.add(m);
    });
  }
  // The bail: a small ring at the top of the setting, which is where the chain's drop meets it.
  {
    const bail = new THREE.Mesh(track(new THREE.TorusGeometry(0.0075, 0.0028, 8, 20)), silverLight);
    bail.name = 'necklace-bail';
    bail.position.set(0, 0.0305, 0.006);
    pendant.add(bail);
  }
  // The stone itself: a round cut, which in geometry is a two-ring lathe -- a flat table on top, a girdle at the
  // widest point, and facets converging underneath. An octahedron was the old drop's shape; a round stone cut
  // from one would be a lumpy ball at this size.
  // It is not transparent: a clear stone at this size would show the *inside* of its own setting -- the dark of the
  // bezel and the back of the pavilion -- and read as a hole with a pink floor. Opaque, it is a cut white solid,
  // lit and faceted, which is what a brilliant reads as at arm's length.
  const gem = new THREE.Mesh(track(roundBrilliant(ROUND)), stone);
  gem.name = 'necklace-stone';
  // A lathe turns round the Y axis, so the cut as built has its table facing up. A pendant's stone faces *out* --
  // the table has to look at whoever is looking at her -- so it is stood up: the girdle becomes the circle you see,
  // the culet goes back into the setting, and the facets fan out from the centre of the stone.
  gem.rotation.x = Math.PI / 2;
  gem.position.set(0, 0.004, 0.013);
  pendant.add(gem);
  // A four-point glint on the face of the stone. A white gem at this size reads as "bright" through one hard
  // highlight far more than through its own colour, and a real sparkle has arms rather than a round dot.
  {
    // The arms are short enough to stay inside the stone: at arm's length a cross any bigger reads as a plus sign
    // drawn on the pendant rather than as a light landing on it.
    const arm = new THREE.PlaneGeometry(0.021, 0.0030);
    const armV = new THREE.PlaneGeometry(0.0030, 0.021);
    const glintMat = track(new THREE.MeshBasicMaterial({
      color: '#ffffff', toneMapped: false, transparent: true, opacity: 0.34, depthWrite: false,
    }));
    const star = new THREE.Group();
    star.name = 'necklace-glint';
    star.position.set(0, 0.005, 0.026);
    const h = new THREE.Mesh(arm, glintMat);
    const v = new THREE.Mesh(armV, glintMat);
    star.add(h, v);
    pendant.add(star);
    // the hot centre of the glint: a small dot, so the stone's own facets still show through it
    const spark = new THREE.Mesh(track(new THREE.SphereGeometry(0.0032, 8, 6)), stoneLight);
    spark.position.set(0, 0.005, 0.028);
    pendant.add(spark);
  }
  const spark = new THREE.Mesh(track(new THREE.SphereGeometry(0.0034, 8, 6)), stoneLight);
  spark.position.set(-0.004, 0.008, 0.012);
  pendant.add(spark);
  // The pendant hangs from its own pivot, at the chain, so it can swing on the neck while the chain stays
  // put. Rotating the whole necklace would spin the hoop round her throat, which is not what a chain does.
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
  // always inside the fabric. Hanging it outside the chain (which is how a necklace actually lies on a neck) and
  // tipping it only ~20 degrees keeps the stone's face toward the camera, so it reads as a stone and not as a
  // foreshortened edge.
  heart.position.set(0, -0.062, 0.004);
  heart.rotation.x = -0.3;
  pendantPivot.add(heart);

  // A tiny silver hook where the pendant meets the chain
  const hook = new THREE.Mesh(track(new THREE.SphereGeometry(0.011, 8, 6)), silverLight);
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

  // A slow shimmer on the silver and the stone. Called every frame once it is on her neck; it never
  // allocates and never changes the geometry, so a necklace the rest of the game wears is free.
  // `swing` is the pendant's own rotation in radians (0 is at rest). The scene drives it while the
  // necklace is being put on; afterwards a settled necklace only breathes.
  function update(t, dt, wornLevel = 1, swing = null) {
    silver.emissiveIntensity = 0.1 + wornLevel * (0.09 + Math.sin(t * 1.7) * 0.04);
    stone.emissiveIntensity = 0.07 + wornLevel * (0.03 + Math.sin(t * 2.3 + 1) * 0.025);
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

  // `gem` is exported so the film can aim at the *stone* rather than at the chain's centre: the stone is the
  // thing that has to be sharp, and it sits a few centimetres below the group's origin.
  // The main scene builds the characters' environment map once and gives it to the character materials; the
  // necklace is built separately, so it is given the same texture by hand. Without it the silver is black.
  function setEnvironment(texture) {
    metals.forEach((m) => {
      m.envMap = texture;
      m.needsUpdate = true;
    });
    stone.envMap = texture;
    stone.needsUpdate = true;
  }

  return { group, worn, update, setEnvironment, heart, gem, counts };
}
