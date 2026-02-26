export type Role = 'werewolf' | 'villager' | 'seer' | 'doctor';
export function assignRoles(players: string[], werewolves: number, seer: boolean, doctor: boolean): Record<string, Role> {
  const roles: Role[] = [];
  for (let i = 0; i < werewolves; i++) roles.push('werewolf');
  if (seer) roles.push('seer');
  if (doctor) roles.push('doctor');
  while (roles.length < players.length) roles.push('villager');
  const out: Record<string, Role> = {};
  players.forEach((p, i) => { out[p] = roles[i]; });
  return out;
}
