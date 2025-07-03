import React, { useState, useEffect, useRef } from 'react';
import { FaArrowLeft, FaTimes, FaSearch, FaSpinner, FaCheck, FaEye, FaEyeSlash } from 'react-icons/fa';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import Hls from 'hls.js';
import UnifiedPlayer from '../components/UnifiedPlayer';
/*686474c0a6aade87d4f732df*/

const LobsterPlayer = ({ isOpen, onClose, initialTitle = '' }) => {
  const [step, setStep] = useState('search'); // search, media, seasons, episodes, player
  const [query, setQuery] = useState(initialTitle);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [videoSources, setVideoSources] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [watchHistory, setWatchHistory] = useState([]);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [directUrl, setDirectUrl] = useState(null);
  const [subtitles, setSubtitles] = useState([]);

  // Fetch user settings for subtitle preferences
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => axios.get('/api/settings').then(res => res.data),
    refetchOnWindowFocus: false
  });

  // Reset state and auto-search when modal opens
  useEffect(() => {
    if (isOpen) {
      reset();
      
      if (initialTitle) {
        setQuery(initialTitle);
        setTimeout(() => {
          handleSearchWithTitle(initialTitle);
        }, 100);
      }
    }
  }, [isOpen, initialTitle]);

  // Cleanup HLS when component unmounts
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  // Auto-start playback when we reach player step with direct URL
  useEffect(() => {
    if (step === 'player' && directUrl && videoRef.current) {
      console.log('🎬 Auto-starting playback with direct URL:', directUrl);
      
      // Auto-start browser playback
      playDirectUrl(directUrl, subtitles).catch(err => {
        console.log('🎬 Auto-playback failed (expected with CORS):', err.message);
        toast.info('Browser playback failed. Use the "Try Browser Player" button or copy the mpv command.');
      });
    }
    
    // Cleanup when step changes away from player
    if (step !== 'player' && hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, [step, directUrl]);

  const handleSearchWithTitle = async (searchTitle) => {
    if (!searchTitle.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/lobster/search/${encodeURIComponent(searchTitle)}`);
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setShowErrorModal(true);
      } else {
        setSearchResults(data.results);
        if (data.results.length > 0) {
          setStep('media');
        } else {
          setError('No results found');
          setShowErrorModal(true);
        }
      }
    } catch (err) {
      setError('Search failed');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    await handleSearchWithTitle(query);
  };

  const handleMediaSelect = async (media) => {
    setSelectedMedia(media);
    setError(null);
    
    await fetchWatchHistory(media.id, media.media_type);
    
    if (media.media_type === 'tv') {
      setLoading(true);
      try {
        const response = await fetch(`/api/lobster/seasons/${media.id}`);
        const data = await response.json();
        
        if (data.error) {
          setError(data.error);
          setShowErrorModal(true);
        } else {
          setSeasons(data.seasons);
          setStep('seasons');
        }
      } catch (err) {
        setError('Failed to load seasons');
        setShowErrorModal(true);
      } finally {
        setLoading(false);
      }
    } else {
      // 🦞 For movies, use direct URL extraction
      setLoading(true);
      setError(null);
      
      try {
        console.log('🦞 Extracting direct URL for movie:', media.title);
        
        const response = await fetch('/api/lobster/extract-direct-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            media_id: media.id,
            media_type: media.media_type,
            provider: 'Vidcloud',
            quality: '1080'
          }),
        });

        const data = await response.json();
        
        if (data.success) {
          console.log('✅ Direct URL extracted for movie:', data.video_url);
          setDirectUrl(data.video_url);
          setSubtitles(data.subtitles || []);
          setStep('player');
        } else {
          throw new Error(data.error || 'Failed to extract video URL');
        }
      } catch (err) {
        console.error('❌ Direct URL extraction failed for movie:', err);
        setError(err.message);
        setShowErrorModal(true);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSeasonSelect = async (season) => {
    setSelectedSeason(season);
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/lobster/episodes/${season.id}`);
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setShowErrorModal(true);
      } else {
        setEpisodes(data.episodes);
        setStep('episodes');
      }
    } catch (err) {
      setError('Failed to load episodes');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleEpisodeSelect = async (episode) => {
    console.log('🚨 NEW DIRECT URL METHOD TRIGGERED FOR:', episode.title);
    console.log('🚨 This should appear in browser console if new code is working');
    
    setSelectedEpisode(episode);
    
    // 🦞 Use lobster.sh direct URL extraction instead of proxy
    setLoading(true);
    setError(null);
    
    try {
      console.log('🦞 Extracting direct URL for episode:', episode.title);
      
      const response = await fetch('/api/lobster/extract-direct-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          media_id: selectedMedia.id,
          media_type: selectedMedia.media_type,
          data_id: episode.data_id,
          provider: 'Vidcloud',
          quality: '1080'
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Direct URL extracted:', data.video_url);
        setDirectUrl(data.video_url);
        setSubtitles(data.subtitles || []);
        setStep('player');
        
        // Mark as watched
        if (selectedMedia?.media_type === 'tv') {
          await markAsWatched(episode, selectedSeason, selectedMedia);
        }
      } else {
        throw new Error(data.error || 'Failed to extract video URL');
      }
    } catch (err) {
      console.error('❌ Direct URL extraction failed:', err);
      setError(err.message);
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  // 🗑️ Old getSources function removed - now using direct URL extraction

  const handleBack = () => {
    setError(null);
    setShowErrorModal(false);
    switch (step) {
      case 'media':
        setStep('search');
        setSearchResults([]);
        break;
      case 'seasons':
        setStep('media');
        setSeasons([]);
        setSelectedMedia(null);
        break;
      case 'episodes':
        setStep('seasons');
        setEpisodes([]);
        setSelectedSeason(null);
        break;
      case 'player':
        if (selectedMedia?.media_type === 'tv') {
          setStep('episodes');
        } else {
          setStep('media');
        }
        setVideoSources(null);
        setDirectUrl(null);
        setSubtitles([]);
        break;
      default:
        onClose();
    }
  };

  const reset = () => {
    setStep('search');
    setQuery('');
    setSearchResults([]);
    setSelectedMedia(null);
    setSeasons([]);
    setSelectedSeason(null);
    setEpisodes([]);
    setSelectedEpisode(null);
    setVideoSources(null);
    setDirectUrl(null);
    setSubtitles([]);
    setLoading(false);
    setError(null);
    setShowErrorModal(false);
    setWatchHistory([]);
  };

  const fetchWatchHistory = async (tmdb_id, media_type) => {
    try {
      const response = await fetch(`/api/watched/${tmdb_id}/${media_type}`);
      const data = await response.json();
      if (!data.error) {
        setWatchHistory(data);
      }
    } catch (err) {
      console.log('Failed to fetch watch history');
    }
  };

  const isEpisodeWatched = (seasonNum, episodeNum) => {
    return watchHistory.some(item => 
      item.season_number === seasonNum && item.episode_number === episodeNum
    );
  };

  const extractSeasonNumber = (seasonTitle) => {
    const match = seasonTitle.match(/Season (\d+)/i) || seasonTitle.match(/S(\d+)/i);
    return match ? parseInt(match[1]) : 1;
  };

  const extractEpisodeNumber = (episodeTitle) => {
    const match = episodeTitle.match(/Episode (\d+)/i) || episodeTitle.match(/E(\d+)/i);
    return match ? parseInt(match[1]) : 1;
  };

  const markAsWatched = async (episode, season, media) => {
    const seasonNumber = extractSeasonNumber(season.title);
    const episodeNumber = extractEpisodeNumber(episode.title);
    
    try {
      await fetch('/api/watched', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdb_id: media.id,
          media_type: media.media_type,
          season_number: seasonNumber,
          episode_number: episodeNumber,
          title: media.title,
          poster_path: media.poster_path
        })
      });
      
      await fetchWatchHistory(media.id, media.media_type);
    } catch (err) {
      console.log('Failed to mark as watched');
    }
  };

  const removeFromWatchHistory = async (episode, season, media) => {
    const seasonNumber = extractSeasonNumber(season.title);
    const episodeNumber = extractEpisodeNumber(episode.title);
    
    try {
      await fetch('/api/watched', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdb_id: media.id,
          media_type: media.media_type,
          season_number: seasonNumber,
          episode_number: episodeNumber
        })
      });
      
      await fetchWatchHistory(media.id, media.media_type);
    } catch (err) {
      console.log('Failed to remove from watch history');
    }
  };

  const markSeasonAsWatched = async (season, media) => {
    const seasonNumber = extractSeasonNumber(season.title);
    
    try {
      await fetch('/api/watched/season', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdb_id: media.id,
          media_type: media.media_type,
          season_number: seasonNumber,
          title: media.title,
          poster_path: media.poster_path,
          episodes: episodes.map(ep => ({
            episode_number: extractEpisodeNumber(ep.title),
            title: ep.title
          }))
        })
      });
      
      await fetchWatchHistory(media.id, media.media_type);
    } catch (err) {
      console.log('Failed to mark season as watched');
    }
  };

  const unmarkSeasonAsWatched = async (season, media) => {
    const seasonNumber = extractSeasonNumber(season.title);
    
    try {
      await fetch('/api/watched/season', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdb_id: media.id,
          media_type: media.media_type,
          season_number: seasonNumber
        })
      });
      
      await fetchWatchHistory(media.id, media.media_type);
    } catch (err) {
      console.log('Failed to unmark season as watched');
    }
  };

  const getSeasonProgress = (season) => {
    const seasonNumber = extractSeasonNumber(season.title);
    const watchedCount = watchHistory.filter(item => item.season_number === seasonNumber).length;
    return { watchedCount, hasWatchedEpisodes: watchedCount > 0 };
  };

  const renderSearchStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold mb-2">Lobster</h3>
        <p className="text-base-content/70">Search for content to watch</p>
      </div>
      
      <div className="form-control">
        <div className="input-group">
          <input
            type="text"
            placeholder="Search movies, TV shows..."
            className="input input-bordered w-full"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
            {loading ? <FaSpinner className="animate-spin" /> : <FaSearch />}
          </button>
        </div>
      </div>
    </div>
  );

  const renderMediaStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-bold">Select Content</h3>
        <p className="text-base-content/70">Choose what you want to watch</p>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
        {searchResults.map((media) => (
          <div
            key={media.id}
            className="card bg-base-200 shadow-xl cursor-pointer hover:shadow-2xl transition-all duration-300 hover:scale-105"
            onClick={() => handleMediaSelect(media)}
          >
            <figure className="aspect-[2/3]">
              <img
                src={media.image_url || media.poster_path || '/placeholder-poster.svg'}
                alt={media.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = '/placeholder-poster.svg';
                }}
              />
            </figure>
            <div className="card-body p-3">
              <h4 className="card-title text-sm leading-tight">{media.title}</h4>
              <div className="badge badge-primary badge-sm">
                {media.media_type === 'movie' ? 'Movie' : 'TV'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSeasonsStep = () => {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-bold">{selectedMedia?.title}</h3>
          <p className="text-base-content/70">Select a season</p>
        </div>
        
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {seasons.map((season) => {
            const { watchedCount, hasWatchedEpisodes } = getSeasonProgress(season);
            
            return (
              <div
                key={season.id}
                className={`card bg-base-200 shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 ${
                  hasWatchedEpisodes ? 'ring-2 ring-success' : ''
                }`}
              >
                <div className="card-body p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1" onClick={() => handleSeasonSelect(season)}>
                      <h4 className="font-bold">{season.title}</h4>
                      {hasWatchedEpisodes && (
                        <p className="text-success text-sm flex items-center gap-1">
                          <FaCheck className="w-3 h-3" />
                          {watchedCount} episodes watched
                        </p>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      {hasWatchedEpisodes ? (
                        <button
                          className="btn btn-sm btn-outline btn-warning"
                          onClick={(e) => {
                            e.stopPropagation();
                            unmarkSeasonAsWatched(season, selectedMedia);
                          }}
                        >
                          <FaEyeSlash className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm btn-outline btn-success"
                          onClick={(e) => {
                            e.stopPropagation();
                            markSeasonAsWatched(season, selectedMedia);
                          }}
                        >
                          <FaEye className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderEpisodesStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-bold">{selectedSeason?.title}</h3>
        <p className="text-base-content/70">Select an episode</p>
      </div>
      
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {episodes.map((episode) => {
          const seasonNumber = extractSeasonNumber(selectedSeason.title);
          const episodeNumber = extractEpisodeNumber(episode.title);
          const isWatched = isEpisodeWatched(seasonNumber, episodeNumber);
          
          return (
            <div
              key={episode.data_id}
              className={`card bg-base-200 shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 ${
                isWatched ? 'ring-2 ring-success' : ''
              }`}
            >
              <div className="card-body p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1" onClick={() => handleEpisodeSelect(episode)}>
                    <h4 className="font-bold flex items-center gap-2">
                      {episode.title}
                      {isWatched && <FaCheck className="text-success w-4 h-4" />}
                    </h4>
                  </div>
                  
                  <button
                    className={`btn btn-sm ${isWatched ? 'btn-warning' : 'btn-success'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isWatched) {
                        removeFromWatchHistory(episode, selectedSeason, selectedMedia);
                      } else {
                        markAsWatched(episode, selectedSeason, selectedMedia);
                      }
                    }}
                  >
                    {isWatched ? <FaEyeSlash className="w-3 h-3" /> : <FaEye className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderPlayerStep = () => {
    if (!directUrl) return null;

    // Get preferred subtitle language from settings (default to english)
    const preferredLanguage = settings?.lobster_language || 'english';
    
    // Find the subtitle track that matches the preferred language
    const getDefaultSubtitleIndex = () => {
      if (!subtitles?.length) return -1;
      
      const matchIndex = subtitles.findIndex(sub => {
        const subLang = sub.lang?.toLowerCase() || sub.label?.toLowerCase() || '';
        return subLang.includes(preferredLanguage.toLowerCase());
      });
      
      // If preferred language found, use it; otherwise use first subtitle
      return matchIndex >= 0 ? matchIndex : 0;
    };
    
    const defaultSubIndex = getDefaultSubtitleIndex();

    const displayTitle = selectedEpisode 
      ? `${selectedMedia?.title} - ${selectedSeason?.title} - ${selectedEpisode.title}` 
      : selectedMedia?.title;

    // Check if this is a problematic domain
    const urlDomain = new URL(directUrl).hostname;
    const problematicDomains = ['dewflare', 'cloudveil', 'breezefall', 'frostblink'];
    const isProblematicDomain = problematicDomains.some(domain => urlDomain.includes(domain));

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-bold">{displayTitle}</h3>
          <p className="text-base-content/70">🦞 Direct URL Extracted (lobster.sh method)</p>
        </div>
        
        {/* URL Display and Copy Options */}
        <div className="bg-gray-800 p-4 rounded-lg space-y-3">
          <div className="text-sm text-gray-300 break-all">
            <strong>Direct URL:</strong> {directUrl}
          </div>
          {isProblematicDomain && (
            <div className="bg-orange-900 bg-opacity-50 p-3 rounded border border-orange-500">
              <div className="text-orange-200 text-sm">
                <strong>⚠️ Protected Domain:</strong> {urlDomain}
                <br />Browser playback not supported. Use external player instead.
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(directUrl)}
              className="btn btn-sm btn-primary"
            >
              📋 Copy URL
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(`mpv "${directUrl}"`)}
              className="btn btn-sm btn-success"
            >
              🎬 Copy mpv Command
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(`vlc "${directUrl}"`)}
              className="btn btn-sm btn-info"
            >
              🦾 Copy VLC Command
            </button>
            {!isProblematicDomain && (
              <button
                onClick={async () => {
                  try {
                    const proxiedUrl = `/api/media-proxy?url=${encodeURIComponent(directUrl)}`;
                    await playDirectUrl(proxiedUrl, subtitles);
                    toast.success('Started browser playback!');
                  } catch (err) {
                    console.log('Proxied playback failed, trying direct:', err);
                    try {
                      await playDirectUrl(directUrl, subtitles);
                      toast.success('Started direct browser playback!');
                    } catch (directErr) {
                      toast.error('Browser playback failed - Try mpv/VLC instead');
                    }
                  }
                }}
                className="btn btn-sm btn-warning"
              >
                🌐 Try Browser Player
              </button>
            )}
          </div>
          <div className="text-xs text-gray-400">
            {isProblematicDomain 
              ? "💡 This domain requires external players like mpv or VLC"
              : "💡 Browser player available! Or use mpv/VLC for best experience"
            }
          </div>
        </div>
        
        <div className="bg-black rounded-lg overflow-hidden aspect-video">
          <UnifiedPlayer directUrl={directUrl} subtitles={subtitles} title={displayTitle} />
        </div>

        {subtitles?.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold">Available Subtitles ({subtitles.length}):</h4>
            <div className="flex flex-wrap gap-2">
              {subtitles.map((sub, index) => (
                <div 
                  key={index} 
                  className={`badge ${index === defaultSubIndex ? 'badge-primary' : 'badge-outline'}`}
                >
                  {sub.label || sub.lang || `Subtitle ${index + 1}`}
                  {index === defaultSubIndex && ' (Default)'}
                </div>
              ))}
            </div>
            <p className="text-sm text-base-content/60">
              💡 Default subtitle language: <span className="font-medium capitalize">{preferredLanguage}</span> (from settings)
            </p>
          </div>
        )}
        
        {/* Instructions Panel */}
        <div className={`p-4 rounded-lg border ${isProblematicDomain 
          ? 'bg-orange-900 bg-opacity-30 border-orange-500' 
          : 'bg-blue-900 bg-opacity-30 border-blue-500'
        }`}>
          <h4 className={`font-semibold mb-2 ${isProblematicDomain ? 'text-orange-200' : 'text-blue-200'}`}>
            🎯 Direct URL Extracted Successfully!
          </h4>
          <div className={`text-sm space-y-1 ${isProblematicDomain ? 'text-orange-100' : 'text-blue-100'}`}>
            {isProblematicDomain ? (
              <>
                <p>• <strong>Protected Domain:</strong> {urlDomain} uses advanced protection</p>
                <p>• <strong>Browser Playback:</strong> Not supported due to security measures</p>
                <p>• <strong>Solution:</strong> Use the mpv or VLC copy buttons above</p>
                <p>• <strong>Works perfectly:</strong> External players handle all bypass logic</p>
              </>
            ) : (
              <>
                <p>• <strong>Browser Player:</strong> Available with CORS proxy support</p>
                <p>• <strong>External Players:</strong> mpv/VLC for best performance</p>
                <p>• <strong>Direct URL:</strong> No more complex proxy chains needed</p>
                <p>• <strong>Clean & Simple:</strong> Just like lobster.sh but in a web UI</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 🎯 NEW: Extract direct URLs like lobster.sh does
  const extractDirectUrl = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🦞 Extracting direct URL like lobster.sh...');
      
      const response = await fetch('/api/lobster/extract-direct-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          media_id: selectedMedia.id,
          media_type: selectedMedia.media_type,
          data_id: selectedMedia.data_id,
          provider: 'Vidcloud',
          quality: '1080'
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Direct URL extracted:', data.video_url);
        setDirectUrl(data.video_url);
        setSubtitles(data.subtitles || []);
        
        // Start playing immediately
        await playDirectUrl(data.video_url, data.subtitles);
      } else {
        throw new Error(data.error || 'Failed to extract video URL');
      }
    } catch (err) {
      console.error('❌ Direct URL extraction failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 🎬 Play the direct URL (no proxying!)
  const playDirectUrl = async (videoUrl, subs = []) => {
    if (!videoRef.current) return;

    try {
      // Clean up previous HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      console.log('🎬 Loading direct video URL:', videoUrl);

      if (Hls.isSupported()) {
        const hls = new Hls({
          debug: true,
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90
        });

        hlsRef.current = hls;

        // Enhanced error handling
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('❌ HLS Error:', data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('🔄 Network error, trying to recover...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('🔄 Media error, trying to recover...');
                hls.recoverMediaError();
                break;
              default:
                setError(`HLS Error: ${data.details}`);
                hls.destroy();
                break;
            }
          }
        });

        hls.on(Hls.Events.MANIFEST_LOADED, () => {
          console.log('✅ HLS manifest loaded successfully');
        });

        hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
          console.log(`📊 Level loaded: ${data.details.totalduration}s`);
        });

        // Load the direct URL
        hls.loadSource(videoUrl);
        hls.attachMedia(videoRef.current);

        // Auto-play when ready
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('🎯 Starting playback...');
          videoRef.current.play().catch(e => {
            console.log('⚠️ Autoplay blocked, user interaction required');
          });
        });

      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        console.log('🍎 Using native HLS support');
        videoRef.current.src = videoUrl;
        videoRef.current.addEventListener('loadedmetadata', () => {
          videoRef.current.play().catch(e => {
            console.log('⚠️ Autoplay blocked, user interaction required');
          });
        });
      } else {
        throw new Error('HLS not supported in this browser');
      }

      // Add subtitles if available
      if (subs.length > 0) {
        console.log(`📝 Adding ${subs.length} subtitle tracks`);
        // Note: You might want to add subtitle tracks here
      }

    } catch (err) {
      console.error('❌ Playback error:', err);
      setError(err.message);
    }
  };



  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
              <div className="bg-base-100 rounded-box shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-base-300">
          <div className="flex items-center gap-3">
            {step !== 'search' && (
              <button 
                className="btn btn-ghost btn-circle"
                onClick={handleBack}
              >
                <FaArrowLeft />
              </button>
            )}
            <div>
              <h2 className="text-xl font-bold">Lobster Layer</h2>
              <p className="text-sm text-base-content/70 capitalize">{step} Step</p>
            </div>
          </div>
          
          <button 
            className="btn btn-ghost btn-circle"
            onClick={onClose}
          >
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-hidden">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <FaSpinner className="animate-spin text-4xl text-primary" />
              <p className="text-lg">Loading amazing content...</p>
            </div>
          )}

          {!loading && !showErrorModal && (
            <>
              {step === 'search' && renderSearchStep()}
              {step === 'media' && renderMediaStep()}
              {step === 'seasons' && renderSeasonsStep()}
              {step === 'episodes' && renderEpisodesStep()}
              {step === 'player' && renderPlayerStep()}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-base-300">
          <button 
            onClick={reset} 
            className="btn btn-outline btn-sm"
          >
            🔄 Start Over
          </button>
          
          <div className="text-sm text-base-content/70">
            Step {step === 'search' ? '1' : step === 'media' ? '2' : step === 'seasons' ? '3' : step === 'episodes' ? '4' : '5'} of 5
          </div>
        </div>
      </div>

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-base-100 rounded-box shadow-2xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-error/20 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-error">Error</h3>
                  <p className="text-sm text-base-content/70">Something went wrong</p>
                </div>
              </div>
              
              <p className="text-base-content mb-6">
                {error}
              </p>
              
              <div className="flex gap-3 justify-end">
                <button 
                  className="btn btn-ghost"
                  onClick={() => setShowErrorModal(false)}
                >
                  Close
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    setShowErrorModal(false);
                    setError(null);
                  }}
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LobsterPlayer; 