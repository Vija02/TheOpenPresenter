import {
  type Billing,
  CHART,
  calculateCosts,
  chartX,
  chartY,
  formatGbp,
  formatUsd,
  yearlyUsd,
} from "../lib/prodisplayPricing";

// Wires up the [data-price-calc] block on the ProDisplay comparison page. The
// server renders the default figures and chart, so this only has to keep them
// in sync with the slider, the billing toggle, and the pointer.
function initPriceCalculator(root: HTMLElement) {
  const slider = root.querySelector<HTMLInputElement>("[data-calc-screens]");
  const billingInputs = Array.from(
    root.querySelectorAll<HTMLInputElement>("[data-calc-billing]"),
  );
  if (!slider) {
    return;
  }

  const svg = root.querySelector<SVGSVGElement>("[data-calc-chart] svg");
  const crosshair = root.querySelector<SVGLineElement>("[data-calc-crosshair]");
  const pdDot = root.querySelector<SVGCircleElement>('[data-calc-dot="pd"]');
  const topDot = root.querySelector<SVGCircleElement>('[data-calc-dot="top"]');
  const tooltip = root.querySelector<HTMLElement>("[data-calc-tooltip]");

  const getBilling = () =>
    (billingInputs.find((input) => input.checked)?.value ??
      "yearly") as Billing;

  const setText = (name: string, text: string, scope: ParentNode = root) => {
    scope.querySelectorAll(`[data-calc-out="${name}"]`).forEach((el) => {
      el.textContent = text;
    });
  };

  const moveMarker = (screens: number) => {
    const values = yearlyUsd(screens, getBilling());
    const x = String(chartX(screens));
    crosshair?.setAttribute("x1", x);
    crosshair?.setAttribute("x2", x);
    pdDot?.setAttribute("cx", x);
    pdDot?.setAttribute("cy", String(chartY(values.prodisplay)));
    topDot?.setAttribute("cx", x);
    topDot?.setAttribute("cy", String(chartY(values.theOpenPresenter)));
  };

  const update = () => {
    const screens = Number(slider.value);
    const billing = getBilling();
    const costs = calculateCosts(screens, billing);

    setText("screens", String(screens));
    setText("screens-word", screens === 1 ? "screen" : "screens");
    setText("pd-year", formatUsd(costs.prodisplayPerYear));
    setText("pd-three", formatUsd(costs.prodisplayThreeYears));
    setText("top", formatGbp(costs.theOpenPresenter));
    setText("top-three", formatGbp(costs.theOpenPresenterThreeYears));
    setText("top-plan", costs.isFreePlan ? "Free plan" : "Cloud plan");

    root.querySelectorAll<SVGGElement>("[data-calc-series]").forEach((g) => {
      g.classList.toggle("hidden", g.dataset.calcSeries !== billing);
    });
    moveMarker(screens);
  };

  // Hovering previews any screen count; clicking selects it
  const screensAtPointer = (event: PointerEvent) => {
    const rect = svg!.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * CHART.width;
    const ratio = (x - chartX(1)) / (chartX(CHART.maxScreens) - chartX(1));
    const screens = Math.round(1 + ratio * (CHART.maxScreens - 1));
    return Math.min(CHART.maxScreens, Math.max(1, screens));
  };

  const showTooltip = (screens: number) => {
    if (!tooltip || !svg) {
      return;
    }
    const costs = calculateCosts(screens, getBilling());
    const values = yearlyUsd(screens, getBilling());
    setText("tip-screens", `${screens} ${screens === 1 ? "screen" : "screens"}`, tooltip);
    setText("tip-pd", `${formatUsd(values.prodisplay)}/yr`, tooltip);
    setText(
      "tip-top",
      costs.theOpenPresenter === 0
        ? "Free"
        : `${formatGbp(costs.theOpenPresenter)}/yr (~${formatUsd(values.theOpenPresenter)})`,
      tooltip,
    );

    const rect = svg.getBoundingClientRect();
    const left = (chartX(screens) / CHART.width) * rect.width;
    tooltip.hidden = false;
    const width = tooltip.offsetWidth;
    // Flip to the left of the crosshair when it would run off the chart, and
    // never past either edge
    const placeLeft = left + 12 + width > rect.width;
    const preferred = placeLeft ? left - 12 - width : left + 12;
    const clamped = Math.max(0, Math.min(preferred, rect.width - width));
    tooltip.style.left = `${clamped}px`;
  };

  if (svg) {
    svg.addEventListener("pointermove", (event) => {
      const screens = screensAtPointer(event);
      moveMarker(screens);
      showTooltip(screens);
    });
    svg.addEventListener("pointerleave", () => {
      if (tooltip) {
        tooltip.hidden = true;
      }
      moveMarker(Number(slider.value));
    });
    svg.addEventListener("click", (event) => {
      slider.value = String(screensAtPointer(event));
      update();
    });
  }

  slider.addEventListener("input", update);
  billingInputs.forEach((input) => input.addEventListener("change", update));
  update();
}

document
  .querySelectorAll<HTMLElement>("[data-price-calc]")
  .forEach(initPriceCalculator);
