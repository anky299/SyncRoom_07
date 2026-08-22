'use client';

import React, { useEffect, useRef, useState } from 'react';
import { getBackendUrl } from '@/lib/config';

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: any;
  }
}

interface SpotifyPlayerBackendProps {
  spotifyUri?: string;
  accessToken?: string;
  isPlaying: boolean;
  position: number; // in seconds
  volume?: number;
  onPlayerReady?: (deviceId: string) => void;
  onPlayerError?: (error: string) => void;
}

export default function SpotifyPlayerBackend({
  spotifyUri,
  accessToken,
  isPlaying,
  position,
  volume = 0.8,
  onPlayerReady,
  onPlayerError,
}: SpotifyPlayerBackendProps) {
  const playerRef = useRef<any>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);

  // Load Spotify SDK Script
  useEffect(() => {
    if (window.Spotify) {
      setSdkLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      setSdkLoaded(true);
    };
  }, []);

  // Initialize Player when SDK & Token are available
  useEffect(() => {
    if (!sdkLoaded || !accessToken) return;

    const player = new window.Spotify.Player({
      name: 'SyncRoom Player',
      getOAuthToken: (cb: (token: string) => void) => {
        cb(accessToken);
      },
      volume: volume,
    });

    player.addListener('ready', ({ device_id }: { device_id: string }) => {
      setDeviceId(device_id);
      setIsPremium(true);
      if (onPlayerReady) onPlayerReady(device_id);
    });

    player.addListener('not_ready', () => {
      setDeviceId(null);
    });

    player.addListener('initialization_error', ({ message }: { message: string }) => {
      if (onPlayerError) onPlayerError(message);
    });

    player.addListener('authentication_error', ({ message }: { message: string }) => {
      setIsPremium(false);
      if (onPlayerError) onPlayerError('Spotify Premium account required for Web Playback SDK.');
    });

    player.addListener('account_error', ({ message }: { message: string }) => {
      setIsPremium(false);
      if (onPlayerError) onPlayerError('Spotify Premium account required for Web Playback SDK.');
    });

    player.connect();
    playerRef.current = player;

    return () => {
      player.disconnect();
    };
  }, [sdkLoaded, accessToken]);

  // Synchronize Playback State & Position
  useEffect(() => {
    if (!playerRef.current || !deviceId || !spotifyUri || !accessToken) return;

    const syncSpotifyState = async () => {
      try {
        if (isPlaying) {
          await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              uris: [spotifyUri],
              position_ms: Math.round(position * 1000),
            }),
          });
        } else {
          await playerRef.current.pause();
        }
      } catch (e) {
        console.log('Spotify state sync error', e);
      }
    };

    syncSpotifyState();
  }, [isPlaying, spotifyUri, deviceId]);

  // Handle Seek Position Changes
  useEffect(() => {
    if (!playerRef.current) return;
    playerRef.current.seek(Math.round(position * 1000));
  }, [position]);

  // Non-Premium or Not Connected Warning Banner
  if (!accessToken) {
    return (
      <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-2 text-xs">
        <p className="font-extrabold text-emerald-400">Spotify Track Playing</p>
        <p className="text-zinc-300">Connect your Spotify Premium account in Settings to listen to this track in sync.</p>
        <a
          href={`${getBackendUrl()}/api/auth/spotify/login`}
          className="inline-block px-4 py-1.5 bg-emerald-500 text-black font-extrabold rounded-xl hover:bg-emerald-400 transition-all cursor-pointer"
        >
          Connect Spotify Premium
        </a>
      </div>
    );
  }

  if (isPremium === false) {
    return (
      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center space-y-1 text-xs">
        <p className="font-extrabold text-amber-400">Spotify Premium Required</p>
        <p className="text-zinc-300">Your connected Spotify account does not have Premium tier access. Upgrade to Spotify Premium to enable Web SDK playback.</p>
      </div>
    );
  }

  return (
    <div className="text-center py-2 text-[10px] text-emerald-400 font-mono-tech flex items-center justify-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      <span>Spotify Web SDK Synced Active</span>
    </div>
  );
}
