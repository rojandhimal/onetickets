import { describe, expect, it } from 'vitest';
import { can, canGrant } from './roles.js';

describe('roles', () => {
  it('keeps door staff away from money and payouts', () => {
    expect(can('door_staff', 'viewMoney')).toBe(false);
    expect(can('door_staff', 'managePayouts')).toBe(false);
    expect(can('door_staff', 'scanTickets')).toBe(true);
  });

  it('limits payouts to owners and finance', () => {
    expect(can('owner', 'managePayouts')).toBe(true);
    expect(can('finance', 'managePayouts')).toBe(true);
    expect(can('admin', 'managePayouts')).toBe(false);
  });

  it('lets only owners grant owner or finance', () => {
    expect(canGrant('owner', 'finance')).toBe(true);
    expect(canGrant('admin', 'finance')).toBe(false);
    expect(canGrant('admin', 'owner')).toBe(false);
    expect(canGrant('admin', 'door_staff')).toBe(true);
    expect(canGrant('finance', 'door_staff')).toBe(false);
  });
});
