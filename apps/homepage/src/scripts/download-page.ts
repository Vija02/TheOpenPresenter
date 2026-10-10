// Download page: show the Studio download for the visitor's OS, and open
// deep-linked sections (#studio, #kiosk).

type OS = "windows" | "macos" | "linux";

interface NavigatorUAData {
  platform?: string;
}

function detectOS(): OS | null {
  const nav = navigator as Navigator & { userAgentData?: NavigatorUAData };
  const platform = (
    nav.userAgentData?.platform ||
    navigator.platform ||
    ""
  ).toLowerCase();
  const ua = navigator.userAgent.toLowerCase();

  // Studio can't run on phones, tablets or ChromeOS. Android reports Linux and
  // iPadOS reports a Mac, so rule these out first.
  if (/android|iphone|ipad|ipod|cros/.test(ua)) return null;
  if (platform.includes("chrome os")) return null;
  if (platform.startsWith("mac") && navigator.maxTouchPoints > 1) return null;

  if (platform.startsWith("win") || ua.includes("windows")) return "windows";
  if (platform.startsWith("mac") || ua.includes("mac os")) return "macos";
  if (platform.includes("linux") || ua.includes("linux")) return "linux";
  return null;
}

const os = detectOS();
if (os) {
  document.querySelectorAll<HTMLElement>("[data-os-primary]").forEach((el) => {
    el.hidden = el.dataset.osPrimary !== os;
  });
}

// Allow deep-linking to a section (#studio, #kiosk): expand any <details> it
// sits in and scroll to it. Runs on load and whenever the hash changes.
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
