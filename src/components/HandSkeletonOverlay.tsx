import React, { useEffect, useRef } from 'react';
import { DualHandMetrics, SingleHandData } from '../types/tracking';

export interface AirDrawStroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  size: number;
}

interface HandSkeletonOverlayProps {
  metrics: DualHandMetrics;
  sensitivity: number;
  showSkeleton: boolean;
  isAirDrawActive: boolean;
  onClearDrawing?: () => void;
}

// 21-joint skeleton connections
const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm transverse arch
  [5, 9], [9, 13], [13, 17]
];

export const HandSkeletonOverlay: React.FC<HandSkeletonOverlayProps> = ({
  metrics,
  sensitivity,
  showSkeleton,
  isAirDrawActive,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Air-drawing strokes state
  const strokesRef = useRef<AirDrawStroke[]>([]);
  const activeLeftStrokeRef = useRef<{ x: number; y: number }[]>([]);
  const activeRightStrokeRef = useRef<{ x: number; y: number }[]>([]);

  // Smooth screen positions for drawing pointers
  const prevLeftPointer = useRef({ x: 0, y: 0, active: false });
  const prevRightPointer = useRef({ x: 0, y: 0, active: false });

  // Map normalized coordinate (0..1) to screen pixel coordinate with edge expansion
  const mapToScreen = (nx: number, ny: number, width: number, height: number, sens: number) => {
    // Edge expansion: ensures hand reaches the extreme screen border seamlessly ("chekaga olsam chekaga chiqish kerak")
    const edgeSens = Math.max(1.0, sens * 1.15);
    const expandedX = Math.min(1.0, Math.max(0.0, (nx - 0.5) * edgeSens + 0.5));
    const expandedY = Math.min(1.0, Math.max(0.0, (ny - 0.5) * edgeSens + 0.5));
    return {
      x: expandedX * width,
      y: expandedY * height,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let animId: number;

    const render = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, w, h);
      const time = performance.now() * 0.003;

      // 1. RENDER PERSISTED AIR-DRAWING STROKES (Havoda chizilgan yozuvlar va chiziqlar)
      if (isAirDrawActive && strokesRef.current.length > 0) {
        for (const stroke of strokesRef.current) {
          if (stroke.points.length < 2) continue;
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.size;
          ctx.shadowColor = stroke.color;
          ctx.shadowBlur = stroke.size * 2.2;

          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            const midX = (stroke.points[i - 1].x + stroke.points[i].x) / 2;
            const midY = (stroke.points[i - 1].y + stroke.points[i].y) / 2;
            ctx.quadraticCurveTo(stroke.points[i - 1].x, stroke.points[i - 1].y, midX, midY);
          }
          ctx.stroke();
          ctx.restore();
        }
      }

      // 2. RENDER ACTIVE IN-PROGRESS AIR-DRAWING STROKES
      const drawActiveTrail = (points: { x: number; y: number }[], color: string) => {
        if (points.length < 2) return;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = color;
        ctx.lineWidth = 6;
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          const midX = (points[i - 1].x + points[i].x) / 2;
          const midY = (points[i - 1].y + points[i].y) / 2;
          ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, midX, midY);
        }
        ctx.stroke();
        ctx.restore();
      };

      if (isAirDrawActive) {
        drawActiveTrail(activeLeftStrokeRef.current, '#fbbf24');
        drawActiveTrail(activeRightStrokeRef.current, '#38bdf8');
      }

      // 3. DRAW FULL-SCREEN GLOWING NEON SKELETAL HANDS ("ekrani o'zida chizilgan qo'l")
      if (showSkeleton) {
        const handsToRender: SingleHandData[] = [];
        if (metrics.leftHand && metrics.leftHand.isDetected) handsToRender.push(metrics.leftHand);
        if (metrics.rightHand && metrics.rightHand.isDetected) handsToRender.push(metrics.rightHand);

        handsToRender.forEach((hand) => {
          const isLeft = hand.handedness === 'Left';
          const neonColor = isLeft ? '#00f2fe' : '#e879f9';
          const coreColor = '#ffffff';

          // Extract screen pixel positions for all 21 landmarks
          const screenPts: { x: number; y: number }[] = [];

          if (hand.landmarks && hand.landmarks.length >= 21) {
            for (let i = 0; i < 21; i++) {
              const lm = hand.landmarks[i];
              const nx = lm.nx !== undefined ? lm.nx : (lm.x + 1) / 2;
              const ny = lm.ny !== undefined ? lm.ny : (-lm.y + 1) / 2;
              screenPts.push(mapToScreen(nx, ny, w, h, sensitivity));
            }
          } else {
            // Fallback estimation around hand position
            const normX = (hand.position.x + 1) / 2;
            const normY = (-hand.position.y + 1) / 2;
            const center = mapToScreen(normX, normY, w, h, sensitivity);
            for (let i = 0; i < 21; i++) {
              screenPts.push({
                x: center.x + (Math.random() - 0.5) * 40,
                y: center.y + (Math.random() - 0.5) * 40,
              });
            }
          }

          // A. Draw glowing bones
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // Outer high-energy glow
          ctx.strokeStyle = neonColor;
          ctx.shadowColor = neonColor;
          ctx.shadowBlur = 14;
          ctx.lineWidth = 3.5;

          HAND_CONNECTIONS.forEach(([start, end]) => {
            const p1 = screenPts[start];
            const p2 = screenPts[end];
            if (!p1 || !p2) return;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          });

          // Inner sharp white laser core
          ctx.shadowBlur = 0;
          ctx.strokeStyle = coreColor;
          ctx.lineWidth = 1.2;
          HAND_CONNECTIONS.forEach(([start, end]) => {
            const p1 = screenPts[start];
            const p2 = screenPts[end];
            if (!p1 || !p2) return;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          });
          ctx.restore();

          // B. Draw knuckle joint nodes
          screenPts.forEach((pt, idx) => {
            const isTip = [4, 8, 12, 16, 20].includes(idx);
            ctx.save();
            if (isTip) {
              // Fingertip glowing sensor with pulsating energy ring
              const ringRadius = 7 + Math.sin(time * 6 + idx) * 2;
              ctx.strokeStyle = neonColor;
              ctx.lineWidth = 2;
              ctx.shadowColor = neonColor;
              ctx.shadowBlur = 12;
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, ringRadius, 0, Math.PI * 2);
              ctx.stroke();

              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
              ctx.fill();
            } else {
              // Knuckle node
              ctx.fillStyle = neonColor;
              ctx.shadowColor = neonColor;
              ctx.shadowBlur = 8;
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          });

          // C. Palm Energy Core (Markaziy kvant yadrosi)
          const wrist = screenPts[0];
          const middleMcp = screenPts[9];
          if (wrist && middleMcp) {
            const palmX = (wrist.x * 0.4 + middleMcp.x * 0.6);
            const palmY = (wrist.y * 0.4 + middleMcp.y * 0.6);

            ctx.save();
            ctx.translate(palmX, palmY);
            ctx.rotate(time * 1.5 * (isLeft ? 1 : -1));

            // Core energy ring
            const coreRadius = 14 + Math.sin(time * 8) * 3;
            ctx.strokeStyle = neonColor;
            ctx.lineWidth = 1.8;
            ctx.shadowColor = neonColor;
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
            ctx.stroke();

            // Sci-fi crosshair ticks
            ctx.beginPath();
            ctx.moveTo(-coreRadius - 5, 0); ctx.lineTo(-coreRadius + 2, 0);
            ctx.moveTo(coreRadius - 2, 0);  ctx.lineTo(coreRadius + 5, 0);
            ctx.moveTo(0, -coreRadius - 5); ctx.lineTo(0, -coreRadius + 2);
            ctx.moveTo(0, coreRadius - 2);  ctx.lineTo(0, coreRadius + 5);
            ctx.stroke();

            ctx.restore();

            // D. Floating Cyber HUD Status Tag near the wrist
            const isFist = hand.gesture === 'FIST' || (hand.fingerBends && hand.fingerBends[1] > 0.65 && hand.fingerBends[2] > 0.65);
            const isPointing = hand.gesture === 'POINTING' || (hand.fingerBends && hand.fingerBends[1] < 0.35 && hand.fingerBends[2] > 0.6);
            const isOpen = hand.gesture === 'OPEN_PALM';

            let statusLabel = isLeft ? '[L: CHAP QO‘L]' : '[R: O‘NG QO‘L]';
            let statusColor = neonColor;

            if (isFist) {
              statusLabel = isLeft ? '✊ CHAP: ZICHLASHGAN' : '✊ O‘NG: ZICHLASHGAN';
              statusColor = '#f59e0b';
            } else if (isOpen) {
              statusLabel = isLeft ? '🖐️ CHAP: YOYILGAN' : '🖐️ O‘NG: YOYILGAN';
              statusColor = '#00f2fe';
            } else if (isPointing) {
              statusLabel = isLeft ? '👆 CHAP: CHIZISH' : '👆 O‘NG: CHIZISH';
              statusColor = '#10b981';
            }

            ctx.save();
            ctx.font = '10px "Courier New", monospace';
            ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
            const textWidth = ctx.measureText(statusLabel).width;
            ctx.fillRect(wrist.x - textWidth / 2 - 8, wrist.y + 14, textWidth + 16, 18);
            ctx.strokeStyle = statusColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(wrist.x - textWidth / 2 - 8, wrist.y + 14, textWidth + 16, 18);

            ctx.fillStyle = statusColor;
            ctx.shadowColor = statusColor;
            ctx.shadowBlur = 6;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(statusLabel, wrist.x, wrist.y + 23);
            ctx.restore();
          }

          // E. Handle Air-Drawing trail tracking from index fingertip (pt 8)
          if (isAirDrawActive && screenPts[8]) {
            const indexTip = screenPts[8];
            const isPointing = hand.gesture === 'POINTING' || hand.gesture === 'PINCH' || (hand.fingerBends && hand.fingerBends[1] < 0.45);

            if (isPointing) {
              const activeStroke = isLeft ? activeLeftStrokeRef.current : activeRightStrokeRef.current;
              activeStroke.push({ x: indexTip.x, y: indexTip.y });

              // Limit max trail length for smooth performance
              if (activeStroke.length > 350) {
                activeStroke.shift();
              }
            } else {
              // Finished stroke, commit to persisted strokes
              const activeStroke = isLeft ? activeLeftStrokeRef.current : activeRightStrokeRef.current;
              if (activeStroke.length > 2) {
                strokesRef.current.push({
                  id: `stroke-${Date.now()}-${Math.random()}`,
                  points: [...activeStroke],
                  color: isLeft ? '#fbbf24' : '#38bdf8',
                  size: 6,
                });
              }
              if (isLeft) activeLeftStrokeRef.current = [];
              else activeRightStrokeRef.current = [];
            }
          }
        });
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [metrics, sensitivity, showSkeleton, isAirDrawActive]);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full pointer-events-none select-none z-20">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};
