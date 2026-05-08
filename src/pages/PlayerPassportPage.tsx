// src/pages/PlayerPassportPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Design: Gaming / Esports HUD (Valorant · FIFA UT · Apex Legends vibe)
// Dark-only. Wide desktop with sticky agent-preview sidebar.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import type { PlayerProfile } from '../types';
import {
  getMyProfile,
  registerProfile,
  addTeam,
  uploadProfilePhoto,
} from '../services/playerService';
import { subscribeToAuth } from '../services/authService';
import { SPORT_REGISTRY, EXTENDED_SPORTS } from '../sports/registry';
import { PlayerIdCard } from '../components/PlayerIdCard';

// ─── Sport config ─────────────────────────────────────────────────────────────

const POSITIONS: Record<string, string[]> = {
  basketball:  ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'],
  football:    ['Goalkeeper', 'Right Back', 'Centre Back', 'Left Back', 'CDM', 'CM', 'CAM', 'Right Wing', 'Left Wing', 'Striker', 'Centre Forward'],
  volleyball:  ['Setter', 'Outside Hitter', 'Opposite Hitter', 'Middle Blocker', 'Libero', 'Defensive Specialist'],
  cricket:     ['Top-Order Batsman', 'Middle-Order Batsman', 'Lower-Order Batsman', 'Fast Bowler', 'Medium-Pace Bowler', 'Spin Bowler', 'All-Rounder', 'Wicket-Keeper', 'Wicket-Keeper Batsman'],
  badminton:   ['Singles Specialist', 'Doubles Specialist', 'Mixed Doubles', 'All Formats'],
  kabaddi:     ['Raider', 'Right Corner', 'Left Corner', 'Right Cover', 'Left Cover', 'All-Rounder'],
  hockey:      ['Goalkeeper', 'Right Back', 'Centre Back', 'Left Back', 'Right Half', 'Centre Half', 'Left Half', 'Right Wing', 'Centre Forward', 'Left Wing', 'Inside Forward'],
  netball:     ['Goal Shooter', 'Goal Attack', 'Wing Attack', 'Centre', 'Wing Defence', 'Goal Defence', 'Goalkeeper'],
  handball:    ['Goalkeeper', 'Right Wing', 'Left Wing', 'Right Back', 'Left Back', 'Centre Back', 'Pivot'],
  tennis:      ['Singles', 'Doubles', 'Mixed Doubles'],
  tabletennis: ['Singles', 'Doubles', 'Mixed Doubles'],
  khokho:      ['Chaser', 'Defender', 'All-Rounder'],
  throwball:   ['Setter', 'Attacker', 'Defender', 'All-Rounder'],
  chess:       ['Open Category'],
  carrom:      ['Singles', 'Doubles', 'All Formats'],
  athletics:   ['100m / Sprinter', '200m', '400m', 'Middle Distance (800m/1500m)', 'Long Distance (5000m/10000m)', 'Long Jump', 'High Jump', 'Triple Jump', 'Shot Put', 'Discus Throw', 'Javelin Throw', 'Relay (4×100m)', 'Relay (4×400m)', 'Decathlon / Heptathlon'],
  general:     ['Forward', 'Midfielder', 'Defender', 'All-Rounder', 'Utility'],
};
const FOOT_SPORTS    = new Set(['football', 'kabaddi']);
const NO_LIMB_SPORTS = new Set(['chess', 'athletics', 'general']);
const limbLabel = (s: string) => FOOT_SPORTS.has(s) ? 'Preferred Foot' : NO_LIMB_SPORTS.has(s) ? '' : 'Dominant Hand';

const COURSE_LENGTHS  = ['1 Year', '2 Years', '3 Years', '4 Years', '5 Years', '6 Years'];
const ACADEMIC_YEARS  = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];
const currentYear     = new Date().getFullYear();
const GRAD_YEARS      = Array.from({ length: 12 }, (_, i) => String(currentYear - 2 + i));

// ─── Design tokens ────────────────────────────────────────────────────────────

const inputCls = [
  'w-full h-12 px-4 text-[15px] font-medium tracking-tight',
  'bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400',
  'dark:bg-zinc-900/80 dark:border-white/15 dark:text-white dark:placeholder:text-zinc-500',
  'outline-none transition-all duration-200',
  'hover:border-violet-500/50 dark:hover:bg-zinc-900',
  'focus:border-violet-500 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.12)] dark:focus:border-violet-400 dark:focus:bg-zinc-900 dark:focus:shadow-[0_0_0_3px_rgba(139,92,246,0.15)]',
].join(' ');

const selectCls = `${inputCls} appearance-none pr-10 bg-[url("data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20fill=%22none%22%20viewBox=%220%200%2024%2024%22%20stroke=%22%23a78bfa%22%20stroke-width=%222%22><path%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%20d=%22M19%209l-7%207-7-7%22/></svg>")] bg-no-repeat bg-[right_12px_center] bg-[length:14px]`;

// ─── Helper components ────────────────────────────────────────────────────────

