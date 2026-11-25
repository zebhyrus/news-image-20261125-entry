// THE WORLD — front page for Wednesday 25 November 2026.
// Draws the whole page pixel by pixel and encodes a PNG itself.
// Node standard library only. No network, no external files.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1024;
const H = 1024;

// ---- palette: newspaper paper, black ink, one red accent ----
const PAPER: RGBA = [247, 242, 231, 255];
const INK: RGBA = [18, 18, 18, 255];
const RED: RGBA = [178, 34, 28, 255];
const GREY: RGBA = [110, 108, 100, 255];
const LIGHT: RGBA = [232, 226, 212, 255];
const SEA: RGBA = [58, 96, 122, 255];
const SEA_DARK: RGBA = [38, 66, 88, 255];
const SKY: RGBA = [214, 226, 232, 255];
const ORANGE: RGBA = [224, 110, 30, 255];
const GOLD: RGBA = [214, 164, 32, 255];
const GREEN: RGBA = [46, 110, 62, 255];

type RGBA = [number, number, number, number];

// ---- canvas ----
const px = new Uint8Array(W * H * 4);

function setPixel(x: number, y: number, c: RGBA): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
  px[i + 3] = c[3];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGBA): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) setPixel(xx, yy, c);
  }
}

function hline(x: number, y: number, w: number, c: RGBA): void {
  fillRect(x, y, w, 1, c);
}

function vline(x: number, y: number, h: number, c: RGBA): void {
  fillRect(x, y, 1, h, c);
}

function fillCircle(cx: number, cy: number, r: number, c: RGBA): void {
  for (let yy = -r; yy <= r; yy++) {
    for (let xx = -r; xx <= r; xx++) {
      if (xx * xx + yy * yy <= r * r) setPixel(cx + xx, cy + yy, c);
    }
  }
}

// Filled triangle via scanline interpolation.
function fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGBA): void {
  const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    const edges: Array<[number, number, number, number]> = [
      [x0, y0, x1, y1],
      [x1, y1, x2, y2],
      [x2, y2, x0, y0],
    ];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
    }
    if (xs.length >= 2) {
      const a = Math.min(...xs);
      const b = Math.max(...xs);
      for (let x = Math.floor(a); x <= Math.ceil(b); x++) setPixel(x, y, c);
    }
  }
}

