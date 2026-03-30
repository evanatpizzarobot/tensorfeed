'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface PodcastPlayerProps {
  audioUrl: string;
  compact?: boolean;
}

export default function PodcastPlayer({ audioUrl, compact = false }: PodcastPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    setPlaying(!playing);
  }, [playing]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
  };

  const handleVolume = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(pct);
    setMuted(false);
  };

  function formatTime(sec: number): string {
    if (!sec || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <audio ref={audioRef} src={audioUrl} preload="none" />
        <button
          onClick={togglePlay}
          className="shrink-0 w-7 h-7 rounded-full bg-accent-primary hover:bg-accent-secondary transition-colors flex items-center justify-center"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-white ml-0.5" />}
        </button>
        <div
          className="flex-1 h-1.5 bg-bg-tertiary rounded-full cursor-pointer group"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-accent-primary rounded-full transition-all group-hover:bg-accent-cyan"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
      <audio ref={audioRef} src={audioUrl} preload="none" />

      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        className="shrink-0 w-9 h-9 rounded-full bg-accent-primary hover:bg-accent-secondary transition-colors flex items-center justify-center"
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
      </button>

      {/* Time + Progress */}
      <div className="flex-1 min-w-0">
        <div
          className="h-2 bg-bg-tertiary rounded-full cursor-pointer group"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-accent-primary rounded-full transition-all group-hover:bg-accent-cyan"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] font-mono text-text-muted">{formatTime(currentTime)}</span>
          <span className="text-[10px] font-mono text-text-muted">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => setMuted(!muted)}
          className="text-text-muted hover:text-text-primary transition-colors"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <div
          className="w-16 h-1.5 bg-bg-tertiary rounded-full cursor-pointer group"
          onClick={handleVolume}
        >
          <div
            className="h-full bg-text-muted rounded-full group-hover:bg-accent-primary transition-colors"
            style={{ width: `${muted ? 0 : volume * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
