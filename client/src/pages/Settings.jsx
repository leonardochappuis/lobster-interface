import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FaCog, FaSpinner, FaLanguage, FaDesktop } from 'react-icons/fa';

const Settings = () => {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState({});

  // Fetch current settings
  const { isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => axios.get('/api/settings').then(res => res.data),
    onSuccess: (data) => {
      setSettings(data);
    },
    refetchOnWindowFocus: false
  });

  // Update setting mutation
  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }) => axios.put(`/api/settings/${key}`, { value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings updated successfully!');
    },
    onError: () => {
      toast.error('Failed to update settings');
    }
  });

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    updateSettingMutation.mutate({ key, value });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <FaSpinner className="animate-spin text-4xl text-primary" />
        <p className="text-lg text-base-content/70">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <FaCog className="text-4xl text-primary" />
          <h1 className="text-4xl font-bold">Lobster Settings</h1>
        </div>
        <p className="text-base-content/70 max-w-2xl mx-auto">
          Configure default options for lobster script execution
        </p>
      </div>

      {/* Settings Form */}
      <div className="max-w-7xl mx-auto space-y-6 px-4">

        {/* Provider Section */}
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <div className="flex items-center gap-3 mb-4">
              <FaDesktop className="text-xl text-primary" />
              <h2 className="card-title">Streaming Provider</h2>
            </div>
            <div className="form-control flex flex-col space-y-2">
              <label className="label">
                <span className="label-text font-medium">Default Provider</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={settings.lobster_provider || 'Vidcloud'}
                onChange={(e) => handleSettingChange('lobster_provider', e.target.value)}
              >
                <option value="Vidcloud">Vidcloud (Recommended)</option>
                <option value="UpCloud">UpCloud</option>
              </select>
              <p className="text-sm text-base-content/70">
                Vidcloud generally offers better reliability
              </p>
            </div>
          </div>
        </div>

        {/* Language Section */}
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <div className="flex items-center gap-3 mb-4">
              <FaLanguage className="text-xl text-primary" />
              <h2 className="card-title">Language & Subtitles</h2>
            </div>
            <div className="form-control flex flex-col space-y-2">
              <label className="label">
                <span className="label-text font-medium">Default Subtitle Language</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={settings.lobster_language || 'english'}
                onChange={(e) => handleSettingChange('lobster_language', e.target.value)}
              >
                <option value="english">English</option>
                <option value="spanish">Spanish</option>
                <option value="french">French</option>
                <option value="german">German</option>
                <option value="italian">Italian</option>
                <option value="portuguese">Portuguese</option>
                <option value="russian">Russian</option>
                <option value="japanese">Japanese</option>
                <option value="korean">Korean</option>
                <option value="chinese">Chinese</option>
              </select>
              <p className="text-sm text-base-content/70">
                This will be used as the default subtitle track in the video player
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Settings; 