import { describe, it, expect, vi } from 'vitest';

vi.mock('mammoth', () => ({
  default: {
    convertToHtml: vi.fn().mockResolvedValue({
      value: '<p>Test content</p>',
      messages: [],
    }),
  },
}));

import { convertDocxToHtml } from '../import-pipeline';

describe('convertDocxToHtml', () => {
  it('should return html and warnings from mammoth conversion', async () => {
    const buffer = new ArrayBuffer(8);
    const result = await convertDocxToHtml(buffer);
    expect(result.html).toBe('<p>Test content</p>');
    expect(result.warnings).toEqual([]);
  });

  it('should pass style map to mammoth', async () => {
    const mammoth = await import('mammoth');
    const buffer = new ArrayBuffer(8);
    await convertDocxToHtml(buffer);
    expect(mammoth.default.convertToHtml).toHaveBeenCalledWith(
      { arrayBuffer: buffer },
      expect.objectContaining({ styleMap: expect.any(Array) })
    );
  });
});
