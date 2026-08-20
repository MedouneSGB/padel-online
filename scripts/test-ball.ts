import { computeLaunch, simulateFlight, type ShotType } from "../src/game/ballPhysics.ts";

const shots: ShotType[] = ["volee", "bandeja", "smash", "service", "lob"];
const starts = [
  { name: "fond adverse", x: 2, y: 0.86, z: -6.6 },
  { name: "filet adverse", x: -1.5, y: 0.95, z: -1.4 },
  { name: "service adverse", x: 2.1, y: 0.86, z: -6.6 },
];

let failed = 0;
for (const start of starts) {
  for (const shot of shots) {
    const launch = computeLaunch(start, { x: 1.2, z: 6.2 }, shot, 1);
    const sim = simulateFlight(start, { x: launch.vx, y: launch.vy, z: launch.vz });
    const peakOk = sim.peakY < 3.6;
    const falls = sim.landed && sim.t < 2.2;
    const toPlayer = sim.landZ > 0.3;
    const netOk = sim.netY === Infinity || sim.netY > 0.95;
    const ok = peakOk && falls && toPlayer && netOk;
    if (!ok) failed++;
    const net = sim.netY === Infinity ? "-" : sim.netY.toFixed(2);
    console.log(
      `${ok ? "OK " : "FAIL"} ${start.name.padEnd(16)} ${shot.padEnd(8)} t=${sim.t.toFixed(2)}s peak=${sim.peakY.toFixed(2)}m landZ=${sim.landZ.toFixed(2)} netY=${net} vy=${launch.vy.toFixed(2)}`,
    );
  }
}

if (failed) {
  console.error(`\n${failed} cas en échec`);
  process.exit(1);
}
console.log("\nTous les tirs adverses retombent dans le camp du joueur.");
