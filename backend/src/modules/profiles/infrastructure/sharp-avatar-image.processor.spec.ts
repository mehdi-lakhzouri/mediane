import sharp from 'sharp';
import { SharpAvatarImageProcessor } from './sharp-avatar-image.processor';

function photo(
  width: number,
  height: number,
  format: 'jpeg' | 'png' | 'gif' = 'jpeg',
): sharp.Sharp {
  return sharp({
    create: { width, height, channels: 3, background: '#2a7fc0' },
  }).toFormat(format);
}

describe('SharpAvatarImageProcessor', () => {
  const processor = new SharpAvatarImageProcessor();

  it('re-encodes to a 512×512 WebP and drops every metadata block, GPS included', async () => {
    const withGps = await photo(1200, 800)
      .withExif({
        IFD0: { Make: 'PhoneMaker', Model: 'X' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '36/1 48/1 0/1' },
      })
      .toBuffer();
    expect((await sharp(withGps).metadata()).exif).toBeDefined();

    const result = await processor.process(withGps);
    const out = await sharp(result.data).metadata();

    expect(result.contentType).toBe('image/webp');
    expect(out.format).toBe('webp');
    expect([out.width, out.height]).toEqual([512, 512]);
    expect(out.exif).toBeUndefined();
    expect(out.xmp).toBeUndefined();
  });

  it('bakes the EXIF orientation into the pixels instead of passing the tag on', async () => {
    // Left half red, right half blue, stored with orientation 6 (rotate 90° CW):
    // once applied, red ends up on TOP. A client that applied the tag again
    // would show the photo sideways.
    const halves = await sharp({
      create: { width: 600, height: 300, channels: 3, background: 'blue' },
    })
      .composite([
        {
          input: {
            create: {
              width: 300,
              height: 300,
              channels: 3,
              background: 'red',
            },
          },
          left: 0,
          top: 0,
        },
      ])
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const result = await processor.process(halves);
    const out = sharp(result.data);
    expect((await out.metadata()).orientation).toBeUndefined();

    const { data, info } = await out
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => {
      const i = (y * info.width + x) * info.channels;
      return { r: data[i], b: data[i + 2] };
    };
    expect(pixel(256, 20).r).toBeGreaterThan(200); // top: red
    expect(pixel(256, 490).b).toBeGreaterThan(200); // bottom: blue
  });

  it('accepts PNG input', async () => {
    const png = await photo(300, 300, 'png').toBuffer();
    expect((await processor.process(png)).contentType).toBe('image/webp');
  });

  it('judges the bytes, not the name: rejects non-images and unsupported formats', async () => {
    const script = Buffer.from('<script>alert(1)</script>');
    await expect(processor.process(script)).rejects.toMatchObject({
      code: 'INVALID_IMAGE',
    });
    const gif = await photo(300, 300, 'gif').toBuffer();
    await expect(processor.process(gif)).rejects.toMatchObject({
      details: [
        { field: 'avatar', message: 'must be a JPEG, PNG or WebP image' },
      ],
    });
  });

  it('rejects images too small to be a usable photo', async () => {
    const tiny = await photo(64, 64).toBuffer();
    await expect(processor.process(tiny)).rejects.toMatchObject({
      details: [
        { field: 'avatar', message: 'must be at least 128×128 pixels' },
      ],
    });
  });
});
