import * as THREE from 'three';

// Every material of the two characters goes through here. Physical materials give fabric a soft
// sheen, hair, eyes and shoes a glossy clearcoat, and the environment map adds real reflections.
// The list is kept so the main scene can give all of them the same environment map at once.
export const charMats = [];

export function physMat(opts) {
  const m = new THREE.MeshPhysicalMaterial({ envMapIntensity: 0.7, ...opts });
  charMats.push(m);
  return m;
}

// Adds a mesh as a child of `parent` at (x, y, z), in the parent's space
export function place(mesh, parent, x = 0, y = 0, z = 0) {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// A point on the front of a head of radius R, just in front of the skin at (x, y)
export function frontZ(x, y, R) {
  return Math.sqrt(Math.max(0, R * R - x * x - y * y)) + 0.003;
}

// A smooth tube through a list of points (Vector3), used for brows, lines and locks
export function tubeThrough(points, radius, material, segments = 24, radial = 6) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, radial, false), material);
}
