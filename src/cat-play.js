// A quiet repeatable play loop. Pass elapsed seconds since sitting on the bench.
export function catPlayPhase(elapsed) {
  const time = Math.max(0, elapsed);
  const cycle = Math.floor(time / 20);
  const at = time % 20;
  if (at < 2) return { name: 'stalk', progress: at / 2, cycle };
  if (at < 3) return { name: 'pounce', progress: at - 2, cycle };
  if (at < 8) return { name: 'butterfly', progress: (at - 3) / 5, cycle };
  if (at < 14) return { name: 'chase', progress: (at - 8) / 6, cycle };
  return { name: 'rest', progress: (at - 14) / 6, cycle };
}
