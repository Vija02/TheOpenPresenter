// Published prices as of October 2026, used by the ProDisplay comparison page
// and its price calculator. ProDisplay is in USD, TheOpenPresenter in GBP.
export const PRICES = {
  prodisplayPerScreenMonthly: 19,
  prodisplayPerScreenYearly: 149,
  cloudMonthly: 19,
  cloudYearly: 190,
  freePlanScreens: 5,
};

export type Billing = "yearly" | "monthly";

export function calculateCosts(screens: number, billing: Billing) {
  const prodisplayPerScreen =
    billing === "yearly"
      ? PRICES.prodisplayPerScreenYearly
      : PRICES.prodisplayPerScreenMonthly * 12;
  const cloud =
    billing === "yearly" ? PRICES.cloudYearly : PRICES.cloudMonthly * 12;

  const prodisplayPerYear = screens * prodisplayPerScreen;
  const isFreePlan = screens <= PRICES.freePlanScreens;
  const theOpenPresenter = isFreePlan ? 0 : cloud;

  return {
    prodisplayPerYear,
    // ProDisplay's first screen is free for the first year
    prodisplayThreeYears: 3 * prodisplayPerYear - prodisplayPerScreen,
    theOpenPresenter,
    theOpenPresenterThreeYears: 3 * theOpenPresenter,
    isFreePlan,
  };
}

export const formatUsd = (n: number) =>
  `$${Math.round(n).toLocaleString("en-US")}`;
export const formatGbp = (n: number) => `£${n.toLocaleString("en-GB")}`;

// The chart puts both on one axis, so pounds are converted at roughly the
// September 2026 rate. The calculator figures stay in their own currencies
export const GBP_TO_USD = 1.35;

export const CHART = {
  width: 640,
  height: 300,
  left: 48,
  right: 168,
  top: 12,
  bottom: 40,
  maxScreens: 40,
  maxUsd: 10000,
  yTicks: [0, 2000, 4000, 6000, 8000, 10000],
  xTicks: [1, 5, 10, 20, 30, 40],
};

export const chartX = (screens: number) =>
  CHART.left +
  ((screens - 1) / (CHART.maxScreens - 1)) *
    (CHART.width - CHART.left - CHART.right);

export const chartY = (usd: number) =>
  CHART.top +
  (1 - usd / CHART.maxUsd) * (CHART.height - CHART.top - CHART.bottom);

/** Yearly cost of each, in USD */
export function yearlyUsd(screens: number, billing: Billing) {
  const costs = calculateCosts(screens, billing);
  return {
    prodisplay: costs.prodisplayPerYear,
    theOpenPresenter: costs.theOpenPresenter * GBP_TO_USD,
  };
}

export function chartPaths(billing: Billing) {
  const pd = (n: number) => chartY(yearlyUsd(n, billing).prodisplay);
  const top = (n: number) => chartY(yearlyUsd(n, billing).theOpenPresenter);
  // TheOpenPresenter steps from Free to Cloud between 5 and 6 screens
  const stepX = chartX(PRICES.freePlanScreens + 0.5);
  const last = CHART.maxScreens;

  return {
    prodisplay: `M${chartX(1)},${pd(1)} L${chartX(last)},${pd(last)}`,
    theOpenPresenter: `M${chartX(1)},${top(1)} L${stepX},${top(1)} L${stepX},${top(last)} L${chartX(last)},${top(last)}`,
  };
}