// ---- PNG encoding (manual chunks + zlib) ----
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(): Buffer {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0; // filter: none
    raw.set(px.subarray(y * W * 4, (y + 1) * W * 4), y * (W * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- 5x7 bitmap font, each glyph 7 rows of 5 bits ----
// Uppercase A-Z, lowercase a-z, digits, punctuation. Written by hand.
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  a: [0x00, 0x00, 0x0e, 0x01, 0x0f, 0x11, 0x0f],
  b: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x1e],
  c: [0x00, 0x00, 0x0e, 0x11, 0x10, 0x11, 0x0e],
  d: [0x01, 0x01, 0x0f, 0x11, 0x11, 0x11, 0x0f],
  e: [0x00, 0x00, 0x0e, 0x11, 0x1f, 0x10, 0x0e],
  f: [0x06, 0x09, 0x08, 0x1e, 0x08, 0x08, 0x08],
  g: [0x0f, 0x11, 0x11, 0x0f, 0x01, 0x01, 0x0e],
  h: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x11],
  i: [0x04, 0x00, 0x0c, 0x04, 0x04, 0x04, 0x0e],
  j: [0x02, 0x00, 0x06, 0x02, 0x02, 0x12, 0x0c],
  k: [0x10, 0x10, 0x12, 0x14, 0x18, 0x14, 0x12],
  l: [0x0c, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  m: [0x00, 0x00, 0x1a, 0x15, 0x15, 0x15, 0x15],
  n: [0x00, 0x00, 0x1e, 0x11, 0x11, 0x11, 0x11],
  o: [0x00, 0x00, 0x0e, 0x11, 0x11, 0x11, 0x0e],
  p: [0x00, 0x00, 0x1e, 0x11, 0x11, 0x1e, 0x10],
  q: [0x00, 0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01],
  r: [0x00, 0x00, 0x16, 0x19, 0x10, 0x10, 0x10],
  s: [0x00, 0x00, 0x0f, 0x10, 0x0e, 0x01, 0x1e],
  t: [0x08, 0x08, 0x1e, 0x08, 0x08, 0x08, 0x06],
  u: [0x00, 0x00, 0x11, 0x11, 0x11, 0x13, 0x0d],
  v: [0x00, 0x00, 0x11, 0x11, 0x11, 0x0a, 0x04],
  w: [0x00, 0x00, 0x11, 0x11, 0x15, 0x15, 0x0a],
  x: [0x00, 0x00, 0x11, 0x11, 0x0a, 0x11, 0x11],
  y: [0x11, 0x11, 0x11, 0x0f, 0x01, 0x01, 0x0e],
  z: [0x00, 0x00, 0x1f, 0x02, 0x04, 0x08, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  ".": [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c],
  ",": [0x00, 0x00, 0x00, 0x00, 0x0c, 0x04, 0x08],
  ":": [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x0c, 0x00],
  ";": [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x04, 0x08],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04],
  "'": [0x04, 0x04, 0x08, 0x00, 0x00, 0x00, 0x00],
  '"': [0x0a, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00],
  "-": [0x00, 0x00, 0x00, 0x0e, 0x00, 0x00, 0x00],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "/": [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "%": [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  "+": [0x00, 0x04, 0x04, 0x1f, 0x04, 0x04, 0x00],
  "=": [0x00, 0x00, 0x1f, 0x00, 0x1f, 0x00, 0x00],
  "*": [0x00, 0x04, 0x15, 0x0e, 0x15, 0x04, 0x00],
  "#": [0x0a, 0x0a, 0x1f, 0x0a, 0x1f, 0x0a, 0x0a],
  _: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f],
  "<": [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02],
  ">": [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
};

const EMPTY_GLYPH = [0, 0, 0, 0, 0, 0, 0];

// ---- text rendering ----
function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}

function drawChar(x: number, y: number, ch: string, scale: number, c: RGBA): void {
  const g = FONT[ch] ?? EMPTY_GLYPH;
  for (let row = 0; row < 7; row++) {
    const bits = g[row];
    for (let col = 0; col < 5; col++) {
      if (bits & (1 << (4 - col))) {
        fillRect(x + col * scale, y + row * scale, scale, scale, c);
      }
    }
  }
}

function drawText(x: number, y: number, text: string, scale: number, c: RGBA): void {
  let cx = x;
  for (const ch of text) {
    drawChar(cx, y, ch, scale, c);
    cx += 6 * scale;
  }
}

function drawTextCentered(cx: number, y: number, text: string, scale: number, c: RGBA): void {
  drawText(cx - Math.floor(textWidth(text, scale) / 2), y, text, scale, c);
}

// Greedy word wrap. Returns the lines.
function wrapText(text: string, maxWidth: number, scale: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxWidth) {
      cur = trial;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// Draws wrapped text, returns the y just below the last line.
function drawBlock(x: number, y: number, text: string, scale: number, maxWidth: number, c: RGBA, leading: number): number {
  const lines = wrapText(text, maxWidth, scale);
  for (const line of lines) {
    drawText(x, y, line, scale, c);
    y += 7 * scale + leading;
  }
  return y;
}

// ---- illustrations (all drawn from code) ----

// Lead picture: oil tanker at sea, burning, smoke columns rising.
function drawTanker(x: number, y: number, w: number, h: number): void {
  // sky
  fillRect(x, y, w, h, SKY);
  // sun, low and hazy, clear of the bridge tower
  fillCircle(x + Math.floor(w * 0.68), y + Math.floor(h * 0.2), 16, GOLD);
  // distant headland
  fillTriangle(x, y + h, x + Math.floor(w * 0.2), y + Math.floor(h * 0.55), x + Math.floor(w * 0.38), y + h, GREY);
  // sea
  fillRect(x, y + Math.floor(h * 0.62), w, h - Math.floor(h * 0.62), SEA);
  fillRect(x, y + Math.floor(h * 0.62), w, 3, SEA_DARK);
  // wave strokes
  for (let i = 0; i < 7; i++) {
    const wx = x + 24 + i * Math.floor(w / 7);
    fillRect(wx, y + Math.floor(h * 0.72) + (i % 2) * 14, 34, 3, SEA_DARK);
    fillRect(wx + 12, y + Math.floor(h * 0.86) + (i % 2) * 8, 26, 3, SEA_DARK);
  }
  // tanker hull
  const hullY = y + Math.floor(h * 0.5);
  const hullH = Math.floor(h * 0.2);
  fillRect(x + 30, hullY, w - 60, hullH, INK);
  fillTriangle(x + w - 30, hullY, x + w - 6, hullY + Math.floor(hullH / 2), x + w - 30, hullY + hullH, INK);
  // red waterline stripe
  fillRect(x + 30, hullY + hullH - 6, w - 60, 6, RED);
  // deck: containers and bridge tower
  fillRect(x + 60, hullY - 26, 60, 26, ORANGE);
  fillRect(x + 128, hullY - 26, 60, 26, GOLD);
  fillRect(x + 196, hullY - 26, 60, 26, GREEN);
  fillRect(x + w - 120, hullY - 52, 52, 52, PAPER);
  fillRect(x + w - 120, hullY - 52, 52, 6, RED);
  fillRect(x + w - 112, hullY - 44, 8, 8, INK);
  fillRect(x + w - 96, hullY - 44, 8, 8, INK);
  // funnel
  fillRect(x + 300, hullY - 40, 26, 40, INK);
  fillRect(x + 300, hullY - 40, 26, 8, RED);
  // flames over the mid-deck, tall and visible
  const fx = x + 150;
  const fy = hullY - 26;
  fillTriangle(fx - 8, fy, fx + 14, fy - 64, fx + 34, fy, ORANGE);
  fillTriangle(fx + 30, fy, fx + 52, fy - 50, fx + 74, fy, RED);
  fillTriangle(fx + 10, fy, fx + 24, fy - 36, fx + 38, fy, GOLD);
  // smoke columns, smaller and higher so the flames stay visible
  fillCircle(x + 168, y + Math.floor(h * 0.12), 20, GREY);
  fillCircle(x + 196, y + Math.floor(h * 0.05), 16, GREY);
  fillCircle(x + 222, y + Math.floor(h * 0.13), 13, GREY);
  fillCircle(x + 246, y + Math.floor(h * 0.04), 11, GREY);
  // black frame
  fillRect(x, y, w, 3, INK);
  fillRect(x, y + h - 3, w, 3, INK);
  fillRect(x, y, 3, h, INK);
  fillRect(x + w - 3, y, 3, h, INK);
}

// Courthouse facade with columns.
function drawCourthouse(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, LIGHT);
  // pediment
  fillTriangle(x + 6, y + Math.floor(h * 0.34), x + Math.floor(w / 2), y + 6, x + w - 6, y + Math.floor(h * 0.34), INK);
  fillRect(x + 6, y + Math.floor(h * 0.34), w - 12, 5, INK);
  // columns
  const colW = 12;
  const gap = Math.floor((w - 5 * colW) / 6);
  for (let i = 0; i < 5; i++) {
    const cx = x + gap + i * (colW + gap);
    fillRect(cx, y + Math.floor(h * 0.4), colW, Math.floor(h * 0.42), INK);
  }
  // steps
  fillRect(x + 10, y + Math.floor(h * 0.86), w - 20, 5, INK);
  fillRect(x + 22, y + Math.floor(h * 0.93), w - 44, 5, INK);
  // door
  fillRect(x + Math.floor(w / 2) - 14, y + Math.floor(h * 0.58), 28, Math.floor(h * 0.28), INK);
  // frame
  fillRect(x, y, w, 3, INK);
  fillRect(x, y + h - 3, w, 3, INK);
  fillRect(x, y, 3, h, INK);
  fillRect(x + w - 3, y, 3, h, INK);
}

// Rocket climbing past stars, Earth curve below.
function drawRocket(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, INK);
  // stars
  const stars: Array<[number, number]> = [
    [0.12, 0.16], [0.3, 0.08], [0.55, 0.2], [0.8, 0.1], [0.9, 0.34],
    [0.08, 0.5], [0.66, 0.42], [0.92, 0.6], [0.2, 0.68], [0.44, 0.55],
  ];
  for (const [sx, sy] of stars) {
    fillRect(x + Math.floor(w * sx), y + Math.floor(h * sy), 4, 4, PAPER);
  }
  // Earth curve at the bottom: a shallow cap only.
  fillCircle(x + Math.floor(w * 0.5), y + h + 95, 130, SEA);
  fillCircle(x + Math.floor(w * 0.3), y + h - 8, 12, GREEN);
  fillCircle(x + Math.floor(w * 0.66), y + h - 2, 9, GREEN);
  // rocket body
  const rx = x + Math.floor(w * 0.5);
  const ry = y + Math.floor(h * 0.16);
  fillRect(rx - 11, ry, 22, Math.floor(h * 0.42), PAPER);
  fillTriangle(rx - 11, ry, rx, ry - 22, rx + 11, ry, RED);
  fillRect(rx - 11, ry + Math.floor(h * 0.3), 22, 6, RED);
  fillRect(rx - 20, ry + Math.floor(h * 0.3), 9, 18, RED);
  fillRect(rx + 11, ry + Math.floor(h * 0.3), 9, 18, RED);
  fillCircle(rx, ry + 16, 6, SEA);
  // flame
  fillTriangle(rx - 9, ry + Math.floor(h * 0.42), rx, ry + Math.floor(h * 0.42) + 30, rx + 9, ry + Math.floor(h * 0.42), ORANGE);
  fillTriangle(rx - 4, ry + Math.floor(h * 0.42), rx, ry + Math.floor(h * 0.42) + 18, rx + 4, ry + Math.floor(h * 0.42), GOLD);
  // frame
  fillRect(x, y, w, 3, PAPER);
  fillRect(x, y + h - 3, w, 3, PAPER);
  fillRect(x, y, 3, h, PAPER);
  fillRect(x + w - 3, y, 3, h, PAPER);
}

// Warship at sea under a drone, smoke rising.
function drawWarship(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, SKY);
  fillRect(x, y + Math.floor(h * 0.6), w, h - Math.floor(h * 0.6), SEA);
  fillRect(x, y + Math.floor(h * 0.6), w, 3, SEA_DARK);
  // drone boat, small and fast, left
  fillRect(x + 14, y + Math.floor(h * 0.52), 34, 10, INK);
  fillTriangle(x + 48, y + Math.floor(h * 0.52), x + 62, y + Math.floor(h * 0.57), x + 48, y + Math.floor(h * 0.62), INK);
  fillRect(x + 22, y + Math.floor(h * 0.62), 30, 3, PAPER);
  // warship hull, listing, right
  const hy = y + Math.floor(h * 0.5);
  fillRect(x + Math.floor(w * 0.42), hy, Math.floor(w * 0.5), 18, INK);
  fillTriangle(x + Math.floor(w * 0.92), hy, x + w - 8, hy + 9, x + Math.floor(w * 0.92), hy + 18, INK);
  // superstructure, tilted
  fillRect(x + Math.floor(w * 0.6), hy - 22, 44, 22, INK);
  fillRect(x + Math.floor(w * 0.68), hy - 34, 6, 14, INK);
  // smoke from the ship
  fillCircle(x + Math.floor(w * 0.66), y + Math.floor(h * 0.18), 16, GREY);
  fillCircle(x + Math.floor(w * 0.74), y + Math.floor(h * 0.1), 12, GREY);
  // waves
  fillRect(x + 16, y + Math.floor(h * 0.74), 30, 3, SEA_DARK);
  fillRect(x + Math.floor(w * 0.5), y + Math.floor(h * 0.82), 34, 3, SEA_DARK);
  // frame
  fillRect(x, y, w, 3, INK);
  fillRect(x, y + h - 3, w, 3, INK);
  fillRect(x, y, 3, h, INK);
  fillRect(x + w - 3, y, 3, h, INK);
}

