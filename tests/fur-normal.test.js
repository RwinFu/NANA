import test from 'node:test';
import assert from 'node:assert/strict';

// The stone, bark, velvet and fur normal maps are all made by one Sobel filter. It used to read its
// neighbours through a modulo closure four times per pixel, which made it the most expensive single
// thing in the start-up. It is now written with index arithmetic — and this test holds it to the exact
// bytes the original produced, so "faster" cannot also mean "different".

const SIZE = 256;

// the original, kept here as the reference
function reference(src, strength) {
  const h = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < h.length; i += 1) h[i] = src[i * 4] / 255;
  const at = (x, y) => h[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)];
  const out = [];
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const dX = at(x + 1, y) - at(x - 1, y);
      const dY = at(x, y + 1) - at(x, y - 1);
      let nx = -dX * strength;
      let ny = dY * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      out.push(Math.round(((nx / len) * 0.5 + 0.5) * 255));
      out.push(Math.round(((ny / len) * 0.5 + 0.5) * 255));
      out.push(Math.round(((nz / len) * 0.5 + 0.5) * 255));
      out.push(255);
    }
  }
  return out;
}

function heightField(seed) {
  const src = new Uint8ClampedArray(SIZE * SIZE * 4);
  let s = seed;
  for (let i = 0; i < src.length; i += 4) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const v = s % 256;
    src[i] = v;
    src[i + 1] = v;
    src[i + 2] = v;
    src[i + 3] = 255;
  }
  return src;
}

test('the normal map is byte for byte what it always was', async () => {
  const { normalCanvas } = await import('../src/fur.js');
  const cases = [
    [1, 0.5],
    [2, 1.3],
    [3, 2.4],
  ];
  for (const [seed, strength] of cases) {
    const src = heightField(seed * 991);
    const expected = reference(src, strength);

    // the module reads its height field from a canvas, so give it one that returns the same bytes
    const previous = globalThis.document;
    let written = null;
    globalThis.document = {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          getImageData: () => ({ data: src }),
          createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          putImageData: (img) => { written = img.data; },
        }),
      }),
    };
    try {
      normalCanvas({ getContext: () => ({ getImageData: () => ({ data: src }) }) }, strength);
    } finally {
      globalThis.document = previous;
    }
    assert.equal(written.length, expected.length);
    let worst = 0;
    for (let i = 0; i < expected.length; i += 1) worst = Math.max(worst, Math.abs(written[i] - expected[i]));
    assert.equal(worst, 0, `a pixel changed at seed ${seed}, strength ${strength}: max difference ${worst}`);
  }
});
