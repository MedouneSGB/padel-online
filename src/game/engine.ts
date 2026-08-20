import * as THREE from "three";
import { GameAudio } from "./audio";
import { PlayerRig } from "./characters";
import {
  COURT_HALF_L,
  COURT_HALF_W,
  FIXED_DT,
  HIT_RANGE,
  HOME_POS,
  PLAYERS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  POINT_NAMES,
  SERVICE_FROM_NET,
} from "./constants";
import { BALL_RADIUS, GRAVITY, NET_HEIGHT, computeLaunch } from "./ballPhysics";
import { createBallTexture } from "./textures";
import type { CameraView, HudState, Overlay, ShotButtons, ShotKeys, ShotType, StatsTab } from "./types";
import { emptyStats } from "./types";
import { buildWorld } from "./world";

const SETTINGS_KEY = "padel-online-settings";
const NAME_KEY = "padel-online-player-name";

const DEFAULT_SHOTS: ShotButtons = {
  lob: true,
  smash: true,
  service: true,
  volee: true,
  bandeja: true,
};

const DEFAULT_KEYS: ShotKeys = {
  lob: "Digit1",
  smash: "Digit2",
  service: "Digit3",
  volee: "Digit4",
  bandeja: "Digit5",
};

const DEFAULT_HIT = "Space";

const RESERVED_KEYS = new Set([
  "Escape",
  "Tab",
  "Enter",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "F5",
  "F11",
  "F12",
]);

function prefersTouch() {
  try {
    return window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(hover: none)").matches;
  } catch {
    return false;
  }
}

function loadSettings(): {
  analog: boolean;
  shots: ShotButtons;
  keys: ShotKeys;
  hitKey: string;
  ballSpeed: number;
} {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw)
      return { analog: prefersTouch(), shots: { ...DEFAULT_SHOTS }, keys: { ...DEFAULT_KEYS }, hitKey: DEFAULT_HIT, ballSpeed: 0.85 };
    const parsed = JSON.parse(raw) as {
      analog?: boolean;
      shots?: Partial<ShotButtons>;
      keys?: Partial<ShotKeys>;
      hitKey?: string;
      ballSpeed?: number;
    };
    return {
      analog: parsed.analog !== undefined ? !!parsed.analog : prefersTouch(),
      shots: { ...DEFAULT_SHOTS, ...parsed.shots },
      keys: { ...DEFAULT_KEYS, ...parsed.keys },
      hitKey: parsed.hitKey || DEFAULT_HIT,
      ballSpeed: clamp(parsed.ballSpeed ?? 0.85, 0.5, 1.15),
    };
  } catch {
    return { analog: prefersTouch(), shots: { ...DEFAULT_SHOTS }, keys: { ...DEFAULT_KEYS }, hitKey: DEFAULT_HIT, ballSpeed: 0.85 };
  }
}

