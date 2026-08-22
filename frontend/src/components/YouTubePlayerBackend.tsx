'use client';

import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
  }
}

interface YouTubePlayerBackendProps {
  youtubeId?: string;
  isPlaying: boolean;
  position: number; // in seconds
  volume?: number;
  onPlayerReady?: () => void;
}

export default function YouTubePlayerBackend({
  youtubeId,
  isPlaying,
  position,
  volume = 0.8,
  onPlayerReady,
}: YouTubePlayerBackendProps) {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Load YouTube IFrame API Script
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setIsReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.body.appendChild(script);

    window.onYouTubeIframeAPIReady = () => {
      setIsReady(true);
    };
  }, []);

  // Initialize YouTube Player Instance
  useEffect(() => {
    if (!isReady || !youtubeId || !containerRef.current) return;

    // Destroy existing player instance if any
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (e) {}
    }

    const player = new window.YT.Player(containerRef.current, {
      height: '180',
      width: '320',
      videoId: youtubeId,
      playerVars: {
        autoplay: isPlaying ? 1 : 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
      },
      events: {
        onReady: (event: any) => {
          event.target.setVolume(Math.round(volume * 100));
          if (isPlaying) {
            event.target.playVideo();
            event.target.seekTo(position, true);
          }
          if (onPlayerReady) onPlayerReady();
        },
      },
    });

    playerRef.current = player;
  }, [isReady, youtubeId]);

  // Synchronize Playback Commands (Play/Pause)
  useEffect(() => {
    if (!playerRef.current || typeof playerRef.current.playVideo !== 'function') return;

    if (isPlaying) {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }
  }, [isPlaying]);

  // Handle Seek Synchronization
  useEffect(() => {
    if (!playerRef.current || typeof playerRef.current.seekTo !== 'function') return;
    const curTime = playerRef.current.getCurrentTime ? playerRef.current.getCurrentTime() : 0;
    if (Math.abs(curTime - position) > 1.5) {
      playerRef.current.seekTo(position, true);
    }
  }, [position]);

  // Sync Volume
  useEffect(() => {
    if (!playerRef.current || typeof playerRef.current.setVolume !== 'function') return;
    playerRef.current.setVolume(Math.round(volume * 100));
  }, [volume]);

  return (
    <div className="w-px h-px opacity-0 pointer-events-none absolute top-0 left-0 overflow-hidden select-none">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
