// Frontend video URL extractor - mimics lobster.sh functionality
// Handles direct URL extraction and m3u8/subtitle fetching

export class VideoExtractor {
  constructor() {
    this.baseUrl = 'https://flixhq.to';
    this.serverUrl = window.location.origin;
  }

  // Extract direct video URL using the server endpoint (exactly like lobster.sh)
  async extractDirectUrl(media_id, media_type, data_id = null, provider = 'Vidcloud', quality = null) {
    try {
      console.log('🦞 Frontend: Extracting direct URL...');
      
      // Get user's subtitle language preference
      let subtitle_language = 'english';
      try {
        const langResponse = await fetch(`${this.serverUrl}/api/settings/subtitle-language`);
        if (langResponse.ok) {
          const langData = await langResponse.json();
          subtitle_language = langData.subtitle_language || 'english';
          console.log(`📝 Frontend: Using subtitle language: ${subtitle_language}`);
        }
      } catch (langError) {
        console.log('⚠️ Frontend: Could not fetch subtitle language preference, using default');
      }
      
      const response = await fetch(`${this.serverUrl}/api/lobster/extract-direct-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          media_id,
          media_type,
          data_id,
          provider,
          quality,
          subtitle_language
        })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to extract URL');
      }

      console.log('✅ Frontend: Direct URL extracted:', result.video_url);
      
      return {
        videoUrl: result.video_url,
        subtitles: result.subtitles || [],
        embedLink: result.embed_link,
        instructions: result.instructions,
        method: 'direct-extraction'
      };

    } catch (error) {
      console.error('❌ Frontend: Direct URL extraction failed:', error);
      throw error;
    }
  }

  // Fetch m3u8 manifest content
  async fetchManifest(url) {
    try {
      console.log('📄 Frontend: Fetching manifest:', url);
      
      // Check if this is a problematic domain
      const urlDomain = new URL(url).hostname;
      const problematicDomains = ['dewflare', 'cloudveil', 'breezefall', 'frostblink'];
      const isProblematic = problematicDomains.some(domain => urlDomain.includes(domain));
      
      if (isProblematic) {
        console.log('🚫 Frontend: Problematic domain detected, cannot fetch in browser');
        return {
          success: false,
          error: 'CORS_BLOCKED',
          domain: urlDomain,
          suggestion: 'Use external player (mpv/VLC)'
        };
      }

      // Try direct fetch for compatible domains
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.apple.mpegurl,*/*;q=0.8',
          'User-Agent': navigator.userAgent
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const manifestContent = await response.text();
      
      if (!manifestContent.includes('#EXTM3U')) {
        throw new Error('Invalid manifest format');
      }

      console.log('✅ Frontend: Manifest fetched successfully');
      
      return {
        success: true,
        content: manifestContent,
        contentType: response.headers.get('content-type') || 'application/vnd.apple.mpegurl'
      };

    } catch (error) {
      console.error('❌ Frontend: Manifest fetch failed:', error);
      
      // Check if this is a CORS error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return {
          success: false,
          error: 'CORS_BLOCKED',
          suggestion: 'Use external player (mpv/VLC) or try server endpoint'
        };
      }
      
      throw error;
    }
  }

  // Fetch subtitle content
  async fetchSubtitles(url) {
    try {
      console.log('📝 Frontend: Fetching subtitles:', url);
      
      // Try direct fetch first
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'text/vtt,*/*;q=0.8',
            'User-Agent': navigator.userAgent
          }
        });

        if (response.ok) {
          const subtitleContent = await response.text();
          console.log('✅ Frontend: Subtitles fetched directly');
          return {
            success: true,
            content: subtitleContent,
            method: 'direct'
          };
        }
      } catch (directError) {
        console.log('⚠️ Frontend: Direct subtitle fetch failed, trying server proxy');
      }

      // Fallback to server proxy
      const response = await fetch(`${this.serverUrl}/api/subtitles?url=${encodeURIComponent(url)}`);
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const subtitleContent = await response.text();
      console.log('✅ Frontend: Subtitles fetched via server');
      
      return {
        success: true,
        content: subtitleContent,
        method: 'server-proxy'
      };

    } catch (error) {
      console.error('❌ Frontend: Subtitle fetch failed:', error);
      throw error;
    }
  }

  // Get video sources for a media item
  async getVideoSources(media_id, media_type, season = null, episode = null) {
    try {
      console.log('🎬 Frontend: Getting video sources for:', { media_id, media_type, season, episode });

      // First get the base episode data from server
      const response = await fetch(`${this.serverUrl}/api/lobster/sources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          media_id,
          media_type,
          season,
          episode
        })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const sourceData = await response.json();
      
      if (!sourceData.success) {
        throw new Error(sourceData.error || 'Failed to get sources');
      }

      console.log('✅ Frontend: Got source data from server');
      
      return {
        episode_url: sourceData.episode_url,
        media_id: sourceData.media_id,
        media_type: sourceData.media_type,
        season: sourceData.season,
        episode: sourceData.episode,
        message: 'Ready for direct URL extraction'
      };

    } catch (error) {
      console.error('❌ Frontend: Failed to get video sources:', error);
      throw error;
    }
  }

  // Check if a domain is problematic for browser playback
  isProblematicDomain(url) {
    try {
      const urlDomain = new URL(url).hostname;
      const problematicDomains = ['dewflare', 'cloudveil', 'breezefall', 'frostblink'];
      return problematicDomains.some(domain => urlDomain.includes(domain));
    } catch {
      return false;
    }
  }

  // Generate external player commands
  getExternalPlayerCommands(videoUrl) {
    return {
      mpv: `mpv "${videoUrl}"`,
      vlc: `vlc "${videoUrl}"`,
      download: `curl -o video.m3u8 "${videoUrl}"`,
      yt_dlp: `yt-dlp "${videoUrl}"`
    };
  }

  // Create blob URL for subtitle content (for HLS.js)
  createSubtitleBlobUrl(subtitleContent) {
    try {
      const blob = new Blob([subtitleContent], { type: 'text/vtt' });
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Failed to create subtitle blob URL:', error);
      return null;
    }
  }

  // Clean up blob URLs
  revokeBlobUrl(url) {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }
}

// Create a singleton instance
export const videoExtractor = new VideoExtractor(); 