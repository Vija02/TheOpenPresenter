// Drives the "Find the right app for you" questionnaire on the download page.
// Questions stack: each answered question stays visible with its choice
// highlighted, and the next question (or the result) appears below it.

const root = document.getElementById("download-questionnaire");

if (root) {
  // Classes applied to the currently-selected option in each question.
  const SELECTED = [
    "border-teal-500",
    "dark:border-teal-400",
    "ring-1",
    "ring-teal-500",
    "bg-teal-50",
    "dark:bg-teal-500/10",
  ];

  // q1: which first-question branch ("church" | "commercial")
  // q2: which result the second question points to ("studio" | "kiosk")
  const state: { q1: string | null; q2: string | null } = {
    q1: null,
    q2: null,
  };

  const stepEls = new Map<string, HTMLElement>();
  root.querySelectorAll<HTMLElement>("[data-step]").forEach((el) => {
    stepEls.set(el.dataset.step as string, el);
  });

  const resultEls = new Map<string, HTMLElement>();
  root.querySelectorAll<HTMLElement>("[data-result-panel]").forEach((el) => {
    resultEls.set(el.dataset.resultPanel as string, el);
  });

  const setSelected = (opt: HTMLElement, on: boolean) => {
    if (on) opt.classList.add(...SELECTED);
    else opt.classList.remove(...SELECTED);
  };

  const render = () => {
    // First question — always visible, highlight the chosen branch.
    const start = stepEls.get("start");
    start?.querySelectorAll<HTMLElement>("[data-goto]").forEach((opt) => {
      setSelected(opt, opt.dataset.goto === state.q1);
    });

    // Second question — show only the branch matching q1.
    ["church", "commercial"].forEach((name) => {
      const step = stepEls.get(name);
      if (!step) return;
      const active = state.q1 === name;
      step.hidden = !active;
      step.querySelectorAll<HTMLElement>("[data-result]").forEach((opt) => {
        setSelected(opt, active && opt.dataset.result === state.q2);
      });
    });

    // Result — show once both questions are answered.
    resultEls.forEach((el, name) => {
      el.hidden = !(state.q1 !== null && state.q2 === name);
    });
  };

  const highlight = (el: HTMLElement) => {
    const classes = ["ring-2", "ring-teal-500", "ring-offset-2"];
    el.classList.add(...classes);
    window.setTimeout(() => el.classList.remove(...classes), 2000);
  };

  const scrollTo = (selector: string) => {
    const target = document.querySelector<HTMLElement>(selector);
    if (!target) return;

    // Make sure the "browse all" section is expanded before scrolling in.
    let node: HTMLElement | null = target;
    while (node) {
      if (node instanceof HTMLDetailsElement) node.open = true;
      node = node.parentElement;
    }

    target.scrollIntoView({ behavior: "smooth", block: "start" });
    highlight(target);
  };

  root.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-goto],[data-result],[data-scroll],.q-restart",
    );
    if (!el || !root.contains(el)) return;

    if (el.dataset.goto) {
      // Changing the first answer resets the downstream answer.
      if (state.q1 !== el.dataset.goto) {
        state.q1 = el.dataset.goto;
        state.q2 = null;
      }
      render();
    } else if (el.dataset.result) {
      state.q2 = el.dataset.result;
      render();
    } else if (el.dataset.scroll) {
      scrollTo(el.dataset.scroll);
    } else if (el.classList.contains("q-restart")) {
      state.q1 = null;
      state.q2 = null;
      render();
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  render();
}

// Allow deep-linking to the manual download section (#choose) or a specific
// app accordion (#kiosk, #studio): expand the target's <details> and scroll to
// it. Runs on load and whenever the hash changes.
const openHashTarget = () => {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;

  let node: HTMLElement | null = target;
  while (node) {
    if (node instanceof HTMLDetailsElement) node.open = true;
    node = node.parentElement;
  }

  target.scrollIntoView({ behavior: "smooth", block: "start" });
};

window.addEventListener("hashchange", openHashTarget);
openHashTarget();
