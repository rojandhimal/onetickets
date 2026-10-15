import { describe, expect, it } from 'vitest';
import { toPlainLine, toPlainText } from './plain-text.js';

describe('toPlainText', () => {
  it('removes tags and comments but keeps their text', () => {
    expect(toPlainText('<p>Bring <b>clay</b></p><script>alert(1)</script><!-- hi -->')).toBe(
      'Bring clayalert(1)',
    );
    expect(toPlainText('<img src=x onerror=alert(1)>Hello')).toBe('Hello');
  });

  it('leaves nothing a parser could read as markup, however tags are nested or split', () => {
    expect(toPlainText('<scr<script>ipt>alert(1)</scr</script>ipt>')).toBe('alert(1)');
    expect(toPlainText('<<b>img src=x onerror=alert(1)>Hi')).toBe('Hi');
    expect(toPlainText('<img src=x onerror=alert(1)//')).toBe('img src=x onerror=alert(1)//');
    expect(toPlainText('<\u200Bscript>alert(1)</\u202Escript>')).toBe('alert(1)');
    expect(toPlainText('<<<a>a>a>x')).toBe('x');
    expect(toPlainText('<<b>img src=x onerror=1>Hi')).toBe('Hi');
    // Reassembles into `<!-->`, read as an unclosed comment: everything after it goes too.
    expect(toPlainText('<!-<!---->->Hi')).toBe('');
    expect(toPlainText('<!<!-- -->-- --><?php ?></>')).not.toMatch(/<[a-zA-Z/!?]/);
  });

  it('never outputs a tag opener for any mix of markup characters', () => {
    const alphabet = ['<', '>', '/', '!', '?', '-', 's', 'b', ' ', '\u200B', '\n', '<!--', '-->'];
    let seed = 42;
    const next = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31);
    for (let run = 0; run < 5_000; run++) {
      const length = next() % 24;
      const input = Array.from({ length }, () => alphabet[next() % alphabet.length]).join('');
      expect(toPlainText(input), JSON.stringify(input)).not.toMatch(/<[a-zA-Z/!?]/);
      expect(toPlainLine(input), JSON.stringify(input)).not.toMatch(/<[a-zA-Z/!?]/);
    }
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

  it('keeps names on one line with no spoofing characters', () => {
    expect(toPlainLine('Free gig \u202Egpj.exe')).toBe('Free gig gpj.exe');
    expect(toPlainLine('Pot\u200Btery\u200D <b>night</b>\n\n with  friends\t')).toBe(
      'Pottery night with friends',
    );
  });
});
