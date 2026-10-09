export function Logo() {
  return (
    <span className="brand">
      <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect x="1" y="5" width="26" height="18" rx="5" fill="var(--marigold)" />
        <circle cx="1" cy="14" r="3.5" fill="var(--ink)" />
        <circle cx="27" cy="14" r="3.5" fill="var(--ink)" />
        <path d="M14 9v10" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className="brand-name">
        OneTickets <span className="brand-sub">for organisers</span>
      </span>
    </span>
  );
}
