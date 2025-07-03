const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const config = require('./config');
const { db, initializeDatabase } = require('./database');

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
  credentials: false
}));
app.use(express.json());

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../client/build')));

// TMDB API headers
const tmdbHeaders = {
  'Authorization': `Bearer ${config.TMDB_API_TOKEN}`,
  'Content-Type': 'application/json;charset=utf-8'
};

// Helper function to get full image URL
const getImageUrl = (path, size = 'w500') => {
  if (!path) return null;
  return `${config.TMDB_IMAGE_BASE_URL}/${size}${path}`;
};

// TMDB Genre mappings
const GENRE_MAP = {
  'Action': 28,
  'Adventure': 12,
  'Animation': 16,
  'Comedy': 35,
  'Crime': 80,
  'Documentary': 99,
  'Drama': 18,
  'Family': 10751,
  'Fantasy': 14,
  'History': 36,
  'Horror': 27,
  'Music': 10402,
  'Mystery': 9648,
  'Romance': 10749,
  'Science Fiction': 878,
  'Thriller': 53,
  'War': 10752,
  'Western': 37
};

// TV Genre mappings (some differ from movies)
const TV_GENRE_MAP = {
  'Action': 10759,
  'Action & Adventure': 10759,
  'Adventure': 10759,
  'Animation': 16,
  'Comedy': 35,
  'Crime': 80,
  'Documentary': 99,
  'Drama': 18,
  'Family': 10751,
  'Fantasy': 10765,
  'Kids': 10762,
  'Mystery': 9648,
  'News': 10763,
  'Reality': 10764,
  'Romance': 10749,
  'Science Fiction': 10765,
  'Sci-Fi & Fantasy': 10765,
  'Soap': 10766,
  'Talk': 10767,
  'War': 10768,
  'War & Politics': 10768,
  'Western': 37
};

// Helper function to format media data
const formatMediaData = (item, mediaType) => ({
  id: item.id,
  title: item.title || item.name,
  overview: item.overview,
  poster_path: getImageUrl(item.poster_path),
  backdrop_path: getImageUrl(item.backdrop_path, 'w1280'),
  release_date: item.release_date || item.first_air_date,
  vote_average: item.vote_average,
  vote_count: item.vote_count,
  media_type: mediaType || item.media_type,
  genre_ids: item.genre_ids,
  genres: item.genres ? item.genres.map(g => g.name).join(', ') : ''
});

// Simple subtitle fetching utility
const fetchSubtitles = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Subtitle fetch error:', error.message);
    throw error;
  }
};

// TMDB API Routes
// Get popular movies
app.get('/api/movies/popular', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const response = await axios.get(`${config.TMDB_BASE_URL}/movie/popular`, {
      headers: tmdbHeaders,
      params: { page }
    });
    
    const formattedResults = response.data.results.map(movie => formatMediaData(movie, 'movie'));
    res.json({
      ...response.data,
      results: formattedResults
    });
  } catch (error) {
    console.error('Error fetching popular movies:', error);
    res.status(500).json({ error: 'Failed to fetch popular movies' });
  }
});

// Get popular TV shows
app.get('/api/tv/popular', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const response = await axios.get(`${config.TMDB_BASE_URL}/tv/popular`, {
      headers: tmdbHeaders,
      params: { page }
    });
    
    const formattedResults = response.data.results.map(show => formatMediaData(show, 'tv'));
    res.json({
      ...response.data,
      results: formattedResults
    });
  } catch (error) {
    console.error('Error fetching popular TV shows:', error);
    res.status(500).json({ error: 'Failed to fetch popular TV shows' });
  }
});

// Get trending content
app.get('/api/trending/:media_type/:time_window', async (req, res) => {
  try {
    const { media_type, time_window } = req.params;
    const page = req.query.page || 1;
    
    const response = await axios.get(`${config.TMDB_BASE_URL}/trending/${media_type}/${time_window}`, {
      headers: tmdbHeaders,
      params: { page }
    });
    
    const formattedResults = response.data.results.map(item => formatMediaData(item));
    res.json({
      ...response.data,
      results: formattedResults
    });
  } catch (error) {
    console.error('Error fetching trending content:', error);
    res.status(500).json({ error: 'Failed to fetch trending content' });
  }
});

