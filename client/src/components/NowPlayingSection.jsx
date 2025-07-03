import React from 'react';
import { FaTimes } from 'react-icons/fa';

export default function NowPlayingSection({ title, onClose, children }) {
  return (
    <div className="space-y-6 mb-12">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">{title}</h2>
        {onClose && (
          <button className="btn btn-outline gap-2" onClick={onClose}>
            <FaTimes /> Close Player
          </button>
        )}
      </div>
      <div className="bg-black rounded-lg overflow-hidden aspect-video">
        {children}
      </div>
    </div>
  );
} 