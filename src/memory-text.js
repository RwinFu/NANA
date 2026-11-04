// The words in the memory dialog: one name per frame, and nothing else.
//
// The card used to carry a caption under the photograph, a chapter line above it, and a placard under
// the frame naming its material. All three are gone: the photograph, its name, and the pager are the
// whole card, and the name the frame already had -- the one shorthand line it was always listed under in
// src/memories.js -- is the name it shows. Anything cleverer than that competed with the picture.
//
// Every name here is taken from the photograph it sits under: the bouquet handed through the car window,
// the one candle on the little cake, the cat's head on her arm. A name that could sit under any photo is
// not a name, it is a caption that lost its sentence -- those were the ones that read badly, and they are
// all gone. The line above each one says which part of its photograph it was taken from, so the next
// person to touch these words can keep the names in step with the pictures.
//
// `id` ties each name to its photo; a photo with no entry here falls back to the name it carries.

export const memoryText = {
  // --- the hall: the two of them ------------------------------------------
  // a bouquet handed over through the car window, the city behind it
  'flowers-in-the-car': { title: 'گل، از پنجره' },
  // both of them in the mirror at a table, phone up, lipstick on the cloth
  'mirror-selfie': { title: 'آینه‌ی دونفره' },
  // the red rose held out in the car, ribbon and all
  'little-surprise': { title: 'رزِ سرخِ کوچک' },
  // the rose again, held low and looked down at, caught in the window light
  'red-rose': { title: 'رزِ ماندگار' },
  // her cheek on his shoulder, that pale blue sleeve
  'home-mirror': { title: 'شانه‌ی امن' },
  // the same closeness again, this time both of them laughing
  'warm-hug': { title: 'لبخندِ دونفره' },
  // the little cake with one candle, lit, in her hands on the passenger seat
  'birthday-cake': { title: 'شمعِ کوچک' },
  // a drink in each hand, their heads tilted together
  'sweet-treat': { title: 'دو تا همیشه' },
  // one black-and-white square, her hair over his face, a hand on his cheek
  'black-and-white': { title: 'سیاه‌وسفید، دستِ تو' },
  // her temple against his cheek, a hand in her hair
  'quiet-moment': { title: 'پیشانی به پیشانی' },
  // the table between them: ketchup, glasses, the light behind
  'dinner-date': { title: 'همین میزِ ما' },
  // under a yellow street lamp, glass in hand, the city blue behind
  'colorful-night': { title: 'زیر چراغِ زرد' },
  // film-framed: his hand up at the flash, the two of them on the front seat
  'night-drive-flash': { title: 'ماشین، شب، فلاش' },
  // arms and the silver chain, her chin on her hand
  'side-by-side': { title: 'دست روی دست' },
  // tongue out, glasses, the ceiling light between them
  'selfie-together': { title: 'دو تا شکلک' },
  // the reflection: her at the mirror, lipstick going on
  'mirror-love': { title: 'رژلب و آینه' },
  // a phone held up filling the frame, the two of them above it
  'closer': { title: 'تا نوکِ گوشی' },
  // a winter tree behind them, the shutter's flash on his glasses
  'winter-tree': { title: 'شب و درخت' },

  // --- the photo room: her -----------------------------------------------
  // hand over her face, the ring on it
  'calm-look': { title: 'حلقه و انگشت' },
  // the cat's head resting on her arm in the car
  'cat-cuddle': { title: 'گربه روی دست' },
  // the cat asleep in her arms in the street's light
  'kitten-hug': { title: 'بغلِ گربه' },
  // the leaf-print shirt, the silver watch, the menu on the wall
  'floral-shirt': { title: 'پیراهنِ برگ' },
  // the white tee, the thin red necklace, her hand at her cheek
  'red-necklace': { title: 'گردنبندِ نازک' },
  // sunflowers and roses on the seat beside her, the red band in her hair
  'bouquet': { title: 'دسته‌گلِ آفتاب' },
  // the painted strawberries on both their cheeks, the phone between them
  'strawberry-mirror': { title: 'توت‌فرنگی روی گونه' },
  // the shop of red and gold, her braid down her back
  'christmas-tree': { title: 'شلوغیِ کریسمس' },
  // the blue jacket, the wind in her hair
  'blue-jacket': { title: 'کاپشنِ آبی' },
};

// The name a memory shows. There is no caption any more; `textFor` still returns one shape, so a future
// caption (or a photo that carries its own) has somewhere to go.
export function textFor(memory) {
  return { title: memoryText[memory.id]?.title ?? memory.title };
}
