import React, { useRef, useEffect, useState } from 'react';
import Hls from 'hls.js';
import { videoExtractor } from '../utils/videoExtractor';
import toast from 'react-hot-toast';

/**
 * UnifiedPlayer renders either:
 * 1. A fully-featured HLS player (safe domains)
 * 2. An instructional panel with mpv/VLC commands (protected domains)
 */
export default function UnifiedPlayer({ directUrl, subtitles = [], title }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [showCommands, setShowCommands] = useState(false);
  const [playerCommands, setPlayerCommands] = useState(null);

  useEffect(() => {
    if (!directUrl || !videoRef.current) return;

    // Cleanup previous hls
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Check if this is a problematic domain
    const clear = false;
    


    // Try to play in browser
    const video = videoRef.current;
    
    if (directUrl.includes('.m3u8')) {
      // HLS stream
      if (Hls.isSupported()) {
        const hls = new Hls({ 
          debug: false, 
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90
        });
        hlsRef.current = hls;
        
        hls.attachMedia(video);
        hls.loadSource(directUrl);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(err => console.log('Play failed:', err));
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS error:', data);
          if (data.fatal) {
            toast.error('Playback error – try external player');
            setPlayerCommands(videoExtractor.getExternalPlayerCommands(directUrl));
            setShowCommands(true);
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS support
        video.src = directUrl;
        video.play().catch(err => console.log('Safari HLS play failed:', err));
      }
    } else {
      // Direct video file
      video.src = directUrl;
      video.play().catch(err => {
        console.log('Direct video play failed:', err);
        setPlayerCommands(videoExtractor.getExternalPlayerCommands(directUrl));
        setShowCommands(true);
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [directUrl]);

  if (!directUrl) {
    return (
      <div className="text-center text-white p-8">
        <p className="text-gray-300">No video URL available</p>
      </div>
    );
  }


  if (showCommands) {
    const urlDomain = new URL(directUrl).hostname;
    
    return (
      <div className="text-center text-white p-8 space-y-4">
        <h3 className="text-xl font-bold text-orange-300">External Player Required</h3>
        <p className="text-orange-200">Domain: {urlDomain}</p>
        <p className="text-gray-300">Copy a command to play in external player:</p>
        
        {playerCommands && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 justify-center">
              <button 
                className="btn btn-success btn-sm" 
                onClick={() => {
                  navigator.clipboard.writeText(playerCommands.mpv);
                  toast.success('mpv command copied!');
                }}
              >
                📋 Copy mpv
              </button>
              <button 
                className="btn btn-info btn-sm" 
                onClick={() => {
                  navigator.clipboard.writeText(playerCommands.vlc);
                  toast.success('VLC command copied!');
                }}
              >
                📋 Copy VLC
              </button>
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={() => {
                  navigator.clipboard.writeText(directUrl);
                  toast.success('URL copied!');
                }}
              >
                📋 Copy URL
              </button>
            </div>
            
            <div className="text-left bg-base-300 p-4 rounded-lg mt-4 max-w-2xl mx-auto">
              <div className="text-sm text-gray-400 mb-2">mpv command:</div>
              <code className="text-green-400 break-all">{playerCommands.mpv}</code>
              
              <div className="text-sm text-gray-400 mb-2 mt-4">VLC command:</div>
              <code className="text-blue-400 break-all">{playerCommands.vlc}</code>
            </div>
          </div>
        )}
        

      </div>
    );
  }

  // Browser-playable UI
  return (
    <video 
      ref={videoRef} 
      className="w-full h-full" 
      controls 
      crossOrigin="anonymous"
      onError={() => {
        console.log('Video element error, showing external options');
        setPlayerCommands(videoExtractor.getExternalPlayerCommands(directUrl));
        setShowCommands(true);
      }}
    >
      {subtitles.map((sub, idx) => (
        <track 
          key={idx} 
          kind="subtitles" 
          src={sub.file?.startsWith('http') ? `/api/subtitle-proxy?url=${encodeURIComponent(sub.file)}` : sub.file} 
          label={sub.label || sub.lang || `sub ${idx}`}
        />
      ))}
    </video>
  );
} 