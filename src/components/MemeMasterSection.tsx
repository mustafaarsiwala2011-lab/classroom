/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Image as ImageIcon, MessageSquare, Quote, Heart, Calendar, Plus, ExternalLink, ShieldCheck, Info, Upload, Camera, FileImage, X, Clipboard, Link as LinkIcon, Check } from 'lucide-react';
import { Meme, User } from '../types';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';

interface MemeMasterSectionProps {
  currentUser: User;
}

const GRADIENTS = [
  { name: 'Sunset Fusion', class: 'from-orange-500 to-rose-500 text-white' },
  { name: 'Cyberpunk Purple', class: 'from-violet-600 to-indigo-600 text-white' },
  { name: 'Emerald Wave', class: 'from-emerald-500 to-teal-600 text-white' },
  { name: 'Warm Coral', class: 'from-pink-500 to-orange-400 text-white' },
  { name: 'Deep Royal', class: 'from-blue-600 to-indigo-900 text-white' },
  { name: 'Mystic Nebula', class: 'from-purple-900 via-violet-800 to-pink-700 text-white' },
];

const FUN_IMAGE_TEMPLATES = [
  { name: 'Exam Panic', url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=600&auto=format&fit=crop' },
  { name: 'Crying of Laughter', url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=600&auto=format&fit=crop' },
  { name: 'Late Night Coding', url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=600&auto=format&fit=crop' },
  { name: 'Focus Cat', url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=600&auto=format&fit=crop' },
];

export default function MemeMasterSection({ currentUser }: MemeMasterSectionProps) {
  const [memes, setMemes] = useState<Meme[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const isMemeMaster = currentUser.isMemeMaster || 
    currentUser.username.toLowerCase() === 'admin' || 
    currentUser.username.toLowerCase() === 'meme master';
  
  // Form State for Meme Master Composer
  const [showComposer, setShowComposer] = useState(false);
  const [memeType, setMemeType] = useState<'quote' | 'image'>('image');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(''); // Quote text or Image URL/Base64
  const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0].class);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Image Upload States
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Compress image file to lightweight Base64 canvas data URL
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPEG, PNG, WEBP, GIF)');
      return;
    }

    setIsProcessingImage(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1200; // max dimension 1200px

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setContent(compressedDataUrl);
        } else {
          setContent(event.target?.result as string);
        }
        setIsProcessingImage(false);
      };

      img.onerror = () => {
        setError('Failed to load image file');
        setIsProcessingImage(false);
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      setError('Failed to read image file');
      setIsProcessingImage(false);
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    } else {
      const items = e.dataTransfer.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) processImageFile(file);
          break;
        }
      }
    }
  };

  // Clipboard Paste handler
  const handlePasteImageFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          const imageType = item.types.find(t => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const file = new File([blob], 'clipboard-image.png', { type: imageType });
            processImageFile(file);
            return;
          }
        }
        setError('No image found in your clipboard. Try copying an image from WhatsApp/Photos/Insta first!');
      } else {
        setError('Clipboard read not supported in this browser tab. Use Ctrl+V or upload directly!');
      }
    } catch (e) {
      console.error('Clipboard paste error:', e);
      setError('Please paste directly using Ctrl+V or Cmd+V!');
    }
  };

  // Global window paste listener when composer is active
  useEffect(() => {
    if (!showComposer || memeType !== 'image') return;

    const handleWindowPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            processImageFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [showComposer, memeType]);

  // Likes Local State for fun interactions (purely client-side fun!)
  const [likedMemes, setLikedMemes] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('classroom_liked_memes');
    return saved ? JSON.parse(saved) : {};
  });

  const fetchMemes = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/memes');
      if (response.ok) {
        const data = await response.json();
        setMemes(data.memes);
      }
    } catch (err) {
      console.error('Error fetching memes:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMemes();
  }, []);

  // Real-time Meme updates via SSE
  useRealtimeEvents({
    meme_created: (payload: any) => {
      const meme = payload?.meme || payload;
      if (meme && meme.id) {
        setMemes(prev => [meme, ...prev.filter(m => m && m.id !== meme.id)]);
      }
    },
    meme_deleted: (payload: any) => {
      const id = payload?.id || payload?.memeId;
      if (id) {
        setMemes(prev => prev.filter(m => m && m.id !== id));
      }
    }
  }, currentUser?.id, currentUser?.username);

  const handleLike = (id: string) => {
    const nextState = { ...likedMemes, [id]: !likedMemes[id] };
    setLikedMemes(nextState);
    localStorage.setItem('classroom_liked_memes', JSON.stringify(nextState));
  };

  const handlePublishMeme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Content is required!');
      return;
    }

    if (memeType === 'image' && !content.trim()) {
      setError('Please upload or select an image for your meme!');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/memes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorId: currentUser.id,
          authorName: currentUser.name || currentUser.username,
          type: memeType,
          content: content.trim(),
          title: title.trim(),
          bgGradient: memeType === 'quote' ? selectedGradient : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to post meme');
      }

      // Prepend newly created meme to local list immediately without requiring page refresh
      const createdMeme = data.meme || data;
      if (createdMeme && createdMeme.id) {
        setMemes((prev) => [createdMeme, ...prev.filter(m => m && m.id !== createdMeme.id)]);
      }
      
      // Reset Composer Form
      setTitle('');
      setContent('');
      setShowComposer(false);
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectImageTemplate = (url: string) => {
    setContent(url);
  };

  // Format date
  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4 sm:space-y-5">
      {/* Banner / Intro (Compact & Clutterless) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 glass-panel rounded-2xl p-4 sm:p-5">
        <div className="space-y-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[11px] font-semibold border border-amber-500/20">
            <ShieldCheck className="h-3 w-3" />
            <span>Meme Portal</span>
          </div>
          <h1 className="text-[clamp(1.15rem,2.2vw,1.5rem)] font-bold font-sans tracking-tight text-white leading-snug">
            Meme Master HQ
          </h1>
          <p className="text-xs text-slate-300 max-w-xl">
            Reserved for Meme Masters to share jokes, quotes, and photos to brighten up the classroom's day.
          </p>
        </div>

        {/* Action Button for Meme Masters */}
        {isMemeMaster ? (
          <button
            onClick={() => {
              setShowComposer(!showComposer);
              setError(null);
            }}
            className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl shadow-md transition-all cursor-pointer text-xs shrink-0 border border-white/10"
            id="toggle-composer-btn"
          >
            <Plus className={`h-4 w-4 transition-transform duration-200 ${showComposer ? 'rotate-45' : ''}`} />
            <span>{showComposer ? 'Close Composer' : 'Publish Meme'}</span>
          </button>
        ) : (
          <div className="flex items-start gap-2 bg-white/5 backdrop-blur-md p-2.5 rounded-xl border border-white/10 text-xs text-slate-300 max-w-xs leading-relaxed shrink-0">
            <Info className="h-4 w-4 text-indigo-300 shrink-0 mt-0.5" />
            <span><strong>Viewer Mode</strong>: Want to post? Ask an active Meme Master to authorize you in settings!</span>
          </div>
        )}
      </div>

      {/* Meme Composer Section (Meme Masters Only) */}
      <AnimatePresence>
        {isMemeMaster && showComposer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-panel rounded-3xl p-6 space-y-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Meme Board Composer
              </h2>

              {error && (
                <div className="bg-red-500/15 border-l-4 border-red-500 text-red-300 p-3 text-sm rounded-r-lg">
                  {error}
                </div>
              )}

              <form onSubmit={handlePublishMeme} className="space-y-5">
                {/* Meme Type Toggle */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Meme Style
                  </label>
                  <div className="grid grid-cols-2 gap-3 max-w-md">
                    <button
                      type="button"
                      onClick={() => {
                        setMemeType('quote');
                        setError(null);
                      }}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-semibold text-sm transition-all duration-150 cursor-pointer ${
                        memeType === 'quote'
                          ? 'bg-white/10 border-indigo-500/80 text-white shadow-sm'
                          : 'bg-white/3 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Quote className="h-4 w-4" />
                      <span>Quote Card</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMemeType('image');
                        setError(null);
                      }}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-semibold text-sm transition-all duration-150 cursor-pointer ${
                        memeType === 'image'
                          ? 'bg-white/10 border-indigo-500/80 text-white shadow-sm'
                          : 'bg-white/3 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <ImageIcon className="h-4 w-4" />
                      <span>Photo / Link</span>
                    </button>
                  </div>
                </div>

                {/* Common Title */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Title / Caption
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., When the teacher delays the bell..."
                    className="w-full px-4 py-3 glass-input rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200 text-sm"
                  />
                </div>

                {/* Conditional Fields: Quote */}
                {memeType === 'quote' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Quote Content
                      </label>
                      <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Type some witty quotes, classroom fun facts, or warnings here..."
                        rows={3}
                        className="w-full px-4 py-3 glass-input rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-200 text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Background Gradient
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                        {GRADIENTS.map((grad) => (
                          <button
                            key={grad.name}
                            type="button"
                            onClick={() => setSelectedGradient(grad.class)}
                            className={`h-12 rounded-xl bg-gradient-to-br ${grad.class} flex items-center justify-center border-2 transition-all duration-150 cursor-pointer ${
                              selectedGradient === grad.class
                                ? 'border-white scale-105 shadow'
                                : 'border-transparent hover:scale-102'
                            }`}
                            title={grad.name}
                          >
                            <span className="text-[10px] font-bold tracking-tight px-1 py-0.5 rounded bg-slate-900/40 text-white truncate max-w-[90%]">
                              {grad.name.split(' ')[0]}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Conditional Fields: Image / Photo Upload */}
                {memeType === 'image' && (
                  <div className="space-y-4">
                    {/* Hidden Native File Input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                      id="meme-photo-upload-input"
                    />

                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Upload Photo / Image Meme
                    </label>

                    {/* Has Image Preview Card */}
                    {content ? (
                      <div className="relative rounded-2xl overflow-hidden border border-emerald-500/40 bg-slate-950/80 p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                            <Check className="h-4 w-4" />
                            <span>Photo Loaded & Compressed</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setContent('');
                              setError(null);
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-400 text-xs font-semibold transition cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Remove Photo</span>
                          </button>
                        </div>

                        <div className="max-h-64 rounded-xl overflow-hidden bg-slate-900 border border-white/8 flex items-center justify-center">
                          <img
                            src={content}
                            alt="Meme Preview"
                            className="max-h-64 w-auto object-contain mx-auto"
                          />
                        </div>
                      </div>
                    ) : (
                      /* Drag & Drop Upload Dropzone */
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-3xl p-6 text-center transition-all duration-200 flex flex-col items-center justify-center space-y-3 ${
                          isDragging
                            ? 'border-indigo-400 bg-indigo-500/15 scale-[1.01]'
                            : 'border-white/15 bg-white/3 hover:bg-white/5 hover:border-white/30'
                        }`}
                      >
                        <div className="h-12 w-12 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                          {isProcessingImage ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                              <Sparkles className="h-6 w-6" />
                            </motion.div>
                          ) : (
                            <Upload className="h-6 w-6" />
                          )}
                        </div>

                        <div>
                          <p className="text-sm font-bold text-white">
                            {isProcessingImage ? 'Processing Photo...' : 'Upload Photo from Device / Gallery'}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Select from Photos, WhatsApp, Instagram, Camera, or Drag & Drop image files here
                          </p>
                        </div>

                        {/* Action Buttons Row */}
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition cursor-pointer border border-white/10"
                          >
                            <FileImage className="h-4 w-4" />
                            <span>Choose from Photos / Files</span>
                          </button>

                          <button
                            type="button"
                            onClick={handlePasteImageFromClipboard}
                            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/8 hover:bg-white/15 text-slate-200 text-xs font-semibold transition cursor-pointer border border-white/10"
                            title="Paste copied photo from WhatsApp, Insta, or Screenshot"
                          >
                            <Clipboard className="h-4 w-4 text-amber-400" />
                            <span>Paste Copied Image</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowUrlInput(!showUrlInput)}
                            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 text-xs font-semibold transition cursor-pointer"
                          >
                            <LinkIcon className="h-3.5 w-3.5" />
                            <span>{showUrlInput ? 'Hide URL Input' : 'Use Web Link'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Optional URL input fallback if explicitly toggled */}
                    {showUrlInput && !content && (
                      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
                        <input
                          type="url"
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          placeholder="Or paste an online direct image URL (https://...)..."
                          className="w-full px-4 py-2.5 glass-input rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </motion.div>
                    )}

                    {/* Quick Preset Templates */}
                    <div className="pt-2">
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Or Pick a Quick Preset Template
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                        {FUN_IMAGE_TEMPLATES.map((tpl) => (
                          <button
                            key={tpl.name}
                            type="button"
                            onClick={() => selectImageTemplate(tpl.url)}
                            className={`flex flex-col border rounded-xl overflow-hidden text-left bg-white/5 hover:border-indigo-500/80 transition-all duration-150 cursor-pointer ${
                              content === tpl.url ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-white/10'
                            }`}
                          >
                            <div className="h-14 w-full bg-slate-900 relative">
                              <img src={tpl.url} alt={tpl.name} className="h-full w-full object-cover" />
                            </div>
                            <span className="p-1.5 text-[11px] font-semibold text-slate-300 truncate">
                              {tpl.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowComposer(false)}
                    className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-300 font-semibold text-sm hover:bg-white/5 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-sm shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 border border-white/10"
                  >
                    {isSubmitting ? 'Publishing...' : 'Publish to Classroom'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Memes List Grid (4-Column Responsive, Low Vertical Scroll) */}
      {memes.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 text-center max-w-md mx-auto space-y-2.5">
          <div className="text-4xl">🎭</div>
          <h3 className="text-base font-bold text-white">No memes posted yet</h3>
          <p className="text-xs text-slate-300">
            Keep an eye out! Once the Meme Master starts publishing, hilarious quotes and cards will show up here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3.5 sm:gap-4" id="memes-container">
          {memes.map((meme, idx) => {
            const isLiked = likedMemes[meme.id] || false;
            
            return (
              <motion.div
                key={meme.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(idx * 0.04, 0.3) }}
                className="glass-panel rounded-2xl overflow-hidden flex flex-col justify-between transition-all border border-white/10 hover:border-amber-500/30 shadow-xs"
              >
                {/* Meme Header */}
                <div className="px-3.5 py-2 border-b border-white/8 flex items-center justify-between bg-white/3">
                  <div className="flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded-full bg-amber-500/20 text-white font-bold text-[9px] flex items-center justify-center uppercase border border-amber-500/30">
                      👑
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white uppercase tracking-wider block leading-tight">
                        {meme.authorName}
                      </span>
                      <span className="text-[9px] text-amber-300 block font-semibold leading-none">
                        Meme Master
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-0.5 text-[10px] text-slate-400">
                    <Calendar className="h-2.5 w-2.5" />
                    <span>{formatDate(meme.timestamp)}</span>
                  </div>
                </div>

                {/* Meme Content Area */}
                <div className="p-3 flex-1 flex flex-col justify-between space-y-2.5">
                  {meme.title && (
                    <h3 className="text-xs font-bold text-white leading-snug line-clamp-1">
                      {meme.title}
                    </h3>
                  )}

                  {meme.type === 'quote' ? (
                    /* Quote Card Graphic Style */
                    <div className={`w-full bg-gradient-to-br ${meme.bgGradient || 'from-indigo-500 to-purple-500'} rounded-xl p-4 min-h-[110px] flex items-center justify-center text-center shadow-inner relative group overflow-hidden border border-white/10`}>
                      {/* Quote symbols */}
                      <span className="absolute top-1 left-2 text-white/10 text-5xl font-serif select-none pointer-events-none">“</span>
                      <span className="absolute bottom-1 right-2 text-white/10 text-5xl font-serif select-none pointer-events-none">”</span>
                      
                      <p className="text-xs sm:text-sm font-bold text-white relative z-10 font-sans tracking-tight leading-relaxed max-w-[95%] whitespace-pre-line">
                        {meme.content}
                      </p>
                    </div>
                  ) : (
                    /* Photo Meme Style */
                    <div className="w-full rounded-xl overflow-hidden border border-white/8 bg-slate-950 relative group">
                      <img
                        src={meme.content}
                        alt={meme.title || 'Meme Image'}
                        className="w-full max-h-[200px] object-cover mx-auto"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://images.unsplash.com/photo-1594322436404-5a0526db4d13?q=80&w=600&auto=format&fit=crop';
                        }}
                      />
                    </div>
                  )}

                  {/* Meme Actions / Fun Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/8 select-none">
                    <button
                      onClick={() => handleLike(meme.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                        isLiked
                          ? 'bg-rose-500/15 text-rose-400 scale-105'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                      id={`like-meme-${meme.id}`}
                    >
                      <Heart className={`h-3.5 w-3.5 transition-transform duration-200 ${isLiked ? 'fill-rose-500 text-rose-400 scale-110' : ''}`} />
                      <span>{isLiked ? 'Laughed!' : 'React'}</span>
                    </button>

                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-[9px] font-semibold text-slate-400">
                      <span>Shared</span>
                      <ExternalLink className="h-2 w-2" />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
