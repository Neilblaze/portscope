import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface MagneticFieldProps {
  spacing?: number;
  lineLength?: number;
  lineThickness?: number;
  forceRadius?: number;
  easingSpeed?: number;
  color?: string;
  gradient?: [number, number, number][];
  className?: string;
}

interface Point {
  x: number;
  y: number;
  currentAngle: number;
  color: string;
}

export function MagneticField({
  spacing = 25,
  lineLength = 14,
  lineThickness = 3,
  forceRadius = 250,
  easingSpeed = 0.1,
  color = 'rgba(255, 255, 255, 0.9)',
  gradient,
  className,
}: MagneticFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let points: Point[] = [];
    let width = 0;
    let height = 0;

    let mouseX = -1000;
    let mouseY = -1000;
    let targetMouseX = -1000;
    let targetMouseY = -1000;

    const initPoints = () => {
      points = [];
      const cols = Math.floor(width / spacing);
      const rows = Math.floor(height / spacing);

      const offsetX = (width - cols * spacing) / 2 + spacing / 2;
      const offsetY = (height - rows * spacing) / 2 + spacing / 2;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = offsetX + i * spacing;
          const y = offsetY + j * spacing;

          let pointColor = color;
          if (gradient && gradient.length > 0) {
            const t = width > 0 ? x / width : 0;
            const clampedT = Math.max(0, Math.min(1, t));

            if (gradient.length === 1) {
              pointColor = `rgba(${gradient[0][0]}, ${gradient[0][1]}, ${gradient[0][2]}, 0.8)`;
            } else {
              const scaledT = clampedT * (gradient.length - 1);
              const index = Math.floor(scaledT);
              const nextIndex = Math.min(index + 1, gradient.length - 1);
              const factor = scaledT - index;

              const c1 = gradient[index];
              const c2 = gradient[nextIndex];

              const r = Math.round(c1[0] + (c2[0] - c1[0]) * factor);
              const g = Math.round(c1[1] + (c2[1] - c1[1]) * factor);
              const b = Math.round(c1[2] + (c2[2] - c1[2]) * factor);

              const alphaMatch = color.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)/);
              const alpha = alphaMatch ? alphaMatch[1] : '0.8';

              pointColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            }
          }

          points.push({
            x,
            y,
            currentAngle: 0,
            color: pointColor
          });
        }
      }
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      initPoints();
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      mouseX += (targetMouseX - mouseX) * (easingSpeed * 2);
      mouseY += (targetMouseY - mouseY) * (easingSpeed * 2);

      points.forEach((point) => {
        const dx = mouseX - point.x;
        const dy = mouseY - point.y;
        const dist = Math.hypot(dx, dy);

        let targetAngle = 0;

        if (dist < forceRadius) {
          const force = 1 - Math.pow(dist / forceRadius, 2); // Quadratic falloff for smoother easing
          let angleToMouse = Math.atan2(dy, dx);

          while (angleToMouse > Math.PI / 2) angleToMouse -= Math.PI;
          while (angleToMouse < -Math.PI / 2) angleToMouse += Math.PI;

          targetAngle = angleToMouse * force;
        }

        point.currentAngle += (targetAngle - point.currentAngle) * easingSpeed;

        ctx.beginPath();
        ctx.strokeStyle = point.color;
        ctx.lineWidth = lineThickness;
        ctx.lineCap = 'round';

        const cos = Math.cos(point.currentAngle);
        const sin = Math.sin(point.currentAngle);

        ctx.moveTo(point.x - cos * (lineLength / 2), point.y - sin * (lineLength / 2));
        ctx.lineTo(point.x + cos * (lineLength / 2), point.y + sin * (lineLength / 2));
        ctx.stroke();
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetMouseX = e.clientX - rect.left;
      targetMouseY = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      targetMouseX = -1000;
      targetMouseY = -1000;
    };

    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    resize();
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [spacing, lineLength, lineThickness, forceRadius, easingSpeed, color]);

  return (
    <div
      ref={containerRef}
      className={cn("w-full overflow-hidden pointer-events-none relative", className)}
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="block pointer-events-auto w-full h-full"
      />
    </div>
  );
}
