// MEHR HOUSE — commercial demonstration edition.
// All people, names, relationships and photographs in this edition are fictional.
// The ten source photographs were generated without using any personal reference photo.
// Additional gallery images are editorial crops of those same generated photographs.
// This module replaces memories.js at build time; personal content is never imported here.
import { assetUrl } from './guest.js';

export const edition = {
  id: 'mehr-sale',
  brand: 'خانه‌ی مهر',
  storageKey: 'mehr-house-sale-v1',
  // An original, code-generated instrumental loop. No commercial song or personal recording.
  songUrl: null,
  music: {
    bpm: 72,
    pattern: [0, 1, 2, 3, 2, 1, 3, 1],
    chords: [
      [174.61, 220.00, 261.63, 349.23], // F
      [146.83, 174.61, 220.00, 293.66], // D minor
      [116.54, 146.83, 174.61, 233.08], // B flat
      [130.81, 164.81, 196.00, 261.63], // C
    ],
  },
  fairyLines: ['قصه‌ی ما ادامه دارد', 'هر روز، یک صفحه‌ی تازه'],
  finaleTitle: 'هر روز، یک بهانه برای با هم بودن',
  postcardSubtitle: 'لحظه‌های کوچک، قصه‌های ماندگار',
  postcardFile: 'mehr-house-postcard.png',
  cats: {
    ani: { name: 'فندق', image: 'sale/cats/fandogh.jpg' },
    pastil: { name: 'میشا', image: 'sale/cats/misha.jpg' },
  },
  catAppearance: {
    pastil: {
      base: '#b8b5b0', stripe: '#66636a', eye: '#c5bd72', muzzle: '#eee5da',
      folded: false, collar: true, headWidth: 1, headHeight: 0.96, cheek: 0.052, bodyWidth: 1,
    },
    ani: {
      base: '#d49a59', stripe: '#96613b', eye: '#8ba99a', muzzle: '#f3e5d2',
      folded: false, collar: false, headWidth: 1.08, headHeight: 1, cheek: 0.055, bodyWidth: 1.04,
    },
  },
  characterPalette: {
    skin: '#e8bd96', skinShade: '#c99570', skinBlush: '#eaa0a2',
    hair: '#7a432c', hairSheen: '#a36340',
    dress: '#d96682', dressDeep: '#a64060', dressLight: '#efa2b4',
    petticoat: '#ffe6eb', lace: '#fff8f4', sash: '#ffc1ce',
    gold: '#edc77d', pearl: '#fffaf2', shoe: '#533747', lip: '#c85c76',
    coat: '#356778', coatLight: '#568c98', vest: '#294d60', trousers: '#303d50',
    shirt: '#fbf7ef', belt: '#805638', boyHair: '#302522', boyHairLight: '#594039',
    boyShoe: '#292733', bowTie: '#db8796',
  },
};

export const defaults = {
  fromName: 'سامان',
  toName: 'نیکا',
  toNameJoint: 'نیکا',
  dedication: 'بعضی لحظه‌ها کوچک‌اند؛ اما کنار تو، تمام قصه را روشن می‌کنند.',
  anniversaryMsg: 'برای همه‌ی روزهایی که هنوز نرسیده‌اند، و همه‌ی خنده‌هایی که قرار است با هم بسازیم.',
  avatarColor: '#ff758f',
};

export const letterParagraphs = [
  'نیکای عزیز،',
  'بعضی آدم‌ها شهر را عوض نمی‌کنند؛ راهِ برگشتن به خانه را در آن روشن می‌کنند. تو برای من همان نوری.',
  'این قاب‌ها تمرینِ دیدن‌اند: فنجانِ چای، خنده‌ی بی‌هوا، گلی که بی‌مناسبت خریدیم. خوشبختی گاهی همین‌قدر کوچک است.',
  'اگر فردا باران آمد، زیر یک چتر می‌مانیم. اگر آفتاب بود، راهِ تازه‌ای پیدا می‌کنیم. قصه‌ی ما ادامه دارد.',
];

