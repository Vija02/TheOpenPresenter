// Live 3D hero for /campus-ministry (CampusStage.astro): a lecture theatre
// with tiered seats and a lectern console at the front. The usual way, a
// laptop is cabled into the console and someone sits beside it all meeting;
// with TheOpenPresenter the console PC opens a link and a phone runs it.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { type Materials, type V3, box, cable, chair, chairRows, group, laptop, mat, plane } from "./diorama/parts";
import { runDiorama } from "./diorama/run";

const TIERS = 4;
const TIER_D = 1.3;
const TIER_H = 0.32;
const FRONT = -1.2; // where the first tier starts

function buildTheatre(M: Materials) {
  const base = new THREE.Mesh(new RoundedBoxGeometry(11, 0.4, 11.2, 4, 0.15), M.floor);
  base.position.set(0, -0.2, 0);
  const wall = mat("#ebe5dc");
  const carpet = mat("#8f98ab");
  const seat = mat("#3f5a8a");
  const desk = mat("#c9a77f", { roughness: 0.6 });

  const shared = group(
    base,
    box(11, 4.6, 0.2, wall, [0, 2.3, -5.5]),
    box(0.2, 4.6, 11.2, wall, [-5.4, 2.3, 0]),
  );

  // Tiered rows, each with a long desk in front of fixed seats
  const spots: V3[] = [];
  for (let i = 0; i < TIERS; i++) {
    const h = (i + 1) * TIER_H;
    const z = FRONT + i * TIER_D;
    shared.add(box(10.6, h, TIER_D, carpet, [0.1, h / 2, z + TIER_D / 2]));
    shared.add(box(9.4, 0.06, 0.34, desk, [0.3, h + 0.74, z + 0.3]));
    shared.add(box(9.4, 0.7, 0.04, desk, [0.3, h + 0.36, z + 0.13]));
    for (let x = -4.0; x <= 4.6; x += 0.72) spots.push([x, h, z + 0.85]);
  }
  shared.add(chairRows(spots, seat));

  // Screen on the front wall
  shared.add(
    plane(4.8, 2.7, M.screen, [0.8, 2.65, -5.32]),
    box(5.0, 2.9, 0.04, M.black, [0.8, 2.65, -5.35]),
  );

  // The lectern console at the front left, its PC monitor turned to the
  // speaker. The monitor shows what's on the screen.
  const console = group(
    box(1.5, 1.0, 0.8, mat("#6b7280"), [0, 0.5, 0]),
    box(1.6, 0.05, 0.9, desk, [0, 1.02, 0]),
    box(0.06, 0.32, 0.06, M.black, [-0.3, 1.2, -0.15]),
    box(0.62, 0.38, 0.04, M.black, [-0.3, 1.45, -0.15]),
    plane(0.56, 0.32, M.screen, [-0.3, 1.45, -0.128]),
    box(0.5, 0.02, 0.16, M.black, [-0.3, 1.055, 0.18]),
    // Gooseneck mic
    cable(
      [
        [0.55, 1.05, -0.25],
        [0.6, 1.35, -0.1],
        [0.55, 1.5, 0.15],
      ],
      M.black,
      0.015,
    ),
  );
  console.position.set(-3.3, 0, -3.6);
  console.rotation.y = 0.9;
  console.scale.setScalar(1.25);
  shared.add(console);

  // With TheOpenPresenter: a phone on a desk, mid-theatre
  const phoneTier = 2;
  const ph = (phoneTier + 1) * TIER_H + 0.78;
  const phone = group(box(0.2, 0.02, 0.38, M.black, [0, 0, 0]), plane(0.18, 0.34, M.remote, [0, 0.011, 0]).rotateX(-Math.PI / 2));
  // Held up a little, screen tilted back towards whoever's sitting there
  phone.position.set(1.0, ph + 0.25, FRONT + phoneTier * TIER_D + 0.45);
  phone.rotation.set(1.0, 0.3, 0);
  phone.scale.setScalar(2.4);
  const withTop = group(phone);

  // The usual way: a laptop on the console, cabled into it, with someone's
  // chair pulled up beside it for the whole meeting
  const lap = laptop(M);
  lap.position.set(0.35, 1.05, -0.05);
  lap.rotation.y = -0.2;
  const usualOnConsole = group(
    lap,
    cable(
      [
        [0.35, 1.1, 0.2],
        [0.75, 1.0, 0.3],
        [0.82, 0.6, 0.25],
        [0.76, 0.3, 0.2],
      ],
      M.red,
      0.022,
    ),
  );
  usualOnConsole.position.copy(console.position);
  usualOnConsole.rotation.copy(console.rotation);
  usualOnConsole.scale.copy(console.scale);
  const usual = group(usualOnConsole, chair(M.chair, [-2.0, 0, -4.3], Math.PI * 0.8));

  return { shared, top: withTop, usual };
}

runDiorama("[data-diorama=campus]", (M) => ({ theatre: buildTheatre(M) }), {
  views: { theatre: { r: 26, target: [-0.4, 1.0, -1.4] } },
});
