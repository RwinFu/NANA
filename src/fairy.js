import * as THREE from 'three';

// A small fairy who flies through the castle intro, carrying a letter for her princess.
// The letter is drawn on a canvas (Persian, RTL) and always turns to face the camera.
// The fairy loops in from high above the castle and settles in front of the camera
// at the end of the flight, where she hovers until the game starts. Then she zooms up and away.

const TRAIL_LENGTH = 22;
const TRAIL_STEP = 0.035;
const LETTER_LINES = ['سالگردمون مبارک', 'خوشگلترین پرنسس دنیا'];
const LETTER_FONT = '"Vazirmatn Variable", Vazirmatn, sans-serif';

const FROM = new THREE.Vector3(-22, 30, 46);
const HOLD = new THREE.Vector3(0, 4.1, 4.2);

function easeInOutCubic(p) {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

function smoothstep(x) {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
}

function glowTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, outer);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function drawHeart(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + s * 0.3);
  g.bezierCurveTo(x - s, y - s * 0.5, x - s * 0.5, y - s * 1.1, x, y - s * 0.4);
  g.bezierCurveTo(x + s * 0.5, y - s * 1.1, x + s, y - s * 0.5, x, y + s * 0.3);
  g.fill();
}

function letterCanvas() {
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 512;
  const g = c.getContext('2d');
  const paper = g.createLinearGradient(0, 0, c.width, c.height);
  paper.addColorStop(0, '#fff8f1');
  paper.addColorStop(1, '#ffe2ec');
  g.fillStyle = paper;
  g.fillRect(0, 0, c.width, c.height);

  // Double frame: pink outside, gold inside
  g.lineWidth = 16;
  g.strokeStyle = '#ff7a9a';
  g.strokeRect(22, 22, c.width - 44, c.height - 44);
  g.lineWidth = 4;
  g.strokeStyle = '#d9a441';
  g.strokeRect(50, 50, c.width - 100, c.height - 100);

  g.fillStyle = '#ff7a9a';
  [[92, 92], [c.width - 92, 92], [92, c.height - 92], [c.width - 92, c.height - 92]].forEach(([x, y]) => drawHeart(g, x, y, 22));

  g.direction = 'rtl';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#7a1d3d';
  g.font = `800 66px ${LETTER_FONT}`;
  g.fillText(LETTER_LINES[0], c.width / 2, c.height * 0.4);
  g.fillStyle = '#c8325c';
  g.font = `800 56px ${LETTER_FONT}`;
  g.fillText(LETTER_LINES[1], c.width / 2, c.height * 0.62);

  // A small gold ribbon under the text
  g.strokeStyle = '#d9a441';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(c.width / 2 - 110, c.height * 0.78);
  g.lineTo(c.width / 2 + 110, c.height * 0.78);
  g.stroke();
  g.fillStyle = '#ff7a9a';
  drawHeart(g, c.width / 2, c.height * 0.78 + 2, 16);
  return c;
}