// Search movies and TV shows
app.get('/api/search', async (req, res) => {
  try {
    const { query, page = 1, media_type, year, sort_by, genre, min_vote_count } = req.query;
    
    let endpoint;
    let params = { page };
    let results = [];

    // Get genre ID if genre filter is provided
    const getGenreId = (genreName, isTV = false) => {
      if (!genreName) return null;
      const genreMap = isTV ? TV_GENRE_MAP : GENRE_MAP;
      return genreMap[genreName] || null;
    };

    // Use discover endpoints for better filtering when we have filters or no text query
    if (genre || !query || min_vote_count || sort_by !== 'popularity.desc') {
      if (media_type === 'movie') {
        endpoint = `${config.TMDB_BASE_URL}/discover/movie`;
        if (year) params.primary_release_year = year;
        if (sort_by) params.sort_by = sort_by;
        if (min_vote_count) params['vote_count.gte'] = min_vote_count;
        const genreId = getGenreId(genre, false);
        if (genreId) params.with_genres = genreId;
      } else if (media_type === 'tv') {
        endpoint = `${config.TMDB_BASE_URL}/discover/tv`;
        if (year) params.first_air_date_year = year;
        if (sort_by) params.sort_by = sort_by;
        if (min_vote_count) params['vote_count.gte'] = min_vote_count;
        const genreId = getGenreId(genre, true);
        if (genreId) params.with_genres = genreId;
      } else {
        // For mixed content, get both movies and TV with genre filtering
        const movieGenreId = getGenreId(genre, false);
        const tvGenreId = getGenreId(genre, true);
        
        const apiCalls = [];
        let movieResults = [];
        let tvResults = [];
        
        if (!genre || movieGenreId) {
          apiCalls.push(
            axios.get(`${config.TMDB_BASE_URL}/discover/movie`, {
              headers: tmdbHeaders,
              params: { 
                page: Math.ceil(page / 2),
                sort_by: sort_by || 'popularity.desc',
                ...(year && { primary_release_year: year }),
                ...(movieGenreId && { with_genres: movieGenreId }),
                ...(min_vote_count && { 'vote_count.gte': min_vote_count })
              }
            }).then(response => {
              movieResults = response.data.results.map(item => formatMediaData(item, 'movie'));
              return response;
            })
          );
        }
        
        if (!genre || tvGenreId) {
          apiCalls.push(
            axios.get(`${config.TMDB_BASE_URL}/discover/tv`, {
              headers: tmdbHeaders,
              params: { 
                page: Math.ceil(page / 2),
                sort_by: sort_by || 'popularity.desc',
                ...(year && { first_air_date_year: year }),
                ...(tvGenreId && { with_genres: tvGenreId }),
                ...(min_vote_count && { 'vote_count.gte': min_vote_count })
              }
            }).then(response => {
              tvResults = response.data.results.map(item => formatMediaData(item, 'tv'));
              return response;
            })
          );
        }
        
        const responses = await Promise.all(apiCalls);
        results = [...movieResults, ...tvResults];
        
        let totalPages = 1;
        let totalResults = 0;
        
        responses.forEach(response => {
          totalPages = Math.max(totalPages, response.data.total_pages);
          totalResults += response.data.total_results;
        });
        
        return res.json({
          page: parseInt(page),
          results: results,
          total_pages: totalPages,
          total_results: totalResults
        });
      }
    } else if (query) {
      if (media_type === 'movie') {
        endpoint = `${config.TMDB_BASE_URL}/search/movie`;
        params.query = query;
        if (year) params.primary_release_year = year;
      } else if (media_type === 'tv') {
        endpoint = `${config.TMDB_BASE_URL}/search/tv`;
        params.query = query;
        if (year) params.first_air_date_year = year;
      } else {
        endpoint = `${config.TMDB_BASE_URL}/search/multi`;
        params.query = query;
      }
    }

    const response = await axios.get(endpoint, {
      headers: tmdbHeaders,
      params
    });
    
    let formattedResults;
    if (query && !media_type) {
      formattedResults = response.data.results
        .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
        .map(item => formatMediaData(item));
    } else {
      formattedResults = response.data.results.map(item => 
        formatMediaData(item, media_type || item.media_type)
      );
    }
    
    res.json({
      ...response.data,
      results: formattedResults
    });
  } catch (error) {
    console.error('Error searching media:', error);
    res.status(500).json({ error: 'Failed to search media' });
  }
});

// Get movie details
app.get('/api/movie/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${config.TMDB_BASE_URL}/movie/${id}`, {
      headers: tmdbHeaders,
      params: {
        append_to_response: 'credits,videos,similar,recommendations'
      }
    });

    const formattedData = {
      ...formatMediaData(response.data, 'movie'),
      genres: response.data.genres,
      runtime: response.data.runtime,
      credits: response.data.credits,
      videos: response.data.videos,
      similar: response.data.similar ? {
        ...response.data.similar,
        results: response.data.similar.results.map(item => formatMediaData(item, 'movie'))
      } : null,
      recommendations: response.data.recommendations ? {
        ...response.data.recommendations,
        results: response.data.recommendations.results.map(item => formatMediaData(item, 'movie'))
      } : null
    };

    res.json(formattedData);
  } catch (error) {
    console.error('Error fetching movie details:', error);
    res.status(500).json({ error: 'Failed to fetch movie details' });
  }
});

