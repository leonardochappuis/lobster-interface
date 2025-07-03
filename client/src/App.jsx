import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Search from './pages/Search';
import Favorites from './pages/Favorites';
import Lists from './pages/Lists';
import Settings from './pages/Settings';
import MovieDetails from './pages/MovieDetails';
import TVDetails from './pages/TVDetails';
import LobsterPlayer from './components/LobsterPlayer';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  const [lobsterPlayer, setLobsterPlayer] = useState({
    isOpen: false,
    initialTitle: ''
  });

  const openLobsterPlayer = (title = '') => {
    setLobsterPlayer({
      isOpen: true,
      initialTitle: title
    });
  };

  const closeLobsterPlayer = () => {
    setLobsterPlayer({
      isOpen: false,
      initialTitle: ''
    });
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-base-100 text-base-content">
        <Router>
          <Navbar />
          <main className="pt-20 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 pb-8 min-h-screen">
            <div className="max-w-[2000px] mx-auto">
              <Routes>
                <Route path="/" element={<Dashboard onWatch={openLobsterPlayer} />} />
                <Route path="/search" element={<Search onWatch={openLobsterPlayer} />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/lists" element={<Lists />} />
                <Route path="/lists/:id" element={<Lists />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/movie/:id" element={<MovieDetails onWatch={openLobsterPlayer} />} />
                <Route path="/tv/:id" element={<TVDetails onWatch={openLobsterPlayer} />} />
              </Routes>
            </div>
          </main>
        </Router>
        
        <LobsterPlayer
          isOpen={lobsterPlayer.isOpen}
          onClose={closeLobsterPlayer}
          initialTitle={lobsterPlayer.initialTitle}
        />
        
        <Toaster 
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            className: 'toast',
            style: {
              background: 'oklch(var(--b1))',
              color: 'oklch(var(--bc))',
              border: '1px solid oklch(var(--b3))',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
            },
            success: {
              iconTheme: {
                primary: 'oklch(var(--su))',
                secondary: 'oklch(var(--suc))',
              },
            },
            error: {
              iconTheme: {
                primary: 'oklch(var(--er))',
                secondary: 'oklch(var(--erc))',
              },
            },
          }}
        />
      </div>
    </QueryClientProvider>
  );
}

export default App;
