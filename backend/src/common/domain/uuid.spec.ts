import { uuidv7 } from './uuid';

describe('uuidv7', () => {
  it('is a valid version 7, RFC variant UUID', () => {
    expect(uuidv7()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('encodes the timestamp so ids sort by creation time', () => {
    const at = Date.UTC(2026, 9, 3, 12, 0, 0);
    const id = uuidv7(at);
    expect(parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(at);
    expect(uuidv7(at) < uuidv7(at + 1)).toBe(true);
  });
});
