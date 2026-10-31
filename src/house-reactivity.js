// Hall progress is latched so lights stay on when the couple walks back.
export function advanceHallProgress(progress, position, hallHalfWidth, hallLength) {
  if (!position || Math.abs(position.x) > hallHalfWidth || position.z > 0 || position.z < -hallLength) return progress;
  return Math.max(progress, Math.min(hallLength, -position.z));
}

// Targets stay inside the hall's collision-safe corridor, never across the room wall.
export function nextGuideTarget(position, frames, visited, hallHalfWidth, hallLength, door) {
  if (Math.abs(position.x) > hallHalfWidth - 0.5 || position.z > -0.5 || position.z < -hallLength + 3) return null;
  const candidates = [];
  if (!visited.has('room-door')) {
    const z = (door.z0 + door.z1) / 2;
    const ahead = position.z - z;
    if (ahead >= 1.5 && ahead <= 8) candidates.push({ key: 'room-door', x: -1.45, z, ahead });
  }
  for (const frame of frames) {
    const { x, z } = frame.center;
    if (Math.abs(x) > hallHalfWidth + 0.1 || z > 0 || z < -hallLength) continue;
    const key = `frame-${frame.index}`;
    const ahead = position.z - z;
    if (!visited.has(key) && ahead >= 2.5 && ahead <= 8) {
      candidates.push({ key, x: Math.sign(x) * 1.35, z, ahead });
    }
  }
  candidates.sort((a, b) => a.ahead - b.ahead);
  return candidates[0] || null;
}
