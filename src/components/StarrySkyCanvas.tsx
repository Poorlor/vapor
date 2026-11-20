import React, { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phase: number;
  hasSpike: boolean;
  color: string;
  // Dynamic motion properties
  vx: number;
  vy: number;
  layer: number;
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  opacity: number;
  active: boolean;
}

export function StarrySkyCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

    // Star color palette (optical white, icy blue, warm ivory)
    const starPalette = [
      '#ffffff',
      '#f8fafc',
      '#e2e8f0',
      '#cbd5e1',
      '#dbeafe',
      '#fef3c7',
      '#e0e7ff',
      '#bae6fd'
    ];

    // Rich star field (260 stars across the full viewport)
    const STAR_COUNT = 260;

    const stars: Star[] = Array.from({ length: STAR_COUNT }, (_, i) => {
      const layer = i % 10;
      // Layer 0-6: distant (slow, small)
      // Layer 7-8: midground (medium speed & size)
      // Layer 9: foreground hero stars (faster, large with spikes)
      let radius = 0.65 + Math.random() * 0.65;
      let baseAlpha = 0.25 + Math.random() * 0.45;
      let hasSpike = false;
      let speedMult = 0.28 + Math.random() * 0.25;

      if (layer === 9) {
        radius = 1.8 + Math.random() * 1.1;
        baseAlpha = 0.8 + Math.random() * 0.2;
        hasSpike = Math.random() > 0.35;
        speedMult = 1.1 + Math.random() * 0.6;
      } else if (layer >= 7) {
        radius = 1.15 + Math.random() * 0.6;
        baseAlpha = 0.5 + Math.random() * 0.35;
        speedMult = 0.65 + Math.random() * 0.35;
      }

      // Gentle cosmic drift angle (drifting down and left at ~35 degrees)
      const driftAngle = Math.PI * 0.65 + (Math.random() * 0.2 - 0.1);
      const vx = Math.cos(driftAngle) * speedMult;
      const vy = Math.sin(driftAngle) * speedMult;

      return {
        x: Math.random() * width,
        y: Math.random() * height,
        radius,
        baseAlpha,
        twinkleSpeed: 0.8 + Math.random() * 2.0,
        phase: Math.random() * Math.PI * 2,
        hasSpike,
        color: starPalette[Math.floor(Math.random() * starPalette.length)],
        vx,
        vy,
        layer
      };
    });

    // Shooting stars
    const shootingStars: ShootingStar[] = [];
    let lastShootingStarTime = Date.now();

    const spawnShootingStar = () => {
      const angle = Math.PI * 0.72 + (Math.random() * 0.25 - 0.12);
      shootingStars.push({
        x: width * 0.3 + Math.random() * width * 0.7,
        y: -20 + Math.random() * height * 0.3,
        length: 70 + Math.random() * 90,
        speed: 9 + Math.random() * 7,
        angle,
        opacity: 0.95,
        active: true
      });
    };

    let startTime = performance.now();

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;

      ctx.clearRect(0, 0, width, height);

      // Deep celestial ambient background with subtle nebula glow
      const bgGrad = ctx.createRadialGradient(
        width * 0.45,
        height * 0.35,
        width * 0.05,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.85
      );
      bgGrad.addColorStop(0, 'rgba(14, 18, 36, 0.45)');
      bgGrad.addColorStop(0.4, 'rgba(8, 10, 20, 0.25)');
      bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Update and render moving stars
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];

        // Move star across the screen
        s.x += s.vx;
        s.y += s.vy;

        // Wrap around viewport edges smoothly
        if (s.x < -20) s.x = width + 20;
        if (s.x > width + 20) s.x = -20;
        if (s.y < -20) s.y = height + 20;
        if (s.y > height + 20) s.y = -20;

        // Twinkle modulation
        const currentAlpha = Math.max(
          0.08,
          Math.min(1, s.baseAlpha + Math.sin(elapsed * s.twinkleSpeed + s.phase) * 0.35)
        );

        ctx.save();
        ctx.globalAlpha = currentAlpha;

        // Soft ambient halo on larger stars
        if (s.radius > 1.3) {
          const haloGrad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.radius * 3.8);
          haloGrad.addColorStop(0, s.color);
          haloGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.3)');
          haloGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = haloGrad;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.radius * 3.8, 0, Math.PI * 2);
          ctx.fill();
        }

        // Star core
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();

        // 4-point cross diffraction spikes on hero stars
        if (s.hasSpike && currentAlpha > 0.6) {
          ctx.strokeStyle = 'rgba(255, 255, 255, ' + (currentAlpha * 0.6) + ')';
          ctx.lineWidth = 0.85;
          const spikeLen = s.radius * 4.5;
          ctx.beginPath();
          ctx.moveTo(s.x - spikeLen, s.y);
          ctx.lineTo(s.x + spikeLen, s.y);
          ctx.moveTo(s.x, s.y - spikeLen);
          ctx.lineTo(s.x, s.y + spikeLen);
          ctx.stroke();
        }

        ctx.restore();
      }

      // Check shooting star spawning (every 4-6 seconds)
      const nowMs = Date.now();
      if (nowMs - lastShootingStarTime > 4000 + Math.random() * 3000) {
        lastShootingStarTime = nowMs;
        spawnShootingStar();
      }

      // Render & update shooting stars
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        if (!ss.active) continue;

        const tailX = ss.x - Math.cos(ss.angle) * ss.length;
        const tailY = ss.y - Math.sin(ss.angle) * ss.length;

        const trailGrad = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
        trailGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        trailGrad.addColorStop(0.65, 'rgba(210, 230, 255, ' + (ss.opacity * 0.45) + ')');
        trailGrad.addColorStop(1, 'rgba(255, 255, 255, ' + ss.opacity + ')');

        ctx.save();
        ctx.strokeStyle = trailGrad;
        ctx.lineWidth = 1.75;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(ss.x, ss.y);
        ctx.stroke();
        ctx.restore();

        // Move shooting star fast across the sky
        ss.x += Math.cos(ss.angle) * ss.speed;
        ss.y += Math.sin(ss.angle) * ss.speed;
        ss.opacity -= 0.013;

        if (ss.opacity <= 0 || ss.x < -100 || ss.y > height + 100) {
          shootingStars.splice(i, 1);
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
    />
  );
}