export const memoryImage = (filename) => assetUrl(`sale/memories/${filename}`);

const frame = (name, color, glow) => ({ name, color, glow });
const memory = (id, title, caption, chapter, file, metal) => ({
  id, title, caption, chapter, image: memoryImage(file), frame: metal,
});

// Eighteen hall frames and nine room frames: the original walk and room geometry are unchanged.
export const memories = [
  memory('first-flowers', 'گلی بی‌مناسبت', 'برای دوست داشتن، تقویم لازم نیست.', 'شروع قصه', 'memory-01.jpg', frame('رزگلد', '#d88a8a', '#ffb7c0')),
  memory('lobby-mirror', 'قابِ آشنایی', 'یک آینه، دو لبخند، و شهری که هنوز منتظر ماست.', 'آشنایی', 'memory-02.jpg', frame('طلایی', '#d4af37', '#ffe27a')),
  memory('little-gift', 'هدیه‌ی کوچک', 'کاغذِ ساده‌ای که دورِ یک دنیا مهربانی پیچیده شده.', 'سورپرایز', 'memory-03.jpg', frame('چوب گردو', '#6b4c30', '#ffd9a0')),
  memory('one-rose', 'فقط یک رز', 'گاهی یک گل، از هزار جمله گویاتر است.', 'باغ رز', 'memory-04.jpg', frame('مخمل یاقوتی', '#7e1522', '#ff6b7a')),
  memory('our-kitchen', 'دستپختِ دو نفره', 'دستور پخت را فراموش کردیم؛ خندیدن را نه.', 'خانه', 'memory-05.jpg', frame('بلوط روشن', '#9e7346', '#ffe2b8')),
  memory('flower-detail', 'زبانِ گل‌ها', 'شکوفه‌های صورتی، آرام‌تر از حرف‌ها.', 'جزئیات', 'memory-06.jpg', frame('مروارید', '#e6e9ee', '#cfe4ff')),
  memory('two-smiles', 'دو لبخند', 'خنده‌ای که از یک نفر شروع می‌شود و به دو نفر می‌رسد.', 'لبخند', 'memory-07.jpg', frame('طلای جشن', '#e6b931', '#fff085')),
  memory('gift-hands', 'میانِ دست‌ها', 'ارزش هدیه به اندازه‌ی دست‌هایی است که آن را نگه می‌دارند.', 'مهربانی', 'memory-08.jpg', frame('کوارتز صورتی', '#d699a4', '#ffc2d1')),
  memory('rose-close', 'سرخ، به رنگِ مهر', 'نزدیک‌تر که نگاه کنی، قصه در جزئیات است.', 'قاب نزدیک', 'memory-09.jpg', frame('برنز', '#73573c', '#d9c2ff')),
  memory('salad-bowl', 'یک کاسه شادی', 'کمی سبزی، کمی رنگ، و خیلی حوصله برای هم.', 'روزمره', 'memory-10.jpg', frame('زمرد و مس', '#1f4738', '#ffb27a')),
  memory('bouquet-close', 'دسته‌گلِ عصر', 'گل‌ها پژمرده می‌شوند؛ مهربانیِ پشتشان نه.', 'یادگاری', 'memory-11.jpg', frame('مس شب‌تاب', '#8a5a3c', '#ffc78a')),
  memory('mirror-mono', 'خاطره در سیاه‌وسفید', 'وقتی لبخند روشن باشد، رنگ‌ها لازم نیستند.', 'قاب کلاسیک', 'memory-12.jpg', frame('نقره', '#b8c2d4', '#e3ecff')),
  memory('autumn-smiles', 'خنده‌های پاییزی', 'برگ‌ها می‌ریزند؛ شادیِ این قاب می‌ماند.', 'پاییز', 'memory-13.jpg', frame('ابریشم یاسی', '#8e6fb0', '#d9c2ff')),
  memory('rose-faces', 'آرامشِ کنار هم', 'برای شنیدن بعضی حرف‌ها، باید نزدیک‌تر بود.', 'سکوت شیرین', 'memory-14.jpg', frame('عاج صدفی', '#e8dccb', '#fff3e0')),
  memory('kitchen-laugh', 'خنده‌ی بی‌هوا', 'هیچ‌کس یادش نیست شوخی از کجا شروع شد.', 'شادی', 'memory-15.jpg', frame('کاج و طلا', '#2f5e4a', '#ffe27a')),
  memory('garden-light', 'نورِ آخرِ روز', 'خورشید می‌رود؛ گرمای این لحظه می‌ماند.', 'غروب', 'memory-16.jpg', frame('طلای گرم', '#c9a25b', '#ffe9b0')),
  memory('paper-and-twine', 'کاغذ و نخ', 'چیزهای کوچک هم می‌توانند بزرگ دل‌گرم کنند.', 'جزئیات هدیه', 'memory-17.jpg', frame('چوب روشن', '#a0785a', '#ffd9b0')),
  memory('rose-memory', 'یک گل، یک قصه', 'هر قصه جایی برای یک رزِ سرخ دارد.', 'قاب آخر', 'memory-18.jpg', frame('لاجورد', '#2d4f8a', '#9ec7ff')),
];

