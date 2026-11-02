// The words in the memory dialog: one short title per frame, and nothing underneath it.
//
// The captions are gone on purpose. They were the part of this dialog that was never right: written from a
// distance, two clauses each, and always explaining the feeling after showing it. A photograph with a name
// under it says more than a photograph with a paragraph under it.
//
// So each frame gets a name of a few words, about the two of them rather than about either one alone: a
// memory of a house is a memory of a pair. `id` ties each entry to its photo in src/memories.js; a photo with
// no entry here shows the title it already carries.

export const memoryText = {
  // --- the hall ----------------------------------------------------------
  'flowers-in-the-car': { title: 'دست‌هامون، پر از گل' },
  'mirror-selfie': { title: 'آینه، همیشه دونفره' },
  'little-surprise': { title: 'خنده‌ی توی ماشین' },
  'red-rose': { title: 'رزِ دونفره' },
  'home-mirror': { title: 'خودمونیِ دونفره' },
  'warm-hug': { title: 'امن‌ترین جای دنیا' },
  'birthday-cake': { title: 'آرزوی اون شب' },
  'sweet-treat': { title: 'شیرینیِ نصف‌نصف' },
  'black-and-white': { title: 'سیاه‌وسفیدِ رنگی' },
  'quiet-moment': { title: 'سکوتِ دونفره' },
  'dinner-date': { title: 'قراری که دیر شد' },
  'colorful-night': { title: 'شبِ رنگیِ ما' },
  'night-drive-flash': { title: 'شب، ماشین، فلاش' },
  'side-by-side': { title: 'کنار هم، بی‌ژست' },
  'selfie-together': { title: 'سلفیِ دونفره' },
  'mirror-love': { title: 'آینه و شیطونی' },
  'closer': { title: 'نزدیک‌تر از همیشه' },
  'winter-tree': { title: 'زمستونِ کنار هم' },

  // --- the photo room ----------------------------------------------------
  'calm-look': { title: 'آرومِ آروم' },
  'cat-cuddle': { title: 'دو تا دوستِ کوچیک' },
  'kitten-hug': { title: 'بغلِ کوچیک' },
  'floral-shirt': { title: 'روزِ آفتابی' },
  'red-necklace': { title: 'قرمزِ خنده‌دار' },
  'bouquet': { title: 'دسته‌گلِ دونفره' },
  'strawberry-mirror': { title: 'شیطونیِ توت‌فرنگی' },
  'christmas-tree': { title: 'کریسمسِ ما' },
  'blue-jacket': { title: 'آرامشِ آبی' },
};

/**
 * The title for a memory. There is no caption any more; `textFor` still returns one shape for both dialogs,
 * so a future caption (or a photo that carries its own) has somewhere to go.
 */
export function textFor(memory) {
  return { title: memoryText[memory.id]?.title ?? memory.title };
}
