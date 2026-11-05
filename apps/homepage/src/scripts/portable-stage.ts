// Live 3D hero for /portable-church (PortableStage.astro). Two places, a
// Sunday hall with a projector and a midweek room with a TV, each shown the
// usual way or with TheOpenPresenter. The screens show the first lyric over
// the homepage hero's background, and the remotes list the slides with it
// outlined.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const BRAND = "#f59e0b";

// Lyrics from the homepage hero; `bg` indexes BGS
const BGS = ["how", "bml"];
const LYRICS = [
  { bg: 0, lines: ["When the music fades", "All is stripped away", "And I simply come"] },
  { bg: 0, lines: ["Longing just to bring", "something that's of worth", "That will bless Your heart"] },
  { bg: 1, lines: ["Holy, there is no one like You", "There is none beside You", "Open up my eyes in wonder", "Show me who You are and fill me"] },
  { bg: 1, lines: ["With Your heart and lead me", "In Your love to those around me"] },
];

type V3 = [number, number, number];
type Place = "hall" | "room";
type Way = "top" | "usual";

const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });

function box(w: number, h: number, d: number, m: THREE.Material, at: V3) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(...at);
  return mesh;
}

function pole(h: number, r: number, m: THREE.Material, at: V3) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), m);
  mesh.position.set(at[0], at[1] + h / 2, at[2]);
  return mesh;
}

function plane(w: number, h: number, m: THREE.Material, at: V3) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  mesh.position.set(...at);
  return mesh;
}

function cable(points: V3[], m: THREE.Material, r = 0.035) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.1);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 120, r, 8), m);
}