function savedPlayerName() {
  try {
    return localStorage.getItem(NAME_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function mouseCode(button: number) {
  if (button === 0) return "Mouse0";
  if (button === 2) return "Mouse1";
  if (button === 1) return "Mouse2";
  return "";
}

type Phase = "serve" | "rally" | "dead";

export class Game {
  readonly hud: HudState;
  private listeners = new Set<(s: HudState) => void>();
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  private clock = new THREE.Clock();
  private acc = 0;
  private raf = 0;
  private disposed = false;
  private audio = new GameAudio();
  private players: PlayerRig[] = [];
  private ball: THREE.Mesh;
  private ballPos = new THREE.Vector3(0, 1, 6);
  private ballVel = new THREE.Vector3();
  private trail: THREE.Line;
  private trailPts: number[] = [];
  private aimLine: THREE.Line;
  private bounceMarks: THREE.Mesh[] = [];
  private sparks: { mesh: THREE.InstancedMesh; life: number[] } | null = null;
  private emote: THREE.Sprite;
  private emoteUntil = 0;
  private phase: Phase = "serve";
  private bounces = 0;
  private lastHitter = 0;
  private lastShot: ShotType = "service";
  private server = 0;
  private points = [0, 0];
  private games = [0, 0];
  private tiebreak = false;
  private input = { x: 0, z: 0 };
  private keys = new Set<string>();
  private charging = false;
  private power = 0;
  private canHit = false;
  private deadTimer = 0;
  private bannerTimer = 0;
  private notifyAcc = 0;
  private camView: CameraView = "match";
  private nearCage: THREE.Object3D | null = null;
  private overlay: Overlay = "intro";
  private tutorialLeft = 0;
  private frameMs = 32;
  private aimOff = new THREE.Vector2();
  private serveSide = 1;
  private botCooldown = [0, 0, 0, 0];
  private chatId = 1;
  private dummy = new THREE.Object3D();
  private pointerMove = false;
  private analog = false;
  private shotButtons: ShotButtons = { ...DEFAULT_SHOTS };
  private shotKeys: ShotKeys = { ...DEFAULT_KEYS };
  private hitKey = DEFAULT_HIT;
  private listeningBind: ShotType | "hit" | null = null;
  private ignoreBindUntil = 0;
  private ballSpeed = 0.85;
  private netVolleys = 0;

  constructor(private host: HTMLElement) {
    const settings = loadSettings();
    this.analog = settings.analog;
    this.shotButtons = settings.shots;
    this.shotKeys = settings.keys;
    this.hitKey = settings.hitKey;
    this.ballSpeed = settings.ballSpeed;
    const stored = savedPlayerName();
    if (stored) {
      PLAYERS[0].name = stored;
    }
    this.hud = this.makeHud();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(host.clientWidth, host.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.touchAction = "none";
    host.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x070b12);
    this.scene.fog = new THREE.Fog(0x070b12, 28, 70);
    buildWorld(this.scene);
    this.nearCage = this.scene.getObjectByName("nearCage") ?? null;

    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 16, 12),
      new THREE.MeshStandardMaterial({
        map: createBallTexture(),
        roughness: 0.45,
        emissive: 0x334400,
        emissiveIntensity: 0.15,
      }),
    );
    this.ball.castShadow = true;
    this.scene.add(this.ball);

    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(84), 3));
    this.trail = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({ color: 0xc6ff2a, transparent: true, opacity: 0.75 }),
    );
    this.scene.add(this.trail);

    const aimGeo = new THREE.BufferGeometry();
    aimGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(48), 3));
    this.aimLine = new THREE.Line(
      aimGeo,
      new THREE.LineDashedMaterial({ color: 0xd8ff3a, dashSize: 0.18, gapSize: 0.1, transparent: true, opacity: 0.9 }),
    );
    this.aimLine.visible = false;
    this.scene.add(this.aimLine);

    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.12, 0.18, 24),
        new THREE.MeshBasicMaterial({ color: 0xe8ff8a, transparent: true, opacity: 0, side: THREE.DoubleSide }),
      );
      m.rotation.x = -Math.PI / 2;
      m.userData.life = 0;
      this.scene.add(m);
      this.bounceMarks.push(m);
    }

    const sparkGeo = new THREE.SphereGeometry(0.03, 6, 6);
    const sparkMesh = new THREE.InstancedMesh(
      sparkGeo,
      new THREE.MeshBasicMaterial({ color: 0xf6ff8a }),
      28,
    );
    sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(sparkMesh);
    this.sparks = { mesh: sparkMesh, life: Array(28).fill(0) };

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const tex = new THREE.CanvasTexture(canvas);
    this.emote = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    this.emote.scale.set(0.7, 0.7, 0.7);
    this.emote.visible = false;
    this.emote.userData.canvas = canvas;
    this.emote.userData.tex = tex;
    this.scene.add(this.emote);

    for (let i = 0; i < 4; i++) {
      const p = new PlayerRig(i);
      p.group.position.set(HOME_POS[i][0], 0, HOME_POS[i][1]);
      this.scene.add(p.group);
      this.players.push(p);
    }

    this.camera.position.set(0, 18, 24);
    this.camera.lookAt(0, 0.4, 0);

    this.onResize = this.onResize.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onPtrDown = this.onPtrDown.bind(this);
    this.onPtrUp = this.onPtrUp.bind(this);
    this.onWinPointer = this.onWinPointer.bind(this);
    this.onContext = this.onContext.bind(this);
    window.addEventListener("resize", this.onResize);
    window.addEventListener("orientationchange", this.onResize);
    window.visualViewport?.addEventListener("resize", this.onResize);
    window.visualViewport?.addEventListener("scroll", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("pointerdown", this.onWinPointer, true);
    this.renderer.domElement.addEventListener("pointerdown", this.onPtrDown);
    this.renderer.domElement.addEventListener("pointerup", this.onPtrUp);
    this.renderer.domElement.addEventListener("contextmenu", this.onContext);
    this.onResize();
    this.resetPoint();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  subscribe(fn: (s: HudState) => void) {
    this.listeners.add(fn);
    fn({ ...this.hud, chat: [...this.hud.chat] });
    return () => {
      this.listeners.delete(fn);
    };
  }

  setShot(shot: ShotType) {
    this.audio.ui();
    this.hud.selectedShot = shot;
    if (this.phase === "dead" || this.overlay !== "none") {
      this.pushHud();
      return;
    }
    if (this.phase === "serve" && this.server === 0 && shot === "service") {
      this.doHit(0, "service", 0.82);
    } else if (this.phase === "rally" && this.evalCanHit(0)) {
      this.doHit(0, shot === "service" ? "volee" : shot, 0.8);
    }
    this.pushHud();
  }

  setCamera(view: CameraView) {
    this.audio.ui();
    this.camView = view;
    this.hud.camera = view;
    if (this.nearCage) this.nearCage.visible = view !== "behind";
    this.pushHud();
  }

  setMove(x: number, z: number) {
    this.pointerMove = x !== 0 || z !== 0;
    this.input.x = x;
    this.input.z = z;
  }

  pressHit() {
    this.beginCharge();
  }

  releaseHit() {
    this.releaseCharge();
  }

  setStatsTab(tab: StatsTab) {
    this.hud.statsTab = tab;
    this.pushHud();
  }

  setPlayerName(name: string) {
    const clean = name.trim().slice(0, 16);
    PLAYERS[0].name = clean;
    this.players[0].name = clean;
    this.hud.playerName = PLAYERS[0].name;
    this.hud.names = PLAYERS.map((p) => p.name);
    try {
      localStorage.setItem(NAME_KEY, PLAYERS[0].name);
    } catch {
      /* ignore */
    }
    this.pushHud();
  }

  setAnalog(on: boolean) {
    this.analog = on;
    this.hud.analog = on;
    this.saveSettings();
    this.pushHud();
  }

  setBallSpeed(v: number) {
    this.ballSpeed = clamp(v, 0.5, 1.15);
    this.hud.ballSpeed = this.ballSpeed;
    this.saveSettings();
    this.pushHud();
  }

  setShotButton(shot: ShotType, visible: boolean) {
    this.shotButtons = { ...this.shotButtons, [shot]: visible };
    this.hud.shotButtons = { ...this.shotButtons };
    this.saveSettings();
    this.pushHud();
  }

  beginBind(slot: ShotType | "hit") {
    this.listeningBind = slot;
    this.hud.listeningBind = slot;
    this.ignoreBindUntil = performance.now() + 250;
    this.pushHud();
  }

  cancelBind() {
    this.listeningBind = null;
    this.hud.listeningBind = null;
    this.pushHud();
  }

  resetKeys() {
    this.shotKeys = { ...DEFAULT_KEYS };
    this.hitKey = DEFAULT_HIT;
    this.listeningBind = null;
    this.hud.shotKeys = { ...this.shotKeys };
    this.hud.hitKey = this.hitKey;
    this.hud.listeningBind = null;
    this.saveSettings();
    this.pushHud();
  }

  private applyBind(code: string) {
    if (!this.listeningBind) return;
    if (RESERVED_KEYS.has(code) || code.startsWith("Meta") || code.startsWith("Control") || code.startsWith("Alt") || code.startsWith("Shift")) {
      this.hud.banner = "TOUCHE RÉSERVÉE";
      this.bannerTimer = 1.2;
      this.pushHud();
      return;
    }
    if (this.listeningBind === "hit") {
      for (const shot of Object.keys(this.shotKeys) as ShotType[]) {
        if (this.shotKeys[shot] === code) this.shotKeys[shot] = "";
      }
      this.hitKey = code;
    } else {
      if (this.hitKey === code) this.hitKey = "";
      for (const shot of Object.keys(this.shotKeys) as ShotType[]) {
        if (shot !== this.listeningBind && this.shotKeys[shot] === code) this.shotKeys[shot] = "";
      }
      this.shotKeys[this.listeningBind] = code;
    }
    this.listeningBind = null;
    this.hud.listeningBind = null;
    this.hud.shotKeys = { ...this.shotKeys };
    this.hud.hitKey = this.hitKey;
    this.saveSettings();
    this.audio.ui();
    this.pushHud();
  }

  private saveSettings() {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          analog: this.analog,
          shots: this.shotButtons,
          keys: this.shotKeys,
          hitKey: this.hitKey,
          ballSpeed: this.ballSpeed,
        }),
      );
    } catch {
      /* ignore */
    }
  }

  sendChat(text: string) {
    const msg = text.trim();
    if (!msg) return;
    this.hud.chat = [...this.hud.chat, { id: this.chatId++, author: PLAYERS[0].name, text: msg, time: nowTime() }];
    this.pushHud();
  }

  emotePlayer(emoji: string) {
    this.audio.ui();
    const c: HTMLCanvasElement = this.emote.userData.canvas;
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, 128, 128);
    g.font = "90px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(emoji, 64, 72);
    (this.emote.userData.tex as THREE.CanvasTexture).needsUpdate = true;
    this.emote.visible = true;
    this.emoteUntil = performance.now() + 1600;
  }

  togglePause() {
    if (this.overlay === "intro" || this.overlay === "end") return;
    this.overlay = this.overlay === "pause" ? "none" : "pause";
    this.hud.overlay = this.overlay;
    this.pushHud();
  }

  openSettings() {
    if (this.overlay === "intro") return;
    this.overlay = this.overlay === "settings" ? "none" : "settings";
    if (this.overlay !== "settings") this.listeningBind = null;
    this.hud.listeningBind = this.listeningBind;
    this.hud.overlay = this.overlay;
    this.pushHud();
  }

  startMatch() {
    if (PLAYERS[0].name.trim().length < 2) return;
    this.audio.resume();
    this.audio.whistle();
    this.overlay = "none";
    this.hud.overlay = "none";
    this.tutorialLeft = 6;
    this.hud.tutorial = true;
    this.hud.banner = "AU SERVICE : VOUS";
    this.bannerTimer = 2.2;
    this.pushHud();
  }

  setMuted(muted: boolean) {
    this.audio.setMuted(muted);
  }

  resetMatch() {
    this.points = [0, 0];
    this.games = [0, 0];
    this.tiebreak = false;
    this.server = 0;
    this.serveSide = 1;
    this.hud.statsVous = emptyStats();
    this.hud.statsAdv = emptyStats();
    this.hud.matchOver = false;
    this.hud.winner = null;
    this.overlay = "none";
    this.hud.overlay = "none";
    this.resetPoint();
    this.hud.banner = "NOUVEAU MATCH";
    this.bannerTimer = 1.6;
    this.pushHud();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("orientationchange", this.onResize);
    window.visualViewport?.removeEventListener("resize", this.onResize);
    window.visualViewport?.removeEventListener("scroll", this.onResize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("pointerdown", this.onWinPointer, true);
    this.renderer.domElement.removeEventListener("pointerdown", this.onPtrDown);
    this.renderer.domElement.removeEventListener("pointerup", this.onPtrUp);
    this.renderer.domElement.removeEventListener("contextmenu", this.onContext);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private makeHud(): HudState {
    return {
      gamesVous: 0,
      gamesAdversaire: 0,
      pointsVous: "0",
      pointsAdversaire: "0",
      set: 1,
      servingTeam: 0,
      serverName: PLAYERS[0].name || "Toi",
      playerName: PLAYERS[0].name,
      names: PLAYERS.map((p) => p.name),
      selectedShot: "service",
      canHit: false,
      charging: false,
      power: 0,
      camera: "match",
      statsVous: emptyStats(),
      statsAdv: emptyStats(),
      statsTab: "vous",
      chat: [],
      ping: 32,
      banner: null,
      overlay: "intro",
      tutorial: false,
      matchOver: false,
      winner: null,
      phase: "serve",
      analog: this.analog,
      shotButtons: { ...this.shotButtons },
      shotKeys: { ...this.shotKeys },
      hitKey: this.hitKey,
      listeningBind: this.listeningBind,
      ballSpeed: this.ballSpeed,
    };
  }

  private loop() {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.frameMs = Math.round(dt * 1000);
    if (this.overlay === "pause" || this.overlay === "settings") {
      if (this.bannerTimer > 0) {
        this.bannerTimer -= dt;
        if (this.bannerTimer <= 0) {
          this.hud.banner = null;
          this.pushHud();
        }
      }
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.overlay === "intro") {
      const k = 1 - Math.exp(-dt * 1.2);
      this.camera.position.lerp(new THREE.Vector3(0, 13.2, 16.8), k * 0.35);
      this.camera.lookAt(0, 0.3, 1.2);
      this.players.forEach((p) => p.update(dt));
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.acc += dt;
    while (this.acc >= FIXED_DT) {
      this.step(FIXED_DT);
      this.acc -= FIXED_DT;
    }
    this.players.forEach((p) => p.update(dt));
    this.updateCamera(dt);
    this.updateFx(dt);
    this.ball.position.copy(this.ballPos);
    this.ball.rotation.x += this.ballVel.length() * dt * 0.4;
    this.ball.rotation.z += this.ballVel.x * dt * 0.3;
    this.renderer.render(this.scene, this.camera);

    this.notifyAcc += dt;
    if (this.charging || this.notifyAcc > 0.08) {
      this.notifyAcc = 0;
      this.syncHud();
      this.pushHud();
    }
  }

  private step(dt: number) {
    this.readKeys();
    if (this.tutorialLeft > 0) {
      this.tutorialLeft -= dt;
      this.hud.tutorial = this.tutorialLeft > 0;
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.hud.banner = null;
    }
    if (this.charging) {
      this.power = Math.min(1, this.power + dt * 1.15);
      this.updateAimArc();
    }
    this.updateUser(dt);
    this.updateBots(dt);
    this.keepSeparation();
    if (this.phase === "serve" && this.ballVel.lengthSq() < 0.15) {
      this.holdBallAtServer();
    }
    if (this.phase === "rally" || (this.phase === "serve" && this.ballVel.lengthSq() > 0.2)) {
      this.integrateBall(dt);
    }
    if (this.phase === "serve" && this.server !== 0 && this.ballVel.lengthSq() < 0.25) {
      this.botCooldown[this.server] -= dt;
      if (this.botCooldown[this.server] <= 0) {
        this.doHit(this.server, "service", 0.78);
        this.botCooldown[this.server] = 99;
      }
    }
    if (this.phase === "dead") {
      this.deadTimer -= dt;
      if (this.deadTimer <= 0 && !this.hud.matchOver) this.resetPoint();
    }
    this.canHit = this.evalCanHit(0);
    if (this.phase === "serve") this.canHit = this.server === 0;
  }

  private readKeys() {
    const l = this.keys.has("KeyA") || this.keys.has("ArrowLeft");
    const r = this.keys.has("KeyD") || this.keys.has("ArrowRight");
    const u = this.keys.has("KeyW") || this.keys.has("ArrowUp");
    const d = this.keys.has("KeyS") || this.keys.has("ArrowDown");
    const kx = (r ? 1 : 0) - (l ? 1 : 0);
    const kz = (d ? 1 : 0) - (u ? 1 : 0);
    if (kx || kz) {
      this.input.x = kx;
      this.input.z = kz;
    } else if (!this.pointerMove) {
      this.input.x = 0;
      this.input.z = 0;
    }
  }

  private updateUser(dt: number) {
    const p = this.players[0];
    const len = Math.hypot(this.input.x, this.input.z) || 1;
    const ix = this.input.x / len;
    const iz = this.input.z / len;
    p.vx = ix * PLAYER_SPEED;
    p.vz = iz * PLAYER_SPEED;
    p.group.position.x = clamp(p.group.position.x + p.vx * dt, -COURT_HALF_W + 0.45, COURT_HALF_W - 0.45);
    p.group.position.z = clamp(p.group.position.z + p.vz * dt, 0.4, COURT_HALF_L - 0.55);
    p.lookX = this.ballPos.x - p.group.position.x;
    p.lookZ = this.ballPos.z - p.group.position.z;
    this.aimOff.set(this.input.x * 3.2, this.input.z * 2.2);
  }

  private botIsNet(i: number, userZ = this.players[0].group.position.z): boolean {
    if (i === 1) return userZ > 3.2;
    if (this.server === 2) return i === 3;
    return i === 2;
  }

  private serveReturnerLane(): 1 | -1 {
    const standX = this.serveSide * (PLAYERS[this.server].team === 0 ? 1 : -1);
    return -standX > 0 ? 1 : -1;
  }

  private updateBots(dt: number) {
    const land = this.predictLanding();
    const userZ = this.players[0].group.position.z;
    const returnLane = this.serveReturnerLane();
    for (let i = 1; i < 4; i++) {
      const p = this.players[i];
      this.botCooldown[i] = Math.max(0, this.botCooldown[i] - dt);
      const homeX = HOME_POS[i][0];
      const mySide = p.team === 0 ? 1 : -1;
      const coverX = i % 2 === 1 ? 1 : -1;
      const netZ = mySide * 1.9;
      const backZ = mySide * 7.0;
      const isNet = this.botIsNet(i, userZ);
      let tx = homeX;
      let tz = isNet ? netZ : backZ;

      const ballOnOurSide = this.ballPos.z * mySide > -0.15 || land.z * mySide > 0.2;
      const myLane = land.x * coverX >= -0.35 || Math.abs(land.x) < 1;
      const shortBall = Math.abs(land.z) < 4.2;
      const zMin = p.team === 0 ? 0.45 : -9.4;
      const zMax = p.team === 0 ? 9.4 : -0.45;

      if (this.phase === "serve") {
        if (i === this.server) {
          p.vx = p.vz = 0;
          p.lookX = 0;
          p.lookZ = p.team === 0 ? -1 : 1;
          continue;
        }
        const receiving = PLAYERS[this.server].team !== p.team;
        const serveLive = this.ballVel.lengthSq() > 0.2;
        if (receiving) {
          const isReturner = homeX * returnLane > 0;
          tx = homeX;
          tz = isReturner ? mySide * 4.35 : netZ;
          if (serveLive && ballOnOurSide && (isReturner || (shortBall && myLane))) {
            tx = clamp(land.x, -4.3, 4.3);
            tz = clamp(land.z + mySide * 0.4, zMin, zMax);
          }
        } else {
          tx = clamp(homeX * 0.7 + this.ballPos.x * 0.15, -4.2, 4.2);
          tz = netZ;
        }
      } else if (this.phase === "rally") {
        if (isNet) {
          tx = clamp(homeX * 0.3 + this.ballPos.x * 0.45, -4.2, 4.2);
          tz = netZ;
          if (ballOnOurSide && shortBall) {
            tx = clamp(land.x, -4.3, 4.3);
            tz = clamp(land.z + mySide * 0.28, mySide > 0 ? 0.45 : -3.5, mySide > 0 ? 3.5 : -0.45);
          }
        } else if (ballOnOurSide && (myLane || !shortBall)) {
          tx = clamp(land.x, -4.3, 4.3);
          tz = clamp(land.z + mySide * 0.5, zMin, zMax);
        } else {
          tx = clamp(homeX * 0.55 + this.ballPos.x * 0.22, -4.2, 4.2);
          tz = backZ;
        }
      }

      const dx = tx - p.group.position.x;
      const dz = tz - p.group.position.z;
      const dist = Math.hypot(dx, dz);
      const closing =
        ballOnOurSide &&
        (shortBall || (this.phase === "serve" && PLAYERS[this.server].team !== p.team));
      const chase = closing && (isNet || myLane || homeX * returnLane > 0);
      const spd = PLAYER_SPEED * (chase ? 1.48 : closing ? 1.28 : 1.08);
      if (dist > 0.12) {
        p.vx = (dx / dist) * spd;
        p.vz = (dz / dist) * spd;
      } else {
        p.vx = p.vz = 0;
      }
      p.group.position.x = clamp(p.group.position.x + p.vx * dt, -4.55, 4.55);
      if (p.team === 0) p.group.position.z = clamp(p.group.position.z + p.vz * dt, 0.4, 9.4);
      else p.group.position.z = clamp(p.group.position.z + p.vz * dt, -9.4, -0.4);
      p.lookX = this.ballPos.x - p.group.position.x;
      p.lookZ = this.ballPos.z - p.group.position.z;

      if (this.phase === "rally" && this.botCooldown[i] <= 0 && this.evalCanHit(i)) {
        if (i === 1) {
          const user = this.players[0].group.position;
          const dUser = Math.hypot(this.ballPos.x - user.x, this.ballPos.z - user.z);
          const dBot = Math.hypot(this.ballPos.x - p.group.position.x, this.ballPos.z - p.group.position.z);
          if (dUser < dBot + 0.15) continue;
        }
        const shot = this.chooseBotShot(i);
        this.botCooldown[i] = shot === "volee" ? 1.15 : 0.75;
        this.doHit(i, shot, 0.55 + Math.random() * 0.22);
      }
    }
  }

  private chooseBotShot(id: number): ShotType {
    const y = this.ballPos.y;
    const z = Math.abs(this.players[id].group.position.z);
    if (y > 1.85) return "smash";
    if (this.netVolleys >= 2) return "lob";
    const r = Math.random();
    if (z < 3.6) {
      if (r < 0.52) return "lob";
      if (r < 0.84) return "bandeja";
      return "volee";
    }
    if (r < 0.38) return "lob";
    if (r < 0.78) return "bandeja";
    return "volee";
  }

  private keepSeparation() {
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const a = this.players[i].group.position;
        const b = this.players[j].group.position;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = PLAYER_RADIUS * 2.1;
        if (d > 0.001 && d < min) {
          const push = (min - d) * 0.5;
          const nx = dx / d;
          const nz = dz / d;
          a.x -= nx * push;
          a.z -= nz * push;
          b.x += nx * push;
          b.z += nz * push;
        }
      }
    }
  }

  private integrateBall(dt: number) {
    this.ballVel.y += GRAVITY * dt;
    this.ballPos.x += this.ballVel.x * dt;
    this.ballPos.y += this.ballVel.y * dt;
    this.ballPos.z += this.ballVel.z * dt;

    if (this.ballPos.y <= BALL_RADIUS && this.ballVel.y < 0) {
      const inCourt = Math.abs(this.ballPos.x) <= COURT_HALF_W + 0.04 && Math.abs(this.ballPos.z) <= COURT_HALF_L + 0.04;
      this.ballPos.y = BALL_RADIUS;
      this.ballVel.y = Math.min(Math.abs(this.ballVel.y) * 0.42, 2.4);
      this.ballVel.x *= 0.82;
      this.ballVel.z *= 0.82;
      this.spawnBounce(this.ballPos.x, this.ballPos.z);
      this.audio.bounce();
      if (!inCourt) {
        this.endPoint(this.lastHitter % 2 === 0 ? 1 : 0, "out");
        return;
      }
      this.bounces++;
      if (this.phase === "serve" && this.bounces === 1) {
        if (!this.inServiceBox(this.ballPos.x, this.ballPos.z)) {
          this.endPoint(this.server % 2 === 0 ? 1 : 0, "faute");
          return;
        }
        this.phase = "rally";
        const st = this.server % 2 === 0 ? this.hud.statsVous : this.hud.statsAdv;
        st.servicesReussis++;
      } else if (this.bounces >= 2) {
        this.endPoint(this.lastHitter % 2 === 0 ? 0 : 1, "winner");
        return;
      }
    }

    const maxX = COURT_HALF_W - BALL_RADIUS;
    const maxZ = COURT_HALF_L - BALL_RADIUS;
    if (Math.abs(this.ballPos.x) > maxX && this.ballPos.y < 3.05) {
      if (this.bounces === 0 && this.phase === "rally") {
        this.endPoint(this.lastHitter % 2 === 0 ? 1 : 0, "out");
        return;
      }
      this.ballPos.x = clamp(this.ballPos.x, -maxX, maxX);
      this.ballVel.x *= -0.78;
      this.audio.glass();
    }
    if (Math.abs(this.ballPos.z) > maxZ && this.ballPos.y < 3.05) {
      if (this.bounces === 0 && this.phase === "rally") {
        this.endPoint(this.lastHitter % 2 === 0 ? 1 : 0, "out");
        return;
      }
      this.ballPos.z = clamp(this.ballPos.z, -maxZ, maxZ);
      this.ballVel.z *= -0.78;
      this.audio.glass();
    }
    if (this.ballPos.y > 4.05 && (Math.abs(this.ballPos.x) > COURT_HALF_W || Math.abs(this.ballPos.z) > COURT_HALF_L)) {
      this.endPoint(this.lastHitter % 2 === 0 ? 1 : 0, "out");
      return;
    }

    const crossed = Math.sign(this.ballPos.z - this.ballVel.z * dt) !== Math.sign(this.ballPos.z);
    if (crossed && this.ballPos.y < NET_HEIGHT && Math.abs(this.ballPos.x) < COURT_HALF_W) {
      this.audio.net();
      if (this.phase === "serve" && this.ballPos.y > NET_HEIGHT - 0.08) {
        this.ballVel.set(0, 0, 0);
        this.holdBallAtServer();
        this.hud.banner = "LET";
        this.bannerTimer = 1.1;
        return;
      }
      this.endPoint(this.lastHitter % 2 === 0 ? 1 : 0, "filet");
      return;
    }

    this.pushTrail();
    if (this.ballPos.y < -1) this.endPoint(this.lastHitter % 2 === 0 ? 1 : 0, "out");
  }

  private inServiceBox(x: number, z: number) {
    const dir = this.players[this.server].team === 0 ? -1 : 1;
    const zMin = dir < 0 ? -SERVICE_FROM_NET : 0.02;
    const zMax = dir < 0 ? -0.02 : SERVICE_FROM_NET;
    const wantX = this.serveSide * dir > 0 ? 1 : -1;
    const okX = wantX > 0 ? x > 0 : x < 0;
    return okX && z >= Math.min(zMin, zMax) && z <= Math.max(zMin, zMax) && Math.abs(x) < COURT_HALF_W;
  }

  private evalCanHit(id: number) {
    if (this.phase === "dead") return false;
    if (this.phase === "serve") return id === this.server;
    const p = this.players[id].group.position;
    const dx = this.ballPos.x - p.x;
    const dz = this.ballPos.z - p.z;
    const dist = Math.hypot(dx, dz);
    const range = id === 0 ? HIT_RANGE : HIT_RANGE + 0.4;
    if (dist > range || this.ballPos.y > 2.55) return false;
    const side = this.players[id].team === 0 ? 1 : -1;
    if (this.ballPos.z * side < -0.15) return false;
    const coming = this.ballVel.z * side > -2.5;
    return coming || dist < 1.15;
  }

  private beginCharge() {
    if (this.charging || this.phase === "dead" || this.overlay !== "none") return;
    if (this.phase === "serve" && this.server !== 0) return;
    if (this.phase === "rally" && !this.canHit) return;
    this.charging = true;
    this.power = 0.2;
    this.aimLine.visible = true;
  }

  private releaseCharge() {
    if (!this.charging) return;
    this.charging = false;
    this.aimLine.visible = false;
    const shot = this.phase === "serve" ? "service" : this.hud.selectedShot;
    if (this.phase === "serve" && this.server === 0) this.doHit(0, "service", this.power);
    else if (this.canHit) this.doHit(0, shot === "service" ? "volee" : shot, this.power);
    this.power = 0;
  }

  private holdBallAtServer() {
    const s = this.players[this.server];
    const net = s.team === 0 ? -1 : 1;
    this.ballPos.set(
      s.group.position.x + 0.32,
      0.86 + (this.charging ? Math.sin(this.clock.elapsedTime * 8) * 0.04 : 0),
      s.group.position.z + net * 0.45,
    );
    this.ballVel.set(0, 0, 0);
  }

  private doHit(id: number, shot: ShotType, power: number) {
    const p = this.players[id];
    const from = p.group.position;
    const dist = Math.hypot(this.ballPos.x - from.x, this.ballPos.z - from.z);
    if (this.phase !== "serve" && dist > HIT_RANGE + (id === 0 ? 0.35 : 0.55)) return;
    p.playSwing();
    const quality = this.phase === "serve" ? 1 : clamp(1 - dist / HIT_RANGE, 0.35, 1);
    const pow = clamp(power, 0.35, 1) * quality;
    const team = p.team;
    const dirZ = team === 0 ? -1 : 1;
    let tx = from.x + this.aimOff.x;
    let tz = dirZ * (shot === "lob" ? 8.2 : shot === "smash" ? 4.6 : shot === "service" ? 1.55 : 6.4);
    if (id !== 0) {
      tx = clamp(from.x + this.openGap(team) * 0.45, -3.8, 3.8);
      const deep = shot === "lob" ? 8.4 : shot === "smash" ? 5.4 : shot === "bandeja" ? 7.9 : 7.6;
      tz = dirZ * (shot === "service" ? 1.6 : deep);
    }
    if (shot === "service") {
      const standX = this.serveSide * (team === 0 ? 1 : -1);
      tx = -standX * 2.3;
      tz = dirZ * 1.55;
      (team === 0 ? this.hud.statsVous : this.hud.statsAdv).servicesTentes++;
    }
    const target = new THREE.Vector3(clamp(tx, -4.5, 4.5), BALL_RADIUS, clamp(tz, -9.1, 9.1));
    const prevZ = Math.abs(this.players[this.lastHitter].group.position.z);
    const curZ = Math.abs(from.z);
    if (shot === "service" || shot === "lob" || curZ > 3.5) {
      this.netVolleys = 0;
    } else if (this.lastHitter !== id && prevZ < 3.4 && curZ < 3.4) {
      this.netVolleys++;
    } else {
      this.netVolleys = curZ < 3.4 ? 1 : 0;
    }
    this.launchBall(target, shot, pow, team);
    this.bounces = 0;
    this.lastHitter = id;
    this.lastShot = shot;
    this.phase = shot === "service" ? "serve" : "rally";
    this.audio.hit(pow);
    this.spawnSparks(this.ballPos);
    this.botCooldown[id] = id === 0 ? 0.9 : shot === "lob" ? 1.4 : 1.05;
    if (shot !== "service") this.hud.selectedShot = shot;
  }

  private launchBall(target: THREE.Vector3, shot: ShotType, pow: number, team: 0 | 1) {
    const toward = team === 0 ? -1 : 1;
    const launch = computeLaunch(
      { x: this.ballPos.x, y: this.ballPos.y, z: this.ballPos.z },
      { x: target.x, z: target.z },
      shot,
      toward,
      this.ballSpeed,
    );
    const scale = 0.88 + 0.2 * pow;
    this.ballVel.set(launch.vx * scale, launch.vy, launch.vz * scale);
    this.ballPos.y = Math.max(this.ballPos.y, 0.45);
  }

  private openGap(team: 0 | 1) {
    const a = this.players[team === 0 ? 2 : 0].group.position.x;
    const b = this.players[team === 0 ? 3 : 1].group.position.x;
    return -(a + b) * 0.65;
  }

  private predictLanding() {
    const g = GRAVITY;
    const a = 0.5 * g;
    const b = this.ballVel.y;
    const c = this.ballPos.y - BALL_RADIUS;
    const disc = b * b - 4 * a * c;
    let t = 0.45;
    if (disc >= 0) {
      const s = Math.sqrt(disc);
      const t1 = (-b - s) / (2 * a);
      const t2 = (-b + s) / (2 * a);
      t = Math.max(t1, t2, 0.05);
    }
    return new THREE.Vector3(this.ballPos.x + this.ballVel.x * t, BALL_RADIUS, this.ballPos.z + this.ballVel.z * t);
  }

  private endPoint(winner: 0 | 1, reason: "out" | "filet" | "winner" | "faute") {
    if (this.phase === "dead") return;
    this.phase = "dead";
    this.deadTimer = 1.55;
    this.charging = false;
    this.aimLine.visible = false;
    this.ballVel.set(0, 0, 0);
    this.audio.cheer();

    const loser = (1 - winner) as 0 | 1;
    if (reason === "out" || reason === "faute") {
      (loser === 0 ? this.hud.statsVous : this.hud.statsAdv).ballesSorties++;
      (loser === 0 ? this.hud.statsVous : this.hud.statsAdv).fautesDirectes++;
    }
    if (reason === "filet") (loser === 0 ? this.hud.statsVous : this.hud.statsAdv).fautesDirectes++;
    if (reason === "winner" && this.lastShot === "smash") {
      (winner === 0 ? this.hud.statsVous : this.hud.statsAdv).smashGagnants++;
    }
    if (Math.abs(this.players[this.lastHitter].group.position.z) < 3.1 && winner === this.players[this.lastHitter].team) {
      (winner === 0 ? this.hud.statsVous : this.hud.statsAdv).pointsAuFilet++;
    }
    (winner === 0 ? this.hud.statsVous : this.hud.statsAdv).pointsGagnes++;

    this.points[winner]++;
    let jeu = false;
    if (this.tiebreak) {
      if (this.points[winner] >= 7 && this.points[winner] - this.points[loser] >= 2) jeu = true;
    } else if (this.points[winner] >= 4 && this.points[winner] - this.points[loser] >= 2) {
      jeu = true;
    }
    const labels: Record<string, string> = {
      out: winner === 0 ? "BALLE SORTIE" : "SORTIE ADVERSE",
      filet: "FILET",
      faute: "FAUTE DE SERVICE",
      winner: this.lastShot === "smash" ? "SMASH GAGNANT" : "POINT",
    };
    if (jeu) {
      this.games[winner]++;
      this.points = [0, 0];
      this.server = [0, 2, 1, 3][( [0, 2, 1, 3].indexOf(this.server) + 1) % 4];
      this.serveSide = 1;
      this.hud.banner = winner === 0 ? "JEU POUR VOUS" : "JEU ADVERSE";
      if (this.games[0] === 6 && this.games[1] === 6) this.tiebreak = true;
      if (!this.tiebreak && this.games[winner] >= 6 && this.games[winner] - this.games[loser] >= 2) {
        this.finishMatch(winner);
      }
      if (this.tiebreak && jeu && (this.games[0] === 7 || this.games[1] === 7)) this.finishMatch(winner);
    } else {
      this.serveSide *= -1;
      this.hud.banner = labels[reason];
    }
    this.bannerTimer = 1.45;
  }

  private finishMatch(winner: 0 | 1) {
    this.hud.matchOver = true;
    this.hud.winner = winner;
    this.overlay = "end";
    this.hud.overlay = "end";
    this.hud.banner = winner === 0 ? "VOUS GAGNEZ LE SET" : "SET ADVERSE";
    this.audio.whistle();
  }

  private resetPoint() {
    this.phase = "serve";
    this.bounces = 0;
    this.netVolleys = 0;
    this.charging = false;
    this.ballVel.set(0, 0, 0);
    const s = this.players[this.server];
    const side = this.serveSide * (s.team === 0 ? 1 : -1);
    s.group.position.set(side * 2.1, 0, HOME_POS[this.server][1]);
    this.placeBotsForServe();
    this.ballPos.set(s.group.position.x + 0.32, 0.86, s.group.position.z + (s.team === 0 ? -0.45 : 0.45));
    this.holdBallAtServer();
    this.hud.selectedShot = this.server === 0 ? "service" : "volee";
    this.hud.serverName = PLAYERS[this.server].name;
    this.hud.servingTeam = PLAYERS[this.server].team;
    if (this.server !== 0) this.botCooldown[this.server] = 1.05;
    this.trailPts = [];
  }

  private placeBotsForServe() {
    const returnLane = this.serveReturnerLane();
    const servingTeam = PLAYERS[this.server].team;
    for (let i = 1; i < 4; i++) {
      if (i === this.server) continue;
      const mySide = PLAYERS[i].team === 0 ? 1 : -1;
      const homeX = HOME_POS[i][0];
      const receiving = PLAYERS[i].team !== servingTeam;
      let z: number;
      if (receiving) {
        z = homeX * returnLane > 0 ? mySide * 4.35 : mySide * 1.9;
      } else {
        z = mySide * 1.9;
      }
      this.players[i].group.position.set(homeX, 0, z);
      this.players[i].vx = 0;
      this.players[i].vz = 0;
    }
  }

  private updateAimArc() {
    const shot = this.phase === "serve" ? "service" : this.hud.selectedShot;
    const pow = this.power;
    const dirZ = -1;
    const speed = shot === "lob" ? 8.2 : shot === "smash" ? 21 : shot === "bandeja" ? 13 : shot === "service" ? 11.4 : 16.5;
    const lift = shot === "lob" ? 8.6 : shot === "smash" ? 0.4 : shot === "service" ? 3.4 : shot === "bandeja" ? 2.6 : 1.15;
    const vx = this.aimOff.x * 1.4;
    const vz = dirZ * speed * (0.55 + 0.45 * pow);
    const vy = lift * (0.65 + 0.5 * pow);
    const arr = this.aimLine.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      const x = this.ballPos.x + vx * t * 0.35;
      const y = this.ballPos.y + vy * t + 0.5 * GRAVITY * (t * 0.9) * (t * 0.9);
      const z = this.ballPos.z + vz * t * 0.35;
      arr.setXYZ(i, x, Math.max(0.05, y), z);
    }
    arr.needsUpdate = true;
    this.aimLine.computeLineDistances();
  }

  private pushTrail() {
    this.trailPts.push(this.ballPos.x, this.ballPos.y, this.ballPos.z);
    if (this.trailPts.length > 84) this.trailPts.splice(0, this.trailPts.length - 84);
    const arr = this.trail.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < 28; i++) {
      const i3 = i * 3;
      if (i3 + 2 < this.trailPts.length) arr.setXYZ(i, this.trailPts[i3], this.trailPts[i3 + 1], this.trailPts[i3 + 2]);
      else arr.setXYZ(i, this.ballPos.x, this.ballPos.y, this.ballPos.z);
    }
    arr.needsUpdate = true;
  }

  private spawnBounce(x: number, z: number) {
    const m = this.bounceMarks.find((k) => k.userData.life <= 0) ?? this.bounceMarks[0];
    m.position.set(x, 0.02, z);
    m.userData.life = 0.55;
    m.scale.setScalar(0.4);
  }

  private spawnSparks(at: THREE.Vector3) {
    if (!this.sparks) return;
    for (let i = 0; i < 28; i++) {
      this.sparks.life[i] = 0.25 + Math.random() * 0.2;
      this.dummy.position.copy(at);
      this.dummy.position.x += (Math.random() - 0.5) * 0.2;
      this.dummy.position.y += Math.random() * 0.2;
      this.dummy.position.z += (Math.random() - 0.5) * 0.2;
      this.dummy.scale.setScalar(0.8);
      this.dummy.updateMatrix();
      this.sparks.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.sparks.mesh.instanceMatrix.needsUpdate = true;
  }

  private updateFx(dt: number) {
    for (const m of this.bounceMarks) {
      if (m.userData.life <= 0) {
        (m.material as THREE.MeshBasicMaterial).opacity = 0;
        continue;
      }
      m.userData.life -= dt;
      m.scale.setScalar(0.4 + (0.55 - m.userData.life) * 3);
      (m.material as THREE.MeshBasicMaterial).opacity = clamp(m.userData.life * 2, 0, 0.7);
    }
    if (this.sparks) {
      for (let i = 0; i < 28; i++) {
        if (this.sparks.life[i] > 0) this.sparks.life[i] -= dt;
      }
    }
    if (this.emote.visible) {
      const u = this.players[0].group.position;
      this.emote.position.set(u.x, 2.15, u.z);
      if (performance.now() > this.emoteUntil) this.emote.visible = false;
    }
  }

  private updateCamera(dt: number) {
    const u = this.players[0].group.position;
    let target = new THREE.Vector3(0, 13.2, 16.6);
    let look = new THREE.Vector3(0, 0.2, 0.8);
    if (this.camView === "behind") {
      target = new THREE.Vector3(u.x * 0.4, 4.2, u.z + 6.4);
      look = new THREE.Vector3(this.ballPos.x * 0.3, 0.6, this.ballPos.z);
    } else if (this.camView === "player") {
      target = new THREE.Vector3(u.x, 1.72, u.z + 0.55);
      look = this.ballPos.clone().lerp(new THREE.Vector3(u.x, 1.2, u.z - 4), 0.15);
    }
    const k = 1 - Math.pow(0.001, dt);
    this.camera.position.lerp(target, k);
    const cur = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).add(this.camera.position);
    cur.lerp(look, k);
    this.camera.lookAt(cur);
  }

  private syncHud() {
    const tb = this.tiebreak;
    const fmt = (a: number, b: number) => {
      if (tb) return String(a);
      if (a >= 3 && b >= 3) {
        if (a === b) return "40";
        return a > b ? "Av" : "40";
      }
      return POINT_NAMES[Math.min(a, 3)];
    };
    this.hud.gamesVous = this.games[0];
    this.hud.gamesAdversaire = this.games[1];
    this.hud.pointsVous = fmt(this.points[0], this.points[1]);
    this.hud.pointsAdversaire = fmt(this.points[1], this.points[0]);
    this.hud.servingTeam = PLAYERS[this.server].team;
    this.hud.serverName = PLAYERS[this.server].name;
    this.hud.playerName = PLAYERS[0].name;
    this.hud.names = PLAYERS.map((p) => p.name);
    this.hud.analog = this.analog;
    this.hud.shotButtons = { ...this.shotButtons };
    this.hud.shotKeys = { ...this.shotKeys };
    this.hud.hitKey = this.hitKey;
    this.hud.listeningBind = this.listeningBind;
    this.hud.ballSpeed = this.ballSpeed;
    this.hud.canHit = this.canHit;
    this.hud.charging = this.charging;
    this.hud.power = this.power;
    this.hud.camera = this.camView;
    this.hud.ping = clamp(this.frameMs, 8, 99);
    this.hud.phase = this.phase === "dead" ? "pause" : this.phase;
    this.hud.overlay = this.overlay;
  }

  private pushHud() {
    const snap: HudState = {
      ...this.hud,
      chat: this.hud.chat,
      statsVous: { ...this.hud.statsVous },
      statsAdv: { ...this.hud.statsAdv },
    };
    this.listeners.forEach((fn) => fn(snap));
  }

  private onResize() {
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(w, h);
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(e.code);
    if (this.listeningBind) {
      e.preventDefault();
      if (e.code === "Escape") this.cancelBind();
      else if (performance.now() > this.ignoreBindUntil) this.applyBind(e.code);
      return;
    }
    if (e.code === "Escape") {
      this.togglePause();
      return;
    }
    if (this.overlay !== "none") return;
    if (e.code === this.hitKey) this.beginCharge();
    const shot = (Object.keys(this.shotKeys) as ShotType[]).find((k) => this.shotKeys[k] === e.code);
    if (shot) this.setShot(shot);
    if (e.code === "KeyC") {
      const order: CameraView[] = ["match", "behind", "player"];
      this.setCamera(order[(order.indexOf(this.camView) + 1) % 3]);
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    this.keys.delete(e.code);
    if (e.code === this.hitKey) this.releaseCharge();
  }

  private onWinPointer(e: PointerEvent) {
    if (!this.listeningBind || performance.now() < this.ignoreBindUntil) return;
    e.preventDefault();
    const code = mouseCode(e.button);
    if (code) this.applyBind(code);
  }

  private onContext(e: Event) {
    e.preventDefault();
  }

  private onPtrDown(e: PointerEvent) {
    if (this.overlay !== "none") return;
    const code = mouseCode(e.button);
    const shot = (Object.keys(this.shotKeys) as ShotType[]).find((k) => this.shotKeys[k] === code);
    if (shot) this.setShot(shot);
    if (code === this.hitKey || e.button === 0) this.beginCharge();
  }

  private onPtrUp() {
    this.releaseCharge();
  }
}
