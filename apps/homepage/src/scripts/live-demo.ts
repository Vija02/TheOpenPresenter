// Drives the QR pairing flow for the live demo.
//
// Markup is addressed by (instance, role) attribute pairs rather than ids, so
// the same flow can be dropped onto more than one page. Roles are treated as
// *sets*: a page may show the same demo in several places at once (e.g. the
// hero QR plus the floating widget), and they all share one SSE connection,
// one demo project, and therefore one identical QR code. Scanning any of them
// does the same thing.

import QRCode from "qrcode";

type DonePayload = { done: true; orgSlug: string; projectSlug: string };
type IdPayload = { id: string };

type Role =
  | "root"
  | "qr-block"
  | "qr-canvas"
  | "qr-loading"
  | "qr-url"
  | "status"
  | "no-phone"
  | "mobile-cta"
  | "mobile-start"
  | "mobile-status"
  | "mobile-qr-toggle"
  | "cta-block"
  | "features"
  | "stage"
  | "renderer-iframe"
  | "remote-wrap"
  | "remote-iframe";

const findAll = <T extends HTMLElement>(instance: string, role: Role): T[] =>
  Array.from(
    document.querySelectorAll<T>(
      `[data-live-demo-instance="${CSS.escape(instance)}"][data-live-demo-role="${role}"]`,
    ),
  );

const setText = (els: HTMLElement[], text: string) =>
  els.forEach((el) => (el.textContent = text));

const addClass = (els: HTMLElement[], name: string) =>
  els.forEach((el) => el.classList.add(name));

const removeClass = (els: HTMLElement[], name: string) =>
  els.forEach((el) => el.classList.remove(name));

