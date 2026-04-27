"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+-=[]{}|;':,./<>?";

export default function CrypticFluidBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const fontSize = 18;
    let cols = 0;
    let rows = 0;
    let grid: string[][] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      cols = Math.ceil(canvas.width / fontSize);
      rows = Math.ceil(canvas.height / fontSize);

      grid = Array(rows).fill(null).map(() =>
        Array(cols).fill(null).map(() => CHARS[Math.floor(Math.random() * CHARS.length)])
      );
    };

    window.addEventListener("resize", resize);
    resize();

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const isDark = resolvedTheme === "dark";
      // Prussian Blue in light mode, Alabaster Grey / subtle orange mix in dark mode
      const baseColor = isDark ? "252, 163, 17" : "20, 33, 61";

      ctx.font = `500 ${fontSize}px "Lexend", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const px = x * fontSize;
          const py = y * fontSize;

          // Complex sine waves for organic fluid motion
          const v1 = Math.sin(px * 0.002 + time * 0.8);
          const v2 = Math.cos(py * 0.003 - time * 0.6);
          const v3 = Math.sin((px + py) * 0.0015 + time * 1.2);
          const v4 = Math.cos((px - py) * 0.001 - time * 0.9);

          const fluidValue = v1 + v2 + v3 + v4;

          if (fluidValue > 1.5 || fluidValue < -1.8) {
            let alpha = fluidValue > 1.5 ? (fluidValue - 1.5) * 0.12 : Math.abs(fluidValue + 1.8) * 0.12;

            const maxAlpha = isDark ? 0.07 : 0.05;
            alpha = Math.min(Math.max(alpha, 0), maxAlpha);

            if (alpha > 0) {
              if (Math.random() < 0.008) {
                grid[y][x] = CHARS[Math.floor(Math.random() * CHARS.length)];
              }

              ctx.fillStyle = `rgba(${baseColor}, ${alpha})`;
              ctx.fillText(grid[y][x], px + fontSize / 2, py + fontSize / 2);
            }
          }
        }
      }

      time += 0.015;
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme, resolvedTheme]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none -z-10"
    />
  );
}