export function createFairy(scene) {
  const group = new THREE.Group();
  const pink = new THREE.MeshStandardMaterial({ color: '#ff8fb1', roughness: 0.45, emissive: '#ff5c8a', emissiveIntensity: 0.18 });
  const gold = new THREE.MeshStandardMaterial({ color: '#ffd27a', roughness: 0.3, metalness: 0.4, emissive: '#ffb347', emissiveIntensity: 0.25 });
  const skin = new THREE.MeshStandardMaterial({ color: '#ffe3d0', roughness: 0.6 });

  // Dress, body, head, hair
  const dress = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 18, 1, true), pink);
  dress.position.y = -0.02;
  dress.material.side = THREE.DoubleSide;
  const bodice = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), pink);
  bodice.position.y = 0.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), skin);
  head.position.y = 0.36;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), gold);
  hair.position.set(0, 0.37, -0.02);
  hair.rotation.x = -0.25;
  group.add(dress, bodice, head, hair);

  // A little crown of gold, so she is clearly a princess's fairy
  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 8, 20), gold);
  crown.rotation.x = Math.PI / 2;
  crown.position.y = 0.46;
  group.add(crown);

  // Arms reaching forward, holding the letter
  const armGeo = new THREE.CylinderGeometry(0.025, 0.02, 0.26, 8);
  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(armGeo, skin);
    arm.position.set(side * 0.12, 0.2, 0.1);
    arm.rotation.x = -1.1;
    arm.rotation.z = -side * 0.35;
    group.add(arm);
  });

  // Wings: translucent, flapping on a hinge at the back
  const wingMat = new THREE.MeshBasicMaterial({
    color: '#e9dcff',
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const wings = [-1, 1].map((side) => {
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.22, -0.08);
    const wing = new THREE.Mesh(new THREE.CircleGeometry(0.22, 18), wingMat);
    wing.scale.set(0.9, 1.5, 1);
    wing.position.x = side * 0.2;
    hinge.add(wing);
    group.add(hinge);
    return { hinge, side };
  });

  // Wand with a star
  const wand = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 6), gold);
  wand.position.set(0.22, 0.02, 0.2);
  wand.rotation.z = -0.6;
  group.add(wand);
  const starTex = glowTexture('rgba(255,255,255,1)', 'rgba(255,220,140,0.8)');
  const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: '#ffe27a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  star.scale.setScalar(0.22);
  star.position.set(0.33, 0.18, 0.2);
  group.add(star);

  // Soft aura around her
  const auraTex = glowTexture('rgba(255,200,230,0.9)', 'rgba(255,140,190,0.35)');
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: auraTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
  aura.scale.setScalar(1.3);
  aura.position.y = 0.15;
  group.add(aura);

  // Sparkle trail: glowing sprites that follow the path she has flown
  const trailTex = glowTexture('rgba(255,255,255,1)', 'rgba(255,150,200,0.7)');
  const trail = [];
  for (let i = 0; i < TRAIL_LENGTH; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: trailTex, color: i % 3 === 0 ? '#ffe27a' : '#ff9ac0', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    scene.add(s);
    trail.push(s);
  }
  const history = Array.from({ length: TRAIL_LENGTH }, () => new THREE.Vector3(...FROM.toArray()));
  let historyClock = 0;

  // The letter: a canvas texture on a plane that always faces the camera
  const letterTex = new THREE.CanvasTexture(letterCanvas());
  letterTex.colorSpace = THREE.SRGBColorSpace;
  letterTex.anisotropy = 4;
  const letter = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.8),
    new THREE.MeshBasicMaterial({ map: letterTex, transparent: true, side: THREE.DoubleSide, toneMapped: false }),
  );
  scene.add(letter);

  // Redraw once the Persian font is loaded, so the text is not drawn with a fallback
  if (document.fonts?.load) {
    document.fonts.load(`800 66px ${LETTER_FONT}`).then(() => {
      letterTex.image = letterCanvas();
      letterTex.needsUpdate = true;
    }, () => {});
  }

  scene.add(group);
  group.visible = false;
  letter.visible = false;

  let vis = 0;
  let leave = 0;
  const pos = FROM.clone();
  const next = new THREE.Vector3();

  // Where the fairy is on her path at intro time t, p = flight progress 0..1
  function pathAt(t, p, out) {
    const e = easeInOutCubic(Math.min(1, Math.max(0, p)));
    const a = t * 0.9;
    const r = THREE.MathUtils.lerp(7, 1.1, e);
    out.set(
      THREE.MathUtils.lerp(FROM.x, HOLD.x, e) + Math.cos(a) * r,
      THREE.MathUtils.lerp(FROM.y, HOLD.y, e) + Math.sin(a * 2) * 0.55 * (1 - e * 0.6),
      THREE.MathUtils.lerp(FROM.z, HOLD.z, e) + Math.sin(a) * r * 0.5,
    );
    return out;
  }

  // Called every frame. p is the castle flight progress, started means the game has begun.
  function update(t, dt, p, started, camera) {
    const target = started ? 0 : smoothstep(p * 2.2);
    vis += (target - vis) * Math.min(1, dt * 2.5);
    if (started) leave += dt;

    pathAt(t, p, pos);
    pos.y += leave * leave * 6; // zoom up and away after the game starts

    pathAt(t + 0.05, p, next);
    group.visible = vis > 0.01;
    letter.visible = group.visible;
    if (!group.visible) return;

    const s = Math.max(0.001, vis);
    group.position.copy(pos);
    group.scale.setScalar(s);
    group.lookAt(next.x, next.y + leave * leave * 6, next.z);

    const flap = Math.sin(t * 15);
    wings.forEach(({ hinge, side }) => {
      hinge.rotation.y = side * (0.5 + 0.7 * flap) * 0.9;
    });
    wand.rotation.z = -0.6 + Math.sin(t * 2.2) * 0.12;
    star.material.opacity = 0.6 + 0.4 * Math.sin(t * 6);
    aura.material.opacity = 0.6 + 0.2 * Math.sin(t * 3);

    // The letter floats in front of her, facing the camera, with a gentle sway
    // Held out to her right side, so the card never hides her
    letter.position.set(pos.x + 0.5 * s, pos.y - 0.2 * s, pos.z - 0.05 * s);
    letter.position.y += Math.sin(t * 1.7) * 0.04;
    letter.scale.setScalar(s);
    letter.lookAt(camera.position);
    letter.rotateZ(Math.sin(t * 1.3) * 0.05);

    // Sparkle trail
    historyClock += dt;
    if (historyClock >= TRAIL_STEP) {
      historyClock = 0;
      history.pop();
      history.unshift(pos.clone());
    } else {
      history[0].copy(pos);
    }
    trail.forEach((sprite, i) => {
      const f = 1 - i / TRAIL_LENGTH;
      sprite.position.copy(history[i]);
      sprite.position.y += Math.sin(t * 3 + i) * 0.02 * i;
      sprite.scale.setScalar((0.3 - i * 0.008) * s * (0.6 + 0.4 * f));
      sprite.material.opacity = 0.85 * f * s;
    });
  }

  return { update, group, letter };
}
