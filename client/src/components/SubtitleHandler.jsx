import React, { useEffect } from 'react';
import toast from 'react-hot-toast';

/**
 * SubtitleHandler component for managing video subtitles
 * 
 * @param {Object} props
 * @param {React.RefObject} props.videoRef - Reference to the video element
 * @param {Array} props.subtitles - Array of subtitle objects
 * @param {string} props.preferredLanguage - User's preferred subtitle language
 */
const SubtitleHandler = ({ videoRef, subtitles, preferredLanguage = 'english' }) => {
  console.log('🔤 SubtitleHandler: Received subtitles:', subtitles);
  console.log('🔤 SubtitleHandler: Preferred language:', preferredLanguage);
  console.log('🔤 SubtitleHandler: Video ref:', videoRef?.current);

  // Add debugging to the render section
  console.log('🔤 SubtitleHandler: Rendering subtitle buttons:', subtitles?.length || 0);

  // Convert SRT format to VTT format
  const convertSrtToVtt = (srtText) => {
    return 'WEBVTT\n\n' + srtText
      .replace(/\r+/g, '')
      .replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2') // Replace comma with dot in timestamps
      .split(/\n\n+/)
      .map(block => {
        const lines = block.split(/\n/);
        // If it's a numeric counter line, remove it
        if (lines.length > 0 && /^\d+$/.test(lines[0])) {
          lines.shift();
        }
        return lines.join('\n');
      })
      .join('\n\n');
  };

  // Apply subtitles to video
  const applySubtitle = async (subtitle) => {
    if (!videoRef.current) return;

    // If there is already a track with same src or label, simply enable it
    for (const track of Array.from(videoRef.current.textTracks)) {
      const labelMatch = track.label && subtitle.label && track.label.toLowerCase() === subtitle.label.toLowerCase();
      const langMatch = track.language && subtitle.language && track.language.toLowerCase() === subtitle.language.toLowerCase();
      if (labelMatch || langMatch) {
        // Disable others and show this one
        Array.from(videoRef.current.textTracks).forEach(t => (t.mode = 'disabled'));
        track.mode = 'showing';
        toast.success(`Subtitle enabled: ${track.label || track.language}`);
        return;
      }
    }

    // Otherwise follow previous logic of removing and adding
    // Disable existing tracks & remove previous <track> elements (to avoid duplicates)
    Array.from(videoRef.current.textTracks).forEach(track => {
      track.mode = 'disabled';
    });
    Array.from(videoRef.current.querySelectorAll('track')).forEach(el => el.remove());

    try {
      const res = await fetch(subtitle.url);
      const text = await res.text();
      const isVtt = text.trim().startsWith('WEBVTT');
      const vttData = isVtt ? text : convertSrtToVtt(text);
      const blob = new Blob([vttData], { type: 'text/vtt' });
      const blobUrl = URL.createObjectURL(blob);

      const trackElement = document.createElement('track');
      trackElement.kind = 'subtitles';
      trackElement.label = subtitle.label || 'Subtitle';
      trackElement.srclang = subtitle.language || 'en';
      trackElement.default = true;
      trackElement.src = blobUrl;

      trackElement.addEventListener('load', () => {
        trackElement.track.mode = 'showing';
      });

      videoRef.current.appendChild(trackElement);
      videoRef.current.addEventListener(
        'emptied',
        () => URL.revokeObjectURL(blobUrl),
        { once: true }
      );

      toast.success(`Subtitle enabled: ${subtitle.label || 'Subtitle'}`);
    } catch (err) {
      console.error('Subtitle load error:', err);
      toast.error('Failed to load subtitle');
    }
  };

  // Disable all subtitles
  const disableSubtitles = () => {
    if (!videoRef.current) return;
    
    // Disable all tracks
    Array.from(videoRef.current.textTracks).forEach(track => {
      track.mode = 'disabled';
    });
    
    toast.success('Subtitles disabled');
  };

  // Auto-load preferred subtitle on component mount
  useEffect(() => {
    if (!subtitles || !subtitles.length || !videoRef.current) return;

    const preferredLang = preferredLanguage.toLowerCase();
    // Try to find an existing track that matches preferred language
    for (const track of Array.from(videoRef.current.textTracks)) {
      if (
        (track.label && track.label.toLowerCase().includes(preferredLang)) ||
        (track.language && track.language.toLowerCase().includes(preferredLang))
      ) {
        Array.from(videoRef.current.textTracks).forEach(t => (t.mode = 'disabled'));
        track.mode = 'showing';
        return;
      }
    }

    // If not found, proceed with logic to add external subtitle
    const preferredSub = subtitles.find(sub =>
      sub.label && sub.label.toLowerCase().includes(preferredLang)
    );
    if (preferredSub) {
      applySubtitle(preferredSub);
      return;
    }

    // Fallbacks remain unchanged
    const englishSub = subtitles.find(sub =>
      sub.label && sub.label.toLowerCase().includes('english')
    );
    if (englishSub) {
      applySubtitle(englishSub);
    } else if (subtitles.length > 0) {
      applySubtitle(subtitles[0]);
    }
  }, [subtitles, preferredLanguage, videoRef]);

  // Render the subtitle selection UI
  return (
    <div className="mt-4 p-4 bg-base-100 rounded-lg">
      <h4 className="font-semibold mb-2">Subtitles ({subtitles?.length || 0})</h4>
      <div className="flex flex-wrap gap-2">
        <button
          className="btn btn-sm btn-outline"
          onClick={disableSubtitles}
        >
          Off
        </button>
        {subtitles?.map((subtitle, index) => {
          console.log('🔤 Rendering subtitle button:', { index, subtitle });
          return (
            <button
              key={index}
              className="btn btn-sm btn-primary"
              onClick={() => applySubtitle(subtitle)}
            >
              {subtitle.label || `Sub ${index + 1}`}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SubtitleHandler; 