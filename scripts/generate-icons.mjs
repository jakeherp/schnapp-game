// Regenerates the PWA app icons. Run with: node scripts/generate-icons.mjs
import { ImageResponse } from "next/og.js";
import { createElement as h } from "react";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.join(PROJECT_ROOT, "public");
const APP_ROOT = path.join(PROJECT_ROOT, "app");
const BRAND_GREEN = "#059669"; // emerald-600, matches the app's buttons/accent

// A simple geometric frog face — avoids relying on emoji glyph rendering
// (which needs a font/CDN fetch), so it renders identically everywhere.
function frogFace(size, { safeZonePadding = 0, cornerRadius = 0 } = {}) {
  const inner = size - safeZonePadding * 2;
  const eyeSize = inner * 0.24;
  const pupilSize = eyeSize * 0.44;
  const eyeY = inner * 0.24;
  const eyeOffsetX = inner * 0.16;
  const mouthWidth = inner * 0.42;
  const mouthHeight = inner * 0.22;

  const eye = (side) =>
    h(
      "div",
      {
        style: {
          position: "absolute",
          top: eyeY,
          [side]: inner / 2 - eyeOffsetX - eyeSize / 2,
          width: eyeSize,
          height: eyeSize,
          borderRadius: "50%",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
      },
      h("div", {
        style: {
          width: pupilSize,
          height: pupilSize,
          borderRadius: "50%",
          background: "#064e3b",
        },
      })
    );

  return h(
    "div",
    {
      style: {
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_GREEN,
        borderRadius: cornerRadius,
      },
    },
    h(
      "div",
      {
        style: {
          position: "relative",
          width: inner,
          height: inner,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
      },
      eye("left"),
      eye("right"),
      // Flat top / rounded bottom = a "⌣" smile arc, a standard flat-icon trick.
      h("div", {
        style: {
          position: "absolute",
          top: inner * 0.58,
          width: mouthWidth,
          height: mouthHeight,
          borderRadius: `0 0 ${mouthWidth}px ${mouthWidth}px`,
          background: "#ffffff",
          opacity: 0.92,
        },
      })
    )
  );
}

async function renderPngBuffer(node, size) {
  const res = new ImageResponse(node, { width: size, height: size });
  return Buffer.from(await res.arrayBuffer());
}

async function renderPng(node, size, outPath) {
  const buf = await renderPngBuffer(node, size);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, buf);
  console.log("wrote", outPath, `${buf.length} bytes`);
}

// .ico is a container format; since Vista it can hold plain PNG data per
// entry, so we can pack our generated PNGs into a multi-resolution favicon
// without any image-conversion library.
function packIco(entries) {
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  entries.forEach(({ size, png }, i) => {
    const base = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, base + 0); // width
    dir.writeUInt8(size >= 256 ? 0 : size, base + 1); // height
    dir.writeUInt8(0, base + 2); // color count
    dir.writeUInt8(0, base + 3); // reserved
    dir.writeUInt16LE(1, base + 4); // planes
    dir.writeUInt16LE(32, base + 6); // bit depth
    dir.writeUInt32LE(png.length, base + 8); // data size
    dir.writeUInt32LE(offset, base + 12); // data offset
    offset += png.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

async function renderIco(node, sizes, outPath) {
  const entries = [];
  for (const size of sizes) {
    entries.push({ size, png: await renderPngBuffer(node(size), size) });
  }
  const buf = packIco(entries);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, buf);
  console.log("wrote", outPath, `${buf.length} bytes`);
}

await renderPng(
  frogFace(192, { cornerRadius: 192 * 0.22 }),
  192,
  path.join(ROOT, "icons/icon-192.png")
);
await renderPng(
  frogFace(512, { cornerRadius: 512 * 0.22 }),
  512,
  path.join(ROOT, "icons/icon-512.png")
);
// Maskable: full-bleed square, no baked-in rounding — the OS applies its own
// mask, and content stays padded into the safe zone so nothing gets clipped.
await renderPng(
  frogFace(512, { safeZonePadding: 512 * 0.1 }),
  512,
  path.join(ROOT, "icons/icon-maskable-512.png")
);
// Apple touch icon: iOS applies its own corner rounding and wants a fully
// opaque square — our design already has no transparency.
await renderPng(
  frogFace(180, { cornerRadius: 180 * 0.22 }),
  180,
  path.join(ROOT, "apple-touch-icon.png")
);
// Browser-tab favicon, matching the PWA/home-screen icon design.
await renderIco(
  (size) => frogFace(size, { cornerRadius: size * 0.22 }),
  [16, 32, 48],
  path.join(APP_ROOT, "favicon.ico")
);

console.log("done");
