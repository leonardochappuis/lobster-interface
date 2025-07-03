import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { FaTimes, FaSave, FaSpinner, FaGlobe } from 'react-icons/fa';
import toast from 'react-hot-toast';

const SettingsModal = ({ isOpen, onClose }) => {
  const [subtitleLanguage, setSubtitleLanguage] = useState('english');
  const queryClient = useQueryClient();

  // Common subtitle languages
  const languages = [
    { value: 'english', label: 'English' },
    { value: 'spanish', label: 'Spanish' },
    { value: 'french', label: 'French' },
    { value: 'german', label: 'German' },
    { value: 'italian', label: 'Italian' },
    { value: 'portuguese', label: 'Portuguese' },
    { value: 'japanese', label: 'Japanese' },
    { value: 'korean', label: 'Korean' },
    { value: 'chinese', label: 'Chinese' },
    { value: 'arabic', label: 'Arabic' },
    { value: 'russian', label: 'Russian' }
  ];

  // Get current settings
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => axios.get('/api/settings').then(res => res.data),
    refetchOnWindowFocus: false
  });

  // Update subtitle language
  const updateSubtitleLanguageMutation = useMutation({
    mutationFn: (language) => 
      axios.put('/api/settings/subtitle-language', { language }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Subtitle language updated');
    },
    onError: (error) => {
      toast.error('Failed to update subtitle language');
      console.error('Settings update error:', error);
    }
  });

  // Load current settings when the modal opens
  useEffect(() => {
    if (settings) {
      setSubtitleLanguage(settings.subtitle_language || 'english');
    }
  }, [settings, isOpen]);

  const handleSaveSettings = () => {
    const trimmedLanguage = subtitleLanguage?.trim();
    
    if (!trimmedLanguage || trimmedLanguage === '') {
      toast.error('Please select a valid subtitle language');
      return;
    }
    
    console.log('🔤 SettingsModal: Sending subtitle language:', trimmedLanguage);
    updateSubtitleLanguageMutation.mutate(trimmedLanguage);
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box relative max-w-3xl">
        <button
          className="btn btn-sm btn-circle absolute right-2 top-2"
          onClick={onClose}
        >
          <FaTimes />
        </button>
        
        <h3 className="font-bold text-xl mb-6">Settings</h3>
        
        {isLoadingSettings ? (
          <div className="flex justify-center my-8">
            <FaSpinner className="animate-spin text-2xl text-primary" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Subtitle Settings Section */}
            <div className="bg-base-200 p-4 rounded-lg">
              <h4 className="text-lg font-medium flex items-center gap-2 mb-4">
                <FaGlobe /> Subtitle Settings
              </h4>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Preferred Subtitle Language</span>
                </label>
                <select
                  className="select select-bordered w-full max-w-xs"
                  value={subtitleLanguage}
                  onChange={(e) => setSubtitleLanguage(e.target.value)}
                >
                  {languages.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
                <label className="label">
                  <span className="label-text-alt">
                    This will be used as your default subtitle language when available
                  </span>
                </label>
              </div>
            </div>
            
            {/* Save Button */}
            <div className="flex justify-end">
              <button
                className="btn btn-primary gap-2"
                onClick={handleSaveSettings}
                disabled={updateSubtitleLanguageMutation.isPending}
              >
                {updateSubtitleLanguageMutation.isPending ? (
                  <FaSpinner className="animate-spin" />
                ) : (
                  <FaSave />
                )}
                Save Settings
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
};

export default SettingsModal; 