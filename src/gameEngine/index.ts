export type Role = 'werewolf' | 'villager' | 'seer' | 'doctor';

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function assignRoles(players: string[], werewolves: number, seer: boolean, doctor: boolean): Record<string, Role> {
  const roleBag: Role[] = [];
  for (let i = 0; i < werewolves; i++) roleBag.push('werewolf');
  if (seer) roleBag.push('seer');
  if (doctor) roleBag.push('doctor');
  while (roleBag.length < players.length) roleBag.push('villager');

  const shuffledRoles = shuffle(roleBag);
  const out: Record<string, Role> = {};
  players.forEach((playerId, i) => {
    out[playerId] = shuffledRoles[i] ?? 'villager';
  });
  return out;
}
