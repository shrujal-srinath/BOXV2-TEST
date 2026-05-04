import { supabase } from './supabase';
import type {
  PlayerProfile,
  PlayerTeam,
  PlayerSportStats,
  PlayerGameLog,
  PlayerLeaderboardRow,
} from '../types';

// ── Profile queries ────────────────────────────────────────────────────────

export const getMyProfile = async (userId: string): Promise<PlayerProfile | null> => {
  const { data, error } = await supabase
    .from('player_profiles')
    .select('*')
    .eq('auth_user_id', userId)
    .single();
  if (error) return null;
  return data as PlayerProfile;
};

export const getProfileById = async (id: string): Promise<PlayerProfile | null> => {
  const { data, error } = await supabase
    .from('player_profiles')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as PlayerProfile;
};

export const getProfileByCode = async (code: string): Promise<PlayerProfile | null> => {
  const { data, error } = await supabase
    .from('player_profiles')
    .select('*')
    .eq('player_code', code.toUpperCase())
    .single();
  if (error) return null;
  return data as PlayerProfile;
};

export const searchProfiles = async (
  query?: string,
  sportId?: string,
  limit = 30
): Promise<PlayerProfile[]> => {
  const { data, error } = await supabase.rpc('search_players', {
    p_query: query ?? null,
    p_sport_id: sportId ?? null,
    p_limit: limit,
  });
  if (error) { console.error('searchProfiles:', error); return []; }
  return (data ?? []) as PlayerProfile[];
};

// ── Profile mutations ──────────────────────────────────────────────────────

export const registerProfile = async (params: {
  full_name: string;
  display_name?: string;
  date_of_birth?: string;
  gender?: PlayerProfile['gender'];
  phone_number?: string;
  email?: string;
  usn?: string;
  college_name?: string;
  college_roll_no?: string;
  height_cm?: number;
  weight_kg?: number;
  dominant_hand?: PlayerProfile['dominant_hand'];
  primary_position?: string;
  jersey_number?: string;
  sport_ids?: string[];
  bio?: string;
  secondary_position?: string;
  wingspan_cm?: number;
  vertical_leap_cm?: number;
  shuttle_run_sec?: number;
  bench_press_kg?: number;
  achievements?: string[];
  highlight_video_url?: string;
  instagram_handle?: string;
  youtube_channel?: string;
  twitter_handle?: string;
  academic_year?: string;
  graduation_year?: number;
  registered_by: string;
  auth_user_id?: string;
  is_claimed?: boolean;
}): Promise<PlayerProfile | null> => {
  // Generate player_code server-side
  const { data: codeData, error: codeError } = await supabase
    .rpc('generate_player_code', { p_full_name: params.full_name });
  if (codeError) { console.error('generate_player_code:', codeError); return null; }

  const { data, error } = await supabase
    .from('player_profiles')
    .insert({
      full_name:        params.full_name.trim(),
      display_name:     params.display_name?.trim() || null,
      date_of_birth:    params.date_of_birth || null,
      gender:           params.gender || null,
      phone_number:     params.phone_number?.trim() || null,
      email:            params.email?.trim() || null,
      usn:              params.usn?.trim() || null,
      college_name:     params.college_name?.trim() || null,
      college_roll_no:  params.college_roll_no?.trim() || null,
      height_cm:        params.height_cm || null,
      weight_kg:        params.weight_kg || null,
      dominant_hand:    params.dominant_hand || null,
      primary_position: params.primary_position?.trim() || null,
      jersey_number:    params.jersey_number?.trim() || null,
      sport_ids:        params.sport_ids ?? [],
      bio:                  params.bio?.trim() || null,
      secondary_position:   params.secondary_position?.trim() || null,
      wingspan_cm:          params.wingspan_cm ?? null,
      vertical_leap_cm:     params.vertical_leap_cm ?? null,
      shuttle_run_sec:      params.shuttle_run_sec ?? null,
      bench_press_kg:       params.bench_press_kg ?? null,
      achievements:         params.achievements ?? null,
      highlight_video_url:  params.highlight_video_url?.trim() || null,
      instagram_handle:     params.instagram_handle?.trim() || null,
      youtube_channel:      params.youtube_channel?.trim() || null,
      twitter_handle:       params.twitter_handle?.trim() || null,
      academic_year:        params.academic_year?.trim() || null,
      graduation_year:      params.graduation_year ?? null,
      player_code:          codeData as string,
      registered_by:    params.registered_by,
      auth_user_id:     params.auth_user_id || null,
      is_claimed:       params.is_claimed ?? false,
    })
    .select()
    .single();
  if (error) { console.error('registerProfile:', error); return null; }
  return data as PlayerProfile;
};

