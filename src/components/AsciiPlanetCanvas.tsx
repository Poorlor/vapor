import React, { useEffect, useRef } from 'react';

export function AsciiPlanetCanvas({ isPaused = false }: { isPaused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotRef = useRef(0.65);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = parent.clientWidth * dpr;
      canvas.height = parent.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Star clusters & ASCII micro-halos
    const bgStars = Array.from({ length: 72 }, (_, idx) => ({
      x: ((idx * 137.5) % 94) + 3,
      y: ((idx * 293.7) % 92) + 4,
      char: idx % 7 === 0 ? '+' : idx % 3 === 0 ? ':' : '.',
      alpha: 0.16 + (idx % 5) * 0.08,
      hasHalo: idx % 11 === 0
    }));

    const renderFrame = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;

      ctx.clearRect(0, 0, w, h);

      // Subtle architectural grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = 1;
      const gridStep = 96;
      for (let gx = 48; gx < w; gx += gridStep) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 48; gy < h; gy += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      // Draw background stars
      ctx.font = '10px "JetBrains Mono", "SF Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      bgStars.forEach((st) => {
        const sx = (st.x / 100) * w;
        const sy = (st.y / 100) * h;
        if (st.hasHalo) {
          const grad = ctx.createRadialGradient(sx, sy, 1, sx, sy, 22);
          grad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(sx, sy, 22, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(210, 215, 235, ${st.alpha})`;
        ctx.fillText(st.char, sx, sy);
      });

      const cx = w * 0.5;
      const cy = h * 0.5;
      const scale = Math.min(w, h) * 0.28;

      // Warm amber / indigo ambient glow
      const glow = ctx.createRadialGradient(
        cx - scale * 0.2,
        cy - scale * 0.1,
        scale * 0.1,
        cx,
        cy,
        scale * 1.7
      );
      glow.addColorStop(0, 'rgba(245, 158, 11, 0.25)');
      glow.addColorStop(0.45, 'rgba(99, 102, 241, 0.14)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, scale * 1.7, 0, Math.PI * 2);
      ctx.fill();

      // Character cell grid
      const cellW = 7.2;
      const cellH = 11.2;
      const cols = Math.floor((scale * 4.2) / cellW);
      const rows = Math.floor((scale * 2.7) / cellH);

      const roll = 0.33;
      const pitch = 1.24;
      const cosR = Math.cos(roll);
      const sinR = Math.sin(roll);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);

      const lightX = -0.78;
      const lightY = -0.34;
      const lightZ = 0.52;

      const phase = rotRef.current;

      for (let r = -Math.floor(rows / 2); r <= Math.floor(rows / 2); r++) {
        for (let c = -Math.floor(cols / 2); c <= Math.floor(cols / 2); c++) {
          const px = c * cellW;
          const py = r * cellH;

          const nx = px / scale;
          const ny = py / scale;

          const rx = nx * cosR + ny * sinR;
          const ry = -nx * sinR + ny * cosR;

          const ringPlaneZ = -ry * (sinP / cosP);
          const ringY3D = ry / cosP;
          const ringDist = Math.sqrt(rx * rx + ringY3D * ringY3D);
          const ringAngle = Math.atan2(ringY3D, rx) + phase;

          const inRing =
            ringDist >= 1.16 &&
            ringDist <= 2.02 &&
            Math.abs(ringDist - 1.62) > 0.045;

          const r2 = nx * nx + ny * ny;
          const inSphere = r2 <= 1.0;

          if (!inSphere && !inRing) continue;

          let renderSphere = false;
          if (inSphere && inRing) {
            const sphereZ = Math.sqrt(1.0 - r2);
            renderSphere = sphereZ >= ringPlaneZ;
          } else if (inSphere) {
            renderSphere = true;
          }

          if (renderSphere) {
            const sz = Math.sqrt(1.0 - r2);
            const ndotl = nx * lightX + ny * lightY + sz * lightZ;
            const lat = ny * cosR - nx * sinR;
            const lon = Math.atan2(nx * cosR + ny * sinR, sz) + phase * 0.7;
            const bandWave = Math.sin(lat * 18 + Math.sin(lon * 3) * 0.6);
            const rim = 1.0 - sz;

            const storm1 = Math.exp(
              -Math.pow(nx - 0.34, 2) / 0.018 - Math.pow(ny - 0.08, 2) / 0.012
            );
            const storm2 = Math.exp(
              -Math.pow(nx - 0.18, 2) / 0.014 - Math.pow(ny - 0.22, 2) / 0.01
            );

            let char = '.';
            let color = 'rgba(67, 56, 202, 0.65)';

            if (storm1 > 0.48 || storm2 > 0.48) {
              char = storm1 > 0.72 || storm2 > 0.72 ? '#' : '!';
              color = '#f59e0b';
            } else if (ndotl > 0.45) {
              if (rim > 0.52) {
                char = '@';
                color = '#ef4444';
              } else if (ndotl > 0.72) {
                char = '$';
                color = '#fef08a';
              } else {
                char = '#';
                color = '#f59e0b';
              }
            } else if (ndotl > 0.12) {
              char = bandWave > 0 ? '*' : '=';
              color = rim > 0.6 ? '#dc2626' : '#d97706';
            } else if (rim > 0.68) {
              char = ':';
              color = ny < 0 ? '#ea580c' : '#6366f1';
            } else {
              if (bandWave > 0.45) {
                char = ':';
                color = 'rgba(99, 102, 241, 0.65)';
              } else if (bandWave > -0.2) {
                char = '-';
                color = 'rgba(79, 70, 229, 0.55)';
              } else {
                char = '.';
                color = 'rgba(55, 48, 163, 0.45)';
              }
            }

            ctx.fillStyle = color;
            ctx.fillText(char, cx + px, cy + py);
          } else {
            const shimmer = Math.sin(ringDist * 28 + ringAngle * 2);
            const sunWeight = -rx / ringDist;

            let char = '#';
            let color = '#e2e8f0';

            if (ringDist < 1.34) {
              char = shimmer > 0 ? '@' : '#';
              color = sunWeight > 0.15 ? '#fbbf24' : '#cbd5e1';
            } else if (ringDist < 1.6) {
              char = shimmer > 0.2 ? '$' : '*';
              color =
                sunWeight > 0.25
                  ? '#f59e0b'
                  : sunWeight > -0.2
                  ? '#94a3b8'
                  : 'rgba(148, 163, 184, 0.85)';
            } else {
              char = shimmer > 0 ? '=' : ':';
              color =
                sunWeight > 0.2 ? '#ea580c' : 'rgba(129, 140, 248, 0.75)';
            }

            ctx.fillStyle = color;
            ctx.fillText(char, cx + px, cy + py);
          }
        }
      }

      if (!isPaused) {
        rotRef.current += 0.008;
      }
      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isPaused]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}
