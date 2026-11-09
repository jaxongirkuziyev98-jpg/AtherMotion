import React, { useEffect, useRef, useState, useCallback } from 'react';
import { HandTrackingManager, CameraDeviceInfo } from './services/handTracking';
import { DualHandMetrics, SceneEnvironment, SpatialObjectType, ParticleColorTheme } from './types/tracking';
import { SpatialScene } from './components/SpatialScene';
import { CameraStreamCard } from './components/CameraStreamCard';
import { TelemetryPanel } from './components/TelemetryPanel';
import { ControlDock } from './components/ControlDock';
import { GestureGuideModal } from './components/GestureGuideModal';
import { CameraPermissionModal } from './components/CameraPermissionModal';
import { CosmicAtlasModal } from './components/CosmicAtlasModal';
import { AirCanvas } from './components/AirCanvas';
import { RemoteTouchControl } from './components/RemoteTouchControl';
import { spatialAudio } from './utils/audio';
import { Sparkles, Zap, Camera, ShieldCheck, Eye, Telescope, PenTool, Smartphone, Orbit } from 'lucide-react';

export type AppPageId = 'spatial-3d' | 'air-canvas' | 'remote-control';

const initialMetrics: DualHandMetrics = {
  isDetected: false,
  handCount: 0,
  leftHand: null,
  rightHand: null,
  handDistance: 2.0,
  isFused: false,
  isHeartGesture: false,
  fps: 60,
  latencyMs: 12,
};

