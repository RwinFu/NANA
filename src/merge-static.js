// Fewer draw calls for the world, without changing what it looks like.
//
// A three.js mesh is one draw call whatever it is made of, and this house is built from two thousand small
// ones: a wall is a box per block, a lantern is a body, a cap, a flame and a halo. At two thousand calls a
// frame the bottleneck is the CPU filling the command buffer, not the GPU: the canvas can drop to a
// sixteenth of its pixels and the frame time hardly moves. The answer is to ask for the same picture in
// fewer commands.
//
// So static meshes sharing a material, under the same parent, are welded into one mesh per material. Each
// part's vertices are copied into the *parent's* space, so nothing moves and no world transform is baked.
//
// The risk in welding is not geometry, it is draw order. Where two surfaces nearly coincide, which of them
// is drawn first decides which one wins the depth test, and moving a part into a different mesh can flip
// that. So the weld refuses any part that is in a *positional conflict*: one small body whose centre sits
// inside another body of a different material, i.e. a jewel proud of its ball, a moulding laid on an arch.
// A part that merely touches its neighbours -- a block beside a block, a stone set into a wall -- has no
// such ambiguity: the same face wins whichever order they are drawn in, and those are what get welded.
//
// Everything that moves is out of bounds, declared where it moves (`markDynamic`), never inferred:
//   - anything under a markDynamic branch, however deep,
//   - SkinnedMesh, and anything under a bone,
//   - morph targets,
//   - transparent meshes (sortObjects is off: order is the picture),
//   - InstancedMesh, sprites, points and lines,
//   - a mirrored part (negative scale: baking it would reverse its winding and back-face cull it),
//   - anything with a renderOrder, or with its own onBeforeRender.

import * as THREE from 'three';

const NEEDED = 'normal,position,uv';
// A background (the sky dome, the ground, the castle walls) is enormous and overlaps everything. It is
// never the thing an ornament is fighting with for the depth test, and welding it buys nothing.
const BACKGROUND_RADIUS = 40;
// One body's centre this far inside another body means the surfaces pass through each other.
const CONFLICT_EPSILON = 0.02;
// Only small bodies can be in a positional conflict: a wall wrapping a room is not "in front of" the room.
const SMALL_BODY = 2.5;

// Opt a branch out of the weld, for anything that moves, appears, hides or re-colours itself after the
// world is built. Called at the source, next to the code that animates it.
export function markDynamic(root) {
  if (root && root.isObject3D) root.traverse((o) => { o.userData.noMerge = true; });
  return root;
}

function underBone(object) {
  for (let p = object.parent; p; p = p.parent) if (p.isBone) return true;
  return false;
}

function underDynamicBranch(object) {
  for (let p = object; p; p = p.parent) if (p.userData && p.userData.noMerge) return true;
  return false;
}

function canMerge(mesh, keepMaterials) {
  const material = mesh.material;
  if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh) return false;
  if (Array.isArray(material) || !material) return false;
  if (material.transparent || material.opacity < 1 || material.isShaderMaterial) return false;
  if (mesh.renderOrder !== 0) return false;
  if (mesh.frustumCulled === false) return false;
  if (mesh.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return false;
  if (keepMaterials.has(material)) return false;
  if (underDynamicBranch(mesh) || underBone(mesh)) return false;
  const geometry = mesh.geometry;
  if (!geometry || !geometry.attributes.position) return false;
  if (geometry.morphAttributes && Object.keys(geometry.morphAttributes).length) return false;
  if (geometry.isInstancedBufferGeometry) return false;
  // exactly the three attributes the weld copies by hand, and no others (no skinIndex, no vertex colour)
  if (Object.keys(geometry.attributes).sort().join(',') !== NEEDED) return false;
  return true;
}

// World-space bounding spheres, in a grid, so the conflict test is local and cheap.
function buildConflictTest(meshes) {
  const CELL = 4;
  const grid = new Map();
  const sphere = new THREE.Sphere();
  const cell = (v) => Math.floor(v / CELL);
  for (const mesh of meshes) {
    if (!mesh.geometry.attributes.position) continue;
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    const world = sphere.copy(mesh.geometry.boundingSphere).applyMatrix4(mesh.matrixWorld).clone();
    mesh.userData.__mergeSphere = world;
    if (world.radius > BACKGROUND_RADIUS) continue;
    const r = world.radius;
    for (let x = cell(world.center.x - r); x <= cell(world.center.x + r); x += 1) {
      for (let y = cell(world.center.y - r); y <= cell(world.center.y + r); y += 1) {
        for (let z = cell(world.center.z - r); z <= cell(world.center.z + r); z += 1) {
          const key = `${x},${y},${z}`;
          const list = grid.get(key);
          if (list) list.push(mesh);
          else grid.set(key, [mesh]);
        }
      }
    }
  }
  return function inConflict(mesh) {
    const mine = mesh.userData.__mergeSphere;
    if (!mine) return false;
    if (mine.radius > SMALL_BODY) return false; // a big body is never "laid on" something else
    const r = mine.radius;
    const seen = new Set();
    for (let x = cell(mine.center.x - r); x <= cell(mine.center.x + r); x += 1) {
      for (let y = cell(mine.center.y - r); y <= cell(mine.center.y + r); y += 1) {
        for (let z = cell(mine.center.z - r); z <= cell(mine.center.z + r); z += 1) {
          const list = grid.get(`${x},${y},${z}`);
          if (!list) continue;
          for (const other of list) {
            if (other === mesh || seen.has(other)) continue;
            seen.add(other);
            if (other.material === mesh.material) continue;
            const theirs = other.userData.__mergeSphere;
            if (!theirs || theirs.radius > SMALL_BODY) continue;
            const d = mine.center.distanceTo(theirs.center);
            // one centre inside the other body: the surfaces pass through each other
            if (d < mine.radius - CONFLICT_EPSILON || d < theirs.radius - CONFLICT_EPSILON) return true;
          }
        }
      }
    }
    return false;
  };
}

