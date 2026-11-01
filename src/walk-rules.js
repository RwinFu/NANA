// One rule from the collision code, on its own, so it can be tested without building the world.
//
// Everything behind the castle facade is out of bounds (the service yards), because the couple are
// only meant to reach the garden, the hall, the photo room and the lane. The exception is the inside
// of the castle itself. That exception is easy to get wrong: the zone starts at z = -1, a step past
// the doorway, so a version of this rule that forgets the hall stops the couple in the first metre
// of the hall and the front door becomes unusable.
export function behindCastleBlocked({ z, y, onLane, inHall, inRoom }) {
  return !onLane && z < -1 && y < 7 && !inHall && !inRoom;
}
