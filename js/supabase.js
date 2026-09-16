const SUPABASE_URL = 'https://kngchiisfcezqmrptvvt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuZ2NoaWlzZmNlenFtcnB0dnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MzEwMjMsImV4cCI6MjEwNTEwNzAyM30.8NBI8yaNADciacAQsF18WYUbvRkSxZa7fNthhqT9MVQ';

let client = null;

export function initSupabase() {
  if (!window.supabase) {
    console.warn('[Analytics] Supabase CDN not loaded.');
    return null;
  }

  client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

export function getSupabaseClient() {
  return client;
}

/**
 * Insert a playback event into play_logs.
 * @param {{ branchName: string, songName: string, eventType: 'started'|'ended'|'paused' }} params
 */
export async function logPlayEvent({ branchName, songName, eventType }) {
  if (!client) {
    initSupabase();
  }
  if (!client) return;

  const payload = {
    branch_name: branchName,
    song_name: songName,
    event_type: eventType,
    timestamp: new Date().toISOString()
  };

  try {
    const { error } = await client.from('play_logs').insert(payload);
    if (error) {
      console.warn('[Analytics] Failed to log event:', error.message);
    }
  } catch (err) {
    console.warn('[Analytics] Network error logging event:', err);
  }
}
