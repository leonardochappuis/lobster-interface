module.exports = {
  PORT: process.env.PORT || 5000,
  // TMDB API credentials - CORRECTED VALUES
  TMDB_API_KEY: '',  // API Key (short string)
  TMDB_API_TOKEN: '',  // Bearer Token (long JWT)
  TMDB_BASE_URL: 'https://api.themoviedb.org/3',
  TMDB_IMAGE_BASE_URL: 'https://image.tmdb.org/t/p',
  LOBSTER_SCRIPT_PATH: '../lobster.sh',
  DB_PATH: './database.sqlite'
}; 
