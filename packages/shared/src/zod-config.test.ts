import { describe, expect, it, vi } from 'vitest';

describe('zod config', () => {
  it('never probes for eval when the package loads and parses', async () => {
    vi.resetModules();
    const probe = vi.spyOn(globalThis, 'Function');
    const shared = await import('./index.js');
    shared.createOrganisationRequest.parse({ name: 'The Print Shed' });
    expect(probe).not.toHaveBeenCalled();
    probe.mockRestore();
  });
});
