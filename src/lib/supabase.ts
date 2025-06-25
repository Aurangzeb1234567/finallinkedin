import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Database types
export interface User {
  id: string;
  auth_user_id: string;
  username: string;
  email: string;
  full_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ApifyKey {
  id: string;
  user_id: string;
  key_name: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LinkedInProfile {
  id: string;
  user_id: string;
  linkedin_url: string;
  profile_data: any;
  last_updated: string;
  created_at: string;
  tags: string[];
}

export interface ScrapingJob {
  id: string;
  user_id: string;
  apify_key_id?: string;
  job_type: 'post_comments' | 'profile_details' | 'mixed';
  input_url: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results_count: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

// Simple auth helper functions
export const getCurrentUser = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

export const getUserProfile = async (authUserId: string): Promise<User | null> => {
  try {
    // First try to get existing user profile
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single()
    
    if (existingUser) {
      return existingUser
    }
    
    // If user doesn't exist, create one
    if (fetchError?.code === 'PGRST116') {
      const { data: authUser } = await supabase.auth.getUser()
      if (authUser.user) {
        const newUser = {
          auth_user_id: authUserId,
          username: authUser.user.email?.split('@')[0] || 'user',
          email: authUser.user.email || '',
          full_name: authUser.user.user_metadata?.full_name || 
                    `${authUser.user.user_metadata?.first_name || ''} ${authUser.user.user_metadata?.last_name || ''}`.trim() ||
                    authUser.user.email?.split('@')[0] || 'User'
        }
        
        const { data: createdUser, error: createError } = await supabase
          .from('users')
          .insert([newUser])
          .select()
          .single()
        
        if (createError) {
          console.error('Error creating user profile:', createError)
          return null
        }
        
        return createdUser
      }
    }
    
    console.error('Error fetching user profile:', fetchError)
    return null
  } catch (error) {
    console.error('Error in getUserProfile:', error)
    return null
  }
}

// Profile functions with error handling
export const checkProfileExists = async (linkedinUrl: string): Promise<LinkedInProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('linkedin_profiles')
      .select('*')
      .eq('linkedin_url', linkedinUrl)
      .single()
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error checking profile:', error)
      return null
    }
    
    return data
  } catch (error) {
    console.error('Error checking profile:', error)
    return null
  }
}

export const upsertProfile = async (
  userId: string, 
  linkedinUrl: string, 
  profileData: any,
  tags: string[] = []
): Promise<LinkedInProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('linkedin_profiles')
      .upsert({
        user_id: userId,
        linkedin_url: linkedinUrl,
        profile_data: profileData,
        tags,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'linkedin_url'
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error upserting profile:', error)
      return null
    }
    
    return data
  } catch (error) {
    console.error('Error upserting profile:', error)
    return null
  }
}

export const getUserProfiles = async (userId: string): Promise<LinkedInProfile[]> => {
  try {
    const { data, error } = await supabase
      .from('linkedin_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('last_updated', { ascending: false })
    
    if (error) {
      console.error('Error getting user profiles:', error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Error getting user profiles:', error)
    return []
  }
}

export const getAllProfiles = async (): Promise<LinkedInProfile[]> => {
  try {
    const { data, error } = await supabase
      .from('linkedin_profiles')
      .select('*')
      .order('last_updated', { ascending: false })
    
    if (error) {
      console.error('Error getting all profiles:', error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Error getting all profiles:', error)
    return []
  }
}