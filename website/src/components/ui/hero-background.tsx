"use client";

import { useEffect, useState } from "react";

export default function HeroBackgroundElements() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const opacityFade = Math.max(0, 1 - scrollY / 400);

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none z-0"
      style={{ opacity: opacityFade }}
    >
      <div
        className="absolute top-[10%] left-[8%] select-none opacity-20"
        style={{ transform: `translateY(${scrollY * -0.2}px) rotate(${-15 + scrollY * 0.05}deg)` }}
      >
        <div className="text-7xl md:text-9xl font-black text-muted-foreground text-3d animate-float-scale">
          ?
        </div>
      </div>
      <div
        className="absolute top-[35%] right-[5%] md:right-[10%] select-none opacity-15"
        style={{ transform: `translateY(${scrollY * -0.4}px) rotate(${20 - scrollY * 0.02}deg)` }}
      >
        <div className="text-8xl md:text-[12rem] font-black text-muted-foreground text-3d animate-float-scale-delayed">
          ?
        </div>
      </div>
      <div
        className="absolute top-[60%] left-[12%] select-none opacity-[0.15]"
        style={{ transform: `translateY(${scrollY * -0.25}px) rotate(${5 + scrollY * -0.09}deg)` }}
      >
        <div className="text-6xl md:text-8xl font-black text-muted-foreground text-3d animate-float-scale-slow">
          ?
        </div>
      </div>
      <div
        className="absolute top-[5%] right-[20%] select-none opacity-20"
        style={{ transform: `translateY(${scrollY * -0.15}px) rotate(${45 - scrollY * 0.04}deg)` }}
      >
        <div className="text-5xl md:text-7xl font-black text-muted-foreground text-3d animate-float-scale-delayed">
          ?
        </div>
      </div>

      <div
        className="absolute top-[25%] right-[25%] text-5xl md:text-7xl opacity-40 blur-[1px] select-none"
        style={{ transform: `translateY(${scrollY * -0.1}px) rotate(${10 + scrollY * 0.01}deg) scale(1.1) skewX(-10deg)` }}
      >
        👨‍💻
      </div>
      <div
        className="absolute top-[45%] left-[25%] text-5xl md:text-7xl opacity-30 blur-[2px] select-none"
        style={{ transform: `translateY(${scrollY * -0.25}px) rotate(${-15 - scrollY * 0.02}deg) scale(0.9) skewY(5deg)` }}
      >
        👩‍💻
      </div>
    </div>
  );
}