// Supermarket facade with open doors.
function drawMarket(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, LIGHT);
  // sign band
  fillRect(x, y + 8, w, Math.floor(h * 0.22), RED);
  drawTextCentered(x + Math.floor(w / 2), y + 16, "MARKET", 2, PAPER);
  // awning stripes
  for (let i = 0; i < 6; i++) {
    fillRect(x + 8 + i * Math.floor((w - 16) / 6), y + Math.floor(h * 0.36), Math.floor((w - 16) / 12), Math.floor(h * 0.14), i % 2 ? RED : PAPER);
  }
  // open double doors
  fillRect(x + Math.floor(w * 0.3), y + Math.floor(h * 0.56), Math.floor(w * 0.18), Math.floor(h * 0.36), INK);
  fillRect(x + Math.floor(w * 0.52), y + Math.floor(h * 0.56), Math.floor(w * 0.18), Math.floor(h * 0.36), INK);
  fillRect(x + Math.floor(w * 0.3) + 4, y + Math.floor(h * 0.56) + 4, Math.floor(w * 0.18) - 8, Math.floor(h * 0.36) - 8, GOLD);
  fillRect(x + Math.floor(w * 0.52) + 4, y + Math.floor(h * 0.56) + 4, Math.floor(w * 0.18) - 8, Math.floor(h * 0.36) - 8, GOLD);
  // windows
  fillRect(x + 10, y + Math.floor(h * 0.56), Math.floor(w * 0.18), Math.floor(h * 0.2), SEA);
  fillRect(x + w - 10 - Math.floor(w * 0.18), y + Math.floor(h * 0.56), Math.floor(w * 0.18), Math.floor(h * 0.2), SEA);
  // frame
  fillRect(x, y, w, 3, INK);
  fillRect(x, y + h - 3, w, 3, INK);
  fillRect(x, y, 3, h, INK);
  fillRect(x + w - 3, y, 3, h, INK);
}