// Get movie recommendations (separate endpoint for compatibility)
app.get('/api/movie/:id/recommendations', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${config.TMDB_BASE_URL}/movie/${id}/recommendations`, {
      headers: tmdbHeaders,
      params: { page: req.query.page || 1 }
    });
    
    const formattedData = {
      ...response.data,
      results: response.data.results.map(item => formatMediaData(item, 'movie'))
    };

    res.json(formattedData);
  } catch (error) {
    console.error('Error fetching movie recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch movie recommendations' });
  }
});

// Get movie videos (separate endpoint for compatibility)
app.get('/api/movie/:id/videos', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${config.TMDB_BASE_URL}/movie/${id}/videos`, {
      headers: tmdbHeaders
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching movie videos:', error);
    res.status(500).json({ error: 'Failed to fetch movie videos' });
  }
});

// Get TV show details
app.get('/api/tv/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${config.TMDB_BASE_URL}/tv/${id}`, {
      headers: tmdbHeaders,
      params: {
        append_to_response: 'credits,videos,similar,recommendations'
      }
    });

    const formattedData = {
      ...formatMediaData(response.data, 'tv'),
      genres: response.data.genres,
      number_of_seasons: response.data.number_of_seasons,
      number_of_episodes: response.data.number_of_episodes,
      seasons: response.data.seasons,
      credits: response.data.credits,
      videos: response.data.videos,
      similar: response.data.similar ? {
        ...response.data.similar,
        results: response.data.similar.results.map(item => formatMediaData(item, 'tv'))
      } : null,
      recommendations: response.data.recommendations ? {
        ...response.data.recommendations,
        results: response.data.recommendations.results.map(item => formatMediaData(item, 'tv'))
      } : null
    };

    res.json(formattedData);
  } catch (error) {
    console.error('Error fetching TV show details:', error);
    res.status(500).json({ error: 'Failed to fetch TV show details' });
  }
});

// Get TV show recommendations (separate endpoint for compatibility)
app.get('/api/tv/:id/recommendations', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${config.TMDB_BASE_URL}/tv/${id}/recommendations`, {
      headers: tmdbHeaders,
      params: { page: req.query.page || 1 }
    });

    const formattedData = {
      ...response.data,
      results: response.data.results.map(item => formatMediaData(item, 'tv'))
    };

    res.json(formattedData);
  } catch (error) {
    console.error('Error fetching TV show recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch TV show recommendations' });
  }
});

// Get TV show videos (separate endpoint for compatibility)
app.get('/api/tv/:id/videos', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${config.TMDB_BASE_URL}/tv/${id}/videos`, {
      headers: tmdbHeaders
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching TV show videos:', error);
    res.status(500).json({ error: 'Failed to fetch TV show videos' });
  }
});

