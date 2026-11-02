import * as THREE from 'three';
import { NECK } from './gift.js';

// The present the fairy carries: a small velvet box with a ribbon, a wax seal and a gold edge.
//
// It exists twice in the scene and that is deliberate. The *open* box is the one the fairy holds, its lid
// turning up so the necklace can rise out of it. The *closed* box is what the couple see from a distance
// while the fairy is still flying in. They are the same geometry and the same materials, so it is one box
// with two poses, not two boxes.
export function createGiftBox(track = (o) => o) {
  const velvet = track(new THREE.MeshStandardMaterial({
    color: '#6d1f36', roughness: 0.86, metalness: 0.04,
    emissive: '#2a0a14', emissiveIntensity: 0.25,
  }));
  const velvetInner = track(new THREE.MeshStandardMaterial({
    color: '#f4cfd9', roughness: 0.95,
  }));
  const gold = track(new THREE.MeshStandardMaterial({
    color: '#f2c46a', metalness: 1, roughness: 0.18, emissive: '#5c3f10', emissiveIntensity: 0.12,
  }));
  const ribbon = track(new THREE.MeshStandardMaterial({
    color: '#ffe6b8', roughness: 0.42, metalness: 0.15, emissive: '#6b4d18', emissiveIntensity: 0.1,
  }));
  const wax = track(new THREE.MeshPhysicalMaterial({
    color: '#b8324a', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2,
    emissive: '#3a0a12', emissiveIntensity: 0.2,
  }));

  const group = new THREE.Group();
  group.name = 'gift-box';
  const W = 0.30;
  const H = 0.16;
  const D = 0.22;

  // the base
  const base = new THREE.Mesh(track(new THREE.BoxGeometry(W, H, D)), velvet);
  base.position.y = -H / 2;
  group.add(base);
  // a gold edge round the lip
  const lip = new THREE.Mesh(track(new THREE.BoxGeometry(W + 0.008, 0.012, D + 0.008)), gold);
  lip.position.y = -0.004;
  group.add(lip);
  // the pale satin inside, which is what makes an open box read as open
  const lining = new THREE.Mesh(track(new THREE.BoxGeometry(W - 0.03, 0.006, D - 0.03)), velvetInner);
  lining.position.y = -0.02;
  group.add(lining);

  // the lid, hinged at the back so it can swing up
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.0, -D / 2);
  group.add(lidPivot);
  const lid = new THREE.Mesh(track(new THREE.BoxGeometry(W + 0.012, 0.05, D + 0.012)), velvet);
  lid.position.set(0, 0.025, D / 2 + 0.006);
  lidPivot.add(lid);
  const lidEdge = new THREE.Mesh(track(new THREE.BoxGeometry(W + 0.02, 0.008, D + 0.02)), gold);
  lidEdge.position.set(0, 0.002, D / 2 + 0.006);
  lidPivot.add(lidEdge);

  // the ribbon: a band over the lid and down the front, with a bow
  const bandTop = new THREE.Mesh(track(new THREE.BoxGeometry(0.05, 0.008, D + 0.03)), ribbon);
  bandTop.position.set(0, 0.052, D / 2 + 0.006);
  lidPivot.add(bandTop);
  const bandFront = new THREE.Mesh(track(new THREE.BoxGeometry(0.05, H, 0.008)), ribbon);
  bandFront.position.set(0, -H / 2, D / 2 + 0.002);
  group.add(bandFront);
  // the bow: two loops and a knot
  [-1, 1].forEach((side) => {
    const loop = new THREE.Mesh(track(new THREE.TorusGeometry(0.028, 0.007, 6, 16)), ribbon);
    loop.position.set(side * 0.028, 0.058, D / 2 + 0.006);
    loop.rotation.y = Math.PI / 2;
    loop.rotation.z = side * 0.5;
    lidPivot.add(loop);
  });
  const knot = new THREE.Mesh(track(new THREE.SphereGeometry(0.014, 10, 8)), ribbon);
  knot.position.set(0, 0.058, D / 2 + 0.006);
  lidPivot.add(knot);
  // the wax seal, on the front band
  const seal = new THREE.Mesh(track(new THREE.CylinderGeometry(0.026, 0.028, 0.008, 16)), wax);
  seal.position.set(0, -H * 0.55, D / 2 + 0.008);
  seal.rotation.x = Math.PI / 2;
  group.add(seal);
  // a tiny heart stamped in the wax
  const stamp = new THREE.Mesh(track(new THREE.TorusGeometry(0.011, 0.0035, 6, 12)), gold);
  stamp.position.set(0, -H * 0.55, D / 2 + 0.013);
  group.add(stamp);

  // A warm light inside the box, so that when the lid opens the inside glows. One sprite, not a light:
  // this is a scene of its own and must not add a third real light to the garden.
  const innerGlow = new THREE.Sprite(track(new THREE.SpriteMaterial({
    map: glowTexture(), color: '#ffe3b0', transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  })));
  innerGlow.position.set(0, 0.02, 0);
  innerGlow.scale.setScalar(0.5);
  group.add(innerGlow);

  const open = { lid: 0, glow: 0 };

  // 0 = shut, 1 = open. The lid swings back and the glow comes up with it.
  function setOpen(amount) {
    const k = Math.min(1, Math.max(0, amount));
    const e = k * k * (3 - 2 * k);
    open.lid = e;
    open.glow = e;
    lidPivot.rotation.x = -1.85 * e;
    innerGlow.material.opacity = 0.55 * e;
    innerGlow.scale.setScalar(0.35 + 0.5 * e);
  }
  setOpen(0);

  const counts = (() => {
    let meshes = 0;
    group.traverse((o) => { if (o.isMesh) meshes += 1; });
    return { meshes };
  })();

  // Where the necklace sits while it is still in the box: just over the satin, so it catches the light
  // the moment the lid starts to lift.
  const inside = new THREE.Vector3(0, -0.01, 0);

  return { group, setOpen, inside, counts, lidPivot };
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,236,196,1)');
  grad.addColorStop(0.35, 'rgba(255,205,140,0.45)');
  grad.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

// A point on the necklace's own chain, in the necklace group's frame, for hanging it on a neck.
export const NECK_POINT = new THREE.Vector3(0, NECK.y, 0);
