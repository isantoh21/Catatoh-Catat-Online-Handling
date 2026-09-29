import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCw, RefreshCw, X, Check, Crop, Move } from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onSave: (croppedBase64: string) => void;
  title?: string;
}

export default function ImageCropModal({
  isOpen,
  imageSrc,
  onClose,
  onSave,
  title = 'Atur Posisi & Ukuran Foto'
}: ImageCropModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // in degrees: 0, 90, 180, 270
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 0, height: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Viewport box dimensions (square)
  const VIEWPORT_SIZE = 260;

  // Reset state whenever a new image is loaded or modal opens
  useEffect(() => {
    if (isOpen && imageSrc) {
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
    }
  }, [isOpen, imageSrc]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImgNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });

    // Initial scale to fit the viewport nicely
    const maxDim = Math.max(img.naturalWidth, img.naturalHeight);
    const minDim = Math.min(img.naturalWidth, img.naturalHeight);
    if (minDim > 0) {
      // Calculate zoom so the smaller dimension fills the viewport
      const fitZoom = VIEWPORT_SIZE / minDim;
      setZoom(Math.max(1, Math.min(fitZoom, 3)));
    }
    setPan({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y
    });
    // Capture pointer to track outside the container
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom(prev => Math.min(3.5, Math.max(0.5, +(prev + delta).toFixed(2))));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  const handleApply = useCallback(() => {
    if (!imageRef.current) return;

    const img = imageRef.current;
    const canvas = document.createElement('canvas');
    const OUTPUT_SIZE = 512;
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background white (for transparent PNG converted to JPG/canvas)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    // Save context
    ctx.save();

    // Move to center of canvas
    ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);

    // Apply rotation
    ctx.rotate((rotation * Math.PI) / 180);

    // Scale ratio between canvas size and preview viewport
    const scaleRatio = OUTPUT_SIZE / VIEWPORT_SIZE;

    // Apply user pan (scaled to output canvas)
    // When rotated, pan coordinates must be transformed according to rotation
    let transformedPanX = pan.x * scaleRatio;
    let transformedPanY = pan.y * scaleRatio;

    if (rotation === 90) {
      transformedPanX = pan.y * scaleRatio;
      transformedPanY = -pan.x * scaleRatio;
    } else if (rotation === 180) {
      transformedPanX = -pan.x * scaleRatio;
      transformedPanY = -pan.y * scaleRatio;
    } else if (rotation === 270) {
      transformedPanX = -pan.y * scaleRatio;
      transformedPanY = pan.x * scaleRatio;
    }

    ctx.translate(transformedPanX, transformedPanY);

    // Calculate image render dimensions
    const renderedWidth = img.naturalWidth * (zoom * scaleRatio);
    const renderedHeight = img.naturalHeight * (zoom * scaleRatio);

    ctx.drawImage(
      img,
      -renderedWidth / 2,
      -renderedHeight / 2,
      renderedWidth,
      renderedHeight
    );

    ctx.restore();

    // Export as optimized JPEG at high quality (~40-80KB)
    const croppedBase64 = canvas.toDataURL('image/jpeg', 0.88);
    onSave(croppedBase64);
    onClose();
  }, [pan, zoom, rotation, onClose, onSave]);

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base leading-tight">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500">
                Geser & atur foto agar pas di bingkai
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Crop Area */}
        <div className="p-6 flex flex-col items-center bg-slate-950/90 relative overflow-hidden select-none">
          <div 
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
            style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}
            className={`relative rounded-2xl overflow-hidden border-2 border-indigo-400/80 shadow-2xl touch-none ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            {/* Dark Mask Around with inner grid overlay */}
            <div className="absolute inset-0 pointer-events-none z-10 grid grid-cols-3 grid-rows-3 border border-white/20">
              <div className="border-r border-b border-white/15"></div>
              <div className="border-r border-b border-white/15"></div>
              <div className="border-b border-white/15"></div>
              <div className="border-r border-b border-white/15"></div>
              <div className="border-r border-b border-white/15"></div>
              <div className="border-b border-white/15"></div>
              <div className="border-r border-white/15"></div>
              <div className="border-r border-white/15"></div>
              <div></div>
            </div>

            {/* Corner Indicators */}
            <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-indigo-400 z-20 pointer-events-none rounded-tl-sm"></div>
            <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-indigo-400 z-20 pointer-events-none rounded-tr-sm"></div>
            <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-indigo-400 z-20 pointer-events-none rounded-bl-sm"></div>
            <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-indigo-400 z-20 pointer-events-none rounded-br-sm"></div>

            {/* Interactive Image Container */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px)`
              }}
            >
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Source preview"
                onLoad={handleImageLoad}
                draggable={false}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                  maxWidth: 'none',
                  maxHeight: 'none',
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
                className="select-none pointer-events-none"
              />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-slate-400 text-xs font-medium">
            <Move className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>Klik & geser gambar untuk mengatur posisi</span>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="p-5 space-y-4 bg-white">
          {/* Zoom Slider Control */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1">
                <ZoomIn className="w-3.5 h-3.5 text-slate-500" /> Perbesar / Perkecil (Zoom)
              </span>
              <span className="font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                {Math.round(zoom * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom(prev => Math.max(0.5, +(prev - 0.1).toFixed(2)))}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Perkecil"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <input
                type="range"
                min="0.5"
                max="3.5"
                step="0.05"
                value={zoom}
                onChange={e => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setZoom(prev => Math.min(3.5, +(prev + 0.1).toFixed(2)))}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Perbesar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Action Tools: Rotate & Reset */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRotate}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Putar 90 Derajat"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Putar 90°</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Kembalikan ke Posisi Semula"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
            
            <div className="text-[11px] text-slate-400 hidden sm:block">
              Rasio 1:1 Persegi
            </div>
          </div>

          {/* Footer Save & Cancel Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Terapkan & Simpan Foto</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