// Get TV season details
app.get('/api/tv/:id/season/:season_number', async (req, res) => {
  try {
    const { id, season_number } = req.params;
    const response = await axios.get(`${config.TMDB_BASE_URL}/tv/${id}/season/${season_number}`, {
      headers: tmdbHeaders
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching TV season details:', error);
    res.status(500).json({ error: 'Failed to fetch TV season details' });
  }
});

// Watch history routes
app.get('/api/watched/:tmdb_id/:media_type', (req, res) => {
  const { tmdb_id, media_type } = req.params;
  
  db.all(
    `SELECT * FROM watch_history 
     WHERE tmdb_id = ? AND media_type = ? 
     ORDER BY season_number, episode_number`,
    [tmdb_id, media_type],
    (err, rows) => {
    if (err) {
        console.error('Error fetching watch history:', err);
        res.status(500).json({ error: 'Failed to fetch watch history' });
    } else {
      res.json({ episodes: rows });
    }
    }
  );
});

app.post('/api/watched', (req, res) => {
  const { tmdb_id, media_type, title, season_number, episode_number, poster_path } = req.body;
  
  if (!tmdb_id || !media_type || !title) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  db.run(
    `INSERT OR REPLACE INTO watch_history 
     (tmdb_id, media_type, title, season_number, episode_number, watched_at) 
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [tmdb_id, media_type, title, season_number, episode_number],
    function(err) {
      if (err) {
        console.error('Error adding to watch history:', err);
        res.status(500).json({ error: 'Failed to add to watch history' });
      } else {
        res.json({ success: true, id: this.lastID });
      }
    }
  );
});

// Delete from watch history - accepts JSON body
app.delete('/api/watched', (req, res) => {
  const { tmdb_id, media_type, season_number, episode_number } = req.body;

  if (!tmdb_id || !media_type) {
    return res.status(400).json({ error: 'Missing tmdb_id or media_type' });
  }

  let query = 'DELETE FROM watch_history WHERE tmdb_id = ? AND media_type = ?';
  let params = [tmdb_id, media_type];

  if (season_number !== undefined) {
    query += ' AND season_number = ?';
    params.push(season_number);
  }
  if (episode_number !== undefined) {
    query += ' AND episode_number = ?';
    params.push(episode_number);
  }

  db.run(query, params, function(err) {
    if (err) {
      console.error('Error removing from watch history:', err);
      res.status(500).json({ error: 'Failed to remove from watch history' });
    } else {
      res.json({ success: true, changes: this.changes });
    }
  });
});

// Delete from watch history - backward compatibility with URL params
app.delete('/api/watched/:tmdb_id/:media_type', (req, res) => {
  const { tmdb_id, media_type } = req.params;
  // Accept both query params and JSON body for flexibility
  const { season_number, episode_number } = { ...req.query, ...req.body };

  let query = 'DELETE FROM watch_history WHERE tmdb_id = ? AND media_type = ?';
  let params = [tmdb_id, media_type];

  if (season_number !== undefined) {
    query += ' AND season_number = ?';
    params.push(season_number);
  }
  if (episode_number !== undefined) {
    query += ' AND episode_number = ?';
    params.push(episode_number);
  }

  db.run(query, params, function(err) {
    if (err) {
      console.error('Error removing from watch history:', err);
      res.status(500).json({ error: 'Failed to remove from watch history' });
    } else {
      res.json({ success: true, changes: this.changes });
    }
  });
});

// Lobster search endpoint
app.get('/api/lobster/search/:query', async (req, res) => {
  try {
    let { query } = req.params;
    const base = 'flixhq.to';
    
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    const formattedQuery = query.replace(/\s+/g, '-').replace(/^-+/, '');
    const searchUrl = `https://${base}/search/${encodeURIComponent(formattedQuery)}`;
    const curlCmd = `curl -s "${searchUrl}" | sed ':a;N;$!ba;s/\\n//g;s/class="flw-item"/\\n/g' | sed -nE 's@.*img data-src="([^"]*)".*<a href=".*/((tv|movie))/watch-.*-([0-9]*)".*title="([^"]*)".*class="fdi-item">([^<]*)</span>.*@\\1\\t\\4\\t\\3\\t\\5 [\\6]@p'`;
    
    const { stdout } = await execAsync(curlCmd);
    
    if (!stdout.trim()) {
      return res.json({ results: [], message: 'No results found' });
    }
    
    const results = stdout.trim().split('\n').map(line => {
      const [image_url, media_id, media_type, titleWithYear] = line.split('\t');
      const title = titleWithYear.replace(/ \[.*\]$/, '');
      const year = titleWithYear.match(/\[(.+)\]$/)?.[1] || '';
      
      return {
        id: media_id,
        title,
        media_type,
        year,
        image_url,
        raw_line: line
      };
    });

    res.json({ results });
  } catch (error) {
    console.error('Lobster search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get TV show seasons from lobster
app.get('/api/lobster/seasons/:media_id', async (req, res) => {
  try {
    const { media_id } = req.params;
    const base = 'flixhq.to';
    
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    console.log(`🔍 Looking for seasons for media_id: ${media_id}`);
    
    // Use the exact method from lobster.sh
    const seasonsUrl = `https://${base}/ajax/v2/tv/seasons/${media_id}`;
    console.log(`🌐 Using lobster.sh method: ${seasonsUrl}`);
    
    const curlCmd = `curl -s "${seasonsUrl}"`;
    const { stdout } = await execAsync(curlCmd);
    
    console.log(`📄 Raw response: ${stdout.substring(0, 300)}...`);
    
    // Parse using the exact sed command from lobster.sh
    const parseCmd = `echo '${stdout.replace(/'/g, "'\\''")}' | sed -nE 's@.*href=".*-([0-9]*)">(.*)</a>@\\2\\t\\1@p'`;
    const { stdout: seasonData } = await execAsync(parseCmd);
    
    console.log(`🎭 Parsed season data: ${seasonData}`);
    
    if (!seasonData.trim()) {
      console.log('🚧 No seasons found, creating default season');
      return res.json({ 
        seasons: [{
          id: media_id,
          title: 'Season 1',
          overview: 'Default season',
          episode_count: 0
        }]
      });
    }
    
    const seasons = seasonData.trim().split('\n').map(line => {
      const [title, id] = line.split('\t');
      return {
        id: id.trim(),
        title: title.trim(),
        overview: title.trim(),
        episode_count: 0
      };
    });
    
    console.log(`✅ Returning ${seasons.length} seasons:`, seasons);
    res.json({ seasons });
    
  } catch (error) {
    console.error('Lobster seasons error:', error);
    res.status(500).json({ error: 'Failed to fetch seasons' });
  }
});

// Get episodes for a season from lobster
app.get('/api/lobster/episodes/:season_id', async (req, res) => {
  try {
    const { season_id } = req.params;
    const base = 'flixhq.to';
    
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    console.log(`🔍 Looking for episodes for season_id: ${season_id}`);
    
    // Use the exact method from lobster.sh
    const episodesUrl = `https://${base}/ajax/v2/season/episodes/${season_id}`;
    console.log(`🌐 Using lobster.sh method: ${episodesUrl}`);
    
    const curlCmd = `curl -s "${episodesUrl}"`;
    const { stdout } = await execAsync(curlCmd);
    
    console.log(`📄 Raw response: ${stdout.substring(0, 300)}...`);
    
    // Parse using the exact command from lobster.sh
    const parseCmd = `echo '${stdout.replace(/'/g, "'\\''")}' | sed ':a;N;$!ba;s/\\n//g;s/class="nav-item"/\\n/g' | sed -nE 's@.*data-id="([0-9]*)".*title="([^"]*)">.*@\\2\\t\\1@p'`;
    const { stdout: episodeData } = await execAsync(parseCmd);
    
    console.log(`🎭 Parsed episode data: ${episodeData}`);
    
    if (!episodeData.trim()) {
      console.log('🚧 No episodes found, creating default episodes');
      return res.json({ 
        episodes: Array.from({ length: 10 }, (_, index) => ({
          id: index + 1,
          data_id: `default-${season_id}-${index + 1}`,
          title: `Episode ${index + 1}`,
          overview: `Episode ${index + 1}`,
          episode_number: index + 1
        }))
      });
    }
    
    const episodes = episodeData.trim().split('\n').map((line, index) => {
      const [title, data_id] = line.split('\t');
      return {
        id: index + 1,
        data_id: data_id.trim(),
        title: title.trim(),
        overview: `Episode ${index + 1}`,
        episode_number: index + 1
      };
    });
    
    console.log(`✅ Returning ${episodes.length} episodes:`, episodes.slice(0, 3));
    res.json({ episodes });
    
  } catch (error) {
    console.error('Lobster episodes error:', error);
    res.status(500).json({ error: 'Failed to fetch episodes' });
  }
});

// Lobster sources endpoint (simplified - returns flixhq.to URLs for frontend to handle)
app.post('/api/lobster/sources', async (req, res) => {
  try {
    const { media_id, media_type, season, episode } = req.body;
    
    if (!media_id || !media_type) {
      return res.status(400).json({ error: 'Missing media_id or media_type' });
    }

    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    let episodeUrl;
    
    if (media_type === 'movie') {
      episodeUrl = `https://flixhq.to/movie/watch-movie-${media_id}`;
    } else {
      const searchUrl = `https://flixhq.to/tv/watch-tv-${media_id}`;
      const curlCmd = `curl -s "${searchUrl}" | sed ':a;N;$!ba;s/\\n//g;s/class="ss-item ep-item"/\\n/g' | sed -nE 's@.*data-id="([0-9]*)".*title="Eps ([0-9]*):.*@\\1\\t\\2@p' | awk -F'\\t' '$2==${episode} {print $1; exit}'`;
      const { stdout } = await execAsync(curlCmd.replace('${episode}', episode));
      
      if (!stdout.trim()) {
        return res.status(404).json({ error: 'Episode not found' });
      }
      
      const episodeId = stdout.trim();
      episodeUrl = `https://flixhq.to/ajax/v2/episode/servers/${episodeId}`;
    }

    // Return the URL for frontend to handle
    res.json({
      success: true,
      episode_url: episodeUrl,
      media_id,
      media_type,
      season,
      episode,
      message: 'Frontend should handle direct URL extraction'
    });

  } catch (error) {
    console.error('Lobster sources error:', error);
    res.status(500).json({ error: 'Failed to get video sources' });
  }
});

// Direct URL extraction endpoint (exactly like lobster.sh)
app.post('/api/lobster/extract-direct-url', async (req, res) => {
  try {
    const { media_id, media_type, data_id, provider = 'Vidcloud', quality, subtitle_language = 'english' } = req.body;
    
    console.log('🦞 Extracting direct URL like lobster.sh...');
    console.log(`🎬 Media type: ${media_type}, Subtitle language preference: ${subtitle_language}`);
    
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    let episode_id;
    
    if (media_type === 'movie') {
      const movieUrl = `https://flixhq.to/ajax/movie/episodes/${media_id}`;
      const movieCmd = `curl -s "${movieUrl}" | sed ':a;N;$!ba;s/\\n//g;s/class="nav-item"/\\n/g' | sed -nE 's@.*href="([^"]*)"[[:space:]]*title="${provider}".*@\\1@p'`;
      const { stdout: moviePage } = await execAsync(movieCmd);
      
      if (!moviePage.trim()) {
        return res.status(404).json({ error: 'Movie not found or provider unavailable' });
      }
      
      episode_id = moviePage.trim().split('-').pop().split('.').pop();
    } else {
      const serversUrl = `https://flixhq.to/ajax/v2/episode/servers/${data_id}`;
      const serversCmd = `curl -s "${serversUrl}" | sed ':a;N;$!ba;s/\\n//g;s/class="nav-item"/\\n/g' | sed -nE 's@.*data-id="([0-9]*)".*title="([^"]*)".*@\\1\\t\\2@p' | grep "${provider}" | cut -f1 | head -n1`;
      const { stdout: episodeIdResult } = await execAsync(serversCmd);
      
      if (!episodeIdResult.trim()) {
        return res.status(404).json({ error: 'Episode not found or provider unavailable' });
      }
      
      episode_id = episodeIdResult.trim();
    }
    
    console.log(`🎯 Episode ID: ${episode_id}`);
    
    // Get embed link
    const embedUrl = `https://flixhq.to/ajax/episode/sources/${episode_id}`;
    const embedCmd = `curl -s "${embedUrl}" | sed -nE 's_.*"link":"([^"]*)".*_\\1_p'`;
    const { stdout: embed_link } = await execAsync(embedCmd);
    
    if (!embed_link.trim()) {
      return res.status(500).json({ error: 'Could not get embed link' });
    }
    
    console.log(`🔗 Embed link: ${embed_link.trim()}`);
    
    // Parse embed link
    const embedParts = embed_link.trim().match(/(.*)\/embed-(1|2)\/(.*)\?z=$/);
    if (!embedParts) {
      return res.status(500).json({ error: 'Invalid embed link format' });
    }
    
    const [, provider_link, , source_path] = embedParts;
    const source_id = source_path.split('/').pop();
    
    console.log(`🆔 Source ID: ${source_id}`);
    
    // Get JSON data
    const sourcesUrl = `${provider_link}/embed-1/v2/e-1/getSources?id=${source_id}`;
    const sourcesCmd = `curl -s "${sourcesUrl}" -H "X-Requested-With: XMLHttpRequest"`;
    const { stdout: json_data } = await execAsync(sourcesCmd);
    
    if (!json_data.trim()) {
      return res.status(500).json({ error: 'Could not get video sources' });
    }
    
    console.log(`📊 JSON data length: ${json_data.length} characters`);
    
    let videoSources;
    try {
      videoSources = JSON.parse(json_data);
    } catch (e) {
      return res.status(500).json({ error: 'Invalid video sources format' });
    }
    
    // Extract subtitles: always return all subtitle/caption tracks so UI can display every option
    let subtitles = [];
    if (videoSources.tracks && Array.isArray(videoSources.tracks)) {
      subtitles = videoSources.tracks
        .filter(track => track.kind === 'captions' || track.kind === 'subtitles')
        .map(track => ({
          url: track.file,
          label: track.label || '',
          language: track.language || track.label?.toLowerCase()?.substring(0, 2) || 'en',
          kind: track.kind || 'subtitles'
        }));
      console.log(`🔤 Raw videoSources.tracks:`, videoSources.tracks);
      console.log(`🔤 Filtered subtitles:`, subtitles);
      console.log(`🔤 Returning ${subtitles.length} subtitle tracks to client`);
    }
    
    // Process encrypted sources
    let video_link = null;
    
    if (videoSources.sources && typeof videoSources.sources === 'string') {
      try {
        const keyResponse = await execAsync(`curl -s "https://raw.githubusercontent.com/eatmynerds/key/refs/heads/e1/key.txt"`);
        const key = keyResponse.stdout.trim();
        
        if (key) {
          const decryptCmd = `echo "${videoSources.sources}" | base64 -d | openssl enc -aes-256-cbc -d -md md5 -k "${key}" 2>/dev/null`;
          try {
            const { stdout: decryptedData } = await execAsync(decryptCmd);
            if (decryptedData.trim()) {
              const decryptedSources = JSON.parse(decryptedData);
              if (decryptedSources && decryptedSources.length > 0) {
                video_link = decryptedSources[0].file;
              }
            }
          } catch (decryptError) {
            console.log('Decryption failed, trying direct sources');
          }
        }
      } catch (keyError) {
        console.log('Could not fetch decryption key');
      }
    }
    
    // Fallback to direct sources
    if (!video_link && videoSources.sources && Array.isArray(videoSources.sources)) {
      video_link = videoSources.sources[0]?.file;
    }
    
    if (!video_link) {
      return res.status(500).json({ error: 'Could not extract video URL' });
    }
    
    // Apply quality filter
    if (quality && video_link.includes('/playlist.m3u8')) {
      video_link = video_link.replace('/playlist.m3u8', `/${quality}/index.m3u8`);
    }
    
    console.log(`🎬 Final video URL: ${video_link}`);
    console.log(`📝 Subtitles found: ${subtitles.length}`);
    
    res.json({
      success: true,
      method: 'lobster.sh-exact',
      video_url: video_link,
      embed_link: embed_link.trim(),
      subtitles: subtitles,
      raw_json: json_data,
      instructions: {
        mpv: `mpv "${video_link}"`,
        vlc: `vlc "${video_link}"`,
        download: `curl -o video.m3u8 "${video_link}"`
      }
    });
    
  } catch (error) {
    console.error('❌ Direct URL extraction error:', error);
    res.status(500).json({ error: 'Failed to extract direct URL', details: error.message });
  }
});

// Simple subtitle endpoint
app.get('/api/subtitles', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter required' });
  }

  try {
    const subtitleData = await fetchSubtitles(url);
    res.setHeader('Content-Type', 'text/vtt');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(subtitleData);
  } catch (error) {
    console.error('Subtitle fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch subtitles' });
  }
});

// Simple manifest endpoint (for compatible CDNs only)
app.get('/api/manifest', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter required' });
  }

  try {
    const urlDomain = new URL(url).hostname;
    const problematicDomains = ['dewflare', 'cloudveil', 'breezefall', 'frostblink'];
    
    if (problematicDomains.some(domain => urlDomain.includes(domain))) {
      return res.status(422).json({ 
        error: 'Domain not supported', 
        domain: urlDomain,
        suggestion: 'Use direct video URLs with external players like mpv or VLC'
      });
    }

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(response.data);
  } catch (error) {
    console.error('Manifest fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch manifest' });
  }
});

