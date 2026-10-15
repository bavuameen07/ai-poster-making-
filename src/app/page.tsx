import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { FeaturedGallery } from "@/components/landing/FeaturedGallery";
import { Features } from "@/components/landing/Features";
import { Examples } from "@/components/landing/Examples";
import { Footer } from "@/components/landing/Footer";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-paper">
      <Nav />
      <main>
        <Hero />
        <FeaturedGallery />
        <Features />
        <Examples />
      </main>
      <Footer />
    </div>
  );
}
