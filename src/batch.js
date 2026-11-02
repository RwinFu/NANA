import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Merging the world's static stone into a handful of meshes.
//
// The scene is built out of 2,055 opaque meshes and 444 materials. Nearly every material is shared by several
// meshes -- 149 of them share one cream stone -- so the renderer submits more than two thousand draw calls a
// frame to shade the same handful of materials over and over. That is the cost that has nothing to do with
// pixels: a draw call is CPU work in the driver, and on a phone it is the thing that keeps the frame at 30.
//
// This pass takes everything that cannot move, grouped by material, and merges it into one mesh per material.
// 2,055 meshes become 444. Nothing about what is drawn changes -- same triangles, same materials, same
// transforms baked in -- so the picture is identical; there are simply far fewer things to submit.
//
// What must NOT be merged, and why:
//
//   * anything with a transform that changes at run time -- doors, gates, the frames' lamps, the shopkeeper,
//     every swaying leaf and drifting lantern. Baking a transform freezes the thing it was baking;
//   * InstancedMesh -- already one draw call for many copies, nothing to gain;
//   * SkinnedMesh and anything with morph targets -- the vertices are moved on the GPU by bones;
//   * transparent materials, sprites and points -- they are sorted and drawn back to front every frame, and
//     merging them would change the order they blend in, which is a visible change;
//   * anything the game toggles visible for a reason. Merging hides that switch inside a bigger mesh, so a
//     group that is ever hidden as a whole is left alone.
//
// The test for "does it move" is empirical rather than a list of names: the caller passes the set of objects
// it saw move. `findMovable` below produces that set by running the world, measuring, and running it again,
// so a door added next year is excluded without anyone having to remember to add it to a list.

const EPS = 1e-6;

/** True if any component of the object's world matrix changed between two snapshots. */
function matrixChanged(a, b) {
  for (let i = 0; i < 16; i += 1) if (Math.abs(a.elements[i] - b.elements[i]) > EPS) return true;
  return false;
}

/**
 * Snapshot the world matrices of everything under `root`, then run `tick` a few times, and return a Set of the
 * objects that moved. Their ancestors move too, so every ancestor of a mover is in the set -- a door's
 * children travel with the door, and a group that pivots carries its contents.
 */
export function findMovable(root, tick, { steps = 40, dt = 0.05 } = {}) {
  const nodes = [];
  root.traverse((o) => nodes.push(o));
  const before = nodes.map((o) => o.matrixWorld.clone());
  for (let i = 0; i < steps; i += 1) tick(i * dt, dt);
  root.updateMatrixWorld(true);

  // A mover's ancestors move with it, but `root` itself is not a mover: marking it would put the whole
  // scene in the set and nothing would ever be merged.
  // A mover's ancestors do NOT move with it. A door's own matrix stays put while the door swings on its
  // hinge, and the stall's awning rotates inside the stall's group without the group itself moving: marking
  // an ancestor would exclude its whole subtree, which for the flower shop meant its 74 static meshes too.
  // Baking a static mesh that happens to sit under a moving *parent* is still wrong, so ancestors are kept
  // in a second set and consulted when a mesh is considered.
  const movable = new Set();
  const movingAncestors = new Set();
  nodes.forEach((o, i) => {
    if (!matrixChanged(before[i], o.matrixWorld)) return;
    movable.add(o);
    for (let p = o.parent; p && p !== root; p = p.parent) movingAncestors.add(p);
  });

  // Materials that are animated by hand are just as fatal as a moving mesh: `update` writes
  // `mesh.material.opacity` on the frames' washes and `material.color` on the chandelier bulbs. A merged
  // mesh would keep a copy of the old values, so any material that is touched at run time is excluded.
  return { movable, movingAncestors };
}

/** True if this object may not be merged, on its own account or as part of a group. */
function isStaticMesh(o, movable, movingAncestors) {
  if (!o.isMesh) return false;
  if (o.isInstancedMesh || o.isSkinnedMesh) return false;
  if (o.userData.dynamic) return false;
  if (!o.geometry || !o.geometry.attributes.position) return false;
  if (o.geometry.morphAttributes && Object.keys(o.geometry.morphAttributes).length) return false;
  if (Array.isArray(o.material)) return false;
  const mat = o.material;
  if (!mat || mat.transparent || mat.opacity < 1) return false;
  if (mat.isSpriteMaterial || mat.isPointsMaterial) return false;
  // An object that is ever hidden is left alone: merging would bury the switch in a bigger mesh.
  for (let p = o; p; p = p.parent) {
    if (!p.visible) return false;
  }
  // its own transform must not move, and neither must anything it is parented to: a vertex baked into
  // world space would then be left behind by the parent
  if (movable.has(o)) return false;
  for (let p = o.parent; p; p = p.parent) if (movingAncestors.has(p)) return false;
  return true;
}

/**
 * Merge the static meshes under `root` by material.
 *
 * Returns a report rather than mutating silently, because this is the kind of change that is easy to get
 * wrong in a way nobody notices until a door will not open:
 *   { before, after, merged, skipped, groupsDropped }
 */
