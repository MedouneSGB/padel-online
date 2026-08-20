export type ShotType = "lob" | "smash" | "service" | "volee" | "bandeja";
export type CameraView = "match" | "behind" | "player";
export type Overlay = "intro" | "none" | "pause" | "settings" | "end";
export type StatsTab = "vous" | "adversaires";

export interface ChatMessage {
  id: number;
  author: string;
  text: string;
  time: string;
}

export interface TeamStats {
  pointsGagnes: number;
  fautesDirectes: number;
  smashGagnants: number;
  ballesSorties: number;
  servicesTentes: number;
  servicesReussis: number;
  pointsAuFilet: number;
}

export type ShotButtons = Record<ShotType, boolean>;
export type ShotKeys = Record<ShotType, string>;

export interface HudState {
  gamesVous: number;
  gamesAdversaire: number;
  pointsVous: string;
  pointsAdversaire: string;
  set: number;
  servingTeam: 0 | 1;
  serverName: string;
  playerName: string;
  names: string[];
  selectedShot: ShotType;
  canHit: boolean;
  charging: boolean;
  power: number;
  camera: CameraView;
  statsVous: TeamStats;
  statsAdv: TeamStats;
  statsTab: StatsTab;
  chat: ChatMessage[];
  ping: number;
  banner: string | null;
  overlay: Overlay;
  tutorial: boolean;
  matchOver: boolean;
  winner: 0 | 1 | null;
  phase: "serve" | "rally" | "pause";
  analog: boolean;
  shotButtons: ShotButtons;
  shotKeys: ShotKeys;
  hitKey: string;
  listeningBind: ShotType | "hit" | null;
  ballSpeed: number;
}

export const emptyStats = (): TeamStats => ({
  pointsGagnes: 0,
  fautesDirectes: 0,
  smashGagnants: 0,
  ballesSorties: 0,
  servicesTentes: 0,
  servicesReussis: 0,
  pointsAuFilet: 0,
});
