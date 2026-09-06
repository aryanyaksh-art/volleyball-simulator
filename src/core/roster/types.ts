export type PlayerRole = 'S' | 'OPP' | 'OH' | 'MB' | 'L' | 'DS';

export interface RosterPlayer {
  id: string;
  name: string;
  number: number;
  primaryRole: PlayerRole;
  secondaryRoles?: PlayerRole[];
  handedness: 'R' | 'L';
  heightM?: number;
  standingReachM?: number;
  approachJumpM?: number;
}

export interface Roster {
  id: string;
  name: string;
  players: RosterPlayer[];
}

export const findPlayer = (roster: Roster, playerId: string | null | undefined): RosterPlayer | undefined =>
  playerId == null ? undefined : roster.players.find((p) => p.id === playerId);

export const hasRole = (player: RosterPlayer | undefined, role: PlayerRole): boolean =>
  player != null && (player.primaryRole === role || (player.secondaryRoles?.includes(role) ?? false));