// Lists API Routes
// Get all lists
app.get('/api/lists', (req, res) => {
  db.all('SELECT * FROM lists ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Error fetching lists:', err);
      res.status(500).json({ error: 'Failed to fetch lists' });
      } else {
      res.json(rows);
    }
  });
});

// Create new list
app.post('/api/lists', (req, res) => {
  const { name, description } = req.body;
  
  const stmt = db.prepare('INSERT INTO lists (name, description) VALUES (?, ?)');
  stmt.run(name, description, function(err) {
    if (err) {
      console.error('Error creating list:', err);
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(400).json({ error: 'List name already exists' });
      } else {
        res.status(500).json({ error: 'Failed to create list' });
      }
    } else {
      res.json({ id: this.lastID, name, description, message: 'List created successfully' });
    }
  });
  stmt.finalize();
});

// Get list items
app.get('/api/lists/:id/items', (req, res) => {
  const { id } = req.params;
  
  db.all('SELECT * FROM list_items WHERE list_id = ? ORDER BY added_at DESC', [id], (err, rows) => {
    if (err) {
      console.error('Error fetching list items:', err);
      res.status(500).json({ error: 'Failed to fetch list items' });
    } else {
      res.json(rows);
    }
  });
});

// Add item to list
app.post('/api/lists/:id/items', (req, res) => {
  const { id } = req.params;
  const { tmdb_id, media_type, title, poster_path, backdrop_path, overview, release_date, vote_average, vote_count, genres } = req.body;
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO list_items 
    (list_id, tmdb_id, media_type, title, poster_path, backdrop_path, overview, release_date, vote_average, vote_count, genres)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, tmdb_id, media_type, title, poster_path, backdrop_path, overview, release_date, vote_average, vote_count, genres, function(err) {
    if (err) {
      console.error('Error adding item to list:', err);
      res.status(500).json({ error: 'Failed to add item to list' });
    } else {
      res.json({ id: this.lastID, message: 'Item added to list' });
    }
  });
  
  stmt.finalize();
});

