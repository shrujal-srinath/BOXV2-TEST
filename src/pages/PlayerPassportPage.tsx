// src/pages/PlayerPassportPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import type { PlayerProfile, PlayerTeam } from '../types';
import {
  getMyProfile,
  registerProfile,
  addTeam,
  uploadProfilePhoto,
} from '../services/playerService';
import { subscribeToAuth } from '../services/authService';
import { SPORT_REGISTRY, CORE_SPORTS, EXTENDED_SPORTS } from '../sports/registry';
import { PlayerIdCard } from '../components/PlayerIdCard';

// ─── Sport-specific config ─────────────────────────────────────────────────────

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

// Sports where dominant limb = foot (show "Preferred Foot" label)
const FOOT_SPORTS = new Set(['football', 'kabaddi']);
// Sports where dominant limb field is irrelevant
const NO_LIMB_SPORTS = new Set(['chess', 'athletics', 'general']);

function limbLabel(sportId: string): string {
  if (FOOT_SPORTS.has(sportId)) return 'Preferred Foot';
  if (NO_LIMB_SPORTS.has(sportId)) return '';
  return 'Dominant Hand';
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

const STEPS: { n: Step; title: string; subtitle: string }[] = [
  { n: 1, title: 'Identity',     subtitle: 'Who you are'         },
  { n: 2, title: 'Your Game',    subtitle: 'Primary sport details'  },
  { n: 3, title: 'Other Sports', subtitle: 'Secondary sports'      },
  { n: 4, title: 'Background',   subtitle: 'College & club'        },
];

const COURSE_LENGTHS = ['1 Year', '2 Years', '3 Years', '4 Years', '5 Years', '6 Years'];
const currentYear = new Date().getFullYear();
const GRAD_YEARS = Array.from({ length: 12 }, (_, i) => String(currentYear - 2 + i));

// ─── Shared styles ─────────────────────────────────────────────────────────────

const inp = [
  'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all duration-150',
  'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400',
  'focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10',
  'dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100 dark:placeholder:text-zinc-500',
  'dark:focus:border-violet-500 dark:focus:ring-violet-500/10',
].join(' ');

// ─── Subcomponents ────────────────────────────────────────────────────────────

const StepBar: React.FC<{ step: Step }> = ({ step }) => (
  <div className="flex items-center w-full gap-0">
    {STEPS.map((s, i) => (
      <React.Fragment key={s.n}>
        <div className="flex flex-col items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
            ${step > s.n
              ? 'bg-violet-600 text-white'
              : step === s.n
              ? 'bg-violet-600 text-white ring-4 ring-violet-500/20'
              : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600'}`}>
            {step > s.n ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            ) : s.n}
          </div>
          <span className={`text-[9px] font-semibold mt-1 uppercase tracking-wide hidden sm:block
            ${step === s.n ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-zinc-600'}`}>
            {s.title}
          </span>
        </div>
        {i < STEPS.length - 1 && (
          <div className={`flex-1 h-px mx-1 mt-[-14px] sm:mt-[-20px] transition-all ${step > s.n ? 'bg-violet-500' : 'bg-slate-200 dark:bg-zinc-700'}`} />
        )}
      </React.Fragment>
    ))}
  </div>
);

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}
const Field: React.FC<FieldProps> = ({ label, required, hint, children }) => (
  <div>
    <div className="flex items-center gap-1.5 mb-1.5">
      <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wide">
        {label}
      </label>
      {required
        ? <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider">Required</span>
        : <span className="text-[9px] text-slate-400 dark:text-zinc-500">Optional</span>}
    </div>
    {children}
    {hint && <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1.5 leading-relaxed">{hint}</p>}
  </div>
);

interface SectionCardProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}
const SectionCard: React.FC<SectionCardProps> = ({ icon, title, description, children }) => (
  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
    <div className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">{title}</h3>
        {description && <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">{description}</p>}
      </div>
    </div>
    <div className="p-5 space-y-4">
      {children}
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const PlayerPassportPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const forSelf = searchParams.get('type') !== 'other';

  const [user, setUser]             = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [step, setStep]             = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [createdProfile, setCreatedProfile] = useState<PlayerProfile | null>(null);
  const [showMoreCoreSports, setShowMoreCoreSports] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Photo ──────────────────────────────────────────────────────────────────
  const [photoFile, setPhotoFile]       = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // ── Step 1: Identity ───────────────────────────────────────────────────────
  const [fullName, setFullName]       = useState('');
  const [phone, setPhone]             = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dob, setDob]                 = useState('');
  const [gender, setGender]           = useState<PlayerProfile['gender']>(null);
  const [email, setEmail]             = useState('');

  // ── Step 2: Primary Sport(s) ───────────────────────────────────────────────
  const [primarySports, setPrimarySports]     = useState<string[]>([]);
  // position per primary sport
  const [sportPositions, setSportPositions]   = useState<Record<string, string>>({});
  // dominant hand/foot (one shared field → maps to DB dominant_hand)
  const [dominantLimb, setDominantLimb]       = useState<'left' | 'right' | 'ambidextrous' | ''>('');
  const [jersey, setJersey]                   = useState('');
  const [heightCm, setHeightCm]               = useState('');
  const [weightKg, setWeightKg]               = useState('');

  // ── Step 3: Other Sports ───────────────────────────────────────────────────
  const [secondarySports, setSecondarySports] = useState<string[]>([]);

  // ── Step 4: Background ─────────────────────────────────────────────────────
  const [college, setCollege]           = useState('');
  const [usnRoll, setUsnRoll]           = useState('');
  const [gradYear, setGradYear]         = useState('');
  const [courseLength, setCourseLength] = useState('');
  const [clubName, setClubName]         = useState('');
  const [bio, setBio]                   = useState('');

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
    setPrimarySports(prev => {
      if (prev.includes(id)) {
        const next = prev.filter(s => s !== id);
        const posClone = { ...sportPositions };
        delete posClone[id];
        setSportPositions(posClone);
        return next;
      }
      if (prev.length >= 2) return prev; // max 2
      return [...prev, id];
    });
  };

  const toggleSecondary = (id: string) =>
    setSecondarySports(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const validate = (): boolean => {
    if (step === 1) {
      if (fullName.trim().length < 2) { setError('Full name must be at least 2 characters.'); return false; }
      if (!phone.trim()) { setError('Phone number is required — we use it to identify your account.'); return false; }
    }
    if (step === 2 && primarySports.length === 0) {
      setError('Select at least one primary sport.'); return false;
    }
    setError('');
    return true;
  };

  const handleNext = () => { if (validate()) setStep(s => (s + 1) as Step); };
  const handleBack = () => { setError(''); setStep(s => (s - 1) as Step); };

  const allSports = [...primarySports, ...secondarySports.filter(s => !primarySports.includes(s))];

  const buildPosition = (): string | undefined => {
    const parts = primarySports
      .map(id => sportPositions[id] ? `${sportPositions[id]}` : '')
      .filter(Boolean);
    if (parts.length === 0) return undefined;
    if (primarySports.length === 1) return parts[0];
    const sportLabels = primarySports.map((id, i) => parts[i] ? `${parts[i]} (${SPORT_REGISTRY[id]?.label ?? id})` : null).filter(Boolean);
    return sportLabels.join(', ') || undefined;
  };

  const handleSubmit = async () => {
    if (!user || !validate()) return;
    setSubmitting(true);

    const profile = await registerProfile({
      full_name:        fullName.trim(),
      display_name:     displayName.trim() || undefined,
      date_of_birth:    dob || undefined,
      gender:           gender || undefined,
      phone_number:     phone.trim(),
      email:            email.trim() || undefined,
      height_cm:        heightCm ? parseInt(heightCm) : undefined,
      weight_kg:        weightKg ? parseInt(weightKg) : undefined,
      dominant_hand:    dominantLimb || undefined,
      primary_position: buildPosition(),
      jersey_number:    jersey.trim() || undefined,
      sport_ids:        allSports,
      bio:              bio.trim() || undefined,
      registered_by:    user.id,
      auth_user_id:     forSelf ? user.id : undefined,
      is_claimed:       forSelf,
      college_name:     college.trim() || undefined,
      usn:              usnRoll.trim() || undefined,
    });

    if (!profile) { setSubmitting(false); setError('Registration failed — please try again.'); return; }

    if (photoFile) await uploadProfilePhoto(profile.id, photoFile);

    // Save college as a team entry if filled
    if (college.trim()) {
      const seasonNote = [gradYear, courseLength].filter(Boolean).join(' · ');
      await addTeam(profile.id, {
        team_type: 'college',
        team_name: college.trim(),
        jersey_number: usnRoll.trim() || null,
        position: null,
        role: 'player',
        season_from: null,
        season_to: gradYear || null,
        is_active: true,
      });
    }

    // Save club as a team entry if filled
    if (clubName.trim()) {
      await addTeam(profile.id, {
        team_type: 'club',
        team_name: clubName.trim(),
        jersey_number: jersey.trim() || null,
        position: buildPosition() || null,
        role: 'player',
        season_from: null,
        season_to: null,
        is_active: true,
      });
    }

    const fresh = photoFile ? await getMyProfile(user.id) : null;
    setCreatedProfile(fresh ?? { ...profile, profile_photo_url: photoPreview ?? null });
    setSubmitting(false);
  };

  // ── Auth states ──────────────────────────────────────────────────────────────

  if (authLoading) return (
    <div className="min-h-dvh bg-slate-50 dark:bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user || (user as any).is_anonymous) return (
    <div className="min-h-dvh bg-slate-50 dark:bg-zinc-950 flex items-center justify-center p-6">
      <div className="text-center max-w-xs">
        <div className="w-16 h-16 bg-violet-100 dark:bg-violet-900/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-zinc-50 uppercase tracking-tight mb-2">Sign In Required</h2>
        <p className="text-slate-500 dark:text-zinc-400 text-sm mb-6">You need to be signed in to register a player passport.</p>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-violet-700 text-white text-xs font-bold uppercase tracking-widest rounded-xl">
          Back to Home
        </button>
      </div>
    </div>
  );

  // ── Success screen ────────────────────────────────────────────────────────────

  if (createdProfile) {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 gap-8">
        <div className="w-full max-w-sm animate-in zoom-in-95 fade-in duration-300">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold uppercase tracking-wider">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              {forSelf ? 'Passport Activated' : 'Athlete Registered'}
            </span>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-slate-900 dark:text-zinc-50 uppercase tracking-tight italic">
              {forSelf ? 'Welcome to\nThe Box' : createdProfile.full_name}
            </h2>
            <p className="text-slate-500 dark:text-zinc-400 text-sm mt-2">
              {forSelf
                ? 'Your player passport is live. Stats will be tracked automatically from your next game.'
                : `Registered successfully. They can claim their passport by signing in with ${createdProfile.phone_number ?? 'their phone number'}.`}
            </p>
          </div>

          {/* ID Card */}
          <PlayerIdCard profile={createdProfile} className="mb-6" />

          {/* Player code */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl px-5 py-4 flex items-center gap-4 mb-6">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest mb-1">Player Code</p>
              <p className="font-mono text-xl font-black text-violet-600 dark:text-violet-400 tracking-widest">{createdProfile.player_code}</p>
            </div>
            <button
              onClick={() => navigator.clipboard?.writeText(createdProfile.player_code)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-violet-100 dark:hover:bg-violet-900/30 text-slate-500 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              title="Copy player code"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>

          <div className="flex gap-3">
            {!forSelf && (
              <button
                onClick={() => {
                  setCreatedProfile(null); setStep(1);
                  setFullName(''); setPhone(''); setDisplayName(''); setDob('');
                  setGender(null); setEmail(''); setPrimarySports([]);
                  setSportPositions({}); setDominantLimb(''); setJersey('');
                  setHeightCm(''); setWeightKg(''); setSecondarySports([]);
                  setCollege(''); setUsnRoll(''); setGradYear(''); setCourseLength('');
                  setClubName(''); setBio(''); setPhotoFile(null); setPhotoPreview(null);
                }}
                className="flex-1 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
              >
                + Register Another
              </button>
            )}
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-[2] py-3 bg-violet-700 hover:bg-violet-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-[0_4px_14px_rgba(109,40,217,0.3)] transition-all"
            >
              Go to Dashboard →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── ALL SPORTS excluding already-primary ─────────────────────────────────
  const nonPrimarySports = Object.keys(SPORT_REGISTRY).filter(id => !primarySports.includes(id));

  // ── Registration wizard ────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-zinc-950 font-sans">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-slate-200 dark:border-zinc-800">
        <div className="max-w-xl mx-auto px-5 py-3 flex items-center gap-4">
          <button
            onClick={() => step > 1 ? handleBack() : navigate('/dashboard')}
            className="w-9 h-9 flex items-center justify-center -ml-1 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 transition-colors"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <StepBar step={step} />
          </div>
        </div>
      </header>

      {/* ── Scrollable content ──────────────────────────────────────────────── */}
      <div className="max-w-xl mx-auto px-4 pt-6 pb-36 space-y-5">

        {/* Step heading */}
        <div>
          <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest mb-1">
            Step {step} of {STEPS.length}
          </p>
          <h1 className="text-3xl font-black text-slate-900 dark:text-zinc-50 uppercase tracking-tight italic">
            {STEPS[step - 1].title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            {step === 1 && (forSelf ? 'Tell us about yourself. Your phone number is required so others can find and register you.' : "Fill in the athlete's basic details. Phone number is required.")}
            {step === 2 && "Choose up to 2 primary sports. We'll collect detailed stats for these."}
            {step === 3 && 'Any other sports you play? We track stats for these too — just less detail.'}
            {step === 4 && 'Your academic and club background. Everything here is optional.'}
          </p>
        </div>

        {/* ─────────────────── STEP 1: IDENTITY ─────────────────────────── */}
        {step === 1 && (
          <>
            {/* Photo upload */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center py-6 cursor-pointer group"
              role="button"
              tabIndex={0}
              aria-label="Upload profile photo"
            >
              <div className="relative">
                <div className={`w-28 h-28 rounded-full overflow-hidden flex items-center justify-center transition-all duration-200
                  bg-slate-100 dark:bg-zinc-800
                  border-2 ${photoPreview ? 'border-violet-500' : 'border-slate-300 dark:border-zinc-600 group-hover:border-violet-400 dark:group-hover:border-violet-600'}
                  shadow-sm`}>
                  {photoPreview
                    ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    : (
                      <svg className="w-12 h-12 text-slate-300 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )
                  }
                </div>
                <div className="absolute bottom-0.5 right-0.5 w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-950 shadow">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-3 font-medium">
                {photoPreview ? 'Tap to change photo' : 'Add a profile photo'}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-600 mt-0.5">Drag & drop or tap to browse</p>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
            </div>

            <SectionCard
              icon={<svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
              title="Name"
              description="How you appear across the platform"
            >
              <Field label="Full Name" required>
                <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder={forSelf ? 'Your legal name' : "Athlete's full name"} autoFocus className={inp} />
              </Field>
              <Field label="Display Name / Nickname" hint="Shown on scoreboards instead of your full name">
                <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. King James, El Tornado" className={inp} />
              </Field>
            </SectionCard>

            <SectionCard
              icon={<svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>}
              title="Contact"
              description="Used to identify and link your account to games"
            >
              <Field label="Phone Number" required hint="Your phone number is your unique player identifier. Used to find you in the system.">
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className={inp}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email Address">
                  <input type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="player@example.com" className={inp} />
                </Field>
                <Field label="Gender">
                  <select value={gender ?? ''} onChange={e => setGender((e.target.value as PlayerProfile['gender']) || null)} className={inp}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </Field>
              </div>
              <Field label="Date of Birth">
                <input type="date" value={dob} onChange={e => setDob(e.target.value)} className={inp} />
              </Field>
            </SectionCard>
          </>
        )}

        {/* ─────────────────── STEP 2: YOUR GAME ────────────────────────── */}
        {step === 2 && (
          <>
            {/* Primary sport selection */}
            <SectionCard
              icon={<svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
              title="Primary Sport(s)"
              description="Select 1 or 2 sports you compete in most. We'll collect detailed stats for these."
            >
              {primarySports.length === 2 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl text-xs text-violet-700 dark:text-violet-300">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Maximum 2 primary sports selected. Deselect one to change.
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {Object.entries(SPORT_REGISTRY)
                  .filter(([id]) => !EXTENDED_SPORTS.includes(id as any) || showMoreCoreSports || primarySports.includes(id))
                  .map(([id, m]) => {
                    const active = primarySports.includes(id);
                    const locked = !active && primarySports.length >= 2;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => !locked && togglePrimary(id)}
                        disabled={locked}
                        className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all duration-150
                          ${active
                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                            : locked
                            ? 'border-slate-150 dark:border-zinc-800 opacity-40 cursor-not-allowed bg-transparent'
                            : 'border-slate-200 dark:border-zinc-700 hover:border-violet-300 dark:hover:border-violet-700 cursor-pointer bg-transparent'
                          }`}
                        aria-pressed={active}
                      >
                        {active && (
                          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-violet-600 rounded-full flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                        <span className="text-2xl leading-none">{m.icon as string}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wide leading-tight ${active ? 'text-violet-700 dark:text-violet-300' : 'text-slate-600 dark:text-zinc-400'}`}>
                          {m.label}
                        </span>
                      </button>
                    );
                  })
                }
              </div>

              <button
                type="button"
                onClick={() => setShowMoreCoreSports(p => !p)}
                className="w-full py-2 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className={`w-4 h-4 transition-transform ${showMoreCoreSports ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
                {showMoreCoreSports ? 'Show fewer sports' : `Show all ${Object.keys(SPORT_REGISTRY).length} sports`}
              </button>
            </SectionCard>

            {/* Sport-specific position per primary sport */}
            {primarySports.map(sportId => {
              const m = SPORT_REGISTRY[sportId];
              const positions = POSITIONS[sportId] ?? [];
              const limb = limbLabel(sportId);
              return (
                <SectionCard
                  key={sportId}
                  icon={<span className="text-xl">{m.icon as string}</span>}
                  title={`${m.label} — Playing Details`}
                  description="Position and style details for this sport"
                >
                  <Field label="Position" required>
                    <select
                      value={sportPositions[sportId] ?? ''}
                      onChange={e => setSportPositions(p => ({ ...p, [sportId]: e.target.value }))}
                      className={inp}
                    >
                      <option value="">Select your position</option>
                      {positions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </Field>
                  {limb && (
                    <Field label={limb}>
                      <div className="flex gap-2">
                        {(['right', 'left', 'ambidextrous'] as const).map(h => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setDominantLimb(dominantLimb === h ? '' : h)}
                            className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-semibold capitalize transition-all
                              ${dominantLimb === h
                                ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                                : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-violet-300'}`}
                          >
                            {h === 'ambidextrous' ? 'Both' : h.charAt(0).toUpperCase() + h.slice(1)}
                          </button>
                        ))}
                      </div>
                    </Field>
                  )}
                </SectionCard>
              );
            })}

            {/* Physical stats + jersey */}
            <SectionCard
              icon={<svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
              title="Physical Stats"
              description="Used on your ID card and player profile"
            >
              <div className="grid grid-cols-3 gap-3">
                <Field label="Jersey No.">
                  <input type="text" inputMode="numeric" value={jersey} onChange={e => setJersey(e.target.value)} placeholder="23" className={`${inp} font-mono text-center`} maxLength={4} />
                </Field>
                <Field label="Height (cm)">
                  <input type="number" inputMode="numeric" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="183" className={`${inp} font-mono`} min={100} max={250} />
                </Field>
                <Field label="Weight (kg)">
                  <input type="number" inputMode="numeric" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="72" className={`${inp} font-mono`} min={30} max={200} />
                </Field>
              </div>
            </SectionCard>
          </>
        )}

        {/* ─────────────────── STEP 3: OTHER SPORTS ─────────────────────── */}
        {step === 3 && (
          <SectionCard
            icon={<svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>}
            title="Other Sports You Play"
            description="Select any additional sports. Stats will be tracked but without the detailed breakdown."
          >
            {secondarySports.length > 0 && (
              <p className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
                {secondarySports.length} sport{secondarySports.length > 1 ? 's' : ''} selected
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {nonPrimarySports.map(id => {
                const m = SPORT_REGISTRY[id];
                const active = secondarySports.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleSecondary(id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all duration-150 relative
                      ${active
                        ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/20'
                        : 'border-slate-200 dark:border-zinc-700 hover:border-violet-300 dark:hover:border-violet-700'}`}
                  >
                    {active && (
                      <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-violet-600 rounded-full flex items-center justify-center">
                        <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                    <span className="text-xl leading-none">{m.icon as string}</span>
                    <span className={`text-[10px] font-semibold leading-tight ${active ? 'text-violet-700 dark:text-violet-300' : 'text-slate-600 dark:text-zinc-400'}`}>
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {nonPrimarySports.length === 0 && (
              <p className="text-sm text-slate-400 dark:text-zinc-600 text-center py-4">All sports are set as primary. Nothing else to add.</p>
            )}
            <p className="text-xs text-slate-400 dark:text-zinc-500">
              You can skip this step if you only play your primary sport(s).
            </p>
          </SectionCard>
        )}

        {/* ─────────────────── STEP 4: BACKGROUND ──────────────────────── */}
        {step === 4 && (
          <>
            {/* College / University */}
            <SectionCard
              icon={<svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>}
              title="College / University"
              description="Your current or most recent institution"
            >
              <Field label="Institution Name">
                <input value={college} onChange={e => setCollege(e.target.value)} placeholder="e.g. BMS College of Engineering" className={inp} />
              </Field>
              {college.trim() && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Field label="USN / Roll No." hint="Some colleges use USN (University Seat Number), others use Roll Number. Enter whichever applies.">
                    <input
                      value={usnRoll}
                      onChange={e => setUsnRoll(e.target.value)}
                      placeholder="e.g. 1BM21CS001  or  45"
                      className={`${inp} font-mono`}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Year of Graduation">
                      <select value={gradYear} onChange={e => setGradYear(e.target.value)} className={inp}>
                        <option value="">Select year</option>
                        {GRAD_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </Field>
                    <Field label="Course Length">
                      <select value={courseLength} onChange={e => setCourseLength(e.target.value)} className={inp}>
                        <option value="">Select</option>
                        {COURSE_LENGTHS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Club */}
            <SectionCard
              icon={<svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
              title="Club Affiliation"
              description="The sports club you play for (if any)"
            >
              <Field label="Club Name">
                <input value={clubName} onChange={e => setClubName(e.target.value)} placeholder="e.g. Bengaluru Hoops Club" className={inp} />
              </Field>
            </SectionCard>

            {/* Bio */}
            <SectionCard
              icon={<svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
              title="Player Bio"
              description="A short description shown on your profile"
            >
              <Field label={`About ${forSelf ? 'You' : 'the Athlete'} (${bio.length} / 280)`}>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Playing style, strengths, goals, achievements…"
                  rows={4}
                  maxLength={280}
                  className={`${inp} resize-none leading-relaxed`}
                />
              </Field>
            </SectionCard>
          </>
        )}

        {/* Error */}
        {error && (
          <div role="alert" className="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
          </div>
        )}
      </div>

      {/* ── Fixed bottom action bar ─────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-t border-slate-200 dark:border-zinc-800 safe-area-bottom">
        <div className="max-w-xl mx-auto px-4 py-4 flex gap-3">
          <button
            onClick={() => step > 1 ? handleBack() : navigate('/dashboard')}
            className="flex-1 py-3.5 rounded-xl border-2 border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 font-bold uppercase tracking-widest text-xs hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
          >
            {step > 1 ? '← Back' : 'Cancel'}
          </button>

          {step < 4 ? (
            <button
              onClick={handleNext}
              className="flex-[2] py-3.5 rounded-xl bg-violet-700 hover:bg-violet-600 text-white font-black uppercase tracking-widest text-xs shadow-[0_4px_14px_rgba(109,40,217,0.25)] transition-all"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-[2] py-3.5 rounded-xl bg-violet-700 hover:bg-violet-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest text-xs shadow-[0_4px_14px_rgba(109,40,217,0.25)] transition-all"
            >
              {submitting
                ? <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Registering…
                  </span>
                : forSelf ? 'Claim Passport ✓' : 'Register Athlete ✓'
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
