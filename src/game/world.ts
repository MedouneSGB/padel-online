import * as THREE from "three";
import {
  COURT_HALF_L,
  COURT_HALF_W,
  COURT_LENGTH,
  COURT_WIDTH,
  FENCE_HEIGHT,
  GLASS_HEIGHT,
  NET_HEIGHT,
} from "./constants";
import {
  createCourtTexture,
  createFenceTexture,
  createLedTexture,
  createNetTexture,
} from "./textures";

function metal(color: number, roughness = 0.35) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.82,
    roughness,
  });
}

function glassMat() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xb8d4ee,
    transparent: true,
    opacity: 0.22,
    roughness: 0.06,
    metalness: 0.05,
    transmission: 0.55,
    thickness: 0.12,
    side: THREE.DoubleSide,
  });
}

function addPost(parent: THREE.Object3D, x: number, z: number, h: number) {
  const geo = new THREE.CylinderGeometry(0.045, 0.05, h, 8);
  const mesh = new THREE.Mesh(geo, metal(0x15181f, 0.4));
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function floodlight(x: number, z: number) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 11, 10), metal(0x22262e));
  pole.position.y = 5.5;
  g.add(pole);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.35, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x111318, metalness: 0.6, roughness: 0.3 }),
  );
  head.position.set(0, 11.05, 0);
  head.lookAt(0, 4, 0);
  g.add(head);
  const bulb = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.28),
    new THREE.MeshBasicMaterial({ color: 0xfff2c4 }),
  );
  bulb.position.set(0, 11.02, 0.05);
  g.add(bulb);
  g.position.set(x, 0, z);
  return g;
}

function makeCrowd(rng: () => number) {
  const count = 520;
  const bodyGeo = new THREE.CapsuleGeometry(0.12, 0.28, 2, 6);
  const headGeo = new THREE.SphereGeometry(0.11, 6, 6);
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xc2a07a, roughness: 0.7 });
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
  const heads = new THREE.InstancedMesh(headGeo, headMat, count);
  bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const palettes = [0x1b2430, 0x2e3a4a, 0x3a2a2a, 0x243428, 0x3a3a22, 0x202838, 0x4a2c38];

  let i = 0;
  const rings = [
    { y: 1.4, r0: 13.2, r1: 18.5, rows: 5 },
  ];
  for (const ring of rings) {
    for (let row = 0; row < ring.rows; row++) {
      const radius = ring.r0 + row * 1.05;
      const n = Math.floor(40 + row * 10);
      for (let k = 0; k < n && i < count; k++) {
        const a = (k / n) * Math.PI * 2 + row * 0.04;
        dummy.position.set(Math.sin(a) * radius, ring.y + row * 0.55 + rng() * 0.05, Math.cos(a) * radius);
        dummy.rotation.set(0, a + Math.PI, 0);
        dummy.scale.setScalar(0.85 + rng() * 0.3);
        dummy.updateMatrix();
        bodies.setMatrixAt(i, dummy.matrix);
        dummy.position.y += 0.32;
        dummy.updateMatrix();
        heads.setMatrixAt(i, dummy.matrix);
        color.setHex(palettes[Math.floor(rng() * palettes.length)]);
        bodies.setColorAt(i, color);
        i++;
      }
    }
  }
  bodies.count = i;
  heads.count = i;
  bodies.castShadow = false;
  heads.castShadow = false;
  const group = new THREE.Group();
  group.add(bodies, heads);
  return group;
}

