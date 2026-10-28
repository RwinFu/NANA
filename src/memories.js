// Content for the house. Edit text here; photos live in /public/memories/.
// Every photo path goes through memoryImage() so it also works on GitHub Pages subpaths.

export const defaults = {
  fromName: 'من',
  toName: 'پرنسس من',
  dedication: 'اولین سالگرد یکی شدنمون مبارک؛ تمام لحظه‌های با تو بودن، ارزش قاب گرفتن دارند.',
  anniversaryMsg:
    'اولین سالگرد عشقمون مبارک قشنگم! ۳۶۵ روزه که با اومدنت به زندگیم همه‌چیز زیباتر شده ❤️💍✨',
  loveCount: 10240,
  avatarColor: '#ff758f',
};

export const letterParagraphs = [
  'سلام مهربون‌ترین دختر دنیا،',
  'درست یک سال پیش، تو وارد زندگیم شدی و از همون روز اول، همه‌چیز رنگ و بوی دیگه‌ای گرفت. تک‌تک این ۱۲ قابی که توی این خونه می‌بینی، گوشه‌ای از زیباترین لحظه‌هایی هستن که با هم ساختیم.',
  'از خنده‌هامون توی ماشین و قرارهای دونفره‌مون گرفته تا آرامشِ بودنت کنارم، همه‌شون باارزش‌ترین گنجینه‌ی زندگی منن.',
  'اولین سالگردمون و ولنتاین مبارک عشقم؛ قول میدم هر روز بیشتر از دیروز دوستت داشته باشم و کنارت باشم. ❤️💍',
];

export const memoryImage = (filename) => `${import.meta.env.BASE_URL}memories/${filename}`;

// tone: the frame's metal/wood color and the glow color of its lamp (hex).
export const memories = [
  {
    id: 'flowers-in-the-car',
    title: 'برای تو، با گل',
    caption: 'گل‌ها قشنگ بودند؛ اما لحظه‌ای که به دست‌های تو رسیدند، دنیا هزار برابر زیباتر شد.',
    chapter: 'اولین هدیه',
    image: memoryImage('memory-01.jpg'),
    frame: { name: 'رزگلد رمانتیک', color: '#d88a8a', glow: '#ffb7c0' },
  },
  {
    id: 'mirror-selfie',
    title: 'یک قابِ دونفره',
    caption: 'بعضی عکس‌ها لازم نیست ژست خاصی داشته باشند؛ همین که کنارمی تمام خوشبختی منه.',
    chapter: 'آینه‌ی دونفره',
    image: memoryImage('memory-02.jpg'),
    frame: { name: 'طلایی آنتیک', color: '#d4af37', glow: '#ffe27a' },
  },
  {
    id: 'little-surprise',
    title: 'یک سورپرایزِ کوچک',
    caption: 'یک لحظه‌ی ساده در ماشین، که لبخندت برای همیشه توی قلبم حک شد.',
    chapter: 'لبخندِ شیرین',
    image: memoryImage('memory-03.jpg'),
    frame: { name: 'چوب گردوی طبیعی', color: '#6b4c30', glow: '#ffd9a0' },
  },
  {
    id: 'red-rose',
    title: 'رزِ سرخ عاشقانه',
    caption: 'یک گل رز برای زیباترین گل زندگی من؛ نماد عشقی که هر روز پررنگ‌تر میشه.',
    chapter: 'رزِ سرخ',
    image: memoryImage('memory-04.jpg'),
    frame: { name: 'مخمل یاقوتی', color: '#7e1522', glow: '#ff6b7a' },
  },
  {
    id: 'home-mirror',
    title: 'لحظه‌ی خودِ خودمان',
    caption: 'از آن قاب‌های خودمانی و واقعی که نشان میده چقدر با هم خوشحالیم.',
    chapter: 'سادگیِ عشق',
    image: memoryImage('memory-05.jpg'),
    frame: { name: 'بلوط با پاسپارتوی کتان', color: '#9e7346', glow: '#ffe2b8' },
  },
  {
    id: 'warm-hug',
    title: 'آغوشِ امن',
    caption: 'وقتی بغلت می‌کنم تمام استرس‌های دنیا محو میشن؛ امن‌ترین جای جهان برای من.',
    chapter: 'آغوش امن',
    image: memoryImage('memory-06.jpg'),
    frame: { name: 'مرواریدی نقره‌ای', color: '#e6e9ee', glow: '#cfe4ff' },
  },
  {
    id: 'birthday-cake',
    title: 'شمعِ روشن و آرزوی من',
    caption: 'تنها آرزوی من در کنار تو بودن و تکرار همیشگی این خنده‌هاست.',
    chapter: 'جشن و شمع',
    image: memoryImage('memory-07.jpg'),
    frame: { name: 'خورشید جشن', color: '#e6b931', glow: '#fff085' },
  },
  {
    id: 'sweet-treat',
    title: 'یک شیرینیِ دونفره',
    caption: 'هر چیزی که با تو خورده بشه و به اشتراک گذاشته بشه، شیرین‌ترین طعم رو داره.',
    chapter: 'لحظه‌ی شیرین',
    image: memoryImage('memory-08.jpg'),
    frame: { name: 'کوارتز صورتی', color: '#d699a4', glow: '#ffc2d1' },
  },
  {
    id: 'black-and-white',
    title: 'بی‌نیاز از رنگ',
    caption: 'حتی در سیاه‌وسفید هم نگاهت پر از رنگ و زندگیه؛ قاب محبوب من.',
    chapter: 'سیاه‌وسفید',
    image: memoryImage('memory-09.jpg'),
    frame: { name: 'آبنوس با کروم', color: '#1c1e22', glow: '#dfe4ea' },
  },
  {
    id: 'quiet-moment',
    title: 'یک لحظه‌ی آرام',
    caption: 'آرامشی که کنار تو دارم رو با هیچ حسی در تمام دنیا عوض نمی‌کنم.',
    chapter: 'آرامشِ محض',
    image: memoryImage('memory-10.jpg'),
    frame: { name: 'برنز با حریر یاسی', color: '#73573c', glow: '#d9c2ff' },
  },
  {
    id: 'dinner-date',
    title: 'قرارِ عاشقانه‌مان',
    caption: 'از آن قرارهای قشنگی که گذشت زمان رو حس نمی‌کنیم و فقط غرق حرف‌های همیم.',
    chapter: 'قرار دونفره',
    image: memoryImage('memory-11.jpg'),
    frame: { name: 'لاک زمردی با مس', color: '#1f4738', glow: '#ffb27a' },
  },
  {
    id: 'colorful-night',
    title: 'زیر نورهای رنگی شهر',
    caption: 'یک شب خاطره‌انگیز و پر از خنده، با دختری که ستاره‌ی تمام شب‌های منه.',
    chapter: 'شب رویایی',
    image: memoryImage('memory-12.jpg'),
    frame: { name: 'آسمان شب با قاب نوری', color: '#171d33', glow: '#ffd257' },
  },
];