// Falling market chart.
function drawChart(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, PAPER);
  // grid
  for (let i = 1; i < 4; i++) {
    hline(x + 8, y + Math.floor((h * i) / 4), w - 16, LIGHT);
  }
  // bars, descending
  const bars = [0.78, 0.66, 0.7, 0.5, 0.56, 0.36, 0.28];
  const bw = Math.floor((w - 24) / bars.length);
  for (let i = 0; i < bars.length; i++) {
    const bh = Math.floor(h * bars[i] * 0.7);
    fillRect(x + 12 + i * bw, y + h - 14 - bh, bw - 6, bh, i < 3 ? GREY : RED);
  }
  // falling line with arrow
  const pts: Array<[number, number]> = [
    [0.08, 0.2], [0.24, 0.34], [0.4, 0.3], [0.56, 0.52], [0.72, 0.6], [0.9, 0.82],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const steps = 24;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      fillCircle(
        x + Math.floor(w * (ax + (bx - ax) * t)),
        y + Math.floor(h * (ay + (by - ay) * t)),
        2,
        RED,
      );
    }
  }
  const ex = x + Math.floor(w * 0.9);
  const ey = y + Math.floor(h * 0.82);
  fillTriangle(ex - 12, ey - 14, ex + 6, ey + 2, ex - 2, ey - 2, RED);
  // frame
  fillRect(x, y, w, 3, INK);
  fillRect(x, y + h - 3, w, 3, INK);
  fillRect(x, y, 3, h, INK);
  fillRect(x + w - 3, y, 3, h, INK);
}

