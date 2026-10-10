import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Bake static parts in their parent's coordinates; moving wheel groups stay independent.
export function batchMeshes(root, exclusions = new Set()) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const buckets = new Map(), originals = [], merged = [];
  function visit(node) {
    if (exclusions.has(node)) return;
    if (node.isMesh && !node.isInstancedMesh && !Array.isArray(node.material)) {
      const key = `${node.material.id}:${node.castShadow}:${node.receiveShadow}`;
      if (!buckets.has(key)) buckets.set(key, { source: node, geometries: [] });
      const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
      geometry.clearGroups();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, node.matrixWorld));
      buckets.get(key).geometries.push(geometry);
      originals.push(node);
    }
    for (const child of node.children) visit(child);
  }
  visit(root);
  for (const { source, geometries } of buckets.values()) {
    const geometry = mergeGeometries(geometries);
    if (!geometry) throw new Error('Vehicle batching requires compatible vertex attributes.');
    const mesh = new THREE.Mesh(geometry, source.material);
    mesh.castShadow = source.castShadow; mesh.receiveShadow = source.receiveShadow;
    root.add(mesh); merged.push(mesh);
    for (const part of geometries) part.dispose();
  }
  for (const mesh of originals) { mesh.removeFromParent(); mesh.geometry.dispose(); }
  return merged;
}
