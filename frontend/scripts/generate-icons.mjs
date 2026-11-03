// One-off icon generator: derives favicon/PWA/touch-icon assets from the
// master brand mark (frontend/public/brand/pepper-mark-1024.png). Re-run
// with `node scripts/generate-icons.mjs` whenever the master logo changes.
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const master = path.join(root, "public/brand/pepper-mark-1024.png");
const publicDir = path.join(root, "public");
const tmpDir = path.join(root, ".icon-tmp");

async function resize(size, outPath) {
  await sharp(master).resize(size, size).png().toFile(outPath);
}

async function main() {
  await mkdir(tmpDir, { recursive: true });

  // Favicon .ico (16/32/48 multi-resolution)
  const sizes = [16, 32, 48];
  const favTmpPaths = [];
  for (const size of sizes) {
    const p = path.join(tmpDir, `favicon-${size}.png`);
    await resize(size, p);
    favTmpPaths.push(p);
  }
  const icoBuffer = await pngToIco(favTmpPaths);
  await writeFile(path.join(publicDir, "favicon.ico"), icoBuffer);

  // favicon.svg: raster mark embedded in an SVG wrapper so browsers that
  // request an SVG favicon get a crisp result without relying on a vector
  // trace of the glyph (no vector source exists for this mark).
  const faviconSvgSource = path.join(tmpDir, "favicon-256.png");
  await resize(256, faviconSvgSource);
  const b64 = (await sharp(faviconSvgSource).png().toBuffer()).toString("base64");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><image width="256" height="256" href="data:image/png;base64,${b64}"/></svg>\n`;
  await writeFile(path.join(publicDir, "favicon.svg"), svg);

  // Apple touch icon (iOS applies its own corner rounding, so square source)
  await resize(180, path.join(publicDir, "apple-touch-icon.png"));

  // PWA icons
  await resize(192, path.join(publicDir, "brand/pwa-192.png"));
  await resize(512, path.join(publicDir, "brand/pwa-512.png"));

  // Maskable 512: glyph bounding box measured at ~22-30% margin on all
  // sides of the 1024 source, comfortably inside the 80% safe zone, so the
  // same full-bleed square is safe to reuse as the maskable source.
  await resize(512, path.join(publicDir, "brand/pwa-512-maskable.png"));

  await rm(tmpDir, { recursive: true, force: true });
  console.log("Icons generated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
