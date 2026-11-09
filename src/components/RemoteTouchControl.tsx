import React, { useEffect, useRef, useState, useCallback } from 'react';
import { DualHandMetrics, SingleHandData } from '../types/tracking';
import { spatialAudio } from '../utils/audio';
import { 
  Smartphone, 
  Hand, 
  Sparkles, 
  Radio, 
  Music, 
  Camera, 
  Sliders, 
  Play, 
  Pause, 
  Layers, 
  Heart, 
  Share2, 
  RotateCcw,
  Zap,
  Volume2,
  VolumeX,
  GripHorizontal,
  Maximize2
} from 'lucide-react';

interface RemoteTouchControlProps {
  metrics: DualHandMetrics;
  sensitivity: number;
}

interface MovableCard {
  id: string;
  type: 'reel' | 'black-hole' | 'music-player' | 'telemetry' | 'notes';
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  title: string;
}

const INITIAL_CARDS: MovableCard[] = [
  {
    id: 'card-reel',
    type: 'reel',
    x: 60,
    y: 85,
    width: 320,
    height: 480,
    zIndex: 10,
    title: 'Instagram Reels Video',
  },
  {
    id: 'card-black-hole',
    type: 'black-hole',
    x: 410,
    y: 85,
    width: 340,
    height: 250,
    zIndex: 9,
    title: 'Gargantua Qora Tuynuk Oynasi',
  },
  {
    id: 'card-music',
    type: 'music-player',
    x: 410,
    y: 355,
    width: 340,
    height: 210,
    zIndex: 8,
    title: 'Kiber Kosmik Audio Pleer',
  },
  {
    id: 'card-telemetry',
    type: 'telemetry',
    x: 780,
    y: 85,
    width: 290,
    height: 220,
    zIndex: 7,
    title: 'Qo‘l Sensori & Telemetriya',
  },
  {
    id: 'card-notes',
    type: 'notes',
    x: 780,
    y: 325,
    width: 290,
    height: 240,
    zIndex: 6,
    title: 'Kosmik Tezkor Eslatmalar',
  },
];

