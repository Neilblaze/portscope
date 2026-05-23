import { Activity, Cpu, Bot, Zap, PackageOpen, Terminal, ShieldCheck } from 'lucide-react';

export function Features() {
  return (
    <section className="container mx-auto px-4 py-24 border-t border-border/10 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-primary/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="mb-20 text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 font-['Orbitron'] bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70">
            Why use PortScope?
          </h2>
          <p className="text-muted-foreground text-lg md:text-xl text-balance max-w-3xl mx-auto">
            Eliminate the operational friction of diagnosing port collisions and orphaned workloads with intelligent, high-fidelity tooling.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 auto-rows-[300px]">

          <div className="group relative col-span-1 md:col-span-2 row-span-1 overflow-hidden rounded-3xl border border-border/50 bg-card p-8 transition-all duration-500 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>

            <div className="absolute right-0 top-0 bottom-0 w-1/2 md:w-1/2 flex items-center justify-center opacity-20 sm:opacity-100 transition-all duration-700 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-primary/30 rounded-full blur-[60px] group-hover:bg-primary/40 group-hover:blur-[80px] transition-all duration-700 animate-pulse"></div>

              <div className="relative w-[110%] bg-background/80 backdrop-blur-md border border-border/60 rounded-2xl p-5 shadow-2xl rotate-[-2deg] translate-x-8 translate-y-2 group-hover:rotate-[0deg] group-hover:translate-x-4 transition-all duration-700">
                <div className="flex gap-4 items-center mb-4">
                  <div className="relative w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]">
                    <Bot size={18} className="relative z-10" />
                    <div className="absolute inset-0 rounded-full border border-primary/40 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="h-2 w-24 bg-primary/30 rounded-full"></div>
                    <div className="h-2 w-32 bg-muted-foreground/20 rounded-full"></div>
                  </div>
                </div>
                <div className="space-y-3 pl-14">
                  <div className="h-2 w-[90%] bg-muted-foreground/15 rounded-full"></div>
                  <div className="h-2 w-[75%] bg-muted-foreground/15 rounded-full"></div>
                  <div className="h-2 w-[40%] bg-primary/20 rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>

            <div className="relative z-10 h-full flex flex-col justify-center sm:max-w-[55%]">
              <div className="h-14 w-14 flex items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6 ring-1 ring-primary/20 transition-transform duration-500 group-hover:scale-110 shadow-[0_0_15px_rgba(var(--primary),0.2)]">
                <Bot className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-2xl font-['Orbitron'] tracking-wide mb-3 text-foreground">Natural Language AI</h3>
              <p className="text-muted-foreground text-base leading-relaxed">
                Ask "what's using the most CPU?" or say "kill all dev servers". Built-in support for Claude, OpenAI, OpenRouter, and local Ollama models.
              </p>
            </div>
          </div>

          <div className="group relative col-span-1 md:col-span-1 row-span-1 md:row-span-2 overflow-hidden rounded-3xl border border-border/50 bg-card p-8 transition-all duration-500 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10 flex flex-col">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>

            <div className="absolute inset-x-8 top-8 bottom-auto flex flex-col gap-3 opacity-30 group-hover:opacity-60 transition-all duration-700 pointer-events-none hidden md:flex">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-7 rounded-lg bg-muted/30 border border-border/40 flex items-center px-3 relative overflow-hidden group/bar">
                  <div
                    className={`absolute inset-y-0 left-0 bg-primary/20 transition-all duration-[2000ms] ease-in-out ${i === 1 || i === 4 ? 'w-[85%] group-hover:w-[95%] bg-primary/30' : i === 3 ? 'w-[45%] group-hover:w-[30%]' : 'w-[65%] group-hover:w-[75%]'}`}
                  ></div>
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/30 to-transparent w-full" style={{ animation: `shimmer 3s infinite linear ${i * 0.4}s` }}></div>

                  <Activity size={12} className={`relative z-10 ${i === 1 || i === 4 ? 'text-primary' : 'text-muted-foreground/70'}`} />

                  {(i === 1 || i === 4) && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                  )}
                </div>
              ))}
              <style>{`
                @keyframes shimmer {
                  100% { transform: translateX(100%); }
                }
              `}</style>
            </div>

            <div className="relative z-10 mt-auto md:pt-48">
              <div className="h-14 w-14 flex items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6 ring-1 ring-primary/20 transition-transform duration-500 group-hover:scale-110 shadow-[0_0_15px_rgba(var(--primary),0.2)]">
                <Activity className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-2xl font-['Orbitron'] tracking-wide mb-3 text-foreground">Interactive Control</h3>
              <p className="text-muted-foreground text-base leading-relaxed">
                Stays alive after showing your ports. Inspect specific ports, view full process trees, and manage states (kill, pause, resume) effortlessly.
              </p>
            </div>
          </div>

          <div className="group relative col-span-1 md:col-span-1 row-span-1 overflow-hidden rounded-3xl border border-border/50 bg-card p-8 transition-all duration-500 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>

            <PackageOpen className="absolute -bottom-4 -right-4 w-40 h-40 text-primary/5 group-hover:text-primary/10 transition-colors duration-500 pointer-events-none" strokeWidth={1} />

            <div className="relative z-10 h-full flex flex-col justify-between">
              <div className="h-14 w-14 flex items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6 ring-1 ring-primary/20 transition-transform duration-500 group-hover:scale-110 shadow-[0_0_15px_rgba(var(--primary),0.2)]">
                <PackageOpen className="h-7 w-7" />
              </div>
              <div>
                <h3 className="font-bold text-xl font-['Orbitron'] tracking-wide mb-3 text-foreground">Framework Detection</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Heuristic detection for 40+ frameworks including Next.js, Vite, Python, Docker, and ML tooling. Native Docker container mapping out of the box.
                </p>
              </div>
            </div>
          </div>

          <div className="group relative col-span-1 md:col-span-1 row-span-1 overflow-hidden rounded-3xl border border-border/50 bg-card p-8 transition-all duration-500 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10">
            <div className="absolute inset-0 bg-gradient-to-bl from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>

            <Cpu className="absolute -top-6 -right-6 w-36 h-36 text-primary/5 rotate-12 group-hover:text-primary/10 group-hover:rotate-0 transition-all duration-700 pointer-events-none" strokeWidth={1} />

            <div className="relative z-10 h-full flex flex-col justify-between">
              <div className="h-14 w-14 flex items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6 ring-1 ring-primary/20 transition-transform duration-500 group-hover:scale-110 shadow-[0_0_15px_rgba(var(--primary),0.2)]">
                <Cpu className="h-7 w-7" />
              </div>
              <div>
                <h3 className="font-bold text-xl font-['Orbitron'] tracking-wide mb-3 text-foreground">Zero Dependencies</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Built on native OS-level APIs. Three batched shell calls executing in ~0.2s for blazing fast observability.
                </p>
              </div>
            </div>
          </div>

          <div className="group relative col-span-1 md:col-span-2 row-span-1 overflow-hidden rounded-3xl border border-border/50 bg-card p-8 transition-all duration-500 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>

            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[60%] opacity-30 sm:opacity-100 transition-all duration-700 translate-x-[25%] rotate-[3deg] group-hover:rotate-0 group-hover:-translate-y-[55%] group-hover:translate-x-[15%] pointer-events-none overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] shadow-2xl font-mono text-[11px] leading-relaxed text-slate-300 hidden md:block">
              <div className="flex items-center px-4 py-3 bg-[#1a1a1a] border-b border-white/5">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                </div>
              </div>
              <div className="p-4 pt-3">
                <div className="text-orange-500 font-semibold mb-2">{">"} tail -f /var/log/nginx/access.log</div>
                <div className="opacity-80">127.0.0.1 - [28/Apr/2026:10:00] "GET /api HTTP/1.1" <span className="text-[#27c93f]">200</span></div>
                <div className="opacity-80">127.0.0.1 - [28/Apr/2026:10:01] "POST /data HTTP/1.1" <span className="text-[#27c93f]">201</span></div>
                <div className="opacity-80">127.0.0.1 - [28/Apr/2026:10:02] "GET /status HTTP/1.1" <span className="text-[#27c93f]">200</span></div>
                <div className="animate-pulse text-primary mt-2">_</div>
              </div>
            </div>

            <div className="relative z-10 h-full flex flex-col justify-center sm:max-w-[55%]">
              <div className="h-14 w-14 flex items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6 ring-1 ring-primary/20 transition-transform duration-500 group-hover:scale-110 shadow-[0_0_15px_rgba(var(--primary),0.2)]">
                <Terminal className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-2xl font-['Orbitron'] tracking-wide mb-3 text-foreground">Advanced Logging</h3>
              <p className="text-muted-foreground text-base leading-relaxed">
                Automatically discover and stream log files for running processes using file descriptor detection, with fallbacks to system logs.
              </p>
            </div>
          </div>

          <div className="group relative col-span-1 md:col-span-1 row-span-1 overflow-hidden rounded-3xl border border-border/50 bg-card p-8 transition-all duration-500 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10">
            <div className="absolute inset-0 overflow-hidden rounded-3xl opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-500 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 10px, currentColor 10px, currentColor 20px)' }}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>

            <div className="relative z-10 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between mb-6">
                <div className="h-14 w-14 flex items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20 transition-transform duration-500 group-hover:scale-110 shadow-[0_0_15px_rgba(var(--primary),0.2)]">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <Zap className="h-20 w-20 text-primary/5 group-hover:text-primary/20 transition-colors duration-500 absolute -right-4 -top-4 rotate-12 pointer-events-none" strokeWidth={1} />
              </div>
              <div>
                <h3 className="font-bold text-xl font-['Orbitron'] tracking-wide mb-3 text-foreground">Safe by Default</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Destructive operations (like kill or clean) always require explicit y/N confirmation, ensuring production-grade safety even when managed by AI.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
