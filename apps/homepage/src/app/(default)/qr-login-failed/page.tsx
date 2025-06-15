import PageIllustration from "@/components/page-illustration";
import NextLink from "next/link";

export default function QRLoginFailed() {
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
          <div className="pt-32 pb-12 md:pt-40 md:pb-20 text-center">
            <div className="max-w-3xl mx-auto">
              <h1 className="h1 font-red-hat-display mb-4" data-aos="fade-down">
                Login not successful
              </h1>
              <p
                className="text-xl text-gray-600 dark:text-gray-400"
                data-aos="fade-down"
                data-aos-delay="150"
              >
                Something went wrong when trying to log into your account.
                Please try again
              </p>
            </div>
            <NextLink
              className="btn text-white bg-teal-500 hover:bg-teal-400 inline-flex items-center"
              href="/o"
            >
              <span>Try again</span>
            </NextLink>
          </div>
        </div>
      </section>
    </>
  );
}
