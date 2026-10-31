// Swap two physical positions without changing memory IDs or viewer order.
// The floral-shirt and red-necklace portraits have similar poses; place them
// on opposite walls by exchanging the latter with the bouquet frame.
export function roomFrameSlot(index) {
  if (index === 4) return 5;
  if (index === 5) return 4;
  return index;
}

// Exchange the physical locations of memory-15 and memory-16 in the hall.
export function hallFrameSlot(index) {
  if (index === 14) return 15;
  if (index === 15) return 14;
  return index;
}
