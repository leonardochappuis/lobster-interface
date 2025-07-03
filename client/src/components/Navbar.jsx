import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaBars, FaPalette, FaHeart, FaList, FaCog, FaClock, FaSearch } from 'react-icons/fa';
import SettingsModal from './SettingsModal';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('dark');
  const location = useLocation();
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const themes = [
    'dark', 'light', 'cyberpunk', 'synthwave', 'retro', 'valentine', 
    'halloween', 'aqua', 'lofi', 'black', 'luxury', 'dracula', 
    'business', 'night', 'coffee', 'dim'
  ];

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      setScrolled(isScrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Set initial theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setCurrentTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const isActive = (path) => {
    return location.pathname === path;
  };

  const changeTheme = (theme) => {
    setCurrentTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  };

  const navLinks = [
    { path: '/search', label: 'Search', icon: FaSearch },
    { path: '/lists', label: 'My Lists', icon: FaList },
    { path: '/favorites', label: 'Favorites', icon: FaHeart }
  ];

  return (
    <>
    <div className={`navbar fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled 
        ? 'bg-base-100/95 backdrop-blur-md shadow-lg border-b border-base-300' 
        : 'bg-gradient-to-b from-base-100/80 to-transparent backdrop-blur-sm'
    }`}>
      <div className="navbar-start">
        {/* Mobile menu button */}
        <div className="dropdown lg:hidden">
          <div 
            tabIndex={0} 
            role="button" 
            className="btn btn-ghost btn-circle"
          >
            <FaBars className="w-5 h-5" />
          </div>
          <ul 
            tabIndex={0} 
            className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow-2xl bg-base-100 rounded-box w-64 border border-base-300"
          >
            {navLinks.map((link) => (
              <li key={link.path}>
                <Link 
                  to={link.path}
                  className={`flex items-center gap-3 text-base font-medium ${
                    isActive(link.path) 
                      ? 'active bg-primary text-primary-content' 
                      : 'hover:bg-base-200'
                  }`}
                >
                  <link.icon className="w-5 h-5" />
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <button onClick={() => setShowSettingsModal(true)} className="flex items-center gap-2">
                <FaCog className="w-4 h-4" /> Settings
              </button>
            </li>
          </ul>
        </div>

        {/* Logo */}
        <Link to="/" className="btn btn-ghost text-xl font-bold text-primary hover:text-primary-focus">
          <span className="text-2xl">🦞</span>
          <span className="hidden sm:inline ml-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Lobster
          </span>
        </Link>
      </div>

      {/* Desktop navigation */}
      <div className="navbar-center hidden lg:flex">
        <ul className="menu menu-horizontal px-1 gap-1">
          {navLinks.map((link) => (
            <li key={link.path}>
              <Link
                to={link.path}
                className={`font-medium transition-all duration-200 flex items-center gap-2 ${isActive(link.path) ? 'bg-primary text-primary-content shadow-md' : 'hover:bg-base-200 hover:scale-105'}`}
              >
                <link.icon className="w-4 h-4" />
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="navbar-end gap-2">
        {/* Theme selector */}
        <div className="dropdown dropdown-end">
          <div 
            tabIndex={0} 
            role="button" 
            className="btn btn-ghost btn-circle tooltip tooltip-bottom" 
            data-tip="Change theme"
          >
            <FaPalette className="w-5 h-5" />
          </div>
          <ul 
            tabIndex={0} 
            className="dropdown-content z-[1] p-2 shadow-2xl bg-base-100 rounded-box w-64 max-h-96 overflow-y-auto border border-base-300"
          >
            <li className="p-2 text-sm font-semibold text-base-content/70 border-b border-base-300 mb-2">
              Choose Theme
            </li>
            {themes.map((theme) => (
              <li key={theme}>
                <button
                  onClick={() => changeTheme(theme)}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 capitalize ${
                    currentTheme === theme 
                      ? 'bg-primary text-primary-content shadow-md' 
                      : 'hover:bg-base-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{theme}</span>
                    {currentTheme === theme && <span className="text-xs">✓</span>}
                  </div>
                  <div className="flex gap-1 mt-1">
                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                    <div className="w-3 h-3 rounded-full bg-secondary"></div>
                    <div className="w-3 h-3 rounded-full bg-accent"></div>
                    <div className="w-3 h-3 rounded-full bg-neutral"></div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

          <button 
            className="btn btn-ghost btn-circle"
            onClick={() => setShowSettingsModal(true)}
          >
            <FaCog />
          </button>
        </div>
      </div>

      <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
    </>
  );
};

export default Navbar; 