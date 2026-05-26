import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bbgjckseoikjqoyszwnt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiZ2pja3Nlb2lranFveXN6d250Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0ODEwMjcsImV4cCI6MjA5NTA1NzAyN30._uA-LRPjRCTfBN6xmudzPEju2k3RE6oupFLe6YL9fYo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function loadLogs() {
  try {
    const { data, error } = await supabase
      .from('workout_logs')
      .select('data')
      .eq('user_id', 'default')
      .single();
    if (!error && data) {
      // Save to localStorage as backup
      localStorage.setItem('liftlogs_backup', JSON.stringify(data.data));
      return data.data || {};
    }
  } catch {}
  // Fall back to localStorage if Supabase fails
  try {
    const backup = localStorage.getItem('liftlogs_backup');
    if (backup) return JSON.parse(backup);
  } catch {}
  return {};
}

export async function saveLogs(logs) {
  // Always save to localStorage immediately as backup
  try { localStorage.setItem('liftlogs_backup', JSON.stringify(logs)); } catch {}
  // Then save to Supabase
  try {
    const { error } = await supabase
      .from('workout_logs')
      .upsert({ user_id: 'default', data: logs, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) console.error('Supabase save error:', error);
  } catch (e) {
    console.error('Supabase save failed:', e);
  }
}
