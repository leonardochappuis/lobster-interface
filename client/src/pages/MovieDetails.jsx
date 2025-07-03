import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import MediaCard from '../components/MediaCard';
import { FaPlay, FaHeart, FaStar, FaPlus, FaList, FaYoutube, FaTimes, FaSpinner, FaClock, FaCalendar, FaFilm, FaEye, FaEyeSlash, FaArrowLeft } from 'react-icons/fa';
import ErrorModal from '../components/ErrorModal';
import Hls from 'hls.js';
import SubtitleHandler from '../components/SubtitleHandler';

const MovieDetails = ({ onWatch }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showListModal, setShowListModal] = useState(false);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [showCreateListModal, setShowCreateListModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [searchParams] = useSearchParams();
  const autoplay = searchParams.get('autoplay') === '1';
  
  // Integrated Lobster search states
  const [showLobsterSearch, setShowLobsterSearch] = useState(true);
  const [lobsterStep, setLobsterStep] = useState('search'); // search, select, play
  const [lobsterQuery, setLobsterQuery] = useState('');
  const [lobsterResults, setLobsterResults] = useState([]);
  const [selectedLobsterMedia, setSelectedLobsterMedia] = useState(null);
  const [lobsterLoading, setLobsterLoading] = useState(false);
  const [lobsterError, setLobsterError] = useState(null);
  const [autoStarted, setAutoStarted] = useState(false);
  
  // Video player refs
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // Fetch movie details
  const { data: movie, isLoading, error } = useQuery({
    queryKey: ['movie', id],
    queryFn: () => axios.get(`/api/movie/${id}`).then(res => res.data),
    refetchOnWindowFocus: false
  });

  // Fetch recommendations
  const { data: recommendations } = useQuery({
    queryKey: ['movie-recommendations', id],
    queryFn: () => axios.get(`/api/movie/${id}/recommendations`).then(res => res.data),
    enabled: !!movie,
    refetchOnWindowFocus: false
  });

  // Fetch videos/trailers
  const { data: videos } = useQuery({
    queryKey: ['movie-videos', id],
    queryFn: () => axios.get(`/api/movie/${id}/videos`).then(res => res.data),
    enabled: !!movie,
    refetchOnWindowFocus: false
  });

  // Check if favorited
  const { data: favoriteStatus } = useQuery({
    queryKey: ['favorite-status', id, 'movie'],
    queryFn: () => axios.get(`/api/favorites/${id}/movie`).then(res => res.data),
    enabled: !!movie,
    refetchOnWindowFocus: false
  });

  // Fetch user lists
  const { data: lists } = useQuery({
    queryKey: ['lists'],
    queryFn: () => axios.get('/api/lists').then(res => res.data),
    refetchOnWindowFocus: false
  });

  // Fetch user settings for subtitle preferences
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => axios.get('/api/settings').then(res => res.data),
    refetchOnWindowFocus: false
  });

  // Fix the watch status query
  const { data: watchedRows } = useQuery({
    queryKey: ['watch-status', id],
    queryFn: () => axios.get(`/api/watched/${id}/movie`).then(res => res.data.episodes || []),
    enabled: !!movie,
    refetchOnWindowFocus: false
  });
  const watched = watchedRows && watchedRows.length > 0;

  // add toggle mutation
  const toggleWatchedMutation = useMutation({
    mutationFn: () => {
      if (watched) {
        return axios.delete('/api/watched', { data: { tmdb_id: movie.id, media_type: 'movie' }});
      }
      return axios.post('/api/watched', { tmdb_id: movie.id, media_type: 'movie', title: movie.title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watch-status', id] });
      toast.success(watched ? 'Marked as unwatched' : 'Marked as watched');
    },
    onError: () => toast.error('Failed to toggle watched status')
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: () => {
      if (favoriteStatus?.isFavorited) {
        return axios.delete(`/api/favorites/${id}/movie`);
      } else {
        return axios.post('/api/favorites', {
          tmdb_id: movie.id,
          media_type: 'movie',
          title: movie.title,
          poster_path: movie.poster_path,
          backdrop_path: movie.backdrop_path,
          overview: movie.overview,
          release_date: movie.release_date,
          vote_average: movie.vote_average,
          vote_count: movie.vote_count,
          genres: movie.genres
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-status', id, 'movie'] });
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
      tmdb_id: movie.id,
      media_type: 'movie',
      title: movie.title,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      overview: movie.overview,
      release_date: movie.release_date,
      vote_average: movie.vote_average,
      vote_count: movie.vote_count,
      genres: movie.genres
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

  // Watch movie handler - use integrated search
  const handleWatch = () => {
    if (!movie) return;
    
    // Create search title and start integrated search
    const searchTitle = `${movie.title} ${movie.release_date ? new Date(movie.release_date).getFullYear() : ''}`.trim();
    setLobsterQuery(searchTitle);
    setShowLobsterSearch(true);
    setLobsterStep('search');
    
    // Auto-start search
    setTimeout(() => {
      handleLobsterSearch(searchTitle);
    }, 100);
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
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('🎬 MovieDetails: Received subtitle data:', data.subtitles);
        // Store the video URL and show web player
        setSelectedLobsterMedia({
          ...media,
          video_url: data.video_url,
          subtitles: data.subtitles || []
        });
        setLobsterStep('play');
        toast.success('Movie loaded successfully!');
        
        // Mark as watched in history
        try {
          await fetch('/api/watched', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tmdb_id: movie.id,
              media_type: 'movie',
              title: movie.title
            })
          });
        } catch (e) {
          console.error('Failed to mark movie as watched:', e);
        }
      } else {
        setLobsterError(data.error || 'Failed to extract video URL');
      }
    } catch (err) {
      setLobsterError('Failed to load movie');
    } finally {
      setLobsterLoading(false);
    }
  };

  const resetLobsterSearch = () => {
    setShowLobsterSearch(false);
    setLobsterStep('search');
    setLobsterQuery('');
    setLobsterResults([]);
    setSelectedLobsterMedia(null);
    setLobsterLoading(false);
    setLobsterError(null);
  };

  const formatRuntime = (minutes) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatReleaseDate = (date) => {
    if (!date) return '';
    return new Date(date).getFullYear();
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
    if (error || (!isLoading && !movie)) {
      setShowErrorModal(true);
    }
  }, [error, isLoading, movie]);

  // effect after data loaded
  React.useEffect(() => {
    if (movie && !autoStarted) {
      handleWatch();
      setAutoStarted(true);
    }
  }, [movie, autoStarted]);

  // Video player effect for web playback
  useEffect(() => {
    if (lobsterStep === 'play' && selectedLobsterMedia?.video_url && videoRef.current) {
      const videoUrl = selectedLobsterMedia.video_url;
      
      console.log('🎬 MovieDetails: Loading video URL:', videoUrl);
      
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
  }, [lobsterStep, selectedLobsterMedia]);

  // Cleanup HLS when component unmounts
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  // Add useEffect reset on id change
  React.useEffect(() => {
    // reset when navigating to another movie id
    resetLobsterSearch();
    setAutoStarted(false);
  }, [id]);

  // Add navigation functions
  const goBack = () => {
    if (lobsterStep === 'play') {
      setLobsterStep('select');
      setSelectedLobsterMedia(null);
    } else if (lobsterStep === 'select') {
      setLobsterStep('search');
      setSelectedLobsterMedia(null);
      setLobsterResults([]);
    }
  };

  const handleStepClick = (step) => {
    // Only allow going back, not forward
    if (step === 'search' && lobsterStep !== 'search') {
      resetLobsterSearch();
    } else if (step === 'select' && lobsterStep === 'play') {
      setLobsterStep('select');
      setSelectedLobsterMedia(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
        <FaSpinner className="animate-spin text-4xl text-primary" />
        <p className="text-lg text-base-content/70">Loading movie details...</p>
      </div>
    );
  }

  // If error and no movie data, show minimal UI with error modal
  if (error && !movie) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
        <p className="text-lg text-base-content/70">Unable to load movie details</p>
        <ErrorModal 
          isOpen={showErrorModal}
          onClose={() => {
            setShowErrorModal(false);
            navigate('/');
          }}
          title="Failed to Load Movie"
          message="Failed to load movie details. Please try again or go back to browse other content."
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
            backgroundImage: `url(${movie.backdrop_path})`
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
                <FaFilm className="text-primary" />
                Movie
              </div>
              
              <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                {movie.title}
              </h1>
              
              {/* Movie Meta Information */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                {movie.release_date && (
                  <div className="flex items-center gap-1">
                    <FaCalendar className="text-primary" />
                    <span>{formatReleaseDate(movie.release_date)}</span>
                  </div>
                )}
                {movie.runtime && (
                  <div className="flex items-center gap-1">
                    <FaClock className="text-primary" />
                    <span>{formatRuntime(movie.runtime)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <FaStar className="text-yellow-400" />
                  <span className="font-semibold">{movie.vote_average?.toFixed(1)}</span>
                  <span className="text-white/70">({movie.vote_count?.toLocaleString()} votes)</span>
                </div>
              </div>

              <p className="text-lg text-white/90 leading-relaxed max-w-xl">
                {movie.overview?.substring(0, 300)}
                {movie.overview?.length > 300 && '...'}
              </p>

              {/* Genres */}
              {movie.genres && (
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(movie.genres) 
                    ? movie.genres.slice(0, 4).map(g => g.name || g) 
                    : movie.genres.split(', ').slice(0, 4)
                  ).map((genre) => (
                    <button 
                      key={genre} 
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
                  className={`btn btn-lg gap-2 ${watched ? 'btn-success' : 'btn-outline text-white border-white/30 hover:bg-white hover:text-base-content'}`}
                  onClick={() => toggleWatchedMutation.mutate()}
                  disabled={toggleWatchedMutation.isPending}
                >
                  {toggleWatchedMutation.isPending ? (
                    <FaSpinner className="animate-spin" />
                  ) : watched ? (
                    <FaEyeSlash />
                  ) : (
                    <FaEye />
                  )}
                  {watched ? 'Watched' : 'Mark Watched'}
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
                    src={movie.poster_path}
                    alt={movie.title}
                    className="w-full h-full object-cover rounded-box shadow-2xl"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Integrated Lobster Search Section */}
      {showLobsterSearch && (
        <div className="bg-base-200 rounded-box p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Find Movie Sources</h2>
          </div>

          {/* Update the stepper UI with navigation controls */}
          <div className="flex items-center justify-between mb-6">
            <div className="steps steps-horizontal">
              <div 
                className={`step ${lobsterStep === 'search' ? 'step-primary' : ['select', 'play'].includes(lobsterStep) ? 'step-success' : ''} cursor-pointer`}
                onClick={() => handleStepClick('search')}
              >
                Search
              </div>
              <div 
                className={`step ${lobsterStep === 'select' ? 'step-primary' : lobsterStep === 'play' ? 'step-success' : ''} cursor-pointer`}
                onClick={() => handleStepClick('select')}
              >
                Select
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
              {lobsterStep === 'search' && 'Search for Movie'}
              {lobsterStep === 'select' && 'Select Movie'}
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
                    placeholder="Search movies..."
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
                <h3 className="text-xl font-bold">Select Movie</h3>
                <p className="text-base-content/70">Choose the correct movie from the results</p>
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

          {/* Play Step */}
          {lobsterStep === 'play' && selectedLobsterMedia && (
            <div className="space-y-4">
              <div className="alert alert-success">
                <span>✅ Movie loaded successfully!</span>
              </div>
              
              <div className="space-y-2 text-center">
                <h3 className="text-xl font-bold">Now Playing: {selectedLobsterMedia.title}</h3>
                <p className="text-base-content/70">
                  The movie is ready to play in your browser.
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
                  <source src={selectedLobsterMedia.video_url} type="application/x-mpegURL" />
                  <source src={selectedLobsterMedia.video_url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                
                {/* Subtitle Handler Component */}
                {selectedLobsterMedia.subtitles && selectedLobsterMedia.subtitles.length > 0 && (
                  <SubtitleHandler 
                    videoRef={videoRef} 
                    subtitles={selectedLobsterMedia.subtitles} 
                    preferredLanguage={settings?.subtitle_language || 'english'} 
                  />
                )}
              </div>
              
              <div className="flex gap-2 justify-center">
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    navigator.clipboard.writeText(`mpv "${selectedLobsterMedia.video_url}"`);
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
              title="Movie Trailer"
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

export default MovieDetails; 