// Remove item from list
app.delete('/api/lists/:list_id/items/:tmdb_id/:media_type', (req, res) => {
  const { list_id, tmdb_id, media_type } = req.params;
  
  // First check if this is the "Favorites" list
  db.get('SELECT name FROM lists WHERE id = ?', [list_id], (err, list) => {
    if (err) {
      console.error('Error checking list name:', err);
      res.status(500).json({ error: 'Failed to check list' });
      return;
    }
    
    // Remove from the list
    db.run('DELETE FROM list_items WHERE list_id = ? AND tmdb_id = ? AND media_type = ?', [list_id, tmdb_id, media_type], function(err) {
      if (err) {
        console.error('Error removing item from list:', err);
        res.status(500).json({ error: 'Failed to remove item from list' });
        return;
      }
      
      // If this is the "Favorites" list, also remove from favorites table
      if (list && list.name === 'Favorites') {
        db.run('DELETE FROM favorites WHERE tmdb_id = ? AND media_type = ?', [tmdb_id, media_type], function(favErr) {
          if (favErr) {
            console.error('Error removing from favorites:', favErr);
            // Don't fail the request, just log the error
          }
          res.json({ message: 'Item removed from list and favorites' });
        });
      } else {
        res.json({ message: 'Item removed from list' });
      }
    });
  });
});

