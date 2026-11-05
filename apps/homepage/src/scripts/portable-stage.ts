// Live 3D hero for /portable-church (PortableStage.astro). Two places, a
// Sunday hall with a projector and a midweek room with a TV, each shown the
// usual way or with TheOpenPresenter. A magnifier picks out the TV stick.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  type Materials,
  type V3,
  beam,
  box,
  cable,
  chair,
  chairRows,
  drumKit,
  group,
  guitarOnStand,
  keyboard,
  laptop,
  legs,
  mat,
  plane,
  pole,
  stick,
} from "./diorama/parts";
import { runDiorama } from "./diorama/run";

export function buildHall(M: Materials) {
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
  const projBeam = beam(proj, corners);

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
    projBeam,
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

export function buildRoom(M: Materials) {
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

runDiorama("[data-diorama=portable]", (M) => ({ hall: buildHall(M), room: buildRoom(M) }), {
  views: {
    hall: { r: 29, target: [0.3, 0.6, -0.2] },
    room: { r: 21, target: [0, 0.9, -0.4] },
  },
  lens: {
    hall: { cam: [1.0, 1.5, 4.15], look: [0.3, 1.25, 3.5], stick: [0.43, 1.28, 3.5], bg: "#d8c3a5" },
    room: { cam: [2.05, 0.9, -2.2], look: [1.05, 1.15, -3.66], stick: [1.15, 1.04, -3.68], bg: "#efe6da" },
  },
});
