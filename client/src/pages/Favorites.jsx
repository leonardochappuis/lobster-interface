import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import MediaCard from '../components/MediaCard';
import ErrorModal from '../components/ErrorModal';
import { FaHeart, FaSpinner } from 'react-icons/fa';

const Favorites = () => {
  const [showErrorModal, setShowErrorModal] = useState(false);
  
  const { data: favorites, isLoading, error } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => axios.get('/api/favorites').then(res => res.data),
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (error) {
      setShowErrorModal(true);
    }
  }, [error]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <FaSpinner className="animate-spin text-4xl text-primary" />
        <p className="text-lg text-base-content/70">Loading your favorites...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <p className="text-lg text-base-content/70">Unable to load favorites</p>
        <ErrorModal 
          isOpen={showErrorModal}
          onClose={() => setShowErrorModal(false)}
          title="Failed to Load Favorites"
          message="Error loading favorites. Please check your connection and try again."
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
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <FaHeart className="text-4xl text-error" />
          <h1 className="text-4xl font-bold">My Favorites</h1>
        </div>
        <p className="text-base-content/70 max-w-2xl mx-auto">
          All your favorite movies and TV shows in one place
        </p>
        {Array.isArray(favorites) && favorites.length > 0 && (
          <div className="badge badge-lg badge-outline">
            {favorites.length} {favorites.length === 1 ? 'favorite' : 'favorites'}
          </div>
        )}
      </div>

      {/* Content */}
      {!Array.isArray(favorites) || favorites.length === 0 ? (
        <div className="card bg-base-200 shadow-xl max-w-md mx-auto">
          <div className="card-body text-center">
            <div className="text-6xl mb-4">💔</div>
            <h2 className="text-2xl font-bold mb-2">No favorites yet</h2>
            <p className="text-base-content/70 mb-6">
              Start adding movies and TV shows to your favorites by clicking the heart icon on any content.
            </p>
            <div className="card-actions justify-center">
              <a href="/search" className="btn btn-primary gap-2">
                <FaHeart />
                Start Adding Favorites
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-8 gap-6">
          {favorites.map((favorite) => (
            <MediaCard
              key={`fav-${favorite.tmdb_id}-${favorite.media_type}`}
              media={{
                id: favorite.tmdb_id,
                title: favorite.title,
                poster_path: favorite.poster_path,
                backdrop_path: favorite.backdrop_path,
                vote_average: favorite.vote_average,
                release_date: favorite.release_date,
                media_type: favorite.media_type,
                overview: favorite.overview
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites; 