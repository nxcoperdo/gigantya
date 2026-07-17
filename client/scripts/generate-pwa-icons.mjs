// Genera los íconos de la PWA a partir de public/favicon.jpg (512x512).
// Usa Jimp (JS puro, sin deps nativas) para que corra igual en Windows.
//
// Salidas (en public/icons/ + public/):
//   · pwa-192.png        → ícono estándar (purpose "any")
//   · pwa-512.png        → ícono estándar grande (purpose "any")
//   · maskable-512.png   → ícono "maskable": logo centrado sobre fondo de
//                          marca con zona segura (Android recorta a círculo)
//   · apple-touch-icon.png (180) → ícono de "Agregar a inicio" en iOS
//
// Correr:  node scripts/generate-pwa-icons.mjs
import { Jimp } from 'jimp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const iconsDir = join(publicDir, 'icons');
const SRC = join(publicDir, 'favicon.jpg');

// Color de marca (theme_color). Formato RGBA de Jimp.
const BRAND = 0xc94b3bff;

async function run() {
  await mkdir(iconsDir, { recursive: true });

  // --- Íconos "any": logo escalado directo ---
  for (const size of [192, 512]) {
    const img = await Jimp.read(SRC);
    img.resize({ w: size, h: size });
    await img.write(join(iconsDir, `pwa-${size}.png`));
    console.log(`✓ pwa-${size}.png`);
  }

  // --- Apple touch icon (iOS no recorta; fondo opaco) ---
  {
    const img = await Jimp.read(SRC);
    img.resize({ w: 180, h: 180 });
    await img.write(join(publicDir, 'apple-touch-icon.png'));
    console.log('✓ apple-touch-icon.png');
  }

  // --- Maskable: logo al 70% centrado sobre fondo de marca ---
  // Android recorta el ícono a distintas formas (círculo, squircle...).
  // Dejar ~15% de margen a cada lado mantiene el logo dentro de la zona
  // segura y evita que se corte.
  {
    const CANVAS = 512;
    const LOGO = Math.round(CANVAS * 0.7); // 358px
    const offset = Math.round((CANVAS - LOGO) / 2);
    const bg = new Jimp({ width: CANVAS, height: CANVAS, color: BRAND });
    const logo = await Jimp.read(SRC);
    logo.resize({ w: LOGO, h: LOGO });
    bg.composite(logo, offset, offset);
    await bg.write(join(iconsDir, 'maskable-512.png'));
    console.log('✓ maskable-512.png');
  }

  console.log('\nListo. Íconos PWA generados en public/icons/.');
}

run().catch((err) => {
  console.error('Error generando íconos:', err);
  process.exit(1);
});
