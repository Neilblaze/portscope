import { BookOpen, Activity, Cpu, Bot, Zap, PackageOpen } from 'lucide-react';
import { FaGithub } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import PackageInstallerTabs from '@/components/ui/package-installer-tabs';
import CrypticFluidBackground from '@/components/ui/cryptic-fluid-background';

function App() {
  return (
    <div className="min-h-screen bg-transparent font-sans antialiased text-foreground selection:bg-primary selection:text-primary-foreground relative z-0">
      <CrypticFluidBackground />
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center px-4 md:px-8">
          <div className="mr-4 flex items-center">
            <img
              src="https://res.cloudinary.com/dmlwye965/image/upload/v1777225620/portscope_logo_taf1id.png"
              alt="PortScope"
              className="h-7 w-auto transition-all hover:opacity-80"
            />
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2 md:space-x-4">
            <nav className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" className="hidden sm:flex" asChild>
                <a href="https://github.com/neilblaze/portscope/blob/main/README.md" target="_blank" rel="noreferrer">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Docs
                </a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href="https://github.com/neilblaze/portscope" target="_blank" rel="noreferrer">
                  <FaGithub className="h-4 w-4 mr-2" />
                  GitHub
                </a>
              </Button>
              <ThemeToggle />
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-24 pb-16 md:pt-32 md:pb-24">
          <div className="flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
            <div className="inline-flex items-center rounded-full border border-border/50 bg-muted/50 px-3 py-1 text-sm font-medium">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-2"></span>
              A beautiful CLI tool to see & manage what's running on your ports
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter text-balance">
              Stop guessing which process is hogging port 3000!
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

        {/* Video Demo Section */}
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

        {/* Features Grid */}
        <section className="container mx-auto px-4 py-24 border-t border-border/40">
          <div className="max-w-5xl mx-auto">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold tracking-tight mb-4 font-['Orbitron']">Why use PortScope?</h2>
              <p className="text-muted-foreground text-lg text-balance max-w-2xl mx-auto">
                Eliminate the operational friction of diagnosing port collisions and orphaned workloads with intelligent, high-fidelity tooling.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">

              <div className="group relative rounded-3xl border border-border/40 bg-card p-6 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                <div className="relative">
                  <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6 ring-1 ring-primary/20 transition-transform duration-300 group-hover:scale-110">
                    <Activity className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-xl font-['Orbitron'] tracking-wide mb-3">Interactive Control</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Stays alive after showing your ports. Inspect specific ports, view full process trees, and manage states (kill, pause, resume) effortlessly.
                  </p>
                </div>
              </div>

              <div className="group relative rounded-3xl border border-border/40 bg-card p-6 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                <div className="relative">
                  <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6 ring-1 ring-primary/20 transition-transform duration-300 group-hover:scale-110">
                    <Bot className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-xl font-['Orbitron'] tracking-wide mb-3">Natural Language AI</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Ask "what's using the most CPU?" or say "kill all dev servers". Built-in support for Claude, OpenAI, OpenRouter, and local Ollama models.
                  </p>
                </div>
              </div>

              <div className="group relative rounded-3xl border border-border/40 bg-card p-6 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                <div className="relative">
                  <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6 ring-1 ring-primary/20 transition-transform duration-300 group-hover:scale-110">
                    <PackageOpen className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-xl font-['Orbitron'] tracking-wide mb-3">Framework Detection</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Heuristic detection for 40+ frameworks including Next.js, Vite, Python, Docker, and ML tooling. Native Docker container mapping out of the box.
                  </p>
                </div>
              </div>

              <div className="group relative rounded-3xl border border-border/40 bg-card p-6 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                <div className="relative">
                  <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6 ring-1 ring-primary/20 transition-transform duration-300 group-hover:scale-110">
                    <Activity className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-xl font-['Orbitron'] tracking-wide mb-3">Advanced Logging</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Automatically discover and stream log files for running processes using file descriptor detection, with fallbacks to system logs.
                  </p>
                </div>
              </div>

              <div className="group relative rounded-3xl border border-border/40 bg-card p-6 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                <div className="relative">
                  <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6 ring-1 ring-primary/20 transition-transform duration-300 group-hover:scale-110">
                    <Cpu className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-xl font-['Orbitron'] tracking-wide mb-3">Zero Dependencies</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Built on native OS-level APIs. Three batched shell calls executing in ~0.2s for blazing fast observability.
                  </p>
                </div>
              </div>

              <div className="group relative rounded-3xl border border-border/40 bg-card p-6 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                <div className="relative">
                  <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6 ring-1 ring-primary/20 transition-transform duration-300 group-hover:scale-110">
                    <Zap className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-xl font-['Orbitron'] tracking-wide mb-3">Safe by Default</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Destructive operations (like kill or clean) always require explicit y/N confirmation, ensuring production-grade safety even when managed by AI.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/40 bg-muted/20 pb-12 pt-16 md:pb-16 md:pt-24">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
              <div className="md:col-span-2 space-y-6">
                <div className="flex items-center">
                  <img
                    src="https://res.cloudinary.com/dmlwye965/image/upload/v1777225620/portscope_logo_taf1id.png"
                    alt="PortScope"
                    className="h-8 w-auto"
                  />
                </div>
                <p className="text-base text-muted-foreground max-w-sm leading-relaxed">
                  Eliminate the operational friction of diagnosing port collisions and orphaned workloads with intelligent, high-fidelity tooling.
                </p>
              </div>

              <div className="space-y-6">
                <h4 className="font-semibold text-lg font-['Orbitron'] tracking-wide">Resources</h4>
                <ul className="space-y-4 text-muted-foreground">
                  <li>
                    <a href="https://github.com/neilblaze/portscope/blob/main/README.md" className="hover:text-primary transition-colors inline-block relative after:absolute after:bottom-0 after:left-0 after:h-[1px] after:w-0 hover:after:w-full after:bg-primary after:transition-all after:duration-300">
                      Documentation
                    </a>
                  </li>
                  <li>
                    <a href="https://github.com/neilblaze/portscope/issues" className="hover:text-primary transition-colors inline-block relative after:absolute after:bottom-0 after:left-0 after:h-[1px] after:w-0 hover:after:w-full after:bg-primary after:transition-all after:duration-300">
                      Issues & Feedback
                    </a>
                  </li>
                  <li>
                    <a href="https://www.npmjs.com/package/portscope" className="hover:text-primary transition-colors inline-block relative after:absolute after:bottom-0 after:left-0 after:h-[1px] after:w-0 hover:after:w-full after:bg-primary after:transition-all after:duration-300">
                      NPM Package
                    </a>
                  </li>
                </ul>
              </div>

              <div className="space-y-6">
                <h4 className="font-semibold text-lg font-['Orbitron'] tracking-wide">Legal</h4>
                <ul className="space-y-4 text-muted-foreground">
                  <li>
                    <a href="https://github.com/neilblaze/portscope/blob/main/LICENSE" className="hover:text-primary transition-colors inline-block relative after:absolute after:bottom-0 after:left-0 after:h-[1px] after:w-0 hover:after:w-full after:bg-primary after:transition-all after:duration-300">
                      Apache-2.0 License
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-16 pt-8 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                Portscope is crafted with <span className="text-blue-500 animate-pulse">💙</span> by Pratyay Banerjee
              </div>
              <div className="text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} PortScope. All rights reserved.
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
