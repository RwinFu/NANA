// The words in the memory dialog: one name per frame, and nothing else.
//
// The card used to carry a caption under the photograph, a chapter line above it, and a placard under
// the frame naming its material. All three are gone: the photograph, its name, and the pager are the
// whole card, and the name the frame already had -- the one shorthand line it was always listed under in
// src/memories.js -- is the name it shows. Anything cleverer than that competed with the picture.
//
// `id` ties each name to its photo; a photo with no entry here falls back to the name it carries.

export const memoryText = {
  // --- the hall ----------------------------------------------------------
  'flowers-in-the-car': { title: 'لبخندِ شیرین' },
  'mirror-selfie': { title: 'قابِ آینه' },
  'little-surprise': { title: 'سورپرایزِ کوچک' },
  'red-rose': { title: 'رزِ سرخ' },
  'home-mirror': { title: 'خودمونی' },
  'warm-hug': { title: 'آغوشِ امن' },
  'birthday-cake': { title: 'آرزو و شمع' },
  'sweet-treat': { title: 'لحظه‌ی شیرین' },
  'black-and-white': { title: 'سیاه‌وسفید' },
  'quiet-moment': { title: 'آرامش' },
  'dinner-date': { title: 'قرارِ دونفره' },
  'colorful-night': { title: 'شبِ رویایی' },
  'night-drive-flash': { title: 'شبِ دیروقت' },
  'side-by-side': { title: 'کنار هم' },
  'selfie-together': { title: 'سلفیِ دونفره' },
  'mirror-love': { title: 'آینه‌ی عاشقانه' },
  'closer': { title: 'نزدیک‌تر' },
  'winter-tree': { title: 'شبِ زمستونی' },

  // --- the photo room ----------------------------------------------------
  'calm-look': { title: 'لبخندِ آروم' },
  'cat-cuddle': { title: 'مهربانی' },
  'kitten-hug': { title: 'گرمای دل' },
  'floral-shirt': { title: 'روزِ آفتابی' },
  'red-necklace': { title: 'شادیِ ساده' },
  'bouquet': { title: 'دسته‌گل' },
  'strawberry-mirror': { title: 'شیطنت' },
  'christmas-tree': { title: 'کریسمسِ ما' },
  'blue-jacket': { title: 'آرامشِ آبی' },
};

// The name a memory shows. There is no caption any more; `textFor` still returns one shape, so a future
// caption (or a photo that carries its own) has somewhere to go.
export function textFor(memory) {
  return { title: memoryText[memory.id]?.title ?? memory.title };
}
