import { Bot } from 'lucide-react';
import PackageInstallerTabs from '@/components/ui/package-installer-tabs';
import HeroBackgroundElements from '@/components/ui/hero-background';
import { Typewriter } from '@/components/ui/typewriter';

export function Hero() {
  return (
    <>
      <section className="relative container mx-auto px-4 pt-24 pb-16 md:pt-32 md:pb-24">
        <HeroBackgroundElements />
        <div className="relative z-10 flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
          <div className="inline-flex items-center rounded-full border border-border/50 bg-muted/50 px-3 py-1 sm:py-1 text-[11px] sm:text-sm font-medium whitespace-nowrap">
            <span className="flex shrink-0 h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-emerald-500 mr-2"></span>
            <span className="hidden sm:inline">A beautiful CLI tool to see & manage what's running on your ports ✨</span>
            <span className="sm:hidden">Beautiful CLI to manage your ports ✨</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter text-balance">
            Stop <span className="shimmer-text">guessing</span> which process is hogging port <Typewriter
              words={["3000", "5173", "8000", "5432", "6379", "8080", "6443", "8443", "8888", "9090"]}
              speed={70}
              waitTime={1500}
              deleteSpeed={40}
              cursorChar={"_"}
              className="text-primary font-mono bg-muted/30 px-2 rounded-md"
              cursorClassName="text-primary/70 font-sans font-light -ml-[1px]"
            />
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-[42rem] text-balance">
            PortScope is an advanced CLI observability suite that aggregates real-time metrics, interactive process lifecycle management, and integrated AI orchestration for natural language state querying.
          </p>

          <div className="w-full max-w-xl mt-8">
            <PackageInstallerTabs />
            <p className="mt-5 text-sm text-muted-foreground text-center max-w-[280px] sm:max-w-none mx-auto leading-relaxed">
              <Bot className="h-4 w-4 inline-block mr-1.5 -mt-1 shrink-0" />
              Tip: You can install and run it directly using <strong>Claude Code</strong> or <strong>Gemini CLI</strong>.
            </p>
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
            <source src="https://res.cloudinary.com/dmlwye965/video/upload/v1777850577/clipdemo_n4bykb.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      </section>
    </>
  );
}
