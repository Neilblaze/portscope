import { useState, useEffect, useRef } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  CartesianGrid,
} from "recharts";

export function FeaturedSectionStats() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Based on gh-registry stats
  const data = [
    { name: "Day 1", value: 12 },
    { name: "Day 3", value: 38 },
    { name: "Day 5", value: 62 },
    { name: "Day 7", value: 85 },
    { name: "Day 9", value: 102 },
    { name: "Day 11", value: 115 },
    { name: "Day 13", value: 132 },
    { name: "Day 15", value: 148 },
    { name: "Day 17", value: 165 },
    { name: "Day 19", value: 190 },
    { name: "Day 21", value: 215 },
  ];

  return (
    <section className="w-full max-w-6xl mx-auto text-left py-16 md:py-24">
      <div className="px-4 md:px-8">
        <h3 className="text-xl sm:text-2xl lg:text-4xl font-medium text-foreground mb-12 lg:mb-16">
          Powering developers with real-time port insights.{" "}
          <span className="text-muted-foreground text-sm sm:text-base lg:text-4xl">
            Our lightning-fast CLI helps you track open ports, manage ghost processes, and secure your environments in seconds.
          </span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-8">
          <div>
            <p className="text-3xl font-medium text-foreground">3,000+</p>
            <p className="text-muted-foreground text-md">Ports Scanned</p>
          </div>
          <div>
            <p className="text-3xl font-medium text-foreground">99.9%</p>
            <p className="text-muted-foreground text-md">Kill Success Rate</p>
          </div>
          <div>
            <p className="text-3xl font-medium text-foreground">200+</p>
            <p className="text-muted-foreground text-md">Installations</p>
          </div>
          <div>
            <p className="text-3xl font-medium text-foreground">&lt;0.2s</p>
            <p className="text-muted-foreground text-md">Avg. Scan Time</p>
          </div>
        </div>
      </div>

      <div className="w-full h-56 sm:h-72 mt-16 px-2" ref={sectionRef}>
        {isVisible && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(var(--border))"
                strokeOpacity={0.4}
              />
              <XAxis dataKey="name" hide />
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-xl backdrop-blur-md">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {payload[0].payload.name}
                        </p>
                        <p className="text-3xl font-bold text-foreground">
                          {payload[0].value} <span className="text-sm font-medium text-primary">users</span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#f59e0b"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorPrimary)"
                isAnimationActive={true}
                animationDuration={2000}
                animationEasing="ease-out"
                style={{ filter: "url(#glow)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
