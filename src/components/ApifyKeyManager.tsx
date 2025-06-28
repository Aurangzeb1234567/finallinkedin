import React, { useState, useEffect } from 'react';
import { Key, Plus, Edit3, Trash2, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ApifyKey } from '../lib/supabase';

interface ApifyKeyManagerProps {
  userId: string;
  selectedKeyId?: string;
  onKeySelect: (key: ApifyKey) => void;
}

export const ApifyKeyManager: React.FC<ApifyKeyManagerProps> = ({
  userId,
  selectedKeyId,
  onKeySelect
}) => {
  const [keys, setKeys] = useState<ApifyKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingKey, setEditingKey] = useState<ApifyKey | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({ key_name: '', api_key: '' });
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  useEffect(() => {
    console.log('🔑 ApifyKeyManager: Component mounted with userId:', userId);
    if (userId) {
      loadKeys();
    }
  }, [userId]);

  const loadKeys = async () => {
    console.log('🔑 ApifyKeyManager: Loading keys for userId:', userId);
    try {
      setError('');
      const { data, error } = await supabase
        .from('apify_keys')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      console.log('🔑 ApifyKeyManager: Supabase response:', { data, error });

      if (error) {
        console.error('🔑 ApifyKeyManager: Error loading API keys:', error);
        setError(`Failed to load API keys: ${error.message}`);
        return;
      }

      console.log('🔑 ApifyKeyManager: Successfully loaded keys:', data?.length || 0);
      setKeys(data || []);

      // Auto-select first active key if none selected
      if (!selectedKeyId && data && data.length > 0) {
        const activeKey = data.find(k => k.is_active) || data[0];
        console.log('🔑 ApifyKeyManager: Auto-selecting key:', activeKey.id);
        onKeySelect(activeKey);
      }
    } catch (error) {
      console.error('🔑 ApifyKeyManager: Exception loading API keys:', error);
      setError('Failed to load API keys. Please try again.');
    }
  };

  const validateForm = () => {
    console.log('🔑 ApifyKeyManager: Validating form data:', {
      key_name: formData.key_name.trim(),
      api_key_length: formData.api_key.trim().length
    });

    if (!formData.key_name.trim()) {
      setError('Please enter a key name');
      return false;
    }
    if (!formData.api_key.trim()) {
      setError('Please enter an API key');
      return false;
    }
    if (formData.key_name.trim().length < 2) {
      setError('Key name must be at least 2 characters long');
      return false;
    }
    if (formData.api_key.trim().length < 10) {
      setError('API key seems too short. Please check your key.');
      return false;
    }
    return true;
  };

  const saveKey = async () => {
    console.log('🔑 ApifyKeyManager: Starting saveKey process');
    console.log('🔑 ApifyKeyManager: Form data:', {
      key_name: formData.key_name.trim(),
      api_key_preview: formData.api_key.trim().substring(0, 10) + '...',
      editing: !!editingKey
    });

    if (!validateForm()) {
      console.log('🔑 ApifyKeyManager: Form validation failed');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      if (editingKey) {
        console.log('🔑 ApifyKeyManager: Updating existing key:', editingKey.id);
        
        // Update existing key
        const updateData = {
          key_name: formData.key_name.trim(),
          api_key: formData.api_key.trim(),
          updated_at: new Date().toISOString()
        };
        
        console.log('🔑 ApifyKeyManager: Update data:', {
          ...updateData,
          api_key: updateData.api_key.substring(0, 10) + '...'
        });

        const { data, error } = await supabase
          .from('apify_keys')
          .update(updateData)
          .eq('id', editingKey.id)
          .select()
          .single();

        console.log('🔑 ApifyKeyManager: Update response:', { data, error });

        if (error) {
          console.error('🔑 ApifyKeyManager: Error updating API key:', error);
          setError(`Failed to update API key: ${error.message}`);
          return;
        }

        console.log('🔑 ApifyKeyManager: Successfully updated key');
        setKeys(prev => prev.map(k => k.id === editingKey.id ? data : k));
        setSuccess('API key updated successfully!');
      } else {
        console.log('🔑 ApifyKeyManager: Creating new key for userId:', userId);
        
        // Create new key
        const insertData = {
          user_id: userId,
          key_name: formData.key_name.trim(),
          api_key: formData.api_key.trim()
        };
        
        console.log('🔑 ApifyKeyManager: Insert data:', {
          ...insertData,
          api_key: insertData.api_key.substring(0, 10) + '...'
        });

        const { data, error } = await supabase
          .from('apify_keys')
          .insert([insertData])
          .select()
          .single();

        console.log('🔑 ApifyKeyManager: Insert response:', { data, error });

        if (error) {
          console.error('🔑 ApifyKeyManager: Error creating API key:', error);
          if (error.code === '23505') {
            setError('A key with this name already exists. Please choose a different name.');
          } else {
            setError(`Failed to create API key: ${error.message}`);
          }
          return;
        }

        console.log('🔑 ApifyKeyManager: Successfully created key:', data.id);
        setKeys(prev => [data, ...prev]);
        setSuccess('API key created successfully!');
        
        // Auto-select the new key
        console.log('🔑 ApifyKeyManager: Auto-selecting newly created key');
        onKeySelect(data);
      }

      // Reset form
      setFormData({ key_name: '', api_key: '' });
      setShowCreateForm(false);
      setEditingKey(null);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      console.error('🔑 ApifyKeyManager: Exception saving API key:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteKey = async (keyId: string) => {
    console.log('🔑 ApifyKeyManager: Deleting key:', keyId);
    
    if (!confirm('Are you sure you want to delete this API key?')) {
      console.log('🔑 ApifyKeyManager: Delete cancelled by user');
      return;
    }

    try {
      setError('');
      const { error } = await supabase
        .from('apify_keys')
        .delete()
        .eq('id', keyId);

      console.log('🔑 ApifyKeyManager: Delete response:', { error });

      if (error) {
        console.error('🔑 ApifyKeyManager: Error deleting API key:', error);
        setError(`Failed to delete API key: ${error.message}`);
        return;
      }
      
      console.log('🔑 ApifyKeyManager: Successfully deleted key');
      setKeys(prev => prev.filter(k => k.id !== keyId));
      setSuccess('API key deleted successfully!');
      
      // Select another key if the deleted one was selected
      if (selectedKeyId === keyId && keys.length > 1) {
        const remainingKeys = keys.filter(k => k.id !== keyId);
        if (remainingKeys.length > 0) {
          console.log('🔑 ApifyKeyManager: Selecting replacement key:', remainingKeys[0].id);
          onKeySelect(remainingKeys[0]);
        }
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      console.error('🔑 ApifyKeyManager: Exception deleting API key:', error);
      setError('Failed to delete API key. Please try again.');
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    setShowApiKey(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };

  const startEdit = (key: ApifyKey) => {
    console.log('🔑 ApifyKeyManager: Starting edit for key:', key.id);
    setEditingKey(key);
    setFormData({ key_name: key.key_name, api_key: key.api_key });
    setShowCreateForm(true);
    setError('');
    setSuccess('');
  };

  const cancelEdit = () => {
    console.log('🔑 ApifyKeyManager: Cancelling edit');
    setEditingKey(null);
    setFormData({ key_name: '', api_key: '' });
    setShowCreateForm(false);
    setError('');
    setSuccess('');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔑 ApifyKeyManager: Form submitted');
    saveKey();
  };

  const handleKeySelect = (key: ApifyKey) => {
    console.log('🔑 ApifyKeyManager: Key selected:', key.id, key.key_name);
    onKeySelect(key);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Apify API Keys</h3>
        <button
          onClick={() => {
            console.log('🔑 ApifyKeyManager: Add key button clicked');
            setShowCreateForm(!showCreateForm);
            setError('');
            setSuccess('');
          }}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Key
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-700">{success}</div>
        </div>
      )}

      {showCreateForm && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">
            {editingKey ? 'Edit API Key' : 'Add New API Key'}
          </h4>
          <form onSubmit={handleFormSubmit} className="space-y-3">
            <input
              type="text"
              placeholder="Key Name (e.g., 'Main Key', 'Backup Key')"
              value={formData.key_name}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, key_name: e.target.value }));
                setError('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
              required
            />
            <input
              type="password"
              placeholder="Apify API Key"
              value={formData.api_key}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, api_key: e.target.value }));
                setError('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isLoading || !formData.key_name.trim() || !formData.api_key.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Saving...' : (editingKey ? 'Update Key' : 'Add Key')}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {keys.map(key => (
          <div
            key={key.id}
            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
              selectedKeyId === key.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => handleKeySelect(key)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Key className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="font-medium text-gray-900">{key.key_name}</div>
                  <div className="text-sm text-gray-500 font-mono">
                    {showApiKey[key.id] 
                      ? key.api_key 
                      : '•'.repeat(Math.min(key.api_key.length, 20))
                    }
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleKeyVisibility(key.id);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title={showApiKey[key.id] ? 'Hide API key' : 'Show API key'}
                >
                  {showApiKey[key.id] ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(key);
                  }}
                  className="p-1 text-gray-400 hover:text-blue-600"
                  title="Edit API key"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteKey(key.id);
                  }}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Delete API key"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {selectedKeyId === key.id && (
              <div className="mt-2 text-xs text-blue-600 font-medium">
                ✓ Currently selected for scraping
              </div>
            )}
          </div>
        ))}
      </div>

      {keys.length === 0 && !showCreateForm && (
        <div className="text-center py-8 text-gray-500">
          <Key className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No API keys found. Add your first Apify API key to get started.</p>
        </div>
      )}
    </div>
  );
};