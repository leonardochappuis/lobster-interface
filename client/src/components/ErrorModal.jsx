import React from 'react';
import { FaTimes } from 'react-icons/fa';

const ErrorModal = ({ isOpen, onClose, title = "Error", message, onRetry }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-base-100 rounded-box shadow-2xl w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 bg-error/20 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-error">{title}</h3>
              <p className="text-sm text-base-content/70">Something went wrong</p>
            </div>
            <button 
              className="btn btn-ghost btn-circle btn-sm"
              onClick={onClose}
            >
              <FaTimes />
            </button>
          </div>
          
          <p className="text-base-content mb-6">
            {message}
          </p>
          
          <div className="flex gap-3 justify-end">
            <button 
              className="btn btn-ghost"
              onClick={onClose}
            >
              Close
            </button>
            {onRetry && (
              <button 
                className="btn btn-primary"
                onClick={() => {
                  onClose();
                  onRetry();
                }}
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal; 