/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Plus, BookOpen, Clock, Tag, User, Edit, Trash2, X, 
  FileText, CheckCircle, Info, Image as ImageIcon, Upload, Camera, 
  Clipboard, Link as LinkIcon, ZoomIn, Download, RefreshCw, FileCheck,
  Sparkles, AlertCircle
} from 'lucide-react';
import { ClassNote, User as UserType } from '../types';
import MediaZoomModal from './MediaZoomModal';
import AiStudyCopilotModal from './AiStudyCopilotModal';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';
import { apiFetch } from '../lib/api';

interface ClassNotesSectionProps {
  currentUser: UserType;
  initialSubjectFilter?: string;
}

const DEFAULT_SUBJECTS = ['Nahw', 'Fiqh', 'Adab', 'Balaghah', 'Hifz', 'General'];

export default function ClassNotesSection({ currentUser, initialSubjectFilter }: ClassNotesSectionProps) {
  const [notes, setNotes] = useState<ClassNote[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState(initialSubjectFilter || 'All');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'image' | 'text'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // High-Tech AI Study Copilot Modal State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [selectedNoteForAi, setSelectedNoteForAi] = useState<ClassNote | null>(null);

  // Zoom Modal for full-resolution note viewing
  const [zoomModalOpen, setZoomModalOpen] = useState(false);
  const [zoomMediaUrl, setZoomMediaUrl] = useState('');
  const [zoomMediaName, setZoomMediaName] = useState('');

  useEffect(() => {
    if (initialSubjectFilter) {
      setSelectedSubjectFilter(initialSubjectFilter);
    }
  }, [initialSubjectFilter]);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteSubject, setNoteSubject] = useState(DEFAULT_SUBJECTS[0]);
  const [noteTypeMode, setNoteTypeMode] = useState<'upload' | 'type' | 'both'>('upload');
  const [imageUrl, setImageUrl] = useState<string>('');
  
  // Image Upload Interaction States
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchNotes = async () => {
    setIsRefreshing(true);
    setFetchError(null);
    try {
      const response = await apiFetch('/api/notes');
      if (response.ok) {
        const data = await response.json();
        setNotes(data.notes || []);
      } else {
        setFetchError('Failed to load class notes from server.');
      }
    } catch (err: any) {
      console.error('Error fetching class notes:', err);
      setFetchError(err?.message || 'Network error: Failed to connect to class notes service.');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  // Real-time synchronization via SSE
  useRealtimeEvents({
    note_created: ({ note }) => {
      setNotes(prev => [note, ...prev.filter(n => n.id !== note.id)]);
    },
    note_updated: ({ note }) => {
      setNotes(prev => prev.map(n => n.id === note.id ? note : n));
    },
    note_deleted: ({ id }) => {
      setNotes(prev => prev.filter(n => n.id !== id));
    }
  }, currentUser?.id, currentUser?.username);

  // Process and compress image file for high-resolution yet lightweight upload
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setFormError('Please select a valid image file (JPEG, PNG, WEBP, GIF)');
      return;
    }

    setIsProcessingImage(true);
    setFormError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1600; // max dimension 1600px for sharp legible handwriting

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
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setImageUrl(compressedDataUrl);
        } else {
          setImageUrl(event.target?.result as string);
        }
        setIsProcessingImage(false);
      };

      img.onerror = () => {
        setFormError('Failed to load image file.');
        setIsProcessingImage(false);
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      setFormError('Failed to read image file.');
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
            const file = new File([blob], 'clipboard-notes.png', { type: imageType });
            processImageFile(file);
            return;
          }
        }
        setFormError('No image found in clipboard. Copy a photo or screenshot first!');
      } else {
        setFormError('Use Ctrl+V or Cmd+V to paste directly into this window!');
      }
    } catch (e) {
      console.error('Clipboard paste error:', e);
      setFormError('Please press Ctrl+V or Cmd+V to paste your image directly!');
    }
  };

  // Global window paste listener when note creator modal is active
  useEffect(() => {
    if (!showForm) return;

    const handleWindowPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            processImageFile(file);
            if (noteTypeMode === 'type') {
              setNoteTypeMode('both');
            }
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [showForm, noteTypeMode]);

  const handleOpenCreateForm = () => {
    setEditingNoteId(null);
    setNoteTitle('');
    setNoteContent('');
    setImageUrl('');
    setNoteSubject(DEFAULT_SUBJECTS[0]);
    setNoteTypeMode('upload');
    setShowUrlInput(false);
    setFormError(null);
    setShowForm(true);
  };

  const handleOpenEditForm = (note: ClassNote) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title);
    setNoteContent(note.content || '');
    setImageUrl(note.imageUrl || '');
    setNoteSubject(note.subject);
    setNoteTypeMode(note.imageUrl && note.content ? 'both' : note.imageUrl ? 'upload' : 'type');
    setShowUrlInput(false);
    setFormError(null);
    setShowForm(true);
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) {
      setFormError('Please provide a note title.');
      return;
    }

    if (!imageUrl && !noteContent.trim()) {
      setFormError('Please either upload a photo/scan of notes or write details into the text box.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const isEditing = editingNoteId !== null;
    const url = isEditing ? `/api/notes/${editingNoteId}` : '/api/notes';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: noteTitle.trim(),
          content: noteContent.trim(),
          imageUrl: imageUrl || undefined,
          noteType: imageUrl && noteContent.trim() ? 'both' : imageUrl ? 'image' : 'text',
          subject: noteSubject,
          authorId: currentUser.id,
          authorName: currentUser.username,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save note');
      }

      const savedNote = data.note || data;
      if (isEditing) {
        setNotes((prev) => prev.map((n) => (n.id === editingNoteId ? savedNote : n)));
      } else if (savedNote && savedNote.id) {
        setNotes((prev) => [savedNote, ...prev.filter((n) => n && n.id !== savedNote.id)]);
      }

      setShowForm(false);
    } catch (err: any) {
      setFormError(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm('Are you sure you want to delete this class note?')) return;

    try {
      const response = await apiFetch(`/api/notes/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
      } else {
        console.error('Failed to delete note');
      }
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  // Open Fullscreen Zoom Modal for images
  const handleOpenZoom = (url: string, title: string) => {
    setZoomMediaUrl(url);
    setZoomMediaName(title);
    setZoomModalOpen(true);
  };

  // Search and Filter Logic
  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (note.content && note.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
      note.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.authorName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSubject = selectedSubjectFilter === 'All' || note.subject === selectedSubjectFilter;

    let matchesType = true;
    if (selectedTypeFilter === 'image') {
      matchesType = !!note.imageUrl;
    } else if (selectedTypeFilter === 'text') {
      matchesType = !note.imageUrl && !!note.content;
    }

    return matchesSearch && matchesSubject && matchesType;
  });

  // Format date
  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4 sm:space-y-5">
      {/* Upper Banner (Compact & Clutterless) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 glass-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden">
        <div className="space-y-1 relative z-10 min-w-0">
          <h1 className="text-[clamp(1.15rem,2.2vw,1.5rem)] font-bold font-sans tracking-tight text-white flex items-center gap-2 leading-snug">
            <BookOpen className="h-5 w-5 text-indigo-400 shrink-0" />
            <span>Class Notes & Scans Repository</span>
          </h1>
          <p className="text-xs text-slate-300">
            Handwritten lecture notes, whiteboard snapshots, study guides, and summaries.
          </p>
        </div>
        
        <div className="flex items-center gap-2 relative z-10 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => {
              setSelectedNoteForAi(notes[0] || null);
              setAiModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
            title="Launch Gemini AI Study Co-pilot for summaries, flashcards, & practice quiz"
            id="open-ai-study-copilot-btn"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-400 animate-pulse" />
            <span>AI Study Co-pilot</span>
          </button>

          <button
            onClick={fetchNotes}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
            title="Refresh Notes"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreateForm}
            className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold px-3.5 py-1.5 rounded-xl shadow-md transition-all cursor-pointer text-xs border border-white/10"
            id="add-note-btn"
          >
            <Plus className="h-4 w-4" />
            <span>Upload or Write Note</span>
          </button>
        </div>

        {/* Ambient aura */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-[80px] rounded-full pointer-events-none" />
      </div>

      {/* Search and Filters Hub (Compact & Crisp) */}
      <div className="flex flex-col gap-2.5 glass-panel rounded-2xl p-3 sm:p-3.5">
        {/* Search input */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes by keyword, topic, subject, or student name..."
            className="w-full pl-9 pr-14 py-2 glass-input rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all text-xs"
            id="notes-search-field"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-white text-[11px] font-semibold"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-white/5">
          {/* Subject Pills */}
          <div className="flex flex-wrap items-center gap-1 select-none">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Subject:
            </span>
            <button
              onClick={() => setSelectedSubjectFilter('All')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                selectedSubjectFilter === 'All'
                  ? 'bg-indigo-600 text-white shadow shadow-indigo-600/20 border border-white/10'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5'
              }`}
            >
              All Subjects
            </button>
            {DEFAULT_SUBJECTS.map((subject) => (
              <button
                key={subject}
                onClick={() => setSelectedSubjectFilter(subject)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  selectedSubjectFilter === subject
                    ? 'bg-indigo-600 text-white shadow shadow-indigo-600/20 border border-white/10'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5'
                }`}
              >
                {subject}
              </button>
            ))}
          </div>

          {/* Type Pills (Photo vs Text) */}
          <div className="flex items-center gap-1 select-none shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Format:
            </span>
            <button
              onClick={() => setSelectedTypeFilter('all')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                selectedTypeFilter === 'all'
                  ? 'bg-white/15 text-white border border-white/20'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              All Formats
            </button>
            <button
              onClick={() => setSelectedTypeFilter('image')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                selectedTypeFilter === 'image'
                  ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/40'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              <ImageIcon className="h-3 w-3" />
              <span>Photos</span>
            </button>
            <button
              onClick={() => setSelectedTypeFilter('text')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                selectedTypeFilter === 'text'
                  ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/40'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              <FileText className="h-3 w-3" />
              <span>Typed</span>
            </button>
          </div>
        </div>
      </div>

      {/* Network Error Fallback Banner */}
      {fetchError && (
        <div className="glass-panel p-6 rounded-2xl bg-red-500/10 border border-red-500/25 text-center max-w-lg mx-auto space-y-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Connection Error</h3>
          <p className="text-xs text-red-200">{fetchError}</p>
          <button
            onClick={fetchNotes}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Retry Loading Notes</span>
          </button>
        </div>
      )}

      {/* Notes Grid Display (4-Column Layout to minimize vertical scrolling) */}
      {!fetchError && filteredNotes.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 text-center max-w-md mx-auto space-y-2.5">
          <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-white">No class notes found</h3>
          <p className="text-xs text-slate-300">
            {searchQuery || selectedSubjectFilter !== 'All' || selectedTypeFilter !== 'all'
              ? 'Try widening your search terms or choosing a different filter.'
              : 'Our class notebook is currently empty. Click "Upload or Write Note" to share the first notes!'}
          </p>
          <button
            onClick={handleOpenCreateForm}
            className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload Notes Photo</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3.5 sm:gap-4" id="notes-container">
          {filteredNotes.map((note) => {
            const isAuthor = note.authorId === currentUser.id;
            const canModify = isAuthor || currentUser.isMemeMaster || currentUser.username.toLowerCase() === 'admin';
            const hasImage = !!note.imageUrl;
            
            return (
              <motion.div
                key={note.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="glass-panel rounded-2xl transition-all flex flex-col justify-between overflow-hidden border border-white/10 hover:border-indigo-500/30 group shadow-xs"
              >
                <div>
                  {/* Subject Tag & Header */}
                  <div className="p-3 pb-2 flex items-center justify-between gap-2 border-b border-white/5">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 text-[10px] font-bold uppercase tracking-wider border border-indigo-500/20">
                        <Tag className="h-2.5 w-2.5" />
                        <span>{note.subject}</span>
                      </span>

                      {hasImage ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[9px] font-bold border border-emerald-500/20">
                          <ImageIcon className="h-2.5 w-2.5" />
                          <span>Photo</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/5 text-slate-300 text-[9px] font-medium">
                          <FileText className="h-2.5 w-2.5" />
                          <span>Typed</span>
                        </span>
                      )}
                    </div>
                    
                    {/* Controls */}
                    {canModify && (
                      <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-md opacity-70 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenEditForm(note)}
                          className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-indigo-400 transition-colors"
                          title="Edit Note"
                          id={`edit-note-${note.id}`}
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete Note"
                          id={`delete-note-${note.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Scanned/Uploaded Image Thumbnail */}
                  {hasImage && (
                    <div 
                      className="relative bg-slate-950/60 aspect-[16/10] overflow-hidden cursor-pointer group/img border-b border-white/5"
                      onClick={() => handleOpenZoom(note.imageUrl!, note.title)}
                    >
                      <img
                        src={note.imageUrl}
                        alt={note.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover object-top group-hover/img:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-xs">
                        <span className="bg-white/20 text-white font-semibold text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 backdrop-blur-md shadow-md border border-white/20">
                          <ZoomIn className="h-3 w-3" />
                          <span>View Scan</span>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Title & Body */}
                  <div className="p-3 space-y-1">
                    <h3 className="text-sm font-bold font-sans tracking-tight text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                      {note.title}
                    </h3>
                    {note.content ? (
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-words line-clamp-3">
                        {note.content}
                      </p>
                    ) : hasImage ? (
                      <p className="text-[11px] text-slate-400 italic">
                        Click scan above to view high-resolution page.
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Card Footer Meta & Actions */}
                <div className="px-3 py-2 bg-white/3 border-t border-white/5 flex items-center justify-between gap-1.5 text-xs text-slate-400 select-none">
                  <div className="flex items-center gap-1.5 truncate">
                    <div className="h-4.5 w-4.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-bold flex items-center justify-center text-[8px] uppercase shrink-0">
                      {note.authorName.charAt(0)}
                    </div>
                    <span className="truncate text-[11px]">
                      <strong className="font-semibold text-slate-300">{note.authorName}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        setSelectedNoteForAi(note);
                        setAiModalOpen(true);
                      }}
                      className="px-1.5 py-0.5 rounded-md bg-purple-500/15 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 hover:text-purple-200 text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                      title="Generate Summary, Flashcards or Quiz with AI"
                      id={`ai-study-card-btn-${note.id}`}
                    >
                      <Sparkles className="h-2.5 w-2.5 text-purple-400" />
                      <span>AI</span>
                    </button>

                    <div className="flex items-center gap-0.5 text-[10px] text-slate-500">
                      <Clock className="h-2.5 w-2.5 text-slate-500" />
                      <span>{formatDate(note.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Note Modal Form */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-2xl rounded-3xl overflow-hidden my-8 border border-white/15 shadow-2xl"
              id="notes-form-modal"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 bg-white/3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-400" />
                  <span>{editingNoteId ? 'Edit Class Note' : 'Share Class Notes'}</span>
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {formError && (
                <div className="mx-6 mt-4 p-3 bg-red-500/15 border-l-4 border-red-500 text-red-300 text-xs rounded-r-md">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSaveNote} className="p-6 space-y-4">
                {/* Note Title */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Note Title *
                  </label>
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="e.g., Nahw Lesson 4: Bab al-I'rab summary & rules..."
                    className="w-full px-4 py-2.5 glass-input rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
                    required
                  />
                </div>

                {/* Subject Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Subject / Module
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {DEFAULT_SUBJECTS.map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setNoteSubject(sub)}
                        className={`py-2 px-2 border rounded-xl text-xs font-semibold transition-all cursor-pointer text-center truncate ${
                          noteSubject === sub
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Format Mode Toggle */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Format & Content Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setNoteTypeMode('upload')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        noteTypeMode === 'upload'
                          ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 shadow-sm'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <ImageIcon className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Photo / Scan</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNoteTypeMode('type')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        noteTypeMode === 'type'
                          ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 shadow-sm'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Typed Text</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNoteTypeMode('both')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        noteTypeMode === 'both'
                          ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300 shadow-sm'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <FileCheck className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Photo + Notes</span>
                    </button>
                  </div>
                </div>

                {/* Upload Image Section */}
                {(noteTypeMode === 'upload' || noteTypeMode === 'both') && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Upload Handwritten Page or Document
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handlePasteImageFromClipboard}
                          className="text-[11px] text-indigo-300 hover:text-indigo-200 bg-indigo-500/15 hover:bg-indigo-500/25 px-2.5 py-1 rounded-lg border border-indigo-500/20 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Clipboard className="h-3 w-3" />
                          <span>Paste from Clipboard</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowUrlInput(!showUrlInput)}
                          className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                        >
                          <LinkIcon className="h-3 w-3" />
                          <span>{showUrlInput ? 'Hide URL' : 'Image URL'}</span>
                        </button>
                      </div>
                    </div>

                    {showUrlInput && (
                      <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://example.com/handwritten-note.jpg"
                        className="w-full px-4 py-2 glass-input rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-xs"
                      />
                    )}

                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {/* Drag and drop box or Preview */}
                    {imageUrl ? (
                      <div className="relative rounded-2xl overflow-hidden border border-white/15 bg-slate-950/60 group/preview">
                        <img
                          src={imageUrl}
                          alt="Note Preview"
                          referrerPolicy="no-referrer"
                          className="w-full max-h-64 object-contain rounded-2xl bg-black/40"
                        />
                        <div className="absolute top-2 right-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-lg text-xs backdrop-blur-sm border border-white/20 cursor-pointer flex items-center gap-1"
                          >
                            <Camera className="h-3.5 w-3.5" />
                            <span>Change</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setImageUrl('')}
                            className="p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-xs backdrop-blur-sm border border-white/20 cursor-pointer"
                            title="Remove Photo"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="absolute bottom-2 left-2 bg-slate-900/80 text-emerald-400 text-[11px] font-semibold px-2.5 py-1 rounded-lg backdrop-blur-sm border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          <span>Photo staged for upload</span>
                        </div>
                      </div>
                    ) : (
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
                          isDragging
                            ? 'border-indigo-400 bg-indigo-500/20'
                            : 'border-white/15 hover:border-indigo-400/50 bg-white/2 hover:bg-white/4'
                        }`}
                      >
                        <div className="h-12 w-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
                          {isProcessingImage ? (
                            <RefreshCw className="h-6 w-6 animate-spin" />
                          ) : (
                            <Upload className="h-6 w-6" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {isProcessingImage ? 'Optimizing photo...' : 'Click to upload notebook photo or drag & drop'}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Supports camera photos, screenshots, and PNG/JPEG/WEBP (or press Ctrl+V to paste)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Typed Content textarea */}
                {(noteTypeMode === 'type' || noteTypeMode === 'both') && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      {noteTypeMode === 'both' ? 'Summary / Explanations / Key Takeaways' : 'Note Details & Content *'}
                    </label>
                    <textarea
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder={
                        noteTypeMode === 'both'
                          ? "Add a short summary or key points describing this scanned note page..."
                          : "Type or paste definitions, rules, formulas, page numbers, or explanations here..."
                      }
                      rows={noteTypeMode === 'both' ? 4 : 7}
                      className="w-full px-4 py-3 glass-input rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-sans resize-y"
                      required={noteTypeMode === 'type'}
                    />
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="flex justify-end gap-3 pt-3 border-t border-white/8">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 rounded-xl border border-white/10 text-slate-300 text-sm font-semibold hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || isProcessingImage}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-sm font-semibold flex items-center gap-1.5 shadow shadow-indigo-600/20 transition-all border border-white/10 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    <span>{isSubmitting ? 'Uploading...' : 'Publish Note'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Media Zoom Modal for high-res viewing */}
      <MediaZoomModal
        isOpen={zoomModalOpen}
        onClose={() => setZoomModalOpen(false)}
        mediaUrl={zoomMediaUrl}
        mediaType="image"
        mediaName={zoomMediaName}
      />

      {/* AI Study Co-pilot Modal */}
      <AiStudyCopilotModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        note={selectedNoteForAi}
      />
    </div>
  );
}
