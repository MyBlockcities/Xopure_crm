export interface ZipEntry {
  readonly name: string;
  readonly content: string;
}

const table = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  return crc >>> 0;
});

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);

  return (crc ^ 0xffffffff) >>> 0;
};

const u16 = (value: number): number[] => [value & 0xff, (value >>> 8) & 0xff];
const u32 = (value: number): number[] => [
  value & 0xff,
  (value >>> 8) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 24) & 0xff,
];

/** Deterministic ZIP archive using the STORE method (no timestamps, no dependency). */
export const createZip = (entries: readonly ZipEntry[]): Uint8Array => {
  const encoder = new TextEncoder();
  const local: number[] = [];
  const central: number[] = [];
  let offset = 0;

  for (const entry of entries) {
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(entry.name)) {
      throw new Error(`Unsafe ZIP entry name: ${entry.name}`);
    }
    const name = encoder.encode(entry.name);
    const data = encoder.encode(entry.content);
    const crc = crc32(data);
    const header = [
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(0x0800),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(data.length),
      ...u32(data.length),
      ...u16(name.length),
      ...u16(0),
      ...name,
    ];
    local.push(...header, ...data);

    central.push(
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(0x0800),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(data.length),
      ...u32(data.length),
      ...u16(name.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
      ...name,
    );
    offset += header.length + data.length;
  }

  const end = [
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(central.length),
    ...u32(local.length),
    ...u16(0),
  ];

  return Uint8Array.from([...local, ...central, ...end]);
};

