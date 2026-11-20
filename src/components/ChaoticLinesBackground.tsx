import React, { useEffect, useRef } from 'react';

interface ChaoticLine {
  // Start, control points, end defined as normalized coordinates (0 to 1)
  x0: number;
  y0: number;
  cp1x: number;
  cp1y: number;
  cp2x: number;
  cp2y: number;
  x1: number;
  y1: number;
  // Motion physics
  freq1: number;
  freq2: number;
  amp1: number;
  amp2: number;
  phase1: number;
  phase2: number;
  flowSpeed: number;
  // Styling
  lineWidth: number;
  alpha: number;
  colorIndex: number;
  hasGlow: boolean;
}

interface ChaoticLinesBackgroundProps {
  themeKey?: string;
  theme?: any;
}

export function ChaoticLinesBackground({ themeKey, theme }: ChaoticLinesBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const currentTheme = themeKey || theme?.id || 'monochrome';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = 0;
    let height = 0;

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Color palettes per theme (soft ambient tones that sit deep in the background)
    const PALETTES: Record<string, string[]> = {
      monochrome: [
        'rgba(255, 255, 255, 0.16)',
        'rgba(225, 235, 250, 0.12)',
        'rgba(185, 195, 215, 0.09)',
        'rgba(255, 255, 255, 0.20)',
        'rgba(160, 175, 195, 0.07)',
        'rgba(240, 245, 255, 0.14)'
      ],
      purple: [
        'rgba(168, 85, 247, 0.20)',
        'rgba(192, 132, 252, 0.15)',
        'rgba(147, 51, 234, 0.12)',
        'rgba(232, 121, 249, 0.22)',
        'rgba(216, 180, 254, 0.10)',
        'rgba(126, 34, 206, 0.14)'
      ],
      amber: [
        'rgba(245, 158, 11, 0.20)',
        'rgba(251, 191, 36, 0.15)',
        'rgba(217, 119, 6, 0.12)',
        'rgba(253, 230, 138, 0.18)',
        'rgba(249, 115, 22, 0.11)',
        'rgba(252, 211, 77, 0.10)'
      ]
    };

    // 16 dynamic sweeping lines across the full viewport
    const lines: ChaoticLine[] = [
      // Diagonal sweeps from top-left to bottom-right
      {
        x0: -0.15, y0: 0.08, cp1x: 0.28, cp1y: 0.72, cp2x: 0.72, cp2y: 0.22, x1: 1.15, y1: 0.88,
        freq1: 0.65, freq2: 0.8, amp1: 0.18, amp2: 0.22, phase1: 0.3, phase2: 1.2, flowSpeed: 1.2,
        lineWidth: 2.8, alpha: 0.9, colorIndex: 0, hasGlow: true
      },
      {
        x0: -0.08, y0: 0.22, cp1x: 0.38, cp1y: 0.85, cp2x: 0.62, cp2y: 0.08, x1: 1.18, y1: 0.68,
        freq1: 0.55, freq2: 0.9, amp1: 0.2, amp2: 0.18, phase1: 2.4, phase2: 0.8, flowSpeed: 0.9,
        lineWidth: 1.6, alpha: 0.8, colorIndex: 1, hasGlow: false
      },
      // Diagonal cuts from bottom-left to top-right
      {
        x0: -0.12, y0: 0.92, cp1x: 0.32, cp1y: 0.25, cp2x: 0.58, cp2y: 0.88, x1: 1.12, y1: 0.12,
        freq1: 0.75, freq2: 0.6, amp1: 0.22, amp2: 0.2, phase1: 1.6, phase2: 2.9, flowSpeed: 1.4,
        lineWidth: 3.2, alpha: 0.9, colorIndex: 3, hasGlow: true
      },
      {
        x0: 0.02, y0: 1.08, cp1x: 0.48, cp1y: 0.12, cp2x: 0.82, cp2y: 0.68, x1: 1.12, y1: 0.28,
        freq1: 0.6, freq2: 0.85, amp1: 0.19, amp2: 0.17, phase1: 3.2, phase2: 1.5, flowSpeed: 1.1,
        lineWidth: 1.4, alpha: 0.7, colorIndex: 2, hasGlow: false
      },
      // Horizontal undulating wave ribbons
      {
        x0: -0.15, y0: 0.42, cp1x: 0.28, cp1y: 0.15, cp2x: 0.72, cp2y: 0.75, x1: 1.15, y1: 0.38,
        freq1: 0.8, freq2: 0.65, amp1: 0.22, amp2: 0.24, phase1: 0.9, phase2: 2.3, flowSpeed: 1.5,
        lineWidth: 4.2, alpha: 0.75, colorIndex: 0, hasGlow: true
      },
      {
        x0: -0.08, y0: 0.55, cp1x: 0.32, cp1y: 0.8, cp2x: 0.68, cp2y: 0.25, x1: 1.08, y1: 0.62,
        freq1: 0.7, freq2: 0.75, amp1: 0.2, amp2: 0.22, phase1: 2.0, phase2: 0.5, flowSpeed: 1.0,
        lineWidth: 1.8, alpha: 0.85, colorIndex: 4, hasGlow: false
      },
      // Sweeping arcs from top edge
      {
        x0: 0.18, y0: -0.12, cp1x: 0.82, cp1y: 0.32, cp2x: 0.12, cp2y: 0.78, x1: 0.92, y1: 1.12,
        freq1: 0.58, freq2: 0.72, amp1: 0.18, amp2: 0.22, phase1: 2.6, phase2: 1.8, flowSpeed: 1.3,
        lineWidth: 2.6, alpha: 0.85, colorIndex: 5, hasGlow: true
      },
      {
        x0: 0.58, y0: -0.12, cp1x: 0.08, cp1y: 0.42, cp2x: 0.92, cp2y: 0.58, x1: 0.32, y1: 1.12,
        freq1: 0.78, freq2: 0.68, amp1: 0.21, amp2: 0.19, phase1: 0.5, phase2: 3.1, flowSpeed: 1.2,
        lineWidth: 1.5, alpha: 0.75, colorIndex: 1, hasGlow: false
      },
      // Steep cross-cutting diagonal streaks
      {
        x0: 0.88, y0: -0.08, cp1x: 0.38, cp1y: 0.38, cp2x: 0.72, cp2y: 0.82, x1: 0.08, y1: 1.08,
        freq1: 0.68, freq2: 0.82, amp1: 0.2, amp2: 0.21, phase1: 1.2, phase2: 2.2, flowSpeed: 1.6,
        lineWidth: 3.0, alpha: 0.9, colorIndex: 3, hasGlow: true
      },
      {
        x0: 0.98, y0: 0.08, cp1x: 0.52, cp1y: 0.62, cp2x: 0.22, cp2y: 0.28, x1: -0.08, y1: 0.78,
        freq1: 0.62, freq2: 0.7, amp1: 0.19, amp2: 0.18, phase1: 2.9, phase2: 1.0, flowSpeed: 0.95,
        lineWidth: 1.5, alpha: 0.7, colorIndex: 2, hasGlow: false
      },
      // Lower chaotic fluid currents
      {
        x0: -0.12, y0: 0.82, cp1x: 0.38, cp1y: 0.98, cp2x: 0.68, cp2y: 0.62, x1: 1.12, y1: 0.94,
        freq1: 0.5, freq2: 0.72, amp1: 0.18, amp2: 0.2, phase1: 3.5, phase2: 1.9, flowSpeed: 1.1,
        lineWidth: 3.8, alpha: 0.8, colorIndex: 0, hasGlow: true
      },
      {
        x0: 0.12, y0: 1.12, cp1x: 0.72, cp1y: 0.68, cp2x: 0.32, cp2y: 0.38, x1: 0.88, y1: -0.12,
        freq1: 0.72, freq2: 0.62, amp1: 0.21, amp2: 0.22, phase1: 1.0, phase2: 2.7, flowSpeed: 1.35,
        lineWidth: 2.0, alpha: 0.85, colorIndex: 4, hasGlow: false
      },
      // Upper atmospheric fine threads
      {
        x0: -0.08, y0: 0.12, cp1x: 0.48, cp1y: 0.02, cp2x: 0.62, cp2y: 0.32, x1: 1.08, y1: 0.18,
        freq1: 0.85, freq2: 0.6, amp1: 0.16, amp2: 0.19, phase1: 1.8, phase2: 3.3, flowSpeed: 1.4,
        lineWidth: 1.4, alpha: 0.65, colorIndex: 5, hasGlow: false
      },
      {
        x0: 0.32, y0: -0.1, cp1x: 0.68, cp1y: 0.48, cp2x: 0.18, cp2y: 0.62, x1: 0.62, y1: 1.12,
        freq1: 0.56, freq2: 0.78, amp1: 0.19, amp2: 0.2, phase1: 2.3, phase2: 0.7, flowSpeed: 1.25,
        lineWidth: 2.4, alpha: 0.85, colorIndex: 1, hasGlow: true
      }
    ];

    let startTime = performance.now();

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;

      ctx.clearRect(0, 0, width, height);

      const activePalette = PALETTES[currentTheme] || PALETTES.monochrome;

      // Draw each chaotic moving line
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];

        // Animate control points with active wave physics
        const t = elapsed * l.flowSpeed;
        const cp1x = (l.cp1x + Math.sin(t * l.freq1 + l.phase1) * l.amp1) * width;
        const cp1y = (l.cp1y + Math.cos(t * l.freq2 + l.phase2) * l.amp2) * height;
        const cp2x = (l.cp2x + Math.cos(t * l.freq1 * 0.95 + l.phase2) * l.amp2) * width;
        const cp2y = (l.cp2y + Math.sin(t * l.freq2 * 1.05 + l.phase1) * l.amp1) * height;

        // Dynamic start/end drift
        const x0 = (l.x0 + Math.sin(t * 0.3 + l.phase1) * 0.04) * width;
        const y0 = (l.y0 + Math.cos(t * 0.35 + l.phase2) * 0.04) * height;
        const x1 = (l.x1 + Math.cos(t * 0.28 + l.phase2) * 0.04) * width;
        const y1 = (l.y1 + Math.sin(t * 0.32 + l.phase1) * 0.04) * height;

        // Dynamic traveling gradient along the line stroke
        const grad = ctx.createLinearGradient(x0, y0, x1, y1);
        const col = activePalette[l.colorIndex % activePalette.length];

        // Traveling light shimmer phase
        const pulsePhase = (t * 0.25) % 1;
        const p1 = Math.max(0, Math.min(1, (pulsePhase + 0.2) % 1));
        const p2 = Math.max(0, Math.min(1, (pulsePhase + 0.5) % 1));
        const p3 = Math.max(0, Math.min(1, (pulsePhase + 0.8) % 1));

        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(p1 * 0.5, col);
        grad.addColorStop(p2, 'rgba(255, 255, 255, 0.45)');
        grad.addColorStop(p3, col);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.save();
        ctx.strokeStyle = grad;
        ctx.lineWidth = l.lineWidth;
        ctx.lineCap = 'round';
        ctx.globalAlpha = l.alpha;

        if (l.hasGlow) {
          ctx.shadowColor = col;
          ctx.shadowBlur = 18;
        }

        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x1, y1);
        ctx.stroke();

        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [currentTheme]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      style={{ opacity: 0.38 }}
    />
  );
}
