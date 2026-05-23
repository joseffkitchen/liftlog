import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bbgjckseoikjqoyszwnt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_D_y7vEazk0VYveHih6OVEA_PPEJJ8tm';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function loadLogs() {
  try {
    const { data, error } = await supabase
      .from('workout_logs')
      .select('data')
      .eq('user_id', 'default')
      .single();
    if (error || !data) return {};
    return data.data || {};
  } catch {
    return {};
  }
}

export async function saveLogs(logs) {
  try {
    const { error } = await supabase
      .from('workout_logs')
      .upsert({ user_id: 'default', data: logs, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) console.error('Save error:', error);
  } catch (e) {
    console.error('Save failed:', e);
  }
}
