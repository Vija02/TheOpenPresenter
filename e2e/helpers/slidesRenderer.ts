import type { Page } from "@playwright/test";

export const SAMPLE_SLIDE_TRANSITION_DURATIONS = [0, 0, 500, 400] as const;
export const SAMPLE_SLIDE_CLICK_DURATIONS = [
  [500],
  [],
  [300, 600, 300],
  [0],
] as const;
export const SAMPLE_SLIDE_AUTOPLAY_DURATIONS = [0, 900, 0, 300] as const;

const SETTLE_SOURCE_MS = Math.max(
  ...SAMPLE_SLIDE_TRANSITION_DURATIONS,
  ...SAMPLE_SLIDE_AUTOPLAY_DURATIONS,
  ...SAMPLE_SLIDE_CLICK_DURATIONS.flat(),
);

export const SETTLE_MS = SETTLE_SOURCE_MS;
export const MID_ANIM_MS = 50;

type Arrow = "ArrowRight" | "ArrowLeft";

export async function pressSettle(pp: Page, key: Arrow, settleMs = SETTLE_MS) {
  await pp.keyboard.press(key);
  await pp.waitForTimeout(settleMs);
}

/** Press `first`, then `second` while the first's animation is still playing. */
export async function pressSkip(
  pp: Page,
  first: Arrow,
  second: Arrow,
  settleMs = SETTLE_MS,
) {
  await pp.keyboard.press(first);
  await pp.waitForTimeout(MID_ANIM_MS);
  await pp.keyboard.press(second);
  await pp.waitForTimeout(settleMs);
}

/** Jump to `targetSlide` by clicking the matching slide in the remote. */
export async function reachSlide(page: Page, targetSlide: number) {
  await page.getByTestId("slide-container").nth(targetSlide).click();
}
