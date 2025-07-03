import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaStar, FaTimes } from 'react-icons/fa';

const MediaCard = ({ 
  media, 
  showOverlay = true, 
  showRemoveButton = false, 
  onRemove = null,
  listId = null 
}) => {
  const [imageError, setImageError] = useState(false);

  const getDetailsPath = () => {
    return `/${media.media_type}/${media.id}`;
  };

  const formatRating = (rating) => {
    return rating ? rating.toFixed(1) : 'N/A';
  };

  const formatReleaseYear = (date) => {
    if (!date) return '';
    return new Date(date).getFullYear();
  };

  const handleRemove = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onRemove && listId) {
      onRemove(listId, media.id, media.media_type, media.title);
    }
  };

  const handleImageError = (e) => {
    if (!imageError) {
      setImageError(true);
      e.target.src = '/placeholder-poster.svg';
    }
  };

  return (
    <div className="group relative w-full max-w-sm mx-auto">
      <Link 
        to={getDetailsPath()} 
        className="media-card-link block relative overflow-hidden rounded-box bg-base-200 shadow-lg hover:shadow-2xl transform transition-all duration-300 hover:scale-105 hover:-translate-y-2"
      >
        {/* Image Container */}
        <div className="relative aspect-[2/3] overflow-hidden">
          <img 
            src={imageError ? '/placeholder-poster.svg' : (media.poster_path || '/placeholder-poster.svg')} 
            alt={media.title}
            loading="lazy"
            onError={handleImageError}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          
          {/* Gradient Overlay - Always visible for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          
          {/* Title and Year - Always Visible */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-white font-bold text-lg leading-tight mb-2 drop-shadow-lg">
              {media.title}
            </h3>
            <div className="flex items-center gap-2 text-white/90 text-sm">
              {formatReleaseYear(media.release_date) && (
                <div className="bg-black/50 rounded-full px-2 py-1">
                  <span>{formatReleaseYear(media.release_date)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Info Badge - Always Visible */}
        <div className="absolute top-3 left-3">
          <div className="badge badge-primary badge-sm font-semibold">
            {media.media_type === 'movie' ? 'Movie' : 'TV'}
          </div>
        </div>

        {/* Rating Badge - Top Right */}
        <div className="absolute top-3 right-3">
          <div className="flex items-center gap-1 bg-black/70 rounded-full px-2 py-1 text-white text-xs">
            <FaStar className="text-yellow-400" />
            <span className="font-medium">{formatRating(media.vote_average)}</span>
          </div>
        </div>
      </Link>
      
      {/* Remove Button - Outside the Link to prevent conflicts */}
      {showRemoveButton && (
        <button 
          onClick={handleRemove}
          className="absolute top-2 right-2 z-10 btn btn-error btn-circle btn-xs hover:btn-md transition-all duration-200 group-hover:scale-110"
          title={`Remove ${media.title} from list`}
        >
          <FaTimes className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export default MediaCard; 