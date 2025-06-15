import PageIllustration from "@/components/page-illustration";
import NextLink from "next/link";

export default function QRLoginSuccess() {
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
                Login successful
              </h1>
              <p
                className="text-xl text-gray-600 dark:text-gray-400"
                data-aos="fade-down"
                data-aos-delay="150"
              >
                Your device should now be logged in to the same account.
              </p>
            </div>
            <NextLink
              className="btn text-white bg-teal-500 hover:bg-teal-400 inline-flex items-center"
              href="/o"
            >
              <span>Go to Dashboard</span>
              <svg
                className="w-3 h-3 shrink-0 mt-px ml-2"
                viewBox="0 0 12 12"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  className="fill-current"
                  d="M6.602 11l-.875-.864L9.33 6.534H0v-1.25h9.33L5.727 1.693l.875-.875 5.091 5.091z"
                />
              </svg>
            </NextLink>
          </div>
        </div>
      </section>
    </>
  );
}
