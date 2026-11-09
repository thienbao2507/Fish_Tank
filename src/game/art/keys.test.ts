import { describe, expect, it } from 'vitest';
import { rawContent } from '../../core/content/raw';
import { TextureKeys } from './keys';

describe('TextureKeys', () => {
  it.each(Object.values(TextureKeys))('%s có trong art.json', (key) => {
    expect(rawContent.art).toHaveProperty(['textures', key]);
  });
});