// Delete list
app.delete('/api/lists/:id', (req, res) => {
  const { id } = req.params;
  
  // Don't allow deletion of the default "Favorites" list
  db.get('SELECT name FROM lists WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Error checking list:', err);
      res.status(500).json({ error: 'Failed to check list' });
      return;
    }
    
    if (row && row.name === 'Favorites') {
      res.status(400).json({ error: 'Cannot delete the Favorites list' });
      return;
    }

    db.run('DELETE FROM lists WHERE id = ?', [id], function(err) {
      if (err) {
        console.error('Error deleting list:', err);
        res.status(500).json({ error: 'Failed to delete list' });
      } else {
        res.json({ message: 'List deleted successfully' });
      }
    });
  });
});

// Favorites API Routes
// Get all favorites
app.get('/api/favorites', (req, res) => {
  db.all('SELECT * FROM favorites ORDER BY created_at DESC', (err, rows) => {
      if (err) {
      console.error('Error fetching favorites:', err);
      res.status(500).json({ error: 'Failed to fetch favorites' });
      } else {
        res.json(rows);
      }
  });
});

// Add to favorites
app.post('/api/favorites', (req, res) => {
  const { tmdb_id, media_type, title, poster_path, backdrop_path, overview, release_date, vote_average, vote_count, genres } = req.body;
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO favorites 
    (tmdb_id, media_type, title, poster_path, backdrop_path, overview, release_date, vote_average, vote_count, genres)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(tmdb_id, media_type, title, poster_path, backdrop_path, overview, release_date, vote_average, vote_count, genres, function(err) {
      if (err) {
      console.error('Error adding to favorites:', err);
      res.status(500).json({ error: 'Failed to add to favorites' });
      } else {
      // Also add to the "Favorites" list
      db.get('SELECT id FROM lists WHERE name = "Favorites"', (err, list) => {
        if (!err && list) {
          const listStmt = db.prepare(`
            INSERT OR REPLACE INTO list_items 
            (list_id, tmdb_id, media_type, title, poster_path, backdrop_path, overview, release_date, vote_average, vote_count, genres)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          listStmt.run(list.id, tmdb_id, media_type, title, poster_path, backdrop_path, overview, release_date, vote_average, vote_count, genres);
          listStmt.finalize();
        }
      });
      
      res.json({ id: this.lastID, message: 'Added to favorites' });
    }
  });
  
  stmt.finalize();
});

// Remove from favorites
app.delete('/api/favorites/:tmdb_id/:media_type', (req, res) => {
  const { tmdb_id, media_type } = req.params;
  
  db.run('DELETE FROM favorites WHERE tmdb_id = ? AND media_type = ?', [tmdb_id, media_type], function(err) {
      if (err) {
      console.error('Error removing from favorites:', err);
      res.status(500).json({ error: 'Failed to remove from favorites' });
      } else {
      // Also remove from the "Favorites" list
      db.get('SELECT id FROM lists WHERE name = "Favorites"', (err, list) => {
        if (!err && list) {
          db.run('DELETE FROM list_items WHERE list_id = ? AND tmdb_id = ? AND media_type = ?', [list.id, tmdb_id, media_type]);
      }
      });
      
      res.json({ message: 'Removed from favorites' });
    }
  });
});

// Check if item is favorited
app.get('/api/favorites/:tmdb_id/:media_type', (req, res) => {
  const { tmdb_id, media_type } = req.params;
  
  db.get('SELECT id FROM favorites WHERE tmdb_id = ? AND media_type = ?', [tmdb_id, media_type], (err, row) => {
      if (err) {
      console.error('Error checking favorite status:', err);
      res.status(500).json({ error: 'Failed to check favorite status' });
      } else {
      res.json({ isFavorited: !!row });
    }
  });
});

// Settings API Routes
// Get all settings
app.get('/api/settings', (req, res) => {
  db.all('SELECT * FROM user_settings', (err, rows) => {
      if (err) {
      console.error('Error fetching settings:', err);
      res.status(500).json({ error: 'Failed to fetch settings' });
      } else {
      const settings = {};
      rows.forEach(row => {
        settings[row.key] = row.value;
      });
      res.json(settings);
    }
  });
});

// Update setting
app.put('/api/settings/:key', (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  
  const stmt = db.prepare('INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)');
  stmt.run(key, value, function(err) {
      if (err) {
      console.error('Error updating setting:', err);
      res.status(500).json({ error: 'Failed to update setting' });
      } else {
      res.json({ message: 'Setting updated successfully' });
    }
  });
  stmt.finalize();
});

// Get user's subtitle language preference
app.get('/api/settings/subtitle-language', (req, res) => {
  db.get('SELECT value FROM user_settings WHERE key = ?', ['subtitle_language'], (err, row) => {
    if (err) {
      console.error('Error fetching subtitle language:', err);
      res.status(500).json({ error: 'Failed to fetch subtitle language' });
    } else {
      res.json({ subtitle_language: row?.value || 'english' });
    }
  });
});

// Set user's subtitle language preference
app.put('/api/settings/subtitle-language', (req, res) => {
  const { language } = req.body;
  
  console.log('🔤 Received subtitle language update request:', { language, body: req.body });
  
  if (!language) {
    console.log('❌ No language parameter provided');
    return res.status(400).json({ error: 'Language parameter required' });
  }
  
  const stmt = db.prepare('INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)');
  stmt.run('subtitle_language', language, function(err) {
    if (err) {
      console.error('Error updating subtitle language:', err);
      res.status(500).json({ error: 'Failed to update subtitle language' });
    } else {
      console.log('✅ Subtitle language updated successfully:', language);
      res.json({ message: 'Subtitle language updated successfully', language });
    }
  });
  stmt.finalize();
});

// Subtitle proxy endpoint (for CORS issues with subtitle files)
app.get('/api/subtitle-proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL parameter required' });
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'text/plain';
    const content = await response.text();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(content);
  } catch (error) {
    console.error('Subtitle proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch subtitle' });
  }
});

// Serve React app for all other routes
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
} else {
  app.get('*', (req, res) => {
    res.status(404).json({ 
      error: 'Route not found', 
      message: 'This is the API server. The React app should be running on port 3000.' 
    });
  });
}

// Initialize database and start server
const PORT = config.PORT;

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Lobster Web Interface server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

startServer(); 