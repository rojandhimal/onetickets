// C0 and C1 control characters except tab (09) and newline (0A).
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
// Zero-width characters, bidirectional marks and overrides, word joiners and the BOM.
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;

/**
 * Event descriptions are plain text (SEC-3). The web renders them as text, so markup can't run
 * there; this also keeps it out of emails, link previews and anything else that reads the field
 * later. Strips anything that looks like an HTML tag or comment, control characters other than
 * tab and newline, zero-width characters and bidirectional overrides (which can disguise text),
 * then tidies line breaks.
 */
export function toPlainText(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?(-->|$)/g, '')
    .replace(/<\/?[a-zA-Z][^<>]*>/g, '')
    .replace(CONTROL, '')
    .replace(INVISIBLE, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
