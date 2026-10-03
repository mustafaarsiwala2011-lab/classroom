import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, ZoomIn, ZoomOut, RotateCw, RotateCcw, RefreshCw, 
  Download, Play, Pause, Volume2, Move, FileText
} from 'lucide-react';

interface MediaZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'audio' | 'document' | string;
  mediaName?: string;
}

export default function MediaZoomModal({ 
  isOpen, 
  onClose, 
  mediaUrl, 
  mediaType, 
  mediaName = 'attachment' 
}: MediaZoomModalProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Reset controls on media change or close/open
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setIsPlaying(false);
    }
  }, [isOpen, mediaUrl]);

  if (!isOpen) return null;

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const handleRotateCw = () => setRotation(prev => (prev + 90) % 360);
  const handleRotateCcw = () => setRotation(prev => (prev - 90 + 360) % 360);
  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = mediaUrl;
    link.download = mediaName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  // Determine if it's an image, video, audio, or document (like pdf/text)
  const isImage = mediaType === 'image' || mediaUrl.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(mediaUrl);
  const isVideo = mediaType === 'video' || mediaUrl.startsWith('data:video/') || /\.(mp4|webm|ogg|mov)$/i.test(mediaUrl);
  const isAudio = mediaType === 'audio' || mediaUrl.startsWith('data:audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(mediaUrl);
  const isDoc = mediaType === 'document' || mediaUrl.startsWith('data:application/pdf') || mediaUrl.startsWith('data:text/') || /\.(pdf|txt|doc|docx)$/i.test(mediaUrl);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-hidden">
        {/* Backdrop overlay trigger close */}
        <div className="absolute inset-0 cursor-zoom-out" onClick={onClose} />

        {/* Modal Window Container */}
        <div className="relative w-full max-w-5xl h-[85vh] flex flex-col bg-slate-950/80 rounded-2xl border border-white/10 shadow-2xl overflow-hidden z-10">
          
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-sm shrink-0 z-20">
            <div className="flex flex-col">
              <span className="text-xs text-indigo-400 font-mono font-medium uppercase tracking-wider">
                Media Viewer & Controller
              </span>
              <h3 className="text-sm font-bold text-white max-w-[300px] md:max-w-md truncate">
                {mediaName}
              </h3>
            </div>
            
            {/* Close Button */}
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition duration-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Core Viewer Area */}
          <div 
            className="flex-1 relative flex items-center justify-center overflow-hidden p-6 select-none cursor-grab active:cursor-grabbing"
            onWheel={handleWheel}
          >
            {/* Instruction tooltip */}
            <div className="absolute top-4 left-6 bg-black/40 text-[11px] text-slate-400 px-3 py-1.5 rounded-full font-mono border border-white/5 pointer-events-none z-20 backdrop-blur-md flex items-center gap-1.5">
              <Move className="h-3 w-3 text-indigo-400" />
              <span>Drag to Pan • Pinch/Scroll to Zoom</span>
            </div>

            <motion.div
              drag
              dragMomentum={false}
              dragElastic={0.1}
              style={{ x: position.x, y: position.y }}
              onDragEnd={(_, info) => {
                setPosition(prev => ({
                  x: prev.x + info.delta.x,
                  y: prev.y + info.delta.y
                }));
              }}
              animate={{ scale, rotate: rotation }}
              transition={{ type: 'spring', damping: 25, stiffness: 180 }}
              className="max-w-full max-h-full flex items-center justify-center"
            >
              {isImage && (
                <img 
                  src={mediaUrl} 
                  alt={mediaName} 
                  className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-xl pointer-events-none select-none"
                  referrerPolicy="no-referrer"
                />
              )}

              {isVideo && (
                <div className="relative max-w-full max-h-[60vh] rounded-lg overflow-hidden border border-white/10 bg-black pointer-events-auto">
                  <video 
                    ref={videoRef}
                    src={mediaUrl} 
                    className="max-w-full max-h-[55vh] object-contain" 
                    controls
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                </div>
              )}

              {isAudio && (
                <div className="bg-slate-900 border border-white/10 p-8 rounded-2xl flex flex-col items-center gap-4 max-w-md w-full shadow-2xl pointer-events-auto">
                  <div className="h-16 w-16 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center">
                    <Volume2 className="h-8 w-8" />
                  </div>
                  <span className="text-sm font-semibold text-white truncate max-w-xs">{mediaName}</span>
                  <audio src={mediaUrl} controls className="w-full mt-2" />
                </div>
              )}

              {isDoc && (
                <div className="bg-slate-900 border border-white/10 p-8 rounded-2xl flex flex-col items-center gap-4 max-w-md w-full shadow-2xl text-center">
                  <div className="h-16 w-16 bg-sky-600/20 text-sky-400 rounded-full flex items-center justify-center">
                    <FileText className="h-8 w-8" />
                  </div>
                  <span className="text-sm font-semibold text-white truncate max-w-xs">{mediaName}</span>
                  <p className="text-xs text-slate-400 max-w-xs">This document is formatted. You can download it to view locally on your preference.</p>
                  <button
                    onClick={handleDownload}
                    className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition duration-200"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download File</span>
                  </button>
                </div>
              )}

              {!isImage && !isVideo && !isAudio && !isDoc && (
                <div className="bg-slate-900 border border-white/10 p-8 rounded-2xl flex flex-col items-center gap-4 max-w-md w-full shadow-2xl text-center">
                  <div className="h-16 w-16 bg-slate-800 text-slate-400 rounded-full flex items-center justify-center">
                    <FileText className="h-8 w-8" />
                  </div>
                  <span className="text-sm font-semibold text-white truncate max-w-xs">{mediaName}</span>
                  <p className="text-xs text-slate-400">Unknown file type. You can download and inspect locally.</p>
                  <button
                    onClick={handleDownload}
                    className="mt-2 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition duration-200"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download File</span>
                  </button>
                </div>
              )}
            </motion.div>
          </div>

          {/* Interactive Controller Toolbar */}
          <div className="flex flex-wrap items-center justify-center gap-3 px-6 py-4 border-t border-white/5 bg-slate-900/40 backdrop-blur-sm shrink-0 z-20">
            {/* Zoom Slider Indicator */}
            <div className="text-xs text-slate-400 font-mono mr-2 bg-black/30 px-3 py-1.5 rounded-lg border border-white/5">
              Zoom: {Math.round(scale * 100)}%
            </div>

            <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
              <button 
                onClick={handleZoomOut}
                disabled={scale <= 0.5}
                className="p-2 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-white/5 transition"
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button 
                onClick={handleZoomIn}
                disabled={scale >= 4}
                className="p-2 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-white/5 transition"
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
              <button 
                onClick={handleRotateCcw}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition"
                title="Rotate Counter-Clockwise"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button 
                onClick={handleRotateCw}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition"
                title="Rotate Clockwise"
              >
                <RotateCw className="h-4 w-4" />
              </button>
            </div>

            <button 
              onClick={handleReset}
              className="p-2 text-slate-400 hover:text-white bg-black/40 hover:bg-white/5 rounded-xl border border-white/5 transition flex items-center gap-1.5 text-xs font-medium px-3.5"
              title="Reset Zoom & Rotation"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>

            <button 
              onClick={handleDownload}
              className="p-2 text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 rounded-xl border border-indigo-500/20 transition flex items-center gap-1.5 text-xs font-medium px-3.5 ml-auto md:ml-0"
              title="Download File"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Save File</span>
            </button>
          </div>

        </div>
      </div>
    </AnimatePresence>
  );
}
