// Shared pieces for the 3D dioramas (portable-stage.ts, campus-stage.ts):
// geometry helpers, props, and the canvases drawn onto screens.
import * as THREE from "three";

export const BRAND = "#f59e0b";

// Lyrics from the homepage hero; `bg` indexes BGS
export const BGS = ["how", "bml"];
export const LYRICS = [
  { bg: 0, lines: ["When the music fades", "All is stripped away", "And I simply come"] },
  { bg: 0, lines: ["Longing just to bring", "something that's of worth", "That will bless Your heart"] },
  { bg: 1, lines: ["Holy, there is no one like You", "There is none beside You", "Open up my eyes in wonder", "Show me who You are and fill me"] },
  { bg: 1, lines: ["With Your heart and lead me", "In Your love to those around me"] },
];

export type V3 = [number, number, number];

export const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });

export function box(w: number, h: number, d: number, m: THREE.Material, at: V3) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(...at);
  return mesh;
}

export function pole(h: number, r: number, m: THREE.Material, at: V3) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), m);
  mesh.position.set(at[0], at[1] + h / 2, at[2]);
  return mesh;
}

export function plane(w: number, h: number, m: THREE.Material, at: V3) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  mesh.position.set(...at);
  return mesh;
}

export function cable(points: V3[], m: THREE.Material, r = 0.035) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.1);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 120, r, 8), m);
}

export function group(...children: THREE.Object3D[]) {
  const g = new THREE.Group();
  g.add(...children);
  return g;
}

