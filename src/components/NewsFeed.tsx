import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  Trash2,
  Send,
  Clock,
  ChevronDown,
  Check,
  X,
  AlertTriangle,
  Sparkles,
  Flame,
  Zap,
  History,
  Image as ImageIcon,
  Video as VideoIcon,
  Play,
  HardDrive,
  Film,
  Loader2,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { store } from '../lib/db';
import {
  CommunityPost,
  SocialReactionType,
  ReactionRecord,
} from '../types';
import { uploadPhotoToSharedDrive, uploadVideoToSharedDrive } from '../lib/driveMedia';
import { ModalPortal } from './ModalPortal';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { FeedPostCard, computePostViews, REACTIONS } from './FeedPostCard';

export type FeedSortMode = 'newest' | 'most_viewed' | 'old' | 'algorithm';

const PAGE_SIZE = 5;

interface CachedFeedState {
  sortMode: FeedSortMode;
  postIds: string[];
  cursor: string | null;
  hasMore: boolean;
  topRandomPostId: string | null;
  timestamp: number;
}

// In-memory client-side cache singleton for feed state retention across tab navigations
const MEMORY_CACHE = new Map<string, CachedFeedState>();

export const NewsFeed: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const cacheKey = `bcc_feed_${currentUser?.id || 'guest'}`;

  // Initial sort preference: if user logged in and multiple posts, default to 'algorithm'
  const [sortMode, setSortMode] = useState<FeedSortMode>(() => {
    try {
      const saved = sessionStorage.getItem('bcc_feed_sort_mode');
      if (saved && ['newest', 'most_viewed', 'old', 'algorithm'].includes(saved)) {
        return saved as FeedSortMode;
      }
    } catch {
      // ignore
    }
    return 'algorithm';
  });

  // Custom sort dropdown visibility
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement | null>(null);

  // Raw posts from DB
  const [posts, setPosts] = useState<CommunityPost[]>(() => store.getPosts());

  // Algorithmic random post ID for current session
  const [topRandomPostId, setTopRandomPostId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('bcc_feed_random_post_id');
    } catch {
      return null;
    }
  });

  // Infinite Scroll & Cursor-based Pagination State
  const [displayedPosts, setDisplayedPosts] = useState<CommunityPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Composer State
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Photos & Video Media Composer State
  const [stagedPhotos, setStagedPhotos] = useState<
    Array<{ id: string; file?: File; previewUrl: string; name: string }>
  >([]);
  const [stagedVideo, setStagedVideo] = useState<{
    id: string;
    file?: File;
    previewUrl: string;
    name: string;
    title: string;
  } | null>(null);
  const [mediaUploadProgress, setMediaUploadProgress] = useState<string | null>(null);
  const [mediaUploadError, setMediaUploadError] = useState<string | null>(null);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // Universal Reactions Breakdown Modal State
  interface ReactionsModalData {
    title: string;
    reactions?: CommunityPost['reactions'];
    reactionsDetails?: ReactionRecord[];
  }
  const [reactionsModalData, setReactionsModalData] = useState<ReactionsModalData | null>(null);
  const [reactionsModalTab, setReactionsModalTab] = useState<SocialReactionType | 'all'>('all');

  // Delete Post Modal State
  const [postToDelete, setPostToDelete] = useState<CommunityPost | null>(null);

  useModalDismiss(Boolean(reactionsModalData), () => setReactionsModalData(null));
  useModalDismiss(Boolean(postToDelete), () => setPostToDelete(null));

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setIsSortDropdownOpen(false);
      }
    };
    if (isSortDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSortDropdownOpen]);

  // Sync with store updates and initial server sync
  useEffect(() => {
    const handlePostsUpdated = (e: Event) => {
      const updated = ((e as CustomEvent).detail || store.getPosts()) as CommunityPost[];
      if (Array.isArray(updated)) {
        setPosts([...updated]);
      }
    };
    window.addEventListener('bcc_posts_updated', handlePostsUpdated);

    const handleOpenNewsFeed = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.postId) {
        setTimeout(() => {
          const el = document.getElementById(`post-card-${detail.postId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-[#2d6a4f]', 'ring-offset-2');
            setTimeout(() => {
              el.classList.remove('ring-2', 'ring-[#2d6a4f]', 'ring-offset-2');
            }, 3000);
          }
        }, 300);
      }
    };
    window.addEventListener('bcc_open_newsfeed', handleOpenNewsFeed);

    store.refreshPostsFromServer().then((fresh) => {
      if (Array.isArray(fresh) && fresh.length > 0) {
        setPosts([...fresh]);
      }
    });

    return () => {
      window.removeEventListener('bcc_posts_updated', handlePostsUpdated);
      window.removeEventListener('bcc_open_newsfeed', handleOpenNewsFeed);
    };
  }, []);

  // Compute Full Sorted Posts List based on Sort Mode & Algorithm
  const fullSortedPosts = useMemo(() => {
    if (posts.length === 0) return [];
    const list = [...posts];

    if (sortMode === 'newest') {
      return list.sort((a, b) => {
        const tA = new Date(a.createdAt).getTime() || 0;
        const tB = new Date(b.createdAt).getTime() || 0;
        return tB - tA;
      });
    }

    if (sortMode === 'most_viewed') {
      return list.sort((a, b) => {
        const vA = computePostViews(a);
        const vB = computePostViews(b);
        return vB - vA;
      });
    }

    if (sortMode === 'old') {
      return list.sort((a, b) => {
        const tA = new Date(a.createdAt).getTime() || 0;
        const tB = new Date(b.createdAt).getTime() || 0;
        return tA - tB;
      });
    }

    // sortMode === 'algorithm'
    // Ensure we have a persistent random post selected for this session
    if (list.length <= 1) return list;

    let targetRandomId = topRandomPostId;
    const exists = list.some((p) => p.id === targetRandomId);
    if (!targetRandomId || !exists) {
      const randomIndex = Math.floor(Math.random() * list.length);
      targetRandomId = list[randomIndex].id;
      setTopRandomPostId(targetRandomId);
      try {
        sessionStorage.setItem('bcc_feed_random_post_id', targetRandomId);
      } catch {
        // ignore
      }
    }

    const topPost = list.find((p) => p.id === targetRandomId);
    const otherPosts = list.filter((p) => p.id !== targetRandomId);

    // Algorithmic interleave: Sort others with engagement-weighted distribution
    otherPosts.sort((a, b) => {
      const scoreA = computePostViews(a) * 0.4 + (new Date(a.createdAt).getTime() / 10000000) * 0.6;
      const scoreB = computePostViews(b) * 0.4 + (new Date(b.createdAt).getTime() / 10000000) * 0.6;
      return scoreB - scoreA;
    });

    return topPost ? [topPost, ...otherPosts] : otherPosts;
  }, [posts, sortMode, topRandomPostId]);

  // Client-side Caching & Pagination initialization
  useEffect(() => {
    if (fullSortedPosts.length === 0) {
      setDisplayedPosts([]);
      setCursor(null);
      setHasMore(false);
      return;
    }

    // Check memory or session cache first
    const cached = MEMORY_CACHE.get(cacheKey);
    const now = Date.now();
    const isCacheValid = cached && cached.sortMode === sortMode && now - cached.timestamp < 15 * 60 * 1000;

    if (isCacheValid && cached.postIds.length > 0) {
      const restored = cached.postIds
        .map((id) => fullSortedPosts.find((p) => p.id === id))
        .filter(Boolean) as CommunityPost[];

      if (restored.length > 0) {
        setDisplayedPosts(restored);
        setCursor(cached.cursor);
        setHasMore(cached.hasMore);
        return;
      }
    }

    // Default: initialize first page
    const initialSlice = fullSortedPosts.slice(0, PAGE_SIZE);
    setDisplayedPosts(initialSlice);
    const newCursor = initialSlice[initialSlice.length - 1]?.id || null;
    setCursor(newCursor);
    const more = initialSlice.length < fullSortedPosts.length;
    setHasMore(more);

    // Write to memory cache
    MEMORY_CACHE.set(cacheKey, {
      sortMode,
      postIds: initialSlice.map((p) => p.id),
      cursor: newCursor,
      hasMore: more,
      topRandomPostId,
      timestamp: Date.now(),
    });
  }, [fullSortedPosts, sortMode, cacheKey]);

  // Load Next Page (Cursor-based Pagination + Lazy Loading)
  const loadNextPage = useCallback(() => {
    if (isLoadingMore || !hasMore || fullSortedPosts.length === 0) return;
    setIsLoadingMore(true);

    // Simulate async smooth cursor slice fetch
    setTimeout(() => {
      setDisplayedPosts((prev) => {
        const lastId = prev[prev.length - 1]?.id;
        const currentIdx = lastId ? fullSortedPosts.findIndex((p) => p.id === lastId) : -1;
        const start = currentIdx >= 0 ? currentIdx + 1 : prev.length;
        const nextBatch = fullSortedPosts.slice(start, start + PAGE_SIZE);

        if (nextBatch.length === 0) {
          setHasMore(false);
          setIsLoadingMore(false);
          return prev;
        }

        const combined = [...prev, ...nextBatch];
        const nextCursorId = nextBatch[nextBatch.length - 1].id;
        setCursor(nextCursorId);
        const stillHasMore = combined.length < fullSortedPosts.length;
        setHasMore(stillHasMore);

        // Update cache
        MEMORY_CACHE.set(cacheKey, {
          sortMode,
          postIds: combined.map((p) => p.id),
          cursor: nextCursorId,
          hasMore: stillHasMore,
          topRandomPostId,
          timestamp: Date.now(),
        });

        setIsLoadingMore(false);
        return combined;
      });
    }, 200);
  }, [isLoadingMore, hasMore, fullSortedPosts, sortMode, cacheKey, topRandomPostId]);

  // Infinite Scroll IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadNextPage();
        }
      },
      {
        root: null,
        rootMargin: '350px',
        threshold: 0,
      }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadNextPage]);

  // Change Sort Mode
  const handleSelectSort = (mode: FeedSortMode) => {
    setSortMode(mode);
    setIsSortDropdownOpen(false);
    try {
      sessionStorage.setItem('bcc_feed_sort_mode', mode);
    } catch {
      // ignore
    }
  };

  // Media file handlers
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setMediaUploadError(null);

    const newPhotos: Array<{ id: string; file: File; previewUrl: string; name: string }> = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      const previewUrl = URL.createObjectURL(file);
      newPhotos.push({
        id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl,
        name: file.name,
      });
    }

    setStagedPhotos((prev) => [...prev, ...newPhotos]);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleRemovePhoto = (id: string) => {
    setStagedPhotos((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item && item.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setMediaUploadError(null);

    const file = files[0];
    if (!file.type.startsWith('video/')) {
      setMediaUploadError('Selected file is not a valid video format.');
      return;
    }

    if (file.size > 200 * 1024 * 1024) {
      setMediaUploadError('Video exceeds 200MB limit. Please compress or choose a shorter clip.');
      return;
    }

    if (stagedVideo && stagedVideo.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(stagedVideo.previewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    setStagedVideo({
      id: `vid_${Date.now()}`,
      file,
      previewUrl,
      name: file.name,
      title: file.name.replace(/\.[^/.]+$/, ''),
    });

    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleRemoveVideo = () => {
    if (stagedVideo && stagedVideo.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(stagedVideo.previewUrl);
    }
    setStagedVideo(null);
  };

  // Submit Post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!postContent.trim() && stagedPhotos.length === 0 && !stagedVideo) return;

    setIsSubmitting(true);
    setMediaUploadError(null);

    try {
      const uploadedPhotosUrls: string[] = [];
      if (stagedPhotos.length > 0) {
        setMediaUploadProgress(`Uploading ${stagedPhotos.length} photo(s)...`);
        for (let i = 0; i < stagedPhotos.length; i++) {
          const p = stagedPhotos[i];
          if (p.file) {
            setMediaUploadProgress(`Uploading photo ${i + 1} of ${stagedPhotos.length}...`);
            const driveRes = await uploadPhotoToSharedDrive(
              p.file,
              currentUser.name || currentUser.username || 'Member'
            );
            uploadedPhotosUrls.push(driveRes.url);
          } else {
            uploadedPhotosUrls.push(p.previewUrl);
          }
        }
      }

      let uploadedVideoUrl: string | undefined = undefined;
      if (stagedVideo && stagedVideo.file) {
        setMediaUploadProgress('Uploading video to cloud storage...');
        const vidRes = await uploadVideoToSharedDrive(
          stagedVideo.file,
          currentUser.name || currentUser.username || 'Member'
        );
        uploadedVideoUrl = vidRes.url;
      }

      const newPost = store.createPost({
        authorId: currentUser.id,
        authorName: currentUser.name || currentUser.username || 'Member',
        authorAvatar: currentUser.avatar || '',
        authorRole: currentUser.role || 'Member',
        title: postTitle.trim(),
        content: postContent.trim(),
        category: 'General Talk',
        photos: uploadedPhotosUrls,
        videoUrl: uploadedVideoUrl,
        likesCount: 0,
        likedBy: [],
        reactions: { like: [], heart: [], care: [], blessed: [] },
        reactionsDetails: [],
        comments: [],
        commentsCount: 0,
        viewsCount: 1,
      });

      // Reset form
      setPostTitle('');
      setPostContent('');
      setStagedPhotos([]);
      setStagedVideo(null);
      setIsComposerExpanded(false);
      setMediaUploadProgress(null);

      // Prepend to feed and update cache immediately
      setPosts((prev) => [newPost, ...prev]);
      setDisplayedPosts((prev) => [newPost, ...prev]);
    } catch (err: any) {
      console.error('Failed to publish post:', err);
      setMediaUploadError(err?.message || 'Failed to publish post. Please check connection and retry.');
    } finally {
      setIsSubmitting(false);
      setMediaUploadProgress(null);
    }
  };

  // Confirm Delete Post
  const handleConfirmDelete = () => {
    if (!postToDelete) return;
    store.deletePost(postToDelete.id);
    setPosts((prev) => prev.filter((p) => p.id !== postToDelete.id));
    setDisplayedPosts((prev) => prev.filter((p) => p.id !== postToDelete.id));
    setPostToDelete(null);
  };

  // Compute Active Reaction Details for Modal
  const modalReactionDetails = useMemo(() => {
    if (!reactionsModalData || !reactionsModalData.reactionsDetails) return [];
    if (reactionsModalTab === 'all') {
      return reactionsModalData.reactionsDetails;
    }
    return reactionsModalData.reactionsDetails.filter((r) => r.type === reactionsModalTab);
  }, [reactionsModalData, reactionsModalTab]);

  const sortOptions = [
    {
      id: 'newest' as FeedSortMode,
      label: 'Newest',
      sublabel: 'Latest posts first',
      icon: Clock,
    },
    {
      id: 'most_viewed' as FeedSortMode,
      label: 'Most Viewed',
      sublabel: 'Highest engagement & views',
      icon: Flame,
    },
    {
      id: 'old' as FeedSortMode,
      label: 'Old post',
      sublabel: 'Earliest posts first',
      icon: History,
    },
    {
      id: 'algorithm' as FeedSortMode,
      label: 'Algorithm (For You)',
      sublabel: 'Smart randomized discovery',
      icon: Zap,
    },
  ];

  const currentSortOption = sortOptions.find((s) => s.id === sortMode) || sortOptions[0];
  const CurrentSortIcon = currentSortOption.icon;

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* SOCIAL MEDIA COMPOSER CARD */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-[#e2ece2] shadow-xs">
        <div className="flex items-start gap-2.5 sm:gap-3">
          {/* Current User Avatar */}
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full ${
              currentUser?.avatar?.includes('bcc-logo.png') ? 'bg-white' : 'bg-[#d8f3dc]'
            } border border-[#b7e4c7] flex items-center justify-center font-heading font-black text-[#1b4332] text-xs shrink-0 shadow-xs overflow-hidden`}
          >
            {currentUser?.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                className={`w-full h-full ${
                  currentUser.avatar.includes('bcc-logo.png')
                    ? 'object-contain p-0.5 bg-white'
                    : 'object-cover'
                }`}
              />
            ) : (
              (currentUser?.name || currentUser?.username || 'U').charAt(0).toUpperCase()
            )}
          </div>

          {/* Trigger Box or Form */}
          <div className="flex-1 min-w-0">
            {!isComposerExpanded ? (
              <button
                type="button"
                id="composer-trigger-btn"
                onClick={() => setIsComposerExpanded(true)}
                className="w-full text-left px-3 py-2 bg-[#f7f9f7] hover:bg-[#eef5ef] rounded-xl border border-[#e2ece2] text-xs text-[#52605d] transition-all cursor-pointer flex items-center justify-between"
              >
                <span className="truncate">
                  What&apos;s on your mind,{' '}
                  {currentUser?.firstName || currentUser?.name?.split(' ')[0] || 'Rider'}?
                </span>
                <span className="text-[10px] text-[#2d6a4f] font-bold shrink-0 ml-2">Share</span>
              </button>
            ) : (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                onSubmit={handleCreatePost}
                className="space-y-3"
              >
                <div className="flex items-center justify-between border-b border-[#e2ece2] pb-2">
                  <span className="text-xs font-bold text-[#1b4332]">Create Post</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsComposerExpanded(false);
                      setStagedPhotos([]);
                      setStagedVideo(null);
                      setMediaUploadError(null);
                    }}
                    className="text-[#52605d] hover:text-[#1b4332] p-1 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Subject or Title (optional)"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs text-[#1b4332] placeholder:text-xs placeholder:text-[#52605d]/70 focus:outline-none focus:border-[#2d6a4f]"
                />

                <textarea
                  placeholder={`What's happening on the road, ${
                    currentUser?.name?.split(' ')[0] || 'rider'
                  }?`}
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  rows={3}
                  className="w-full p-3 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs text-[#1b4332] placeholder:text-xs placeholder:text-[#52605d]/70 focus:outline-none focus:border-[#2d6a4f] resize-none"
                />

                {/* Staged Photos Preview */}
                {stagedPhotos.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-[#52605d]">
                      <span>Selected Photos ({stagedPhotos.length})</span>
                      <button
                        type="button"
                        onClick={() => setStagedPhotos([])}
                        className="text-rose-600 hover:underline"
                      >
                        Remove all
                      </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {stagedPhotos.map((p) => (
                        <div
                          key={p.id}
                          className="relative aspect-square rounded-xl overflow-hidden border border-[#e2ece2] bg-[#f0f4f0] group"
                        >
                          <img
                            src={p.previewUrl}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(p.id)}
                            className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Staged Video Preview */}
                {stagedVideo && (
                  <div className="p-3 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#d8f3dc] text-[#1b4332] flex items-center justify-center shrink-0">
                        <Play className="w-4 h-4 fill-current" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#1b4332] truncate">
                          {stagedVideo.title || stagedVideo.name}
                        </p>
                        <span className="text-[10px] text-[#2d6a4f] font-semibold flex items-center gap-1">
                          <Film className="w-3 h-3" /> Video ready to upload
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveVideo}
                      className="p-1 text-[#52605d] hover:text-rose-600 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Media Upload Error */}
                {mediaUploadError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{mediaUploadError}</span>
                  </div>
                )}

                {/* Media Upload Progress */}
                {mediaUploadProgress && (
                  <div className="p-2.5 rounded-xl bg-[#e8f5e9] border border-[#b7e4c7] text-[#1b4332] text-xs flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#2d6a4f]" />
                    <span className="font-semibold">{mediaUploadProgress}</span>
                  </div>
                )}

                {/* Composer Footer Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-[#f0f4f0]">
                  <div className="flex items-center gap-1.5">
                    {/* Photo upload */}
                    <input
                      type="file"
                      ref={photoInputRef}
                      onChange={handlePhotoSelect}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-lg hover:bg-[#f7f9f7] text-[#52605d] hover:text-[#1b4332] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer border border-transparent hover:border-[#e2ece2]"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Photo</span>
                    </button>

                    {/* Video upload */}
                    <input
                      type="file"
                      ref={videoInputRef}
                      onChange={handleVideoSelect}
                      accept="video/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-lg hover:bg-[#f7f9f7] text-[#52605d] hover:text-[#1b4332] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer border border-transparent hover:border-[#e2ece2]"
                    >
                      <VideoIcon className="w-3.5 h-3.5 text-blue-600" />
                      <span>Video</span>
                    </button>
                  </div>

                  <button
                    type="submit"
                    id="submit-post-btn"
                    disabled={isSubmitting || (!postContent.trim() && stagedPhotos.length === 0 && !stagedVideo)}
                    className="px-4 py-1.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] disabled:opacity-40 text-white text-xs font-heading font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Posting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3 h-3 text-[#74c69d]" />
                        <span>Post</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}
          </div>
        </div>
      </div>

      {/* FEED HEADER WITH CUSTOM SORTING BUTTON & DROPDOWN */}
      {/* (Search input bar and subtabs removed per user requirement) */}
      <div className="flex items-center justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-[#e2ece2] shadow-xs">
        {/* Left Side: Feed Identity & Posts Count */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#d8f3dc] text-[#1b4332] flex items-center justify-center font-bold text-xs">
            <Layers className="w-3.5 h-3.5 text-[#2d6a4f]" />
          </div>
          <div>
            <span className="font-heading font-black text-xs sm:text-sm text-[#1b4332]">
              BCC News Feed
            </span>
            <span className="text-[10px] text-[#52605d] ml-1.5 hidden sm:inline">
              ({fullSortedPosts.length} posts)
            </span>
          </div>
        </div>

        {/* Right Side: Custom Sorting Dropdown */}
        <div className="relative" ref={sortDropdownRef}>
          <button
            type="button"
            id="feed-sort-dropdown-btn"
            onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f7f9f7] hover:bg-[#eef5ef] text-[#1b4332] border border-[#e2ece2] hover:border-[#b7e4c7] text-xs font-bold transition-all cursor-pointer shadow-2xs"
            aria-expanded={isSortDropdownOpen}
            aria-haspopup="true"
          >
            <CurrentSortIcon className="w-3.5 h-3.5 text-[#2d6a4f]" />
            <span>Sort: {currentSortOption.label}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#52605d] transition-transform duration-200 ${
                isSortDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Custom Dropdown Menu */}
          <AnimatePresence>
            {isSortDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-1.5 z-50 w-56 bg-white rounded-2xl border border-[#e2ece2] shadow-xl p-1.5 space-y-1 overflow-hidden"
              >
                <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#52605d]">
                  Sort Feed By
                </div>

                {sortOptions.map((opt) => {
                  const IconComp = opt.icon;
                  const isSelected = opt.id === sortMode;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      id={`sort-option-${opt.id}`}
                      onClick={() => handleSelectSort(opt.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-xs text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#e8f5e9] text-[#1b4332] font-bold'
                          : 'text-[#2d4036] hover:bg-[#f7f9f7]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-[#1b4332] text-white'
                              : 'bg-[#f0f4f0] text-[#2d6a4f]'
                          }`}
                        >
                          <IconComp className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="leading-tight font-heading font-black text-xs truncate">
                            {opt.label}
                          </p>
                          <p className="text-[10px] text-[#52605d] truncate leading-tight mt-0.5">
                            {opt.sublabel}
                          </p>
                        </div>
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 text-[#2d6a4f] shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* POSTS LIST (Virtualization + Lazy Loading + Cursor-based Pagination) */}
      <div className="space-y-3 sm:space-y-4">
        {displayedPosts.length === 0 ? (
          <div className="bg-white rounded-2xl sm:rounded-3xl p-8 sm:p-10 text-center border border-[#e2ece2] shadow-xs space-y-2.5">
            <div className="w-12 h-12 bg-[#f7f9f7] rounded-full flex items-center justify-center mx-auto text-[#52605d]">
              <MessageSquare className="w-5 h-5 text-[#2d6a4f]" />
            </div>
            <h3 className="font-heading font-extrabold text-[#1b4332] text-sm sm:text-base">
              No Feed Posts Yet
            </h3>
            <p className="text-xs text-[#52605d] max-w-sm mx-auto">
              Be the first to share a post or update with the BCC community!
            </p>
            {!isComposerExpanded && (
              <button
                type="button"
                onClick={() => setIsComposerExpanded(true)}
                className="px-3.5 py-1.5 rounded-lg bg-[#1b4332] text-white font-bold text-xs shadow-xs hover:bg-[#2d6a4f] transition-all cursor-pointer"
              >
                Create a Post
              </button>
            )}
          </div>
        ) : (
          displayedPosts.map((post, idx) => {
            const isAlgorithmPick = sortMode === 'algorithm' && idx === 0 && fullSortedPosts.length > 1;

            return (
              <FeedPostCard
                key={post.id}
                post={post}
                currentUser={currentUser}
                isAdmin={isAdmin}
                isAlgorithmPick={isAlgorithmPick}
                onOpenDeleteModal={(p) => setPostToDelete(p)}
                onOpenReactionsModal={(data) => {
                  setReactionsModalData(data);
                  setReactionsModalTab('all');
                }}
                onPhotoClick={(url) => setSelectedPhotoPreview(url)}
              />
            );
          })
        )}

        {/* INFINITE SCROLL SENTINEL & LOADING STATE */}
        <div ref={sentinelRef} className="h-4 w-full" />

        {isLoadingMore && (
          <div className="py-4 flex items-center justify-center gap-2 text-xs font-bold text-[#2d6a4f] bg-white/60 backdrop-blur-xs rounded-2xl border border-[#e2ece2]">
            <Loader2 className="w-4 h-4 animate-spin text-[#2d6a4f]" />
            <span>Loading more posts...</span>
          </div>
        )}

        {!hasMore && displayedPosts.length > 0 && (
          <div className="py-6 text-center text-xs font-semibold text-[#52605d]">
            ✨ You&apos;re all caught up
          </div>
        )}
      </div>

      {/* UNIVERSAL REACTIONS BREAKDOWN MODAL */}
      <AnimatePresence>
        {reactionsModalData && (
          <ModalPortal>
            <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="bg-white rounded-3xl max-w-md w-full border border-[#e2ece2] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
              >
                {/* Modal Header */}
                <div className="p-4 sm:p-5 border-b border-[#e2ece2] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#2d6a4f]" />
                    <h3 className="font-heading font-black text-sm sm:text-base text-[#1b4332]">
                      {reactionsModalData.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReactionsModalData(null)}
                    className="p-1.5 rounded-xl hover:bg-[#f7f9f7] text-[#52605d] transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Reaction Filter Tabs */}
                <div className="flex items-center gap-1.5 p-2 bg-[#f7f9f7] border-b border-[#e2ece2] overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setReactionsModalTab('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      reactionsModalTab === 'all'
                        ? 'bg-[#1b4332] text-white shadow-xs'
                        : 'text-[#52605d] hover:bg-white'
                    }`}
                  >
                    All ({reactionsModalData.reactionsDetails?.length || 0})
                  </button>
                  {REACTIONS.map((rec) => {
                    const count = reactionsModalData.reactions?.[rec.type]?.length || 0;
                    if (count === 0) return null;
                    return (
                      <button
                        key={rec.type}
                        type="button"
                        onClick={() => setReactionsModalTab(rec.type)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          reactionsModalTab === rec.type
                            ? 'bg-[#1b4332] text-white shadow-xs'
                            : 'text-[#52605d] hover:bg-white'
                        }`}
                      >
                        <span>{rec.emoji}</span>
                        <span>{count}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Reactors List */}
                <div className="p-4 overflow-y-auto space-y-2 flex-1">
                  {modalReactionDetails.length === 0 ? (
                    <div className="text-center py-8 text-xs text-[#52605d]">
                      No reactions in this category.
                    </div>
                  ) : (
                    modalReactionDetails.map((rec, idx) => {
                      const recConf = REACTIONS.find((r) => r.type === rec.type);
                      return (
                        <div
                          key={`${rec.userId}_${idx}`}
                          className="flex items-center justify-between p-2.5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#d8f3dc] border border-[#b7e4c7] flex items-center justify-center font-bold text-[#1b4332] text-xs shrink-0 overflow-hidden">
                              {rec.userAvatar ? (
                                <img
                                  src={rec.userAvatar}
                                  alt={rec.userName}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                rec.userName.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <h4 className="font-heading font-black text-xs text-[#1b4332]">
                                {rec.userName}
                              </h4>
                              {rec.userRole && (
                                <span className="text-[10px] text-[#52605d] font-semibold">
                                  {rec.userRole}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{recConf?.emoji}</span>
                            <span className="text-xs font-bold text-[#1b4332]">
                              {recConf?.label}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            </div>
          </ModalPortal>
        )}
      </AnimatePresence>

      {/* CONFIRM DELETE POST MODAL */}
      <AnimatePresence>
        {postToDelete && (
          <ModalPortal>
            <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl max-w-sm w-full p-5 border border-[#e2ece2] shadow-2xl space-y-4"
              >
                <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="font-heading font-black text-base text-[#1b4332]">
                    Delete Feed Post?
                  </h3>
                  <p className="text-xs text-[#52605d]">
                    Are you sure you want to delete this post? This action cannot be undone.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPostToDelete(null)}
                    className="flex-1 py-2.5 rounded-xl border border-[#e2ece2] text-xs font-bold text-[#52605d] hover:bg-[#f7f9f7] transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    id="confirm-delete-post-btn"
                    onClick={handleConfirmDelete}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-heading font-extrabold transition-all cursor-pointer shadow-xs"
                  >
                    Delete Post
                  </button>
                </div>
              </motion.div>
            </div>
          </ModalPortal>
        )}
      </AnimatePresence>

      {/* PHOTO LIGHTBOX MODAL */}
      <AnimatePresence>
        {selectedPhotoPreview && (
          <ModalPortal>
            <div
              className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
              onClick={() => setSelectedPhotoPreview(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center justify-center"
              >
                <button
                  type="button"
                  onClick={() => setSelectedPhotoPreview(null)}
                  className="absolute -top-10 right-0 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
                  title="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
                <img
                  src={selectedPhotoPreview}
                  alt="Full preview"
                  referrerPolicy="no-referrer"
                  className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
                />
              </motion.div>
            </div>
          </ModalPortal>
        )}
      </AnimatePresence>
    </div>
  );
};