export const RemoteTouchControl: React.FC<RemoteTouchControlProps> = ({ metrics, sensitivity }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Movable cards state
  const [cards, setCards] = useState<MovableCard[]>(INITIAL_CARDS);
  const [maxZIndex, setMaxZIndex] = useState(25);

  // Reel states
  const [isReelLiked, setIsReelLiked] = useState(true);
  const [isReelPlaying, setIsReelPlaying] = useState(true);
  const [reelLikesCount, setReelLikesCount] = useState(112500);

  // Music Player states
  const [isPlayingMusic, setIsPlayingMusic] = useState(true);
  const [musicMuted, setMusicMuted] = useState(false);

  // DUAL-HAND INDEPENDENT GRAB & DRAG REFS
  // ("ikta qo'l bn ham boshqarsa bo'ladigan qil")
  const leftDragRef = useRef<{ cardId: string; offsetX: number; offsetY: number } | null>(null);
  const rightDragRef = useRef<{ cardId: string; offsetX: number; offsetY: number } | null>(null);
  const twoHandScaleRef = useRef<{ cardId: string; startDist: number; startW: number; startH: number } | null>(null);

  // Active hover and drag UI state
  const [leftDraggedId, setLeftDraggedId] = useState<string | null>(null);
  const [rightDraggedId, setRightDraggedId] = useState<string | null>(null);
  const [hoveredCardIds, setHoveredCardIds] = useState<{ left: string | null; right: string | null }>({
    left: null,
    right: null,
  });

  // Mouse fallback drag state
  const mouseDragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  // Ripple sparks
  const [sparks, setSparks] = useState<{ id: number; x: number; y: number; color: string }[]>([]);

  // Reset cards layout to initial coordinates
  const handleResetLayout = () => {
    spatialAudio.playThemeSwitch();
    setCards(INITIAL_CARDS);
  };

  // Mouse Drag Fallback Handlers
  const handleMouseDownCard = (id: string, e: React.MouseEvent) => {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    const nextZ = maxZIndex + 1;
    setMaxZIndex(nextZ);
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, zIndex: nextZ } : c)));
    mouseDragRef.current = {
      id,
      offsetX: e.clientX - card.x,
      offsetY: e.clientY - card.y,
    };
    spatialAudio.playPinchGrab();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseDragRef.current) return;
      const { id, offsetX, offsetY } = mouseDragRef.current;
      setCards((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          return {
            ...c,
            x: Math.max(0, Math.min(window.innerWidth - c.width, e.clientX - offsetX)),
            y: Math.max(0, Math.min(window.innerHeight - c.height, e.clientY - offsetY)),
          };
        })
      );
    };

    const handleMouseUp = () => {
      if (mouseDragRef.current) {
        spatialAudio.playRelease();
        mouseDragRef.current = null;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Main Render Loop: Dual-Hand Simultaneous Tracking, Grabbing, and Drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let animId: number;

    const HAND_BONES = [
      [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8],       // Index
      [0, 9], [9, 10], [10, 11], [11, 12],   // Middle
      [0, 13], [13, 14], [14, 15], [15, 16], // Ring
      [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
      [5, 9], [9, 13], [13, 17]              // Knuckle arch
    ];

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
      const sens = Math.max(1.0, sensitivity * 1.3);

      // Helper to compute screen position of a hand with edge-expansion
      const getHandScreen = (hand: SingleHandData) => {
        let rawNx = (hand.position.x + 1) / 2;
        let rawNy = (-hand.position.y + 1) / 2;

        if (hand.landmarks && hand.landmarks.length >= 21) {
          const wrist = hand.landmarks[0];
          const middleMcp = hand.landmarks[9];
          rawNx = ((wrist.nx !== undefined ? wrist.nx : (wrist.x + 1) / 2) * 0.4 +
                   (middleMcp.nx !== undefined ? middleMcp.nx : (middleMcp.x + 1) / 2) * 0.6);
          rawNy = ((wrist.ny !== undefined ? wrist.ny : (-wrist.y + 1) / 2) * 0.4 +
                   (middleMcp.ny !== undefined ? middleMcp.ny : (-middleMcp.y + 1) / 2) * 0.6);
        }

        const expNx = Math.min(1.0, Math.max(0.0, (rawNx - 0.5) * sens + 0.5));
        const expNy = Math.min(1.0, Math.max(0.0, (rawNy - 0.5) * sens + 0.5));

        return {
          x: expNx * w,
          y: expNy * h,
        };
      };

      // Check whether hand is making a fist or pinching
      const isGrabbingHand = (hand: SingleHandData) => {
        const avgCurl = hand.fingerBends
          ? (hand.fingerBends[0] + hand.fingerBends[1] + hand.fingerBends[2] + hand.fingerBends[3] + hand.fingerBends[4]) / 5
          : 0.5;
        return hand.gesture === 'FIST' || avgCurl > 0.58 || hand.isPinching;
      };

      // Find top card under a screen coordinate
      const findCardAt = (sx: number, sy: number) => {
        for (let i = cards.length - 1; i >= 0; i--) {
          const c = cards[i];
          if (
            sx >= c.x - 20 &&
            sx <= c.x + c.width + 20 &&
            sy >= c.y - 20 &&
            sy <= c.y + c.height + 20
          ) {
            return c;
          }
        }
        return null;
      };

      const leftHand = metrics.leftHand && metrics.leftHand.isDetected ? metrics.leftHand : null;
      const rightHand = metrics.rightHand && metrics.rightHand.isDetected ? metrics.rightHand : null;

      let leftPos = { x: 0, y: 0 };
      let rightPos = { x: 0, y: 0 };
      let isLeftGrabbing = false;
      let isRightGrabbing = false;
      let targetLeftCard: MovableCard | null = null;
      let targetRightCard: MovableCard | null = null;

      // 1. Process LEFT HAND
      if (leftHand) {
        leftPos = getHandScreen(leftHand);
        isLeftGrabbing = isGrabbingHand(leftHand);
        targetLeftCard = findCardAt(leftPos.x, leftPos.y);

        if (isLeftGrabbing) {
          if (!leftDragRef.current && targetLeftCard) {
            leftDragRef.current = {
              cardId: targetLeftCard.id,
              offsetX: leftPos.x - targetLeftCard.x,
              offsetY: leftPos.y - targetLeftCard.y,
            };
            setLeftDraggedId(targetLeftCard.id);
            setMaxZIndex((prevZ) => {
              const nextZ = prevZ + 1;
              setCards((prev) =>
                prev.map((c) => (c.id === targetLeftCard!.id ? { ...c, zIndex: nextZ } : c))
              );
              return nextZ;
            });
            spatialAudio.playPinchGrab();
            setSparks((prev) => [...prev, { id: Date.now(), x: leftPos.x, y: leftPos.y, color: '#fbbf24' }]);
            setTimeout(() => setSparks((prev) => prev.slice(1)), 400);
          } else if (leftDragRef.current) {
            const curId = leftDragRef.current.cardId;
            const off = leftDragRef.current;
            const nextX = Math.max(10, Math.min(w - 180, leftPos.x - off.offsetX));
            const nextY = Math.max(10, Math.min(h - 140, leftPos.y - off.offsetY));
            setCards((prev) =>
              prev.map((c) => (c.id === curId ? { ...c, x: nextX, y: nextY } : c))
            );
          }
        } else {
          if (leftDragRef.current) {
            spatialAudio.playRelease();
            leftDragRef.current = null;
            setLeftDraggedId(null);
          }
        }
      } else {
        if (leftDragRef.current) {
          leftDragRef.current = null;
          setLeftDraggedId(null);
        }
      }

      // 2. Process RIGHT HAND
      if (rightHand) {
        rightPos = getHandScreen(rightHand);
        isRightGrabbing = isGrabbingHand(rightHand);
        targetRightCard = findCardAt(rightPos.x, rightPos.y);

        if (isRightGrabbing) {
          if (!rightDragRef.current && targetRightCard) {
            rightDragRef.current = {
              cardId: targetRightCard.id,
              offsetX: rightPos.x - targetRightCard.x,
              offsetY: rightPos.y - targetRightCard.y,
            };
            setRightDraggedId(targetRightCard.id);
            setMaxZIndex((prevZ) => {
              const nextZ = prevZ + 1;
              setCards((prev) =>
                prev.map((c) => (c.id === targetRightCard!.id ? { ...c, zIndex: nextZ } : c))
              );
              return nextZ;
            });
            spatialAudio.playPinchGrab();
            setSparks((prev) => [...prev, { id: Date.now(), x: rightPos.x, y: rightPos.y, color: '#00f2fe' }]);
            setTimeout(() => setSparks((prev) => prev.slice(1)), 400);
          } else if (rightDragRef.current) {
            const curId = rightDragRef.current.cardId;
            const off = rightDragRef.current;
            const nextX = Math.max(10, Math.min(w - 180, rightPos.x - off.offsetX));
            const nextY = Math.max(10, Math.min(h - 140, rightPos.y - off.offsetY));
            setCards((prev) =>
              prev.map((c) => (c.id === curId ? { ...c, x: nextX, y: nextY } : c))
            );
          }
        } else {
          if (rightDragRef.current) {
            spatialAudio.playRelease();
            rightDragRef.current = null;
            setRightDraggedId(null);
          }
        }
      } else {
        if (rightDragRef.current) {
          rightDragRef.current = null;
          setRightDraggedId(null);
        }
      }

      // 3. COOPERATIVE TWO-HAND GESTURE (When both hands grab the SAME card -> Resize & Move!)
      if (
        leftHand &&
        rightHand &&
        isLeftGrabbing &&
        isRightGrabbing &&
        leftDragRef.current &&
        rightDragRef.current &&
        leftDragRef.current.cardId === rightDragRef.current.cardId
      ) {
        const sharedId = leftDragRef.current.cardId;
        const currentDist = Math.hypot(leftPos.x - rightPos.x, leftPos.y - rightPos.y);

        if (!twoHandScaleRef.current || twoHandScaleRef.current.cardId !== sharedId) {
          const card = cards.find((c) => c.id === sharedId);
          if (card) {
            twoHandScaleRef.current = {
              cardId: sharedId,
              startDist: currentDist,
              startW: card.width,
              startH: card.height,
            };
          }
        } else {
          // Dynamic scaling with two hands!
          const scaleRatio = Math.max(0.65, Math.min(1.8, currentDist / Math.max(60, twoHandScaleRef.current.startDist)));
          const targetW = Math.round(twoHandScaleRef.current.startW * scaleRatio);
          const targetH = Math.round(twoHandScaleRef.current.startH * scaleRatio);
          const midX = (leftPos.x + rightPos.x) / 2;
          const midY = (leftPos.y + rightPos.y) / 2;

          setCards((prev) =>
            prev.map((c) => {
              if (c.id !== sharedId) return c;
              return {
                ...c,
                width: targetW,
                height: targetH,
                x: Math.max(10, Math.min(w - targetW, midX - targetW / 2)),
                y: Math.max(10, Math.min(h - targetH, midY - targetH / 2)),
              };
            })
          );
        }
      } else {
        twoHandScaleRef.current = null;
      }

      setHoveredCardIds({
        left: targetLeftCard ? targetLeftCard.id : null,
        right: targetRightCard ? targetRightCard.id : null,
      });

      // ==============================================================
      // DRAW BIG GLOWING CYBER HAND ON SCREEN FOR A SPECIFIC HAND
      // ==============================================================
      const drawCyberHand = (
        hand: SingleHandData,
        screenX: number,
        screenY: number,
        isGrabbing: boolean,
        isLeft: boolean,
        targetCard: MovableCard | null,
        draggedCardId: string | null
      ) => {
        const primaryColor = isGrabbing ? '#f59e0b' : isLeft ? '#fbbf24' : '#00f2fe';
        const glowColor = isGrabbing ? 'rgba(245, 158, 11, 0.9)' : isLeft ? 'rgba(251, 191, 36, 0.85)' : 'rgba(0, 242, 254, 0.85)';
        const handScale = Math.min(w, h) * 0.28;

        const screenJoints: { x: number; y: number }[] = [];

        if (hand.landmarks && hand.landmarks.length >= 21) {
          const palmCenterLmX = (hand.landmarks[0].x + hand.landmarks[9].x) / 2;
          const palmCenterLmY = (hand.landmarks[0].y + hand.landmarks[9].y) / 2;

          for (let i = 0; i < 21; i++) {
            const lm = hand.landmarks[i];
            const relX = (lm.x - palmCenterLmX) * handScale * 2.5;
            const relY = -(lm.y - palmCenterLmY) * handScale * 2.5;
            screenJoints.push({
              x: screenX + relX,
              y: screenY + relY,
            });
          }
        } else {
          // Procedural points
          screenJoints.push({ x: screenX, y: screenY + handScale * 0.4 });
          const fingerAngles = isLeft ? [-30, -15, 0, 15, 40] : [-40, -15, 0, 15, 30];
          fingerAngles.forEach((ang) => {
            const rad = (ang * Math.PI) / 180 - Math.PI / 2;
            const curl = isGrabbing ? 0.75 : 0.1;
            for (let j = 1; j <= 4; j++) {
              const segLen = (j / 4) * handScale * 0.65 * (1 - curl * 0.5);
              screenJoints.push({
                x: screenX + Math.cos(rad) * segLen,
                y: screenY + Math.sin(rad) * segLen,
              });
            }
          });
        }

        // A. Draw Glowing Laser Bones
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.strokeStyle = primaryColor;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = isGrabbing ? 26 : 16;
        ctx.lineWidth = isGrabbing ? 5.5 : 4.0;

        HAND_BONES.forEach(([s, e]) => {
          const p1 = screenJoints[s];
          const p2 = screenJoints[e];
          if (!p1 || !p2) return;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        });

        // Sharp white core
        ctx.strokeStyle = '#ffffff';
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1.6;
        HAND_BONES.forEach(([s, e]) => {
          const p1 = screenJoints[s];
          const p2 = screenJoints[e];
          if (!p1 || !p2) return;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        });
        ctx.restore();

        // B. Knuckles & Fingertips
        screenJoints.forEach((pt, idx) => {
          const isTip = [4, 8, 12, 16, 20].includes(idx);
          ctx.save();
          if (isTip) {
            const ringR = 8 + Math.sin(time * 8 + idx) * 2.5;
            ctx.strokeStyle = primaryColor;
            ctx.lineWidth = 2.2;
            ctx.shadowColor = primaryColor;
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, ringR, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = primaryColor;
            ctx.shadowColor = primaryColor;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        });

        // C. Central Palm Energy Core
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(time * 2 * (isLeft ? -1 : 1));

        const coreR = isGrabbing ? 20 : 16;
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2;
        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = isGrabbing ? 24 : 14;
        ctx.beginPath();
        ctx.arc(0, 0, coreR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-coreR - 6, 0); ctx.lineTo(-coreR + 3, 0);
        ctx.moveTo(coreR - 3, 0);  ctx.lineTo(coreR + 6, 0);
        ctx.moveTo(0, -coreR - 6); ctx.lineTo(0, -coreR + 3);
        ctx.moveTo(0, coreR - 3);  ctx.lineTo(0, coreR + 6);
        ctx.stroke();
        ctx.restore();

        // D. Grabbing electric lines to card
        if (isGrabbing && draggedCardId) {
          const card = cards.find((c) => c.id === draggedCardId);
          if (card) {
            ctx.save();
            ctx.strokeStyle = primaryColor;
            ctx.shadowColor = primaryColor;
            ctx.shadowBlur = 18;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([6, 6]);

            const corners = [
              { x: card.x, y: card.y },
              { x: card.x + card.width, y: card.y },
              { x: card.x + card.width, y: card.y + card.height },
              { x: card.x, y: card.y + card.height },
            ];
            corners.forEach((corn) => {
              ctx.beginPath();
              ctx.moveTo(screenX, screenY);
              ctx.lineTo(corn.x, corn.y);
              ctx.stroke();
            });
            ctx.restore();
          }
        }

        // E. Floating Status Badge
        const wristPt = screenJoints[0] || { x: screenX, y: screenY + 60 };
        const labelPrefix = isLeft ? '[L: CHAP QO‘L]' : '[R: O‘NG QO‘L]';
        const hudText = isGrabbing
          ? `✊ ${labelPrefix}: USHLANDI`
          : targetCard
          ? `🎯 ${labelPrefix}: ${targetCard.title.substring(0, 14)}...`
          : `🖐️ ${labelPrefix}: KAFT OCHIQ`;

        ctx.save();
        ctx.font = 'bold 11px "Courier New", monospace';
        const txtW = ctx.measureText(hudText).width;
        ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
        ctx.fillRect(wristPt.x - txtW / 2 - 10, wristPt.y + 16, txtW + 20, 22);

        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(wristPt.x - txtW / 2 - 10, wristPt.y + 16, txtW + 20, 22);

        ctx.fillStyle = primaryColor;
        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = 8;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hudText, wristPt.x, wristPt.y + 27);
        ctx.restore();
      };

      // Draw LEFT hand if detected
      if (leftHand) {
        drawCyberHand(leftHand, leftPos.x, leftPos.y, isLeftGrabbing, true, targetLeftCard, leftDragRef.current?.cardId || null);
      }

      // Draw RIGHT hand if detected
      if (rightHand) {
        drawCyberHand(rightHand, rightPos.x, rightPos.y, isRightGrabbing, false, targetRightCard, rightDragRef.current?.cardId || null);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [metrics, sensitivity, cards]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#020510] overflow-hidden select-none">
      {/* Background Deep Space Matrix Grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(#38bdf8 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />

      {/* Top Floating Cyber Navigation & Instruction Header */}
      <div className="absolute top-14 left-0 right-0 z-20 px-8 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-950/90 border border-cyan-500/40 backdrop-blur-md shadow-2xl text-xs font-cyber text-slate-200">
          <Hand size={16} className="text-cyan-400 animate-pulse" />
          <span className="font-bold text-cyan-300">
            {metrics.handCount === 2 ? 'IKKALA QO‘L FAOL ⚡' : 'MASOFAVIY QO‘L BOSHQARUVI:'}
          </span>
          <span className="text-slate-300 font-sans text-[11px] hidden md:inline">
            {metrics.handCount === 2
              ? 'Ikkala qo‘lingiz bilan bir vaqtda 2 ta elementni ushlab surishingiz yoki bitta elementni kattalashtirishingiz mumkin!'
              : 'Element ustiga boring va qo‘lingizni musht qiling (ushlang) — hohlagan joyingizga surib, kaftingizni oching!'}
          </span>
        </div>

        {/* Action Controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={handleResetLayout}
            title="Barcha elementlarni dastlabki joyiga qaytarish"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-xs font-cyber transition-all shadow-lg cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Joylashuvni Tiklash</span>
          </button>
        </div>
      </div>

      {/* Render Dynamic Movable Cards across the screen */}
      {cards.map((card) => {
        const isHovered = hoveredCardIds.left === card.id || hoveredCardIds.right === card.id;
        const isDraggedByLeft = leftDraggedId === card.id;
        const isDraggedByRight = rightDraggedId === card.id;
        const isDragged = isDraggedByLeft || isDraggedByRight;
        const isCooperativeScale = isDraggedByLeft && isDraggedByRight;

        return (
          <div
            key={card.id}
            onMouseDown={(e) => handleMouseDownCard(card.id, e)}
            style={{
              position: 'absolute',
              left: `${card.x}px`,
              top: `${card.y}px`,
              width: `${card.width}px`,
              height: `${card.height}px`,
              zIndex: card.zIndex,
            }}
            className={`rounded-2xl backdrop-blur-xl transition-shadow cursor-grab active:cursor-grabbing select-none overflow-hidden ${
              isCooperativeScale
                ? 'ring-4 ring-purple-400 shadow-[0_0_40px_rgba(168,85,247,0.7)] scale-[1.03]'
                : isDraggedByLeft
                ? 'ring-2 ring-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.6)] scale-[1.02]'
                : isDraggedByRight
                ? 'ring-2 ring-cyan-400 shadow-[0_0_35px_rgba(6,182,212,0.6)] scale-[1.02]'
                : isHovered
                ? 'ring-2 ring-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.5)]'
                : 'border border-cyan-500/30 bg-slate-950/85 shadow-2xl shadow-cyan-950/60'
            }`}
          >
            {/* Card Header Handle */}
            <div className={`px-3.5 py-2 flex items-center justify-between border-b ${
              isCooperativeScale
                ? 'bg-purple-950/80 border-purple-500/60 text-purple-200'
                : isDraggedByLeft
                ? 'bg-amber-950/70 border-amber-500/50 text-amber-200'
                : isDraggedByRight
                ? 'bg-cyan-950/70 border-cyan-500/50 text-cyan-200'
                : 'bg-slate-900/90 border-slate-800 text-slate-300'
            }`}>
              <div className="flex items-center gap-2">
                <GripHorizontal size={14} className={isDragged ? 'text-amber-400' : 'text-cyan-400'} />
                <span className="font-cyber font-bold text-xs tracking-wider">{card.title}</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-700 text-slate-400">
                {isCooperativeScale
                  ? 'IKKALA QO‘L BILAN ⚡'
                  : isDraggedByLeft
                  ? 'CHAP QO‘L ✊'
                  : isDraggedByRight
                  ? 'O‘NG QO‘L ✊'
                  : isHovered
                  ? 'MO‘LJALLANDI 🎯'
                  : 'SURISH MUMKIN 🖐️'}
              </span>
            </div>

            {/* Card Body Contents */}
            <div className="p-3.5 h-[calc(100%-38px)] overflow-y-auto font-sans text-xs">
              {/* 1. Instagram Reel Widget */}
              {card.type === 'reel' && (
                <div className="h-full flex flex-col justify-between text-slate-200">
                  <div className="relative rounded-xl overflow-hidden bg-gradient-to-b from-indigo-950 via-slate-900 to-black p-3.5 border border-cyan-500/20 flex-1 flex flex-col justify-between">
                    {/* Reel Header */}
                    <div className="flex items-center justify-between z-10">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center font-bold text-xs text-white shadow-md">
                          UZ
                        </div>
                        <div>
                          <div className="font-cyber font-bold text-xs text-white">@cybermotion_vr</div>
                          <div className="text-[10px] text-cyan-400 font-mono">Toshkent · VR Lab</div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold animate-pulse">
                        LIVE REEL
                      </span>
                    </div>

                    {/* Animated Pulsing Sound Wave Graphic */}
                    <div className="my-auto text-center py-6">
                      <div className="flex items-center justify-center gap-1.5 mb-3">
                        {[40, 75, 95, 60, 85, 45, 90, 70, 50].map((h, i) => (
                          <div
                            key={i}
                            style={{ height: `${isReelPlaying ? h * 0.45 : 8}px` }}
                            className="w-1.5 bg-gradient-to-t from-cyan-500 to-emerald-400 rounded-full transition-all duration-300"
                          />
                        ))}
                      </div>
                      <p className="text-xs text-slate-200 font-medium px-2 leading-relaxed">
                        Instagram reelidagi kabi qo‘lingiz bilan havoda teginish va elementlarni ushlash! 📱⚡
                      </p>
                    </div>

                    {/* Reel Footer & Social Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsReelLiked(!isReelLiked);
                            setReelLikesCount((c) => (isReelLiked ? c - 1 : c + 1));
                            spatialAudio.playShockwaveBurst();
                          }}
                          className={`flex items-center gap-1 text-xs font-bold transition-transform cursor-pointer ${
                            isReelLiked ? 'text-rose-400 scale-110' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Heart size={16} fill={isReelLiked ? 'currentColor' : 'none'} />
                          <span>{(reelLikesCount / 1000).toFixed(1)}k</span>
                        </button>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            spatialAudio.playThemeSwitch();
                          }}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                        >
                          <Share2 size={15} />
                          <span>14.2k</span>
                        </button>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsReelPlaying(!isReelPlaying);
                          spatialAudio.playRemoteClick();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-cyan-600/30 border border-cyan-400/40 text-cyan-300 text-xs font-cyber hover:bg-cyan-600/40 cursor-pointer"
                      >
                        {isReelPlaying ? 'Pauza' : 'Ijro'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Black Hole Space Observation Widget */}
              {card.type === 'black-hole' && (
                <div className="h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono text-purple-300">GARGANTUA SENSORI</span>
                    <span className="text-[10px] font-mono text-slate-400">MASOFA: 10 Mrd KM</span>
                  </div>
                  <div className="flex-1 rounded-xl bg-black border border-purple-500/30 p-3 flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="w-20 h-20 rounded-full border-2 border-purple-500/80 shadow-[0_0_30px_#a855f7] flex items-center justify-center animate-spin duration-1000">
                      <div className="w-12 h-12 rounded-full bg-black border border-amber-400 shadow-[0_0_15px_#f59e0b]" />
                    </div>
                    <span className="text-[10px] font-mono text-purple-200 mt-2">
                      Gravitatsion Fazo Buzilishi: 99.8%
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2 text-[10px] font-mono text-slate-400">
                    <span>Akkretsiya Diski: 12,000K</span>
                    <span className="text-emerald-400">STABIL</span>
                  </div>
                </div>
              )}

              {/* 3. Cyber Music Player Widget */}
              {card.type === 'music-player' && (
                <div className="h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Music size={15} className="text-cyan-400 animate-pulse" />
                      <div>
                        <div className="font-cyber font-bold text-xs text-white">Interstellar Synthwave 8D</div>
                        <div className="text-[10px] text-slate-400 font-mono">Hans Zimmer Re-Synthesis</div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMusicMuted(!musicMuted);
                      }}
                      className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
                    >
                      {musicMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    </button>
                  </div>

                  {/* Animated Waveform Bars */}
                  <div className="flex items-end justify-center gap-1 h-16 py-1 my-1">
                    {[20, 50, 75, 90, 65, 80, 45, 95, 70, 85, 40, 60, 90, 75, 55, 30].map((h, i) => (
                      <div
                        key={i}
                        style={{ height: `${isPlayingMusic ? h * 0.55 : 4}px` }}
                        className="w-1 bg-gradient-to-t from-cyan-500 to-fuchsia-500 rounded-full transition-all duration-200"
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono text-slate-400">02:45 / 04:12</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsPlayingMusic(!isPlayingMusic);
                        spatialAudio.playThemeSwitch();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/40 border border-cyan-400/40 text-cyan-200 text-xs font-cyber cursor-pointer"
                    >
                      {isPlayingMusic ? <Pause size={12} /> : <Play size={12} />}
                      <span>{isPlayingMusic ? 'Pauza' : 'Ijro'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 4. Telemetry Card */}
              {card.type === 'telemetry' && (
                <div className="h-full flex flex-col justify-between font-mono text-[11px]">
                  <div className="space-y-1.5">
                    <div className="flex justify-between border-b border-slate-800 pb-1">
                      <span className="text-slate-400">Qo‘llar soni:</span>
                      <span className="text-cyan-400 font-bold">{metrics.handCount} ta</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-1">
                      <span className="text-slate-400">Chap Qo‘l:</span>
                      <span className={metrics.leftHand?.isDetected ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                        {metrics.leftHand?.gesture === 'FIST' ? 'MUSHT (USHLANGAN) ✊' : metrics.leftHand?.isDetected ? 'FAOL 🖐️' : 'YO‘Q'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-1">
                      <span className="text-slate-400">O‘ng Qo‘l:</span>
                      <span className={metrics.rightHand?.isDetected ? 'text-cyan-400 font-bold' : 'text-slate-500'}>
                        {metrics.rightHand?.gesture === 'FIST' ? 'MUSHT (USHLANGAN) ✊' : metrics.rightHand?.isDetected ? 'FAOL 🖐️' : 'YO‘Q'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-1">
                      <span className="text-slate-400">FPS / Latency:</span>
                      <span className="text-emerald-400 font-bold">{metrics.fps} FPS · {metrics.latencyMs}ms</span>
                    </div>
                  </div>
                  <div className="p-2 rounded bg-cyan-950/40 border border-cyan-500/20 text-[10px] text-cyan-300 text-center font-cyber">
                    IKKI QO‘LLI OPTIK MATRITSA
                  </div>
                </div>
              )}

              {/* 5. Mission Notes Widget */}
              {card.type === 'notes' && (
                <div className="h-full flex flex-col justify-between text-slate-300 text-xs">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-cyan-400 font-bold font-cyber text-[11px]">
                      <Sparkles size={12} />
                      <span>Qo‘llanma & Qoidalar:</span>
                    </div>
                    <ul className="space-y-1.5 text-[11px] leading-relaxed text-slate-300">
                      <li>• <b>Bitta qo‘l:</b> Musht qilib ushlang va hohlagan joyga suring.</li>
                      <li>• <b>Ikkala qo‘l:</b> Bir vaqtda 2 ta elementni alohida ko‘chiring!</li>
                      <li>• <b>Kattalashtirish:</b> Ikkala qo‘l bilan 1 ta elementni ushlab, orani oching.</li>
                    </ul>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono text-center pt-2 border-t border-slate-800">
                    AetherMotion Dual-Hand VR v3.5
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Sparks Feedback Overlay */}
      {sparks.map((s) => (
        <div
          key={s.id}
          style={{ left: `${s.x}px`, top: `${s.y}px`, borderColor: s.color }}
          className="absolute -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full border-2 shadow-[0_0_25px_#f59e0b] pointer-events-none animate-ping"
        />
      ))}

      {/* Topmost Interactive Full-Screen Canvas Overlay for BOTH BIG DRAWN HANDS */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none select-none z-50"
      />
    </div>
  );
};
