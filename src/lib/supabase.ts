import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = 'https://gfbntjjcrwjsabstooor.supabase.co' // Replace with your Supabase URL
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmYm50ampjcndqc2Fic3Rvb29yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNDUyMTIsImV4cCI6MjA4MzYyMTIxMn0.dzYkJ0UHD5VjxEaDNy8waPJXVP693QWoGdzxYa_qJBA' // Replace with your Supabase anon key

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
