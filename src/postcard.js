// Builds a downloadable postcard from a snapshot of the 3D scene.
const FONT = '"Vazirmatn Variable", Vazirmatn, sans-serif';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed to load'));
    img.src = src;
  });
}

async function ensureFont() {
  try {
    await Promise.all([
      document.fonts.load(`900 56px ${FONT}`),
      document.fonts.load(`500 36px ${FONT}`),
    ]);
  } catch {
    // Fall back to the system font if the webfont can't load.
  }
}

export async function composePostcard({ snapshot, title, names, subtitle }) {
  await ensureFont();
  const W = 1080;
  const H = 1300;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#fff6ec';
  ctx.fillRect(0, 0, W, H);

  const photoBox = { x: 90, y: 90, w: 900, h: 860 };
  if (snapshot) {
    const img = await loadImage(snapshot);
    const scale = Math.max(photoBox.w / img.width, photoBox.h / img.height);
    const sw = photoBox.w / scale;
    const sh = photoBox.h / scale;
    const sx = (img.width - sw) / 2;
    const sy = (img.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, photoBox.x, photoBox.y, photoBox.w, photoBox.h);
  } else {
    ctx.fillStyle = '#2a1d35';
    ctx.fillRect(photoBox.x, photoBox.y, photoBox.w, photoBox.h);
  }

  // Thin lamp-colored keyline around the photo
  ctx.strokeStyle = '#ffcf8a';
  ctx.lineWidth = 4;
  ctx.strokeRect(photoBox.x + 2, photoBox.y + 2, photoBox.w - 4, photoBox.h - 4);

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1b1426';
  ctx.font = `900 58px ${FONT}`;
  ctx.fillText(title, W / 2, 1040);

  ctx.fillStyle = '#6b3a52';
  ctx.font = `600 40px ${FONT}`;
  ctx.fillText(names, W / 2, 1120);

  ctx.fillStyle = 'rgba(27,20,38,0.6)';
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText(subtitle, W / 2, 1192);

  return canvas;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png');
  });
}
