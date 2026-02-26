import { describe, expect, it } from 'vitest';
import { assignRoles } from '../src/gameEngine';

describe('assignRoles', () => {
  it('assigns expected count', () => {
    const roles = assignRoles(['a','b','c','d','e','f','g','h'], 2, true, true);
    const vals = Object.values(roles);
    expect(vals.filter(v => v === 'werewolf')).toHaveLength(2);
    expect(vals.filter(v => v === 'seer')).toHaveLength(1);
    expect(vals.filter(v => v === 'doctor')).toHaveLength(1);
  });
});
