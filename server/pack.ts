import { deflateRawSync, gzipSync, inflateRawSync } from "node:zlib";
import { MOCK_LIMITS } from "../shared/policy";

export interface ZipEntry {
  name: string;
  data: Buffer;
}

export function gzipBytes(data: Buffer): Buffer {
  return gzipSync(data as unknown as Uint8Array);
}

export function zipEntries(entries: ZipEntry[]): Buffer {
  if (entries.length > MOCK_LIMITS.maxZipEntries) throw new Error("Too many zip entries");
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    assertSafeName(entry.name);
    const name = Buffer.from(entry.name);
    const compressed = deflateRawSync(entry.data as unknown as Uint8Array);
    const crc = crc32(entry.data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local as unknown as Uint8Array, 30);
    locals.push(local, compressed);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central as unknown as Uint8Array, 46);
    centrals.push(central);
    offset += local.length + compressed.length;
  }
  const central = Buffer.concat(centrals as unknown as Uint8Array[]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, central, end] as unknown as Uint8Array[]);
}

export function readZip(data: Buffer): ZipEntry[] {
  if (data.length < 22 || data.length > 512 * 1024) throw new Error("Zip is too large");
  const end = data.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]) as unknown as Uint8Array);
  if (end < 0) throw new Error("Zip directory is missing");
  const count = data.readUInt16LE(end + 10);
  if (count > MOCK_LIMITS.maxZipEntries) throw new Error("Zip has too many files");
  let cursor = data.readUInt32LE(end + 16);
  const entries: ZipEntry[] = [];
  let uncompressed = 0;
  for (let index = 0; index < count; index += 1) {
    if (data.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Zip directory is invalid");
    const method = data.readUInt16LE(cursor + 10);
    const compressedSize = data.readUInt32LE(cursor + 20);
    const size = data.readUInt32LE(cursor + 24);
    const nameLength = data.readUInt16LE(cursor + 28);
    const extra = data.readUInt16LE(cursor + 30);
    const comment = data.readUInt16LE(cursor + 32);
    const localOffset = data.readUInt32LE(cursor + 42);
    const name = data.slice(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    assertSafeName(name);
    if (size > MOCK_LIMITS.maxZipUncompressedBytes) throw new Error("Zip entry is too large");
    if (compressedSize > 100 && size / Math.max(compressedSize, 1) > MOCK_LIMITS.maxZipRatio) {
      throw new Error("Zip compression ratio is too high");
    }
    const localName = data.readUInt16LE(localOffset + 26);
    const localExtra = data.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localName + localExtra;
    const compressed = data.slice(start, start + compressedSize);
    const bytes = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed as unknown as Uint8Array) : null;
    if (!bytes) throw new Error("Zip compression method is not supported");
    if (bytes.length !== size && size !== 0) throw new Error("Zip entry size does not match");
    uncompressed += bytes.length;
    if (uncompressed > MOCK_LIMITS.maxZipUncompressedBytes) throw new Error("Zip expands too far");
    entries.push({ name, data: bytes });
    cursor += 46 + nameLength + extra + comment;
  }
  return entries;
}

function assertSafeName(name: string) {
  if (!name || name.length > 80 || name.includes("..") || name.startsWith("/") || name.includes("\\")) {
    throw new Error("Zip entry path is not allowed");
  }
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});
