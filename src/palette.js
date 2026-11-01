// The colours of the world's walls, in one place.
//
// These are the surfaces the player stands next to for the whole walk: the castle's stone, the
// hall's own walls, the town's houses. They were dark once — a near-black plum for the houses, a
// #3a2a3f corridor, #5a3726 planks — and under a moonlit sky that reads as a black slab with a
// lamp or two stuck on it, however good the geometry is.
//
// Keeping them here means the palette can be measured: tests/night-light.test.js holds every one of
// these above a floor, so "the walls went dark again" fails a test instead of waiting for someone to
// notice in a screenshot.

// ---------- the castle ------------------------------------------------------

// Cut stone: warm cream. The material's own map is greyscale, so this is the tint it carries.
export const castleStone = {
  wall: '#efe2d3', // the main ashlar of the towers, keep and wings
  wallShade: '#dccabb', // the flanking face, a touch cooler so corners read
  plinth: '#c4b3a6', // the weathered course at the foot of every wall
  trim: '#f7efe4', // string courses, surrounds, merlon caps
  hallWall: '#e3d3c2', // the hall's outer shell, seen from the garden
};

// The hall's inside: the walls the couple walk between, and the vault over their heads.
//
// Both are the same violet family, the vault a step deeper — not a mauve wall under a violet ceiling,
// which read as two different rooms sharing a corridor. tests/hall-walls.test.js holds their hues
// within 60° of each other and their values within 30% so they cannot drift apart again.
export const hallInterior = {
  wall: '#7b6478', // warm mauve ashlar — was #3a2a3f, which read as a black band
  vault: '#5e4770', // the barrel vault: a step deeper, same family, so the gold ribs still read
  floorLight: '#a8703f', // parquet plank, light course
  floorDark: '#945f34', // parquet plank, dark course
};

// ---------- the town --------------------------------------------------------

// Limewash pastels, the way a storybook street is painted. One per house.
export const townWalls = ['#f3ddc0', '#eebf9e', '#efc6d3', '#f5e6ae'];

// Roof tiles and stone: pink terracotta, and a warm grey stone for plinths, quoins and kerbs.
export const townRoofs = ['#d4739f', '#b95f8a', '#e08cae'];
export const townStone = ['#9a8fa4', '#a89aa8', '#8d8298', '#b3a6ae', '#9c8d8a'];
export const townStoneLight = '#bdb0be';

// The timber of the half-timbered facades, and the doors: warm brown and rose, not black.
export const townTimber = '#7a5240';
export const townDoor = '#8d4a52';
export const townPots = '#b06a4e';
export const townLeaves = '#4f8a68';

// The lane's own surfaces.
export const laneKerb = '#9c93a6';
export const laneLowWall = '#96889c';

// Relative luminance (WCAG), used by the tests to keep a colour off the floor.
export function luminance(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
