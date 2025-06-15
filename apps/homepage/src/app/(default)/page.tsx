import CtaContact from "@/components/cta-contact";
import FeaturesBlocks from "@/components/features-blocks";
import Hero from "@/components/hero-home";
import PageIllustration from "@/components/page-illustration";
import TestimonialsBlocks from "@/components/testimonials-blocks";

export default function Home() {
  return (
    <>
      {/*  Page illustration */}
      <div
        className="relative max-w-6xl mx-auto h-0 pointer-events-none -z-1"
        aria-hidden="true"
      >
        <PageIllustration />
      </div>
      <Hero />
      <FeaturesBlocks />
      <TestimonialsBlocks />
      <CtaContact />
    </>
  );
}
