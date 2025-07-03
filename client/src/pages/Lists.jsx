import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import MediaCard from '../components/MediaCard';
import { FaList, FaPlus, FaTrash, FaArrowLeft, FaSpinner } from 'react-icons/fa';

const Lists = () => {
  const { id } = useParams(); // List ID if viewing specific list
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');

  // Fetch all lists
  const { data: lists, isLoading: listsLoading } = useQuery({
    queryKey: ['lists'],
    queryFn: () => axios.get('/api/lists').then(res => res.data),
    refetchOnWindowFocus: false
  });

  // Fetch specific list items if viewing a list
  const { data: listItems, isLoading: itemsLoading } = useQuery({
    queryKey: ['list-items', id],
    queryFn: () => axios.get(`/api/lists/${id}/items`).then(res => res.data),
    enabled: !!id,
    refetchOnWindowFocus: false
  });

  // Create list mutation
  const createListMutation = useMutation({
    mutationFn: (listData) => axios.post('/api/lists', listData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      setShowCreateForm(false);
      setNewListName('');
      setNewListDescription('');
      toast.success('List created successfully!');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to create list');
    }
  });

  // Delete list mutation
  const deleteListMutation = useMutation({
    mutationFn: (listId) => axios.delete(`/api/lists/${listId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      toast.success('List deleted successfully!');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete list');
    }
  });

  // Remove item from list mutation
  const removeFromListMutation = useMutation({
    mutationFn: ({ listId, tmdbId, mediaType }) => 
      axios.delete(`/api/lists/${listId}/items/${tmdbId}/${mediaType}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list-items', id] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['favorite-status'] });
      toast.success('Removed from list');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to remove from list');
    }
  });

  const handleCreateList = (e) => {
    e.preventDefault();
    if (!newListName.trim()) {
      toast.error('Please enter a list name');
      return;
    }
    createListMutation.mutate({
      name: newListName.trim(),
      description: newListDescription.trim()
    });
  };

  const handleDeleteList = (listId, listName) => {
    if (window.confirm(`Are you sure you want to delete the list "${listName}"?`)) {
      deleteListMutation.mutate(listId);
    }
  };

  const handleRemoveFromList = (listId, tmdbId, mediaType, title) => {
    if (window.confirm(`Remove "${title}" from this list?`)) {
      removeFromListMutation.mutate({ listId, tmdbId, mediaType });
    }
  };

  // If viewing a specific list
  if (id) {
    const currentList = lists?.find(list => list.id === parseInt(id));
    
    if (itemsLoading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <FaSpinner className="animate-spin text-4xl text-primary" />
          <p className="text-lg text-base-content/70">Loading list...</p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <Link to="/lists" className="btn btn-ghost gap-2 w-fit">
            <FaArrowLeft />
            Back to Lists
          </Link>
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold">{currentList?.name || 'List'}</h1>
            {currentList?.description && (
              <p className="text-base-content/70 max-w-2xl mx-auto">{currentList.description}</p>
            )}
            {Array.isArray(listItems) && (
              <div className="badge badge-lg badge-outline">
                {listItems.length} {listItems.length === 1 ? 'item' : 'items'}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {!Array.isArray(listItems) || listItems.length === 0 ? (
          <div className="card bg-base-200 shadow-xl max-w-md mx-auto">
            <div className="card-body text-center">
              <div className="text-6xl mb-4">📝</div>
              <h2 className="text-2xl font-bold mb-2">This list is empty</h2>
              <p className="text-base-content/70 mb-6">
                Add movies and TV shows to this list from their detail pages.
              </p>
              <div className="card-actions justify-center">
                <a href="/search" className="btn btn-primary gap-2">
                  <FaPlus />
                  Find Content to Add
                </a>
              </div>
            </div>
          </div>
        ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-8 gap-6">
            {listItems.map((item) => (
              <MediaCard
                key={`list-item-${item.tmdb_id}-${item.media_type}`}
                media={{
                  id: item.tmdb_id,
                  title: item.title,
                  poster_path: item.poster_path,
                  backdrop_path: item.backdrop_path,
                  vote_average: item.vote_average,
                  release_date: item.release_date,
                  media_type: item.media_type,
                  overview: item.overview
                }}
                showRemoveButton={true}
                onRemove={handleRemoveFromList}
                listId={parseInt(id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Main lists page
  if (listsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <FaSpinner className="animate-spin text-4xl text-primary" />
        <p className="text-lg text-base-content/70">Loading lists...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <FaList className="text-4xl text-primary" />
          <h1 className="text-4xl font-bold">My Lists</h1>
        </div>
        <p className="text-base-content/70 max-w-2xl mx-auto">
          Organize your movies and TV shows into custom lists
        </p>
        <button 
          className="btn btn-primary gap-2"
          onClick={() => setShowCreateForm(true)}
        >
          <FaPlus />
          Create New List
        </button>
      </div>

      {/* Create List Form */}
      {showCreateForm && (
        <div className="card bg-base-200 shadow-xl max-w-md mx-auto">
          <div className="card-body">
            <h3 className="card-title">Create New List</h3>
            <form onSubmit={handleCreateList} className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">List Name</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder="Enter list name"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Description (optional)</span>
                </label>
                <textarea
                  className="textarea textarea-bordered"
                  placeholder="Enter description"
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  rows="3"
                />
              </div>
              <div className="card-actions justify-end">
                <button 
                  type="button" 
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewListName('');
                    setNewListDescription('');
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={createListMutation.isPending}
                >
                  {createListMutation.isPending ? (
                    <FaSpinner className="animate-spin" />
                  ) : (
                    'Create List'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lists Grid */}
      {Array.isArray(lists) && lists.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-6">
          {lists.map((list) => (
            <div key={list.id} className="card bg-base-200 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="card-body flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="card-title text-lg mb-2">{list.name}</h3>
                    {list.description && (
                      <p className="text-base-content/70 text-sm">{list.description}</p>
                    )}
                  </div>
                  
                  {list.name !== 'Favorites' && (
                    <div className="dropdown dropdown-end">
                      <div tabIndex={0} role="button" className="btn btn-ghost btn-circle btn-sm">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </div>
                      <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                        <li>
                          <button
                            onClick={() => handleDeleteList(list.id, list.name)}
                            className="text-error"
                          >
                            <FaTrash />
                            Delete List
                          </button>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
                
                {/* Bottom section with created date and view button */}
                <div className="flex items-end justify-between mt-auto">
                  <p className="text-base-content/50 text-xs">
                    Created {new Date(list.created_at).toLocaleDateString()}
                  </p>
                  <Link to={`/lists/${list.id}`} className="btn btn-primary btn-sm">
                    View List
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card bg-base-200 shadow-xl max-w-md mx-auto">
          <div className="card-body text-center">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-2xl font-bold mb-2">No lists yet</h2>
            <p className="text-base-content/70 mb-6">
              Create your first list to organize your favorite content.
            </p>
            <div className="card-actions justify-center">
              <button 
                className="btn btn-primary gap-2"
                onClick={() => setShowCreateForm(true)}
              >
                <FaPlus />
                Create Your First List
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Lists; 