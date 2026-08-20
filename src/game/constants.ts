export const COURT_WIDTH = 10;
export const COURT_LENGTH = 20;
export const COURT_HALF_W = COURT_WIDTH / 2;
export const COURT_HALF_L = COURT_LENGTH / 2;
export const NET_HEIGHT = 0.88;
export const NET_POST = 0.92;
export const GLASS_HEIGHT = 3;
export const FENCE_HEIGHT = 1;
export const SERVICE_FROM_NET = 3.05;
export const BALL_RADIUS = 0.07;
export const GRAVITY = -15.5;
export const PLAYER_SPEED = 6.4;
export const PLAYER_RADIUS = 0.38;
export const HIT_RANGE = 1.85;
export const FIXED_DT = 1 / 60;

export type PlayerDef = {
  id: number;
  name: string;
  team: 0 | 1;
  user: boolean;
  cap: boolean;
  skin: number;
  hair: number;
};

export const PLAYERS: PlayerDef[] = [
  { id: 0, name: "", team: 0, user: true, cap: false, skin: 0xd4a06a, hair: 0x1a120c },
  { id: 1, name: "Aziz", team: 0, user: false, cap: true, skin: 0xb07a4a, hair: 0x111111 },
  { id: 2, name: "Alex", team: 1, user: false, cap: false, skin: 0xc48a5a, hair: 0x2a1c12 },
  { id: 3, name: "Bruno", team: 1, user: false, cap: true, skin: 0x8d5a38, hair: 0x0e0e0e },
];

export const HOME_POS: [number, number][] = [
  [-2.05, 6.6],
  [2.05, 6.6],
  [-2.05, -6.6],
  [2.05, -6.6],
];

export const POINT_NAMES = ["0", "15", "30", "40"] as const;
