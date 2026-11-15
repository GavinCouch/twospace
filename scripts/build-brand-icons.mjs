import { copyFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const path = (name) => fileURLToPath(new URL(name, root));
const icon = path("public/brand/app-icon.png");

// Keep old public links, web icons, and the native icon on the current artwork.
await copyFile(path("public/brand/logo-dark.png"), path("public/brand/logo.png"));
await copyFile(icon, path("mobile/assets/icon.png"));
for (const [file, size] of [
  ["src/app/icon.png", 192],
  ["src/app/apple-icon.png", 180],
]) {
  await sharp(icon).resize(size, size).png().toFile(path(file));
}

// ICO supports embedded PNG frames; include common browser and desktop sizes.
const sizes = [16, 32, 48, 64];
const frames = await Promise.all(
  sizes.map((size) => sharp(icon).resize(size, size).ensureAlpha().png().toBuffer()),
);
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (const [index, frame] of frames.entries()) {
  const entry = 6 + index * 16;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frame.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
}
await writeFile(path("src/app/favicon.ico"), Buffer.concat([header, ...frames]));
