import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import MediaCard from '../components/MediaCard';
import { FaPlay, FaInfoCircle, FaFire, FaTv, FaFilm, FaHeart, FaStar } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const Dashboard = ({ onWatch }) => {
  const navigate = useNavigate();

  // Fetch trending content for hero section
  const { data: trendingData } = useQuery({
    queryKey: ['trending-hero'],
    queryFn: () => axios.get('/api/trending/all/day?page=1').then(res => res.data),
    refetchOnWindowFocus: false
  });

  // Fetch popular movies
  const { data: popularMovies, isLoading: moviesLoading } = useQuery({
    queryKey: ['popular-movies'],
    queryFn: () => axios.get('/api/movies/popular').then(res => res.data),
    refetchOnWindowFocus: false
  });

  // Fetch popular TV shows
  const { data: popularTV, isLoading: tvLoading } = useQuery({
    queryKey: ['popular-tv'],
    queryFn: () => axios.get('/api/tv/popular').then(res => res.data),
    refetchOnWindowFocus: false
  });

  // Fetch trending this week
  const { data: trendingWeek, isLoading: trendingLoading } = useQuery({
    queryKey: ['trending-week'],
    queryFn: () => axios.get('/api/trending/all/week').then(res => res.data),
    refetchOnWindowFocus: false
  });

  // Fetch favorites for recommendations
  const { data: favorites } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => axios.get('/api/favorites').then(res => res.data),
    refetchOnWindowFocus: false,
    retry: false, // Don't retry on favorites failure
    onError: (error) => {
      console.log('Failed to fetch favorites:', error);
    }
  });

  const heroContent = trendingData?.results?.[0];

  const handleWatch = (media) => {
    if (!media) return;
    const path = media.media_type === 'movie'
      ? `/movie/${media.id}?autoplay=1`
      : `/tv/${media.id}`;
    navigate(path);
  };

  const LoadingSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="bg-base-300 aspect-[2/3] rounded-box mb-3"></div>
          <div className="h-4 bg-base-300 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-base-300 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );

  const MediaRow = ({ title, data, isLoading, icon: Icon, description }) => {
    if (isLoading) {
      return (
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            {Icon && <Icon className="text-2xl text-primary" />}
            <div>
              <h2 className="text-2xl font-bold">{title}</h2>
              {description && <p className="text-base-content/70 text-sm">{description}</p>}
            </div>
          </div>
          <LoadingSkeleton />
        </section>
      );
    }

    if (!data?.results?.length) {
      return null;
    }

    return (
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          {Icon && <Icon className="text-2xl text-primary" />}
          <div>
            <h2 className="text-2xl font-bold">{title}</h2>
            {description && <p className="text-base-content/70 text-sm">{description}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-8 gap-6">
          {data.results.slice(0, 10).map((media) => (
            <MediaCard key={`${media.id}-${media.media_type}`} media={media} />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      {heroContent && (
        <div className="relative min-h-[80vh] flex items-center justify-center overflow-hidden rounded-box bg-gradient-to-br from-primary/20 to-secondary/20 mb-12">
          {/* Background Image */}
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${heroContent.backdrop_path})`
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20"></div>
          </div>

          {/* Content */}
          <div className="relative z-10 max-w-4xl mx-auto px-6 text-white">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 bg-primary/20 backdrop-blur-sm border border-primary/30 rounded-full px-4 py-2 text-sm font-medium">
                  <FaFire className="text-primary" />
                  Trending Now
                </div>
                
                <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                  {heroContent.title || heroContent.name}
                </h1>
                
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <FaStar className="text-yellow-400" />
                    <span className="font-semibold">{heroContent.vote_average?.toFixed(1)}</span>
                  </div>
                  <div className="badge badge-outline">
                    {heroContent.media_type === 'movie' ? 'Movie' : 'TV Show'}
                  </div>
                  {heroContent.release_date && (
                    <span>{new Date(heroContent.release_date).getFullYear()}</span>
                  )}
                </div>

                <p className="text-lg text-white/90 leading-relaxed max-w-xl">
                  {heroContent.overview?.substring(0, 300)}
                  {heroContent.overview?.length > 300 && '...'}
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    className="btn btn-primary btn-lg gap-2 shadow-lg hover:shadow-xl transition-all duration-300"
                    onClick={() => handleWatch(heroContent)}
                  >
                    <FaPlay className="text-sm" />
                    Watch Now
                  </button>
                  <a 
                    href={`/${heroContent.media_type}/${heroContent.id}`}
                    className="btn btn-outline btn-lg gap-2 text-white border-white/30 hover:bg-white hover:text-base-content transition-all duration-300"
                  >
                    <FaInfoCircle />
                    More Info
                  </a>
                </div>
              </div>

              {/* Featured Poster */}
              <div className="hidden lg:block">
                <div className="relative">
                                  <div className="aspect-[2/3] max-w-sm mx-auto inset-0 rounded-box ring-1 ring-white/20">
                  <img
                    src={heroContent.poster_path}
                    alt={heroContent.title || heroContent.name}
                    className="w-full h-full object-cover rounded-box shadow-2xl"
                  />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content Sections */}
      <div className="space-y-12">
        <MediaRow 
          title="Trending This Week" 
          description="The most popular content right now"
          data={trendingWeek} 
          isLoading={trendingLoading} 
          icon={FaFire}
        />
        
        <MediaRow 
          title="Popular Movies" 
          description="The biggest blockbusters and fan favorites"
          data={popularMovies} 
          isLoading={moviesLoading} 
          icon={FaFilm}
        />
        
        <MediaRow 
          title="Popular TV Shows" 
          description="Binge-worthy series everyone's talking about"
          data={popularTV} 
          isLoading={tvLoading} 
          icon={FaTv}
        />

        {/* Recommendations based on favorites */}
        {Array.isArray(favorites) && favorites.length > 0 && (
          <MediaRow
            title="Because You Liked..."
            description="Personalized recommendations based on your favorites"
            data={{
              results: favorites.slice(0, 10).map((fav) => ({
                id: fav.tmdb_id,
                title: fav.title,
                poster_path: fav.poster_path,
                vote_average: fav.vote_average,
                release_date: fav.release_date,
                media_type: fav.media_type
              }))
            }}
            isLoading={false}
            icon={FaHeart}
          />
        )}
      </div>

      {/* Welcome Card for new users */}
      {(!Array.isArray(favorites) || favorites.length === 0) && (
        <div className="card bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20 shadow-xl">
          <div className="card-body text-center">
            <h2 className="card-title justify-center text-2xl mb-4">
              <span className="text-3xl">🦞</span>
              Welcome to Lobster!
            </h2>
            <p className="text-base-content/70 mb-6 max-w-2xl mx-auto">
              Discover amazing movies and TV shows, create your personal favorites, and organize content with custom lists. 
              Start exploring to get personalized recommendations!
            </p>
            <div className="card-actions justify-center">
              <a href="/search" className="btn btn-primary gap-2">
                <FaPlay />
                Start Exploring
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 