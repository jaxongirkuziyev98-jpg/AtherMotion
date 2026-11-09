import React, { useEffect, useRef, useState, useCallback } from 'react';
import { DualHandMetrics, SingleHandData } from '../types/tracking';
import { spatialAudio } from '../utils/audio';
import { 
  PenTool, 
  Trash2, 
  Download, 
  Undo2, 
  Sparkles, 
  Hand,
  CheckCircle2,
  Users2,
  Layers,
  Eraser
} from 'lucide-react';

interface AirCanvasProps {
  metrics: DualHandMetrics;
  sensitivity: number;
}

interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

interface Stroke {
  id: string;
  points: StrokePoint[];
  color: string;
  size: number;
  isGlow: boolean;
  hand: 'Left' | 'Right' | 'Mouse';
}

const COLOR_PALETTE = [
  { name: 'Neon Sian', hex: '#22d3ee' },
  { name: 'Oltin Olov', hex: '#fbbf24' },
  { name: 'Plazma Yashil', hex: '#34d399' },
  { name: 'Ametist Binafsha', hex: '#c084fc' },
  { name: 'Qirmizi Qizil', hex: '#f87171' },
  { name: 'Oq Foton', hex: '#ffffff' },
];

export const AirCanvas: React.FC<AirCanvasProps> = ({ metrics, sensitivity }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Separate colors & sizes for Left Hand vs Right Hand
  const [rightColor, setRightColor] = useState('#22d3ee'); // Cyan default
  const [leftColor, setLeftColor] = useState('#fbbf24');  // Gold default
  const [brushSize, setBrushSize] = useState(6);
  const [isGlowMode, setIsGlowMode] = useState(true);
  const [isDualHandMode, setIsDualHandMode] = useState(true);
  const [strokes, setStrokes] = useState<Stroke[]>([]);

  // Active in-progress strokes for Left and Right hands
  const rightStrokeRef = useRef<StrokePoint[]>([]);
  const leftStrokeRef = useRef<StrokePoint[]>([]);
  const isRightDrawingRef = useRef(false);
  const isLeftDrawingRef = useRef(false);

  // High-speed smoothed pointer positions
  const rightPointerRef = useRef({ x: 0, y: 0, isActive: false, isDrawing: false });
  const leftPointerRef = useRef({ x: 0, y: 0, isActive: false, isDrawing: false });
  const [pointerDisplay, setPointerDisplay] = useState({
    right: { x: 0, y: 0, active: false, isDrawing: false },
    left: { x: 0, y: 0, active: false, isDrawing: false },
  });

  // Mouse fallback
  const isMouseDownRef = useRef(false);
  const mouseStrokeRef = useRef<StrokePoint[]>([]);

  // Render all strokes
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Deep pitch-black cosmos canvas ("qora fon bolsin")
    ctx.fillStyle = '#02040a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle matrix coordinates grid
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)';
    ctx.lineWidth = 1;
    const gridSize = 45;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    const drawPoints = (points: StrokePoint[], color: string, size: number, glow: boolean) => {
      if (points.length < 2) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = size;

      if (glow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = size * 2.4;
      }

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        const midX = (points[i - 1].x + points[i].x) / 2;
        const midY = (points[i - 1].y + points[i].y) / 2;
        ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, midX, midY);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.stroke();
      ctx.restore();
    };

    // Draw completed strokes
    strokes.forEach((st) => {
      drawPoints(st.points, st.color, st.size, st.isGlow);
    });

    // Draw active Right hand stroke in progress
    if (rightStrokeRef.current.length > 1) {
      drawPoints(rightStrokeRef.current, rightColor, brushSize, isGlowMode);
    }

    // Draw active Left hand stroke in progress
    if (leftStrokeRef.current.length > 1) {
      drawPoints(leftStrokeRef.current, leftColor, brushSize, isGlowMode);
    }

    // Draw mouse stroke
    if (mouseStrokeRef.current.length > 1) {
      drawPoints(mouseStrokeRef.current, rightColor, brushSize, isGlowMode);
    }
  }, [strokes, rightColor, leftColor, brushSize, isGlowMode]);

  // Window resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      redrawCanvas();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [redrawCanvas]);

  // High-Speed Dual-Hand Air Drawing Tracking ("ikta qo'l bn ham yozsa va chizsa bo'ladigan bo'lsin")
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Helper for processing one hand at ultra-fast zero-lag responsiveness
    const processHandDrawing = (
      hand: SingleHandData | null,
      strokeRef: React.MutableRefObject<StrokePoint[]>,
      isDrawingRef: React.MutableRefObject<boolean>,
      pointerRef: React.MutableRefObject<{ x: number; y: number; isActive: boolean; isDrawing: boolean }>,
      color: string,
      handType: 'Left' | 'Right'
    ) => {
      if (!hand || !hand.isDetected) {
        if (isDrawingRef.current) {
          isDrawingRef.current = false;
          if (strokeRef.current.length > 0) {
            setStrokes((prev) => [
              ...prev,
              {
                id: `${handType}-${Date.now()}`,
                points: [...strokeRef.current],
                color,
                size: brushSize,
                isGlow: isGlowMode,
                hand: handType,
              },
            ]);
            strokeRef.current = [];
            redrawCanvas();
          }
        }
        pointerRef.current.isActive = false;
        return { x: 0, y: 0, active: false, isDrawing: false };
      }

      // Convert hand coordinates [-1..1] to canvas screen pixels with fast sensitivity response
      const sens = Math.max(0.8, sensitivity);
      const normX = (hand.position.x / (1.8 * sens) + 1) / 2;
      const normY = (-hand.position.y / (1.5 * sens) + 1) / 2;

      const targetX = Math.max(0, Math.min(canvas.width, normX * canvas.width));
      const targetY = Math.max(0, Math.min(canvas.height, normY * canvas.height));

      // Ultra-responsive smoothing filter (0.75 for lightning fast tracking, no rubber-banding lag)
      const prev = pointerRef.current;
      const smoothX = prev.isActive ? prev.x + (targetX - prev.x) * 0.78 : targetX;
      const smoothY = prev.isActive ? prev.y + (targetY - prev.y) * 0.78 : targetY;

      // Drawing triggers: Pinch (chimchilash) OR Pointing (barmog'i bilan chizish) OR index finger low bend
      const isPinching = hand.isPinching;
      const isPointing = hand.gesture === 'POINTING' || (hand.fingerBends[1] < 0.45 && hand.fingerBends[2] > 0.45);
      const shouldDraw = isPinching || isPointing;

      pointerRef.current = { x: smoothX, y: smoothY, isActive: true, isDrawing: shouldDraw };

      if (shouldDraw) {
        if (!isDrawingRef.current) {
          isDrawingRef.current = true;
          strokeRef.current = [{ x: smoothX, y: smoothY, pressure: 1.0 }];
          spatialAudio.playPenStroke();
        } else {
          const lastPt = strokeRef.current[strokeRef.current.length - 1];
          if (!lastPt || Math.hypot(smoothX - lastPt.x, smoothY - lastPt.y) > 2.5) {
            strokeRef.current.push({ x: smoothX, y: smoothY, pressure: 1.0 });
            if (strokeRef.current.length % 5 === 0) {
              spatialAudio.playPenStroke();
            }
          }
        }
        redrawCanvas();
      } else {
        if (isDrawingRef.current) {
          isDrawingRef.current = false;
          if (strokeRef.current.length > 0) {
            setStrokes((prev) => [
              ...prev,
              {
                id: `${handType}-${Date.now()}`,
                points: [...strokeRef.current],
                color,
                size: brushSize,
                isGlow: isGlowMode,
                hand: handType,
              },
            ]);
            strokeRef.current = [];
            redrawCanvas();
          }
        }
      }

      return { x: smoothX, y: smoothY, active: true, isDrawing: shouldDraw };
    };

    const rightDisp = processHandDrawing(
      metrics.rightHand,
      rightStrokeRef,
      isRightDrawingRef,
      rightPointerRef,
      rightColor,
      'Right'
    );

    const leftDisp = processHandDrawing(
      metrics.leftHand,
      leftStrokeRef,
      isLeftDrawingRef,
      leftPointerRef,
      leftColor,
      'Left'
    );

    setPointerDisplay({
      right: rightDisp,
      left: leftDisp,
    });
  }, [metrics, sensitivity, rightColor, leftColor, brushSize, isGlowMode, redrawCanvas]);

  // Mouse fallback handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    isMouseDownRef.current = true;
    mouseStrokeRef.current = [{ x, y, pressure: 1.0 }];
    spatialAudio.playPenStroke();
    redrawCanvas();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMouseDownRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mouseStrokeRef.current.push({ x, y, pressure: 1.0 });
    redrawCanvas();
  };

  const handleMouseUp = () => {
    if (!isMouseDownRef.current) return;
    isMouseDownRef.current = false;
    if (mouseStrokeRef.current.length > 0) {
      setStrokes((prev) => [
        ...prev,
        {
          id: `mouse-${Date.now()}`,
          points: [...mouseStrokeRef.current],
          color: rightColor,
          size: brushSize,
          isGlow: isGlowMode,
          hand: 'Mouse',
        },
      ]);
      mouseStrokeRef.current = [];
      redrawCanvas();
    }
  };

  const handleClear = () => {
    setStrokes([]);
    rightStrokeRef.current = [];
    leftStrokeRef.current = [];
    mouseStrokeRef.current = [];
    spatialAudio.playPaperClear();
    redrawCanvas();
  };

  const handleUndo = () => {
    setStrokes((prev) => prev.slice(0, prev.length - 1));
    spatialAudio.playThemeSwitch();
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    spatialAudio.playSnapshot();
    const link = document.createElement('a');
    link.download = `AetherMotion-AirDrawing-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#02040a] overflow-hidden select-none">
      {/* Black Cosmos Drawing Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full h-full block cursor-crosshair"
      />

      {/* Right Hand Pointer Reticle */}
      {pointerDisplay.right.active && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 z-20"
          style={{
            left: `${pointerDisplay.right.x}px`,
            top: `${pointerDisplay.right.y}px`,
          }}
        >
          <div
            className={`w-11 h-11 rounded-full border-2 border-dashed transition-all flex items-center justify-center ${
              pointerDisplay.right.isDrawing
                ? 'border-cyan-400 scale-125 bg-cyan-400/25 shadow-[0_0_25px_rgba(34,211,238,0.9)]'
                : 'border-cyan-400/60 scale-100 bg-cyan-500/10'
            }`}
          >
            <div
              className="w-3.5 h-3.5 rounded-full shadow-lg"
              style={{
                backgroundColor: rightColor,
                boxShadow: `0 0 14px ${rightColor}`,
              }}
            />
          </div>

          <span
            className={`absolute top-12 left-1/2 -translate-x-1/2 text-[9px] font-mono px-2 py-0.5 rounded whitespace-nowrap font-bold ${
              pointerDisplay.right.isDrawing
                ? 'bg-cyan-400 text-black shadow-lg shadow-cyan-400/50'
                : 'bg-black/80 text-cyan-300 border border-cyan-500/40'
            }`}
          >
            {pointerDisplay.right.isDrawing ? '✍️ O‘NG QO‘L: CHIZILMOQDA' : '☝️ O‘NG QALAM (CHIMCHILANG / BARMOG‘INGIZ)'}
          </span>
        </div>
      )}

      {/* Left Hand Pointer Reticle */}
      {pointerDisplay.left.active && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 z-20"
          style={{
            left: `${pointerDisplay.left.x}px`,
            top: `${pointerDisplay.left.y}px`,
          }}
        >
          <div
            className={`w-11 h-11 rounded-full border-2 border-dashed transition-all flex items-center justify-center ${
              pointerDisplay.left.isDrawing
                ? 'border-amber-400 scale-125 bg-amber-400/25 shadow-[0_0_25px_rgba(251,191,36,0.9)]'
                : 'border-amber-400/60 scale-100 bg-amber-500/10'
            }`}
          >
            <div
              className="w-3.5 h-3.5 rounded-full shadow-lg"
              style={{
                backgroundColor: leftColor,
                boxShadow: `0 0 14px ${leftColor}`,
              }}
            />
          </div>

          <span
            className={`absolute top-12 left-1/2 -translate-x-1/2 text-[9px] font-mono px-2 py-0.5 rounded whitespace-nowrap font-bold ${
              pointerDisplay.left.isDrawing
                ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/50'
                : 'bg-black/80 text-amber-300 border border-amber-500/40'
            }`}
          >
            {pointerDisplay.left.isDrawing ? '✍️ CHAP QO‘L: CHIZILMOQDA' : '☝️ CHAP QALAM (CHIMCHILANG / BARMOG‘INGIZ)'}
          </span>
        </div>
      )}

      {/* Top Floating Instruction Badge */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center">
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-slate-900/90 border border-cyan-500/35 backdrop-blur-md shadow-2xl text-xs font-mono text-slate-200">
          <Users2 size={15} className="text-cyan-400 animate-pulse" />
          <span>
            <b>IKKITA QO‘L BILAN BIR VAQTDA CHIZISH:</b> O‘ng qo‘l (Moviy) · Chap qo‘l (Oltin rang)
          </span>
        </div>
      </div>

      {/* Air-Canvas Dual-Hand Floating Toolbar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center justify-center gap-3 p-3 rounded-2xl bg-slate-900/95 border border-cyan-500/40 backdrop-blur-xl shadow-2xl shadow-cyan-950/80 text-slate-200 max-w-[min(980px,96vw)]">
        {/* Right Hand Color Swatches */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-cyan-500/30">
          <span className="text-[10px] font-cyber font-bold text-cyan-300 px-1">O‘NG:</span>
          {COLOR_PALETTE.map((c) => (
            <button
              key={`right-${c.hex}`}
              onClick={() => {
                setRightColor(c.hex);
                spatialAudio.playThemeSwitch();
              }}
              title={`O‘ng qo‘l rangi: ${c.name}`}
              className={`w-6 h-6 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                rightColor === c.hex ? 'scale-115 ring-2 ring-cyan-300 shadow-md' : 'hover:scale-105 opacity-80'
              }`}
              style={{ backgroundColor: c.hex }}
            >
              {rightColor === c.hex && <CheckCircle2 size={12} className="text-black" />}
            </button>
          ))}
        </div>

        {/* Left Hand Color Swatches */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-amber-500/30">
          <span className="text-[10px] font-cyber font-bold text-amber-300 px-1">CHAP:</span>
          {COLOR_PALETTE.map((c) => (
            <button
              key={`left-${c.hex}`}
              onClick={() => {
                setLeftColor(c.hex);
                spatialAudio.playThemeSwitch();
              }}
              title={`Chap qo‘l rangi: ${c.name}`}
              className={`w-6 h-6 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                leftColor === c.hex ? 'scale-115 ring-2 ring-amber-300 shadow-md' : 'hover:scale-105 opacity-80'
              }`}
              style={{ backgroundColor: c.hex }}
            >
              {leftColor === c.hex && <CheckCircle2 size={12} className="text-black" />}
            </button>
          ))}
        </div>

        {/* Brush Size Selector */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono">
          <span className="text-slate-400 text-[11px]">Qalinlik:</span>
          {[4, 8, 14, 22].map((sz) => (
            <button
              key={sz}
              onClick={() => {
                setBrushSize(sz);
                spatialAudio.playThemeSwitch();
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                brushSize === sz
                  ? 'bg-cyan-500 text-black'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {sz}
            </button>
          ))}
        </div>

        {/* Neon Glow Toggle */}
        <button
          onClick={() => setIsGlowMode(!isGlowMode)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-cyber font-bold transition-all cursor-pointer ${
            isGlowMode
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
              : 'bg-slate-950/80 text-slate-400 border-slate-800'
          }`}
        >
          <Sparkles size={13} className={isGlowMode ? 'text-cyan-400' : 'text-slate-500'} />
          <span className="text-[11px]">NEON</span>
        </button>

        {/* Action Buttons: Undo, Clear, Save */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleUndo}
            disabled={strokes.length === 0}
            title="Oxirgi chiziqni bekor qilish"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 disabled:opacity-40 text-slate-300 text-xs font-cyber transition-all cursor-pointer"
          >
            <Undo2 size={13} />
            <span className="hidden sm:inline">Bekor</span>
          </button>

          <button
            onClick={handleClear}
            disabled={strokes.length === 0}
            title="Ekranni tozalash"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-950/40 border border-rose-500/40 hover:bg-rose-900/60 disabled:opacity-40 text-rose-300 text-xs font-cyber transition-all cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Tozalash</span>
          </button>

          <button
            onClick={handleDownload}
            disabled={strokes.length === 0}
            title="Rasmni yuklab olish"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-40 text-white font-cyber text-xs font-bold shadow-lg shadow-emerald-900/50 transition-all cursor-pointer"
          >
            <Download size={13} />
            <span>Saqlash</span>
          </button>
        </div>
      </div>
    </div>
  );
};
