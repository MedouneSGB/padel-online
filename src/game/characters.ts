import * as THREE from "three";
import { PLAYERS } from "./constants";

export type Anim = "idle" | "run" | "swing";

export class PlayerRig {
  readonly group = new THREE.Group();
  readonly id: number;
  readonly team: 0 | 1;
  readonly user: boolean;
  name: string;
  vx = 0;
  vz = 0;
  anim: Anim = "idle";
  swingT = 0;
  lookX = 0;
  lookZ = -1;
  private torso: THREE.Object3D;
  private racket: THREE.Object3D;
  private leftLeg: THREE.Object3D;
  private rightLeg: THREE.Object3D;
  private leftArm: THREE.Object3D;
  private rightArm: THREE.Object3D;
  private bob = 0;
  private torsoY = 1.05;

  constructor(id: number) {
    const def = PLAYERS[id];
    this.id = id;
    this.team = def.team;
    this.user = def.user;
    this.name = def.name;

    const shirt = this.team === 0 ? 0xe8eef6 : 0x1a2430;
    const shorts = this.team === 0 ? 0x1a2430 : 0xdce3ee;
    const skin = def.skin;

    const lift = 0.12;
    const torsoY = 1.05 + lift;
    this.torsoY = torsoY;

    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.22, 0.38, 4, 8),
      new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.55 }),
    );
    torso.position.y = torsoY;
    torso.castShadow = true;
    this.torso = torso;

    const shortsM = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.2, 0.12, 3, 8),
      new THREE.MeshStandardMaterial({ color: shorts, roughness: 0.6 }),
    );
    shortsM.position.y = 0.72 + lift;
    shortsM.castShadow = true;

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 14, 12),
      new THREE.MeshStandardMaterial({ color: skin, roughness: 0.55 }),
    );
    head.position.y = 1.42 + lift;
    head.castShadow = true;

    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.165, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
      new THREE.MeshStandardMaterial({ color: def.hair, roughness: 0.8 }),
    );
    hair.position.set(0, 1.46 + lift, 0);
    hair.rotation.x = 0.15;

    this.leftLeg = this.limb(skin, shorts);
    this.rightLeg = this.limb(skin, shorts);
    this.leftLeg.position.set(-0.1, 0.62 + lift, 0);
    this.rightLeg.position.set(0.1, 0.62 + lift, 0);

    this.leftArm = this.arm(skin, shirt, false);
    this.rightArm = this.arm(skin, shirt, true);
    this.leftArm.position.set(-0.28, 1.18 + lift, 0);
    this.rightArm.position.set(0.28, 1.18 + lift, 0);

    this.racket = this.makeRacket();
    this.rightArm.add(this.racket);

    this.group.add(torso, shortsM, head, hair, this.leftLeg, this.rightLeg, this.leftArm, this.rightArm);

    if (def.cap) {
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.175, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshStandardMaterial({ color: 0xf2f5fa, roughness: 0.45 }),
      );
      cap.position.set(0, 1.5 + lift, 0);
      const brim = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.02, 0.16),
        new THREE.MeshStandardMaterial({ color: 0xf2f5fa }),
      );
      brim.position.set(0, 1.48 + lift, 0.16);
      this.group.add(cap, brim);
    }

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.38, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    this.group.add(shadow);
  }

  private limb(skin: number, shorts: number) {
    const g = new THREE.Group();
    const upper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.075, 0.28, 3, 6),
      new THREE.MeshStandardMaterial({ color: shorts, roughness: 0.6 }),
    );
    upper.position.y = -0.18;
    const lower = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.065, 0.28, 3, 6),
      new THREE.MeshStandardMaterial({ color: skin, roughness: 0.55 }),
    );
    lower.position.y = -0.48;
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.07, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.4 }),
    );
    shoe.position.set(0, -0.68, 0.04);
    g.add(upper, lower, shoe);
    g.castShadow = true;
    return g;
  }

  private arm(skin: number, shirt: number, right: boolean) {
    const g = new THREE.Group();
    const upper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.055, 0.22, 3, 6),
      new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.55 }),
    );
    upper.position.y = -0.14;
    const lower = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.048, 0.22, 3, 6),
      new THREE.MeshStandardMaterial({ color: skin, roughness: 0.55 }),
    );
    lower.position.y = -0.4;
    g.add(upper, lower);
    g.userData.right = right;
    return g;
  }

  private makeRacket() {
    const g = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.025, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.4 }),
    );
    const head = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.018, 8, 18),
      new THREE.MeshStandardMaterial({ color: 0x111318, metalness: 0.5, roughness: 0.3 }),
    );
    head.position.y = 0.28;
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(0.13, 16),
      new THREE.MeshStandardMaterial({
        color: 0x9ad0ff,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
      }),
    );
    face.position.y = 0.28;
    g.add(handle, head, face);
    g.position.set(0.05, -0.55, 0.12);
    g.rotation.x = 0.4;
    g.rotation.z = -0.35;
    return g;
  }

  playSwing() {
    this.anim = "swing";
    this.swingT = 0;
  }

  update(dt: number) {
    const speed = Math.hypot(this.vx, this.vz);
    if (this.anim !== "swing") this.anim = speed > 0.4 ? "run" : "idle";
    this.bob += dt * (this.anim === "run" ? 12 : 3);

    if (this.anim === "swing") {
      this.swingT += dt * 5.2;
      const t = Math.min(1, this.swingT);
      const a = Math.sin(t * Math.PI);
      this.rightArm.rotation.x = -1.6 * a;
      this.torso.rotation.y = 0.5 * a * (this.team === 0 ? -1 : 1);
      this.racket.rotation.x = 0.4 - 1.4 * a;
      if (t >= 1) {
        this.anim = "idle";
        this.rightArm.rotation.x = 0;
        this.torso.rotation.y = 0;
        this.racket.rotation.x = 0.4;
      }
    } else if (this.anim === "run") {
      const s = Math.sin(this.bob);
      this.leftLeg.rotation.x = s * 0.7;
      this.rightLeg.rotation.x = -s * 0.7;
      this.leftArm.rotation.x = -s * 0.45;
      this.rightArm.rotation.x = s * 0.35;
      this.torso.position.y = this.torsoY + Math.abs(s) * 0.03;
    } else {
      this.leftLeg.rotation.x *= 0.8;
      this.rightLeg.rotation.x *= 0.8;
      this.leftArm.rotation.x = Math.sin(this.bob) * 0.06;
      this.rightArm.rotation.x = 0.12;
      this.torso.position.y = this.torsoY + Math.sin(this.bob) * 0.012;
    }

    const lx = this.lookX;
    const lz = this.lookZ;
    const yaw = Math.atan2(lx, lz);
    this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, yaw, 1 - Math.pow(0.001, dt));
  }
}
