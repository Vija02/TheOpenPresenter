// Plays feature clips (FeatureClip.astro) while they're on screen. With
// reduced motion they stay on their poster.
const clips = document.querySelectorAll<HTMLVideoElement>("video[data-feature-clip]");
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach(({ target, isIntersecting }) => {
        const v = target as HTMLVideoElement;
        if (isIntersecting) v.play().catch(() => {});
        else v.pause();
      }),
    { threshold: 0.4 },
  );
  clips.forEach((v) => io.observe(v));
}
