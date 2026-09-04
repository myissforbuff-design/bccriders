import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  Loader2,
  Film,
  Smartphone
} from 'lucide-react';

interface WhiteLabelVideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  className?: string;
}

export const WhiteLabelVideoPlayer: React.FC<WhiteLabelVideoPlayerProps> = ({
  src,
  poster,
  title,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number; isShorts: boolean }>({
    width: 0,
    height: 0,
    isShorts: false,
  });

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return '0:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const vWidth = videoRef.current.videoWidth || 0;
      const vHeight = videoRef.current.videoHeight || 0;
      const isShorts = vHeight > vWidth; // Vertical / Shorts format (e.g. 9:16 or 4:5)

      setVideoDimensions({
        width: vWidth,
        height: vHeight,
        isShorts,
      });
      setDuration(videoRef.current.duration);
      setIsLoading(false);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const clampedPos = Math.max(0, Math.min(1, pos));
    videoRef.current.currentTime = clampedPos * duration;
    setCurrentTime(clampedPos * duration);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && volume === 0) {
      setVolume(0.8);
      videoRef.current.volume = 0.8;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      const nextMuted = val === 0;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.warn('Fullscreen request failed:', err);
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch (err) {
        console.warn('Exit fullscreen failed:', err);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!showSettings) {
          setShowControls(false);
        }
      }, 2500);
    }
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSettings(false);
  };

  const progressPercentage = duration ? (currentTime / duration) * 100 : 0;

  // Responsive dimension styles according to aspect ratio:
  const isShorts = videoDimensions.isShorts;

  return (
    <div className={`w-full flex justify-center ${className}`}>
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && !showSettings && setShowControls(false)}
        className={`group relative bg-neutral-950 overflow-hidden select-none flex items-center justify-center border border-[#e2ece2] shadow-xs transition-all duration-300 ${
          isShorts
            ? 'w-full max-w-[340px] sm:max-w-[380px] aspect-[9/16] max-h-[580px] rounded-2xl sm:rounded-3xl'
            : 'w-full aspect-video rounded-xl sm:rounded-2xl'
        }`}
      >
        {/* Native HTML5 Video Element */}
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          playsInline
          preload="metadata"
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onWaiting={() => setIsLoading(true)}
          onPlaying={() => {
            setIsLoading(false);
            setIsPlaying(true);
          }}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            setShowControls(true);
          }}
          className={`w-full h-full cursor-pointer ${isShorts ? 'object-cover sm:object-contain' : 'object-contain'}`}
        />

        {/* Buffering / Loading Indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none z-20">
            <Loader2 className="w-9 h-9 text-emerald-400 animate-spin" />
          </div>
        )}

        {/* Center Play Button Overlay (when paused) */}
        {!isPlaying && !isLoading && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute z-20 p-3.5 sm:p-4 rounded-full bg-emerald-600/90 text-white hover:bg-emerald-500 hover:scale-110 active:scale-95 transition-all shadow-2xl backdrop-blur-xs cursor-pointer"
            title="Play video"
          >
            <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current ml-0.5" />
          </button>
        )}

        {/* Top Header Overlay: Title & Shorts Indicator */}
        <div
          className={`absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 via-black/30 to-transparent text-white z-20 transition-opacity duration-300 flex items-center justify-between pointer-events-none ${
            showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 pr-2">
            {isShorts ? (
              <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <Film className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
            <span className="text-xs font-semibold truncate drop-shadow-md">
              {title || (isShorts ? 'Ride Short' : 'Ride Video')}
            </span>
          </div>
          {isShorts && (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-600/80 text-[9px] font-bold uppercase tracking-wider text-white shrink-0">
              Shorts 9:16
            </span>
          )}
        </div>

        {/* Clean Custom Control Bar */}
        <div
          className={`absolute bottom-0 left-0 right-0 p-2.5 sm:p-3.5 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-30 transition-all duration-300 ${
            showControls || !isPlaying ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
        >
          {/* Progress / Scrub Bar */}
          <div
            ref={progressBarRef}
            onClick={handleSeek}
            className="relative w-full h-1.5 sm:h-2 bg-white/25 rounded-full cursor-pointer hover:h-2.5 transition-all group/seek mb-2"
          >
            <div
              className="absolute top-0 left-0 bottom-0 bg-emerald-500 rounded-full transition-all"
              style={{ width: `${progressPercentage}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover/seek:opacity-100 transition-opacity"
              style={{ left: `calc(${progressPercentage}% - 6px)` }}
            />
          </div>

          {/* Action Controls Row */}
          <div className="flex items-center justify-between text-white text-xs">
            {/* Left: Play/Pause, Rewind, Volume & Time */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="p-1 hover:text-emerald-400 transition-colors cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                  }
                }}
                className="p-1 hover:text-emerald-400 transition-colors cursor-pointer hidden xs:block"
                title="Rewind 10s"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1 group/vol">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-1 hover:text-emerald-400 transition-colors cursor-pointer"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                {!isShorts && (
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-12 sm:w-16 h-1 accent-emerald-500 bg-white/30 rounded-lg cursor-pointer hidden sm:block"
                  />
                )}
              </div>

              <span className="text-[10px] sm:text-[11px] font-mono text-neutral-300">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right: Speed & Fullscreen */}
            <div className="flex items-center gap-1.5 relative">
              {/* Speed Selector Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer flex items-center gap-0.5 ${
                    playbackRate !== 1
                      ? 'bg-emerald-600/80 border-emerald-400 text-white'
                      : 'bg-black/40 border-white/20 hover:border-emerald-400 text-neutral-300'
                  }`}
                  title="Playback Speed"
                >
                  <span>{playbackRate}x</span>
                </button>

                {showSettings && (
                  <div className="absolute right-0 bottom-full mb-2 bg-neutral-900/95 backdrop-blur-md border border-white/10 rounded-xl p-1 shadow-2xl z-50 flex flex-col gap-0.5 min-w-[80px]">
                    <span className="text-[9px] uppercase font-bold text-neutral-400 px-2 py-0.5">Speed</span>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => handleRateChange(rate)}
                        className={`px-2 py-0.5 rounded-md text-xs text-left transition-colors cursor-pointer flex items-center justify-between ${
                          playbackRate === rate
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'text-neutral-300 hover:bg-white/10'
                        }`}
                      >
                        <span>{rate === 1 ? '1x' : `${rate}x`}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fullscreen Button */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1 hover:text-emerald-400 transition-colors cursor-pointer"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize className="w-4 h-4" />
                ) : (
                  <Maximize className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