/** HUD-style panel with corner bracket accents */
const HudPanel: React.FC<{ num?: string; title?: string; subtitle?: string; children: React.ReactNode; className?: string }> = ({ num, title, subtitle, children, className = '' }) => (
  <div className={`relative bg-white border border-slate-200 dark:bg-zinc-950/80 dark:backdrop-blur-sm dark:border-violet-500/20 ${className}`}>
    <span className="absolute -top-px -left-px w-3 h-3 border-t-2 border-l-2 border-violet-400" />
    <span className="absolute -top-px -right-px w-3 h-3 border-t-2 border-r-2 border-violet-400" />
    <span className="absolute -bottom-px -left-px w-3 h-3 border-b-2 border-l-2 border-violet-400" />
    <span className="absolute -bottom-px -right-px w-3 h-3 border-b-2 border-r-2 border-violet-400" />

    {(num || title) && (
      <header className="flex items-center gap-4 px-6 py-4 border-b border-slate-100 dark:border-violet-500/15 bg-gradient-to-r from-violet-500/5 via-transparent to-transparent">
        {num && (
          <span className="font-mono text-[11px] text-violet-600 dark:text-violet-400 tabular-nums tracking-[0.2em] px-2 py-1 bg-violet-500/10 border border-violet-500/30">
            {num}
          </span>
        )}
        <div className="flex-1 min-w-0">
          {title && <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.15em]">{title}</h3>}
          {subtitle && <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono mt-0.5">{subtitle}</p>}
        </div>
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
      </header>
    )}
    <div className="p-6">
      {children}
    </div>
  </div>
);

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  status?: string;
  children: React.ReactNode;
}
const Field: React.FC<FieldProps> = ({ label, required, hint, status, children }) => (
  <div>
    <div className="flex items-baseline justify-between mb-2">
      <label className="font-mono text-[11px] text-slate-700 dark:text-zinc-300 uppercase tracking-[0.15em] font-semibold">
        <span className="text-violet-500/70 dark:text-violet-400/70 mr-1.5">›</span>
        {label}
        {required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
      </label>
      {status && <span className="font-mono text-[10px] text-slate-500 dark:text-zinc-500 tabular-nums">{status}</span>}
    </div>
    {children}
    {hint && <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1.5 leading-relaxed">{hint}</p>}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const PlayerPassportPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const forSelf = searchParams.get('type') !== 'other';

  const [user, setUser]                     = useState<User | null>(null);
  const [authLoading, setAuthLoading]       = useState(true);
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState('');
  const [createdProfile, setCreatedProfile] = useState<PlayerProfile | null>(null);
  const [showMoreSports, setShowMoreSports] = useState(false);
  const [measurablesOpen, setMeasurablesOpen] = useState(false);
  const [sportToast, setSportToast] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastTimer   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setSportToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setSportToast(''), 2500);
  }, []);

  // Photo
  const [photoFile, setPhotoFile]       = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Identity
  const [fullName, setFullName]       = useState('');
  const [phone, setPhone]             = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dob, setDob]                 = useState('');
  const [gender, setGender]           = useState<PlayerProfile['gender']>(null);
  const [email, setEmail]             = useState('');

  // Athletic
  const [primarySports, setPrimarySports]   = useState<string[]>([]);
  const [sportPositions, setSportPositions] = useState<Record<string, string>>({});
  const [dominantLimb, setDominantLimb]     = useState<'left' | 'right' | 'ambidextrous' | ''>('');
  const [jersey, setJersey]                 = useState('');
  const [secondarySports, setSecondarySports] = useState<string[]>([]);

  // Academic
  const [college, setCollege]           = useState('');
  const [usnRoll, setUsnRoll]           = useState('');
  const [gradYear, setGradYear]         = useState('');
  const [courseLength, setCourseLength] = useState('');
  const [academicYear, setAcademicYear] = useState('');

  // Teams & bio
  const [clubName, setClubName] = useState('');
  const [bio, setBio]           = useState('');

  // Links
  const [highlightVideoUrl, setHighlightVideoUrl] = useState('');
  const [instagramHandle, setInstagramHandle]     = useState('');
  const [youtubeChannel, setYoutubeChannel]       = useState('');
  const [twitterHandle, setTwitterHandle]         = useState('');

  // Measurables
  const [heightCm, setHeightCm]             = useState('');
  const [weightKg, setWeightKg]             = useState('');
  const [wingspanCm, setWingspanCm]         = useState('');
  const [verticalLeapCm, setVerticalLeapCm] = useState('');
  const [shuttleRunSec, setShuttleRunSec]   = useState('');
  const [benchPressKg, setBenchPressKg]     = useState('');

  useEffect(() => {
    const unsub = subscribeToAuth((u) => {
      setUser(u);
      if (u?.email && forSelf) setEmail(u.email);
      setAuthLoading(false);
    });
    return unsub;
  }, [forSelf]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f?.type.startsWith('image/')) {
      setPhotoFile(f);
      setPhotoPreview(URL.createObjectURL(f));
    }
  };

  const togglePrimary = (id: string) => {
    if (primarySports.includes(id)) {
      setSportPositions({});
      setPrimarySports([]);
    } else {
      if (primarySports.length > 0) {
        const prev = SPORT_REGISTRY[primarySports[0]]?.label ?? primarySports[0];
        const next = SPORT_REGISTRY[id]?.label ?? id;
        showToast(`Only one primary sport allowed — switched from ${prev} to ${next}`);
      }
      setSportPositions({});
      setPrimarySports([id]);
    }
  };

  const toggleSecondary = (id: string) =>
    setSecondarySports(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const validate = (): boolean => {
    if (fullName.trim().length < 2) { setError('CALLSIGN required — minimum 2 characters.'); return false; }
    if (!phone.trim()) { setError('LINK ID required — phone number identifies your passport.'); return false; }
    setError('');
    return true;
  };

  const allSports = [...primarySports, ...secondarySports.filter(s => !primarySports.includes(s))];

  const buildPosition = (): string | undefined => {
    if (primarySports.length === 0) return undefined;
    return sportPositions[primarySports[0]] || undefined;
  };

  const handleSubmit = async () => {
    if (!user || !validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSubmitting(true);

    const profile = await registerProfile({
      full_name:           fullName.trim(),
      display_name:        displayName.trim() || undefined,
      date_of_birth:       dob || undefined,
      gender:              gender || undefined,
      phone_number:        phone.trim(),
      email:               email.trim() || undefined,
      height_cm:           heightCm ? parseInt(heightCm) : undefined,
      weight_kg:           weightKg ? parseInt(weightKg) : undefined,
      dominant_hand:       dominantLimb || undefined,
      primary_position:    buildPosition(),
      jersey_number:       jersey.trim() || undefined,
      sport_ids:           allSports,
      bio:                 bio.trim() || undefined,
      college_name:        college.trim() || undefined,
      usn:                 usnRoll.trim() || undefined,
      highlight_video_url: highlightVideoUrl.trim() || undefined,
      instagram_handle:    instagramHandle.trim() || undefined,
      youtube_channel:     youtubeChannel.trim() || undefined,
      twitter_handle:      twitterHandle.trim() || undefined,
      wingspan_cm:         wingspanCm ? parseInt(wingspanCm) : undefined,
      vertical_leap_cm:    verticalLeapCm ? parseInt(verticalLeapCm) : undefined,
      shuttle_run_sec:     shuttleRunSec ? parseFloat(shuttleRunSec) : undefined,
      bench_press_kg:      benchPressKg ? parseInt(benchPressKg) : undefined,
      academic_year:       academicYear.trim() || undefined,
      registered_by:       user.id,
      auth_user_id:        forSelf ? user.id : undefined,
      is_claimed:          forSelf,
    });

    if (!profile) { setSubmitting(false); setError('REGISTRATION FAILED — try again.'); return; }
    if (photoFile) await uploadProfilePhoto(profile.id, photoFile);

    if (college.trim()) {
      await addTeam(profile.id, {
        team_type: 'college', team_name: college.trim(),
        jersey_number: usnRoll.trim() || null, position: null,
        role: 'player', season_from: null, season_to: gradYear || null, is_active: true,
      });
    }
    if (clubName.trim()) {
      await addTeam(profile.id, {
        team_type: 'club', team_name: clubName.trim(),
        jersey_number: jersey.trim() || null, position: buildPosition() || null,
        role: 'player', season_from: null, season_to: null, is_active: true,
      });
    }

    const fresh = photoFile ? await getMyProfile(user.id) : null;
    setCreatedProfile(fresh ?? { ...profile, profile_photo_url: photoPreview ?? null });
    setSubmitting(false);
  };

  const resetForm = () => {
    setCreatedProfile(null);
    setFullName(''); setPhone(''); setDisplayName(''); setDob(''); setGender(null); setEmail('');
    setPrimarySports([]); setSportPositions({}); setDominantLimb(''); setJersey('');
    setSecondarySports([]);
    setCollege(''); setUsnRoll(''); setGradYear(''); setCourseLength(''); setAcademicYear('');
    setClubName(''); setBio('');
    setHighlightVideoUrl(''); setInstagramHandle(''); setYoutubeChannel(''); setTwitterHandle('');
    setHeightCm(''); setWeightKg(''); setWingspanCm(''); setVerticalLeapCm('');
    setShuttleRunSec(''); setBenchPressKg('');
    setPhotoFile(null); setPhotoPreview(null); setError('');
    setMeasurablesOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Progress
  const requiredFilled = (fullName.trim().length >= 2 ? 1 : 0) + (phone.trim() ? 1 : 0);
  const canSubmit = requiredFilled === 2;

  // Completion % for HUD meter (14 tracked fields)
  const filledCount = [
    fullName, phone, displayName, dob, gender, email,
    primarySports.length > 0, college, clubName, bio,
    heightCm, weightKg, jersey, photoPreview,
  ].filter(v => typeof v === 'boolean' ? v : String(v).trim().length > 0).length;
  const completion = Math.round((filledCount / 14) * 100);

  // ── Auth states ────────────────────────────────────────────────────────────

  if (authLoading) return (
    <div className="min-h-dvh bg-white dark:bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin shadow-[0_0_20px_rgba(139,92,246,0.4)]" />
        <span className="font-mono text-[10px] text-violet-400 uppercase tracking-[0.3em] animate-pulse">Booting</span>
      </div>
    </div>
  );

  if (!user || (user as any).is_anonymous) return (
    <div className="min-h-dvh bg-white dark:bg-black flex items-center justify-center p-6">
      <div className="relative max-w-sm w-full bg-white border border-slate-200 dark:bg-zinc-950/60 dark:border-violet-500/20 p-8">
        <span className="absolute -top-px -left-px w-3 h-3 border-t-2 border-l-2 border-violet-400" />
        <span className="absolute -top-px -right-px w-3 h-3 border-t-2 border-r-2 border-violet-400" />
        <span className="absolute -bottom-px -left-px w-3 h-3 border-b-2 border-l-2 border-violet-400" />
        <span className="absolute -bottom-px -right-px w-3 h-3 border-b-2 border-r-2 border-violet-400" />
        <div className="text-center">
          <p className="font-mono text-[10px] text-red-400 uppercase tracking-[0.3em] mb-4">Access Denied</p>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-3">Sign in required</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mb-8 leading-relaxed">Authenticate to register a player passport.</p>
          <button
            onClick={() => navigate('/')}
            className="w-full h-12 bg-violet-500 hover:bg-violet-400 text-white font-bold uppercase tracking-[0.2em] text-xs shadow-[0_0_24px_rgba(139,92,246,0.4)] transition-all"
          >
            Back to Home →
          </button>
        </div>
      </div>
    </div>
  );

  // ── Success screen ─────────────────────────────────────────────────────────

  if (createdProfile) {
    return (
      <div className="min-h-dvh bg-white dark:bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-violet-600/10 blur-[180px] pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none opacity-40" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 3px)' }} />

        <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 border border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_16px_rgba(16,185,129,0.3)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="font-mono text-[10px] text-emerald-300 uppercase tracking-[0.25em]">
                {forSelf ? 'Passport Active' : 'Athlete Registered'}
              </span>
            </span>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-[0.95] whitespace-pre-line italic">
              {forSelf ? 'Welcome to\nThe Box' : createdProfile.full_name}
            </h1>
            <p className="text-[13px] text-slate-500 dark:text-zinc-400 mt-5 leading-relaxed max-w-sm mx-auto">
              {forSelf
                ? 'Your passport is live. Stats track automatically from your next match.'
                : `They can claim this passport by signing in with ${createdProfile.phone_number ?? 'their phone number'}.`}
            </p>
          </div>

          <PlayerIdCard profile={createdProfile} className="mb-6" />

          <div className="relative bg-white border border-slate-200 dark:bg-zinc-950/60 dark:border-violet-500/20 px-5 py-4 flex items-center gap-4 mb-6">
            <span className="absolute -top-px -left-px w-3 h-3 border-t-2 border-l-2 border-violet-400" />
            <span className="absolute -top-px -right-px w-3 h-3 border-t-2 border-r-2 border-violet-400" />
            <span className="absolute -bottom-px -left-px w-3 h-3 border-b-2 border-l-2 border-violet-400" />
            <span className="absolute -bottom-px -right-px w-3 h-3 border-b-2 border-r-2 border-violet-400" />
            <div className="flex-1">
              <p className="font-mono text-[10px] text-violet-500 dark:text-violet-400 uppercase tracking-[0.25em] mb-1">Player Code</p>
              <p className="font-mono text-xl font-black text-slate-900 dark:text-white tracking-[0.15em]">{createdProfile.player_code}</p>
            </div>
            <button
              onClick={() => navigator.clipboard?.writeText(createdProfile.player_code)}
              className="w-10 h-10 flex items-center justify-center border border-violet-500/30 hover:border-violet-400 hover:bg-violet-500/10 text-zinc-400 hover:text-violet-300 transition-all"
              title="Copy"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>

          <div className="flex gap-3">
            {!forSelf && (
              <button onClick={resetForm} className="flex-1 h-12 border border-white/10 hover:border-white/30 hover:bg-white/5 text-zinc-300 font-bold uppercase tracking-[0.2em] text-xs transition-all">
                + New Recruit
              </button>
            )}
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-[2] h-12 bg-violet-500 hover:bg-violet-400 text-white font-black uppercase tracking-[0.2em] text-xs shadow-[0_0_28px_rgba(139,92,246,0.5)] transition-all"
            >
              Enter Dashboard →
            </button>
          </div>
        </div>
      </div>
    );
  }

  const nonPrimarySports = Object.keys(SPORT_REGISTRY).filter(id => !primarySports.includes(id));

  // ── Registration form ──────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-white text-slate-900 dark:bg-black dark:text-white antialiased relative overflow-x-hidden selection:bg-violet-500/30">

      {/* ═══════ Global FX layers ═══════════════════════════════════════════ */}
      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.25]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(139,92,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.04) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      {/* Scanlines */}
      <div
        className="fixed inset-0 pointer-events-none z-[51] opacity-[0.25]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 3px)' }}
      />
      {/* Radial glows */}
      <div className="fixed top-[10%] left-[15%] w-[500px] h-[500px] rounded-full bg-violet-600/15 blur-[180px] pointer-events-none" />
      <div className="fixed bottom-[5%] right-[10%] w-[500px] h-[500px] rounded-full bg-fuchsia-600/10 blur-[180px] pointer-events-none" />

      {/* ═══════ HUD HEADER ═══════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-black/80 backdrop-blur-xl border-b border-slate-200 dark:border-violet-500/20">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-16 flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 -ml-2 flex items-center justify-center border border-transparent hover:border-violet-500/40 hover:bg-violet-500/10 text-slate-500 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-300 transition-all"
            aria-label="Back"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex items-center gap-3">
            <div className="relative w-7 h-7">
              <div className="absolute inset-0 bg-violet-500 shadow-[0_0_16px_rgba(139,92,246,0.6)]" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%)' }} />
              <span className="absolute inset-0 flex items-center justify-center font-black text-white text-[11px] tracking-tight">B</span>
            </div>
            <div className="hidden sm:block">
              <p className="font-mono text-[9px] text-violet-400 uppercase tracking-[0.3em] leading-none">The Box</p>
              <p className="font-black text-[12px] text-slate-900 dark:text-white uppercase tracking-[0.15em] leading-none mt-1">Passport</p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 ml-4">
            <span className="font-mono text-[10px] text-slate-500 dark:text-zinc-600 uppercase tracking-[0.2em]">Mode</span>
            <span className="px-2 py-0.5 border border-violet-500/30 bg-violet-500/10 font-mono text-[10px] text-violet-600 dark:text-violet-300 uppercase tracking-[0.2em]">
              {forSelf ? 'Self-Register' : 'Create Athlete'}
            </span>
          </div>

          <div className="flex-1" />

          {/* Completion meter */}
          <div className="hidden md:flex items-center gap-3">
            <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-[0.2em]">Complete</span>
            <div className="relative w-24 h-1.5 bg-white/5 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-[0_0_12px_rgba(139,92,246,0.6)] transition-all duration-500"
                style={{ width: `${completion}%` }}
              />
            </div>
            <span className="font-mono text-[11px] text-violet-300 tabular-nums font-bold min-w-[32px] text-right">{completion}%</span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            className="group relative h-10 px-5 bg-violet-500 hover:bg-violet-400 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white font-black uppercase tracking-[0.15em] text-[11px] shadow-[0_0_20px_rgba(139,92,246,0.4)] disabled:shadow-none transition-all flex items-center gap-2"
          >
            {submitting ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving
              </>
            ) : (
              <>
                {forSelf ? 'Deploy' : 'Register'}
                <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ═══════ MAIN GRID ═══════════════════════════════════════════════ */}
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-8 relative">
        <div className="grid grid-cols-1 lg:grid-cols-[480px_1fr] xl:grid-cols-[520px_1fr] gap-6">

          {/* ═══ LEFT: Agent Preview Panel (sticky on desktop) ═══════════════ */}
          <aside className="lg:sticky lg:top-24 lg:self-start space-y-4">
            <HudPanel num="AGT" title="Athlete Preview" subtitle="Live passport render">

              {/* Photo upload — compact strip */}
              <div className="flex items-center gap-3 mb-5 pb-5 border-b border-violet-500/10">
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload photo"
                  className="group relative flex-shrink-0 w-16 h-16 cursor-pointer overflow-hidden border-2 border-violet-500/30 hover:border-violet-400 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all"
                  style={{ borderRadius: '12px' }}
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-violet-950/30 to-black">
                      <svg className="w-5 h-5 text-violet-400/60 group-hover:text-violet-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[9px] text-violet-400 uppercase tracking-[0.2em] mb-0.5">Photo</p>
                  <p className="font-mono text-[10px] text-zinc-500">{photoPreview ? 'Locked in · click to change' : 'Drop or click to upload'}</p>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                      className="font-mono text-[9px] text-red-400/60 hover:text-red-400 mt-1 transition-colors uppercase tracking-wider"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Live ID card preview */}
              <div className="mb-4">
                <p className="font-mono text-[9px] text-zinc-500 uppercase tracking-[0.2em] mb-3">Live Preview</p>
                <PlayerIdCard
                  profile={{
                    id: 'preview',
                    auth_user_id: null,
                    full_name: fullName.trim() || 'Your Name',
                    display_name: displayName.trim() || null,
                    date_of_birth: dob || null,
                    gender: gender,
                    phone_number: phone || null,
                    email: email || null,
                    usn: null,
                    college_name: college.trim() || null,
                    college_roll_no: null,
                    height_cm: heightCm ? parseInt(heightCm) : null,
                    weight_kg: weightKg ? parseInt(weightKg) : null,
                    dominant_hand: dominantLimb || null,
                    primary_position: buildPosition() || null,
                    jersey_number: jersey.trim() || null,
                    sport_ids: [...primarySports, ...secondarySports.filter(s => !primarySports.includes(s))],
                    bio: bio || null,
                    profile_photo_url: photoPreview,
                    secondary_position: null,
                    wingspan_cm: null,
                    vertical_leap_cm: null,
                    shuttle_run_sec: null,
                    bench_press_kg: null,
                    achievements: null,
                    highlight_video_url: null,
                    instagram_handle: null,
                    youtube_channel: null,
                    twitter_handle: null,
                    academic_year: null,
                    graduation_year: null,
                    player_code: 'BOX-???-0000',
                    is_verified: false,
                    is_claimed: false,
                    registered_by: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  }}
                />
              </div>
            </HudPanel>

            {/* Required meter */}
            <div className="relative bg-zinc-950/60 border border-violet-500/20 p-4">
              <span className="absolute -top-px -left-px w-3 h-3 border-t-2 border-l-2 border-violet-400" />
              <span className="absolute -top-px -right-px w-3 h-3 border-t-2 border-r-2 border-violet-400" />
              <span className="absolute -bottom-px -left-px w-3 h-3 border-b-2 border-l-2 border-violet-400" />
              <span className="absolute -bottom-px -right-px w-3 h-3 border-b-2 border-r-2 border-violet-400" />
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-[0.2em]">Required Fields</span>
                <span className="font-mono text-[11px] text-violet-300 font-bold tabular-nums">{requiredFilled}/2</span>
              </div>
              <div className="flex gap-1">
                <ReqChip filled={fullName.trim().length >= 2} label="Name" />
                <ReqChip filled={phone.trim().length > 0} label="Phone" />
              </div>
            </div>

            {/* Submit (also in header, but duplicate here for desktop convenience) */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !canSubmit}
              className="group relative w-full h-14 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white font-black uppercase tracking-[0.2em] text-sm shadow-[0_0_32px_rgba(139,92,246,0.4)] disabled:shadow-none transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Deploying…
                </>
              ) : (
                <>
                  {forSelf ? 'Claim Passport' : 'Register Athlete'}
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-disabled:translate-x-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </aside>

          {/* ═══ RIGHT: Form Panels ═══════════════════════════════════════════ */}
          <main className="space-y-6 min-w-0">

            {error && (
              <div role="alert" className="relative border border-red-500/40 bg-red-500/10 p-4 flex items-start gap-3 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                <span className="absolute -top-px -left-px w-3 h-3 border-t-2 border-l-2 border-red-400" />
                <span className="absolute -top-px -right-px w-3 h-3 border-t-2 border-r-2 border-red-400" />
                <span className="absolute -bottom-px -left-px w-3 h-3 border-b-2 border-l-2 border-red-400" />
                <span className="absolute -bottom-px -right-px w-3 h-3 border-b-2 border-r-2 border-red-400" />
                <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="font-mono text-[12px] text-red-300 leading-relaxed uppercase tracking-wide">{error}</p>
              </div>
            )}

            {/* ─ 01 · IDENTITY ─────────────────────────────────────────────── */}
            <HudPanel num="01" title="Identity" subtitle="Core registration data">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                <div className="md:col-span-2 xl:col-span-3">
                  <Field label="Full Name / Callsign" required>
                    <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder={forSelf ? 'Your legal name' : "Athlete's full name"} autoFocus className={inputCls} />
                  </Field>
                </div>
                <Field label="Display Name" hint="Shown on scoreboards">
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="King James" className={inputCls} />
                </Field>
                <Field label="Phone (Link ID)" required hint="Unique passport identifier">
                  <input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" className={inputCls} />
                </Field>
                <Field label="Email">
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="player@box.gg" className={inputCls} />
                </Field>
                <Field label="Gender">
                  <select value={gender ?? ''} onChange={e => setGender((e.target.value as PlayerProfile['gender']) || null)} className={selectCls}>
                    <option value="" className="bg-zinc-900">Select</option>
                    <option value="male" className="bg-zinc-900">Male</option>
                    <option value="female" className="bg-zinc-900">Female</option>
                    <option value="other" className="bg-zinc-900">Other</option>
                    <option value="prefer_not_to_say" className="bg-zinc-900">Prefer not to say</option>
                  </select>
                </Field>
                <Field label="Date of Birth">
                  <input type="date" value={dob} onChange={e => setDob(e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
                </Field>
              </div>
            </HudPanel>

            {/* ─ 02 · PRIMARY SPORT ─────────────────────────────────────── */}
            <HudPanel num="02" title="Primary Sport" subtitle="One sport — full stats tracked">
              {/* Toast notification */}
              {sportToast && (
                <div className="mb-4 flex items-center gap-2 px-3 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-mono animate-in fade-in slide-in-from-top-1 duration-200">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {sportToast}
                </div>
              )}

              <div className="mb-4 flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">
                  {primarySports.length === 0
                    ? 'Tap a sport to select it as your primary'
                    : <span className="text-violet-300 font-semibold">{SPORT_REGISTRY[primarySports[0]]?.label ?? primarySports[0]} selected · tap to deselect or tap another to switch</span>}
                </span>
                <span className="font-mono text-[11px] text-violet-300 tabular-nums font-bold">{primarySports.length}/1</span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                {Object.entries(SPORT_REGISTRY)
                  .filter(([id]) => !EXTENDED_SPORTS.includes(id as any) || showMoreSports || primarySports.includes(id))
                  .map(([id, m]) => {
                    const active = primarySports.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => togglePrimary(id)}
                        aria-pressed={active}
                        className={`group relative h-[88px] flex flex-col items-center justify-center gap-1.5 border-2 transition-all duration-200
                          ${active
                            ? 'border-violet-400 bg-violet-500/15 shadow-[0_0_20px_rgba(139,92,246,0.35),inset_0_0_20px_rgba(139,92,246,0.1)]'
                            : 'border-white/10 hover:border-violet-400/50 hover:bg-violet-500/5'
                          }`}
                      >
                        {active && (
                          <>
                            <span className="absolute top-1 left-1 w-2 h-2 border-t-2 border-l-2 border-violet-300" />
                            <span className="absolute top-1 right-1 w-2 h-2 border-t-2 border-r-2 border-violet-300" />
                            <span className="absolute bottom-1 left-1 w-2 h-2 border-b-2 border-l-2 border-violet-300" />
                            <span className="absolute bottom-1 right-1 w-2 h-2 border-b-2 border-r-2 border-violet-300" />
                          </>
                        )}
                        <span className="text-3xl leading-none group-hover:scale-110 transition-transform duration-200" style={{ filter: active ? 'drop-shadow(0 0 8px rgba(139,92,246,0.6))' : undefined }}>
                          {m.icon as string}
                        </span>
                        <span className={`font-mono text-[9px] uppercase tracking-[0.08em] font-bold leading-tight text-center px-1 ${active ? 'text-violet-200' : 'text-zinc-400'}`}>
                          {m.label}
                        </span>
                      </button>
                    );
                  })}
              </div>

              <button
                type="button"
                onClick={() => setShowMoreSports(p => !p)}
                className="mt-4 font-mono text-[10px] text-violet-400 hover:text-violet-300 uppercase tracking-[0.2em] flex items-center gap-1.5 transition-colors"
              >
                <svg className={`w-3 h-3 transition-transform ${showMoreSports ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                {showMoreSports ? 'Collapse' : `Show all ${Object.keys(SPORT_REGISTRY).length} sports`}
              </button>
            </HudPanel>

            {/* Per-sport loadout — appears after primary selected */}
            {primarySports.map(sportId => {
              const m = SPORT_REGISTRY[sportId];
              const positions = POSITIONS[sportId] ?? [];
              const limb = limbLabel(sportId);
              return (
                <HudPanel
                  key={sportId}
                  num={`›${(m.icon as string)}`}
                  title={`${m.label} · Position & Style`}
                  subtitle="Your role in this sport"
                  className="animate-in fade-in slide-in-from-top-2 duration-300"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {positions.length > 0 && (
                      <Field label="Position">
                        <select
                          value={sportPositions[sportId] ?? ''}
                          onChange={e => setSportPositions(p => ({ ...p, [sportId]: e.target.value }))}
                          className={selectCls}
                        >
                          <option value="" className="bg-zinc-900">Select position</option>
                          {positions.map(p => <option key={p} value={p} className="bg-zinc-900">{p}</option>)}
                        </select>
                      </Field>
                    )}
                    {limb && (
                      <Field label={limb}>
                        <div className="grid grid-cols-3 gap-2">
                          {(['right', 'left', 'ambidextrous'] as const).map(h => (
                            <button
                              key={h}
                              type="button"
                              onClick={() => setDominantLimb(dominantLimb === h ? '' : h)}
                              className={`h-11 border-2 font-mono text-[10px] uppercase tracking-[0.1em] font-bold transition-all rounded-sm
                                ${dominantLimb === h
                                  ? 'border-violet-400 bg-violet-500/15 text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                                  : 'border-white/15 text-zinc-300 hover:border-violet-500/40 hover:text-white'}`}
                            >
                              {h === 'ambidextrous' ? 'Both' : h}
                            </button>
                          ))}
                        </div>
                      </Field>
                    )}
                    <Field label="Jersey Number" hint="Your number on the pitch">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={jersey}
                        onChange={e => setJersey(e.target.value)}
                        placeholder="e.g. 7"
                        maxLength={4}
                        className={`${inputCls} font-mono text-center text-xl font-black text-violet-300 tracking-widest`}
                      />
                    </Field>
                  </div>
                </HudPanel>
              );
            })}

            {/* ─ 03 · SECONDARY SPORTS ─────────────────────────────────── */}
            <HudPanel num="03" title="Other Sports" subtitle="Additional sports you play — tap to add">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">
                  {secondarySports.length === 0 ? 'Select any sports you also compete in' : `${secondarySports.length} sport${secondarySports.length > 1 ? 's' : ''} added`}
                </span>
                {secondarySports.length > 0 && (
                  <button type="button" onClick={() => setSecondarySports([])} className="font-mono text-[9px] text-zinc-500 hover:text-red-400 uppercase tracking-widest transition-colors">
                    Clear
                  </button>
                )}
              </div>
              {nonPrimarySports.length === 0 ? (
                <p className="text-[11px] text-zinc-500 text-center py-8 border border-dashed border-white/[0.06]">
                  All sports used as primary
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                  {nonPrimarySports.map(id => {
                    const m = SPORT_REGISTRY[id];
                    const active = secondarySports.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleSecondary(id)}
                        className={`group relative h-[88px] flex flex-col items-center justify-center gap-1.5 border-2 transition-all duration-200
                          ${active
                            ? 'border-fuchsia-400 bg-fuchsia-500/10 shadow-[0_0_14px_rgba(232,121,249,0.25)]'
                            : 'border-white/10 hover:border-fuchsia-400/40 hover:bg-fuchsia-500/5'}`}
                      >
                        {active && (
                          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-fuchsia-400 shadow-[0_0_6px_rgba(232,121,249,0.8)]" />
                        )}
                        <span className="text-2xl leading-none group-hover:scale-110 transition-transform">{m.icon as string}</span>
                        <span className={`font-mono text-[9px] uppercase tracking-[0.08em] font-bold leading-tight text-center px-1 ${active ? 'text-fuchsia-200' : 'text-zinc-400'}`}>
                          {m.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </HudPanel>

            {/* ─ 04 · ACADEMIC + TEAMS (two panels side-by-side) ─────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <HudPanel num="04" title="Academic" subtitle="Institution">
                <div className="space-y-5">
                  <Field label="Institution Name">
                    <input value={college} onChange={e => setCollege(e.target.value)} placeholder="BMS College of Engineering" className={inputCls} />
                  </Field>
                  {college.trim() && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Field label="USN / Roll No.">
                        <input value={usnRoll} onChange={e => setUsnRoll(e.target.value)} placeholder="1BM21CS001" className={`${inputCls} font-mono`} />
                      </Field>
                      <div className="grid grid-cols-3 gap-3">
                        <Field label="Year">
                          <select value={academicYear} onChange={e => setAcademicYear(e.target.value)} className={selectCls}>
                            <option value="" className="bg-zinc-900">—</option>
                            {ACADEMIC_YEARS.map(y => <option key={y} value={y} className="bg-zinc-900">{y}</option>)}
                          </select>
                        </Field>
                        <Field label="Grad">
                          <select value={gradYear} onChange={e => setGradYear(e.target.value)} className={selectCls}>
                            <option value="" className="bg-zinc-900">—</option>
                            {GRAD_YEARS.map(y => <option key={y} value={y} className="bg-zinc-900">{y}</option>)}
                          </select>
                        </Field>
                        <Field label="Length">
                          <select value={courseLength} onChange={e => setCourseLength(e.target.value)} className={selectCls}>
                            <option value="" className="bg-zinc-900">—</option>
                            {COURSE_LENGTHS.map(l => <option key={l} value={l} className="bg-zinc-900">{l}</option>)}
                          </select>
                        </Field>
                      </div>
                    </div>
                  )}
                </div>
              </HudPanel>

              <HudPanel num="05" title="Teams" subtitle="Club affiliation">
                <Field label="Sports Club" hint="Any club team outside college">
                  <input value={clubName} onChange={e => setClubName(e.target.value)} placeholder="Bengaluru Hoops Club" className={inputCls} />
                </Field>
              </HudPanel>
            </div>

            {/* ─ 06 · BIO & LINKS ─────────────────────────────────────────── */}
            <HudPanel num="06" title="Bio & Socials" subtitle="Tell your story">
              <div className="space-y-5">
                <Field label={forSelf ? 'About You' : 'About the Athlete'} status={`${bio.length}/280`}>
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder="Playing style, strengths, achievements…"
                    rows={3}
                    maxLength={280}
                    className={`${inputCls} h-auto py-3 resize-none leading-relaxed`}
                  />
                </Field>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="md:col-span-3">
                    <Field label="Highlight Reel URL">
                      <input type="url" value={highlightVideoUrl} onChange={e => setHighlightVideoUrl(e.target.value)} placeholder="https://youtube.com/..." className={inputCls} />
                    </Field>
                  </div>
                  <Field label="Instagram">
                    <input value={instagramHandle} onChange={e => setInstagramHandle(e.target.value)} placeholder="@handle" className={inputCls} />
                  </Field>
                  <Field label="YouTube">
                    <input value={youtubeChannel} onChange={e => setYoutubeChannel(e.target.value)} placeholder="@channel" className={inputCls} />
                  </Field>
                  <Field label="X / Twitter">
                    <input value={twitterHandle} onChange={e => setTwitterHandle(e.target.value)} placeholder="@handle" className={inputCls} />
                  </Field>
                </div>
              </div>
            </HudPanel>

            {/* ─ 07 · COMBAT METRICS (collapsible) ───────────────────────── */}
            <HudPanel num="07" title="Physical Stats" subtitle="Measurables — optional">
              <button
                type="button"
                onClick={() => setMeasurablesOpen(p => !p)}
                className="w-full h-12 flex items-center justify-between px-4 border border-violet-500/20 hover:border-violet-400/50 hover:bg-violet-500/5 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-violet-300 uppercase tracking-[0.2em] font-bold">
                    {measurablesOpen ? '// Collapse metrics' : '// Expand metrics'}
                  </span>
                  <span className="font-mono text-[9px] text-zinc-600 uppercase tracking-[0.2em]">Optional</span>
                </div>
                <svg className={`w-4 h-4 text-violet-400 transition-transform ${measurablesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {measurablesOpen && (
                <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <Field label="Height (cm)">
                    <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="183" min={100} max={250} className={`${inputCls} font-mono`} />
                  </Field>
                  <Field label="Weight (kg)">
                    <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="72" min={30} max={200} className={`${inputCls} font-mono`} />
                  </Field>
                  <Field label="Wingspan (cm)">
                    <input type="number" value={wingspanCm} onChange={e => setWingspanCm(e.target.value)} placeholder="190" min={100} max={280} className={`${inputCls} font-mono`} />
                  </Field>
                  <Field label="Vertical Leap (cm)">
                    <input type="number" value={verticalLeapCm} onChange={e => setVerticalLeapCm(e.target.value)} placeholder="65" min={0} max={150} className={`${inputCls} font-mono`} />
                  </Field>
                  <Field label="Shuttle Run (sec)">
                    <input type="number" value={shuttleRunSec} onChange={e => setShuttleRunSec(e.target.value)} placeholder="4.35" step="0.01" min={0} max={30} className={`${inputCls} font-mono`} />
                  </Field>
                  <Field label="Bench Press (kg)">
                    <input type="number" value={benchPressKg} onChange={e => setBenchPressKg(e.target.value)} placeholder="80" min={0} max={400} className={`${inputCls} font-mono`} />
                  </Field>
                </div>
              )}
            </HudPanel>

            {/* Footer cue */}
            <div className="py-8 text-center">
              <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-[0.3em]">
                {canSubmit
                  ? '// Ready to deploy — hit CLAIM PASSPORT to activate'
                  : '// Awaiting required fields: name & phone'}
              </p>
            </div>

          </main>
        </div>
      </div>
    </div>
  );
};

// ─── Sidebar sub-components ──────────────────────────────────────────────────

const StatRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-[0.2em]">{label}</span>
    <span className={`text-[12px] text-zinc-200 font-semibold truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
  </div>
);

const ReqChip: React.FC<{ filled: boolean; label: string }> = ({ filled, label }) => (
  <div className={`flex-1 h-8 flex items-center justify-center gap-1.5 border transition-all ${
    filled
      ? 'border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
      : 'border-white/10 bg-white/[0.02]'
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${filled ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-zinc-700'}`} />
    <span className={`font-mono text-[9px] uppercase tracking-[0.2em] font-bold ${filled ? 'text-emerald-300' : 'text-zinc-500'}`}>
      {label}
    </span>
  </div>
);
