export function welcomeLine(name: string | null): string {
  const first = name?.trim().split(/\s+/)[0];
  return first ? `Welcome, ${first}` : 'Welcome';
}