export const soloMemories = [
  memory('morning-tea', 'چایِ صبح', 'نیکا و اولین نور روز؛ هنوز هیچ عجله‌ای نیست.', 'صبح', 'solo-01.jpg', frame('طلای وانیلی', '#c9a25b', '#ffe9b0')),
  memory('misha-garden', 'میشا در باغ', 'یک دوست خاکستری، میان شکوفه‌ها.', 'دوست کوچک', 'solo-02.jpg', frame('یشم', '#2c6e5a', '#9fe6c8')),
  memory('fandogh-studio', 'فندقِ کنجکاو', 'کوچک‌ترین مهمان کارگاه سفال.', 'کارگاه', 'solo-03.jpg', frame('مرمر صورتی', '#d9b9a3', '#ffe0cc')),
  memory('lavender-walk', 'راهِ اسطوخودوس', 'قدم‌زدنی میان بنفش و طلایی.', 'سفر', 'solo-04.jpg', frame('یاسی', '#8e6fb0', '#d9c2ff')),
  memory('heart-pendant', 'قلبِ کوچک', 'یک آویز طلایی روی نخ سرخ.', 'یادگاری', 'solo-05.jpg', frame('یاقوت', '#8a1d2f', '#ff7a8f')),
  memory('tea-detail', 'گرمای فنجان', 'آرامش را می‌شود با دو دست نگه داشت.', 'جزئیات', 'solo-06.jpg', frame('فیروزه', '#5fb9d6', '#b8efff')),
  memory('misha-portrait', 'نگاهِ میشا', 'آرام، کنجکاو، و همیشه نزدیک.', 'پرتره', 'solo-07.jpg', frame('نقره ماه', '#b8c2d4', '#e3ecff')),
  memory('fandogh-portrait', 'فندق از نزدیک', 'یک نگاه کوچک پر از سؤال.', 'پرتره', 'solo-08.jpg', frame('طلای قرمز', '#b33a3a', '#ffb0a0')),
  memory('jasmine-smile', 'کنارِ یاس', 'لبخندی ساده، کنار دیواری پر از شکوفه.', 'بهار', 'solo-09.jpg', frame('عاج', '#e8dccb', '#fff3e0')),
];

// A silent motion-portrait made from the edition's own generated photographs, not personal footage.
export const soloVideo = {
  src: memoryImage('motion-portrait.mp4'),
  poster: memoryImage('motion-portrait-poster.jpg'),
};
export const allMemories = [...memories, ...soloMemories];