// ---- page layout ----
const M = 28; // margin
const RIGHT = 1024 - M;

function drawMasthead(): void {
  drawTextCentered(512, 24, "THE WORLD", 12, INK);
  fillRect(M, 116, RIGHT - M, 4, RED);
  fillRect(M, 124, RIGHT - M, 2, INK);
  drawTextCentered(512, 136, "WEDNESDAY 25 NOVEMBER 2026", 3, INK);
  fillRect(M, 168, RIGHT - M, 5, INK);
  fillRect(M, 176, RIGHT - M, 2, INK);
}

function drawLead(): void {
  const x = M;
  const w = 612;
  drawText(x, 192, "STRAIT OF HORMUZ", 3, RED);
  drawText(x, 222, "TANKERS ABLAZE", 6, INK);
  drawText(x, 270, "IN HORMUZ", 6, INK);
  drawBlock(
    x,
    326,
    "Two oil tankers struck naval mines, exploded and caught fire in the Strait of Hormuz on Wednesday, Iran's Revolutionary Guards Navy said. Tehran warned ships to coordinate their passage. Brent crude fell to about $90.97 a barrel.",
    2,
    w,
    INK,
    4,
  );
  drawTanker(x, 424, w, 172);
}

function drawHuawei(): void {
  const x = 664;
  const w = 332;
  drawText(x, 192, "NEW YORK", 3, RED);
  drawText(x, 220, "HUAWEI GUILTY", 4, INK);
  drawText(x, 252, "IN U.S. FRAUD", 4, INK);
  drawText(x, 284, "TRIAL", 4, INK);
  drawCourthouse(x, 324, w, 150);
  drawBlock(
    x,
    486,
    "A New York jury found Huawei guilty on 10 of 12 counts, including bank fraud, wire fraud and sanctions violations. Sentencing: 14 September 2027.",
    2,
    w,
    INK,
    4,
  );
}