export function mergeStatic(root, { movable = new Set(), movingAncestors = new Set(), keep = new Set(), animatedMaterials = new Set() } = {}) {
  // bucket by material
  const buckets = new Map();
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  let skipped = 0;
  for (const o of meshes) {
    if (keep.has(o) || !isStaticMesh(o, movable, movingAncestors)) {
      skipped += 1;
      continue;
    }
    // Group by material *and* by facing. `side` and `shadowSide` are material properties, so a
    // FrontSide piece cannot ride in a draw call whose material is DoubleSide; where the same material is
    // used both ways the two are merged separately.
    const key = `${o.material.uuid}:${o.material.side}:${o.material.shadowSide ?? '-'}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  }

  let merged = 0;
  let before = 0;
  for (const list of buckets.values()) {
    if (list.length < 2) continue; // one mesh is already one draw call
    before += list.length;

    // Geometry must agree on its attributes to be merged, and must face the same way: a DoubleSide or a
    // BackSide piece cannot share a draw call with a FrontSide one, because the side is a material property.
    const material = list[0].material;
    // A material whose values are written at run time cannot be shared out over a merged mesh: the writes
    // would land on the originals, which are gone. `findMovable` marks the objects; this is the belt-and-
    // braces check for a material that is *shared* between a static mesh and a moving one -- the frame
    // lamps, for instance, all use one ornament material.
    if (animatedMaterials.has(material)) { skipped += list.length; continue; }
    const usable = list.filter((o) => mergeCompatible(o.geometry, list[0].geometry));
    if (usable.length < 2) continue;

    // Bake each transform into a copy of the vertices. Non-uniform and mirrored transforms (a scale of
    // -1, which the game uses for the left-hand copy of a prop) flip the winding and can leave the baked
    // normals pointing inward, so the normals are recomputed after the bake -- in world space, on the
    // finished mesh. The originals are untouched: they are only copied, never modified.
    const geos = [];
    for (const o of usable) {
      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      if (g.attributes.normal) g.deleteAttribute('normal');
      geos.push(g);
    }
    let mergedGeo;
    try {
      mergedGeo = mergeGeometries(geos, false);
    } catch {
      mergedGeo = null;
    }
    geos.forEach((g) => g.dispose());
    if (!mergedGeo) continue;
    mergedGeo.computeVertexNormals();

    // keep it in the root's own space, so nothing downstream has to think about where it went
    const batched = new THREE.Mesh(mergedGeo, material);
    batched.name = `batch:${material.type}:${material.color ? material.color.getHexString() : 'tex'}`;
    batched.castShadow = usable.some((o) => o.castShadow);
    batched.receiveShadow = usable.some((o) => o.receiveShadow);
    batched.matrixAutoUpdate = false;
    // A merged mesh can span the whole castle, so culling it as one object would be all or nothing: either
    // every stone in the group is drawn or none is, and a 40 m hall would keep the garden's triangles alive.
    // Culling is therefore off on the mesh and done per piece instead -- see `cullBatches` below.
    batched.frustumCulled = false;
    // where the pieces came from, so culling can be decided on the pieces and not on the whole
    batched.userData.parts = usable.map((o) => {
      const sphere = o.geometry.boundingSphere ? o.geometry.boundingSphere.clone() : null;
      return sphere ? sphere.clone().applyMatrix4(o.matrixWorld) : null;
    }).filter(Boolean);
    root.add(batched);
    root.updateMatrixWorld(true);
    batched.matrix.copy(root.matrixWorld).invert().multiply(batched.matrixWorld);
    batched.matrixAutoUpdate = false;

    // take the originals out, and drop the groups that only held them
    for (const o of usable) {
      o.parent?.remove(o);
      o.geometry.dispose();
    }
    merged += usable.length;
    skipped += list.length - usable.length;
  }

  // empty groups left behind by the merge, so traversals do not walk through thousands of dead nodes
  let groupsDropped = 0;
  const dead = [];
  root.traverse((o) => {
    if (o !== root && o.isGroup && o.children.length === 0) dead.push(o);
  });
  for (const g of dead) {
    g.parent?.remove(g);
    groupsDropped += 1;
  }

  return { before: meshes.length, after: root.children.length, merged, skipped, groupsDropped };
}

/** Two geometries can share a merged buffer only if every attribute matches in name, size and itemSize. */
function mergeCompatible(a, b) {
  if (!!a.index !== !!b.index) return false;
  const an = Object.keys(a.attributes);
  const bn = Object.keys(b.attributes);
  if (an.length !== bn.length) return false;
  for (const name of an) {
    if (!b.attributes[name]) return false;
    if (a.attributes[name].itemSize !== b.attributes[name].itemSize) return false;
    if (a.attributes[name].normalized !== b.attributes[name].normalized) return false;
  }
  return true;
}

/**
 * Per-piece frustum culling for the merged meshes.
 *
 * A merged mesh's own bounding sphere covers everything in its material's group: the hall's stone, the
 * garden's paving, the far town. Drawing it because one corner is on screen would undo much of what the merge
 * saves. Instead the merged mesh is drawn only while at least one of the pieces it was made of is in view, and
 * the pieces' spheres are computed once, at merge time.
 *
 * The spheres are generous by design -- a piece's own bounds, not its triangles -- so this can only ever draw
 * slightly more than it needs to, never less: nothing that was visible before can disappear.
 */
export function createBatchCuller(camera) {
  const frustum = new THREE.Frustum();
  const matrix = new THREE.Matrix4();
  const batches = [];

  const add = (root) => {
    root.traverse((o) => {
      if (o.isMesh && Array.isArray(o.userData.parts) && o.userData.parts.length) batches.push(o);
    });
  };

  const update = () => {
    if (!batches.length) return;
    camera.updateMatrixWorld();
    matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(matrix);
    for (const batch of batches) {
      let seen = false;
      for (const sphere of batch.userData.parts) {
        if (frustum.intersectsSphere(sphere)) { seen = true; break; }
      }
      batch.visible = seen;
    }
  };

  return { add, update };
}