function initInstance(instance: string) {
  const el = {
    roots: findAll(instance, "root"),
    canvases: findAll<HTMLCanvasElement>(instance, "qr-canvas"),
    loading: findAll(instance, "qr-loading"),
    status: findAll(instance, "status"),
    qrBlocks: findAll(instance, "qr-block"),
    qrUrls: findAll(instance, "qr-url"),
    noPhone: findAll<HTMLButtonElement>(instance, "no-phone"),
    mobileCtas: findAll(instance, "mobile-cta"),
    mobileStarts: findAll<HTMLButtonElement>(instance, "mobile-start"),
    mobileStatus: findAll(instance, "mobile-status"),
    mobileQrToggles: findAll<HTMLButtonElement>(instance, "mobile-qr-toggle"),
    ctaBlocks: findAll(instance, "cta-block"),
    features: findAll(instance, "features"),
    // Only ever one output stage per page.
    stage: findAll(instance, "stage")[0] ?? null,
    rendererIframe: findAll<HTMLIFrameElement>(instance, "renderer-iframe")[0] ?? null,
    remoteWrap: findAll(instance, "remote-wrap")[0] ?? null,
    remoteIframe: findAll<HTMLIFrameElement>(instance, "remote-iframe")[0] ?? null,
  };

  if (!el.canvases.length) return;

  // Treat anything that lacks a fine pointer or is narrow as "mobile"
  const isMobile =
    window.matchMedia("(max-width: 768px)").matches ||
    window.matchMedia("(pointer: coarse)").matches;

  // When true, the renderer + remote get embedded on this device instead of
  // expecting the phone to drive it. Always true on mobile; opt-in on desktop
  // via the "don't have your phone" button.
  let useInlineRemote = isMobile;

  const setStatus = (text: string) => setText(el.status, text);

  const renderQr = async (url: string) => {
    // Draw into every canvas for this instance. Canvases inside a collapsed
    // widget still paint fine — they're bitmaps, visibility is irrelevant.
    await Promise.all(
      el.canvases.map(async (canvas) => {
        try {
          await QRCode.toCanvas(canvas, url, {
            width: Number(canvas.dataset.qrSize) || 200,
            margin: 1,
            color: { dark: "#0f172a", light: "#ffffff" },
          });
          canvas.style.display = "block";
        } catch (err) {
          console.error("QR render failed:", err);
          setStatus("Couldn't render the QR code. Reload to try again.");
        }
      }),
    );
    el.loading.forEach((l) => (l.style.display = "none"));
  };

  const swapInRenderer = (payload: DonePayload) => {
    if (!el.stage || !el.rendererIframe) return;
    el.rendererIframe.src = `/render/${encodeURIComponent(payload.orgSlug)}/${encodeURIComponent(payload.projectSlug)}`;
    el.stage.classList.remove("hidden");

    // QR has done its job — replace it with the sign-up CTA + features list.
    addClass(el.qrBlocks, "hidden");
    addClass(el.mobileCtas, "hidden");
    removeClass(el.ctaBlocks, "hidden");
    removeClass(el.features, "hidden");

    // Any floating widget has nothing left to offer once the demo is live.
    document
      .querySelectorAll<HTMLElement>(
        `[data-live-demo-widget][data-live-demo-instance="${CSS.escape(instance)}"]`,
      )
      .forEach((w) => w.remove());

    if (useInlineRemote && el.remoteWrap && el.remoteIframe) {
      el.remoteIframe.src = `/app/${encodeURIComponent(payload.orgSlug)}/${encodeURIComponent(payload.projectSlug)}`;
      el.remoteWrap.classList.remove("hidden");
    } else {
      const rendererWrap = el.rendererIframe.parentElement as HTMLElement | null;
      if (rendererWrap) {
        rendererWrap.style.maxWidth =
          "min(calc((100vh - 12rem) * 16 / 9), 80rem)";
      }
    }

    // Defer scroll a tick so layout settles after the section un-hides
    requestAnimationFrame(() => {
      el.stage?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  if (isMobile) {
    // Hide the QR UI; show the mobile button + status copy.
    addClass(el.qrBlocks, "hidden");
    removeClass(el.mobileCtas, "hidden");
    el.mobileStarts.forEach((b) => (b.disabled = true)); // enabled once we have an id
    // The "don't have your phone" fallback is desktop-only
    addClass(el.noPhone, "hidden");

    // Toggle the QR panel so phone users can show the code on another screen.
    el.mobileQrToggles.forEach((toggle) => {
      toggle.addEventListener("click", () => {
        const target = toggle.dataset.target;
        if (!target) return;
        const hidden = el.qrBlocks.some((b) => b.classList.contains("hidden"));
        if (hidden) {
          removeClass(el.qrBlocks, "hidden");
          renderQr(target);
          setText(el.qrUrls, target);
          toggle.textContent = "Hide QR code";
        } else {
          addClass(el.qrBlocks, "hidden");
          toggle.textContent = "Show QR code to open on another screen";
        }
      });
    });

    el.mobileStarts.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.target;
        if (!target) return;
        el.mobileStarts.forEach((b) => {
          b.disabled = true;
          b.textContent = "Starting…";
        });
        setText(el.mobileStatus, "Provisioning a demo project…");
        // Trigger the same endpoint the QR would have hit
        fetch(target, { redirect: "manual" }).catch((err) => {
          console.error("[live-demo] mobile fetch failed:", err);
          setText(
            el.mobileStatus,
            "Couldn't start the demo. Reload to try again.",
          );
          el.mobileStarts.forEach((b) => {
            b.disabled = false;
            b.textContent = "Try the live demo";
          });
        });
      });
    });
  } else {
    el.canvases.forEach((c) => (c.style.display = "none"));
    el.loading.forEach((l) => (l.style.display = "inline"));

    el.noPhone.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.target;
        if (!target) return;
        el.noPhone.forEach((b) => {
          b.disabled = true;
          b.textContent = "Starting…";
        });
        useInlineRemote = true;
        setStatus("Provisioning a demo project…");
        fetch(target, { redirect: "manual" }).catch((err) => {
          console.error("[live-demo] desktop fallback fetch failed:", err);
          setStatus("Couldn't start the demo. Reload to try again.");
          el.noPhone.forEach((b) => {
            b.disabled = false;
            b.textContent = "Don't have your phone? Try it right here.";
          });
        });
      });
    });
  }

  const connect = () => {
    const source = new EventSource("/init-demo/request");
    source.addEventListener("message", (ev) => {
      try {
        const payload = JSON.parse(ev.data) as IdPayload | DonePayload;
        if ("id" in payload) {
          const target = new URL(
            `/init-demo?id=${encodeURIComponent(payload.id)}`,
            window.location.origin,
          ).toString();

          if (isMobile) {
            // No QR; wait for the user to press the button.
            el.mobileStarts.forEach((b) => {
              b.disabled = false;
              b.dataset.target = target;
            });
            el.mobileQrToggles.forEach((b) => {
              b.disabled = false;
              b.dataset.target = target;
            });
          } else {
            renderQr(target);
            setText(el.qrUrls, target);
            el.noPhone.forEach((b) => {
              b.disabled = false;
              b.dataset.target = target;
            });
          }
        } else if (payload.done) {
          swapInRenderer(payload);
          source.close();
        }
      } catch (err) {
        console.error("Bad SSE payload:", ev.data, err);
      }
    });
    source.addEventListener("error", () => {
      // EventSource auto-reconnects; only surface a message if we never got an id.
      if (el.canvases.every((c) => c.style.display === "none")) {
        setStatus("Couldn't reach the demo server. Try again in a moment.");
      }
    });
    window.addEventListener("beforeunload", () => source.close());
  };

  // Only defer if *every* mount point opted into lazy. One eager mount (the
  // hero QR) means the session should start straight away, and any collapsed
  // widget sharing this instance simply gets the same code drawn into it.
  const lazy =
    el.roots.length > 0 &&
    el.roots.every((r) => r.dataset.liveDemoLazy === "true");

  if (lazy && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          connect();
        }
      },
      { rootMargin: "200px" },
    );
    el.roots.forEach((r) => observer.observe(r));
  } else {
    connect();
  }
}

function initLiveDemos() {
  const instances = new Set<string>();
  document
    .querySelectorAll<HTMLElement>("[data-live-demo-instance]")
    .forEach((el) => {
      const name = el.dataset.liveDemoInstance;
      if (name) instances.add(name);
    });
  instances.forEach(initInstance);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLiveDemos, { once: true });
} else {
  initLiveDemos();
}
