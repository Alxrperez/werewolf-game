import { z } from 'zod';

export const RoleSchema = z.enum(['werewolf', 'villager', 'seer', 'doctor']);
export type Role = z.infer<typeof RoleSchema>;

export const LobbyPhaseSchema = z.enum(['lobby', 'night', 'day', 'ended']);
export type LobbyPhase = z.infer<typeof LobbyPhaseSchema>;

export const TeamSchema = z.enum(['villagers', 'werewolves']);
export type Team = z.infer<typeof TeamSchema>;

export const GameSettingsSchema = z.object({
  werewolves: z.number().int().min(1).max(4),
  seer: z.boolean(),
  doctor: z.boolean()
});
export type GameSettings = z.infer<typeof GameSettingsSchema>;

export const NightSummarySchema = z.object({
  eliminatedUid: z.string().nullable(),
  seerTargetUid: z.string().nullable(),
  seerSawWerewolf: z.boolean().nullable()
});
export type NightSummary = z.infer<typeof NightSummarySchema>;

export const LobbySchema = z.object({
  hostUid: z.string().min(1),
  phase: LobbyPhaseSchema,
  settings: GameSettingsSchema,
  dayNumber: z.number().int().min(1).default(1),
  winner: TeamSchema.nullable().default(null),
  lastNight: NightSummarySchema.nullable().default(null),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative()
});
export type Lobby = z.infer<typeof LobbySchema>;

export const LobbyPlayerSchema = z.object({
  uid: z.string().min(1),
  displayName: z.string().min(1).max(40),
  isHost: z.boolean(),
  isReady: z.boolean(),
  alive: z.boolean().default(true),
  joinedAt: z.number().int().nonnegative()
});
export type LobbyPlayer = z.infer<typeof LobbyPlayerSchema>;

export const RoleCardSchema = z.object({
  uid: z.string().min(1),
  role: RoleSchema,
  assignedAt: z.number().int().nonnegative(),
  viewedAt: z.number().int().nonnegative().nullable().default(null)
});
export type RoleCard = z.infer<typeof RoleCardSchema>;

export const NightActionSchema = z.object({
  actorUid: z.string().min(1),
  actionType: z.enum(['wolfKill', 'doctorSave', 'seerCheck']),
  targetUid: z.string().min(1),
  dayNumber: z.number().int().min(1),
  createdAt: z.number().int().nonnegative()
});
export type NightAction = z.infer<typeof NightActionSchema>;

export const DayVoteSchema = z.object({
  voterUid: z.string().min(1),
  targetUid: z.string().min(1),
  dayNumber: z.number().int().min(1),
  createdAt: z.number().int().nonnegative()
});
export type DayVote = z.infer<typeof DayVoteSchema>;

export function parseLobby(input: unknown): Lobby {
  return LobbySchema.parse(input);
}

export function parseLobbyPlayer(input: unknown): LobbyPlayer {
  return LobbyPlayerSchema.parse(input);
}

export function parseRoleCard(input: unknown): RoleCard {
  return RoleCardSchema.parse(input);
}
