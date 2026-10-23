import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

/** Modules of quiet zone around the code; scanners want four. */
const QUIET = 4;

/** One path of dark modules: `M x y h1v1h-1z` per module. Drawn here, never injected as HTML. */
export function qrPath(text: string): { size: number; d: string } {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const count = qr.getModuleCount();
  let d = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) d += `M${col + QUIET} ${row + QUIET}h1v1h-1z`;
    }
  }
  return { size: count + QUIET * 2, d };
}

/** A QR code as an SVG, black on white, sized by its container. */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { size, d } = useMemo(() => qrPath(value), [value]);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      width="100%"
      height="100%"
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={d} fill="#000000" />
    </svg>
  );
}
