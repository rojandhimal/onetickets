import { describe, expect, it } from 'vitest';
import { toPlainText } from './plain-text.js';

describe('toPlainText', () => {
  it('removes tags and comments but keeps their text', () => {
    expect(toPlainText('<p>Bring <b>clay</b></p><script>alert(1)</script><!-- hi -->')).toBe(
      'Bring clayalert(1)',
    );
    expect(toPlainText('<img src=x onerror=alert(1)>Hello')).toBe('Hello');
  });

  it('keeps everyday angle brackets and ampersands', () => {
    expect(toPlainText('Kids < 12 free & adults > 18 pay <3')).toBe(
      'Kids < 12 free & adults > 18 pay <3',
    );
  });

  it('drops control, zero-width and direction-override characters', () => {
    expect(toPlainText('a\u0000b\u200Bc\u202Ed\uFEFFe')).toBe('abcde');
  });

  it('keeps paragraphs but no more than one blank line', () => {
    expect(toPlainText('  One\r\n\r\n\r\n\r\nTwo  \nThree\t \n')).toBe('One\n\nTwo\nThree');
  });
});
