import * as THREE from 'three';

function shape(points) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) s.lineTo(x, y);
  s.closePath();
  return s;
}

// The shell is separate from the letter so its opening animation and hit targets
// remain unchanged. All front details are attached to the surface they decorate.
export function createEnvelopeShell(w, h, paperNormal, flapNormal) {
  const root = new THREE.Group();
  root.name = 'envelope-shell';
  const geometries = [], materials = [];
  const geo = (g) => { geometries.push(g); return g; };
  const mat = (m) => { materials.push(m); return m; };
  const material = (color, normal = paperNormal) => mat(new THREE.MeshStandardMaterial({
    color, roughness: 0.88, side: THREE.DoubleSide,
    normalMap: normal, normalScale: new THREE.Vector2(0.28, 0.28),
  }));
  const bodyMat = material('#f2e3db');
  const leftMat = material('#ead7d4');
  const rightMat = material('#f0dedb');
  const frontMat = material('#f8ece6');
  const flapMat = material('#e6bcc6', flapNormal);
  const seamMat = mat(new THREE.LineBasicMaterial({ color: '#bf929c', transparent: true, opacity: 0.55 }));

  const body = new THREE.Mesh(geo(new THREE.BoxGeometry(w, h, 0.1)), bodyMat);
  body.name = 'envelope-body';
  body.position.y = h / 2;
  root.add(body);

  const panel = (name, points, panelMat, z) => {
    const mesh = new THREE.Mesh(geo(new THREE.ShapeGeometry(shape(points))), panelMat);
    mesh.name = name; mesh.position.z = z; root.add(mesh);
    return mesh;
  };
  panel('left-fold', [[-w / 2, 0], [-w / 2, h], [0, h * 0.43]], leftMat, 0.052);
  panel('right-fold', [[w / 2, 0], [w / 2, h], [0, h * 0.43]], rightMat, 0.053);
  panel('bottom-fold', [[-w / 2, 0], [w / 2, 0], [0, h * 0.5]], frontMat, 0.056);
  const seam = (points, z) => {
    const line = new THREE.Line(geo(new THREE.BufferGeometry().setFromPoints(
      points.map(([x, y]) => new THREE.Vector3(x, y, z))
    )), seamMat);
    root.add(line);
  };
  seam([[-w / 2 + 0.02, 0.025], [0, h * 0.5], [w / 2 - 0.02, 0.025]], 0.058);

  // Rounded flap corner, hinged at the top. Its wax seal follows the flap.
  const flapShape = new THREE.Shape();
  flapShape.moveTo(-w / 2, 0);
  flapShape.lineTo(w / 2, 0);
  flapShape.lineTo(0.12, -h * 0.59);
  flapShape.quadraticCurveTo(0, -h * 0.65, -0.12, -h * 0.59);
  flapShape.closePath();
  const flapPivot = new THREE.Group();
  flapPivot.name = 'flap-hinge';
  flapPivot.position.set(0, h, 0.063);
  root.add(flapPivot);
  const flap = new THREE.Mesh(geo(new THREE.ShapeGeometry(flapShape, 24)), flapMat);
  flap.name = 'envelope-flap';
  flapPivot.add(flap);
  const flapEdge = new THREE.Line(geo(new THREE.BufferGeometry().setFromPoints(
    flapShape.getPoints(32).map((p) => new THREE.Vector3(p.x, p.y, 0.002))
  )), seamMat);
  flapPivot.add(flapEdge);

  // ---- The wax seal -------------------------------------------------------
  // Wax over a flap of paper breaks along the line where the flap meets the envelope: the upper half
  // rides up with the flap, the lower half stays stuck to the body. That is why the seal is two halves
  // in two different parents — a single disc can only turn with the flap, which is all it used to do.
  //
  // The seal also sits *on* the flap's edge rather than 5 cm above it. It used to sit clear of the
  // edge, so it was decoration on the flap and sealed nothing; here the cut through its middle is the
  // flap's own edge, which is what makes the break read.
  const sealMat = mat(new THREE.MeshStandardMaterial({ color: '#a8576d', roughness: 0.66, side: THREE.DoubleSide }));
  const waxBackMat = mat(new THREE.MeshStandardMaterial({ color: '#8d4257', roughness: 0.8 }));
  const trimMat = mat(new THREE.MeshStandardMaterial({ color: '#d2a58f', roughness: 0.58, metalness: 0.2 }));
  const sealR = 0.155;
  const sealY = -h * 0.63; // the flap's point is at -h * 0.65: the cut through the seal is that edge
  // A semicircle in the XY plane facing +z, spanning y >= 0. Thickness is a millimetre or two at this
  // size; the material is double sided, so one face is enough.
  const halfGeo = geo(new THREE.CircleGeometry(sealR, 24, 0, Math.PI));
  const sealPlateGeo = geo(new THREE.CircleGeometry(sealR, 40, 0, Math.PI * 2));

  // the whole seal, shown until it breaks
  const sealWhole = new THREE.Group();
  sealWhole.name = 'wax-seal';
  sealWhole.position.set(0, sealY, 0.012);
  flapPivot.add(sealWhole);
  const plate = new THREE.Mesh(sealPlateGeo, sealMat);
  plate.position.y = 0;
  sealWhole.add(plate);
  const heart = new THREE.Shape();
  heart.moveTo(0, -0.055);
  heart.bezierCurveTo(-0.11, 0.015, -0.055, 0.09, 0, 0.045);
  heart.bezierCurveTo(0.055, 0.09, 0.11, 0.015, 0, -0.055);
  const emblem = new THREE.Mesh(geo(new THREE.ShapeGeometry(heart, 20)), trimMat);
  emblem.position.z = 0.004; sealWhole.add(emblem);
  const rim = new THREE.Mesh(geo(new THREE.TorusGeometry(0.127, 0.004, 6, 40)), trimMat);
  rim.position.z = 0.003; sealWhole.add(rim);

  // the two halves, hidden until the wax gives, each exactly half of the plate above
  const sealTop = new THREE.Group();
  sealTop.name = 'wax-seal-top';
  sealTop.position.set(0, sealY, 0.012);
  flapPivot.add(sealTop);
  sealTop.add(new THREE.Mesh(halfGeo, sealMat));

  const sealBottom = new THREE.Group();
  sealBottom.name = 'wax-seal-bottom';
  // the same plane in the world, but a child of the envelope, not of the flap
  sealBottom.position.set(0, h + sealY, 0.063 + 0.012);
  root.add(sealBottom);
  const bottomHalf = new THREE.Mesh(halfGeo, sealMat);
  bottomHalf.rotation.z = Math.PI; // the same semicircle turned over into y <= 0
  sealBottom.add(bottomHalf);
  // a ragged inner edge, so the break is wax and not a ruler line
  const roughMat = mat(new THREE.MeshStandardMaterial({ color: '#9a4c60', roughness: 0.9, side: THREE.DoubleSide }));
  const chips = [];
  [-0.11, -0.05, 0.02, 0.08, 0.13].forEach((cx, i) => {
    const chip = new THREE.Mesh(geo(new THREE.CircleGeometry(0.022 + (i % 2) * 0.01, 8)), roughMat);
    chip.position.set(cx, cx * 0.1, 0.002);
    sealBottom.add(chip);
    chips.push(chip);
  });

  // Cracks: fine dark lines across the wax, hidden until the seal starts to give. They are what the
  // eye reads as "this is about to break", a moment before the halves actually part.
  const crackMat = mat(new THREE.MeshBasicMaterial({ color: '#4a1f2c', transparent: true, opacity: 0, side: THREE.DoubleSide }));
  const cracks = [];
  [[-0.075, 0.03, 0.16], [0.02, -0.02, -0.3], [0.085, 0.045, 0.06]].forEach(([cx, cy, tilt]) => {
    const m = new THREE.Mesh(geo(new THREE.PlaneGeometry(0.1, 0.011)), crackMat);
    m.position.set(cx, cy, 0.006);
    m.rotation.z = tilt;
    sealWhole.add(m);
    cracks.push(m);
  });

  return {
    group: root,
    body,
    flap,
    flapPivot,
    sealWhole,
    sealTop,
    sealBottom,
    cracks,
    // 0 is whole wax, 1 is a broken seal: the cracks open, then the pieces tilt and the upper half
    // pulls away with the flap. (`step` is driven from envelope.js, not from here.)
    // t: 0 is a whole seal, 0.3 is where it splits, 1 is fully apart. `gone` takes the wax off the
    // envelope altogether — the flap carries the upper half away, and once the paper has come out the
    // seal has done its job and should not still be hanging in the air.
    setBreak(t, gone = false) {
      const k = Math.min(1, Math.max(0, t));
      // the cracks show first, then the plate is swapped for the two halves, then they part
      const split = k >= 0.3;
      sealWhole.visible = !gone && !split;
      sealTop.visible = !gone && split;
      sealBottom.visible = !gone && split;
      cracks.forEach((c) => {
        c.visible = k > 0.02 && !split;
        c.scale.y = 0.4 + k * 2.4; // the crack widens
      });
      crackMat.opacity = k > 0.02 && !split ? 0.55 + k * 1.5 : 0;
      // once apart, the upper half rocks and lifts a little as the flap starts to carry it
      const open = Math.max(0, (k - 0.3) / 0.7);
      sealTop.rotation.z = -open * 0.12;
      sealTop.position.y = sealY + open * 0.01;
      chips.forEach((chip, i) => { chip.visible = !gone && split && (i + open * 3) % 1 < 0.8; });
    },
    dispose() { geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); },
  };
}
