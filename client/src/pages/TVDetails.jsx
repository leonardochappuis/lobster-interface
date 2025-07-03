import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import MediaCard from '../components/MediaCard';
import { FaPlay, FaHeart, FaStar, FaPlus, FaList, FaYoutube, FaTimes, FaSpinner, FaTv, FaCalendar, FaEye, FaEyeSlash, FaCheck, FaClock, FaFilm, FaArrowLeft } from 'react-icons/fa';
import ErrorModal from '../components/ErrorModal';
import Hls from 'hls.js';
import SubtitleHandler from '../components/SubtitleHandler';

const TVDetails = ({ onWatch }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showListModal, setShowListModal] = useState(false);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [showCreateListModal, setShowCreateListModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  
  // TV-specific states
  const [showSeasons, setShowSeasons] = useState(false);
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(false);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [watchHistory, setWatchHistory] = useState([]);
  
  // Integrated Lobster search states
  const [showLobsterSearch, setShowLobsterSearch] = useState(true);
  const [lobsterStep, setLobsterStep] = useState('search'); // search, select, seasons, episodes, play
  const [lobsterQuery, setLobsterQuery] = useState('');
  const [lobsterResults, setLobsterResults] = useState([]);
  const [selectedLobsterMedia, setSelectedLobsterMedia] = useState(null);
  const [lobsterSeasons, setLobsterSeasons] = useState([]);
  const [selectedLobsterSeason, setSelectedLobsterSeason] = useState(null);
  const [lobsterEpisodes, setLobsterEpisodes] = useState([]);
  const [selectedLobsterEpisode, setSelectedLobsterEpisode] = useState(null);
  const [lobsterLoading, setLobsterLoading] = useState(false);
  const [lobsterError, setLobsterError] = useState(null);
  const [watchHistoryVersion, setWatchHistoryVersion] = useState(0); // Force re-renders
  const [autoStarted, setAutoStarted] = useState(false);
  
  // Video player refs
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // Fetch user settings for subtitle preferences
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => axios.get('/api/settings').then(res => res.data),
    refetchOnWindowFocus: false
  });

  // Fetch TV show details
  const { data: tvShow, isLoading, error } = useQuery({
    queryKey: ['tv', id],
    queryFn: () => axios.get(`/api/tv/${id}`).then(res => res.data),
    refetchOnWindowFocus: false
  });

  // Fetch recommendations
  const { data: recommendations } = useQuery({
    queryKey: ['tv-recommendations', id],
    queryFn: () => axios.get(`/api/tv/${id}/recommendations`).then(res => res.data),
    enabled: !!tvShow,
    refetchOnWindowFocus: false
  });

  // Fetch videos/trailers
  const { data: videos } = useQuery({
    queryKey: ['tv-videos', id],
    queryFn: () => axios.get(`/api/tv/${id}/videos`).then(res => res.data),
    enabled: !!tvShow,
    refetchOnWindowFocus: false
  });

  // Check if favorited
  const { data: favoriteStatus } = useQuery({
    queryKey: ['favorite-status', id, 'tv'],
    queryFn: () => axios.get(`/api/favorites/${id}/tv`).then(res => res.data),
    enabled: !!tvShow,
    refetchOnWindowFocus: false
  });

  // Fetch user lists
  const { data: lists } = useQuery({
    queryKey: ['lists'],
    queryFn: () => axios.get('/api/lists').then(res => res.data),
    refetchOnWindowFocus: false
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: () => {
      if (favoriteStatus?.isFavorited) {
        return axios.delete(`/api/favorites/${id}/tv`);
      } else {
        return axios.post('/api/favorites', {
          tmdb_id: tvShow.id,
          media_type: 'tv',
          title: tvShow.title,
          poster_path: tvShow.poster_path,
          backdrop_path: tvShow.backdrop_path,
          overview: tvShow.overview,
          release_date: tvShow.release_date,
          vote_average: tvShow.vote_average,
          vote_count: tvShow.vote_count,
          genres: tvShow.genres
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-status', id, 'tv'] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      toast.success(
        favoriteStatus?.isFavorited 
          ? 'Removed from favorites' 
          : 'Added to favorites'
      );
    },
    onError: () => {
      toast.error('Failed to update favorites');
    }
  });

  // Add to list mutation
  const addToListMutation = useMutation({
    mutationFn: (listId) => axios.post(`/api/lists/${listId}/items`, {
      tmdb_id: tvShow.id,
      media_type: 'tv',
      title: tvShow.title,
      poster_path: tvShow.poster_path,
      backdrop_path: tvShow.backdrop_path,
      overview: tvShow.overview,
      release_date: tvShow.release_date,
      vote_average: tvShow.vote_average,
      vote_count: tvShow.vote_count,
      genres: tvShow.genres
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      setShowListModal(false);
      toast.success('Added to list');
    },
    onError: () => {
      toast.error('Failed to add to list');
    }
  });

  // Create new list mutation
  const createListMutation = useMutation({
    mutationFn: ({ name, description }) => axios.post('/api/lists', { name, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      setShowCreateListModal(false);
      setNewListName('');
      setNewListDescription('');
      toast.success('List created successfully');
    },
    onError: () => {
      toast.error('Failed to create list');
    }
  });

  // Watch TV show handler - use integrated search
  const handleWatch = () => {
    if (!tvShow) return;
    
    // Create search title and start integrated search
    const searchTitle = `${tvShow.title} ${tvShow.release_date ? new Date(tvShow.release_date).getFullYear() : ''}`.trim();
    setLobsterQuery(searchTitle);
    setShowLobsterSearch(true);
    setLobsterStep('search');
    
    // Auto-start search
    setTimeout(() => {
      handleLobsterSearch(searchTitle);
    }, 100);
  };

  const formatReleaseDate = (date) => {
    if (!date) return '';
    return new Date(date).getFullYear();
  };

  const formatSeasons = (count) => {
    if (!count) return '';
    return count === 1 ? '1 Season' : `${count} Seasons`;
  };

  const formatEpisodes = (count) => {
    if (!count) return '';
    return count === 1 ? '1 Episode' : `${count} Episodes`;
  };

  // Get trailer video key
  const getTrailerKey = () => {
    if (!videos?.results) return null;
    
    // Find the first trailer or teaser
    const trailer = videos.results.find(video => 
      video.type === 'Trailer' && video.site === 'YouTube'
    ) || videos.results.find(video => 
      video.type === 'Teaser' && video.site === 'YouTube'
    );
    
    return trailer ? trailer.key : null;
  };

  const handleWatchTrailer = () => {
    const trailerKey = getTrailerKey();
    if (trailerKey) {
      setShowTrailerModal(true);
    }
  };

  const handleGenreClick = (genre) => {
    navigate(`/search?genre=${encodeURIComponent(genre)}`);
  };

  // Show error modal if there's an error
  React.useEffect(() => {
    if (error || (!isLoading && !tvShow)) {
      setShowErrorModal(true);
    }
  }, [error, isLoading, tvShow]);



  // Fetch watch history when TV show changes
  useEffect(() => {
    if (tvShow) {
      fetchWatchHistory(tvShow.id, 'tv');
    }
  }, [tvShow]);

  // Video player effect for web playback
  useEffect(() => {
    if (lobsterStep === 'play' && selectedLobsterEpisode?.video_url && videoRef.current) {
      const videoUrl = selectedLobsterEpisode.video_url;
      
      console.log('🎬 TVDetails: Loading video URL:', videoUrl);
      
      // Clean up previous HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const video = videoRef.current;
      
      // For direct video URLs (not HLS), set source directly
      if (videoUrl.includes('.mp4') || videoUrl.includes('.mkv') || videoUrl.includes('.avi')) {
        video.src = videoUrl;
        video.play().catch(err => console.log('Direct video play failed:', err));
      } else if (Hls.isSupported()) {
        // For HLS streams
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
          debug: true
        });
        
        hlsRef.current = hls;
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('✅ HLS manifest parsed');
          video.play().catch(err => console.log('HLS play failed:', err));
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('❌ HLS error:', data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('🔄 Retrying network error...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('🔄 Recovering media error...');
                hls.recoverMediaError();
                break;
              default:
                console.log('💥 Fatal HLS error, destroying...');
                hls.destroy();
                toast.error('Video playback failed. Try using mpv/VLC instead.');
                break;
            }
          }
        });
        
        hls.attachMedia(video);
        hls.loadSource(videoUrl);
        
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = videoUrl;
      } else {
        // Fallback to direct video
        video.src = videoUrl;
      }
    }
    
    // Cleanup when step changes away from play
    if (lobsterStep !== 'play' && hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, [lobsterStep, selectedLobsterEpisode]);

  // Cleanup HLS when component unmounts
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  // Reset TV-specific state when switching to a different TV show
  useEffect(() => {
    // Reset all TV show specific state when ID changes
    setShowSeasons(false);
    setSeasons([]);
    setSelectedSeason(null);
    setEpisodes([]);
    setWatchHistory([]);
    setIsLoadingSeasons(false);
    setIsLoadingEpisodes(false);
    resetLobsterSearch();
  }, [id]); // Reset when TV show ID changes

  // Fetch seasons for TV show
  const fetchSeasons = async () => {
    if (!tvShow) return;
    
    setIsLoadingSeasons(true);
    try {
      // Search for TV show in lobster
      const searchResponse = await fetch(`/api/lobster/search/${encodeURIComponent(tvShow.title)}`);
      const searchData = await searchResponse.json();
      
      if (searchData.error || !searchData.results?.length) {
        toast.error('TV show not found in Lobster');
        setIsLoadingSeasons(false);
        return;
      }
      
      // Find TV show match
      const tvMatch = searchData.results.find(result => 
        result.media_type === 'tv' && 
        result.title.toLowerCase() === tvShow.title.toLowerCase()
      ) || searchData.results.find(result => result.media_type === 'tv');
      
      if (!tvMatch) {
        toast.error('TV show not available in Lobster');
        setIsLoadingSeasons(false);
        return;
      }
      
      // Get seasons
      const seasonsResponse = await fetch(`/api/lobster/seasons/${tvMatch.id}`);
      const seasonsData = await seasonsResponse.json();
      
      if (seasonsData.error) {
        toast.error(`Failed to load seasons: ${seasonsData.error}`);
        setIsLoadingSeasons(false);
        return;
      }
      
      setSeasons(seasonsData.seasons || []);
      setShowSeasons(true);
      toast.success('Seasons loaded successfully');
      
    } catch (error) {
      console.error('Seasons fetch error:', error);
      toast.error('Failed to load seasons');
    } finally {
      setIsLoadingSeasons(false);
    }
  };

  // Fetch episodes for a season
  const fetchEpisodes = async (season) => {
    setSelectedSeason(season);
    setIsLoadingEpisodes(true);
    
    try {
      const response = await fetch(`/api/lobster/episodes/${season.id}`);
      const data = await response.json();
      
      if (data.error) {
        toast.error(`Failed to load episodes: ${data.error}`);
        setIsLoadingEpisodes(false);
        return;
      }
      
      setEpisodes(data.episodes || []);
      
    } catch (error) {
      console.error('Episodes fetch error:', error);
      toast.error('Failed to load episodes');
    } finally {
      setIsLoadingEpisodes(false);
    }
  };

  // Watch episode - use integrated search
  const handleWatchEpisode = async (episode, season) => {
    console.log('🔍 handleWatchEpisode called:', episode.title, season.title);
    
    // Validate that we have the required IDs
    const episodeId = getEpisodeId(episode);
    if (!episodeId) {
      toast.error('Invalid episode data - missing episode ID');
      return;
    }
    
    if (!season?.id) {
      toast.error('Invalid season data - missing season ID');
      return;
    }
    
    // Mark as watched first
    try {
      await markAsWatched(episode, season, tvShow);
    } catch (err) {
      console.error('Failed to mark as watched:', err);
    }
    
    // Create search title and start integrated search
    const searchTitle = `${tvShow.title} S${extractSeasonNumber(season.title)}E${extractEpisodeNumber(episode.title)}`;
    console.log('🔍 Setting search title:', searchTitle);
    console.log('🔍 Setting showLobsterSearch to true');
    
    setLobsterQuery(searchTitle);
    setShowLobsterSearch(true);
    setLobsterStep('search');
    
    // Auto-start search
    setTimeout(() => {
      console.log('🔍 Auto-starting search for:', searchTitle);
      handleLobsterSearch(searchTitle);
    }, 100);
  };

  // Fetch watch history
  const fetchWatchHistory = async (tmdb_id, media_type) => {
    try {
      console.log('🔍 Fetching watch history for:', tmdb_id, media_type);
      const response = await fetch(`/api/watched/${tmdb_id}/${media_type}`);
      const data = await response.json();
      console.log('📺 Watch history data:', data);
      setWatchHistory(data.episodes || []);
      setWatchHistoryVersion(prev => prev + 1); // Force re-render
    } catch (error) {
      console.error('Failed to fetch watch history:', error);
    }
  };

  // Check if episode is watched
  const isEpisodeWatched = (seasonNum, episodeNum) => {
    const watched = watchHistory.some(entry => 
      entry.season_number === seasonNum && entry.episode_number === episodeNum
    );
    console.log('👁️ Checking if episode is watched:', { seasonNum, episodeNum, watched, watchHistory });
    return watched;
  };

  // Add debugging to markAsWatched
  const markAsWatched = async (episode, season, media) => {
    try {
      const seasonNum = extractSeasonNumber(season.title);
      const episodeNum = extractEpisodeNumber(episode.title);
      
      console.log('✅ Marking as watched:', { seasonNum, episodeNum, media: media.title });
      
      const response = await fetch('/api/watched', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdb_id: media.id,
          media_type: 'tv',
          season_number: seasonNum,
          episode_number: episodeNum,
          title: media.title,
          season_title: season.title,
          episode_title: episode.title
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      console.log('✅ Successfully marked as watched');
      
      // Refresh watch history and force re-render
      await fetchWatchHistory(media.id, 'tv');
      
    } catch (error) {
      console.error('Failed to mark as watched:', error);
      toast.error('Failed to mark episode as watched');
    }
  };

  // Add debugging to removeFromWatchHistory
  const removeFromWatchHistory = async (episode, season, media) => {
    try {
      const seasonNum = extractSeasonNumber(season.title);
      const episodeNum = extractEpisodeNumber(episode.title);
      
      console.log('❌ Removing from watch history:', { seasonNum, episodeNum, media: media.title });
      
      const response = await fetch('/api/watched', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdb_id: media.id,
          media_type: 'tv',
          season_number: seasonNum,
          episode_number: episodeNum
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      console.log('❌ Successfully removed from watch history');
      
      // Refresh watch history and force re-render
      await fetchWatchHistory(media.id, 'tv');
      toast.success('Removed from watched');
      
    } catch (error) {
      console.error('Failed to remove from watch history:', error);
      toast.error('Failed to remove from watch history');
    }
  };

  // Extract season number from title
  const extractSeasonNumber = (seasonTitle) => {
    const match = seasonTitle.match(/Season (\d+)/i);
    return match ? parseInt(match[1]) : 1;
  };

  // Extract episode number from title
  const extractEpisodeNumber = (episodeTitle) => {
    const match = episodeTitle.match(/Episode (\d+)/i);
    return match ? parseInt(match[1]) : 1;
  };

  // Helper function to get episode ID - check multiple possible fields
  const getEpisodeId = (episode) => {
    return episode?.data_id || episode?.id || episode?.episode_id || episode?.lobster_id || episode?.tmdb_id || null;
  };

  // Helper function to check if episode has valid ID
  const isValidEpisode = (episode) => {
    return getEpisodeId(episode) !== null;
  };

  // Integrated Lobster search functions
  const handleLobsterSearch = async (searchTitle = lobsterQuery) => {
    if (!searchTitle.trim()) return;
    
    setLobsterLoading(true);
    setLobsterError(null);
    
    try {
      const response = await fetch(`/api/lobster/search/${encodeURIComponent(searchTitle)}`);
      const data = await response.json();
      
      if (data.error) {
        setLobsterError(data.error);
      } else {
        setLobsterResults(data.results || []);
        if (data.results?.length > 0) {
          setLobsterStep('select');
        } else {
          setLobsterError('No results found');
        }
      }
    } catch (err) {
      setLobsterError('Search failed');
    } finally {
      setLobsterLoading(false);
    }
  };

  const handleLobsterMediaSelect = async (media) => {
    setSelectedLobsterMedia(media);
    setLobsterLoading(true);
    setLobsterError(null);

    if (media.media_type === 'tv') {
      try {
        const response = await fetch(`/api/lobster/seasons/${media.id}`);
        const data = await response.json();

        if (data.error) {
          setLobsterError(data.error);
        } else {
          setLobsterSeasons(data.seasons || []);
          setLobsterStep('seasons');
        }
      } catch (err) {
        setLobsterError('Failed to load seasons');
      } finally {
        setLobsterLoading(false);
      }
      return;
    }

    // For movies (or other types), extract URL directly
    try {
      const response = await fetch('/api/lobster/extract-direct-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_id: media.id,
          media_type: media.media_type,
          provider: 'Vidcloud',
          quality: '1080',
          subtitle_language: settings?.subtitle_language || 'english'
        })
      });
      const data = await response.json();
      if (data.success) {
        setLobsterStep('play');
        const command = `mpv "${data.video_url}"`;
        navigator.clipboard.writeText(command).then(() => {
          toast.success('Movie URL copied to clipboard!');
        });
      } else {
        setLobsterError(data.error || 'Failed to extract video URL');
      }
    } catch (err) {
      setLobsterError('Failed to load movie');
    } finally {
      setLobsterLoading(false);
    }
  };

  const handleLobsterSeasonSelect = async (season) => {
    setSelectedLobsterSeason(season);
    setLobsterLoading(true);
    setLobsterError(null);
    
    try {
      const response = await fetch(`/api/lobster/episodes/${season.id}`);
      const data = await response.json();
      
      if (data.error) {
        setLobsterError(data.error);
      } else {
        setLobsterEpisodes(data.episodes || []);
        setLobsterStep('episodes');
      }
    } catch (err) {
      setLobsterError('Failed to load episodes');
    } finally {
      setLobsterLoading(false);
    }
  };

  const handleLobsterEpisodeSelect = async (episode) => {
    setSelectedLobsterEpisode(episode);
    setLobsterLoading(true);
    setLobsterError(null);
    
    try {
      const response = await fetch('/api/lobster/extract-direct-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_id: selectedLobsterMedia.id,
          media_type: 'tv',
          data_id: episode.data_id,
          provider: 'Vidcloud',
          quality: '1080',
          subtitle_language: settings?.subtitle_language || 'english'
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Store the video URL and show web player
        setSelectedLobsterEpisode({
          ...episode,
          video_url: data.video_url,
          subtitles: data.subtitles || []
        });
        setLobsterStep('play');
        toast.success('Episode loaded successfully!');
      } else {
        setLobsterError(data.error || 'Failed to extract video URL');
      }
    } catch (err) {
      setLobsterError('Failed to load episode');
    } finally {
      setLobsterLoading(false);
    }
  };

  const resetLobsterSearch = () => {
    setShowLobsterSearch(true);
    setLobsterStep('search');
    setLobsterQuery('');
    setLobsterResults([]);
    setSelectedLobsterMedia(null);
    setLobsterSeasons([]);
    setSelectedLobsterSeason(null);
    setLobsterEpisodes([]);
    setSelectedLobsterEpisode(null);
    setLobsterLoading(false);
    setLobsterError(null);
  };

  useEffect(() => {
    if (tvShow && !autoStarted) {
      handleWatch();
      setAutoStarted(true);
    }
  }, [tvShow, autoStarted]);

  // Add debugging to toggleEpisodeWatched
  const toggleEpisodeWatched = async (episode, season) => {
    console.log('🔄 Toggling episode watched status:', { episode, season });
    const watched = isEpisodeWatched(extractSeasonNumber(season.title), extractEpisodeNumber(episode.title));
    console.log('👁️ Current watched status:', watched);
    
    if (watched) {
      await removeFromWatchHistory(episode, season, tvShow);
    } else {
      await markAsWatched(episode, season, tvShow);
    }
    // Invalidate watch history queries to refresh UI
    queryClient.invalidateQueries({ queryKey: ['watch-history'] });
  };

  // Add season toggle function
  const toggleSeasonWatched = async (season) => {
    const seasonNum = extractSeasonNumber(season.title);
    
    try {
      // Fetch episodes for this season
      const response = await fetch(`/api/lobster/episodes/${season.id}`);
      const data = await response.json();
      const episodes = data.episodes || [];
      
      // Check if all episodes are watched
      const allWatched = episodes.every(episode => 
        isEpisodeWatched(seasonNum, extractEpisodeNumber(episode.title))
      );
      
      if (allWatched) {
        // Mark all episodes as unwatched
        for (const episode of episodes) {
          await removeFromWatchHistory(episode, season, tvShow);
        }
      } else {
        // Mark all episodes as watched
        for (const episode of episodes) {
          await markAsWatched(episode, season, tvShow);
        }
      }
      
      // Invalidate watch history queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['watch-history'] });
    } catch (error) {
      console.error('Error toggling season watched status:', error);
      toast.error('Failed to update season watched status');
    }
  };

  // Fix the isSeasonWatched function to check actual episode data
  const isSeasonWatched = (season) => {
    const seasonNum = extractSeasonNumber(season.title);
    
    // If we have episodes loaded for this season, check if all are watched
    if (selectedLobsterSeason && selectedLobsterSeason.id === season.id && lobsterEpisodes.length > 0) {
      const allWatched = lobsterEpisodes.every(episode => 
        isEpisodeWatched(seasonNum, extractEpisodeNumber(episode.title))
      );
      console.log('👁️ Season watched check:', { season: season.title, allWatched, episodeCount: lobsterEpisodes.length });
      return allWatched;
    }
    
    // If we don't have episode data loaded, check if any episodes are watched
    const anyWatched = watchHistory.some(entry => 
      entry.season_number === seasonNum
    );
    console.log('👁️ Season watched check (fallback):', { season: season.title, anyWatched });
    return anyWatched;
  };

  // Add navigation functions
  const goBack = () => {
    if (lobsterStep === 'episodes') {
      setLobsterStep('seasons');
      setSelectedLobsterEpisode(null);
      setLobsterEpisodes([]);
    } else if (lobsterStep === 'seasons') {
      setLobsterStep('select');
      setSelectedLobsterSeason(null);
      setLobsterSeasons([]);
    } else if (lobsterStep === 'select') {
      setLobsterStep('search');
      setSelectedLobsterMedia(null);
      setLobsterResults([]);
    } else if (lobsterStep === 'play') {
      setLobsterStep('episodes');
      setSelectedLobsterEpisode(null);
    }
  };

  const handleStepClick = (step) => {
    // Only allow going back, not forward
    if (step === 'search' && lobsterStep !== 'search') {
      resetLobsterSearch();
    } else if (step === 'select' && ['seasons', 'episodes', 'play'].includes(lobsterStep)) {
      setLobsterStep('select');
      setSelectedLobsterSeason(null);
      setLobsterSeasons([]);
      setSelectedLobsterEpisode(null);
      setLobsterEpisodes([]);
    } else if (step === 'seasons' && ['episodes', 'play'].includes(lobsterStep)) {
      setLobsterStep('seasons');
      setSelectedLobsterEpisode(null);
      setLobsterEpisodes([]);
    } else if (step === 'episodes' && lobsterStep === 'play') {
      setLobsterStep('episodes');
      setSelectedLobsterEpisode(null);
    }
  };

  // Add useEffect to refresh season status when episodes are loaded
  useEffect(() => {
    if (lobsterEpisodes.length > 0 && selectedLobsterSeason) {
      // Force re-render to update season watched status
      setWatchHistoryVersion(prev => prev + 1);
    }
  }, [lobsterEpisodes, selectedLobsterSeason]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
        <FaSpinner className="animate-spin text-4xl text-primary" />
        <p className="text-lg text-base-content/70">Loading TV show details...</p>
      </div>
    );
  }

  // If error and no TV show data, show minimal UI with error modal
  if (error && !tvShow) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
        <p className="text-lg text-base-content/70">Unable to load TV show details</p>
        <ErrorModal 
          isOpen={showErrorModal}
          onClose={() => {
            setShowErrorModal(false);
            navigate('/');
          }}
          title="Failed to Load TV Show"
          message="Failed to load TV show details. Please try again or go back to browse other content."
          onRetry={() => {
            setShowErrorModal(false);
            window.location.reload();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative min-h-[80vh] flex items-center justify-center overflow-hidden rounded-box bg-gradient-to-br from-primary/20 to-secondary/20 mb-12">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${tvShow.backdrop_path})`
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 text-white w-full">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 bg-primary/20 backdrop-blur-sm border border-primary/30 rounded-full px-4 py-2 text-sm font-medium">
                <FaTv className="text-primary" />
                TV Show
              </div>
              
              <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                {tvShow.title}
              </h1>
              
              {/* TV Show Meta Information */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                {tvShow.release_date && (
                  <div className="flex items-center gap-1">
                    <FaCalendar className="text-primary" />
                    <span>{formatReleaseDate(tvShow.release_date)}</span>
                  </div>
                )}
                {tvShow.number_of_seasons && (
                  <div className="flex items-center gap-1">
                    <FaTv className="text-primary" />
                    <span>{formatSeasons(tvShow.number_of_seasons)}</span>
                  </div>
                )}
                {tvShow.number_of_episodes && (
                  <div className="flex items-center gap-1">
                    <FaTv className="text-secondary" />
                    <span>{formatEpisodes(tvShow.number_of_episodes)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <FaStar className="text-yellow-400" />
                  <span className="font-semibold">{tvShow.vote_average?.toFixed(1)}</span>
                  <span className="text-white/70">({tvShow.vote_count?.toLocaleString()} votes)</span>
                </div>
              </div>

              <p className="text-lg text-white/90 leading-relaxed max-w-xl">
                {tvShow.overview?.substring(0, 300)}
              </p>

              {/* Genres */}
              {tvShow.genres && (
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(tvShow.genres) 
                    ? tvShow.genres.slice(0, 4).map(g => g.name || g) 
                    : tvShow.genres.split(', ').slice(0, 4)
                  ).map((genre, index) => (
                    <button 
                      key={`genre-${genre}-${index}`}
                      className="badge badge-primary badge-lg cursor-pointer hover:badge-secondary transition-colors"
                      onClick={() => handleGenreClick(genre)}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                
                {getTrailerKey() && (
                  <button 
                    className="btn btn-outline btn-lg gap-2 text-white border-white/30 hover:bg-white hover:text-base-content transition-all duration-300"
                    onClick={handleWatchTrailer}
                  >
                    <FaYoutube />
                    Trailer
                  </button>
                )}
                
                <button 
                  className={`btn btn-lg gap-2 ${
                    favoriteStatus?.isFavorited 
                      ? 'btn-error' 
                      : 'btn-outline text-white border-white/30 hover:bg-red-500 hover:border-red-500'
                  }`}
                  onClick={() => toggleFavoriteMutation.mutate()}
                  disabled={toggleFavoriteMutation.isPending}
                >
                  {toggleFavoriteMutation.isPending ? (
                    <FaSpinner className="animate-spin" />
                  ) : (
                    <FaHeart />
                  )}
                  {favoriteStatus?.isFavorited ? 'Favorited' : 'Favorite'}
                </button>
                
                <button 
                  className="btn btn-outline btn-lg gap-2 text-white border-white/30 hover:bg-white hover:text-base-content transition-all duration-300"
                  onClick={() => setShowListModal(true)}
                >
                  <FaPlus />
                  Add to List
                </button>
              </div>
            </div>

            {/* Featured Poster */}
            <div className="hidden lg:block">
              <div className="relative">
                <div className="aspect-[2/3] max-w-sm mx-auto inset-0 rounded-box ring-1 ring-white/20">
                  <img
                    src={tvShow.poster_path}
                    alt={tvShow.title}
                    className="w-full h-full object-cover rounded-box shadow-2xl"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Integrated Lobster Search Section */}
      {console.log('🔍 Rendering check - showLobsterSearch:', showLobsterSearch, 'lobsterStep:', lobsterStep)}
      {showLobsterSearch && (
        <div className="bg-base-200 rounded-box p-6 space-y-6 mb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Find Episode Sources</h2>
          </div>

          {/* Update the stepper UI with navigation controls */}
          <div className="flex items-center justify-between mb-6">
            <div className="steps steps-horizontal">
              <div 
                className={`step ${lobsterStep === 'search' ? 'step-primary' : ['select', 'seasons', 'episodes', 'play'].includes(lobsterStep) ? 'step-success' : ''} cursor-pointer`}
                onClick={() => handleStepClick('search')}
              >
                Search
              </div>
              <div 
                className={`step ${lobsterStep === 'select' ? 'step-primary' : ['seasons', 'episodes', 'play'].includes(lobsterStep) ? 'step-success' : ''} cursor-pointer`}
                onClick={() => handleStepClick('select')}
              >
                Select
              </div>
              <div 
                className={`step ${lobsterStep === 'seasons' ? 'step-primary' : ['episodes', 'play'].includes(lobsterStep) ? 'step-success' : ''} cursor-pointer`}
                onClick={() => handleStepClick('seasons')}
              >
                Seasons
              </div>
              <div 
                className={`step ${lobsterStep === 'episodes' ? 'step-primary' : lobsterStep === 'play' ? 'step-success' : ''} cursor-pointer`}
                onClick={() => handleStepClick('episodes')}
              >
                Episodes
              </div>
            </div>
            
            {/* Back Button */}
            {lobsterStep !== 'search' && (
              <button 
                className="btn btn-outline btn-sm gap-2"
                onClick={goBack}
              >
                <FaArrowLeft />
                Back
              </button>
            )}
          </div>

          {/* Add a title that shows the current step */}
          <div className="text-center mb-4">
            <h3 className="text-xl font-bold">
              {lobsterStep === 'search' && 'Search for TV Show'}
              {lobsterStep === 'select' && 'Select TV Show'}
              {lobsterStep === 'seasons' && 'Select Season'}
              {lobsterStep === 'episodes' && 'Select Episode'}
              {lobsterStep === 'play' && 'Now Playing'}
            </h3>
          </div>

          {/* Search Step */}
          {lobsterStep === 'search' && (
            <div className="space-y-4">
              <div className="form-control">
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="Search TV shows..."
                    className="input input-bordered w-full"
                    value={lobsterQuery}
                    onChange={(e) => setLobsterQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleLobsterSearch()}
                  />
                  <button 
                    className="btn btn-primary" 
                    onClick={() => handleLobsterSearch()}
                    disabled={lobsterLoading}
                  >
                    {lobsterLoading ? <FaSpinner className="animate-spin" /> : 'Search'}
                  </button>
                </div>
              </div>
              
              {lobsterError && (
                <div className="alert alert-error">
                  <span>{lobsterError}</span>
                </div>
              )}
            </div>
          )}

          {/* Select Step */}
          {lobsterStep === 'select' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-xl font-bold">Select TV Show</h3>
                <p className="text-base-content/70">Choose the correct show from the results</p>
              </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-128 overflow-y-auto">
                {lobsterResults.map((media) => (
                  <div
                    key={media.id}
                    className="card max-h-128 max-w-96 bg-base-100 shadow-xl cursor-pointer hover:shadow-2xl transition-all duration-300 hover:scale-105"
                    onClick={() => handleLobsterMediaSelect(media)}
                  >
                    <figure className="aspect-[2/3]">
                      <img
                        src={media.image_url || '/placeholder-poster.svg'}
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
                      {media.year && (
                        <div className="text-xs text-base-content/70">{media.year}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {lobsterLoading && (
                <div className="flex justify-center">
                  <FaSpinner className="animate-spin text-2xl" />
                </div>
              )}
              
              {lobsterError && (
                <div className="alert alert-error">
                  <span>{lobsterError}</span>
                </div>
              )}
            </div>
          )}

          {/* Seasons Step */}
          {lobsterStep === 'seasons' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-xl font-bold">Select Season</h3>
                <p className="text-base-content/70">Choose the season you want to watch</p>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
                {lobsterSeasons.map((season) => (
                  <div
                    key={season.id}
                    className="card bg-base-100 shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 relative"
                  >
                    <button
                      className={`absolute top-2 right-2 btn btn-xs btn-circle z-10 ${
                        isSeasonWatched(season) ? 'btn-success' : 'btn-outline'
                      }`}
                      onClick={(e) => { e.stopPropagation(); toggleSeasonWatched(season); }}
                    >
                      {isSeasonWatched(season) ? <FaCheck /> : <FaEyeSlash />}
                    </button>
                    <div className="card-body p-4" onClick={() => handleLobsterSeasonSelect(season)}>
                      <h4 className="card-title text-lg flex items-center gap-2">
                        {season.title}
                      </h4>
                      <p className="text-sm text-base-content/70">
                        {season.overview || `Season ${extractSeasonNumber(season.title)}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              {lobsterLoading && (
                <div className="flex justify-center">
                  <FaSpinner className="animate-spin text-2xl" />
                </div>
              )}
              
              {lobsterError && (
                <div className="alert alert-error">
                  <span>{lobsterError}</span>
                </div>
              )}
            </div>
          )}

          {/* Episodes Step */}
          {lobsterStep === 'episodes' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-xl font-bold">Select Episode</h3>
                <p className="text-base-content/70">Choose the episode you want to watch</p>
              </div>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {lobsterEpisodes.map((episode) => (
                  <div
                    key={episode.data_id}
                    className="card bg-base-100 shadow-lg transition-all duration-300 relative"
                  >
                    <button
                      className={`absolute top-2 right-2 btn btn-xs btn-circle z-10 ${
                        isEpisodeWatched(extractSeasonNumber(selectedLobsterSeason.title), extractEpisodeNumber(episode.title)) 
                          ? 'btn-success' 
                          : 'btn-outline'
                      }`}
                      onClick={(e) => { e.stopPropagation(); toggleEpisodeWatched(episode, selectedLobsterSeason); }}
                    >
                      {isEpisodeWatched(extractSeasonNumber(selectedLobsterSeason.title), extractEpisodeNumber(episode.title)) ? <FaCheck /> : <FaEyeSlash /> }
                    </button>
                    <div className="card-body p-4" onClick={() => handleLobsterEpisodeSelect(episode)}>
                      <h4 className="card-title text-lg flex items-center gap-2">
                        {episode.title}
                        {isEpisodeWatched(extractSeasonNumber(selectedLobsterSeason.title), extractEpisodeNumber(episode.title)) && <FaCheck className="text-success" />}
                      </h4>
                      <p className="text-sm text-base-content/70">
                        {episode.overview || 'Click to watch this episode'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              {lobsterLoading && (
                <div className="flex justify-center">
                  <FaSpinner className="animate-spin text-2xl" />
                </div>
              )}
              
              {lobsterError && (
                <div className="alert alert-error">
                  <span>{lobsterError}</span>
                </div>
              )}
            </div>
          )}

          {/* Play Step */}
          {lobsterStep === 'play' && selectedLobsterEpisode && (
            <div className="space-y-4">
              <div className="alert alert-success">
                <span>✅ Episode loaded successfully!</span>
              </div>
              
              <div className="space-y-2 text-center">
                <h3 className="text-xl font-bold">Now Playing: {selectedLobsterEpisode.title}</h3>
                <p className="text-base-content/70">
                  The episode is ready to play in your browser.
                </p>
              </div>
              
              {/* Video Player */}
              <div className="relative w-full max-w-4xl mx-auto">
                <video
                  ref={videoRef}
                  className="w-full aspect-video rounded-lg shadow-lg"
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  crossOrigin="anonymous"
                >
                  <source src={selectedLobsterEpisode.video_url} type="application/x-mpegURL" />
                  <source src={selectedLobsterEpisode.video_url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                
                {/* Subtitle Selection */}
                {selectedLobsterEpisode && selectedLobsterEpisode.subtitles && selectedLobsterEpisode.subtitles.length > 0 && (
                  <SubtitleHandler 
                    videoRef={videoRef} 
                    subtitles={selectedLobsterEpisode.subtitles} 
                    preferredLanguage={settings?.subtitle_language || 'english'} 
                  />
                )}
              </div>
              
              <div className="flex gap-2 justify-center">
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    navigator.clipboard.writeText(`mpv "${selectedLobsterEpisode.video_url}"`);
                    toast.success('mpv command copied to clipboard!');
                  }}
                >
                  Copy mpv Command
                </button>
                <button 
                  className="btn btn-ghost"
                  onClick={resetLobsterSearch}
                >
                  Search Again
                </button>
              </div>
            </div>
          )}
        </div>
      )}



      {/* Recommendations Section */}
      {recommendations?.results?.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-center">You might also like</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-8 gap-6">
            {recommendations.results.slice(0, 10).map((rec) => (
              <MediaCard key={rec.id} media={rec} />
            ))}
          </div>
        </div>
      )}

      {/* Trailer Modal */}
      {showTrailerModal && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-5xl h-5/6 p-0 relative">
            <button 
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10"
              onClick={() => setShowTrailerModal(false)}
            >
              <FaTimes />
            </button>
            <iframe
              className="w-full h-full rounded-box"
              src={`https://www.youtube.com/embed/${getTrailerKey()}?autoplay=1&rel=0`}
              title="TV Show Trailer"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
          <div className="modal-backdrop" onClick={() => setShowTrailerModal(false)}></div>
        </div>
      )}

      {/* Add to List Modal */}
      {showListModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Add to List</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {lists?.map((list) => (
                <button
                  key={list.id}
                  className="btn btn-ghost justify-start w-full gap-2"
                  onClick={() => addToListMutation.mutate(list.id)}
                  disabled={addToListMutation.isPending}
                >
                  <FaList className="text-primary" />
                  {list.name}
                  {addToListMutation.isPending && <FaSpinner className="animate-spin ml-auto" />}
                </button>
              ))}
            </div>
            <div className="modal-action">
              <button 
                className="btn btn-primary gap-2"
                onClick={() => {
                  setShowListModal(false);
                  setShowCreateListModal(true);
                }}
              >
                <FaPlus />
                Create New List
              </button>
              <button 
                className="btn btn-ghost"
                onClick={() => setShowListModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowListModal(false)}></div>
        </div>
      )}

      {/* Create List Modal */}
      {showCreateListModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Create New List</h3>
            <div className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">List Name *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="Enter list name"
                  maxLength={100}
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Description (optional)</span>
                </label>
                <textarea
                  className="textarea textarea-bordered"
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  placeholder="Enter list description"
                  rows={3}
                  maxLength={500}
                />
              </div>
            </div>
            <div className="modal-action">
              <button 
                className="btn btn-primary"
                onClick={() => createListMutation.mutate({ 
                  name: newListName, 
                  description: newListDescription 
                })}
                disabled={!newListName.trim() || createListMutation.isPending}
              >
                {createListMutation.isPending ? (
                  <FaSpinner className="animate-spin" />
                ) : (
                  'Create List'
                )}
              </button>
              <button 
                className="btn btn-ghost"
                onClick={() => setShowCreateListModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowCreateListModal(false)}></div>
        </div>
      )}
    </div>
  );
};

export default TVDetails; 