export default function App() {
  const [activePage, setActivePage] = useState<AppPageId>('spatial-3d');
  const [metrics, setMetrics] = useState<DualHandMetrics>(initialMetrics);
  const [selectedObject, setSelectedObject] = useState<SpatialObjectType>('dual-hands');
  const [environment, setEnvironment] = useState<SceneEnvironment>('deep-cosmos');
  const [particleTheme, setParticleTheme] = useState<ParticleColorTheme>('quantum-cyan');
  const [shockwaveTriggerCount, setShockwaveTriggerCount] = useState<number>(0);
  const [snapshotBanner, setSnapshotBanner] = useState<string | null>(null);
  const [isVRMode, setIsVRMode] = useState<boolean>(false);
  const [sensitivity, setSensitivity] = useState<number>(1.25);
  const [smoothing, setSmoothing] = useState<number>(0.35);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isCosmicAtlasOpen, setIsCosmicAtlasOpen] = useState<boolean>(false);

  // Hand models visibility toggles
  const [showSkeleton, setShowSkeleton] = useState<boolean>(true);
  const [showCyberHand, setShowCyberHand] = useState<boolean>(true);

  // Camera & permissions state
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isSimulation, setIsSimulation] = useState<boolean>(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<CameraDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackingManagerRef = useRef<HandTrackingManager | null>(null);

  // Initialize tracking manager
  useEffect(() => {
    const manager = new HandTrackingManager();
    trackingManagerRef.current = manager;

    manager.setOnMetricsUpdate((newMetrics) => {
      setMetrics(newMetrics);
    });

    manager.setOnError((err) => {
      setErrorMessage(err);
      setIsCameraActive(false);
    });

    manager.getAvailableCameras().then((cams) => {
      setAvailableCameras(cams);
      if (cams.length > 0) {
        setSelectedCameraId(cams[0].deviceId);
      }
    });

    return () => {
      manager.destroy();
    };
  }, []);

  // Update smoothing in manager
  useEffect(() => {
    if (trackingManagerRef.current) {
      trackingManagerRef.current.setSmoothing(smoothing);
    }
  }, [smoothing]);

  // Audio Mute toggle
  const handleToggleMute = useCallback(() => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    spatialAudio.setMuted(nextMute);
  }, [isMuted]);

  // Activate Camera with user gesture
  const handleActivateCamera = async (deviceId?: string) => {
    const manager = trackingManagerRef.current;
    if (!manager || !videoRef.current || !canvasRef.current) return;

    setErrorMessage(null);
    const result = await manager.startCamera(videoRef.current, canvasRef.current, deviceId || selectedCameraId);

    if (result.success) {
      setIsCameraActive(true);
      setIsSimulation(false);
      setIsPermissionModalOpen(false);
      const cams = await manager.getAvailableCameras();
      setAvailableCameras(cams);
    } else {
      setIsCameraActive(false);
      setErrorMessage(result.error || 'Kameraga ulanib bo‘lmadi.');
      setIsPermissionModalOpen(true);
    }
  };

  // Toggle Camera
  const handleToggleCamera = () => {
    if (isCameraActive) {
      trackingManagerRef.current?.stopCamera();
      setIsCameraActive(false);
    } else {
      handleActivateCamera();
    }
  };

  // Toggle Simulation
  const handleToggleSimulation = () => {
    const manager = trackingManagerRef.current;
    if (!manager) return;

    if (isSimulation) {
      manager.stopSimulation();
      setIsSimulation(false);
      handleActivateCamera();
    } else {
      manager.startSimulation();
      setIsSimulation(true);
      setIsCameraActive(false);
      setErrorMessage(null);
      setIsPermissionModalOpen(false);
    }
  };

  const handleSelectCamera = (devId: string) => {
    setSelectedCameraId(devId);
    handleActivateCamera(devId);
  };

  const handleSelectParticleTheme = (theme: ParticleColorTheme) => {
    setParticleTheme(theme);
    spatialAudio.playThemeSwitch();
  };

  const handleTriggerShockwave = () => {
    setShockwaveTriggerCount((prev) => prev + 1);
  };

  const handleTakeSnapshot = () => {
    const captureFn = (window as unknown as { __captureSpatialSceneSnapshot?: () => string }).__captureSpatialSceneSnapshot;
    if (captureFn) {
      const dataUrl = captureFn();
      if (dataUrl) {
        spatialAudio.playSnapshot();
        const link = document.createElement('a');
        link.download = `AetherMotion-VR-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        setSnapshotBanner('Fotosurat muvaffaqiyatli saqlandi!');
        setTimeout(() => setSnapshotBanner(null), 3000);
      }
    }
  };

  return (
    <div className="relative w-screen h-screen bg-slate-950 overflow-hidden font-sans">
      {/* Page 1: 3D VR Spatial & Universe Viewport */}
      {activePage === 'spatial-3d' && (
        <div className="absolute inset-0 w-full h-full">
          <SpatialScene
            metrics={metrics}
            selectedObject={selectedObject}
            environment={environment}
            particleTheme={particleTheme}
            isVRMode={isVRMode}
            sensitivity={sensitivity}
            shockwaveTriggerCount={shockwaveTriggerCount}
            showCyberHand={showCyberHand}
          />
        </div>
      )}

      {/* Page 2: Air-Canvas (Qora fonda havoda yozish va chizish) */}
      {activePage === 'air-canvas' && (
        <div className="absolute inset-0 w-full h-full">
          <AirCanvas metrics={metrics} sensitivity={sensitivity} />
        </div>
      )}

      {/* Page 3: Remote Touch Control (Kotta qo‘l chiqib elementlarni ushlab hohlagan joyga ko‘chirish) */}
      {activePage === 'remote-control' && (
        <div className="absolute inset-0 w-full h-full">
          <RemoteTouchControl metrics={metrics} sensitivity={sensitivity} />
        </div>
      )}

      {/* Futuristic Sci-Fi HUD Header - Unboxed, Zero-Pill Design Discipline with 3-Page Navigation */}
      <header className="absolute top-0 left-0 right-0 z-30 px-6 py-2.5 flex items-center justify-between border-b border-cyan-500/20 bg-gradient-to-b from-slate-950/95 via-slate-950/80 to-transparent backdrop-blur-md">
        {/* Left HUD Telemetry info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                metrics.isFused
                  ? 'bg-cyan-400 shadow-[0_0_8px_#38bdf8]'
                  : metrics.handDistance > 0.65
                  ? 'bg-purple-400 shadow-[0_0_8px_#c084fc]'
                  : metrics.handCount === 2
                  ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                  : isCameraActive
                  ? 'bg-cyan-400 animate-pulse'
                  : 'bg-amber-400'
              }`}
            />
            <span className="font-cyber font-black tracking-widest text-sm text-white">
              AETHER<span className="text-cyan-400">MOTION</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
              VR HUD v3.0
            </span>
          </div>

          <span className="text-slate-700 hidden lg:inline">/</span>

          <span className="text-[11px] font-mono text-slate-400 hidden lg:inline tracking-wider">
            OPTIC SENSOR MATRIX · 60FPS
          </span>
        </div>

        {/* Center: 3-Page Master Navigation Tabs */}
        <nav className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-cyan-500/30 shadow-lg shadow-cyan-950/40">
          <button
            onClick={() => {
              setActivePage('spatial-3d');
              spatialAudio.playThemeSwitch();
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-cyber tracking-wider transition-all cursor-pointer ${
              activePage === 'spatial-3d'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.5)] border border-cyan-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Orbit size={14} className={activePage === 'spatial-3d' ? 'text-white' : 'text-cyan-400'} />
            <span className="font-semibold">1. 3D Fazo & Zarracha</span>
          </button>

          <button
            onClick={() => {
              setActivePage('air-canvas');
              spatialAudio.playThemeSwitch();
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-cyber tracking-wider transition-all cursor-pointer ${
              activePage === 'air-canvas'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.5)] border border-cyan-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <PenTool size={14} className={activePage === 'air-canvas' ? 'text-white' : 'text-emerald-400'} />
            <span className="font-semibold">2. Havoda Chizish & Yozish</span>
          </button>

          <button
            onClick={() => {
              setActivePage('remote-control');
              spatialAudio.playThemeSwitch();
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-cyber tracking-wider transition-all cursor-pointer ${
              activePage === 'remote-control'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.5)] border border-cyan-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Smartphone size={14} className={activePage === 'remote-control' ? 'text-white' : 'text-purple-400'} />
            <span className="font-semibold">3. Masofaviy Boshqaruv</span>
          </button>
        </nav>

        {/* Right telemetry readout */}
        <div className="hidden lg:flex items-center gap-4 text-[11px] font-mono text-slate-400">
          <div>
            PEJ: <span className="text-cyan-400 font-bold">{activePage.toUpperCase()}</span>
          </div>
          <div>
            FPS: <span className="text-emerald-400 font-bold">{metrics.fps}</span>
          </div>
          <div>
            LAT: <span className="text-slate-300">{metrics.latencyMs}ms</span>
          </div>
        </div>
      </header>

      {/* Snapshot Confirmation Toast */}
      {snapshotBanner && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-emerald-950/90 border border-emerald-400 text-emerald-200 px-4 py-2 rounded-xl text-xs font-cyber shadow-2xl shadow-emerald-950/80 animate-in fade-in duration-200 flex items-center gap-2">
          <Camera size={14} className="text-emerald-400" />
          <span>{snapshotBanner}</span>
        </div>
      )}

      {/* Top Left: Live Camera Stream with Dual-Hand Skeleton */}
      <CameraStreamCard
        metrics={metrics}
        videoRef={videoRef}
        canvasRef={canvasRef}
        isCameraActive={isCameraActive}
        isSimulation={isSimulation}
        errorMessage={errorMessage}
        availableCameras={availableCameras}
        selectedCameraId={selectedCameraId}
        onSelectCamera={handleSelectCamera}
        onToggleCamera={handleToggleCamera}
        onToggleSimulation={handleToggleSimulation}
        onClearError={() => setErrorMessage(null)}
      />

      {/* Top Right: Sensor Telemetry Panel */}
      <TelemetryPanel metrics={metrics} />

      {/* Bottom Control Dock - Active on Page 1 (Spatial 3D & Universe) */}
      {activePage === 'spatial-3d' && (
        <ControlDock
          selectedObject={selectedObject}
          onSelectObject={setSelectedObject}
          environment={environment}
          onSelectEnvironment={setEnvironment}
          particleTheme={particleTheme}
          onSelectParticleTheme={handleSelectParticleTheme}
          onTriggerShockwave={handleTriggerShockwave}
          onTakeSnapshot={handleTakeSnapshot}
          isVRMode={isVRMode}
          onToggleVRMode={() => setIsVRMode(!isVRMode)}
          sensitivity={sensitivity}
          onChangeSensitivity={setSensitivity}
          smoothing={smoothing}
          onChangeSmoothing={setSmoothing}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onOpenHelp={() => setIsHelpOpen(true)}
          onOpenCosmicAtlas={() => setIsCosmicAtlasOpen(true)}
          showSkeleton={showSkeleton}
          onToggleSkeleton={() => setShowSkeleton(!showSkeleton)}
          showCyberHand={showCyberHand}
          onToggleCyberHand={() => setShowCyberHand(!showCyberHand)}
        />
      )}

      {/* Cosmic Atlas Explorer Modal ("Koinot Atlasi") */}
      <CosmicAtlasModal
        isOpen={isCosmicAtlasOpen}
        onClose={() => setIsCosmicAtlasOpen(false)}
        onSelectObject={(obj) => setSelectedObject(obj)}
      />

      {/* Gesture Guide Modal */}
      <GestureGuideModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Camera Activation / Permission Modal */}
      <CameraPermissionModal
        isOpen={isPermissionModalOpen && !isCameraActive}
        errorMessage={errorMessage}
        onActivateCamera={() => handleActivateCamera()}
        onUseSimulation={() => {
          setIsPermissionModalOpen(false);
          handleToggleSimulation();
        }}
      />
    </div>
  );
}