export function buildWorld(scene: THREE.Scene) {
  const root = new THREE.Group();
  scene.add(root);

  const courtTex = createCourtTexture();
  const court = new THREE.Mesh(
    new THREE.PlaneGeometry(COURT_WIDTH, COURT_LENGTH),
    new THREE.MeshStandardMaterial({
      map: courtTex,
      roughness: 0.62,
      metalness: 0.04,
    }),
  );
  court.rotation.x = -Math.PI / 2;
  court.receiveShadow = true;
  root.add(court);

  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 26),
    new THREE.MeshStandardMaterial({ color: 0x0c1a2e, roughness: 0.9 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.02;
  apron.receiveShadow = true;
  root.add(apron);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(42, 48),
    new THREE.MeshStandardMaterial({ color: 0x0a1018, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.06;
  root.add(floor);

  const gMat = glassMat();
  const fenceTex = createFenceTexture();
  const fenceMat = new THREE.MeshStandardMaterial({
    map: fenceTex,
    transparent: true,
    roughness: 0.5,
    metalness: 0.2,
    side: THREE.DoubleSide,
    alphaTest: 0.15,
  });

  const nearCage = new THREE.Group();
  nearCage.name = "nearCage";
  root.add(nearCage);

  const addWall = (w: number, x: number, z: number, rotY: number, parent: THREE.Object3D = root) => {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, GLASS_HEIGHT), gMat);
    glass.position.set(x, GLASS_HEIGHT / 2, z);
    glass.rotation.y = rotY;
    parent.add(glass);
    const fence = new THREE.Mesh(new THREE.PlaneGeometry(w, FENCE_HEIGHT), fenceMat.clone());
    fence.position.set(x, GLASS_HEIGHT + FENCE_HEIGHT / 2, z);
    fence.rotation.y = rotY;
    parent.add(fence);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.06), metal(0x101318));
    bar.position.set(x, GLASS_HEIGHT, z);
    bar.rotation.y = rotY;
    parent.add(bar);
  };

  addWall(COURT_WIDTH, 0, COURT_HALF_L, 0, nearCage);
  addWall(COURT_WIDTH, 0, -COURT_HALF_L, 0);
  addWall(COURT_LENGTH, COURT_HALF_W, 0, Math.PI / 2);
  addWall(COURT_LENGTH, -COURT_HALF_W, 0, Math.PI / 2);

  for (let x = -COURT_HALF_W; x <= COURT_HALF_W + 0.01; x += 2.5) {
    addPost(nearCage, x, COURT_HALF_L, GLASS_HEIGHT + FENCE_HEIGHT);
    addPost(root, x, -COURT_HALF_L, GLASS_HEIGHT + FENCE_HEIGHT);
  }
  for (let z = -COURT_HALF_L + 2.5; z < COURT_HALF_L; z += 2.5) {
    addPost(root, COURT_HALF_W, z, GLASS_HEIGHT + FENCE_HEIGHT);
    addPost(root, -COURT_HALF_W, z, GLASS_HEIGHT + FENCE_HEIGHT);
  }

  const netTex = createNetTexture();
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(COURT_WIDTH - 0.2, NET_HEIGHT),
    new THREE.MeshStandardMaterial({
      map: netTex,
      transparent: true,
      side: THREE.DoubleSide,
      roughness: 0.5,
    }),
  );
  net.position.y = NET_HEIGHT / 2;
  root.add(net);
  addPost(root, COURT_HALF_W, 0, NET_HEIGHT + 0.08);
  addPost(root, -COURT_HALF_W, 0, NET_HEIGHT + 0.08);

  const ledTex = createLedTexture();
  const mkLed = (w: number, x: number, z: number, rotY: number, parent: THREE.Object3D = root) => {
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(w, 0.7),
      new THREE.MeshStandardMaterial({ map: ledTex, emissive: 0x113344, emissiveIntensity: 0.6 }),
    );
    board.position.set(x, 1.55, z);
    board.rotation.y = rotY;
    parent.add(board);
  };
  mkLed(8, 0, COURT_HALF_L + 0.35, Math.PI, nearCage);
  mkLed(8, 0, -COURT_HALF_L - 0.35, 0);

  const stands = new THREE.Mesh(
    new THREE.CylinderGeometry(19, 21, 3.2, 40, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 0.9, side: THREE.DoubleSide }),
  );
  stands.position.y = 1.4;
  root.add(stands);

  let seed = 17;
  const rng = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  root.add(makeCrowd(rng));

  root.add(floodlight(12, 12));
  root.add(floodlight(-12, 12));
  root.add(floodlight(12, -12));
  root.add(floodlight(-12, -12));

  const hemi = new THREE.HemisphereLight(0x6a7ca0, 0x0c1a12, 0.55);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x1a2433, 0.45);
  scene.add(ambient);

  const spots: THREE.SpotLight[] = [];
  const corners: [number, number][] = [
    [11, 11],
    [-11, 11],
    [11, -11],
    [-11, -11],
  ];
  for (const [x, z] of corners) {
    const spot = new THREE.SpotLight(0xfff3d6, 90, 48, 0.55, 0.45, 1.4);
    spot.position.set(x, 12.2, z);
    spot.target.position.set(0, 0, 0);
    spot.castShadow = x > 0 && z > 0;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.00015;
    scene.add(spot, spot.target);
    spots.push(spot);
  }

  const fill = new THREE.DirectionalLight(0x88a0c8, 0.35);
  fill.position.set(-8, 14, 6);
  scene.add(fill);

  return { root, spots };
}
