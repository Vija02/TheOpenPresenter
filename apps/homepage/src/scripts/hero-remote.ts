// Hero demo: a cursor works the remote screenshot and the screens beside it
// follow. First the songs: the main screen and the confidence monitor show the
// lyric over the song's motion background, and the musician's tablet shows the
// chords with the lines on screen highlighted (scrolled to on phones). Then the
// cursor opens the Slides tab and clicks into the sermon: every screen switches
// to the first slide; from there the tablet is the pastor's speaker view and
// the pastor takes over: Next to move on, then a highlight and a pencil circle
// on the verse, the marks appearing on every screen as they draw, then Next
// again. Then the tech team goes back to the songs and round again.
// Steps come from the data-steps attribute HomeHero.astro renders. Runs only
// while the hero is in view, and not at all with reduced motion (the screens
// then stay on the first slide's poster).
type Box = [number, number, number, number];
type Step =
  | { kind: "lyric"; song: string; lines: string[]; hl: [number, number]; box: Box; next: string[] }
  | { kind: "tab"; tab: "lyrics" | "slides"; box: Box }
  | { kind: "slide"; slide: number; box: Box; notes: string; by?: "pastor" }
  | { kind: "ink"; tool: "highlight" | "pencil" };

const root = document.querySelector<HTMLElement>("[data-hero-remote]");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (root && !reduce) {
  const steps: Step[] = JSON.parse(root.dataset.steps ?? "[]");
  const cursor = root.querySelector<HTMLElement>(".hero-cursor")!;
  const live = root.querySelector<HTMLElement>(".hero-live")!;
  const slidesTab = root.querySelector<HTMLElement>(".hero-remote-slides");
  const shot = root.parentElement ?? root; // the whole product shot
  // two drawings (desktop and phone, one hidden by CSS) with the same hooks
  const all = <T extends Element>(selector: string) =>
    document.querySelectorAll<T>(`.hero-devices ${selector}`);
  const drawings = document.querySelectorAll<HTMLElement>(".hero-devices");
  const lyrics = all<HTMLElement>(".hero-main .live-lyric, .cm-now .live-lyric");
  const backgrounds = all<HTMLElement>(".live-bg");
  const videos = all<HTMLVideoElement>("video.live-bg");
  const nexts = all<HTMLElement>(".cm-next-text");
  const deckSlides = all<HTMLElement>(".deck-slide");
  const inkPaths = all<SVGPathElement>(".ink path");
  const tabletLabels = all(".tablet-label");
  const counts = all(".pv-count");
  const notes = all(".pv-notes");
  const prevNums = all(".pv-prev-n");
  const nextNums = all(".pv-next-n");
  const tools = all<HTMLElement>(".pv-tool");
  const deckTotal = 3; // slides in the sermon (DECK in tools/sunday-scenes.py)

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let index = 0;
  let running = false;
  let visible = false;
  let song = "";
  let slidesMode = false;

  // only the song on screen plays, and nothing plays out of view, during the
  // sermon, or in the drawing hidden at this screen size
  const playVideos = () =>
    videos.forEach((v) => {
      if (visible && !slidesMode && v.dataset.song === song && v.getClientRects().length) v.play().catch(() => {});
      else v.pause();
    });

  const escape = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

  const outline = (box: Box | null) => {
    if (!box) return (live.style.opacity = "0");
    const [x, y, w, h] = box;
    Object.assign(live.style, { left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, opacity: "1" });
  };


  const setMode = (slides: boolean) => {
    slidesMode = slides;
    drawings.forEach((d) => d.classList.toggle("is-slides", slides));
    tabletLabels.forEach((l) => (l.textContent = slides ? "PASTOR'S TABLET" : "MUSICIAN'S TABLET"));
  };

  const showLyric = (s: Extract<Step, { kind: "lyric" }>) => {
    setMode(false);
    song = s.song;
    outline(s.box);
    lyrics.forEach((el) => (el.innerHTML = s.lines.map(escape).join("<br/>")));
    backgrounds.forEach((bg) => bg.classList.toggle("is-hidden", bg.dataset.song !== s.song));
    playVideos();
    nexts.forEach((n) => (n.innerHTML = s.next.map(escape).join("<br/>")));

    document.querySelectorAll<SVGSVGElement>(".hero-devices > svg").forEach((svg) => {
      svg.querySelectorAll<SVGGElement>(".cs-song").forEach((sheet) => {
        const current = sheet.dataset.song === s.song;
        sheet.classList.toggle("is-hidden", !current);
        if (!current) return;
        const title = svg.querySelector(".cs-title");
        const key = svg.querySelector(".cs-key");
        if (title) title.textContent = sheet.dataset.title ?? "";
        if (key) key.textContent = `Key ${sheet.dataset.key ?? ""}`;
        let top = 0;
        sheet.querySelectorAll<SVGGElement>(".cs-line").forEach((line) => {
          const n = Number(line.dataset.line);
          line.classList.toggle("is-current", n >= s.hl[0] && n <= s.hl[1]);
          if (n === s.hl[0]) top = Number(line.dataset.y);
        });
        // the upright tablet on phones scrolls the lines on screen up near the
        // top; the landscape one fits the whole song, so it is never clipped
        if (svg.querySelector("[clip-path] .cs-scroll")) {
          const scroll = sheet.querySelector<SVGGElement>(".cs-scroll");
          if (scroll) scroll.style.transform = `translateY(${Math.min(0, 40 - top)}px)`;
        }
      });
    });
  };

  const showSlide = (s: Extract<Step, { kind: "slide" }>) => {
    setMode(true);
    playVideos();
    outline(s.box);
    // the speaker view's previews and the monitor's NEXT show the slides
    // either side of this one
    deckSlides.forEach((d) => {
      const offset = Number(d.closest<HTMLElement>("[data-offset]")?.dataset.offset ?? 0);
      d.classList.toggle("is-current", Number(d.dataset.slide) === s.slide + offset);
    });
    inkPaths.forEach((p) => {
      p.classList.remove("is-drawn");
      p.style.strokeDashoffset = "";
    });
    tools.forEach((t) => t.classList.remove("is-on"));
    counts.forEach((c) => (c.textContent = `${s.slide + 1} / ${deckTotal}`));
    notes.forEach((n) => (n.textContent = s.notes));
    prevNums.forEach((n) => (n.textContent = s.slide > 0 ? String(s.slide) : ""));
    nextNums.forEach((n) => (n.textContent = s.slide + 1 < deckTotal ? String(s.slide + 2) : ""));
  };

  const switchTab = (tab: "lyrics" | "slides") => {
    slidesTab?.classList.toggle("opacity-0", tab !== "slides");
    // the tech team has the remote again
    if (tab === "lyrics") shot.classList.remove("pastor-turn");
    // the outline belongs to the other tab's grid until the next click
    outline(null);
  };

  const click = (el: HTMLElement) => {
    el.classList.remove("clicking");
    void el.offsetWidth; // restart the click ripple
    el.classList.add("clicking");
  };

  // The pastor's cursor on whichever speaker view is showing at this size.
  const pastor = () => {
    const view = [...all<HTMLElement>(".pv-root")].find((v) => v.getClientRects().length);
    const pen = view?.querySelector<HTMLElement>(".pv-cursor");
    const main = view?.querySelector<HTMLElement>(".pv-main");
    if (!view || !pen || !main) return null;
    // the view is HTML in a scaled SVG: page pixels back to its own
    const scale = view.getBoundingClientRect().width / view.offsetWidth;
    const moveTo = (el: Element, fx: number, fy: number) => {
      const r = el.getBoundingClientRect();
      const v = view.getBoundingClientRect();
      pen.style.left = `${(r.left - v.left + r.width * fx) / scale}px`;
      pen.style.top = `${(r.top - v.top + r.height * fy) / scale}px`;
    };
    return { view, pen, main, moveTo };
  };

  // The pastor moves on themselves: Next on the speaker view.
  const pastorNext = async () => {
    const p = pastor();
    const next = p?.view.querySelector('.deck[data-offset="1"]');
    const preview = next?.closest(".pv-preview");
    if (!p || !next || !preview) return;
    p.moveTo(next, 0.55, 0.55);
    await wait(400);
    // hovered long enough to see, as the speaker view shows it, then clicked;
    // the hover lasts until the slide has moved on
    preview.classList.add("is-hover");
    await wait(700);
    click(p.pen);
    await wait(250);
    setTimeout(() => preview.classList.remove("is-hover"), 300);
  };

  // The pastor marks up the slide on the tablet: their cursor picks the tool,
  // then traces each stroke while it draws on every screen at the same pace.
  const draw = async (toolName: string) => {
    const p = pastor();
    const selector = `.deck-slide.is-current .ink[data-tool="${toolName}"]`;
    const ink = p?.view.querySelector<SVGSVGElement>(`.deck[data-offset="0"] ${selector}`);
    const tool = p?.view.querySelector<HTMLElement>(`.pv-tool[data-tool="${toolName}"]`);
    const slide = ink?.closest<HTMLElement>(".deck-slide")?.dataset.slide;
    if (!p || !ink || !tool || slide === undefined) return;
    const { pen, main, moveTo } = p;
    // the same stroke on every screen showing this slide
    const copies = (i: number) =>
      document.querySelectorAll<SVGPathElement>(
        `.hero-devices .deck-slide.is-current[data-slide="${slide}"] .ink[data-tool="${toolName}"] path:nth-of-type(${i + 1})`,
      );
    const strokes = [...ink.querySelectorAll<SVGPathElement>("path")];

    moveTo(tool, 0.5, 0.6);
    await wait(500);
    click(pen);
    tools.forEach((t) => t.classList.toggle("is-on", t.dataset.tool === toolName));
    await wait(200);
    for (const [i, stroke] of strokes.entries()) {
      const length = stroke.getTotalLength();
      const start = stroke.getPointAtLength(0);
      moveTo(main, start.x / 160, start.y / 90);
      await wait(i === 0 ? 500 : 180);
      // about 140 slide units a second, so a dot is a tap and a loop a sweep
      const ms = Math.max(90, (length / 140) * 1000);
      const paths = copies(i);
      paths.forEach((path) => path.classList.add("is-drawn"));
      pen.classList.add("is-drawing");
      await new Promise<void>((done) => {
        const t0 = performance.now();
        const frame = (now: number) => {
          const t = Math.min(1, (now - t0) / ms);
          const at = stroke.getPointAtLength(length * t);
          moveTo(main, at.x / 160, at.y / 90);
          paths.forEach((path) => (path.style.strokeDashoffset = String(1 - t)));
          if (t < 1) requestAnimationFrame(frame);
          else done();
        };
        requestAnimationFrame(frame);
      });
      pen.classList.remove("is-drawing");
    }
    await wait(150);
  };

  const run = async (s: Step) => {
    if (s.kind === "lyric") showLyric(s);
    else if (s.kind === "slide") showSlide(s);
    else if (s.kind === "tab") switchTab(s.tab);
    else await draw(s.tool);
  };

  const loop = async () => {
    running = true;
    while (visible) {
      // after switching tabs the cursor carries straight on, and the pastor
      // goes straight from one mark to the next
      const current = steps[index].kind;
      const following = steps[(index + 1) % steps.length].kind;
      await wait(current === "tab" ? 450 : current === "ink" && following === "ink" ? 300 : 1500);
      if (!visible) break;
      index = (index + 1) % steps.length;
      const step = steps[index];
      if (step.kind === "slide" && step.by === "pastor") {
        // hand over: point eyes at the tablet before the pastor does anything
        if (!shot.classList.contains("pastor-turn")) {
          shot.classList.add("pastor-turn");
          await wait(1100);
        }
        await pastorNext();
      } else if (step.kind !== "ink") {
        const [x, y, w, h] = step.box;
        cursor.style.left = `${x + w * 0.6}%`;
        cursor.style.top = `${y + h * 0.6}%`;
        // keep the name tag on the right unless it would leave the screen
        const tag = cursor.querySelector<HTMLElement>(".hero-tag");
        const at = root.getBoundingClientRect();
        const right = at.left + (at.width * (x + w * 0.6)) / 100 + 20 + (tag?.offsetWidth ?? 0);
        const flip = right > document.documentElement.clientWidth - 4;
        // flip before heading for the edge, and back only once clear of it
        if (flip) cursor.classList.add("flip");
        await wait(600);
        if (!flip) cursor.classList.remove("flip");
        click(cursor);
        await wait(120);
      }
      await run(step);
    }
    running = false;
  };

  run(steps[0]);

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    playVideos();
    if (visible && !running) loop();
  }).observe(shot); // the whole product shot, which runs long on phones
}
