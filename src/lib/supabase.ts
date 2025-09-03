import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

// Type assertion for Vite environment variables
declare global {
  interface ImportMeta {
    readonly env: {
      readonly VITE_SUPABASE_URL: string;
      readonly VITE_SUPABASE_ANON_KEY: string;
      readonly VITE_APP_URL: string;
      readonly MODE: string;
    };
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Auth helper functions
export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signUpWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
};

export const getCurrentSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
};

// Database helper functions
export const getBrands = async (userId: string) => {
  const { data, error } = await supabase
    .from('brands')
    .select(`
      *,
      brand_shops(*)
    `)
    .eq('owner_user_id', userId);
  return { data, error };
};

export const createBrand = async (brandData: {
  name: string;
  logo_url?: string;
  owner_user_id: string;
}) => {
  const { data, error } = await supabase
    .from('brands')
    .insert(brandData as any)
    .select()
    .single();
  return { data, error };
};

export const connectShopifyStore = async (storeData: {
  brand_id: string;
  shop_domain: string;
  access_token: string;
  webhook_secret: string;
  default_location_id: string;
  printer_map: Record<string, string>;
  service_rules_json: Record<string, any>;
}) => {
  const { data, error } = await supabase
    .from('brand_shops')
    .insert(storeData as any)
    .select()
    .single();
  return { data, error };
};
