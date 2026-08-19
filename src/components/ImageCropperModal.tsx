import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCw, RotateCcw, Check, X, Move, RefreshCw } from 'lucide-react';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface ImageCropperModalProps {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedDataUrl: string) => void;
  title?: string;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
  title = 'Crop Profile Avatar',
}) => {
  useModalDismiss(isOpen, onClose);

  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Reset state when a new image source is opened
  useEffect(() => {
    if (isOpen && imageSrc) {
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setPreviewUrl('');
      if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
        setImageLoaded(true);
      } else {
        setImageLoaded(false);
      }
    }
  }, [isOpen, imageSrc]);

  // Generate live preview on canvas
  const generateCroppedData = useCallback((): string => {
    const img = imgRef.current;
    if (!img) return imageSrc || '';

    const naturalWidth = img.naturalWidth || img.width;
    const naturalHeight = img.naturalHeight || img.height;

    if (!naturalWidth || !naturalHeight) return imageSrc || '';

    try {
      const canvas = document.createElement('canvas');
      const outputSize = 400; // Resolution of cropped avatar
      canvas.width = outputSize;
      canvas.height = outputSize;

      const ctx = canvas.getContext('2d');
      if (!ctx) return imageSrc || '';

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Clear background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outputSize, outputSize);

      // Calculate crop parameters relative to display scale
      // Container crop box size is 240px
      const cropBoxSize = 240;

      // Center of canvas
      ctx.save();
      ctx.translate(outputSize / 2, outputSize / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      // Scaling ratio from cropbox size to output size
      const factor = outputSize / cropBoxSize;

      // Apply offset and user scaling
      const drawX = position.x * factor;
      const drawY = position.y * factor;

      // Base cover dimension for natural aspect ratio
      const baseScale = Math.max(cropBoxSize / naturalWidth, cropBoxSize / naturalHeight);
      const drawWidth = naturalWidth * baseScale * scale * factor;
      const drawHeight = naturalHeight * baseScale * scale * factor;

      ctx.drawImage(
        img,
        -drawWidth / 2 + drawX,
        -drawHeight / 2 + drawY,
        drawWidth,
        drawHeight
      );

      ctx.restore();

      return canvas.toDataURL('image/jpeg', 0.92);
    } catch (err) {
      console.error('Error generating cropped image:', err);
      return imageSrc || '';
    }
  }, [imageSrc, position.x, position.y, rotation, scale]);

  // Update live preview when transform changes
  useEffect(() => {
    if (imageLoaded || (imgRef.current && imgRef.current.complete)) {
      const timer = setTimeout(() => {
        const cropped = generateCroppedData();
        if (cropped) setPreviewUrl(cropped);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [generateCroppedData, imageLoaded]);

  if (!isOpen) return null;

  // Mouse & Touch Drag Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore if pointer release fails
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.min(Math.max(0.8, prev + delta), 3.5));
  };

  const handleRotateLeft = () => setRotation((prev) => (prev - 90) % 360);
  const handleRotateRight = () => setRotation((prev) => (prev + 90) % 360);

  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleApply = () => {
    try {
      const cropped = generateCroppedData() || imageSrc;
      if (cropped) {
        onCropComplete(cropped);
      }
    } catch (err) {
      console.error('Error applying cropped image:', err);
    } finally {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#2d6a4f]/20 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp">
        {/* Header */}
        <div className="px-5 py-4 bg-[#1b4332] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Move className="w-5 h-5 text-[#74c69d]" />
            <h3 className="font-bold text-base tracking-wide">{title}</h3>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          <p className="text-xs text-[#52605d] font-medium text-center">
            Drag photo to reposition. Use zoom slider or scroll wheel to fit avatar.
          </p>

          {/* Interactive Crop Stage */}
          <div className="flex flex-col items-center justify-center">
            <div
              ref={containerRef}
              onWheel={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="relative w-[260px] h-[260px] bg-slate-900 rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing border-2 border-[#2d6a4f] shadow-inner select-none touch-none flex items-center justify-center"
            >
              {/* Hidden Canvas for computation */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Source Image with Transforms */}
              {imageSrc && (
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="Crop source"
                  onLoad={() => setImageLoaded(true)}
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${scale})`,
                    transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                    maxHeight: '100%',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    pointerEvents: 'none',
                  }}
                  className="select-none"
                />
              )}

              {/* Overlay Mask with Square Crop Box & Rule of Thirds Grid */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Dark Mask around crop box */}
                <div className="w-[240px] h-[240px] rounded-2xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] relative overflow-hidden">
                  {/* Grid Lines */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30">
                    <div className="border-r border-white border-b"></div>
                    <div className="border-r border-white border-b"></div>
                    <div className="border-b border-white"></div>
                    <div className="border-r border-white border-b"></div>
                    <div className="border-r border-white border-b"></div>
                    <div className="border-b border-white"></div>
                    <div className="border-r border-white"></div>
                    <div className="border-r border-white"></div>
                    <div></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Controls Bar */}
            <div className="w-full max-w-sm mt-4 space-y-3 bg-[#f7f9f7] p-3.5 rounded-2xl border border-[#e2ece2]">
              {/* Zoom Control */}
              <div className="flex items-center gap-3">
                <ZoomOut className="w-4 h-4 text-[#2d6a4f] shrink-0" />
                <input
                  type="range"
                  min="0.8"
                  max="3"
                  step="0.05"
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="w-full accent-[#2d6a4f] cursor-pointer h-1.5 bg-gray-200 rounded-lg"
                />
                <ZoomIn className="w-4 h-4 text-[#2d6a4f] shrink-0" />
                <span className="text-[11px] font-bold text-[#1b4332] w-9 text-right font-mono">
                  {Math.round(scale * 100)}%
                </span>
              </div>

              {/* Rotation & Reset Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleRotateLeft}
                    className="p-2 rounded-xl bg-white border border-[#2d6a4f]/20 hover:bg-[#2d6a4f]/10 text-[#1b4332] text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                    title="Rotate 90° Counter-Clockwise"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#2d6a4f]" />
                    <span>-90°</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRotateRight}
                    className="p-2 rounded-xl bg-white border border-[#2d6a4f]/20 hover:bg-[#2d6a4f]/10 text-[#1b4332] text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                    title="Rotate 90° Clockwise"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-[#2d6a4f]" />
                    <span>+90°</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="p-2 rounded-xl bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                  title="Reset alignment"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-[#f7f9f7] border-t border-[#e2ece2] flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 font-bold text-xs hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs inline-flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <Check className="w-4 h-4 text-[#74c69d]" />
            <span>Crop & Save Avatar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
