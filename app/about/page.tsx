// app/about/page.tsx
import { AboutHero } from "@/components/about/about-hero";
import { IntroSplit } from "@/components/about/intro-split";
import { TrustedLocal } from "@/components/about/trusted-local";
import { SiteHeader } from "@/components/site-header";
import { TeamSection } from "@/components/team-section";
import { VideoBox } from "@/components/VideoBox" 
import WhyCards from "@/components/WhySection"

export const metadata = {
  title: "About • North Falmouth Pharmacy",
  description: "Real pharmacists, real answers — serving our community with care.",
};

// Re-check team_members at most once a minute instead of baking the Our Team
// section in permanently at build time — this has to live here (the actual
// page.tsx route segment), not in team-section.tsx; Next.js only reads
// revalidate/dynamic config from page/layout/route files, never from a
// plain component the page happens to import.
export const revalidate = 60;

export default function AboutPage() {
  return (
    <>
     <SiteHeader />
      <AboutHero />
      <IntroSplit />
      <section className="py-12 md:py-16">
      </section>
      <WhyCards />
      <VideoBox
        src="/videos/nf.mp4"
        title="Inside North Falmouth Pharmacy"
      />
      <TrustedLocal />
      <TeamSection />
    </>
  );
}