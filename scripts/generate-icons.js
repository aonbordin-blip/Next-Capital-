import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Next Capital Logo SVG (500x500 viewBox)
const bluePath = `
  M 112 72
  L 416 72
  L 398 138
  L 332 138
  L 286 264
  L 240 138
  L 160 138
  L 102 348
  L 38 348
  Z
`;

// Standard brand SVG
const svgBrand = `
<svg width="512" height="512" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="500" height="500" rx="90" fill="#ffffff" />
  <path d="${bluePath}" fill="#1C449C" />
  <path d="${bluePath}" fill="#F5A81C" transform="rotate(180 250 250)" />
</svg>
`;

// Maskable icon with safe zone (central 80% circle, 15% padding)
const svgMaskable = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#ffffff" />
  <g transform="translate(68, 68) scale(0.75)">
    <path d="${bluePath}" fill="#1C449C" />
    <path d="${bluePath}" fill="#F5A81C" transform="rotate(180 250 250)" />
  </g>
</svg>
`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgBrand.trim());
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgBrand.trim());

async function run() {
  const brandBuffer = Buffer.from(svgBrand);
  const maskableBuffer = Buffer.from(svgMaskable);

  // 192x192
  await sharp(brandBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));

  // 512x512
  await sharp(brandBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));

  // 512x512 Maskable
  await sharp(maskableBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));

  // Apple Touch Icon (180x180)
  await sharp(brandBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // Favicon 64x64 ico/png
  await sharp(brandBuffer)
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));

  console.log('All PWA icons successfully generated in /public/');
}

run().catch(console.error);
