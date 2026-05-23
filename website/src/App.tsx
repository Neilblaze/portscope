import CrypticFluidBackground from '@/components/ui/cryptic-fluid-background';
import { Navbar } from '@/components/sections/Navbar';
import { Hero } from '@/components/sections/Hero';
import { TrustedBy } from '@/components/sections/TrustedBy';
import { Features } from '@/components/sections/Features';
import { FeaturedSectionStats } from '@/components/sections/FeaturedSectionStats';
import { Footer } from '@/components/sections/Footer';
import { CookieBanner } from '@/components/ui/cookie-banner';

function App() {
    return (
        <div className="min-h-screen bg-transparent font-sans antialiased text-foreground selection:bg-primary selection:text-primary-foreground relative z-0">
            <CrypticFluidBackground />

            <Navbar />

            <main className="flex-1">
                <Hero />
                <FeaturedSectionStats />
                <TrustedBy />
                <Features />
                <Footer />
            </main>

            <CookieBanner />
        </div>
    );
}

export default App;
