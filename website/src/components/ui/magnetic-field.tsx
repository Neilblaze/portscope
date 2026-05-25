import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface MagneticFieldProps {
  spacing?: number;
  lineLength?: number;
  lineThickness?: number;
  forceRadius?: number;
  forceAspect?: number;
  easingSpeed?: number;
  color?: string;
  gradient?: [number, number, number][];
  dotRadius?: number;
  dotColor?: string;
  className?: string;
}

interface Point {
  x: number;
  y: number;
  currentAngle: number;
  color: string;
  opacity: number; // only ever < 1 for the single nearest point
}

export function MagneticField({
  spacing = 25,
  lineLength = 14,
  lineThickness = 3,
  forceRadius = 300,
  forceAspect = 2.0,
  easingSpeed = 0.085,
  color = 'rgba(255, 255, 255, 0.9)',
  gradient,
  dotRadius = 5,
  dotColor = '#000000',
  className,
}: MagneticFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const easingRef = useRef(easingSpeed);
  const aspectRef = useRef(forceAspect);
  const dotRadiusRef = useRef(dotRadius);
  const dotColorRef = useRef(dotColor);

  useEffect(() => { easingRef.current = easingSpeed; }, [easingSpeed]);
  useEffect(() => { aspectRef.current = forceAspect; }, [forceAspect]);
  useEffect(() => { dotRadiusRef.current = dotRadius; }, [dotRadius]);
  useEffect(() => { dotColorRef.current = dotColor; }, [dotColor]);

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

    let targetMouseX = -9999;
    let targetMouseY = -9999;
    let smoothX = -9999;
    let smoothY = -9999;

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
            const t = Math.max(0, Math.min(1, width > 0 ? x / width : 0));
            if (gradient.length === 1) {
              pointColor = `rgba(${gradient[0][0]}, ${gradient[0][1]}, ${gradient[0][2]}, 0.8)`;
            } else {
              const scaledT = t * (gradient.length - 1);
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

          points.push({ x, y, currentAngle: 0, color: pointColor, opacity: 1 });
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
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      initPoints();
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const easing = easingRef.current;
      const aspect = aspectRef.current;
      const cursorLerp = Math.min(easing * 3, 0.35);
      const fadeSpeed = 0.14;

      smoothX += (targetMouseX - smoothX) * cursorLerp;
      smoothY += (targetMouseY - smoothY) * cursorLerp;

      const cursorActive = targetMouseX > -999;

      let nearestIdx = -1;
      let nearestDist = spacing * 1.5;

      if (cursorActive) {
        for (let i = 0; i < points.length; i++) {
          const d = Math.hypot(smoothX - points[i].x, smoothY - points[i].y);
          if (d < nearestDist) {
            nearestDist = d;
            nearestIdx = i;
          }
        }
      }

      for (let i = 0; i < points.length; i++) {
        const target = i === nearestIdx ? 0 : 1;
        points[i].opacity += (target - points[i].opacity) * fadeSpeed;
      }

      ctx.lineWidth = lineThickness;
      ctx.lineCap = 'round';

      let currentColor = '';

      points.forEach((point, idx) => {
        const dx = smoothX - point.x;
        const dy = smoothY - point.y;

        let targetAngle = 0;

        if (cursorActive) {
          const ex = dx / (forceRadius * aspect);
          const ey = dy / forceRadius;
          const ellipDist = Math.sqrt(ex * ex + ey * ey);

          if (ellipDist < 1 && (dx !== 0 || dy !== 0)) {
            const influence = Math.pow(1 - ellipDist, 1.65);

            let angle = Math.atan2(dy, dx) + Math.PI / 2;
            while (angle > Math.PI / 2) angle -= Math.PI;
            while (angle < -Math.PI / 2) angle += Math.PI;

            targetAngle = angle * influence;
          }
        }

        let diff = targetAngle - point.currentAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (diff > Math.PI / 2) diff -= Math.PI;
        if (diff < -Math.PI / 2) diff += Math.PI;

        point.currentAngle += diff * easing;

        if (idx === nearestIdx || point.opacity < 0.999) return;

        if (point.color !== currentColor) {
          if (currentColor !== '') ctx.stroke();
          ctx.beginPath();
          currentColor = point.color;
          ctx.strokeStyle = currentColor;
        }

        const cos = Math.cos(point.currentAngle);
        const sin = Math.sin(point.currentAngle);
        const half = lineLength / 2;
        ctx.moveTo(point.x - cos * half, point.y - sin * half);
        ctx.lineTo(point.x + cos * half, point.y + sin * half);
      });

      if (currentColor !== '') ctx.stroke();

      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        if (point.opacity >= 0.999) continue;

        ctx.globalAlpha = Math.max(0, point.opacity);
        ctx.beginPath();
        ctx.strokeStyle = point.color;
        ctx.lineWidth = lineThickness;
        ctx.lineCap = 'round';

        const cos = Math.cos(point.currentAngle);
        const sin = Math.sin(point.currentAngle);
        const half = lineLength / 2;
        ctx.moveTo(point.x - cos * half, point.y - sin * half);
        ctx.lineTo(point.x + cos * half, point.y + sin * half);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      if (cursorActive && smoothX > -999) {
        ctx.beginPath();
        ctx.arc(smoothX, smoothY, dotRadiusRef.current, 0, Math.PI * 2);
        ctx.fillStyle = dotColorRef.current;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    const getPos = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const handleMouseMove = (e: MouseEvent) => { const p = getPos(e.clientX, e.clientY); targetMouseX = p.x; targetMouseY = p.y; };
    const handleMouseLeave = () => { targetMouseX = -9999; targetMouseY = -9999; };
    const handleTouchMove = (e: TouchEvent) => { e.preventDefault(); const t = e.touches[0]; if (!t) return; const p = getPos(t.clientX, t.clientY); targetMouseX = p.x; targetMouseY = p.y; };
    const handleTouchEnd = () => { targetMouseX = -9999; targetMouseY = -9999; };

    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    resize();
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      cancelAnimationFrame(animationFrameId);
    };
  }, [spacing, lineLength, lineThickness, forceRadius, color, gradient]);

  return (
    <div
      ref={containerRef}
      className={cn('w-full h-full overflow-hidden relative', className)}
      style={{ touchAction: 'none' }}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}