import * as THREE from "three";

function noise(ctx: CanvasRenderingContext2D, amount: number) {
  const { width, height } = ctx.canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

export function createCourtTexture() {
  const w = 1024;
  const h = 2048;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;

  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#0f4fa8");
  grad.addColorStop(0.5, "#1a73dc");
  grad.addColorStop(1, "#0f4fa8");
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  g.fillStyle = "#1780ee";
  g.fillRect(w * 0.08, h * 0.08, w * 0.84, h * 0.84);

  noise(g, 16);

  const line = (fn: () => void) => {
    g.strokeStyle = "rgba(255,255,255,0.95)";
    g.lineWidth = 7;
    g.lineJoin = "miter";
    g.beginPath();
    fn();
    g.stroke();
  };

  const padX = 36;
  const padZ = 36;
  const x0 = padX;
  const x1 = w - padX;
  const z0 = padZ;
  const z1 = h - padZ;
  const midZ = h / 2;
  const midX = w / 2;
  const serviceOffset = (3.05 / 20) * (z1 - z0);

  line(() => {
    g.rect(x0, z0, x1 - x0, z1 - z0);
  });
  line(() => {
    g.moveTo(x0, midZ);
    g.lineTo(x1, midZ);
  });
  line(() => {
    g.moveTo(x0, midZ - serviceOffset);
    g.lineTo(x1, midZ - serviceOffset);
  });
  line(() => {
    g.moveTo(x0, midZ + serviceOffset);
    g.lineTo(x1, midZ + serviceOffset);
  });
  line(() => {
    g.moveTo(midX, midZ - serviceOffset);
    g.lineTo(midX, midZ + serviceOffset);
  });

  g.save();
  g.translate(midX, midZ);
  g.rotate(-Math.PI / 2);
  g.font = "800 54px 'Exo 2', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "rgba(255,255,255,0.16)";
  g.fillText("PADEL ONLINE", 0, 0);
  g.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFenceTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(20,24,30,0.82)";
  g.lineWidth = 3;
  for (let i = -256; i < 256; i += 18) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 256, 256);
    g.stroke();
    g.beginPath();
    g.moveTo(i + 256, 0);
    g.lineTo(i, 256);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createNetTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 512, 128);
  g.strokeStyle = "rgba(230,230,235,0.55)";
  g.lineWidth = 1.4;
  for (let x = 0; x <= 512; x += 10) {
    g.beginPath();
    g.moveTo(x, 16);
    g.lineTo(x, 128);
    g.stroke();
  }
  for (let y = 16; y <= 128; y += 10) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(512, y);
    g.stroke();
  }
  g.fillStyle = "#f4f6fb";
  g.fillRect(0, 0, 512, 14);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBallTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(110, 100, 20, 128, 128, 128);
  grd.addColorStop(0, "#e8ff4a");
  grd.addColorStop(1, "#9bb800");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#f7fff0";
  g.lineWidth = 10;
  g.beginPath();
  g.arc(40, 128, 110, -0.8, 0.8);
  g.stroke();
  g.beginPath();
  g.arc(216, 128, 110, Math.PI - 0.8, Math.PI + 0.8);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createLedTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#05070c";
  g.fillRect(0, 0, 1024, 128);
  g.font = "800 54px 'Exo 2', sans-serif";
  g.fillStyle = "#3fe0ff";
  g.textBaseline = "middle";
  g.fillText("  PADEL ONLINE    •    PADEL ONLINE    •    PADEL ONLINE  ", 20, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
