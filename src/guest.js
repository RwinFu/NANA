// The guest house.
//
// `/guest` is the same house, for people who are not the two of them -- the link to send to friends, and to
// put in a story. It is one switch, read once, and everything it changes is listed here:
//
//   * the rescue game (the 2-D one) is not played at all: the page opens on the gate and the guest walks in;
//   * the letter and the present are not in the house -- no envelope in the hall, no fairy, no box, no
//     necklace. The photo room, its clip and the music are exactly what the house already has;
//   * the two characters are dressed plainly: he in a business suit, she in a simple dark dress, no tiara,
//     no braids, no bow tie, no epaulettes -- so the story reads as "a house of memories" rather than as
//     somebody's wedding;
//   * the start screen asks which of the two the visitor is, where the family's house asks for her dress
//     colour. Whoever is chosen walks in front and the other walks beside: choosing the boy swaps the two
//     places rather than building a second model (see setSwap in src/characters.js).
//
// Nothing here is a separate copy of the game: `guest` is false everywhere in the main house, and every
// branch below is a no-op when it is false. The main link behaves exactly as it did.

/** Path the guest house is served from. Also used by the Pages build (see vite.config.js). */
export const GUEST_PATH = '/guest';

/**
 * Where the house's own files live -- the photos, the clip, the music, the cat portraits.
 *
 * The build's `base` is `./`, so Vite's `BASE_URL` is a relative one and resolves against the *document*.
 * That is right for the main page at `/NANA/` and wrong for the guest page at `/NANA/guest/`, one level
 * deeper. Everything that loads a file goes through here, so both pages find the same photos.
 */
export function assetUrl(path) {
  return joinAsset(assetBase(), path);
}

/**
 * The site root, whatever page is asking.
 *
 * Vite's `BASE_URL` is `./` in this build, which resolves against the *document*: right for the main page at
 * `/NANA/`, wrong for the guest page at `/NANA/guest/`. The one thing both pages agree on is where the app's
 * own script is: the bundle sits in `<site>/assets/`, so one folder above it is the site root. In development
 * the module is `src/guest.js`, one folder above which is the served root. An absolute base, if one is ever
 * configured, is already the site root and is used as it is.
 */
function assetBase() {
  const env = import.meta.env?.BASE_URL;
  if (env && String(env).startsWith('/')) return env;
  try {
    return new URL('../', import.meta.url).href;
  } catch {
    return './';
  }
}

/** The joining itself, apart from Vite, so it can be tested. */
export function joinAsset(base, path) {
  const left = String(base || '');
  const right = String(path || '').replace(/^\/+/, '');
  if (!left) return right;
  return `${left.replace(/\/+$/, '')}/${right}`;
}

/**
 * Is this the guest house?
 *
 * Read from the URL rather than from a query parameter, because the link that goes into a story has to be
 * short and has to survive a copy-paste: `/NANA/guest` and `/NANA/guest/` both count, and so does any
 * deeper path under it. In development Vite serves the same entry point for every path, so the check has to
 * be right in both places.
 */
export function isGuest(where = typeof window === 'undefined' ? null : window.location) {
  if (!where) return false;
  return /\/guest(\/|$)/.test(where.pathname || '');
}

/**
 * Which of the two a guest is. This is the guest's start screen: the family's house asks for her dress colour,
 * a guest is asked which of the two they are, and the answer decides who walks in front (see setSwap() in
 * src/characters.js -- the boy is the couple's second character, so walking in as the boy swaps the two places
 * rather than building a second model).
 */
export const GUEST_AS = ['him', 'her'];

/** The two words under the two cards. */
export const GUEST_AS_LABEL = { him: 'پسر', her: 'دختر' };

/** Which one the start screen opens on: the house is hers, so she is the one it starts on. */
export const GUEST_AS_DEFAULT = 'her';

/** The guest house itself: the flags every branch in the game reads. */
export const guest = isGuest();

/** The two guests' clothes. Kept apart from the family palette (src/charpalette.js) on purpose. */
export const GUEST_LOOK = {
  her: {
    // A plain dress: one colour, its own deeper shade for the seams, no trim, no pearls.
    dress: '#2f3346',
    dressDeep: '#232636',
    shoe: '#1d1f2b',
    // Hair down, not braided, and no tiara or bow.
    hair: '#3a2925',
  },
  him: {
    // A suit: jacket and trousers in the same cloth, a white shirt, a plain tie -- not a bow tie.
    suit: '#232a3d',
    suitLight: '#333c55',
    shirt: '#f7f5ef',
    tie: '#3a4155',
    shoe: '#1b1b22',
    hair: '#241a17',
  },
};

/**
 * What is *in* the guest house. Each flag says what the guest has, so `true` here never means "the main house
 * loses something": every branch in the game reads these together with `guest`.
 *
 *   rescue  the 2-D game with its instructions card and the camera flight that follows it
 *   form    the start screen that asks for the dress colour
 *   person  the start screen that asks which of the two the visitor is (a guest gets this instead of `form`)
 *   letter  the envelope standing at the end of the hall, and the letter in it
 *   present the fairy, the box and the necklace
 */
export const GUEST_HAS = {
  rescue: false,
  form: false,
  person: true,
  letter: false,
  present: false,
};

/**
 * Does the main house have it? Always yes -- and this is the constant the game reads, so that a bug in the
 * guest switch can never take the letter or the present out of the family's own house.
 */
export const MAIN_HAS = {
  rescue: true,
  form: true,
  person: false,
  letter: true,
  present: true,
};

/** The flags for whichever house this page is. */
export const house = guest ? GUEST_HAS : MAIN_HAS;


