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

  const sealMat = mat(new THREE.MeshStandardMaterial({ color: '#a8576d', roughness: 0.66 }));
  const trimMat = mat(new THREE.MeshStandardMaterial({ color: '#d2a58f', roughness: 0.58, metalness: 0.2 }));
  const seal = new THREE.Group();
  seal.name = 'wax-seal';
  seal.position.set(0, -h * 0.555, 0.01);
  flapPivot.add(seal);
  seal.add(new THREE.Mesh(geo(new THREE.CylinderGeometry(0.155, 0.16, 0.018, 40)), sealMat));
  seal.children[0].rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(geo(new THREE.TorusGeometry(0.127, 0.004, 6, 40)), trimMat);
  rim.position.z = 0.012; seal.add(rim);
  const heart = new THREE.Shape();
  heart.moveTo(0, -0.055);
  heart.bezierCurveTo(-0.11, 0.015, -0.055, 0.09, 0, 0.045);
  heart.bezierCurveTo(0.055, 0.09, 0.11, 0.015, 0, -0.055);
  const emblem = new THREE.Mesh(geo(new THREE.ShapeGeometry(heart, 20)), trimMat);
  emblem.position.z = 0.013; seal.add(emblem);

  return {
    group: root, body, flap, flapPivot,
    dispose() { geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); },
  };
}
