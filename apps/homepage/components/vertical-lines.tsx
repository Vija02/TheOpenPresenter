export default function VerticalLines() {
  return (
    <div
      className="absolute inset-y-0 w-[1102px] left-1/2 -translate-x-1/2 -z-10 pointer-events-none"
      aria-hidden="true"
    >
      {/* Left side */}
      <div className="before:absolute before:inset-y-0 before:left-0 before:border-l before:[border-image:linear-gradient(to_bottom,theme(colors.indigo.300/.4),transparent)1] dark:before:[border-image:linear-gradient(to_bottom,theme(colors.indigo.300/.16),transparent)1] before:shadow-[-1px_0_0_0_theme(colors.white/.2)] dark:before:shadow-none after:absolute after:inset-y-0 after:left-20 after:border-l after:[border-image:linear-gradient(to_bottom,theme(colors.indigo.300/.4),transparent)1] dark:after:[border-image:linear-gradient(to_bottom,theme(colors.indigo.300/.16),transparent)1] after:shadow-[-1px_0_0_0_theme(colors.white/.2)] dark:after:shadow-none"></div>
      {/* Right side */}
      <div className="before:absolute before:inset-y-0 before:right-0 before:border-l before:[border-image:linear-gradient(to_bottom,theme(colors.indigo.300/.4),transparent)1] dark:before:[border-image:linear-gradient(to_bottom,theme(colors.indigo.300/.16),transparent)1] before:shadow-[-1px_0_0_0_theme(colors.white/.2)] dark:before:shadow-none after:absolute after:inset-y-0 after:right-20 after:border-l after:[border-image:linear-gradient(to_bottom,theme(colors.indigo.300/.4),transparent)1] dark:after:[border-image:linear-gradient(to_bottom,theme(colors.indigo.300/.16),transparent)1] after:shadow-[-1px_0_0_0_theme(colors.white/.2)] dark:after:shadow-none"></div>
    </div>
  );
}