export function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d")!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Front of a rack digital mixer (XR18-style): rows of combo inputs. */
export function drawXr(c: CanvasRenderingContext2D) {
  c.fillStyle = "#2a2d34";
  c.fillRect(0, 0, 512, 360);
  c.fillStyle = "#1b1d22";
  c.fillRect(20, 110, 472, 160);
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < 8; i++) {
      const x = 52 + i * 58;
      const y = 150 + row * 80;
      c.fillStyle = "#c9ccd3";
      c.beginPath();
      c.arc(x, y, 20, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#1b1d22";
      c.beginPath();
      c.arc(x, y, 11, 0, Math.PI * 2);
      c.fill();
    }
  c.fillStyle = BRAND;
  c.fillRect(20, 40, 120, 24);
  c.fillStyle = "#4ade80";
  c.beginPath();
  c.arc(470, 52, 8, 0, Math.PI * 2);
  c.fill();
}
export function drawMixer(c: CanvasRenderingContext2D) {
  c.fillStyle = "#3b3f48";
  c.fillRect(0, 0, 512, 360);
  for (let i = 0; i < 8; i++) {
    const x = 40 + i * 60;
    c.fillStyle = "#c9ccd3";
    for (const y of [50, 100]) {
      c.beginPath();
      c.arc(x, y, 14, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#16181d";
    c.fillRect(x - 3, 150, 6, 170);
    c.fillStyle = i === 3 ? BRAND : "#e5e7eb";
    c.fillRect(x - 16, 170 + ((i * 37) % 110), 32, 22);
  }
}

/** A lyric slide: the background cover-cropped, white bold lines on top. */
export function drawSlide(c: CanvasRenderingContext2D, w: number, h: number, bg: CanvasImageSource | undefined, lines: string[]) {
  c.fillStyle = "#000";
  c.fillRect(0, 0, w, h);
  const bw = bg instanceof HTMLVideoElement ? bg.videoWidth : (bg as HTMLImageElement | undefined)?.width;
  const bh = bg instanceof HTMLVideoElement ? bg.videoHeight : (bg as HTMLImageElement | undefined)?.height;
  if (bg && bw && bh) {
    const s = Math.max(w / bw, h / bh);
    c.drawImage(bg, (w - bw * s) / 2, (h - bh * s) / 2, bw * s, bh * s);
  }
  const size = h * 0.085;
  c.font = `700 ${size}px Arial, Helvetica, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = "#fff";
  c.shadowColor = "rgba(0, 0, 0, 0.8)";
  c.shadowBlur = size * 0.3;
  c.shadowOffsetY = size * 0.06;
  lines.forEach((l, i) => c.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.2));
  c.shadowColor = "transparent";
}

export function drawRemote(c: CanvasRenderingContext2D, slides: CanvasImageSource[], live: number) {
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, 640, 420);
  c.fillStyle = "#24252b";
  c.fillRect(0, 0, 640, 54);
  c.fillStyle = "#ffffff";
  c.font = "600 24px system-ui, sans-serif";
  c.fillText("Sunday service", 22, 36);
  slides.slice(0, 4).forEach((img, i) => {
    const x = 22 + (i % 2) * 308;
    const y = 76 + Math.floor(i / 2) * 172;
    c.drawImage(img, x, y, 288, 162);
    if (i === live) {
      c.strokeStyle = BRAND;
      c.lineWidth = 10;
      c.strokeRect(x - 2, y - 2, 292, 166);
    }
  });
}

export const CHAIR_PARTS: [V3, V3][] = [
  [[0.55, 0.06, 0.5], [0, 0.48, 0]],
  [[0.55, 0.5, 0.06], [0, 0.76, 0.23]],
  [[0.04, 0.46, 0.04], [0.24, 0.23, 0.21]],
  [[0.04, 0.46, 0.04], [-0.24, 0.23, 0.21]],
  [[0.04, 0.46, 0.04], [0.24, 0.23, -0.21]],
  [[0.04, 0.46, 0.04], [-0.24, 0.23, -0.21]],
];

/** Rows of chairs facing -z, as one instanced mesh per part. */
export function chairRows(spots: V3[], m: THREE.Material) {
  const g = new THREE.Group();
  const dummy = new THREE.Object3D();
  for (const [size, off] of CHAIR_PARTS) {
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(...size), m, spots.length);
    spots.forEach((p, i) => {
      dummy.position.set(p[0] + off[0], p[1] + off[1], p[2] + off[2]);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    g.add(inst);
  }
  return g;
}

/** One chair, turned `turn` radians from facing -z. */
export function chair(m: THREE.Material, at: V3, turn = 0) {
  const g = group(...CHAIR_PARTS.map(([size, off]) => box(...size, m, off)));
  g.position.set(...at);
  g.rotation.y = turn;
  return g;
}

export interface Materials {
  floor: THREE.Material;
  riser: THREE.Material;
  black: THREE.Material;
  metal: THREE.Material;
  chair: THREE.Material;
  wood: THREE.Material;
  red: THREE.Material;
  screen: THREE.Material;
  remote: THREE.Material;
  mixer: THREE.Material;
  xr: THREE.Material;
  wire: THREE.Material;
}

/** A Fire TV Stick, HDMI end up. */
export function stick(M: Materials, at: V3, turn: V3 = [0, 0, 0]) {
  const g = group(
    box(0.11, 0.3, 0.05, mat("#1f2025", { roughness: 0.4 }), [0, 0, 0]),
    box(0.06, 0.06, 0.03, M.metal, [0, 0.17, 0]),
    box(0.02, 0.02, 0.01, mat("#4fc3f7", { emissive: "#4fc3f7", emissiveIntensity: 2 }), [0, -0.1, 0.03]),
  );
  g.position.set(...at);
  g.rotation.set(...turn);
  return g;
}

/** A laptop whose screen shows the remote, hinge at the origin. */
export function laptop(M: Materials) {
  const lid = group(plane(0.58, 0.38, M.remote, [0, 0, 0.012]), box(0.62, 0.42, 0.02, M.metal, [0, 0, 0]));
  lid.position.y = 0.2;
  lid.rotation.x = -0.25;
  return group(lid, box(0.62, 0.03, 0.42, M.metal, [0, 0, 0.2]));
}

export function legs(w: number, d: number, h: number, m: THREE.Material) {
  return [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([x, z]) => box(0.05, h, 0.05, m, [(x * w) / 2, h / 2, (z * d) / 2]));
}

export function drawKeys(c: CanvasRenderingContext2D) {
  c.fillStyle = "#f8f8f6";
  c.fillRect(0, 0, 512, 64);
  c.fillStyle = "#1a1a1d";
  for (let i = 0; i <= 36; i++) c.fillRect(i * 14.2, 0, 1.5, 64);
  for (let i = 0; i < 36; i++) if (![2, 6].includes(i % 7)) c.fillRect(i * 14.2 + 9.5, 0, 8, 38);
}

export function keyboard(M: Materials) {
  const keys = new THREE.MeshStandardMaterial({ map: canvasTexture(512, 64, drawKeys), roughness: 0.5 });
  const g = group(
    box(1.25, 0.08, 0.36, M.black, [0, 0.82, 0]),
    plane(1.15, 0.16, keys, [0, 0.861, 0.08]).rotateX(-Math.PI / 2),
    box(0.04, 0.8, 0.04, M.black, [-0.45, 0.4, 0]).rotateZ(0.5),
    box(0.04, 0.8, 0.04, M.black, [-0.45, 0.4, 0]).rotateZ(-0.5),
    box(0.04, 0.8, 0.04, M.black, [0.45, 0.4, 0]).rotateZ(0.5),
    box(0.04, 0.8, 0.04, M.black, [0.45, 0.4, 0]).rotateZ(-0.5),
  );
  return g;
}

export function guitar(M: Materials, body = "#d08a4c") {
  const wood = mat(body, { roughness: 0.45 });
  const disc = (r: number, y: number) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.09, 24), wood);
    m.rotation.x = Math.PI / 2;
    m.position.y = y;
    return m;
  };
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), M.black);
  hole.position.set(0, 0.36, 0.047);
  return group(
    disc(0.21, 0.22),
    disc(0.16, 0.45),
    hole,
    box(0.06, 0.62, 0.035, M.wood, [0, 0.82, 0]),
    box(0.08, 0.14, 0.03, M.black, [0, 1.18, 0]),
  );
}

/** A guitar leaning back on a small stand. */
export function guitarOnStand(M: Materials, body?: string) {
  const gtr = guitar(M, body);
  gtr.rotation.x = -0.2;
  gtr.position.y = 0.06;
  return group(gtr, box(0.4, 0.04, 0.3, M.black, [0, 0.02, 0.05]), box(0.03, 0.5, 0.03, M.black, [0, 0.25, -0.12]));
}

export function drumKit(M: Materials) {
  const shell = mat("#c2414f", { roughness: 0.35, metalness: 0.2 });
  const head = mat("#f4f1ea", { roughness: 0.6 });
  const brass = mat("#d7a84a", { metalness: 0.8, roughness: 0.3 });
  const drum = (r: number, h: number, at: V3, side = false) => {
    const g = group(
      // The head is a touch taller and narrower, so it shows only at the ends
      new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28), shell),
      new THREE.Mesh(new THREE.CylinderGeometry(r * 0.96, r * 0.96, h + 0.01, 28), head),
    );
    if (side) g.rotation.x = Math.PI / 2;
    g.position.set(...at);
    return g;
  };
  const cymbal = (r: number, h: number, at: V3) =>
    group(
      pole(h, 0.015, M.metal, at),
      new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, 0.015, 28), brass).translateX(at[0]).translateY(at[1] + h).translateZ(at[2]),
    );
  return group(
    drum(0.32, 0.36, [0, 0.32, 0], true),
    drum(0.17, 0.12, [0.45, 0.62, 0.25]),
    drum(0.13, 0.15, [-0.12, 0.78, 0.1]),
    drum(0.14, 0.16, [0.18, 0.8, 0.08]),
    drum(0.2, 0.3, [-0.55, 0.4, 0.3]),
    cymbal(0.24, 1.15, [0.75, 0, -0.1]),
    cymbal(0.2, 0.9, [0.75, 0, 0.45]),
    cymbal(0.26, 1.25, [-0.6, 0, -0.25]),
    // Stool
    pole(0.5, 0.025, M.metal, [0.05, 0, -0.55]),
    new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.07, 20), M.black).translateX(0.05).translateY(0.53).translateZ(-0.55),
  );
}

/** A faint additive projector beam from `from` to a screen's four corners. */
export function beam(from: V3, corners: V3[]) {
  const pts: number[] = [];
  for (let i = 0; i < 4; i++) pts.push(...from, ...corners[i], ...corners[(i + 1) % 4]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: "#9db4ff",
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}
