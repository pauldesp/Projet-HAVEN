import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Remove text/EXIF metadata only; retain the original encoded pixels and color profile.
for (const path of process.argv.slice(2)) {
  const original = readFileSync(path);
  assert.equal(original.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const kept = [original.subarray(0, 8)];
  let offset = 8;
  let removed = 0;
  while (offset < original.length) {
    const length = original.readUInt32BE(offset);
    const end = offset + length + 12;
    assert.ok(end <= original.length, 'Truncated PNG');
    const type = original.toString('ascii', offset + 4, offset + 8);
    if (['tEXt', 'zTXt', 'iTXt', 'eXIf'].includes(type)) removed++;
    else kept.push(original.subarray(offset, end));
    offset = end;
  }
  if (removed) writeFileSync(path, Buffer.concat(kept));
  console.log(`${path}: ${removed} metadata chunks removed; image data unchanged`);
}
