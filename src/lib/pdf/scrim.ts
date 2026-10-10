import { deflateSync } from "node:zlib";

// The dark fade that sits on the bottom of a photo so white text stays readable.
//
// It used to be drawn as 8 (idea pages) or 40 (cover) stacked, semi-transparent rectangles that
// overlapped by 1pt. Every overlap is painted twice, so it is darker than its neighbours:
// a thin dark line at every band edge, which showed as horizontal lines across the photo.
// A single image whose alpha channel is the gradient has no edges at all.
//
// The image is 1 pixel wide and `rows` pixels tall, row 0 at the top (fully transparent) to the
// last row at the bottom (fully opaque, the same colour). It is stretched over the area to fade
// and drawn with the wanted maximum opacity (0.78 on idea pages, 0.82 on the cover).

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Alpha of row `row` of `rows`: 0 at the top, 255 at the bottom, easing in quadratically. */
export function scrimAlpha(row: number, rows: number): number {
  const t = rows <= 1 ? 1 : row / (rows - 1);
  return Math.round(255 * t * t);
}

/** A 1 x `rows` RGBA PNG: a constant colour whose alpha grows from 0 (top) to 255 (bottom). */
export function buildScrimPng(color: readonly [number, number, number], rows = 256): Uint8Array {
  const raw = Buffer.alloc(rows * 5);
  for (let y = 0; y < rows; y++) {
    const at = y * 5;
    raw[at] = 0; // PNG filter type "none" for this row
    raw[at + 1] = color[0];
    raw[at + 2] = color[1];
    raw[at + 3] = color[2];
    raw[at + 4] = scrimAlpha(y, rows);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0); // width
  header.writeUInt32BE(rows, 4); // height
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  return new Uint8Array(
    Buffer.concat([SIGNATURE, chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]),
  );
}
