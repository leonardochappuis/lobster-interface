import React, { useRef, useEffect, useState } from 'react';
import Hls from 'hls.js';
import { videoExtractor } from '../utils/videoExtractor';
import { FaCopy, FaPlay, FaExternalLinkAlt } from 'react-icons/fa';
import toast from 'react-hot-toast';

export default function SimpleVideoPlayer({ 
  media_id, 
  media_type, 
  season = null, 
  episode = null, 
  title,
  onClose 
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [subtitles, setSubtitles] = useState([]);
  const [error, setError] = useState(null);
  const [showCommands, setShowCommands] = useState(false);
  const [playerCommands, setPlayerCommands] = useState(null);
  const [canPlayInBrowser, setCanPlayInBrowser] = useState(true);

  const extractVideo = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🎬 Starting video extraction...');
      
      // Extract direct URL
      const result = await videoExtractor.extractDirectUrl(
        media_id,
        media_type,
        null, // data_id will be determined by the server for TV shows
        'Vidcloud',
        null // quality
      );
      
      setVideoUrl(result.videoUrl);
      setSubtitles(result.subtitles);
      setPlayerCommands(videoExtractor.getExternalPlayerCommands(result.videoUrl));
      
      // Check if we can play in browser
      const isProblematic = videoExtractor.isProblematicDomain(result.videoUrl);
      setCanPlayInBrowser(!isProblematic);
      
      if (isProblematic) {
        console.log('🚫 Problematic domain detected, showing external player options');
        setShowCommands(true);
        toast.error('This video requires an external player like mpv or VLC');
      } else {
        console.log('✅ Compatible domain, attempting browser playback');
        // Attempt to load in HLS player
        loadVideoInPlayer(result.videoUrl, result.subtitles);
      }
      
    } catch (error) {
      console.error('❌ Video extraction failed:', error);
      setError(error.message);
      toast.error(`Failed to extract video: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadVideoInPlayer = async (url, subtitleTracks) => {
    if (!videoRef.current) return;

    try {
      // Clean up previous HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const video = videoRef.current;

      if (url.includes('.m3u8')) {
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
          hls.loadSource(url);
          
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('✅ HLS manifest loaded successfully');
            video.play().catch(err => console.log('Play failed:', err));
          });
          
          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('❌ HLS error:', data);
            if (data.fatal) {
              console.log('💥 Fatal HLS error, showing external player options');
              setShowCommands(true);
              setCanPlayInBrowser(false);
              toast.error('Browser playback failed. Use external player.');
            }
          });
          
          // Load subtitles if available
          await loadSubtitles(subtitleTracks);
          
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari native HLS support
          video.src = url;
          video.play().catch(err => console.log('Safari HLS play failed:', err));
        } else {
          throw new Error('HLS not supported in this browser');
        }
      } else {
        // Direct video file
        video.src = url;
        video.play().catch(err => console.log('Direct video play failed:', err));
      }
      
    } catch (error) {
      console.error('❌ Failed to load video in player:', error);
      setShowCommands(true);
      setCanPlayInBrowser(false);
      toast.error('Browser playback failed. Use external player.');
    }
  };

  const loadSubtitles = async (subtitleTracks) => {
    if (!subtitleTracks || subtitleTracks.length === 0) return;

    try {
      // Load first English subtitle track
      const englishSub = subtitleTracks.find(track => 
        track.label && track.label.toLowerCase().includes('english')
      ) || subtitleTracks[0];

      if (englishSub && englishSub.file) {
        console.log('📝 Loading subtitles:', englishSub.file);
        
        const subResult = await videoExtractor.fetchSubtitles(englishSub.file);
        
        if (subResult.success) {
          // Create blob URL for subtitle content
          const blobUrl = videoExtractor.createSubtitleBlobUrl(subResult.content);
          if (blobUrl) {
            // Add subtitle track to video element
            const track = document.createElement('track');
            track.kind = 'subtitles';
            track.label = englishSub.label || 'English';
            track.srclang = 'en';
            track.src = blobUrl;
            track.default = true;
            
            videoRef.current.appendChild(track);
            console.log('✅ Subtitles loaded successfully');
          }
        }
      }
    } catch (error) {
      console.error('⚠️ Failed to load subtitles:', error);
      // Don't fail the whole process for subtitle errors
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Command copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
      toast.error('Failed to copy command');
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, []);

  // Auto-extract video on mount
  useEffect(() => {
    if (media_id && media_type) {
      extractVideo();
    }
  }, [media_id, media_type, season, episode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-4 text-lg">Extracting video URL...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-500 text-lg mb-4">❌ {error}</div>
        <button 
          onClick={extractVideo}
          className="btn btn-primary"
        >
          <FaPlay className="mr-2" />
          Try Again
        </button>
      </div>
    );
  }

  if (!videoUrl) {
    return (
      <div className="p-6 text-center">
        <button 
          onClick={extractVideo}
          className="btn btn-primary"
        >
          <FaPlay className="mr-2" />
          Extract Video
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Video Player Section */}
      {canPlayInBrowser && !showCommands ? (
        <div className="bg-black rounded-lg overflow-hidden aspect-video">
          <video
            ref={videoRef}
            className="w-full h-full"
            controls
            crossOrigin="anonymous"
            onError={() => {
              console.log('❌ Video element error, showing external options');
              setCanPlayInBrowser(false);
              setShowCommands(true);
            }}
          />
        </div>
      ) : (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-gray-600 dark:text-gray-400 mb-4">
            This video requires an external player
          </div>
          <button
            onClick={() => setShowCommands(!showCommands)}
            className="btn btn-primary"
          >
            <FaExternalLinkAlt className="mr-2" />
            Show Player Commands
          </button>
        </div>
      )}

      {/* External Player Commands */}
      {showCommands && playerCommands && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">External Player Commands</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded border">
              <div>
                <div className="font-medium">MPV (Recommended)</div>
                <code className="text-sm text-gray-600 dark:text-gray-400 break-all">
                  {playerCommands.mpv}
                </code>
              </div>
              <button
                onClick={() => copyToClipboard(playerCommands.mpv)}
                className="btn btn-sm btn-outline"
              >
                <FaCopy />
              </button>
            </div>

            <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded border">
              <div>
                <div className="font-medium">VLC Media Player</div>
                <code className="text-sm text-gray-600 dark:text-gray-400 break-all">
                  {playerCommands.vlc}
                </code>
              </div>
              <button
                onClick={() => copyToClipboard(playerCommands.vlc)}
                className="btn btn-sm btn-outline"
              >
                <FaCopy />
              </button>
            </div>

            <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded border">
              <div>
                <div className="font-medium">Download (curl)</div>
                <code className="text-sm text-gray-600 dark:text-gray-400 break-all">
                  {playerCommands.download}
                </code>
              </div>
              <button
                onClick={() => copyToClipboard(playerCommands.download)}
                className="btn btn-sm btn-outline"
              >
                <FaCopy />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subtitle Information */}
      {subtitles && subtitles.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
            Available Subtitles: {subtitles.length}
          </h4>
          <div className="text-sm text-blue-600 dark:text-blue-300">
            {subtitles.map((sub, index) => (
              <span key={index} className="mr-3">
                {sub.label || `Track ${index + 1}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Video Info */}
      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
        <div>📺 {title}</div>
        {season && episode && <div>Season {season}, Episode {episode}</div>}
        <div>🔗 <span className="break-all">{videoUrl}</span></div>
      </div>

      {/* Close Button */}
      {onClose && (
        <div className="text-center pt-4">
          <button onClick={onClose} className="btn btn-outline">
            Close Player
          </button>
        </div>
      )}
    </div>
  );
} 