// Weld every eligible sibling group under `root`; returns how many draw calls were removed.
export function mergeStaticMeshes(root, { keepMaterials = new Set(), maxRadius = Infinity } = {}) {
  if (!root) return 0;
  root.updateMatrixWorld(true);
  const parents = [];
  const meshes = [];
  root.traverse((o) => {
    if (o.isGroup || o.isMesh || o === root) parents.push(o);
    if (o.isMesh && !o.isInstancedMesh) meshes.push(o);
  });
  const inConflict = buildConflictTest(meshes);
  let saved = 0;
  for (const parent of parents) saved += mergeChildrenOf(parent, keepMaterials, inConflict, maxRadius);
  return saved;
}

function mergeChildrenOf(parent, keepMaterials, inConflict, maxRadius) {
  const buckets = new Map();
  for (const child of parent.children) {
    if (!child.isMesh || !canMerge(child, keepMaterials)) continue;
    if (inConflict(child)) continue;
    const key = `${child.material.uuid}|${child.material.fog ? 1 : 0}`;
    const list = buckets.get(key);
    if (list) list.push(child);
    else buckets.set(key, [child]);
  }

  let saved = 0;
  for (const list of buckets.values()) {
    if (list.length < 2) continue; // one mesh is already one draw call
    const merged = weld(list);
    if (!merged) continue;
    // A weld that sprawls over the whole castle is one draw call but a bad one: the pieces inside it can
    // no longer be culled on their own, so a rasterizer shades far more of the screen than before.
    if (merged.geometry.boundingSphere.radius > maxRadius) continue;
    parent.add(merged);
    for (const part of list) parent.remove(part);
    // Geometries and the shared material may still be used by a mesh that stayed; world.dispose() owns them.
    saved += list.length - 1;
  }
  return saved;
}

// Copy every part's triangles, in the parent's space, into one set of buffers. Returns null for a group
// that cannot be welded faithfully (a mix of mirrored and normal parts, or of indexed and not).
function weld(parts) {
  const material = parts[0].material;
  const first = parts[0].geometry;
  const indexed = !!first.index;
  const names = NEEDED.split(',');

  let vertexCount = 0;
  let indexCount = 0;
  for (const part of parts) {
    const g = part.geometry;
    if (indexed !== !!g.index) return null;
    vertexCount += g.attributes.position.count;
    if (indexed) indexCount += g.index.count;
  }

  const buffers = new Map();
  for (const name of names) buffers.set(name, new Float32Array(vertexCount * first.attributes[name].itemSize));
  const index = indexed ? new Uint32Array(indexCount) : null;

  const matrix = new THREE.Matrix4();
  const normalMatrix = new THREE.Matrix3();
  const v = new THREE.Vector3();
  let vOffset = 0;
  let iOffset = 0;
  for (const part of parts) {
    const g = part.geometry;
    const count = g.attributes.position.count;
    // Composed from the part's own position/rotation/scale rather than read from `part.matrix`: a mesh whose
    // transform was set but never updated still has an identity matrix, and baking that would pile every
    // part of the group on the origin.
    matrix.compose(part.position, part.quaternion, part.scale);
    // A mirrored part has reversed winding once the mirror is baked in; it keeps its own mesh.
    if (matrix.determinant() < 0) return null;
    normalMatrix.getNormalMatrix(matrix);
    for (const name of names) {
      const attr = g.attributes[name];
      const out = buffers.get(name);
      if (name === 'position') {
        for (let i = 0; i < count; i += 1) {
          v.fromBufferAttribute(attr, i).applyMatrix4(matrix);
          out[(vOffset + i) * 3] = v.x;
          out[(vOffset + i) * 3 + 1] = v.y;
          out[(vOffset + i) * 3 + 2] = v.z;
        }
      } else if (name === 'normal') {
        for (let i = 0; i < count; i += 1) {
          v.fromBufferAttribute(attr, i).applyMatrix3(normalMatrix).normalize();
          out[(vOffset + i) * 3] = v.x;
          out[(vOffset + i) * 3 + 1] = v.y;
          out[(vOffset + i) * 3 + 2] = v.z;
        }
      } else {
        const src = attr.array;
        const size = attr.itemSize;
        for (let i = 0; i < count * size; i += 1) out[vOffset * size + i] = src[i];
      }
    }
    if (index) {
      const src = g.index.array;
      for (let i = 0; i < src.length; i += 1) index[iOffset + i] = src[i] + vOffset;
      iOffset += src.length;
    }
    vOffset += count;
  }

  const geometry = new THREE.BufferGeometry();
  for (const [name, array] of buffers) {
    const proto = first.attributes[name];
    geometry.setAttribute(name, new THREE.BufferAttribute(array, proto.itemSize, proto.normalized));
  }
  if (index) geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `merged-${parts.length}`;
  return mesh;
}