export const updateProfile = async (
  id: string,
  patch: Partial<Omit<PlayerProfile, 'id' | 'player_code' | 'created_at' | 'auth_user_id'>>
): Promise<PlayerProfile | null> => {
  const { data, error } = await supabase
    .from('player_profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) { console.error('updateProfile:', error); return null; }
  return data as PlayerProfile;
};

export const claimProfile = async (profileId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('claim_player_profile', {
    p_player_id: profileId,
  });
  if (error) { console.error('claimProfile:', error); return false; }
  return data === true;
};

// ── Photo upload ───────────────────────────────────────────────────────────

export const uploadProfilePhoto = async (
  profileId: string,
  file: File
): Promise<string | null> => {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${profileId}/avatar.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('player-avatars')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) { console.error('uploadProfilePhoto:', upErr); return null; }

  const { data } = supabase.storage.from('player-avatars').getPublicUrl(path);
  const publicUrl = data.publicUrl;

  await updateProfile(profileId, { profile_photo_url: publicUrl });
  return publicUrl;
};

// ── Teams ──────────────────────────────────────────────────────────────────

export const getTeams = async (profileId: string): Promise<PlayerTeam[]> => {
  const { data, error } = await supabase
    .from('player_teams')
    .select('*')
    .eq('player_id', profileId)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) { console.error('getTeams:', error); return []; }
  return (data ?? []) as PlayerTeam[];
};

export const addTeam = async (
  profileId: string,
  team: Omit<PlayerTeam, 'id' | 'player_id' | 'created_at'>
): Promise<PlayerTeam | null> => {
  const { data, error } = await supabase
    .from('player_teams')
    .insert({ ...team, player_id: profileId })
    .select()
    .single();
  if (error) { console.error('addTeam:', error); return null; }
  return data as PlayerTeam;
};

export const updateTeam = async (
  teamId: string,
  patch: Partial<Omit<PlayerTeam, 'id' | 'player_id' | 'created_at'>>
): Promise<PlayerTeam | null> => {
  const { data, error } = await supabase
    .from('player_teams')
    .update(patch)
    .eq('id', teamId)
    .select()
    .single();
  if (error) { console.error('updateTeam:', error); return null; }
  return data as PlayerTeam;
};

export const removeTeam = async (teamId: string): Promise<boolean> => {
  const { error } = await supabase.from('player_teams').delete().eq('id', teamId);
  if (error) { console.error('removeTeam:', error); return false; }
  return true;
};

// ── Stats & Game log ───────────────────────────────────────────────────────

export const getPlayerSportStats = async (profileId: string): Promise<PlayerSportStats[]> => {
  const { data, error } = await supabase
    .from('player_sport_stats')
    .select('*')
    .eq('player_id', profileId)
    .order('total_score', { ascending: false });
  if (error) { console.error('getPlayerSportStats:', error); return []; }
  return (data ?? []) as PlayerSportStats[];
};

export const getGameLog = async (profileId: string, limit = 10): Promise<PlayerGameLog[]> => {
  const { data, error } = await supabase
    .from('player_game_log')
    .select('*')
    .eq('player_id', profileId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('getGameLog:', error); return []; }
  return (data ?? []) as PlayerGameLog[];
};

export const getLeaderboard = async (
  sportId?: string,
  limit = 30
): Promise<PlayerLeaderboardRow[]> => {
  const { data, error } = await supabase.rpc('get_player_leaderboard', {
    p_sport_id: sportId ?? null,
    p_limit: limit,
  });
  if (error) { console.error('getLeaderboard:', error); return []; }
  return (data ?? []) as PlayerLeaderboardRow[];
};

// ── Realtime ───────────────────────────────────────────────────────────────

export const subscribeToProfiles = (
  callback: (profiles: PlayerProfile[]) => void
): (() => void) => {
  const channel = supabase
    .channel('player-profiles-rt')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'player_profiles' },
      async () => {
        const fresh = await searchProfiles();
        callback(fresh);
      }
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
};

// ── Legacy aliases (for PlayerPassportSection compatibility) ──────────────
/** @deprecated Use registerProfile */
export const registerPlayer = registerProfile;
/** @deprecated Use claimProfile */
export const claimPassport = async (id: string, _userId: string) => claimProfile(id);
/** @deprecated Use getMyProfile */
export const getMyPassport = getMyProfile;
/** @deprecated Use searchProfiles */
export const getPlayers = searchProfiles;
/** @deprecated Use getPlayerSportStats */
export const getPlayerStats = getPlayerSportStats;