function group(...children: THREE.Object3D[]) {
  const g = new THREE.Group();
  g.add(...children);
  return g;
}

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
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
function drawXr(c: CanvasRenderingContext2D) {
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
function drawMixer(c: CanvasRenderingContext2D) {
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
function drawSlide(c: CanvasRenderingContext2D, w: number, h: number, bg: CanvasImageSource | undefined, lines: string[]) {
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

function drawRemote(c: CanvasRenderingContext2D, slides: CanvasImageSource[], live: number) {
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

const CHAIR_PARTS: [V3, V3][] = [
  [[0.55, 0.06, 0.5], [0, 0.48, 0]],
  [[0.55, 0.5, 0.06], [0, 0.76, 0.23]],
  [[0.04, 0.46, 0.04], [0.24, 0.23, 0.21]],
  [[0.04, 0.46, 0.04], [-0.24, 0.23, 0.21]],
  [[0.04, 0.46, 0.04], [0.24, 0.23, -0.21]],
  [[0.04, 0.46, 0.04], [-0.24, 0.23, -0.21]],
];

/** Rows of chairs facing -z, as one instanced mesh per part. */
function chairRows(spots: V3[], m: THREE.Material) {
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
function chair(m: THREE.Material, at: V3, turn = 0) {
  const g = group(...CHAIR_PARTS.map(([size, off]) => box(...size, m, off)));
  g.position.set(...at);
  g.rotation.y = turn;
  return g;
}

interface Materials {
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
function stick(M: Materials, at: V3, turn: V3 = [0, 0, 0]) {
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
function laptop(M: Materials) {
  const lid = group(plane(0.58, 0.38, M.remote, [0, 0, 0.012]), box(0.62, 0.42, 0.02, M.metal, [0, 0, 0]));
  lid.position.y = 0.2;
  lid.rotation.x = -0.25;
  return group(lid, box(0.62, 0.03, 0.42, M.metal, [0, 0, 0.2]));
}

function legs(w: number, d: number, h: number, m: THREE.Material) {
  return [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([x, z]) => box(0.05, h, 0.05, m, [(x * w) / 2, h / 2, (z * d) / 2]));
}

function drawKeys(c: CanvasRenderingContext2D) {
  c.fillStyle = "#f8f8f6";
  c.fillRect(0, 0, 512, 64);
  c.fillStyle = "#1a1a1d";
  for (let i = 0; i <= 36; i++) c.fillRect(i * 14.2, 0, 1.5, 64);
  for (let i = 0; i < 36; i++) if (![2, 6].includes(i % 7)) c.fillRect(i * 14.2 + 9.5, 0, 8, 38);
}

function keyboard(M: Materials) {
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

function guitar(M: Materials, body = "#d08a4c") {
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
function guitarOnStand(M: Materials, body?: string) {
  const gtr = guitar(M, body);
  gtr.rotation.x = -0.2;
  gtr.position.y = 0.06;
  return group(gtr, box(0.4, 0.04, 0.3, M.black, [0, 0.02, 0.05]), box(0.03, 0.5, 0.03, M.black, [0, 0.25, -0.12]));
}

function drumKit(M: Materials) {
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

function buildHall(M: Materials) {
  const top = 0.45;
  const base = new THREE.Mesh(new RoundedBoxGeometry(11, 0.5, 11, 4, 0.18), M.floor);
  base.position.y = -0.25;

  // Fast-fold screen and a projector on a stand in the aisle, with a beam
  const corners: V3[] = [
    [-2, top + 1.075, -4.54],
    [2, top + 1.075, -4.54],
    [2, top + 3.325, -4.54],
    [-2, top + 3.325, -4.54],
  ];
  const proj: V3 = [0, 1.3, 3.4];
  const pts: number[] = [];
  for (let i = 0; i < 4; i++) pts.push(...proj, ...corners[i], ...corners[(i + 1) % 4]);
  const beamGeo = new THREE.BufferGeometry();
  beamGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  const beam = new THREE.Mesh(
    beamGeo,
    new THREE.MeshBasicMaterial({
      color: "#9db4ff",
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  const shared = group(
    base,
    box(10.2, 0.45, 3.6, M.riser, [0, 0.225, -3.4]),
    plane(4, 2.25, M.screen, [0, top + 2.2, -4.55]),
    box(4.2, 2.45, 0.04, M.black, [0, top + 2.2, -4.6]),
    pole(3.5, 0.035, M.black, [-2.15, top, -4.6]),
    pole(3.5, 0.035, M.black, [2.15, top, -4.6]),
    pole(1.15, 0.03, M.black, [0, 0, 3.5]),
    box(0.6, 0.04, 0.5, M.black, [0, 1.17, 3.5]),
    box(0.46, 0.18, 0.4, mat("#d9dbe0"), [0, 1.28, 3.5]),
    beam,
    // Mic stand
    pole(1.5, 0.018, M.black, [0.5, top, -2.3]),
    box(0.06, 0.18, 0.06, M.black, [0.5, top + 1.58, -2.3]),
  );
  const kit = drumKit(M);
  kit.position.set(3.3, top, -3.8);
  kit.rotation.y = Math.PI + 0.5;
  const keys = keyboard(M);
  keys.position.set(-1.9, top, -3.4);
  keys.rotation.y = 0.15;
  const gtr = guitarOnStand(M);
  gtr.position.set(2.5, top, -2.3);
  gtr.rotation.y = -0.4;
  shared.add(kit, keys, gtr);
  for (const x of [-4.6, 4.6])
    shared.add(pole(1.2, 0.03, M.black, [x, top, -2.2]), box(0.5, 0.8, 0.45, M.black, [x, top + 1.6, -2.2]));
  const spots: V3[] = [];
  for (const z of [-0.5, 0.55, 1.6, 2.65]) for (const x of [1.1, 1.95, 2.8]) spots.push([x, 0, z], [-x, 0, z]);
  shared.add(chairRows(spots, M.chair));

  // Where each instrument's lead leaves it: drums, guitar, mic, keys
  const sources: V3[][] = [
    [[3.0, top + 0.4, -3.4], [2.9, top + 0.03, -3.0]],
    [[2.5, top + 0.4, -2.25], [2.5, top + 0.03, -2.15]],
    [[0.5, top + 1.5, -2.3], [0.53, top + 0.03, -2.25]],
    [[-1.9, top + 0.8, -3.35], [-1.9, top + 0.03, -3.1]],
  ];
  // Leads run along the front of the stage into a box at the front right:
  // the digital mixer, or a stage box for the snake to the booth
  shared.add(
    ...sources.map((src, i) => {
      const x = 4.08 + i * 0.08;
      const z = -1.7 - i * 0.04;
      const path: V3[] = [...src, [src[1][0], top + 0.03, z], [x, top + 0.03, z], [x, top + 0.15, -1.8]];
      return cable(path, M.wire, 0.018);
    }),
  );
  const frontBox: V3 = [4.2, top + 0.14, -2.0];

  // With TheOpenPresenter: a digital mixer on stage, a Fire TV Stick in the
  // projector, and an iPad in the seats
  const mixer = group(box(0.5, 0.28, 0.36, M.black, [0, 0, 0]), plane(0.46, 0.24, M.xr, [0, 0, 0.181]));
  mixer.position.set(...frontBox);
  const ipad = group(plane(0.56, 0.37, M.remote, [0, 0, 0.012]), box(0.62, 0.43, 0.02, M.black, [0, 0, 0]));
  ipad.position.set(0.5, 1.05, 1.15);
  ipad.rotation.set(-0.7, 0, 0);
  ipad.scale.setScalar(1.5);
  const withTop = group(
    mixer,
    stick(M, [0.43, 1.28, 3.5], [0, 0, Math.PI / 2]),
    pole(0.95, 0.02, M.black, [0.5, 0, 1.1]),
    ipad,
  );

  // The usual way: leads to a stage box, a snake down the hall to the booth,
  // and the booth's laptop cabled to the projector
  const booth = group(
    box(2, 0.06, 0.9, M.wood, [0, 0.75, 0]),
    ...legs(1.8, 0.76, 0.72, M.black),
    box(0.7, 0.12, 0.5, M.black, [0.45, 0.84, 0]),
    plane(0.62, 0.42, M.mixer, [0.45, 0.905, 0]).rotateX(-Math.PI / 2),
    chair(M.chair, [0, 0, 0.75]),
  );
  const boothLaptop = laptop(M);
  boothLaptop.position.set(-0.45, 0.8, -0.1);
  booth.add(boothLaptop);
  booth.position.set(3.2, 0, 4.3);
  const usual = group(
    booth,
    box(0.5, 0.28, 0.36, M.black, frontBox),
    cable(
      [
        [4.3, top + 0.12, -1.85],
        [4.75, top + 0.03, -1.8],
        [5.05, 0.04, -1.2],
        [5.15, 0.04, 3.0],
        [4.4, 0.04, 4.05],
        [3.65, 0.75, 4.15],
      ],
      M.red,
    ),
    cable(
      [
        [2.75, 0.8, 4.2],
        [2.4, 0.04, 4.0],
        [0.4, 0.04, 3.65],
        [0.05, 0.4, 3.5],
        [0.05, 1.2, 3.5],
      ],
      M.red,
    ),
  );

  return { shared, top: withTop, usual };
}

function buildRoom(M: Materials) {
  const base = new THREE.Mesh(new RoundedBoxGeometry(8, 0.4, 8, 4, 0.15), M.floor);
  base.position.y = -0.2;
  const wall = mat("#efe6da");
  const sofa = mat("#4f8f8c");
  const shared = group(
    base,
    box(8, 3.2, 0.2, wall, [0, 1.6, -3.9]),
    box(0.2, 3.2, 7.8, wall, [-3.9, 1.6, 0.1]),
    plane(3.6, 2.6, mat("#cf7a55"), [0, 0.01, 0.4]).rotateX(-Math.PI / 2),
    // TV on the wall above a low cabinet
    box(2.6, 1.5, 0.08, M.black, [0, 1.95, -3.76]),
    plane(2.48, 1.395, M.screen, [0, 1.95, -3.715]),
    box(3, 0.5, 0.5, M.wood, [0, 0.25, -3.5]),
    // Sofa facing the TV, a coffee table, chairs at the sides
    box(2.8, 0.45, 0.9, sofa, [0, 0.225, 2.1]),
    box(2.8, 0.65, 0.22, sofa, [0, 0.75, 2.5]),
    box(0.22, 0.65, 0.9, sofa, [-1.4, 0.45, 2.1]),
    box(0.22, 0.65, 0.9, sofa, [1.4, 0.45, 2.1]),
    box(1.4, 0.4, 0.8, M.wood, [0, 0.2, 0.6]),
    chair(M.chair, [-2.4, 0, 0.4], -Math.PI / 2.4),
    chair(M.chair, [-2.4, 0, -0.7], -Math.PI / 2.2),
    chair(M.chair, [2.4, 0, -0.2], Math.PI / 2.2),
    // Floor lamp
    pole(1.8, 0.03, M.black, [-3.3, 0, -3.3]),
    box(0.4, 0.35, 0.4, mat("#f3d9a8", { emissive: "#f3b45a", emissiveIntensity: 0.8 }), [-3.3, 1.95, -3.3]),
  );
  const roomGtr = guitarOnStand(M, "#8a5a3c");
  roomGtr.position.set(-3.1, 0, 1.6);
  roomGtr.rotation.y = 0.9;
  shared.add(roomGtr, box(0.42, 0.55, 0.42, M.wood, [-2.9, 0.275, 2.6]));
  const lamp = new THREE.PointLight("#ffb05a", 5, 7, 0);
  lamp.position.set(-3.1, 1.7, -3.1);
  shared.add(lamp);

  // With TheOpenPresenter: a stick in the TV and a phone on the table
  const phone = group(
    box(0.18, 0.02, 0.34, M.black, [0, 0, 0]),
    plane(0.3, 0.16, M.remote, [0, 0.011, 0]).rotateX(-Math.PI / 2).rotateZ(Math.PI / 2),
  );
  phone.position.set(0.25, 0.42, 0.6);
  phone.rotation.y = 0.4;
  const tvStick = stick(M, [1.15, 1.04, -3.68]);
  const stickRemote = box(0.07, 0.025, 0.3, mat("#1f2025"), [1.45, 0.515, -3.35]);
  stickRemote.rotation.y = 0.3;
  const withTop = group(tvStick, stickRemote, phone);

  // The usual way: a laptop on a side table, cabled to the TV
  const side = group(box(1, 0.05, 0.7, M.wood, [0, 0.72, 0]), ...legs(0.9, 0.6, 0.7, M.black), chair(M.chair, [0, 0, 0.65]));
  const sideLaptop = laptop(M);
  sideLaptop.position.set(0, 0.76, -0.1);
  side.add(sideLaptop);
  side.position.set(2.6, 0, 1.6);
  const usual = group(
    side,
    cable(
      [
        [2.6, 0.76, 1.3],
        [2.9, 0.04, 1.1],
        [2.9, 0.04, -1.5],
        [1.6, 0.04, -3.1],
        [1.2, 0.5, -3.55],
        [1.0, 1.4, -3.74],
      ],
      M.red,
    ),
  );

  return { shared, top: withTop, usual };
}

const VIEWS: Record<Place, { r: number; target: V3 }> = {
  hall: { r: 29, target: [0.3, 0.6, -0.2] },
  room: { r: 21, target: [0, 0.9, -0.4] },
};

function init(root: HTMLElement) {
  const canvas = root.querySelector("canvas")!;
  const stage = canvas.parentElement!;
  const labels = [...root.querySelectorAll<HTMLElement>("[data-at]")];
  const buttons = [...root.querySelectorAll<HTMLButtonElement>("button[data-set]")];
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 4 / 3, 0.1, 100);

  // The live slide and the remote, shared by every screen
  const remoteCanvas = document.createElement("canvas");
  remoteCanvas.width = 640;
  remoteCanvas.height = 420;
  const remoteTex = new THREE.CanvasTexture(remoteCanvas);
  remoteTex.colorSpace = THREE.SRGBColorSpace;
  remoteTex.anisotropy = 4;
  // The main screen: a lyric drawn over the live background every frame
  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = 960;
  screenCanvas.height = 540;
  const screenCtx = screenCanvas.getContext("2d")!;
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = 4;
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
  const M: Materials = {
    floor: mat("#d8c3a5"),
    riser: mat("#5b5d64"),
    black: mat("#24252b", { roughness: 0.5 }),
    metal: mat("#c9cdd5", { metalness: 0.6, roughness: 0.35 }),
    chair: mat("#4a5068"),
    wood: mat("#a77b55"),
    red: mat("#ef4444", { roughness: 0.5 }),
    screen: screenMat,
    remote: new THREE.MeshBasicMaterial({ map: remoteTex }),
    mixer: new THREE.MeshStandardMaterial({ map: canvasTexture(512, 360, drawMixer), roughness: 0.6 }),
    xr: new THREE.MeshStandardMaterial({ map: canvasTexture(512, 360, drawXr), roughness: 0.6 }),
    wire: mat("#2b2d33", { roughness: 0.6 }),
  };

  const places = { hall: buildHall(M), room: buildRoom(M) };
  // Each part grows in or shrinks out towards its wanted scale. The extras
  // for each way grow piece by piece, in place.
  const parts = new Map<THREE.Object3D, number>();
  const pieces = (g: THREE.Object3D) => [...g.children];
  for (const p of Object.values(places)) {
    scene.add(p.shared, p.top, p.usual);
    for (const o of [p.shared, ...pieces(p.top), ...pieces(p.usual)]) {
      parts.set(o, 0);
      o.scale.setScalar(0.001);
    }
  }
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material !== screenMat && !(o.material as THREE.Material).transparent)
      o.castShadow = o.receiveShadow = true;
  });

  // Lighting: cool fill, a warm key, a violet rim and a soft front fill
  scene.add(new THREE.HemisphereLight("#ffffff", "#b5a690", 1.7));
  const key = new THREE.SpotLight("#ffd2a0", 7, 40, 0.6, 0.6, 0);
  key.position.set(-2, 8, 3);
  key.target.position.set(0, 0, -3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0005;
  scene.add(key, key.target);
  const rim = new THREE.SpotLight("#ffe6c8", 2, 40, 0.6, 0.7, 0);
  rim.position.set(6, 6, -1);
  rim.target.position.set(-2, 0, -2);
  scene.add(rim, rim.target);
  const fill = new THREE.DirectionalLight("#fff3e6", 1.3);
  fill.position.set(6, 10, 9);
  scene.add(fill);

  // Magnifier: a second renderer with a close-up of the Fire TV Stick
  const lens = root.querySelector<HTMLElement>("[data-lens]")!;
  const lensCanvas = lens.querySelector("canvas")!;
  const lensSvg = root.querySelector<SVGSVGElement>("[data-lens-line]")!;
  const lensLine = lensSvg.querySelector("line")!;
  let lensRenderer: THREE.WebGLRenderer | undefined;
  try {
    lensRenderer = new THREE.WebGLRenderer({ canvas: lensCanvas, antialias: true });
    lensRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    lensRenderer.setClearColor("#efe6da");
    lensRenderer.outputColorSpace = THREE.SRGBColorSpace;
    lensRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    lensRenderer.shadowMap.enabled = true;
  } catch {
    lensRenderer = undefined;
  }
  const lensCam = new THREE.PerspectiveCamera(38, 1, 0.05, 50);
  // Where the lens looks, and the stick it points at, per place
  const LENS: Record<Place, { cam: V3; look: V3; stick: V3; bg: string }> = {
    hall: { cam: [1.0, 1.5, 4.15], look: [0.3, 1.25, 3.5], stick: [0.43, 1.28, 3.5], bg: "#d8c3a5" },
    room: { cam: [2.05, 0.9, -2.2], look: [1.05, 1.15, -3.66], stick: [1.15, 1.04, -3.68], bg: "#efe6da" },
  };
  const stickAt = new THREE.Vector3();

  let place: Place = "hall";
  let way: Way = "top";
  function apply() {
    for (const [name, p] of Object.entries(places)) {
      const here = name === place;
      parts.set(p.shared, here ? 1 : 0);
      for (const o of pieces(p.top)) parts.set(o, here && way === "top" ? 1 : 0);
      for (const o of pieces(p.usual)) parts.set(o, here && way === "usual" ? 1 : 0);
    }
    const state = `${place}-${way}`;
    labels.forEach((l) => (l.dataset.on = String(l.dataset.state === state)));
    lens.dataset.on = lensSvg.dataset.on = String(way === "top");
    root.dataset.place = place;
    const l = LENS[place];
    lensCam.position.set(...l.cam);
    lensCam.lookAt(...l.look);
    stickAt.set(...l.stick);
    lensRenderer?.setClearColor(l.bg);
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === place || b.dataset.value === way)));
  }
  buttons.forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.set === "place") place = b.dataset.value as Place;
      else way = b.dataset.value as Way;
      apply();
    }),
  );
  apply();

  // Slides: posters for the thumbnails (and the screen with reduced
  // motion), videos for the screen otherwise
  let live = 0;
  const posters = BGS.map((name) => {
    const img = new Image();
    img.src = `/videos/home/${name}-bg.jpg`;
    img.onload = () => showSlide(live);
    return img;
  });
  const videos = still
    ? []
    : BGS.map((name) => {
        const v = document.createElement("video");
        Object.assign(v, { muted: true, loop: true, playsInline: true, src: `/videos/home/${name}-bg.mp4` });
        return v;
      });
  const thumbs = LYRICS.map(() => Object.assign(document.createElement("canvas"), { width: 288, height: 162 }));
  function drawScreen() {
    const { bg, lines } = LYRICS[live];
    const v = videos[bg];
    drawSlide(screenCtx, 960, 540, v?.readyState >= 2 ? v : posters[bg], lines);
    screenTex.needsUpdate = true;
  }
  function showSlide(i: number) {
    live = i;
    LYRICS.forEach((l, j) => drawSlide(thumbs[j].getContext("2d")!, 288, 162, posters[l.bg], l.lines));
    drawRemote(remoteCanvas.getContext("2d")!, thumbs, i);
    remoteTex.needsUpdate = true;
    drawScreen();
  }
  showSlide(0);

  const anchors = labels.map((el) => new THREE.Vector3(...(JSON.parse(el.dataset.at!) as V3)));
  const v = new THREE.Vector3();

  const pointer = { x: 0, y: 0 };
  stage.addEventListener("pointermove", (e) => {
    const r = stage.getBoundingClientRect();
    pointer.x = (e.clientX - r.left) / r.width - 0.5;
    pointer.y = (e.clientY - r.top) / r.height - 0.5;
  });
  stage.addEventListener("pointerleave", () => (pointer.x = pointer.y = 0));

  function resize() {
    const { clientWidth: w, clientHeight: h } = stage;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    lensRenderer?.setSize(lensCanvas.clientWidth, lensCanvas.clientHeight, false);
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  let visible = true;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    videos.forEach((v) => (visible ? v.play().catch(() => {}) : v.pause()));
  }).observe(root);

  const target = new THREE.Vector3(...VIEWS.hall.target);
  const want = new THREE.Vector3();
  let radius = VIEWS.hall.r;
  let az = 0.72;
  let el = 0.5;
  renderer.setAnimationLoop((t) => {
    if (!visible) return;
    const ease = still ? 1 : 0.12;
    for (const [g, w] of parts) {
      const s = g.scale.x + (Math.max(w, 0.001) - g.scale.x) * ease;
      g.scale.setScalar(s);
      g.visible = s > 0.01;
    }
    const view = VIEWS[place];
    target.lerp(want.set(...view.target), still ? 1 : 0.06);
    radius += (view.r - radius) * (still ? 1 : 0.06);
    const sway = still ? 0 : Math.sin(t / 6000) * 0.07;
    az += (0.72 + sway + pointer.x * 0.25 - az) * 0.05;
    el += (0.5 - pointer.y * 0.12 - el) * 0.05;
    camera.position.set(
      target.x + radius * Math.cos(el) * Math.sin(az),
      target.y + radius * Math.sin(el),
      target.z + radius * Math.cos(el) * Math.cos(az),
    );
    camera.lookAt(target);
    if (videos.length) drawScreen();
    renderer.render(scene, camera);
    if (way === "top") {
      lensRenderer?.render(scene, lensCam);
      v.copy(stickAt).project(camera);
      lensLine.setAttribute("x1", String((v.x + 1) * 50));
      lensLine.setAttribute("y1", String((1 - v.y) * 50));
      lensLine.setAttribute("x2", String(((lens.offsetLeft + lens.offsetWidth / 2) / stage.clientWidth) * 100));
      lensLine.setAttribute("y2", String(((lens.offsetTop + lens.offsetHeight / 2) / stage.clientHeight) * 100));
    }
    labels.forEach((label, i) => {
      v.copy(anchors[i]).project(camera);
      label.style.left = `${(v.x + 1) * 50}%`;
      label.style.top = `${(1 - v.y) * 50}%`;
    });
    root.dataset.ready = "";
  });
}

document.querySelectorAll<HTMLElement>("[data-portable-stage]").forEach(init);
