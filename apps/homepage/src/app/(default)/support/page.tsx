import PageIllustration from "@/components/page-illustration";

export const metadata = {
  title: "Support | TheOpenPresenter",
};

export default function Support() {
  return (
    <>
      {/*  Page illustration */}
      <div
        className="relative max-w-6xl mx-auto h-0 pointer-events-none -z-1"
        aria-hidden="true"
      >
        <PageIllustration />
      </div>
      <section className="relative">
        {/* End background gradient (light version only) */}
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="pt-32 pb-12 md:pt-40 md:pb-20">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="h1 font-red-hat-display mb-4" data-aos="fade-down">
                Need help or have questions?
              </h1>
              <p
                className="text-xl text-gray-600 dark:text-gray-400"
                data-aos="fade-down"
                data-aos-delay="150"
              >
                Email us at{" "}
                <a
                  href="mailto:support@theopenpresenter.com"
                  className="text-blue-400"
                >
                  support@theopenpresenter.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
