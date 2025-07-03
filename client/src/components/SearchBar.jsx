import React, { useState } from 'react';
import { FaSearch } from 'react-icons/fa';

const SearchBar = ({ onSearch }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md">
      <div className="relative w-full">
        <input
          type="text"
          className="input input-bordered w-full pr-10 focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="Search movies, TV shows..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search"
        />
        <button
          type="submit"
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-primary"
          aria-label="Submit search"
        >
          <FaSearch />
        </button>
      </div>
    </form>
  );
};

export default SearchBar; 