function drawBottomStory(
  x: number,
  w: number,
  kicker: string,
  headline: string,
  standfirst: string,
  art: (x: number, y: number, w: number, h: number) => void,
): void {
  drawText(x, 620, kicker, 2, RED);
  const afterHead = drawBlock(x, 644, headline, 3, w, INK, 4);
  void afterHead;
  const artY = 752;
  art(x, artY, w, 100);
  drawBlock(x, 860, standfirst, 2, w, INK, 4);
}

function drawBottomRow(): void {
  fillRect(M, 612, RIGHT - M, 3, INK);
  const colW = 234;
  const xs = [28, 272, 516, 760];
  // column dividers
  for (const gx of [267, 511, 755]) {
    vline(gx, 620, 368, LIGHT);
  }
  drawBottomStory(
    xs[0],
    colW,
    "SPACE",
    "PAKISTAN REACHES ORBIT",
    "China's Shenzhou-24 docked with Tiangong carrying Muhammad Zeeshan Ali, 40, the first Pakistani in orbit.",
    drawRocket,
  );
  drawBottomStory(
    xs[1],
    colW,
    "UKRAINE WAR",
    "UKRAINE SINKS RUSSIAN WARSHIP OFF LIBYA",
    "Ukrainian sea drones sank the Russian corvette Merkury off Benghazi, Libya. Two Libyan soldiers later died of wounds.",
    drawWarship,
  );
  drawBottomStory(
    xs[2],
    colW,
    "COLOMBIA",
    "ALL HOSTAGES FREED IN CARTAGENA",
    "Colombian forces stormed a Cartagena supermarket and freed all the hostages after a day-long siege. One assailant was killed.",
    drawMarket,
  );
  drawBottomStory(
    xs[3],
    colW,
    "MARKETS",
    "ASIAN TECH SHARES TUMBLE",
    "Asian tech shares tumbled on doubts over the AI boom. The Nikkei fell 2.8%, Korean shares lost over 6% and SoftBank slid about 15%.",
    drawChart,
  );
}

function drawFooter(): void {
  drawTextCentered(
    512,
    1004,
    "Sources: Reuters and CNN - All events of Wednesday 25 November 2026",
    2,
    GREY,
  );
}

function main(): void {
  fillRect(0, 0, W, H, PAPER);
  drawMasthead();
  drawLead();
  drawHuawei();
  drawBottomRow();
  drawFooter();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.png"), encodePng());
}

main();
