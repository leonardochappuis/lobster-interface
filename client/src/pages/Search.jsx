import React, { useState, useEffect, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import MediaCard from '../components/MediaCard';
import ErrorModal from '../components/ErrorModal';
import { FaSearch, FaFilter, FaTimes, FaSpinner } from 'react-icons/fa';

const Search = ({ onWatch }) => {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [mediaType, setMediaType] = useState('all');
  const [year, setYear] = useState('');
  const [sortBy, setSortBy] = useState('popularity.desc');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [showOnlyWellReviewed, setShowOnlyWellReviewed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const minVoteCount = 200;

  // Handle URL parameters (for genre clicks)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const genreParam = params.get('genre');
    if (genreParam) {
      setSelectedGenre(genreParam);
      setSearchQuery('');
    } else {
      setSelectedGenre('');
    }
  }, [location.search]);

  // Handle errors
  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Infinite query for search results or trending content
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfiniteQuery({
    queryKey: ['search-infinite', debouncedQuery, mediaType, year, sortBy, selectedGenre, showOnlyWellReviewed, minVoteCount],
    queryFn: async ({ pageParam = 1 }) => {
      try {
        let response;
        if (debouncedQuery || selectedGenre || year || sortBy !== 'popularity.desc' || mediaType !== 'all' || showOnlyWellReviewed) {
          response = await axios.get('/api/search', {
            params: {
              ...(debouncedQuery && { query: debouncedQuery }),
              ...(selectedGenre && { genre: selectedGenre }),
              media_type: mediaType !== 'all' ? mediaType : undefined,
              year: year || undefined,
              sort_by: sortBy,
              ...(showOnlyWellReviewed && { min_vote_count: minVoteCount }),
              page: pageParam
            }
          });
        } else {
          response = await axios.get('/api/trending/all/day', {
            params: { page: pageParam }
          });
        }
        
        // Ensure we have results array
        if (!response.data.results) {
          return { ...response.data, results: [] };
        }
        
        return response.data;
      } catch (error) {
        console.error('API Error:', error);
        throw error;
      }
    },
    getNextPageParam: (lastPage, pages) => {
      return lastPage?.page < lastPage?.total_pages ? lastPage.page + 1 : undefined;
    },
    refetchOnWindowFocus: false
  });

  // Handle errors
  useEffect(() => {
    if (error) {
      setShowErrorModal(true);
    }
  }, [error]);

  // Flatten all pages into single results array and remove duplicates
  const allResults = React.useMemo(() => {
    const results = data?.pages?.flatMap(page => page.results) || [];
    const seen = new Set();
    return results.filter(media => {
      // Skip null/undefined items
      if (!media || !media.id || !media.media_type) {
        return false;
      }
      const key = `${media.id}-${media.media_type}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [data]);

  // Infinite scroll detection
  const handleScroll = useCallback(() => {
    if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 1000) {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Auto-fetch more pages if we have too few results
  useEffect(() => {
    const shouldAutoFetch = showOnlyWellReviewed && 
                           allResults.length < 20 && 
                           hasNextPage && 
                           !isFetchingNextPage && 
                           !isLoading &&
                           data?.pages?.length > 0;
    
    if (shouldAutoFetch) {
      fetchNextPage();
    }
  }, [allResults.length, hasNextPage, isFetchingNextPage, isLoading, showOnlyWellReviewed, fetchNextPage, data?.pages?.length]);

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear; i >= 1900; i--) {
      years.push(i);
    }
    return years;
  };

  const clearFilters = () => {
    setMediaType('all');
    setYear('');
    setSortBy('popularity.desc');
    setSelectedGenre('');
    setShowOnlyWellReviewed(false);
    setSearchQuery('');
  };

  const hasActiveFilters = mediaType !== 'all' || year || sortBy !== 'popularity.desc' || selectedGenre || showOnlyWellReviewed || debouncedQuery;

  const getSearchTitle = () => {
    if (selectedGenre && !debouncedQuery) {
      return `${selectedGenre} ${mediaType === 'movie' ? 'Movies' : mediaType === 'tv' ? 'TV Shows' : 'Content'}${showOnlyWellReviewed ? ' (Well-Reviewed)' : ''}`;
    }
    if (debouncedQuery) {
      return `Search results for "${debouncedQuery}"${showOnlyWellReviewed ? ' (Well-Reviewed)' : ''}`;
    }
    if (showOnlyWellReviewed) {
      return `Well-Reviewed Content (${minVoteCount}+ votes)`;
    }
    if (hasActiveFilters) {
      return 'Filtered Content';
    }
    return 'Trending Today';
  };

  const LoadingSkeleton = () => (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-8 gap-6">
      {[...Array(20)].map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="bg-base-300 aspect-[2/3] rounded-box mb-3"></div>
          <div className="h-4 bg-base-300 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-base-300 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="text-center space-y-4 py-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Discover Amazing Content
        </h1>
        <p className="text-base-content/70 max-w-2xl mx-auto">
          Search through thousands of movies and TV shows. Use filters to find exactly what you're looking for.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-2xl mx-auto">
        <div className="relative">
          <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-base-content/40 text-lg" />
          <input
            type="text"
                            className="input input-lg w-full pl-12 pr-16 rounded-box bg-base-200 border-0 focus:ring-2 focus:ring-primary/50 text-lg placeholder:text-base-content/50"
            placeholder="Search for movies, TV shows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 btn btn-ghost btn-circle btn-sm"
            >
              <FaTimes />
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn gap-2 ${showFilters ? 'btn-primary' : 'btn-outline'}`}
        >
          <FaFilter className="w-4 h-4" />
          Filters
          {hasActiveFilters && <span className="badge badge-secondary badge-sm">•</span>}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="btn btn-ghost btn-sm gap-2"
          >
            <FaTimes className="w-3 h-3" />
            Clear All Filters
          </button>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="card bg-base-200 shadow-xl border border-base-300">
          <div className="card-body">
            <h3 className="card-title text-lg mb-4">Filter Options</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-8 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Content Type</span>
                </label>
                <select
                  className="select select-bordered"
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value)}
                >
                  <option value="all">All Content</option>
                  <option value="movie">Movies Only</option>
                  <option value="tv">TV Shows Only</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Genre</span>
                </label>
                <select
                  className="select select-bordered"
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                >
                  <option value="">Any Genre</option>
                  <option value="Action">Action</option>
                  <option value="Adventure">Adventure</option>
                  <option value="Animation">Animation</option>
                  <option value="Comedy">Comedy</option>
                  <option value="Crime">Crime</option>
                  <option value="Documentary">Documentary</option>
                  <option value="Drama">Drama</option>
                  <option value="Family">Family</option>
                  <option value="Fantasy">Fantasy</option>
                  <option value="History">History</option>
                  <option value="Horror">Horror</option>
                  <option value="Music">Music</option>
                  <option value="Mystery">Mystery</option>
                  <option value="Romance">Romance</option>
                  <option value="Science Fiction">Science Fiction</option>
                  <option value="Thriller">Thriller</option>
                  <option value="War">War</option>
                  <option value="Western">Western</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Release Year</span>
                </label>
                <select
                  className="select select-bordered"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                >
                  <option value="">Any Year</option>
                  {generateYearOptions().map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Sort By</span>
                </label>
                <select
                  className="select select-bordered"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="popularity.desc">Most Popular</option>
                  <option value="vote_average.desc">Highest Rated</option>
                  <option value="release_date.desc">Most Recent</option>
                  <option value="title.asc">Title A-Z</option>
                </select>
              </div>
            </div>

            <div className="form-control mt-4">
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={showOnlyWellReviewed}
                  onChange={(e) => setShowOnlyWellReviewed(e.target.checked)}
                />
                <span className="label-text">Show only well-reviewed content ({minVoteCount}+ votes)</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Results Section */}
      <div className="space-y-6">
        {isLoading && !data && <LoadingSkeleton />}

        {error && (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-lg text-base-content/70 mb-4">Unable to load content</p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Results Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                {getSearchTitle()}
              </h2>
              {data?.pages?.[0]?.total_results && (
                <div className="badge badge-lg badge-outline">
                  {data.pages[0].total_results.toLocaleString()} results
                </div>
              )}
            </div>

            {/* Results Grid */}
            {allResults.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-8 gap-6">
                  {allResults.map((media, index) => (
                    <MediaCard 
                      key={`search-${media.id}-${media.media_type}-${index}`} 
                      media={media} 
                    />
                  ))}
                </div>
                
                {/* Loading More Indicator */}
                {isFetchingNextPage && (
                  <div className="flex justify-center items-center py-8">
                    <div className="flex items-center gap-3 text-base-content/70">
                      <FaSpinner className="animate-spin" />
                      <span>Loading more amazing content...</span>
                    </div>
                  </div>
                )}
                
                {/* End of Results */}
                {!hasNextPage && allResults.length > 0 && (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-base-200 rounded-full text-base-content/70">
                      <span>🎬</span>
                      <span>That's all for now!</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              !isLoading && hasActiveFilters && (
                <div className="card bg-base-200 shadow-xl">
                  <div className="card-body text-center">
                    <div className="text-6xl mb-4">🔍</div>
                    <h3 className="text-xl font-bold mb-2">No Results Found</h3>
                    <p className="text-base-content/70 mb-4">
                      {debouncedQuery ? 
                        `No content found for "${debouncedQuery}" with current filters` : 
                        selectedGenre ? 
                        `No ${selectedGenre.toLowerCase()} content found with current filters` :
                        'No content found with current filters'
                      }
                    </p>
                    <button
                      onClick={clearFilters}
                      className="btn btn-primary gap-2"
                    >
                      <FaTimes />
                      Clear Filters & Try Again
                    </button>
                  </div>
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* Error Modal */}
      <ErrorModal 
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Failed to Load Content"
        message="Error loading search results. Please check your connection and try again."
        onRetry={() => {
          setShowErrorModal(false);
          window.location.reload();
        }}
      />
    </div>
  );
};

export default Search; 