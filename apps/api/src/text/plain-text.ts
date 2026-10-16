// C0 and C1 control characters except tab (09) and newline (0A).
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
// Zero-width characters, bidirectional marks and overrides, word joiners and the BOM.
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;

// Comments and complete tags, including ones split by other tags (`<scr<b>ipt>`).
const COMMENT = /<!--[\s\S]*?(-->|$)/g;
const TAG = /<\/?[a-zA-Z][^<>]*>/g;
// Whatever an HTML parser could still read as the start of markup: `<` before a letter, `/`, `!`
// or `?`, closed or not.
const MARKUP_START = /<(?=[a-zA-Z/!?])/g;

/**
 * Event descriptions are plain text (SEC-3). The web renders them as text, so markup can't run
 * there; this also keeps it out of emails, link previews and anything else that reads the field
 * later.
 *
 * Plain text allows no markup at all, so the rule is an allowlist of one: the result never holds
 * a `<` that a parser could read as a tag, comment or declaration. Control, zero-width and
 * direction-override characters go first, so removing them can't join a tag back together. Tags
 * and comments are then stripped (their text stays) and leftover tag openers dropped, repeating
 * until nothing changes, so nested pieces like `<scr<script>ipt>` can't reassemble. Everyday
 * text such as `Kids < 12` or `<3` is kept.
 */
export function toPlainText(input: string): string {
  let text = input.replace(/\r\n?/g, '\n').replace(CONTROL, '').replace(INVISIBLE, '');
  for (let previous = ''; text !== previous;) {
    previous = text;
    text = text.replace(COMMENT, '').replace(TAG, '');
    if (text === previous) text = text.replace(MARKUP_START, '');
  }
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Single-line public text (organisation, event and ticket type names, venue names and addresses):
 * the same clean-up as toPlainText, with line breaks and tabs collapsed into single spaces.
 * Shared by every module, so it lives outside them. Migration 0007 repeats it in SQL once, to
 * clean organisation names stored before it applied.
 */
export function toPlainLine(input: string): string {
  return toPlainText(input).replace(/\s+/g, ' ');
}
