import { BALL_RADIUS, GRAVITY, NET_HEIGHT } from "./constants";

export { BALL_RADIUS, GRAVITY, NET_HEIGHT };

export type ShotType = "lob" | "smash" | "service" | "volee" | "bandeja";

export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export function computeLaunch(
  from: { x: number; y: number; z: number },
  target: { x: number; z: number },
  shot: ShotType,
  toward: 1 | -1,
  speedScale = 1,
) {
  let tz = target.z;
  if (Math.sign(tz - from.z) !== toward) tz = toward * 6.2;

  const dx = target.x - from.x;
  const dz = tz - from.z;
  const dist = Math.max(5, Math.hypot(dx, dz));

  let speed = 13.5;
  if (shot === "volee") speed = 15.5;
  else if (shot === "smash") speed = 18;
  else if (shot === "bandeja") speed = 13;
  else if (shot === "lob") speed = 9;
  else if (shot === "service") speed = 10.5;

  const scale = clamp(speedScale, 0.45, 1.2);
  speed *= scale;
  const t = clamp(dist / speed, (shot === "lob" ? 0.9 : 0.52) / scale, (shot === "lob" ? 1.2 : 0.85) / scale);
  const vx = dx / t;
  let vz = dz / t;
  const minVz = 9 * scale;
  if (toward > 0) vz = Math.max(minVz, vz);
  else vz = Math.min(-minVz, vz);

  let vy = (BALL_RADIUS - from.y - 0.5 * GRAVITY * t * t) / t;
  const tNet = clamp((Math.abs(from.z) / Math.max(Math.abs(vz), 0.1)) * 0.95, 0.08, t * 0.8);
  const yNet = from.y + vy * tNet + 0.5 * GRAVITY * tNet * tNet;
  if (yNet < NET_HEIGHT + 0.2) {
    const need = NET_HEIGHT + 0.28;
    vy = (need - from.y - 0.5 * GRAVITY * tNet * tNet) / tNet;
  }
  if (shot === "lob") vy = clamp(vy, 4, 6.2);
  else if (shot === "smash") vy = clamp(vy, 1.3, 3.4);
  else vy = clamp(vy, 2.0, 4.2);

  const yNetAfter = from.y + vy * tNet + 0.5 * GRAVITY * tNet * tNet;
  if (yNetAfter < NET_HEIGHT + 0.22) {
    vy = (NET_HEIGHT + 0.3 - from.y - 0.5 * GRAVITY * tNet * tNet) / tNet;
  }

  return { vx, vy, vz, t };
}

export function simulateFlight(
  pos: { x: number; y: number; z: number },
  vel: { x: number; y: number; z: number },
  dt = 1 / 60,
  maxTime = 3,
) {
  const path: { t: number; x: number; y: number; z: number }[] = [];
  let t = 0;
  let peakY = pos.y;
  let netY = Infinity;
  let landed = false;
  const p = { ...pos };
  const v = { ...vel };

  while (t < maxTime) {
    v.y += GRAVITY * dt;
    p.x += v.x * dt;
    p.y += v.y * dt;
    p.z += v.z * dt;
    t += dt;
    peakY = Math.max(peakY, p.y);
    if (Math.sign(p.z - v.z * dt) !== Math.sign(p.z)) netY = p.y;
    path.push({ t, x: p.x, y: p.y, z: p.z });
    if (p.y <= BALL_RADIUS && v.y < 0) {
      landed = true;
      p.y = BALL_RADIUS;
      break;
    }
  }

  return {
    landed,
    t,
    peakY,
    netY,
    landX: p.x,
    landZ: p.z,
    crossedNet: Math.sign(pos.z) !== Math.sign(p.z) || Math.abs(p.z) < 0.4,
    path,
  };
}
