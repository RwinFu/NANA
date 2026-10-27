// Add or replace images in /public/memories/ and set their local paths here.
// All twelve photos from the user's Google Drive folder "Nana" are included.
export const museumDefaults = {
  fromName: 'من',
  toName: 'عزیزم',
  dedication: 'تمام لحظه‌های کوچکمان، ارزش قاب گرفتن دارند.',
};

const memoryImage = (filename) => `${import.meta.env.BASE_URL}memories/${filename}`;

export const memories = [
  {
    id: 'flowers-in-the-car',
    title: 'برای تو، با گل',
    caption: 'گل‌ها قشنگ بودند؛ اما لحظه‌ای که به تو رسیدند، قشنگ‌تر شد.',
    date: 'خاطره‌ی ۰۱',
    imageSrc: memoryImage('memory-01.jpg'),
    palette: ['#ead8c9', '#c4b4a7', '#8a776a'],
  },
  {
    id: 'mirror-selfie',
    title: 'یک قابِ دونفره',
    caption: 'بعضی عکس‌ها لازم نیست ژست داشته باشند؛ کنار هم بودن کافی است.',
    date: 'خاطره‌ی ۰۲',
    imageSrc: memoryImage('memory-02.jpg'),
    palette: ['#d6e3df', '#afc3be', '#7c9990'],
  },
  {
    id: 'little-surprise',
    title: 'یک سورپرایزِ کوچک',
    caption: 'یک لحظه‌ی ساده در ماشین، که حالا دیدنش دوباره لبخند می‌آورد.',
    date: 'خاطره‌ی ۰۳',
    imageSrc: memoryImage('memory-03.jpg'),
    palette: ['#d8e0e5', '#b6c8d0', '#879da6'],
  },
  {
    id: 'red-rose',
    title: 'رزِ قرمز',
    caption: 'یک گل، یک نگاه، و خاطره‌ای که ماندگار شد.',
    date: 'خاطره‌ی ۰۴',
    imageSrc: memoryImage('memory-04.jpg'),
    palette: ['#eee0d6', '#d0b1a5', '#a87570'],
  },
  {
    id: 'home-mirror',
    title: 'لحظه‌ی خودِ خودمان',
    caption: 'از آن قاب‌های بی‌تکلفی که بعداً می‌فهمی چقدر دوستشان داری.',
    date: 'خاطره‌ی ۰۵',
    imageSrc: memoryImage('memory-05.jpg'),
    palette: ['#e7dfd1', '#c6b9aa', '#8a7d72'],
  },
  {
    id: 'warm-hug',
    title: 'آغوشِ امن',
    caption: 'گاهی تمامِ دنیا خلاصه می‌شود در همین چند ثانیه کنار هم بودن.',
    date: 'خاطره‌ی ۰۶',
    imageSrc: memoryImage('memory-06.jpg'),
    palette: ['#d7e2e4', '#b2c7cf', '#819aa4'],
  },
  {
    id: 'birthday-cake',
    title: 'شمعِ روشن',
    caption: 'یک کیک کوچک و یک آرزوی بزرگ؛ اینکه باز هم کنار هم جشن بگیریم.',
    date: 'خاطره‌ی ۰۷',
    imageSrc: memoryImage('memory-07.jpg'),
    palette: ['#eee0c8', '#d3b88b', '#a87d4d'],
  },
  {
    id: 'sweet-treat',
    title: 'یک شیرینیِ دونفره',
    caption: 'قرار نبود عکس خاصی بگیریم؛ همین شد یکی از قاب‌های محبوبمان.',
    date: 'خاطره‌ی ۰۸',
    imageSrc: memoryImage('memory-08.jpg'),
    palette: ['#e8d9d7', '#c8aab0', '#986e79'],
  },
  {
    id: 'black-and-white',
    title: 'بی‌نیاز از رنگ',
    caption: 'بعضی لحظه‌ها حتی در سیاه‌وسفید هم تمامِ حسشان را نگه می‌دارند.',
    date: 'خاطره‌ی ۰۹',
    imageSrc: memoryImage('memory-09.jpg'),
    palette: ['#d8d8d8', '#aaa9a5', '#67696c'],
  },
  {
    id: 'quiet-moment',
    title: 'یک لحظه‌ی آرام',
    caption: 'نه برنامه‌ای، نه عجله‌ای؛ فقط کنار هم و در آرامش.',
    date: 'خاطره‌ی ۱۰',
    imageSrc: memoryImage('memory-10.jpg'),
    palette: ['#d8d6df', '#b7b2c2', '#80788f'],
  },
  {
    id: 'dinner-date',
    title: 'قرارِ خوشمزه',
    caption: 'از آن قرارهایی که حرف و خنده‌اش از خودِ غذا بیشتر می‌چسبد.',
    date: 'خاطره‌ی ۱۱',
    imageSrc: memoryImage('memory-11.jpg'),
    palette: ['#d9e0d3', '#aeb9a0', '#737e6e'],
  },
  {
    id: 'colorful-night',
    title: 'زیر چراغ‌های رنگی',
    caption: 'یک قابِ آخرِ شب؛ با نورهای عجیب و آدمِ درست کنارم.',
    date: 'خاطره‌ی ۱۲',
    imageSrc: memoryImage('memory-12.jpg'),
    palette: ['#e5d5b8', '#c4a978', '#8b6942'],
  },
];
