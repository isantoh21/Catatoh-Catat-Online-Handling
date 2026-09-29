import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCw, RefreshCw, X, Check, Crop, Move, Minimize2, Maximize2 } from 'lucide-react';

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
  title = 'Atur & Paskan Foto'
}: ImageCropModalProps) {
  const [zoom, setZoom] = useState(1); // 1 = 100% Fit In
  const [rotation, setRotation] = useState(0); // in degrees: 0, 90, 180, 270
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 0, height: 0 });
  const [bgColor, setBgColor] = useState<'#FFFFFF' | '#F8FAFC' | '#0F172A'>('#FFFFFF');

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Viewport box dimensions (square 260x260)
  const VIEWPORT_SIZE = 260;

  // Calculate base scale so the ENTIRE photo fits in without cutting off (contain mode)
  const calculateFitScale = useCallback((rot = rotation, w = imgNaturalSize.width, h = imgNaturalSize.height) => {
    if (!w || !h) return 1;
    const isRot = rot === 90 || rot === 270;
    const effectiveW = isRot ? h : w;
    const effectiveH = isRot ? w : h;
    return Math.min(VIEWPORT_SIZE / effectiveW, VIEWPORT_SIZE / effectiveH);
  }, [rotation, imgNaturalSize.width, imgNaturalSize.height]);

  // Reset state whenever modal opens or new image is loaded
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
    // Default to 100% Fit In (Contain)
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y
    });
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
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom(prev => Math.min(3.5, Math.max(0.4, +(prev + delta).toFixed(2))));
  };

  const handleRotate = () => {
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);
    setPan({ x: 0, y: 0 });
  };

  // Preset: FIT IN (Seluruh foto terlihat penuh tanpa terpotong)
  const handleFitIn = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Preset: FILL (Penuhi bingkai persegi tanpa tepi kosong)
  const handleFill = () => {
    if (!imgNaturalSize.width || !imgNaturalSize.height) return;
    const isRot = rotation === 90 || rotation === 270;
    const effectiveW = isRot ? imgNaturalSize.height : imgNaturalSize.width;
    const effectiveH = isRot ? imgNaturalSize.width : imgNaturalSize.height;
    const fitScale = Math.min(VIEWPORT_SIZE / effectiveW, VIEWPORT_SIZE / effectiveH);
    const coverScale = Math.max(VIEWPORT_SIZE / effectiveW, VIEWPORT_SIZE / effectiveH);
    if (fitScale > 0) {
      setZoom(+(coverScale / fitScale).toFixed(2));
      setPan({ x: 0, y: 0 });
    }
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setBgColor('#FFFFFF');
  };

  const handleApply = useCallback(() => {
    if (!imageRef.current || !imgNaturalSize.width || !imgNaturalSize.height) return;

    const img = imageRef.current;
    const canvas = document.createElement('canvas');
    const OUTPUT_SIZE = 512;
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill background color
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    ctx.save();

    // Center canvas
    ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);

    // Rotation
    ctx.rotate((rotation * Math.PI) / 180);

    const scaleRatio = OUTPUT_SIZE / VIEWPORT_SIZE;
    const baseFit = calculateFitScale(rotation);

    // Transform pan according to rotation angle
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

    // Total scale factor for the canvas
    const totalScale = baseFit * zoom * scaleRatio;
    const renderedWidth = img.naturalWidth * totalScale;
    const renderedHeight = img.naturalHeight * totalScale;

    // Use high quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      img,
      -renderedWidth / 2,
      -renderedHeight / 2,
      renderedWidth,
      renderedHeight
    );

    ctx.restore();

    // Export as high quality JPEG
    const croppedBase64 = canvas.toDataURL('image/jpeg', 0.90);
    onSave(croppedBase64);
    onClose();
  }, [pan, zoom, rotation, bgColor, calculateFitScale, imgNaturalSize, onClose, onSave]);

  if (!isOpen || !imageSrc) return null;

  const baseFit = calculateFitScale(rotation);
  const renderedWidth = imgNaturalSize.width ? imgNaturalSize.width * baseFit : VIEWPORT_SIZE;
  const renderedHeight = imgNaturalSize.height ? imgNaturalSize.height * baseFit : VIEWPORT_SIZE;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 flex flex-col max-h-[95vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base leading-tight">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500">
                Paskan ukuran foto agar tidak terpotong
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
        <div className="p-5 flex flex-col items-center bg-slate-900 select-none relative">
          <div 
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
            style={{ 
              width: `${VIEWPORT_SIZE}px`, 
              height: `${VIEWPORT_SIZE}px`,
              backgroundColor: bgColor 
            }}
            className={`relative rounded-2xl overflow-hidden border-2 border-indigo-400 shadow-2xl touch-none ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            {/* Inner Grid Guide Lines */}
            <div className="absolute inset-0 pointer-events-none z-10 grid grid-cols-3 grid-rows-3 border border-indigo-500/20">
              <div className="border-r border-b border-indigo-500/15"></div>
              <div className="border-r border-b border-indigo-500/15"></div>
              <div className="border-b border-indigo-500/15"></div>
              <div className="border-r border-b border-indigo-500/15"></div>
              <div className="border-r border-b border-indigo-500/15"></div>
              <div className="border-b border-indigo-500/15"></div>
              <div className="border-r border-b border-indigo-500/15"></div>
              <div className="border-r border-b border-indigo-500/15"></div>
              <div></div>
            </div>

            {/* Corner Markers */}
            <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-indigo-500 z-20 pointer-events-none rounded-tl-sm"></div>
            <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-indigo-500 z-20 pointer-events-none rounded-tr-sm"></div>
            <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-indigo-500 z-20 pointer-events-none rounded-bl-sm"></div>
            <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-indigo-500 z-20 pointer-events-none rounded-br-sm"></div>

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
                alt="Preview"
                onLoad={handleImageLoad}
                draggable={false}
                style={{
                  width: `${renderedWidth}px`,
                  height: `${renderedHeight}px`,
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                  maxWidth: 'none',
                  maxHeight: 'none',
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
                className="select-none pointer-events-none object-contain"
              />
            </div>
          </div>

          <div className="mt-2.5 flex items-center gap-1.5 text-slate-400 text-xs font-medium">
            <Move className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>Geser (drag) foto untuk mengatur posisi</span>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="p-4 sm:p-5 space-y-3.5 bg-white overflow-y-auto">
          {/* Preset Buttons: Fit In vs Fill */}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleFitIn}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                Math.abs(zoom - 1) < 0.05 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200'
              }`}
              title="Paskan seluruh foto ke dalam bingkai (tidak ada yang terpotong)"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Paskan Foto (Fit In)</span>
            </button>
            <button
              type="button"
              onClick={handleFill}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                zoom > 1.05 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
              }`}
              title="Perbesar foto agar mengisi penuh bingkai tanpa tepi"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Penuhi Bingkai (Fill)</span>
            </button>
          </div>

          {/* Zoom Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1 text-slate-600">
                <ZoomIn className="w-3.5 h-3.5" /> Zoom
              </span>
              <span className="font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md text-[11px] font-bold">
                {Math.round(zoom * 100)}% {Math.abs(zoom - 1) < 0.05 && '(Pas)'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom(prev => Math.max(0.4, +(prev - 0.1).toFixed(2)))}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Perkecil"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.05"
                value={zoom}
                onChange={e => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setZoom(prev => Math.min(3.0, +(prev + 0.1).toFixed(2)))}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Perbesar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Rotate & Reset & Background Color */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRotate}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Putar 90 Derajat"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Putar 90°</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Kembalikan ke Penuh Awal"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>

            {/* Background Color for margins */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500">Latar:</span>
              <button
                type="button"
                onClick={() => setBgColor('#FFFFFF')}
                className={`w-6 h-6 rounded-md border ${bgColor === '#FFFFFF' ? 'border-indigo-600 ring-2 ring-indigo-300' : 'border-slate-300'} bg-white cursor-pointer`}
                title="Latar Putih"
              />
              <button
                type="button"
                onClick={() => setBgColor('#F8FAFC')}
                className={`w-6 h-6 rounded-md border ${bgColor === '#F8FAFC' ? 'border-indigo-600 ring-2 ring-indigo-300' : 'border-slate-300'} bg-slate-100 cursor-pointer`}
                title="Latar Abu Muda"
              />
              <button
                type="button"
                onClick={() => setBgColor('#0F172A')}
                className={`w-6 h-6 rounded-md border ${bgColor === '#0F172A' ? 'border-indigo-600 ring-2 ring-indigo-300' : 'border-slate-300'} bg-slate-900 cursor-pointer`}
                title="Latar Gelap"
              />
            </div>
          </div>

          {/* Footer Save & Cancel Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
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
