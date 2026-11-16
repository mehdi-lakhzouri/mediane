/**
 * Packages the supplied Mediane artwork without redrawing its lettering.
 * Run `node scripts/prepare-mediane-brand.mjs [source-directory]`.
 * Uses the backend's existing sharp dependency. Sources live in design/brand/source.
 */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir, copyFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "backend/package.json"));
const sharp = require("sharp");
const source = resolve(process.argv[2] ?? resolve(root, "design/brand/source"));
const web = resolve(root, "frontend/apps/web/public/brand");
const mobile = resolve(root, "driver_health_app/assets/images");
await mkdir(web, { recursive: true });
await mkdir(resolve(root, "design/brand/source"), { recursive: true });
for (const file of [
  "mediane-on-light.png",
  "mediane-on-dark.png",
  "mediane-app-icon-blue.png",
]) {
  const destination = resolve(root, "design/brand/source", file);
  if (resolve(source, file) !== destination)
    await copyFile(resolve(source, file), destination);
}

// Remove the flat presentation background, including its antialiasing matte.
// A pixel lies on the line between the background and one of three ink colors.
const { data, info } = await sharp(resolve(source, "mediane-on-dark.png"))
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const background = [...data.subarray(0, 3)];
const frequencies = new Map();
for (let i = 0; i < data.length; i += 3) {
  const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
  frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
}
const inks = [...frequencies.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(1, 4)
  .map(([key]) => key.split(",").map(Number));
const rgba = Buffer.alloc(info.width * info.height * 4);
let left = info.width,
  top = info.height,
  right = 0,
  bottom = 0;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 3;
    const pixel = [data[i], data[i + 1], data[i + 2]];
    let bestError = Infinity,
      bestAlpha = 0,
      bestInk = inks[0];
    for (const ink of inks) {
      const vector = ink.map((value, c) => value - background[c]);
      const alpha = Math.min(
        1,
        Math.max(
          0,
          vector.reduce(
            (sum, v, c) => sum + v * (pixel[c] - background[c]),
            0,
          ) / vector.reduce((sum, v) => sum + v * v, 0),
        ),
      );
      const error = vector.reduce(
        (sum, v, c) => sum + (pixel[c] - background[c] - alpha * v) ** 2,
        0,
      );
      if (error < bestError) {
        bestError = error;
        bestAlpha = alpha;
        bestInk = ink;
      }
    }
    if (bestAlpha < 0.015) continue;
    const j = (y * info.width + x) * 4;
    rgba.set([...bestInk, Math.round(bestAlpha * 255)], j);
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }
}
const bounds = { left, top, width: right - left + 1, height: bottom - top + 1 };
const dark = await sharp(rgba, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .extract(bounds)
  .png()
  .toBuffer();
const lightRaw = Buffer.from(rgba);
for (let i = 0; i < lightRaw.length; i += 4) {
  if (lightRaw[i] > 240 && lightRaw[i + 1] > 240) lightRaw.set([15, 26, 43], i);
  else if (lightRaw[i + 2] > lightRaw[i]) lightRaw.set([29, 169, 196], i);
  else if (lightRaw[i] > 150) lightRaw.set([233, 67, 59], i);
}
const light = await sharp(lightRaw, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .extract(bounds)
  .png()
  .toBuffer();
for (const [name, artwork] of [
  ["mediane-wordmark-light.png", light],
  ["mediane-wordmark-dark.png", dark],
]) {
  const output = await sharp(artwork).resize({ width: 1400 }).png().toBuffer();
  await writeFile(resolve(web, name), output);
  await writeFile(resolve(mobile, name), output);
}

const icon = await readFile(resolve(source, "mediane-app-icon-blue.png"));
await writeFile(resolve(web, "mediane-app-icon.png"), icon);
await writeFile(resolve(mobile, "mediane-app-icon.png"), icon);
await sharp(dark)
  .resize({ width: 900 })
  .png()
  .toFile(resolve(mobile, "mediane-splash.png"));
const saveIcon = async (path, size, opaque = false, maskable = false) => {
  let image = sharp(icon).resize(maskable ? Math.round(size * 0.8) : size);
  if (maskable)
    image = image.extend({
      top: Math.floor(size * 0.1),
      bottom: size - Math.round(size * 0.8) - Math.floor(size * 0.1),
      left: Math.floor(size * 0.1),
      right: size - Math.round(size * 0.8) - Math.floor(size * 0.1),
      background: "#2ca9e9",
    });
  if (opaque || maskable) image = image.flatten({ background: "#2ca9e9" });
  await image.png().toFile(resolve(root, path));
};

await saveIcon("frontend/apps/web/app/apple-icon.png", 180, true);
await saveIcon("frontend/apps/web/app/icon.png", 192);
await saveIcon("driver_health_app/web/favicon.png", 32);
for (const size of [192, 512]) {
  await saveIcon(`driver_health_app/web/icons/Icon-${size}.png`, size);
  await saveIcon(
    `driver_health_app/web/icons/Icon-maskable-${size}.png`,
    size,
    true,
    true,
  );
}
for (const [density, size] of [
  ["mdpi", 48],
  ["hdpi", 72],
  ["xhdpi", 96],
  ["xxhdpi", 144],
  ["xxxhdpi", 192],
]) {
  await saveIcon(
    `driver_health_app/android/app/src/main/res/mipmap-${density}/ic_launcher.png`,
    size,
  );
}
for (const platform of ["ios", "macos"]) {
  const directory = `driver_health_app/${platform}/Runner/Assets.xcassets/AppIcon.appiconset`;
  const catalog = JSON.parse(
    await readFile(resolve(root, directory, "Contents.json"), "utf8"),
  );
  for (const item of catalog.images) {
    if (!item.filename) continue;
    const size = Math.round(parseFloat(item.size) * parseFloat(item.scale));
    await saveIcon(`${directory}/${item.filename}`, size, platform === "ios");
  }
}

// ICO files can contain PNG payloads; keep all common Windows/browser sizes.
const ico = async (path) => {
  const sizes = [16, 32, 48, 256];
  const frames = await Promise.all(
    sizes.map((size) => sharp(icon).resize(size).png().toBuffer()),
  );
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  frames.forEach((frame, index) => {
    const entry = 6 + index * 16,
      size = sizes[index];
    header[entry] = size % 256;
    header[entry + 1] = size % 256;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(frame.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += frame.length;
  });
  await writeFile(resolve(root, path), Buffer.concat([header, ...frames]));
};
await ico("frontend/apps/web/app/favicon.ico");
await ico("driver_health_app/windows/runner/resources/app_icon.ico");

const banner = await sharp({
  create: { width: 1200, height: 400, channels: 3, background: "#0b1827" },
})
  .composite([
    {
      input: await sharp(dark).resize({ width: 700 }).toBuffer(),
      gravity: "centre",
    },
  ])
  .jpeg({ quality: 92 })
  .toBuffer();
await writeFile(
  resolve(
    root,
    "backend/src/modules/mail/infrastructure/templates/assets/mediane-email-banner.jpg",
  ),
  banner,
);
// Captures come from the real Flutter widgets, never from an edited mockup.
// CABINGUARD_CAPTURE_DIR=../design/brand/previews/mobile flutter test -t promo test/promo/video_assets_test.dart
for (const screen of ["home", "notifications"]) {
  const capture = resolve(
    root,
    `design/brand/previews/mobile/mobile-${screen}.png`,
  );
  if (
    await access(capture).then(
      () => true,
      () => false,
    )
  ) {
    await sharp(capture)
      .resize({ width: 590 })
      .webp({ quality: 90 })
      .toFile(
        resolve(root, `frontend/apps/web/public/landing/app-${screen}.webp`),
      );
  }
}
console.log(
  `Packaged Mediane wordmarks (${bounds.width}×${bounds.height}), app icons and email banner.`,
);
