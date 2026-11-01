import * as THREE from 'three';

// Kept independent of navigation: these are visual tufts, never colliders.
// The two trees by the lane are at x = -20.8 (see world.js), so keep their tufts off the stones.
// The three trees that used to stand east of the lawn (15,10), (16,20) and (20,1) came out when the
// funfair opened its lane east of the door: the path east runs at z = 3 and the fair's apron starts
// at x = 13.5, so a tree at (15,10) or (20,1) would have stood on the fair's own ground. Nothing
// else about the garden changed.
const TREES = [[-11, 3], [-20.8, 24.2], [-6, 22], [-17, 18], [-12, 22], [11, 4], [9, 15], [12, 24], [-20.8, 20.4]];
const LAMPS = [[-9, 3], [9, 3], [-9, 14], [9, 14]];
const TUFT_COUNT = 1000;
const FLOWER_COUNT = 54;

function random(seed) {
  let n = seed >>> 0;
  return () => {
    n = (n + 0x6d2b79f5) >>> 0;
    let t = n;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function grassAllowed(x, z) {
  if (Math.abs(x) < 1.55 || Math.abs(x) > 21.5 || z < 1.8 || z > 25.5) return false;
  // The lane to town leaves on the west side; keep its stones clear of grass
  if (Math.abs(x + 19) < 2.9) return false;
  if (Math.hypot(x + 14, z - 8) < 2.15) return false; // fountain
  if (Math.abs(x + 14) < 1.7 && Math.abs(z - 11.4) < 1.2) return false; // bench
  return true;
}

export function grassLayout(count = TUFT_COUNT, seed = 4821) {
  const rng = random(seed);
  const tufts = [];
  for (let tries = 0; tufts.length < count && tries < count * 20; tries += 1) {
    let x, z;
    const mode = rng();
    if (mode < 0.4) {
      const [tx, tz] = TREES[Math.floor(rng() * TREES.length)];
      const a = rng() * Math.PI * 2;
      const r = 0.65 + rng() * 3.0;
      x = tx + Math.cos(a) * r; z = tz + Math.sin(a) * r;
    } else if (mode < 0.7) {
      x = (rng() < 0.5 ? -1 : 1) * (1.65 + rng() * 2.0);
      z = 2 + rng() * 23;
    } else {
      x = (rng() * 2 - 1) * 21; z = 2 + rng() * 23;
    }
    if (!grassAllowed(x, z)) continue;
    tufts.push({ x, z, yaw: rng() * Math.PI * 2, scale: 0.75 + rng() * 0.55,
      phase: rng() * Math.PI * 2, shade: rng(), bendX: 0, bendZ: 0 });
  }
  return tufts;
}

export function grassPressure(x, z, actors) {
  let bx = 0, bz = 0;
  for (const actor of actors) {
    if (!actor || !Number.isFinite(actor.x) || !Number.isFinite(actor.z) || (actor.y ?? 0) > 0.8) continue;
    const dx = x - actor.x, dz = z - actor.z;
    const d = Math.hypot(dx, dz);
    if (d >= 1.15) continue;
    const force = (1 - d / 1.15) ** 2 * 0.36;
    const divisor = d || 1;
    bx += (d ? dx / divisor : 1) * force;
    bz += (d ? dz / divisor : 0) * force;
  }
  const len = Math.hypot(bx, bz);
  if (len > 0.38) { bx *= 0.38 / len; bz *= 0.38 / len; }
  return { x: bx, z: bz };
}

// A periodic colour field, so tiled ground stays seamless without hard square edges.
export function grassColourAt(x, y, size = 256) {
  const u = 2 * Math.PI * x / size, v = 2 * Math.PI * y / size;
  const n = Math.sin(u * 2 + Math.sin(v * 3)) * Math.cos(v * 2 - u) * 3.6
    + Math.sin(u * 11 + v * 7) * 1.4 + Math.sin(u * 23 - v * 19) * 0.7;
  return [Math.round(47 + n * 0.7), Math.round(82 + n), Math.round(68 + n * 0.8)];
}

function groundTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const rgb = grassColourAt(x, y);
    const i = (y * 256 + x) * 4;
    image.data[i] = rgb[0]; image.data[i + 1] = rgb[1]; image.data[i + 2] = rgb[2]; image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(20, 15);
  tex.anisotropy = 4;
  return tex;
}

function tuftGeometry() {
  const vertices = [];
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI / 3;
    const dx = Math.cos(a), dz = Math.sin(a);
    const h = [0.24, 0.19, 0.22][i];
    vertices.push(-0.04 * dx, 0, -0.04 * dz, 0.04 * dx, 0, 0.04 * dz,
      0.035 * dx, h, 0.035 * dz);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.computeVertexNormals();
  return geo;
}

function flowerGeometry() {
  // A small stem and five petals in one instanced, low-poly geometry.
  const vertices = [-0.008, 0, 0, 0.008, 0, 0, 0, 0.14, 0];
  const colours = [0.28, 0.43, 0.31, 0.28, 0.43, 0.31, 0.28, 0.43, 0.31];
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5, b = (i + 0.8) * Math.PI * 2 / 5;
    vertices.push(0, 0.14, 0, Math.cos(a) * 0.045, 0.15, Math.sin(a) * 0.045,
      Math.cos(b) * 0.045, 0.15, Math.sin(b) * 0.045);
    colours.push(1, 1, 1, 1, 1, 1, 1, 1, 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  return geo;
}

export function createGardenGrass(scene, groundMaterial) {
  const texture = groundTexture();
  groundMaterial.color.set('#ffffff');
  groundMaterial.map = texture;
  groundMaterial.needsUpdate = true;
  const layout = grassLayout();
  const geometry = tuftGeometry();
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geometry, material, layout.length);
  mesh.name = 'garden-grass';
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const warm = new THREE.Color('#897b52');
  const up = new THREE.Vector3(0, 1, 0), lean = new THREE.Vector3();
  const tilt = new THREE.Quaternion(), yaw = new THREE.Quaternion();
  for (let i = 0; i < layout.length; i++) {
    const item = layout[i];
    color.set(['#456b53', '#52765b', '#3c634d', '#5a7860'][Math.floor(item.shade * 4)]);
    const nearLamp = Math.max(...LAMPS.map(([x, z]) => Math.max(0, 1 - Math.hypot(item.x - x, item.z - z) / 3)));
    color.lerp(warm, nearLamp * 0.18);
    mesh.setColorAt(i, color);
    dummy.position.set(item.x, 0.004, item.z); dummy.rotation.set(0, item.yaw, 0);
    dummy.scale.setScalar(item.scale); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  // Instances extend across the garden; don't cull using a single-tuft bound.
  mesh.frustumCulled = false;
  scene.add(mesh);

  const fGeo = flowerGeometry();
  const flowerMeshes = [];
  const points = grassLayout(FLOWER_COUNT, 9182);
  for (let type = 0; type < 2; type++) {
    const fMat = new THREE.MeshStandardMaterial({ color: type ? '#f2b9ce' : '#f6eff1', vertexColors: true, roughness: 1, side: THREE.DoubleSide });
    const fMesh = new THREE.InstancedMesh(fGeo, fMat, Math.ceil(points.length / 2));
    fMesh.name = type ? 'garden-wildflowers-pink' : 'garden-wildflowers-white';
    let index = 0;
    points.forEach((point, i) => {
      if (i % 2 !== type) return;
      dummy.position.set(point.x, 0.006, point.z); dummy.rotation.set(0, point.yaw, 0);
      dummy.scale.setScalar(point.scale * 0.9); dummy.updateMatrix(); fMesh.setMatrixAt(index++, dummy.matrix);
    });
    fMesh.count = index;
    fMesh.instanceMatrix.needsUpdate = true;
    fMesh.frustumCulled = false;
    scene.add(fMesh); flowerMeshes.push(fMesh);
  }

  // Only four transparent ground patches, rather than extra real-time lights.
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 128;
  const g = glowCanvas.getContext('2d');
  const glow = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  glow.addColorStop(0, 'rgba(255,194,135,0.18)');
  glow.addColorStop(1, 'rgba(255,194,135,0)');
  g.fillStyle = glow; g.fillRect(0, 0, 128, 128);
  const glowTex = new THREE.CanvasTexture(glowCanvas); glowTex.colorSpace = THREE.SRGBColorSpace;
  const glowGeo = new THREE.PlaneGeometry(6, 6);
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: 0.45 });
  const patches = LAMPS.map(([x, z]) => {
    const patch = new THREE.Mesh(glowGeo, glowMat); patch.rotation.x = -Math.PI / 2;
    patch.position.set(x, 0.008, z); scene.add(patch); return patch;
  });

  let elapsed = 0;
  function update(t, dt, actors = []) {
    elapsed += Math.max(0, dt);
    if (elapsed < 1 / 24) return;
    const step = Math.min(elapsed, 0.15); elapsed = 0;
    const ease = 1 - Math.exp(-step * 5);
    for (let i = 0; i < layout.length; i++) {
      const item = layout[i];
      const pressure = grassPressure(item.x, item.z, actors);
      item.bendX += (pressure.x - item.bendX) * ease;
      item.bendZ += (pressure.z - item.bendZ) * ease;
      const wx = Math.sin(t * 0.8 + item.phase + item.x * 0.21) * 0.045;
      const wz = Math.sin(t * 0.57 + item.phase * 1.3 + item.z * 0.17) * 0.035;
      lean.set(item.bendX + wx, 1, item.bendZ + wz).normalize();
      tilt.setFromUnitVectors(up, lean); yaw.setFromAxisAngle(up, item.yaw);
      dummy.position.set(item.x, 0.004, item.z);
      dummy.quaternion.copy(tilt).multiply(yaw);
      dummy.scale.setScalar(item.scale); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  function dispose() {
    scene.remove(mesh, ...flowerMeshes, ...patches);
    geometry.dispose(); material.dispose(); fGeo.dispose();
    flowerMeshes.forEach((f) => f.material.dispose());
    texture.dispose(); glowTex.dispose(); glowGeo.dispose(); glowMat.dispose();
  }
  return { update, dispose };
}
