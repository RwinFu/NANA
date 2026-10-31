import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const videoPath = new URL('../public/memories/solo-video.mp4', import.meta.url);
const buffer = readFileSync(videoPath);

function parseBoxes(data, start = 0, end = data.length) {
  const boxes = [];
  let position = start;
  while (position < end) {
    assert.ok(position + 8 <= end, 'box header must be complete');
    let size = data.readUInt32BE(position);
    const type = data.toString('ascii', position + 4, position + 8);
    let headerSize = 8;
    if (size === 1) {
      assert.ok(position + 16 <= end, 'extended box header must be complete');
      const extendedSize = data.readBigUInt64BE(position + 8);
      assert.ok(extendedSize <= BigInt(Number.MAX_SAFE_INTEGER));
      size = Number(extendedSize);
      headerSize = 16;
    } else if (size === 0) {
      size = end - position;
    }
    assert.ok(size >= headerSize && position + size <= end, `valid ${type} box bounds`);
    boxes.push({ type, start: position, size, headerSize });
    position += size;
  }
  return boxes;
}

function collectChunkOffsets(box, offsets) {
  const payloadStart = box.start + box.headerSize;
  const boxEnd = box.start + box.size;
  if (box.type === 'stco' || box.type === 'co64') {
    const count = buffer.readUInt32BE(payloadStart + 4);
    const width = box.type === 'stco' ? 4 : 8;
    assert.equal(payloadStart + 8 + count * width, boxEnd, `${box.type} entry table size`);
    for (let i = 0; i < count; i += 1) {
      const entry = payloadStart + 8 + i * width;
      offsets.push(width === 4 ? buffer.readUInt32BE(entry) : Number(buffer.readBigUInt64BE(entry)));
    }
    return;
  }

  if (['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'mvex'].includes(box.type)) {
    for (const child of parseBoxes(buffer, payloadStart, boxEnd)) collectChunkOffsets(child, offsets);
  }
}

test('memory video is fast-start optimized and sample offsets point into mdat', () => {
  const topLevel = parseBoxes(buffer);
  const ftyp = topLevel.find((box) => box.type === 'ftyp');
  const moov = topLevel.find((box) => box.type === 'moov');
  const mdat = topLevel.find((box) => box.type === 'mdat');
  assert.ok(ftyp && moov && mdat, 'video must contain ftyp, moov and mdat boxes');
  assert.ok(ftyp.start < moov.start && moov.start < mdat.start, 'moov must precede media data');

  const chunkOffsets = [];
  collectChunkOffsets(moov, chunkOffsets);
  assert.ok(chunkOffsets.length > 0, 'video must contain sample chunk offsets');
  const mediaStart = mdat.start + mdat.headerSize;
  const mediaEnd = mdat.start + mdat.size;
  for (const offset of chunkOffsets) {
    assert.ok(offset >= mediaStart && offset < mediaEnd, `chunk offset ${offset} must point into mdat`);
  }
});
