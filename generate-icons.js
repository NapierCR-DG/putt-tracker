const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

async function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Fill with app background color
  ctx.fillStyle = '#0f1117';
  ctx.fillRect(0, 0, size, size);

  // Load SVG and fix width/height for canvas library compatibility
  const svgPath = path.join(__dirname, 'pt_disc_golf_logo_v4.svg');
  let svgContent = fs.readFileSync(svgPath, 'utf8');
  svgContent = svgContent.replace('width="100%"', 'width="680" height="400"');

  const svgBuffer = Buffer.from(svgContent);
  const img = await loadImage(svgBuffer);

  // Fit the SVG centered in the square with padding
  const padding = size * 0.08;
  const available = size - padding * 2;

  // SVG is 680x400 (1.7:1 aspect ratio) — width is constraining in a square
  const svgAspect = 680 / 400;
  const drawW = available;
  const drawH = drawW / svgAspect;

  const x = (size - drawW) / 2;
  const y = (size - drawH) / 2;

  ctx.drawImage(img, x, y, drawW, drawH);

  return canvas.toBuffer('image/png');
}

(async () => {
  const sizes = [192, 512];
  for (const size of sizes) {
    const buffer = await generateIcon(size);
    const outPath = path.join(__dirname, 'icons', `icon-${size}.png`);
    fs.writeFileSync(outPath, buffer);
    console.log(`Generated ${outPath} (${buffer.length} bytes)`);
  }
  console.log('Done!');
})();
