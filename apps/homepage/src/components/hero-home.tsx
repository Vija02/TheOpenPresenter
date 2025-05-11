import CTAForm from "./cta-form";

export default function HeroHome() {
  return (
    <section>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="pt-32 pb-10 md:pt-40 md:pb-16">
          {/* Hero content */}
          <div className="md:grid md:grid-cols-12 md:gap-12 lg:gap-20 items-center">
            {/* Content */}
            <div className="md:col-span-7 lg:col-span-6 mb-8 md:mb-0 text-center md:text-left">
              <h1
                className="h1 lg:text-6xl mb-4 font-red-hat-display font-black"
                data-aos="fade-down"
              >
                Your media, on any screen
              </h1>
              <p
                className="text-xl text-gray-600 dark:text-gray-400"
                data-aos="fade-down"
                data-aos-delay="150"
              >
                Open-source Presentation System to present your content
                seamlessly, wherever you are. Control from your phone and
                display to any number of screens with ease.
              </p>
              {/* CTA form */}
              <CTAForm />
              <ul
                className="max-w-sm sm:max-w-md mx-auto md:max-w-none text-gray-600 dark:text-gray-400 mt-8 -mb-2 text-left"
                data-aos="fade-down"
                data-aos-delay="450"
              >
                <li className="flex items-center mb-2">
                  <svg
                    className="w-3 h-3 fill-current text-teal-400 mr-2 shrink-0"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span>Works with any device & any screen</span>
                </li>
                <li className="flex items-center mb-2">
                  <svg
                    className="w-3 h-3 fill-current text-teal-400 mr-2 shrink-0"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span>Seamless collaboration in real-time</span>
                </li>
                <li className="flex items-center mb-2">
                  <svg
                    className="w-3 h-3 fill-current text-teal-400 mr-2 shrink-0"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span>No downloads needed, entirely web-based</span>
                </li>
              </ul>
            </div>

            {/* Mobile mockup */}
            <div
              className="md:col-span-5 lg:col-span-6 text-center md:text-right h-full md"
              data-aos="fade-up"
              data-aos-delay="450"
            >
              {/* Glow illustration */}
              <svg
                className="absolute mr-12 mt-32 pointer-events-none -z-1 dark:opacity-40"
                aria-hidden="true"
                width="678"
                height="634"
                viewBox="0 0 678 634"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="240"
                  cy="394"
                  r="240"
                  fill="url(#piphoneill_paint0_radial)"
                  fillOpacity=".4"
                />
                <circle
                  cx="438"
                  cy="240"
                  r="240"
                  fill="url(#piphoneill_paint1_radial)"
                  fillOpacity=".6"
                />
                <defs>
                  <radialGradient
                    id="piphoneill_paint0_radial"
                    cx="0"
                    cy="0"
                    r="1"
                    gradientUnits="userSpaceOnUse"
                    gradientTransform="rotate(90 -77 317) scale(189.054)"
                  >
                    <stop stopColor="#667EEA" />
                    <stop offset="1" stopColor="#667EEA" stopOpacity=".01" />
                  </radialGradient>
                  <radialGradient
                    id="piphoneill_paint1_radial"
                    cx="0"
                    cy="0"
                    r="1"
                    gradientUnits="userSpaceOnUse"
                    gradientTransform="rotate(90 99 339) scale(189.054)"
                  >
                    <stop stopColor="#9F7AEA" />
                    <stop offset="1" stopColor="#9F7AEA" stopOpacity=".01" />
                  </radialGradient>
                </defs>
              </svg>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="inline w-full text-center items-center max-w-[500px] md:block md:absolute md:top-20 md:w-[410px] md:max-w-none lg:block lg:w-full lg:top-1/4"
                src="/images/landing_img.png"
                alt="landing"
                fetchPriority="high"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
