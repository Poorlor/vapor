import React, { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  radius: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phase: number;
  color: string;
  layer: number; // 0: distant, 1: mid, 2: foreground hero
  hasSpike: boolean;
  vx: number;
  vy: number;
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  opacity: number;
  active: boolean;
  trailColor: string;
}

interface NebulaCloud {
  x: number;
  y: number;
  radius: number;
  driftX: number;
  driftY: number;
  pulseSpeed: number;
  phase: number;
}

interface CosmicBackgroundCanvasProps {
  themeKey?: string;
  theme?: any;
}

export function CosmicBackgroundCanvas({ themeKey, theme }: CosmicBackgroundCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

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

    const handleMouseMove = (e: MouseEvent) => {
      // Normalized offset from screen center (-1 to 1)
      mouseRef.current.targetX = (e.clientX / width - 0.5) * 2;
      mouseRef.current.targetY = (e.clientY / height - 0.5) * 2;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Color palettes for stars & nebulas per theme
    const THEME_STYLES: Record<
      string,
      {
        nebulaPrimary: string;
        nebulaSecondary: string;
        nebulaTertiary: string;
        heroStarColor: string;
        meteorColor: string;
        orbitColor: string;
      }
    > = {
      monochrome: {
        nebulaPrimary: 'rgba(56, 189, 248, 0.055)',
        nebulaSecondary: 'rgba(147, 197, 253, 0.045)',
        nebulaTertiary: 'rgba(241, 245, 249, 0.035)',
        heroStarColor: '#e0f2fe',
        meteorColor: 'rgba(224, 242, 254, 0.95)',
        orbitColor: 'rgba(255, 255, 255, 0.04)'
      },
      purple: {
        nebulaPrimary: 'rgba(168, 85, 247, 0.065)',
        nebulaSecondary: 'rgba(216, 180, 254, 0.05)',
        nebulaTertiary: 'rgba(99, 102, 241, 0.045)',
        heroStarColor: '#f3e8ff',
        meteorColor: 'rgba(233, 213, 255, 0.95)',
        orbitColor: 'rgba(168, 85, 247, 0.06)'
      },
      amber: {
        nebulaPrimary: 'rgba(245, 158, 11, 0.06)',
        nebulaSecondary: 'rgba(251, 191, 36, 0.045)',
        nebulaTertiary: 'rgba(249, 115, 22, 0.04)',
        heroStarColor: '#fef3c7',
        meteorColor: 'rgba(254, 243, 199, 0.95)',
        orbitColor: 'rgba(245, 158, 11, 0.06)'
      }
    };

    const currentStyle = THEME_STYLES[currentTheme] || THEME_STYLES.monochrome;

    const STAR_PALETTE = [
      '#ffffff',
      '#f8fafc',
      '#e2e8f0',
      '#bae6fd',
      '#e0e7ff',
      '#fef3c7',
      '#dbeafe'
    ];

    // Initialize 240 cosmic stars with multi-depth layers
    const STAR_COUNT = 240;
    const stars: Star[] = Array.from({ length: STAR_COUNT }, (_, i) => {
      const layer = i % 12; // 0-8: distant micro, 9-10: mid, 11: hero star
      let radius = 0.55 + Math.random() * 0.65;
      let baseAlpha = 0.2 + Math.random() * 0.45;
      let hasSpike = false;
      let speedMult = 0.18 + Math.random() * 0.22;
      let starLayer = 0;

      if (layer === 11) {
        // Foreground hero star with diffraction spikes
        radius = 1.9 + Math.random() * 1.0;
        baseAlpha = 0.75 + Math.random() * 0.25;
        hasSpike = true;
        speedMult = 0.6 + Math.random() * 0.4;
        starLayer = 2;
      } else if (layer >= 9) {
        // Midground star
        radius = 1.1 + Math.random() * 0.55;
        baseAlpha = 0.45 + Math.random() * 0.35;
        hasSpike = Math.random() > 0.65;
        speedMult = 0.35 + Math.random() * 0.25;
        starLayer = 1;
      }

      // Very slow cosmic drift angle (~38 degrees)
      const driftAngle = Math.PI * 0.68 + (Math.random() * 0.2 - 0.1);
      const vx = Math.cos(driftAngle) * speedMult * 0.5;
      const vy = Math.sin(driftAngle) * speedMult * 0.5;

      const x = Math.random() * width;
      const y = Math.random() * height;

      return {
        x,
        y,
        baseX: x,
        baseY: y,
        radius,
        baseAlpha,
        twinkleSpeed: 0.7 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
        color:
          starLayer === 2
            ? currentStyle.heroStarColor
            : STAR_PALETTE[Math.floor(Math.random() * STAR_PALETTE.length)],
        layer: starLayer,
        hasSpike,
        vx,
        vy
      };
    });

    // 4 Volumetric Nebula Dust Clouds drifting slowly
    const nebulae: NebulaCloud[] = [
      {
        x: width * 0.25,
        y: height * 0.28,
        radius: Math.max(width, height) * 0.38,
        driftX: 0.18,
        driftY: 0.12,
        pulseSpeed: 0.4,
        phase: 0
      },
      {
        x: width * 0.78,
        y: height * 0.38,
        radius: Math.max(width, height) * 0.42,
        driftX: -0.15,
        driftY: 0.16,
        pulseSpeed: 0.35,
        phase: Math.PI * 0.7
      },
      {
        x: width * 0.45,
        y: height * 0.82,
        radius: Math.max(width, height) * 0.45,
        driftX: 0.12,
        driftY: -0.14,
        pulseSpeed: 0.45,
        phase: Math.PI * 1.3
      },
      {
        x: width * 0.88,
        y: height * 0.88,
        radius: Math.max(width, height) * 0.32,
        driftX: -0.1,
        driftY: -0.12,
        pulseSpeed: 0.3,
        phase: Math.PI * 0.4
      }
    ];

    // Shooting stars queue
    const shootingStars: ShootingStar[] = [];
    let lastShootingStarTime = Date.now();

    const spawnShootingStar = () => {
      const angle = Math.PI * 0.74 + (Math.random() * 0.22 - 0.11);
      shootingStars.push({
        x: width * 0.2 + Math.random() * width * 0.8,
        y: -30 + Math.random() * height * 0.35,
        length: 80 + Math.random() * 100,
        speed: 10 + Math.random() * 8,
        angle,
        opacity: 0.95,
        active: true,
        trailColor: currentStyle.meteorColor
      });
    };

    let startTime = performance.now();

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;

      // Smooth mouse parallax interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.04;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.04;
      const pX = mouseRef.current.x;
      const pY = mouseRef.current.y;

      ctx.clearRect(0, 0, width, height);

      // Deep Space Base
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, width, height);

      // 1. Render Volumetric Nebula Dust Clouds
      for (let i = 0; i < nebulae.length; i++) {
        const n = nebulae[i];
        const pulse = 1 + Math.sin(elapsed * n.pulseSpeed + n.phase) * 0.12;
        const currentRadius = n.radius * pulse;

        // Subtle drift with mouse parallax
        const nebX = n.x + Math.sin(elapsed * 0.1 + n.phase) * 35 + pX * 18;
        const nebY = n.y + Math.cos(elapsed * 0.08 + n.phase) * 28 + pY * 18;

        const grad = ctx.createRadialGradient(nebX, nebY, 0, nebX, nebY, currentRadius);
        const color =
          i % 3 === 0
            ? currentStyle.nebulaPrimary
            : i % 3 === 1
            ? currentStyle.nebulaSecondary
            : currentStyle.nebulaTertiary;

        grad.addColorStop(0, color);
        grad.addColorStop(0.5, color.replace(/[\d.]+\)$/, '0.02)'));
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.save();
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(nebX, nebY, currentRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 2. Faint Celestial Orbital Ellipse (Tactile Space Navigation)
      ctx.save();
      const orbitCenterX = width * 0.85 + pX * 12;
      const orbitCenterY = height * 0.22 + pY * 12;
      const orbitRadiusX = Math.max(width, height) * 0.48;
      const orbitRadiusY = Math.max(width, height) * 0.22;
      const orbitAngle = elapsed * 0.015; // Slow rotation

      ctx.translate(orbitCenterX, orbitCenterY);
      ctx.rotate(orbitAngle);
      ctx.strokeStyle = currentStyle.orbitColor;
      ctx.lineWidth = 1.1;
      ctx.setLineDash([4, 16]);
      ctx.beginPath();
      ctx.ellipse(0, 0, orbitRadiusX, orbitRadiusY, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Second smaller nested orbital ellipse
      ctx.lineWidth = 0.8;
      ctx.setLineDash([2, 24]);
      ctx.beginPath();
      ctx.ellipse(0, 0, orbitRadiusX * 0.65, orbitRadiusY * 0.65, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 3. Ephemeral Constellation Micro-links between close midground stars
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.055)';
      ctx.lineWidth = 0.7;
      for (let i = 0; i < stars.length; i += 7) {
        const s1 = stars[i];
        if (s1.layer < 1) continue;
        for (let j = i + 1; j < Math.min(i + 8, stars.length); j++) {
          const s2 = stars[j];
          if (s2.layer < 1) continue;
          const dx = s1.x - s2.x;
          const dy = s1.y - s2.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 7200) {
            // ~85px threshold
            const alpha = (1 - Math.sqrt(distSq) / 85) * 0.08;
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(s1.x, s1.y);
            ctx.lineTo(s2.x, s2.y);
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      // 4. Update and Render Stars
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];

        // Cosmic drift
        s.x += s.vx;
        s.y += s.vy;

        // Wrap around screen bounds
        if (s.x < -20) s.x = width + 20;
        if (s.x > width + 20) s.x = -20;
        if (s.y < -20) s.y = height + 20;
        if (s.y > height + 20) s.y = -20;

        // Depth parallax based on layer
        const layerParallax = s.layer === 2 ? 26 : s.layer === 1 ? 14 : 6;
        const renderX = s.x + pX * layerParallax;
        const renderY = s.y + pY * layerParallax;

        // Twinkle luminance modulation
        const currentAlpha = Math.max(
          0.06,
          Math.min(1, s.baseAlpha + Math.sin(elapsed * s.twinkleSpeed + s.phase) * 0.32)
        );

        ctx.save();
        ctx.globalAlpha = currentAlpha;

        // Ambient photon halo for hero stars
        if (s.radius > 1.3) {
          const haloGrad = ctx.createRadialGradient(
            renderX,
            renderY,
            0,
            renderX,
            renderY,
            s.radius * 4.2
          );
          haloGrad.addColorStop(0, s.color);
          haloGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.28)');
          haloGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = haloGrad;
          ctx.beginPath();
          ctx.arc(renderX, renderY, s.radius * 4.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Star core
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(renderX, renderY, s.radius, 0, Math.PI * 2);
        ctx.fill();

        // 4-point diffraction spike on foreground hero stars
        if (s.hasSpike && currentAlpha > 0.5) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${currentAlpha * 0.65})`;
          ctx.lineWidth = 0.85;
          const spikeLen = s.radius * 4.8;
          ctx.beginPath();
          ctx.moveTo(renderX - spikeLen, renderY);
          ctx.lineTo(renderX + spikeLen, renderY);
          ctx.moveTo(renderX, renderY - spikeLen);
          ctx.lineTo(renderX, renderY + spikeLen);
          ctx.stroke();
        }

        ctx.restore();
      }

      // 5. Spawn Shooting Stars periodically (every 3.5 - 6 seconds)
      const nowMs = Date.now();
      if (nowMs - lastShootingStarTime > 3500 + Math.random() * 2500) {
        lastShootingStarTime = nowMs;
        spawnShootingStar();
      }

      // 6. Render & Update Shooting Stars (Meteors)
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        if (!ss.active) continue;

        const tailX = ss.x - Math.cos(ss.angle) * ss.length;
        const tailY = ss.y - Math.sin(ss.angle) * ss.length;

        const trailGrad = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
        trailGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        trailGrad.addColorStop(0.7, ss.trailColor.replace(/[\d.]+\)$/, `${ss.opacity * 0.45})`));
        trailGrad.addColorStop(1, ss.trailColor.replace(/[\d.]+\)$/, `${ss.opacity})`));

        ctx.save();
        ctx.strokeStyle = trailGrad;
        ctx.lineWidth = 1.85;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(ss.x, ss.y);
        ctx.stroke();

        // Small bright meteor head sparkle
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ss.x, ss.y, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Fast movement
        ss.x += Math.cos(ss.angle) * ss.speed;
        ss.y += Math.sin(ss.angle) * ss.speed;
        ss.opacity -= 0.014;

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
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [currentTheme]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
    />
  );
}
