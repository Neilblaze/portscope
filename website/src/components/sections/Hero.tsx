import { Bot } from 'lucide-react';
import PackageInstallerTabs from '@/components/ui/package-installer-tabs';
import HeroBackgroundElements from '@/components/ui/hero-background';

export function Hero() {
  return (
    <>
      <section className="relative container mx-auto px-4 pt-24 pb-16 md:pt-32 md:pb-24">
        <HeroBackgroundElements />
        <div className="relative z-10 flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
          <div className="inline-flex items-center rounded-full border border-border/50 bg-muted/50 px-3 py-1 text-sm font-medium">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-2"></span>
            A beautiful CLI tool to see & manage what's running on your ports ✨
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter text-balance">
            Stop <span className="shimmer-text">guessing</span> which process is hogging port 3000!
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-[42rem] text-balance">
            PortScope is an advanced CLI observability suite that aggregates real-time metrics, interactive process lifecycle management, and integrated AI orchestration for natural language state querying.
          </p>

          <div className="w-full max-w-xl mt-8">
            <PackageInstallerTabs />
            <div className="mt-4 text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Bot className="h-4 w-4" />
              <span>
                Tip: You can install and run it directly using <strong>Claude Code</strong> or <strong>Gemini CLI</strong>.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        <div className="relative rounded-xl border border-border/50 bg-muted/20 p-2 md:p-4 max-w-5xl mx-auto overflow-hidden shadow-2xl shadow-black/10">
          <div className="absolute inset-0 bg-background/10 backdrop-blur-3xl -z-10" />
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full rounded-lg border border-border/50 bg-background shadow-sm"
            poster="https://res.cloudinary.com/dmlwye965/image/upload/v1777225620/portscope_logo_taf1id.png"
          >
            <source src="https://res.cloudinary.com/dmlwye965/video/upload/v1777251566/demo_portscope_vs5fhk.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      </section>
    </>
  );
}
