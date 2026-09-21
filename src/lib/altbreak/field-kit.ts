import { downloadBlob } from "@/lib/utils";

/** Canonical kit files, bundled from extension/ (not the legacy public/ copy). */
const PACKAGED = import.meta.glob("../../../extension/*", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array {
  return Uint8Array.of(n & 0xff, (n >>> 8) & 0xff);
}

function u32(n: number): Uint8Array {
  return Uint8Array.of(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** Store-method zip so the desk can pack without jszip. */
function zipStore(entries: { name: string; data: Uint8Array }[]): Blob {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  const gp = 1 << 11;
  const encoder = new TextEncoder();
  for (const { name, data } of entries) {
    const nameBuf = encoder.encode(name);
    const crc = crc32(data);
    const local = concat([
      Uint8Array.of(0x50, 0x4b, 0x03, 0x04),
      u16(20),
      u16(gp),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBuf.length),
      u16(0),
      nameBuf,
      data,
    ]);
    const central = concat([
      Uint8Array.of(0x50, 0x4b, 0x01, 0x02),
      u16(20),
      u16(20),
      u16(gp),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBuf.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBuf,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralDir = concat(centrals);
  const eocd = concat([
    Uint8Array.of(0x50, 0x4b, 0x05, 0x06),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);
  return new Blob([concat([...locals, centralDir, eocd])], { type: "application/x-xpinstall" });
}

function extensionEntries(): { name: string; data: Uint8Array }[] {
  const encoder = new TextEncoder();
  const entries = Object.entries(PACKAGED)
    .map(([path, text]) => {
      const name = path.replace(/\\/g, "/").split("/").pop() || "";
      return { name, data: encoder.encode(text) };
    })
    .filter((e) => e.name && e.name !== "." && !e.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (entries.length === 0) throw new Error("Field kit sources missing from extension/");
  if (!entries.some((e) => e.name === "manifest.json")) {
    throw new Error("extension/manifest.json is not in the packed kit");
  }
  return entries;
}

/** Pack the companion as an unsigned .xpi (zip of the extension root). */
export async function downloadFieldKitXpi(): Promise<void> {
  const blob = zipStore(extensionEntries());
  downloadBlob("spammeraegis-field-kit-0.1.0.xpi", blob);
}
