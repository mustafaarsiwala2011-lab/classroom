/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Settings, Moon, Sun, KeyRound, Layout, Columns3, Dock, 
  Activity, Server, ShieldCheck, Sparkles, Palette, Monitor, 
  Eye, Sliders, Check, RotateCcw, Zap, Contrast, CheckCircle2,
  Smartphone, Compass
} from 'lucide-react';
import { User as UserType } from '../types';

interface SettingsSectionProps {
  currentUser: UserType;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onUserUpdate: (updatedUser: UserType) => void;
  layoutMode?: 'sidebar' | 'topbar' | 'floating';
  onLayoutModeChange?: (mode: 'sidebar' | 'topbar' | 'floating') => void;
  onOpenSystemHealth?: () => void;
}

export default function SettingsSection({
  currentUser,
  onLogout,
  darkMode,
  onToggleDarkMode,
  onUserUpdate,
  layoutMode = 'sidebar',
  onLayoutModeChange,
  onOpenSystemHealth,
}: SettingsSectionProps) {
  // Visual Preferences State
  const [themeMode, setThemeMode] = useState<'dark' | 'light' | 'oled'>(() => {
    const saved = localStorage.getItem('classroom_theme_mode');
    if (saved === 'dark' || saved === 'light' || saved === 'oled') return saved;
    return darkMode ? 'dark' : 'light';
  });

  const [accentColor, setAccentColor] = useState<string>(() => {
    return localStorage.getItem('classroom_theme_accent') || 'indigo';
  });

  const [displayDensity, setDisplayDensity] = useState<'compact' | 'default' | 'roomy'>(() => {
    const saved = localStorage.getItem('classroom_theme_density');
    if (saved === 'compact' || saved === 'default' || saved === 'roomy') return saved;
    return 'default';
  });

  const [ambientAura, setAmbientAura] = useState<boolean>(() => {
    return localStorage.getItem('classroom_ambient_aura') !== 'false';
  });

  const [glassBlur, setGlassBlur] = useState<boolean>(() => {
    return localStorage.getItem('classroom_glass_blur') !== 'false';
  });

  const [highContrast, setHighContrast] = useState<boolean>(() => {
    return localStorage.getItem('classroom_high_contrast') === 'true';
  });

  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Sync to document element attributes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    document.documentElement.setAttribute('data-accent', accentColor);
    document.documentElement.setAttribute('data-density', displayDensity);
    document.documentElement.setAttribute('data-ambient', String(ambientAura));
    document.documentElement.setAttribute('data-blur', glassBlur ? 'normal' : 'reduced');
    document.documentElement.setAttribute('data-contrast', highContrast ? 'high' : 'normal');
  }, [themeMode, accentColor, displayDensity, ambientAura, glassBlur, highContrast]);

  const applyVisualPreferences = (
    mode: 'dark' | 'light' | 'oled',
    accent: string,
    density: 'compact' | 'default' | 'roomy',
    ambient: boolean,
    blur: boolean,
    contrast: boolean,
    notice?: string
  ) => {
    setThemeMode(mode);
    setAccentColor(accent);
    setDisplayDensity(density);
    setAmbientAura(ambient);
    setGlassBlur(blur);
    setHighContrast(contrast);

    localStorage.setItem('classroom_theme_mode', mode);
    localStorage.setItem('classroom_theme_accent', accent);
    localStorage.setItem('classroom_theme_density', density);
    localStorage.setItem('classroom_ambient_aura', String(ambient));
    localStorage.setItem('classroom_glass_blur', String(blur));
    localStorage.setItem('classroom_high_contrast', String(contrast));
    localStorage.setItem('classroom_dark_mode', mode !== 'light' ? 'true' : 'false');

    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-accent', accent);
    document.documentElement.setAttribute('data-density', density);
    document.documentElement.setAttribute('data-ambient', String(ambient));
    document.documentElement.setAttribute('data-blur', blur ? 'normal' : 'reduced');
    document.documentElement.setAttribute('data-contrast', contrast ? 'high' : 'normal');

    if (mode === 'light' && darkMode) {
      onToggleDarkMode();
    } else if (mode !== 'light' && !darkMode) {
      onToggleDarkMode();
    }

    if (notice) {
      setFeedbackNotice(notice);
      setTimeout(() => setFeedbackNotice(null), 3200);
    }
  };

  const handleResetDefaults = () => {
    applyVisualPreferences('dark', 'indigo', 'default', true, true, false, 'Preferences restored to Classroom defaults.');
  };

  const ACCENT_PRESETS = [
    { id: 'indigo', name: 'Cosmic Indigo', color: '#6366f1', bg: 'bg-indigo-500', ring: 'ring-indigo-400' },
    { id: 'emerald', name: 'Emerald Scholar', color: '#10b981', bg: 'bg-emerald-500', ring: 'ring-emerald-400' },
    { id: 'violet', name: 'Cyber Violet', color: '#a855f7', bg: 'bg-purple-500', ring: 'ring-purple-400' },
    { id: 'amber', name: 'Amber Lantern', color: '#f59e0b', bg: 'bg-amber-500', ring: 'ring-amber-400' },
    { id: 'sky', name: 'Ocean Azure', color: '#0ea5e9', bg: 'bg-sky-500', ring: 'ring-sky-400' },
    { id: 'rose', name: 'Ruby Crimson', color: '#f43f5e', bg: 'bg-rose-500', ring: 'ring-rose-400' },
  ];

  const THEME_OPTIONS = [
    {
      id: 'dark' as const,
      label: 'Dark Cosmic',
      tagline: 'Obsidian & purple neon aura for low-light night study',
      icon: Moon,
      badgeText: 'Eye-Safe Night',
    },
    {
      id: 'light' as const,
      label: 'Light Slate',
      tagline: 'High-contrast daylight mode for bright classrooms',
      icon: Sun,
      badgeText: 'Daylight Focus',
    },
    {
      id: 'oled' as const,
      label: 'OLED Midnight',
      tagline: 'Pure black (#000000) pixels for max battery conservation',
      icon: Sparkles,
      badgeText: 'Max Battery Saver',
    },
  ];

  const DENSITY_OPTIONS = [
    {
      id: 'compact' as const,
      label: 'Compact',
      scale: '90%',
      desc: 'Fits +30% more chat and study notes on screen',
    },
    {
      id: 'default' as const,
      label: 'Comfort',
      scale: '100%',
      desc: 'Balanced spacing, standard classroom typography',
    },
    {
      id: 'roomy' as const,
      label: 'Scholar / Large',
      scale: '110%',
      desc: 'Generous line height for Arabic diacritics & Nahw',
    },
  ];

  // Password State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);

  // Change Password Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdSuccess(null);
    setPwdError(null);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPwdError('All password fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 4) {
      setPwdError('Password must be at least 4 characters.');
      return;
    }

    setPwdLoading(true);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          oldPassword,
          newPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Password change failed');
      }

      setPwdSuccess('Your password has been changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onUserUpdate({
        ...currentUser,
        hasChangedDefaultPassword: true,
      });
    } catch (err: any) {
      setPwdError(err.message || 'Error updating password.');
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8 space-y-8" id="settings-page-root">
      {/* Intro Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel rounded-3xl p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold font-sans tracking-tight text-white flex items-center gap-2">
            <Settings className="h-6 w-6 text-indigo-400" />
            Classroom Settings
          </h1>
          <p className="text-sm text-slate-300">
            Control your visual preferences, navigation layout, and update account security.
          </p>
        </div>

        <button
          onClick={onLogout}
          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer"
          id="logout-btn"
        >
          Sign Out of Hub
        </button>
      </div>

      {/* Grid of options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Visual Preferences & Theme Studio Card */}
        <div className="glass-panel rounded-3xl p-6 md:p-8 space-y-6 md:col-span-2 border border-white/10 relative overflow-hidden" id="theme-preferences-card">
          {/* Card Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/8">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
                <Sparkles className="h-5 w-5 text-indigo-400" />
                <span>Theme & Display Studio</span>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-semibold">
                  Personalized
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Customize your visual atmosphere, day/night contrast, accent colors, reading density, and graphics performance.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-slate-300 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="capitalize">{themeMode}</span> • <span className="capitalize">{accentColor}</span>
              </span>

              <button
                type="button"
                id="reset-theme-defaults-btn"
                onClick={handleResetDefaults}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                title="Restore default classroom theme settings"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                <span>Reset Defaults</span>
              </button>
            </div>
          </div>

          {/* Feedback banner */}
          {feedbackNotice && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-lg">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{feedbackNotice}</span>
            </div>
          )}

          {/* 1. Appearance / Theme Mode Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5 text-indigo-400" />
                <span>1. Appearance & Contrast Mode</span>
              </label>
              <span className="text-[11px] text-slate-400">
                Active: <strong className="text-white capitalize">{themeMode === 'oled' ? 'OLED Midnight' : themeMode === 'light' ? 'Light Slate' : 'Dark Cosmic'}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {THEME_OPTIONS.map((opt) => {
                const isSelected = themeMode === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    id={opt.id === 'dark' ? 'theme-toggle-btn' : `theme-mode-${opt.id}-btn`}
                    onClick={() => applyVisualPreferences(opt.id, accentColor, displayDensity, ambientAura, glassBlur, highContrast, `Switched to ${opt.label} mode.`)}
                    className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer relative group ${
                      isSelected
                        ? 'bg-indigo-600/25 border-indigo-400 text-white ring-1 ring-indigo-400/80 shadow-lg shadow-indigo-950/40'
                        : 'bg-white/5 border-white/8 text-slate-300 hover:bg-white/10 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-2 rounded-xl ${
                        opt.id === 'light'
                          ? 'bg-amber-500/20 text-amber-400'
                          : opt.id === 'oled'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-indigo-500/20 text-indigo-400'
                      }`}>
                        <Icon className="h-4.5 w-4.5" />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                          {opt.badgeText}
                        </span>
                        {isSelected && (
                          <span className="h-5 w-5 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="font-bold text-sm block text-white">{opt.label}</span>
                      <span className="text-[11px] text-slate-300 block mt-1 leading-relaxed">
                        {opt.tagline}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Classroom Atmosphere Accent Color Palette */}
          <div className="space-y-3 pt-2 border-t border-white/8">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 text-indigo-400" />
                <span>2. Classroom Accent & Highlight Aura</span>
              </label>
              <span className="text-[11px] text-slate-400">
                Selected: <strong className="text-white capitalize">{ACCENT_PRESETS.find(a => a.id === accentColor)?.name || accentColor}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {ACCENT_PRESETS.map((preset) => {
                const isSelected = accentColor === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    id={`accent-${preset.id}-btn`}
                    onClick={() => applyVisualPreferences(themeMode, preset.id, displayDensity, ambientAura, glassBlur, highContrast, `Accent changed to ${preset.name}.`)}
                    className={`p-3 rounded-2xl border transition-all flex flex-col items-center justify-center text-center cursor-pointer gap-2 ${
                      isSelected
                        ? 'bg-white/12 border-white/30 ring-2 ring-indigo-400 shadow-md scale-[1.02]'
                        : 'bg-white/5 border-white/8 hover:bg-white/10 hover:border-white/15'
                    }`}
                  >
                    <div className="relative flex items-center justify-center">
                      <span 
                        className={`h-6 w-6 rounded-full ${preset.bg} shadow-md flex items-center justify-center transition-transform ${
                          isSelected ? 'scale-110' : ''
                        }`}
                        style={{ boxShadow: `0 0 12px ${preset.color}66` }}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-white tracking-tight">
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Note Readability & Display Density */}
          <div className="space-y-3 pt-2 border-t border-white/8">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-indigo-400" />
                <span>3. Note Readability & Text Scale</span>
              </label>
              <span className="text-[11px] text-slate-400">
                Recommended for Nahw & Arabic Study
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {DENSITY_OPTIONS.map((dens) => {
                const isSelected = displayDensity === dens.id;
                return (
                  <button
                    key={dens.id}
                    type="button"
                    id={`density-${dens.id}-btn`}
                    onClick={() => applyVisualPreferences(themeMode, accentColor, dens.id, ambientAura, glassBlur, highContrast, `Text scale set to ${dens.label}.`)}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/25 border-indigo-400 text-white ring-1 ring-indigo-400/80 shadow-md'
                        : 'bg-white/5 border-white/8 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-white">{dens.label}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 font-bold text-indigo-300">
                        {dens.scale}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      {dens.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Visual Effects & Hardware Performance Toggles */}
          <div className="space-y-3 pt-2 border-t border-white/8">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-indigo-400" />
                <span>4. Visual Effects & Graphics Tuning</span>
              </label>
              <span className="text-[11px] text-slate-400">
                Hardware Acceleration & Battery
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Glassmorphism Blur Toggle */}
              <div className="p-3.5 rounded-2xl border border-white/8 bg-white/5 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Glass Blur Effects</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      glassBlur ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/10 text-slate-400'
                    }`}>
                      {glassBlur ? 'Active' : 'Battery Saver'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    Frosted backdrop filters across panels and sidebar navigation.
                  </p>
                </div>

                <button
                  type="button"
                  id="toggle-glass-blur-btn"
                  onClick={() => applyVisualPreferences(themeMode, accentColor, displayDensity, ambientAura, !glassBlur, highContrast, glassBlur ? 'Glass blur reduced for battery savings.' : 'Full glass blur enabled.')}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    glassBlur
                      ? 'bg-indigo-600/30 border border-indigo-400/50 text-indigo-200 hover:bg-indigo-600/40'
                      : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>{glassBlur ? 'Enabled (Smooth)' : 'Reduced (Saver)'}</span>
                </button>
              </div>

              {/* Ambient Cosmic Orbs Toggle */}
              <div className="p-3.5 rounded-2xl border border-white/8 bg-white/5 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Background Aura</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      ambientAura ? 'bg-purple-500/20 text-purple-300' : 'bg-white/10 text-slate-400'
                    }`}>
                      {ambientAura ? 'Illuminated' : 'Minimal'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    Deep cosmic glowing gradients behind classroom workspace.
                  </p>
                </div>

                <button
                  type="button"
                  id="toggle-ambient-aura-btn"
                  onClick={() => applyVisualPreferences(themeMode, accentColor, displayDensity, !ambientAura, glassBlur, highContrast, ambientAura ? 'Ambient background aura hidden.' : 'Ambient background aura illuminated.')}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    ambientAura
                      ? 'bg-purple-600/30 border border-purple-400/50 text-purple-200 hover:bg-purple-600/40'
                      : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{ambientAura ? 'Glowing Aura On' : 'Minimal Solid Off'}</span>
                </button>
              </div>

              {/* High Contrast Outlines Toggle */}
              <div className="p-3.5 rounded-2xl border border-white/8 bg-white/5 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">High Contrast Outlines</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      highContrast ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-400'
                    }`}>
                      {highContrast ? 'High' : 'Soft'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    Crisp, defined border strokes to assist visual separation in bright light.
                  </p>
                </div>

                <button
                  type="button"
                  id="toggle-high-contrast-btn"
                  onClick={() => applyVisualPreferences(themeMode, accentColor, displayDensity, ambientAura, glassBlur, !highContrast, highContrast ? 'Standard soft borders restored.' : 'High contrast borders active.')}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    highContrast
                      ? 'bg-emerald-600/30 border border-emerald-400/50 text-emerald-200 hover:bg-emerald-600/40'
                      : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Contrast className="h-3.5 w-3.5" />
                  <span>{highContrast ? 'High Contrast Active' : 'Soft Natural'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Layout & Navigation Customizer Card */}
        {onLayoutModeChange && (
          <div className="glass-panel rounded-3xl p-6 space-y-4" id="layout-customizer-card">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layout className="h-5 w-5 text-indigo-400" />
              <span>Layout & Navigation Style</span>
            </h2>
            <p className="text-xs text-slate-300">
              Choose how you prefer to navigate Classroom Hub across desktop and widescreen viewports.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => onLayoutModeChange('sidebar')}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  layoutMode === 'sidebar'
                    ? 'bg-indigo-600/30 border-indigo-400 text-white ring-1 ring-indigo-400'
                    : 'bg-white/5 border-white/8 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                }`}
              >
                <Columns3 className={`h-5 w-5 mb-2 ${layoutMode === 'sidebar' ? 'text-indigo-300' : 'text-slate-400'}`} />
                <div>
                  <span className="text-xs font-bold block">Left Sidebar</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Classic collapsible</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onLayoutModeChange('topbar')}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  layoutMode === 'topbar'
                    ? 'bg-indigo-600/30 border-indigo-400 text-white ring-1 ring-indigo-400'
                    : 'bg-white/5 border-white/8 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                }`}
              >
                <Layout className={`h-5 w-5 mb-2 ${layoutMode === 'topbar' ? 'text-indigo-300' : 'text-slate-400'}`} />
                <div>
                  <span className="text-xs font-bold block">Top Bar</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Widescreen header</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onLayoutModeChange('floating')}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  layoutMode === 'floating'
                    ? 'bg-indigo-600/30 border-indigo-400 text-white ring-1 ring-indigo-400'
                    : 'bg-white/5 border-white/8 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                }`}
              >
                <Dock className={`h-5 w-5 mb-2 ${layoutMode === 'floating' ? 'text-indigo-300' : 'text-slate-400'}`} />
                <div>
                  <span className="text-xs font-bold block">Floating Dock</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Modern bottom pill</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* System Health & Telemetry Diagnostics Card */}
        {onOpenSystemHealth && (
          <div className="glass-panel rounded-3xl p-6 space-y-4 md:col-span-2 border border-emerald-500/20 bg-emerald-950/10" id="system-health-diagnostics-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-400" />
                  <span>System Diagnostics & Telemetry</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    v2.5 Live
                  </span>
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  Inspect backend server latency, active SSE connection streams, Firestore sync status, and real-time application logs.
                </p>
              </div>

              <button
                type="button"
                id="open-system-health-settings-btn"
                onClick={onOpenSystemHealth}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 text-xs font-bold transition-all cursor-pointer shadow-lg shadow-emerald-950/30 shrink-0"
              >
                <Server className="h-4 w-4 text-emerald-400" />
                <span>Open System Telemetry</span>
              </button>
            </div>
          </div>
        )}

        {/* Change Password Card */}
        <div className="glass-panel rounded-3xl p-6 space-y-4 md:col-span-2">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-indigo-400" />
            <span>Change Password</span>
          </h2>
          <p className="text-xs text-slate-300">
            Ensure your account is protected by updating your personal password regularly.
          </p>

          {pwdSuccess && (
            <div className="bg-emerald-500/15 border-l-4 border-emerald-500 text-emerald-300 p-3 text-xs rounded-r-md">
              {pwdSuccess}
            </div>
          )}

          {pwdError && (
            <div className="bg-red-500/15 border-l-4 border-red-500 text-red-300 p-3 text-xs rounded-r-md">
              {pwdError}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3.5 max-w-xl">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Old password..."
                className="w-full px-3.5 py-2.5 glass-input rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 4 characters)..."
                  className="w-full px-3.5 py-2.5 glass-input rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password..."
                  className="w-full px-3.5 py-2.5 glass-input rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={pwdLoading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-6 rounded-xl shadow shadow-indigo-600/20 text-sm transition-all duration-150 cursor-pointer disabled:opacity-50 border border-white/10"
            >
              {pwdLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
