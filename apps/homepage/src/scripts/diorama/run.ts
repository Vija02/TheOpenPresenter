// Runs a diorama in each element matching `selector`. A diorama has places
// (toggled by button[data-set=place]), each built the usual way and with
// TheOpenPresenter (button[data-set=way]). Parts grow in and out, labels
// ([data-at]) follow 3D points, and an optional [data-lens] magnifier shows a
// close-up with TheOpenPresenter.
import * as THREE from "three";
import {
  type Materials,
  type V3,
  BGS,
  LYRICS,
  canvasTexture,
  drawMixer,
  drawRemote,
  drawSlide,
  drawXr,
  mat,
} from "./parts";

export interface Place {
  shared: THREE.Object3D;
  top: THREE.Object3D;
  usual: THREE.Object3D;
}
type Way = "top" | "usual";
export interface Options {
  /** Camera distance and target per place */
  views: Record<string, { r: number; target: V3 }>;
  /** Magnifier per place: its camera, where it looks, the point it marks */
  lens?: Record<string, { cam: V3; look: V3; stick: V3; bg: string }>;
}

export function runDiorama(selector: string, build: (M: Materials) => Record<string, Place>, opts: Options) {
  document.querySelectorAll<HTMLElement>(selector).forEach((root) => init(root, build, opts));
}

function init(root: HTMLElement, build: (M: Materials) => Record<string, Place>, { views, lens: LENS }: Options) {
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

  const places = build(M);
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

  // Magnifier: a second renderer with a close-up
  const lens = root.querySelector<HTMLElement>("[data-lens]");
  const lensCanvas = lens?.querySelector("canvas");
  const lensSvg = root.querySelector<SVGSVGElement>("[data-lens-line]");
  const lensLine = lensSvg?.querySelector("line");
  let lensRenderer: THREE.WebGLRenderer | undefined;
  if (lensCanvas && LENS) try {
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
  const stickAt = new THREE.Vector3();

  let place = Object.keys(places)[0];
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
    root.dataset.place = place;
    const l = LENS?.[place];
    if (lens && lensSvg) lens.dataset.on = lensSvg.dataset.on = String(way === "top" && !!l);
    if (l) {
      lensCam.position.set(...l.cam);
      lensCam.lookAt(...l.look);
      stickAt.set(...l.stick);
      lensRenderer?.setClearColor(l.bg);
    }
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === place || b.dataset.value === way)));
  }
  buttons.forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.set === "place") place = b.dataset.value!;
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
    drawSlide(screenCtx, 960, 540, v && v.readyState >= 2 ? v : posters[bg], lines);
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
    if (lensCanvas) lensRenderer?.setSize(lensCanvas.clientWidth, lensCanvas.clientHeight, false);
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  let visible = true;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    videos.forEach((v) => (visible ? v.play().catch(() => {}) : v.pause()));
  }).observe(root);

  const target = new THREE.Vector3(...views[place].target);
  const want = new THREE.Vector3();
  let radius = views[place].r;
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
    const view = views[place];
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
    if (lens && lensLine && lensRenderer && way === "top" && LENS?.[place]) {
      lensRenderer.render(scene, lensCam);
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

