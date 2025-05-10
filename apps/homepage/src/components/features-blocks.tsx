export default function FeaturesBlocks() {
  return (
    <section>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="py-12 md:py-20 border-t border-gray-200 dark:border-gray-800">
          {/* Section header */}
          <div className="max-w-3xl mx-auto text-center pb-12 md:pb-14">
            <h2 className="h2 mb-4 font-red-hat-display">Our superpower</h2>
            <p className="text-xl text-gray-400">
              TheOpenPresenter is really good at doing a few core things.
            </p>
          </div>

          {/* Items */}
          <div
            className="max-w-xs mx-auto sm:max-w-none md:max-w-xl lg:max-w-none grid sm:grid-cols-2 gap-4 lg:gap-6 lg:grid-cols-4"
            data-aos-id-featbl
          >
            {/* 1st item */}
            <span
              className="flex flex-col p-5 group text-white bg-linear-to-tr from-teal-500 to-teal-400 dark:to-teal-500 shadow-2xl"
              data-aos="fade-down"
              data-aos-anchor="[data-aos-id-featbl]"
            >
              <svg
                className="w-8 h-8 mb-3"
                viewBox="0 0 32 32"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  className="fill-current"
                  d="M19 18.414l-4 4L9.586 17l.707-.707L12 14.586V8.414l-5-5L4.414 6l6.293 6.293-1.414 1.414L1.586 6 7 .586l7 7v5l8.463-8.463a3.828 3.828 0 115.414 5.414L21 16.414v6.172l5 5L28.586 25l-6.293-6.293 1.414-1.414L31.414 25 26 30.414l-7-7v-5zm-4 1.172L26.463 8.123a1.828 1.828 0 10-2.586-2.586L12.414 17 15 19.586zM11 30v2C4.925 32 0 27.075 0 21h2a9 9 0 009 9zm0-5v2a6 6 0 01-6-6h2a4 4 0 004 4z"
                  fillRule="nonzero"
                />
              </svg>
              <div className="font-red-hat-display text-xl font-black tracking-tighter mb-1">
                Runs everywhere
              </div>
              <div className="grow opacity-80 mb-4">
                Based on latest browser technologies. Available as a desktop
                app, TV app or anywhere with access to a browser.
              </div>
            </span>

            {/* 2nd item */}
            <span
              className="flex flex-col p-5 group text-white bg-linear-to-tr from-purple-500 to-purple-400 dark:to-purple-500 shadow-2xl"
              data-aos="fade-down"
              data-aos-anchor="[data-aos-id-featbl]"
              data-aos-delay="100"
            >
              <svg
                className="w-8 h-8 mb-3"
                viewBox="0 0 32 32"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  className="fill-current"
                  d="M20.796 20l-1.677 7.264a6 6 0 01-7.302 4.471L0 28.781V11.54l.35-.3 9.457-8.107a3.751 3.751 0 015.29 5.29L11.175 13H28.5a3.5 3.5 0 012.6 1.156c.663.736.984 1.72.878 2.74-.252 1.808-1.817 3.143-3.622 3.104h-7.56zM2 27.22l10.303 2.575a4 4 0 004.868-2.98L19.204 18h9.173c.812.018 1.508-.575 1.615-1.345A1.5 1.5 0 0028.5 15H11.173a2 2 0 01-1.517-3.3l3.922-4.577a1.755 1.755 0 00-.597-2.733 1.751 1.751 0 00-1.872.262L2 12.46v14.76zM28 .585L29.414 2 23 8.414 21.586 7 28 .586zm-8.272 6.627l-1.94-.485 1.484-5.94 1.94.484-1.484 5.94zm3.544 5l-.485-1.94 5.94-1.486.486 1.94-5.94 1.486z"
                  fillRule="nonzero"
                />
              </svg>
              <div className="font-red-hat-display text-xl font-black tracking-tighter mb-1">
                Plugin-based
              </div>
              <div className="grow opacity-80 mb-4">
                Connect to different sources like google slides directly. Use
                our prebuilt plugins or bring your own to customize to your
                liking.
              </div>
            </span>

            {/* 3rd item */}
            <span
              className="flex flex-col p-5 group text-white bg-linear-to-tr from-indigo-500 to-indigo-400 dark:to-indigo-500 shadow-2xl"
              data-aos="fade-down"
              data-aos-anchor="[data-aos-id-featbl]"
              data-aos-delay="200"
            >
              <svg
                className="w-8 h-8 mb-3"
                viewBox="0 0 32 32"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  className="fill-current"
                  d="M19 5.612V25a6 6 0 11-2-4.472V0h2v2.961A5.98 5.98 0 0023.497 5a8.476 8.476 0 018.444 9.474l-.253 2.13-1.469-1.563A6.472 6.472 0 0025.5 13c-1.842 0-3.634-.6-5.103-1.713l1.206-1.594A6.455 6.455 0 0025.5 11c1.557 0 3.068.428 4.376 1.217A6.475 6.475 0 0023.5 7 7.981 7.981 0 0119 5.612zM13 29a4 4 0 100-8 4 4 0 000 8zM0 5V3h14v2H0zm0 5V8h14v2H0zm0 5v-2h14v2H0z"
                  fillRule="nonzero"
                />
              </svg>
              <div className="font-red-hat-display text-xl font-black tracking-tighter mb-1">
                Inter-connected
              </div>
              <div className="grow opacity-80 mb-4">
                Control your presentation using any device. Present to any
                number of screens and share control with multiple people at the
                same time.
              </div>
            </span>

            {/* 4th item */}
            <span
              className="flex flex-col p-5 group text-white bg-linear-to-tr from-pink-500 to-pink-400 dark:to-pink-500 shadow-2xl"
              data-aos="fade-down"
              data-aos-anchor="[data-aos-id-featbl]"
              data-aos-delay="300"
            >
              <svg
                className="w-8 h-8 mb-3"
                viewBox="0 0 32 32"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  className="fill-current"
                  d="M20.243 6.757l.707.707-1.414 1.414-.707-.707a4 4 0 00-5.658 0l-.707.707-1.414-1.414.707-.707a6 6 0 018.486 0zm3.535-3.535l.707.707-1.414 1.414-.707-.707a9 9 0 00-12.728 0l-.707.707L7.515 3.93l.707-.707c4.296-4.296 11.26-4.296 15.556 0zM9 17.212V16a7 7 0 00-7-7H1V7h1a9 9 0 019 9v.788l2.302 5.18L11 23.117V24a4 4 0 01-4 4H5v3H3v-5h4a2 2 0 002-2v-2.118l1.698-.85L9 17.213zm12-.424V16a9 9 0 019-9h1v2h-1a7 7 0 00-7 7v1.212l-1.698 3.82 1.698.85V24a2 2 0 002 2h4v5h-2v-3h-2a4 4 0 01-4-4v-.882l-2.302-1.15L21 16.787zM16 12a1 1 0 110-2 1 1 0 010 2z"
                  fillRule="nonzero"
                />
              </svg>
              <div className="font-red-hat-display text-xl font-black tracking-tighter mb-1">
                Open-source
              </div>
              <div className="grow opacity-80 mb-4">
                Best of all, The Open Presenter is open-source. Anyone can
                contribute and it'll always be available even if we're gone!
              </div>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
