function readUInt16(buffer, offset, littleEndian) {
  return littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
}

function readUInt32(buffer, offset, littleEndian) {
  return littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
}

function tiffAsciiValue(buffer, tiffOffset, valueOffset, count, littleEndian) {
  const valueStart = count <= 4 ? valueOffset : tiffOffset + readUInt32(buffer, valueOffset, littleEndian);
  if (valueStart < 0 || valueStart + count > buffer.length) return "";
  return buffer.subarray(valueStart, valueStart + count).toString("ascii").replace(/\0+$/u, "").trim();
}

function ifdEntries(buffer, tiffOffset, ifdOffset, littleEndian) {
  const start = tiffOffset + ifdOffset;
  if (start < 0 || start + 2 > buffer.length) return [];
  const entryCount = readUInt16(buffer, start, littleEndian);
  const entries = [];
  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = start + 2 + index * 12;
    if (entryOffset + 12 > buffer.length) break;
    entries.push({
      tag: readUInt16(buffer, entryOffset, littleEndian),
      type: readUInt16(buffer, entryOffset + 2, littleEndian),
      count: readUInt32(buffer, entryOffset + 4, littleEndian),
      valueOffset: entryOffset + 8,
    });
  }
  return entries;
}

function parseExifDate(value) {
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/u.exec(String(value ?? "").trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();
}

export function capturedAtFromExif(file) {
  if (String(file.contentType ?? "").toLowerCase() !== "image/jpeg") return null;
  const buffer = file.bytes;
  if (!Buffer.isBuffer(buffer) || buffer.length < 12 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xda || marker === 0xd9) break;
    const segmentLength = buffer.readUInt16BE(offset);
    const segmentStart = offset + 2;
    const segmentEnd = offset + segmentLength;
    if (segmentLength < 2 || segmentEnd > buffer.length) return null;

    if (marker === 0xe1 && buffer.subarray(segmentStart, segmentStart + 6).toString("ascii") === "Exif\0\0") {
      const tiffOffset = segmentStart + 6;
      const byteOrder = buffer.subarray(tiffOffset, tiffOffset + 2).toString("ascii");
      const littleEndian = byteOrder === "II";
      if (!littleEndian && byteOrder !== "MM") return null;
      if (readUInt16(buffer, tiffOffset + 2, littleEndian) !== 42) return null;

      const ifd0Offset = readUInt32(buffer, tiffOffset + 4, littleEndian);
      const ifd0Entries = ifdEntries(buffer, tiffOffset, ifd0Offset, littleEndian);
      const dateTime = ifd0Entries.find((entry) => entry.tag === 0x0132 && entry.type === 2);
      const exifPointer = ifd0Entries.find((entry) => entry.tag === 0x8769);
      const exifOffset = exifPointer ? readUInt32(buffer, exifPointer.valueOffset, littleEndian) : 0;
      const exifEntries = exifOffset ? ifdEntries(buffer, tiffOffset, exifOffset, littleEndian) : [];
      const originalDate = exifEntries.find((entry) => entry.tag === 0x9003 && entry.type === 2);
      const digitizedDate = exifEntries.find((entry) => entry.tag === 0x9004 && entry.type === 2);

      for (const entry of [originalDate, digitizedDate, dateTime]) {
        if (!entry) continue;
        const parsed = parseExifDate(tiffAsciiValue(buffer, tiffOffset, entry.valueOffset, entry.count, littleEndian));
        if (parsed) return parsed;
      }
      return null;
    }

    offset = segmentEnd;
  }

  return null;
}
