import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  Search,
  Filter,
  Trash2,
  Send,
  User,
  Clock,
  ChevronDown,
  Check,
  X,
  AlertTriangle,
  Sparkles,
  Smile,
  Tag,
  ShieldCheck,
  Bike,
  Flame,
  ArrowUpDown,
  Reply,
  CornerDownRight,
  Image as ImageIcon,
  Video as VideoIcon,
  Play,
  HardDrive,
  Film,
  Loader2,
  Maximize2,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { store } from '../lib/db';
import { CommunityPost, SocialReactionType, ReactionRecord, PostComment, CommentReply, PostMediaItem } from '../types';
import { uploadPhotoToSharedDrive, uploadVideoToSharedDrive } from '../lib/driveMedia';
import { WhiteLabelVideoPlayer } from './WhiteLabelVideoPlayer';
import { ModalPortal } from './ModalPortal';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface ReactionConfig {
  type: SocialReactionType;
  label: string;
  emoji: string;
  activeColor: string;
  activeBg: string;
  activeBorder: string;
  badgeBg: string;
}

const REACTIONS: ReactionConfig[] = [
  {
    type: 'like',
    label: 'Like',
    emoji: '👍',
    activeColor: 'text-blue-600',
    activeBg: 'bg-blue-50',
    activeBorder: 'border-blue-200',
    badgeBg: 'bg-blue-100 text-blue-800',
  },
  {
    type: 'heart',
    label: 'Heart',
    emoji: '❤️',
    activeColor: 'text-rose-600',
    activeBg: 'bg-rose-50',
    activeBorder: 'border-rose-200',
    badgeBg: 'bg-rose-100 text-rose-800',
  },
  {
    type: 'care',
    label: 'Care',
    emoji: '🤗',
    activeColor: 'text-amber-600',
    activeBg: 'bg-amber-50',
    activeBorder: 'border-amber-200',
    badgeBg: 'bg-amber-100 text-amber-800',
  },
  {
    type: 'blessed',
    label: 'Blessed',
    emoji: '🙏',
    activeColor: 'text-emerald-700',
    activeBg: 'bg-emerald-50',
    activeBorder: 'border-emerald-200',
    badgeBg: 'bg-emerald-100 text-emerald-800',
  },
];

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 45) return 'Just now';
    if (diffSec < 3600) {
      const mins = Math.max(1, Math.floor(diffSec / 60));
      return `${mins}m ago`;
    }
    if (diffSec < 86400) {
      const hours = Math.floor(diffSec / 3600);
      return `${hours}h ago`;
    }
    if (diffSec < 604800) {
      const days = Math.floor(diffSec / 86400);
      return `${days}d ago`;
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateString;
  }
}

export const NewsFeed: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();

  // Posts State
  const [posts, setPosts] = useState<CommunityPost[]>(() => store.getPosts());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'popular'>('latest');

  // Composer State
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Photos & Video Media Composer State
  const [stagedPhotos, setStagedPhotos] = useState<Array<{ id: string; file?: File; previewUrl: string; name: string }>>([]);
  const [stagedVideo, setStagedVideo] = useState<{ id: string; file?: File; previewUrl: string; name: string; title: string } | null>(null);
  const [mediaUploadProgress, setMediaUploadProgress] = useState<string | null>(null);
  const [mediaUploadError, setMediaUploadError] = useState<string | null>(null);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // Active Reaction Popover State (keyed by 'post_${id}', 'comment_${id}', or 'reply_${id}')
  const [activeReactionPickerKey, setActiveReactionPickerKey] = useState<string | null>(null);
  const reactionPickerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Expanded comments by post ID
  const [expandedCommentPostIds, setExpandedCommentPostIds] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Replying State
  const [activeReplyCommentId, setActiveReplyCommentId] = useState<string | null>(null);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [replyMentions, setReplyMentions] = useState<Record<string, string>>({});

  // Reactions Breakdown Modal State (Universal for posts, comments, and replies)
  interface ReactionsModalData {
    title: string;
    reactions?: {
      like?: string[];
      heart?: string[];
      care?: string[];
      blessed?: string[];
    };
    reactionsDetails?: ReactionRecord[];
  }
  const [reactionsModalData, setReactionsModalData] = useState<ReactionsModalData | null>(null);
  const [reactionsModalTab, setReactionsModalTab] = useState<SocialReactionType | 'all'>('all');

  // Delete Post Modal State
  const [postToDelete, setPostToDelete] = useState<CommunityPost | null>(null);

  useModalDismiss(Boolean(reactionsModalData), () => setReactionsModalData(null));
  useModalDismiss(Boolean(postToDelete), () => setPostToDelete(null));

  // Listen to store updates
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
        setExpandedCommentPostIds((prev) => ({ ...prev, [detail.postId]: true }));
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

    // Initial fetch to ensure fresh server data
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
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaUploadError(null);

    if (!file.type.startsWith('video/')) {
      setMediaUploadError('Please select a valid video file (MP4, WebM, MOV).');
      return;
    }

    // Limit to 45MB to be safe within the 50MB body limit
    if (file.size > 45 * 1024 * 1024) {
      setMediaUploadError('Video file size exceeds the 45MB upload threshold.');
      return;
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
    if (stagedVideo?.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(stagedVideo.previewUrl);
    }
    setStagedVideo(null);
  };

  // Post Submission Handler
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || (!postContent.trim() && stagedPhotos.length === 0 && !stagedVideo)) return;

    setIsSubmitting(true);
    setMediaUploadError(null);
    setMediaUploadProgress(null);

    try {
      const uploadedPhotos: string[] = [];
      const mediaItems: PostMediaItem[] = [];
      let uploadedVideoUrl: string | undefined;

      // 1. Upload photos to Google Shared Drive (Folder ID: 0AGPGJ8Knm3Y7Uk9PVA)
      if (stagedPhotos.length > 0) {
        for (let i = 0; i < stagedPhotos.length; i++) {
          const photo = stagedPhotos[i];
          setMediaUploadProgress(`Uploading photo ${i + 1} of ${stagedPhotos.length} to Shared Drive...`);
          try {
            if (photo.file) {
              const res = await uploadPhotoToSharedDrive(
                photo.file,
                currentUser.name || currentUser.username || 'rider',
                '0AGPGJ8Knm3Y7Uk9PVA',
                (status) => setMediaUploadProgress(`Photo ${i + 1}/${stagedPhotos.length}: ${status}`)
              );
              uploadedPhotos.push(res.url);
              mediaItems.push({
                id: `media_${Date.now()}_${i}`,
                type: 'photo',
                url: res.url,
                fileId: res.fileId,
                webViewLink: res.webViewLink,
              });
            } else if (photo.previewUrl) {
              uploadedPhotos.push(photo.previewUrl);
              mediaItems.push({
                id: `media_${Date.now()}_${i}`,
                type: 'photo',
                url: photo.previewUrl,
              });
            }
          } catch (err: any) {
            console.error(`Error uploading photo ${photo.name}:`, err);
            // If upload to shared drive encounters a problem, keep preview URL or notify
            uploadedPhotos.push(photo.previewUrl);
            mediaItems.push({
              id: `media_${Date.now()}_${i}`,
              type: 'photo',
              url: photo.previewUrl,
            });
          }
        }
      }

      // 2. Upload video directly to Club Cloud Storage (100% White-Label Native Video)
      if (stagedVideo && stagedVideo.file) {
        setMediaUploadProgress('Uploading video to Club Cloud Storage...');
        try {
          const videoRes = await uploadVideoToSharedDrive(
            stagedVideo.file,
            currentUser.name || currentUser.username || 'rider',
            '0AGPGJ8Knm3Y7Uk9PVA',
            (status) => setMediaUploadProgress(status)
          );

          uploadedVideoUrl = videoRes.url || stagedVideo.previewUrl;
          mediaItems.push({
            id: `media_video_${Date.now()}`,
            type: 'video',
            url: uploadedVideoUrl,
            caption: postTitle.trim() || stagedVideo.name,
          });
        } catch (vidErr: any) {
          console.warn('Direct video upload fallback:', vidErr);
          uploadedVideoUrl = stagedVideo.previewUrl;
          mediaItems.push({
            id: `media_video_${Date.now()}`,
            type: 'video',
            url: stagedVideo.previewUrl,
            caption: stagedVideo.name,
          });
        }
      }

      // 3. Create post with media attached
      store.createPost({
        authorId: currentUser.id,
        authorName: currentUser.name || currentUser.username || 'Member',
        authorAvatar: currentUser.avatar || '',
        authorRole: currentUser.role || 'Member',
        title: postTitle.trim(),
        content: postContent.trim() || (stagedVideo ? 'Uploaded a ride video' : 'Shared photo(s) with the club'),
        category: 'General',
        photos: uploadedPhotos.length > 0 ? uploadedPhotos : undefined,
        videoUrl: uploadedVideoUrl,
        media: mediaItems.length > 0 ? mediaItems : undefined,
      });

      // Reset form & staged media
      setPostTitle('');
      setPostContent('');
      setStagedPhotos([]);
      setStagedVideo(null);
      setMediaUploadProgress(null);
      setIsComposerExpanded(false);
    } catch (err: any) {
      console.error('Failed to create post:', err);
      setMediaUploadError(err?.message || 'Failed to publish post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Post Handler
  const handleConfirmDelete = () => {
    if (!postToDelete) return;
    store.deletePost(postToDelete.id);
    setPostToDelete(null);
  };

  // Reaction Picker hover/touch helpers
  const handleReactionButtonMouseEnter = (key: string) => {
    if (reactionPickerTimeoutRef.current) {
      clearTimeout(reactionPickerTimeoutRef.current);
    }
    setActiveReactionPickerKey(key);
  };

  const handleReactionButtonMouseLeave = () => {
    reactionPickerTimeoutRef.current = setTimeout(() => {
      setActiveReactionPickerKey(null);
    }, 350);
  };

  // Post Reaction Handling
  const handleReact = (postId: string, reactionType: SocialReactionType) => {
    if (!currentUser) return;
    setActiveReactionPickerKey(null);
    store.reactToPost(
      postId,
      currentUser.id,
      currentUser.name || currentUser.username || 'Member',
      reactionType,
      currentUser.role || 'Member',
      currentUser.avatar || ''
    );
  };

  const handleQuickReact = (post: CommunityPost) => {
    if (!currentUser) return;
    const existing = post.reactionsDetails?.find((r) => r.userId === currentUser.id);
    if (existing) {
      handleReact(post.id, existing.type);
    } else {
      handleReact(post.id, 'like');
    }
  };

  // Comment Reaction Handling
  const handleReactToComment = (
    postId: string,
    commentId: string,
    reactionType: SocialReactionType
  ) => {
    if (!currentUser) return;
    setActiveReactionPickerKey(null);
    store.reactToComment(
      postId,
      commentId,
      currentUser.id,
      currentUser.name || currentUser.username || 'Member',
      reactionType,
      currentUser.role || 'Member',
      currentUser.avatar || ''
    );
  };

  const handleQuickReactToComment = (postId: string, comment: PostComment) => {
    if (!currentUser) return;
    const existing = comment.reactionsDetails?.find((r) => r.userId === currentUser.id);
    if (existing) {
      handleReactToComment(postId, comment.id, existing.type);
    } else {
      handleReactToComment(postId, comment.id, 'like');
    }
  };

  // Reply Reaction Handling
  const handleReactToReply = (
    postId: string,
    commentId: string,
    replyId: string,
    reactionType: SocialReactionType
  ) => {
    if (!currentUser) return;
    setActiveReactionPickerKey(null);
    store.reactToReply(
      postId,
      commentId,
      replyId,
      currentUser.id,
      currentUser.name || currentUser.username || 'Member',
      reactionType,
      currentUser.role || 'Member',
      currentUser.avatar || ''
    );
  };

  const handleQuickReactToReply = (
    postId: string,
    commentId: string,
    reply: CommentReply
  ) => {
    if (!currentUser) return;
    const existing = reply.reactionsDetails?.find((r) => r.userId === currentUser.id);
    if (existing) {
      handleReactToReply(postId, commentId, reply.id, existing.type);
    } else {
      handleReactToReply(postId, commentId, reply.id, 'like');
    }
  };

  // Comments Handling
  const toggleComments = (postId: string) => {
    setExpandedCommentPostIds((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  const handleAddComment = (postId: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser) return;
    const text = (commentInputs[postId] || '').trim();
    if (!text) return;

    store.addCommentToPost(postId, {
      authorId: currentUser.id,
      authorName: currentUser.name || currentUser.username || 'Member',
      authorAvatar: currentUser.avatar || '',
      authorRole: currentUser.role || 'Member',
      content: text,
    });

    setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
    setExpandedCommentPostIds((prev) => ({ ...prev, [postId]: true }));
  };

  const handleDeleteComment = (postId: string, commentId: string) => {
    store.deleteCommentFromPost(postId, commentId);
  };

  // Replies Handling
  const handleStartReply = (commentId: string, mentionName?: string) => {
    setActiveReplyCommentId(commentId);
    if (mentionName) {
      setReplyMentions((prev) => ({ ...prev, [commentId]: mentionName }));
    }
  };

  const handleCancelReply = (commentId: string) => {
    setActiveReplyCommentId((prev) => (prev === commentId ? null : prev));
    setReplyMentions((prev) => {
      const next = { ...prev };
      delete next[commentId];
      return next;
    });
  };

  const handleAddReply = (postId: string, commentId: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser) return;
    const text = (replyInputs[commentId] || '').trim();
    if (!text) return;

    const mention = replyMentions[commentId];

    store.addReplyToComment(postId, commentId, {
      authorId: currentUser.id,
      authorName: currentUser.name || currentUser.username || 'Member',
      authorAvatar: currentUser.avatar || '',
      authorRole: currentUser.role || 'Member',
      replyToUserName: mention,
      content: text,
    });

    setReplyInputs((prev) => ({ ...prev, [commentId]: '' }));
    setActiveReplyCommentId(null);
    setReplyMentions((prev) => {
      const next = { ...prev };
      delete next[commentId];
      return next;
    });
  };

  const handleDeleteReply = (postId: string, commentId: string, replyId: string) => {
    store.deleteReplyFromComment(postId, commentId, replyId);
  };

  // Filter & Sort Posts
  const filteredPosts = useMemo(() => {
    let result = [...posts];

    // Filter by Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.content.toLowerCase().includes(q) ||
          p.title?.toLowerCase().includes(q) ||
          p.authorName.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortBy === 'popular') {
      result.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    } else {
      // Latest first
      result.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime() || 0;
        const timeB = new Date(b.createdAt).getTime() || 0;
        return timeB - timeA;
      });
    }

    return result;
  }, [posts, searchQuery, sortBy]);

  // Compute Active Reaction Details for Modal
  const modalReactionDetails = useMemo(() => {
    if (!reactionsModalData || !reactionsModalData.reactionsDetails) return [];
    if (reactionsModalTab === 'all') {
      return reactionsModalData.reactionsDetails;
    }
    return reactionsModalData.reactionsDetails.filter((r) => r.type === reactionsModalTab);
  }, [reactionsModalData, reactionsModalTab]);

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* SOCIAL MEDIA COMPOSER CARD */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-[#e2ece2] shadow-xs">
        <div className="flex items-start gap-2.5 sm:gap-3">
          {/* Current User Avatar */}
          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full ${currentUser?.avatar?.includes('bcc-logo.png') ? 'bg-white' : 'bg-[#d8f3dc]'} border border-[#b7e4c7] flex items-center justify-center font-heading font-black text-[#1b4332] text-xs shrink-0 shadow-xs overflow-hidden`}>
            {currentUser?.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                className={`w-full h-full ${currentUser.avatar.includes('bcc-logo.png') ? 'object-contain p-0.5 bg-white' : 'object-cover'}`}
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
                  What&apos;s on your mind, {currentUser?.firstName || currentUser?.name?.split(' ')[0] || 'Rider'}?
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-[#e2ece2] text-[10px] font-bold text-[#2d6a4f] shadow-xs shrink-0 hidden sm:inline-block">
                  Write Post
                </span>
              </button>
            ) : (
              <motion.form
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleCreatePost}
                className="space-y-2.5"
              >
                {/* Optional Title */}
                <div>
                  <input
                    type="text"
                    id="post-title-input"
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    placeholder="Optional headline (e.g., Weekend ride reflection, Gear review)..."
                    className="w-full px-3 py-1.5 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] text-xs font-semibold text-[#1b4332] placeholder:text-xs placeholder:text-[#52605d]/70 focus:outline-none focus:border-[#2d6a4f]"
                    maxLength={100}
                  />
                </div>

                {/* Main Content Area */}
                <div>
                  <textarea
                    id="post-content-textarea"
                    rows={3}
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="Share an update, prayer request, ride story, or discussion with the BCC brotherhood..."
                    className="w-full p-2.5 sm:p-3 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs text-[#1b4332] placeholder:text-xs placeholder:text-[#52605d]/70 focus:outline-none focus:border-[#2d6a4f] resize-y"
                    autoFocus
                    required
                  />
                </div>

                {/* Hidden File Inputs */}
                <input
                  ref={photoInputRef}
                  type="file"
                  id="composer-photo-input"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  id="composer-video-input"
                  accept="video/*"
                  className="hidden"
                  onChange={handleVideoSelect}
                />

                {/* Staged Photos Preview Grid */}
                {stagedPhotos.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#1b4332]">
                      <span className="flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-[#2d6a4f]" />
                        Photos to upload to Shared Drive ({stagedPhotos.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setStagedPhotos([])}
                        className="text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                      >
                        Clear all
                      </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {stagedPhotos.map((photo) => (
                        <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-[#b7e4c7] aspect-square bg-white shadow-xs">
                          <img
                            src={photo.previewUrl}
                            alt={photo.name}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(photo.id)}
                            className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer"
                            title="Remove photo"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Staged Video Preview (100% White-Label) */}
                {stagedVideo && (
                  <div className="p-3 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#1b4332]">
                      <span className="flex items-center gap-1.5">
                        <Film className="w-4 h-4 text-emerald-600" />
                        Video Attachment (White-Label HD Stream / Shorts)
                      </span>
                      <button
                        type="button"
                        onClick={handleRemoveVideo}
                        className="text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="relative rounded-xl overflow-hidden bg-black max-h-64 sm:max-h-72 flex items-center justify-center">
                      <video
                        src={stagedVideo.previewUrl}
                        controls
                        playsInline
                        className="max-h-64 sm:max-h-72 w-auto max-w-full object-contain mx-auto"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px] text-[#52605d] px-1">
                      <span className="truncate max-w-[280px] font-medium">{stagedVideo.name}</span>
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Auto-detects Landscape & Shorts (9:16)
                      </span>
                    </div>
                  </div>
                )}

                {/* Upload Status / Progress Message */}
                {mediaUploadProgress && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                    <span>{mediaUploadProgress}</span>
                  </div>
                )}

                {/* Upload Error Banner */}
                {mediaUploadError && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-rose-900">Upload Notice</p>
                        <p className="text-[11px] text-rose-700">{mediaUploadError}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setMediaUploadError(null)}
                        className="p-1 text-rose-600 hover:text-rose-800 rounded-md cursor-pointer"
                        title="Dismiss"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Media Add Trigger Buttons & Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#e2ece2]">
                  <div className="flex items-center gap-1.5">
                    {/* Upload Photos Button */}
                    <button
                      type="button"
                      id="composer-add-photo-btn"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isSubmitting}
                      className="px-2.5 py-1.5 rounded-lg border border-[#e2ece2] bg-[#f7f9f7] hover:bg-[#e8f2e9] text-[#1b4332] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      title="Upload photos to BCC Shared Drive"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-[#2d6a4f]" />
                      <span>Photos</span>
                    </button>

                    {/* Upload Video Button */}
                    <button
                      type="button"
                      id="composer-add-video-btn"
                      onClick={() => videoInputRef.current?.click()}
                      disabled={isSubmitting || Boolean(stagedVideo)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#e2ece2] bg-[#f7f9f7] hover:bg-emerald-50 text-[#1b4332] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      title="Upload video to Club Shared Drive"
                    >
                      <VideoIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Video</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="composer-cancel-btn"
                      onClick={() => {
                        setIsComposerExpanded(false);
                        setPostTitle('');
                        setPostContent('');
                        setStagedPhotos([]);
                        setStagedVideo(null);
                        setMediaUploadError(null);
                        setMediaUploadProgress(null);
                      }}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#52605d] hover:bg-[#f7f9f7] transition-all cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      id="composer-submit-btn"
                      disabled={isSubmitting || (!postContent.trim() && stagedPhotos.length === 0 && !stagedVideo)}
                      className="px-3.5 py-1.5 rounded-lg bg-[#1b4332] hover:bg-[#2d6a4f] disabled:opacity-50 text-white font-heading font-extrabold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-[#74c69d]" />
                          <span>Publishing...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3 h-3 text-[#74c69d]" />
                          <span>Post</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.form>
            )}
          </div>
        </div>
      </div>

      {/* SEARCH & SORT BAR (Category filter removed, compact mobile layout) */}
      <div className="flex items-center justify-between gap-2.5 bg-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-[#e2ece2] shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1">
          <input
            type="text"
            id="feed-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search feed posts or riders..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg sm:rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs font-medium text-[#1b4332] placeholder:text-xs placeholder:text-[#52605d]/70 focus:outline-none focus:border-[#2d6a4f]"
          />
          <Search className="w-3.5 h-3.5 text-[#52605d] absolute left-2.5 top-2" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1.5 text-[#52605d] hover:text-[#1b4332]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort By Toggle */}
        <div className="flex items-center gap-0.5 bg-[#f7f9f7] p-0.5 rounded-lg border border-[#e2ece2] shrink-0">
          <button
            type="button"
            id="sort-latest-btn"
            onClick={() => setSortBy('latest')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
              sortBy === 'latest' ? 'bg-white text-[#1b4332] shadow-xs' : 'text-[#52605d] hover:text-[#1b4332]'
            }`}
          >
            Latest
          </button>
          <button
            type="button"
            id="sort-popular-btn"
            onClick={() => setSortBy('popular')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
              sortBy === 'popular' ? 'bg-white text-[#1b4332] shadow-xs' : 'text-[#52605d] hover:text-[#1b4332]'
            }`}
          >
            Popular
          </button>
        </div>
      </div>

      {/* POSTS LIST */}
      <div className="space-y-3 sm:space-y-4">
        {filteredPosts.length === 0 ? (
          <div className="bg-white rounded-2xl sm:rounded-3xl p-8 sm:p-10 text-center border border-[#e2ece2] shadow-xs space-y-2.5">
            <div className="w-12 h-12 bg-[#f7f9f7] rounded-full flex items-center justify-center mx-auto text-[#52605d]">
              <MessageSquare className="w-5 h-5 text-[#2d6a4f]" />
            </div>
            <h3 className="font-heading font-extrabold text-[#1b4332] text-sm sm:text-base">
              No Feed Posts Found
            </h3>
            <p className="text-xs text-[#52605d] max-w-sm mx-auto">
              {searchQuery
                ? 'No posts match your search query. Try clearing the search.'
                : 'Be the first to share a post with the BCC community above!'}
            </p>
            {isComposerExpanded ? null : (
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
          filteredPosts.map((post) => {
            const isAuthor = currentUser?.id === post.authorId;
            const canDelete = isAuthor || isAdmin;
            const userReaction = post.reactionsDetails?.find((r) => r.userId === currentUser?.id);
            const activeReactionConfig = userReaction
              ? REACTIONS.find((r) => r.type === userReaction.type)
              : null;

            // Tally non-empty reactions
            const reactionCounts = {
              like: post.reactions?.like?.length || 0,
              heart: post.reactions?.heart?.length || 0,
              care: post.reactions?.care?.length || 0,
              blessed: post.reactions?.blessed?.length || 0,
            };
            const totalReactions = Object.values(reactionCounts).reduce((a, b) => a + b, 0);
            const activeReactionTypes = REACTIONS.filter((r) => reactionCounts[r.type] > 0);

            const isCommentsOpen = Boolean(expandedCommentPostIds[post.id]);
            const commentsList = post.comments || [];
            const commentsCount = commentsList.length || post.commentsCount || 0;

            return (
              <motion.article
                key={post.id}
                id={`post-card-${post.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-[#e2ece2] shadow-xs space-y-2.5 sm:space-y-3 transition-all hover:border-[#b7e4c7]"
              >
                {/* POST HEADER */}
                <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    {/* Author Avatar */}
                    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full ${post.authorAvatar?.includes('bcc-logo.png') ? 'bg-white' : 'bg-[#d8f3dc]'} border border-[#b7e4c7] flex items-center justify-center font-heading font-black text-[#1b4332] text-xs shrink-0 shadow-xs overflow-hidden`}>
                      {post.authorAvatar ? (
                        <img
                          src={post.authorAvatar}
                          alt={post.authorName}
                          referrerPolicy="no-referrer"
                          className={`w-full h-full ${post.authorAvatar.includes('bcc-logo.png') ? 'object-contain p-0.5 bg-white' : 'object-cover'}`}
                        />
                      ) : (
                        post.authorName.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-heading font-black text-xs sm:text-sm text-[#1b4332]">
                          {post.authorName}
                        </h4>
                        {post.authorRole && (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-[#d8f3dc] text-[#1b4332] border border-[#b7e4c7]">
                            {post.authorRole}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-[#52605d] flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-[#52605d]" />
                        <span>{formatRelativeTime(post.createdAt)}</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions / Delete */}
                  {canDelete && (
                    <button
                      type="button"
                      id={`delete-post-btn-${post.id}`}
                      onClick={() => setPostToDelete(post)}
                      className="p-1 rounded-lg text-[#52605d] hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                      title="Delete post"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* POST CONTENT */}
                <div className="space-y-1.5">
                  {post.title && (
                    <h3 className="font-heading font-black text-xs sm:text-sm text-[#1b4332]">
                      {post.title}
                    </h3>
                  )}
                  {post.content && (
                    <p className="text-xs sm:text-sm text-[#2d4036] leading-relaxed whitespace-pre-wrap">
                      {post.content}
                    </p>
                  )}
                </div>

                {/* POST MEDIA: 100% WHITE-LABEL NATIVE VIDEO STREAMING */}
                {post.videoUrl && (
                  <div className="w-full flex justify-center">
                    <WhiteLabelVideoPlayer
                      src={post.videoUrl}
                      title={post.title}
                    />
                  </div>
                )}

                {/* POST MEDIA: PHOTOS FROM SHARED DRIVE */}
                {((post.photos && post.photos.length > 0) || (post.media && post.media.filter(m => m.type === 'photo' || (m.type as any) === 'image').length > 0)) && (
                  (() => {
                    const photoList = post.photos && post.photos.length > 0
                      ? post.photos
                      : (post.media || []).filter(m => m.type === 'photo' || (m.type as any) === 'image').map(m => m.url);

                    return (
                      <div className={`grid gap-1.5 rounded-xl sm:rounded-2xl overflow-hidden ${
                        photoList.length === 1
                          ? 'grid-cols-1'
                          : photoList.length === 2
                          ? 'grid-cols-2'
                          : photoList.length === 3
                          ? 'grid-cols-3'
                          : 'grid-cols-2 sm:grid-cols-4'
                      }`}>
                        {photoList.map((photoUrl, idx) => (
                          <div
                            key={idx}
                            onClick={() => setSelectedPhotoPreview(photoUrl)}
                            className="relative aspect-video sm:aspect-square bg-[#f0f4f0] cursor-pointer group overflow-hidden"
                          >
                            <img
                              src={photoUrl}
                              alt={`Post attachment ${idx + 1}`}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Maximize2 className="w-4 h-4 text-white drop-shadow-md" />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}

                {/* REACTION SUMMARY ROW (Above interactive actions) */}
                {(totalReactions > 0 || commentsCount > 0) && (
                  <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-[#52605d] pt-1.5 border-t border-[#f0f4f0]">
                    {/* Reactions Tally */}
                    {totalReactions > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReactionsModalData({
                            title: 'Post Reactions',
                            reactions: post.reactions,
                            reactionsDetails: post.reactionsDetails,
                          });
                          setReactionsModalTab('all');
                        }}
                        className="flex items-center gap-1.5 hover:underline cursor-pointer group"
                      >
                        <div className="flex items-center -space-x-1">
                          {activeReactionTypes.map((r) => (
                            <span
                              key={r.type}
                              className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white shadow-xs text-[10px] sm:text-xs border border-white"
                              title={`${r.label}: ${reactionCounts[r.type]}`}
                            >
                              {r.emoji}
                            </span>
                          ))}
                        </div>
                        <span className="font-bold text-[#1b4332] group-hover:text-[#2d6a4f]">
                          {totalReactions} {totalReactions === 1 ? 'reaction' : 'reactions'}
                        </span>
                      </button>
                    ) : (
                      <div />
                    )}

                    {/* Comments Tally */}
                    {commentsCount > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleComments(post.id)}
                        className="hover:underline cursor-pointer font-medium"
                      >
                        {commentsCount} {commentsCount === 1 ? 'comment' : 'comments'}
                      </button>
                    )}
                  </div>
                )}

                {/* INTERACTIVE ACTIONS BAR (Reactions + Comments ONLY, STRICTLY NO SHARE BUTTON) */}
                <div className="relative flex items-center gap-2 pt-1.5 border-t border-[#e2ece2]">
                  {/* Floating Reactions Dock Popover */}
                  <AnimatePresence>
                    {activeReactionPickerKey === `post_${post.id}` && (
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        onMouseEnter={() => handleReactionButtonMouseEnter(`post_${post.id}`)}
                        onMouseLeave={handleReactionButtonMouseLeave}
                        className="absolute left-0 bottom-full mb-2 z-50 bg-white px-2 py-1 rounded-full shadow-2xl border border-[#e2ece2] flex items-center gap-1.5 whitespace-nowrap"
                      >
                        {REACTIONS.map((rec) => (
                          <button
                            key={rec.type}
                            type="button"
                            onClick={() => handleReact(post.id, rec.type)}
                            className="p-1 hover:bg-[#f7f9f7] rounded-full text-base sm:text-lg transition-transform hover:scale-125 cursor-pointer active:scale-95"
                            title={rec.label}
                          >
                            {rec.emoji}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Reaction Action Button */}
                  <div
                    className="relative flex-1 sm:flex-initial"
                    onMouseEnter={() => handleReactionButtonMouseEnter(`post_${post.id}`)}
                    onMouseLeave={handleReactionButtonMouseLeave}
                  >
                    <button
                      type="button"
                      id={`react-btn-${post.id}`}
                      onClick={() => handleQuickReact(post)}
                      className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                        activeReactionConfig
                          ? `${activeReactionConfig.activeBg} ${activeReactionConfig.activeColor} ${activeReactionConfig.activeBorder}`
                          : 'bg-[#f7f9f7] hover:bg-[#e8f2e9] text-[#52605d] border-[#e2ece2]'
                      }`}
                    >
                      {activeReactionConfig ? (
                        <>
                          <span className="text-xs">{activeReactionConfig.emoji}</span>
                          <span>{activeReactionConfig.label}</span>
                        </>
                      ) : (
                        <>
                          <Smile className="w-3.5 h-3.5 text-[#2d6a4f]" />
                          <span>React</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Comment Action Button */}
                  <button
                    type="button"
                    id={`comment-btn-${post.id}`}
                    onClick={() => toggleComments(post.id)}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f7f9f7] hover:bg-[#e8f2e9] text-[#52605d] hover:text-[#1b4332] text-xs font-bold transition-all cursor-pointer border border-[#e2ece2]"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#2d6a4f]" />
                    <span>Comment</span>
                    {commentsCount > 0 && <span>({commentsCount})</span>}
                  </button>

                  {/* User requirement: "and do not include a share button." -> Intentionally omitted. */}
                </div>

                {/* COMMENTS & REPLIES SECTION */}
                <AnimatePresence>
                  {isCommentsOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="pt-3 border-t border-[#f0f4f0] space-y-3 overflow-visible"
                    >
                      {/* Comments List */}
                      {commentsList.length > 0 && (
                        <div className="space-y-3 overflow-visible">
                          {commentsList.map((comm) => {
                            const isCommentAuthor = comm.authorId === currentUser?.id;
                            const canDeleteComment = isCommentAuthor || isAdmin;
                            const userCommentReaction = comm.reactionsDetails?.find(
                              (r) => r.userId === currentUser?.id
                            )?.type;
                            const userCommentReactionConfig = userCommentReaction
                              ? REACTIONS.find((r) => r.type === userCommentReaction)
                              : null;
                            const commentReactionsCount = comm.reactionsDetails?.length || 0;
                            const commentDistinctEmojis = Array.from(
                              new Set(
                                (comm.reactionsDetails || [])
                                  .map((r) => REACTIONS.find((rc) => rc.type === r.type)?.emoji)
                                  .filter(Boolean)
                              )
                            );
                            const repliesList = comm.replies || [];

                            return (
                              <div
                                key={comm.id}
                                className={`p-3 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] text-xs space-y-2.5 relative ${
                                  activeReactionPickerKey === `comment_${comm.id}` ? 'z-30' : 'z-0'
                                }`}
                              >
                                {/* Top: Comment Author & Content */}
                                <div className="flex items-start gap-2.5">
                                  <div className={`w-7 h-7 rounded-full ${comm.authorAvatar?.includes('bcc-logo.png') ? 'bg-white' : 'bg-[#d8f3dc]'} border border-[#b7e4c7] flex items-center justify-center font-bold text-[#1b4332] text-[10px] shrink-0 overflow-hidden`}>
                                    {comm.authorAvatar ? (
                                      <img
                                        src={comm.authorAvatar}
                                        alt={comm.authorName}
                                        referrerPolicy="no-referrer"
                                        className={`w-full h-full ${comm.authorAvatar.includes('bcc-logo.png') ? 'object-contain p-0.5 bg-white' : 'object-cover'}`}
                                      />
                                    ) : (
                                      comm.authorName.charAt(0).toUpperCase()
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-heading font-black text-[#1b4332]">
                                          {comm.authorName}
                                        </span>
                                        {comm.authorRole && (
                                          <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-white border border-[#e2ece2] text-[#52605d] font-semibold">
                                            {comm.authorRole}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-[#52605d]">
                                          {formatRelativeTime(comm.createdAt)}
                                        </span>
                                        {canDeleteComment && (
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteComment(post.id, comm.id)}
                                            className="text-[#52605d] hover:text-rose-600 p-0.5 ml-1 transition-colors cursor-pointer"
                                            title="Delete comment"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-[#2d4036] mt-1 whitespace-pre-wrap leading-relaxed">
                                      {comm.content}
                                    </p>

                                    {/* Comment Interactive Actions: React, Reaction Tally, Reply */}
                                    <div className="flex items-center gap-3 mt-2 text-[11px]">
                                      {/* Comment React Button & Floating Dock */}
                                      <div
                                        className={`relative ${
                                          activeReactionPickerKey === `comment_${comm.id}`
                                            ? 'z-50'
                                            : 'z-10'
                                        }`}
                                        onMouseEnter={() =>
                                          handleReactionButtonMouseEnter(`comment_${comm.id}`)
                                        }
                                        onMouseLeave={handleReactionButtonMouseLeave}
                                      >
                                        <AnimatePresence>
                                          {activeReactionPickerKey === `comment_${comm.id}` && (
                                            <motion.div
                                              initial={{ opacity: 0, y: 4, scale: 0.95 }}
                                              animate={{ opacity: 1, y: 0, scale: 1 }}
                                              exit={{ opacity: 0, y: 4, scale: 0.95 }}
                                              transition={{ duration: 0.15 }}
                                              onMouseEnter={() =>
                                                handleReactionButtonMouseEnter(`comment_${comm.id}`)
                                              }
                                              onMouseLeave={handleReactionButtonMouseLeave}
                                              className="absolute left-0 bottom-full mb-1.5 z-50 bg-white px-2 py-1 rounded-full shadow-2xl border border-[#e2ece2] flex items-center gap-1.5 whitespace-nowrap"
                                            >
                                              {REACTIONS.map((rec) => (
                                                <button
                                                  key={rec.type}
                                                  type="button"
                                                  onClick={() =>
                                                    handleReactToComment(post.id, comm.id, rec.type)
                                                  }
                                                  className="p-1 hover:bg-[#f7f9f7] rounded-full text-base transition-transform hover:scale-125 cursor-pointer active:scale-95"
                                                  title={rec.label}
                                                >
                                                  {rec.emoji}
                                                </button>
                                              ))}
                                            </motion.div>
                                          )}
                                        </AnimatePresence>

                                        <button
                                          type="button"
                                          onClick={() => handleQuickReactToComment(post.id, comm)}
                                          className={`font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                                            userCommentReactionConfig
                                              ? userCommentReactionConfig.activeColor
                                              : 'text-[#52605d] hover:text-[#1b4332]'
                                          }`}
                                        >
                                          {userCommentReactionConfig ? (
                                            <>
                                              <span>{userCommentReactionConfig.emoji}</span>
                                              <span>{userCommentReactionConfig.label}</span>
                                            </>
                                          ) : (
                                            <span>React</span>
                                          )}
                                        </button>
                                      </div>

                                      {/* Comment Reactions Count Pill */}
                                      {commentReactionsCount > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setReactionsModalData({
                                              title: 'Comment Reactions',
                                              reactions: comm.reactions,
                                              reactionsDetails: comm.reactionsDetails,
                                            });
                                            setReactionsModalTab('all');
                                          }}
                                          className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white border border-[#e2ece2] text-[10px] font-bold text-[#1b4332] hover:bg-[#f0f4f0] transition-colors cursor-pointer shadow-2xs"
                                          title="View who reacted"
                                        >
                                          <span className="flex items-center -space-x-1">
                                            {commentDistinctEmojis.map((emoji, idx) => (
                                              <span key={idx}>{emoji}</span>
                                            ))}
                                          </span>
                                          <span>{commentReactionsCount}</span>
                                        </button>
                                      )}

                                      <span className="text-[#c2d1c2]">•</span>

                                      {/* Reply to comment button */}
                                      <button
                                        type="button"
                                        onClick={() => handleStartReply(comm.id, comm.authorName)}
                                        className="font-bold text-[#52605d] hover:text-[#1b4332] transition-colors cursor-pointer flex items-center gap-1"
                                      >
                                        <Reply className="w-3 h-3 text-[#2d6a4f]" />
                                        <span>Reply</span>
                                        {repliesList.length > 0 && (
                                          <span className="text-[10px] text-[#52605d]">
                                            ({repliesList.length})
                                          </span>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Threaded Replies Sub-tree */}
                                {repliesList.length > 0 && (
                                  <div className="ml-5 sm:ml-7 pl-3 border-l-2 border-[#b7e4c7] space-y-2 pt-1">
                                    {repliesList.map((reply) => {
                                      const isReplyAuthor = reply.authorId === currentUser?.id;
                                      const canDeleteReply = isReplyAuthor || isAdmin;
                                      const userReplyReaction = reply.reactionsDetails?.find(
                                        (r) => r.userId === currentUser?.id
                                      )?.type;
                                      const userReplyReactionConfig = userReplyReaction
                                        ? REACTIONS.find((r) => r.type === userReplyReaction)
                                        : null;
                                      const replyReactionsCount = reply.reactionsDetails?.length || 0;
                                      const replyDistinctEmojis = Array.from(
                                        new Set(
                                          (reply.reactionsDetails || [])
                                            .map(
                                              (r) => REACTIONS.find((rc) => rc.type === r.type)?.emoji
                                            )
                                            .filter(Boolean)
                                        )
                                      );

                                      return (
                                        <div
                                          key={reply.id}
                                          className={`p-2.5 rounded-xl bg-white border border-[#e2ece2] text-xs space-y-1.5 shadow-2xs relative ${
                                            activeReactionPickerKey === `reply_${reply.id}` ? 'z-20' : 'z-0'
                                          }`}
                                        >
                                          <div className="flex items-start gap-2">
                                            <div className={`w-6 h-6 rounded-full ${reply.authorAvatar?.includes('bcc-logo.png') ? 'bg-white' : 'bg-[#d8f3dc]'} border border-[#b7e4c7] flex items-center justify-center font-bold text-[#1b4332] text-[9px] shrink-0 overflow-hidden`}>
                                              {reply.authorAvatar ? (
                                                <img
                                                  src={reply.authorAvatar}
                                                  alt={reply.authorName}
                                                  referrerPolicy="no-referrer"
                                                  className={`w-full h-full ${reply.authorAvatar.includes('bcc-logo.png') ? 'object-contain p-0.5 bg-white' : 'object-cover'}`}
                                                />
                                              ) : (
                                                reply.authorName.charAt(0).toUpperCase()
                                              )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center justify-between gap-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                  <span className="font-heading font-black text-[#1b4332]">
                                                    {reply.authorName}
                                                  </span>
                                                  {reply.authorRole && (
                                                    <span className="text-[9px] px-1 py-0.2 rounded-md bg-[#f7f9f7] border border-[#e2ece2] text-[#52605d] font-semibold">
                                                      {reply.authorRole}
                                                    </span>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                  <span className="text-[10px] text-[#52605d]">
                                                    {formatRelativeTime(reply.createdAt)}
                                                  </span>
                                                  {canDeleteReply && (
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        handleDeleteReply(
                                                          post.id,
                                                          comm.id,
                                                          reply.id
                                                        )
                                                      }
                                                      className="text-[#52605d] hover:text-rose-600 p-0.5 ml-1 transition-colors cursor-pointer"
                                                      title="Delete reply"
                                                    >
                                                      <Trash2 className="w-3 h-3" />
                                                    </button>
                                                  )}
                                                </div>
                                              </div>

                                              {/* Reply Text */}
                                              <p className="text-[#2d4036] mt-0.5 leading-relaxed">
                                                {reply.replyToUserName && (
                                                  <span className="text-[#2d6a4f] font-bold mr-1.5">
                                                    @{reply.replyToUserName}
                                                  </span>
                                                )}
                                                {reply.content}
                                              </p>

                                              {/* Reply Actions: React & Reply */}
                                              <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                                                {/* Reply React Button & Floating Dock */}
                                                <div
                                                  className={`relative ${
                                                    activeReactionPickerKey === `reply_${reply.id}`
                                                      ? 'z-50'
                                                      : 'z-10'
                                                  }`}
                                                  onMouseEnter={() =>
                                                    handleReactionButtonMouseEnter(
                                                      `reply_${reply.id}`
                                                    )
                                                  }
                                                  onMouseLeave={handleReactionButtonMouseLeave}
                                                >
                                                  <AnimatePresence>
                                                    {activeReactionPickerKey ===
                                                      `reply_${reply.id}` && (
                                                      <motion.div
                                                        initial={{ opacity: 0, y: 4, scale: 0.95 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        exit={{ opacity: 0, y: 4, scale: 0.95 }}
                                                        transition={{ duration: 0.15 }}
                                                        onMouseEnter={() =>
                                                          handleReactionButtonMouseEnter(
                                                            `reply_${reply.id}`
                                                          )
                                                        }
                                                        onMouseLeave={
                                                          handleReactionButtonMouseLeave
                                                        }
                                                        className="absolute left-0 bottom-full mb-1.5 z-50 bg-white px-2 py-1 rounded-full shadow-2xl border border-[#e2ece2] flex items-center gap-1.5 whitespace-nowrap"
                                                      >
                                                        {REACTIONS.map((rec) => (
                                                          <button
                                                            key={rec.type}
                                                            type="button"
                                                            onClick={() =>
                                                              handleReactToReply(
                                                                post.id,
                                                                comm.id,
                                                                reply.id,
                                                                rec.type
                                                              )
                                                            }
                                                            className="p-1 hover:bg-[#f7f9f7] rounded-full text-base transition-transform hover:scale-125 cursor-pointer active:scale-95"
                                                            title={rec.label}
                                                          >
                                                            {rec.emoji}
                                                          </button>
                                                        ))}
                                                      </motion.div>
                                                    )}
                                                  </AnimatePresence>

                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      handleQuickReactToReply(
                                                        post.id,
                                                        comm.id,
                                                        reply
                                                      )
                                                    }
                                                    className={`font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                                                      userReplyReactionConfig
                                                        ? userReplyReactionConfig.activeColor
                                                        : 'text-[#52605d] hover:text-[#1b4332]'
                                                    }`}
                                                  >
                                                    {userReplyReactionConfig ? (
                                                      <>
                                                        <span>{userReplyReactionConfig.emoji}</span>
                                                        <span>{userReplyReactionConfig.label}</span>
                                                      </>
                                                    ) : (
                                                      <span>React</span>
                                                    )}
                                                  </button>
                                                </div>

                                                {/* Reply Reactions Count Pill */}
                                                {replyReactionsCount > 0 && (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setReactionsModalData({
                                                        title: 'Reply Reactions',
                                                        reactions: reply.reactions,
                                                        reactionsDetails: reply.reactionsDetails,
                                                      });
                                                      setReactionsModalTab('all');
                                                    }}
                                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#f7f9f7] border border-[#e2ece2] text-[10px] font-bold text-[#1b4332] hover:bg-white transition-colors cursor-pointer shadow-2xs"
                                                    title="View who reacted"
                                                  >
                                                    <span className="flex items-center -space-x-1">
                                                      {replyDistinctEmojis.map((emoji, idx) => (
                                                        <span key={idx}>{emoji}</span>
                                                      ))}
                                                    </span>
                                                    <span>{replyReactionsCount}</span>
                                                  </button>
                                                )}

                                                <span className="text-[#c2d1c2]">•</span>

                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleStartReply(comm.id, reply.authorName)
                                                  }
                                                  className="font-bold text-[#52605d] hover:text-[#1b4332] transition-colors cursor-pointer flex items-center gap-1"
                                                >
                                                  <Reply className="w-3 h-3 text-[#2d6a4f]" />
                                                  <span>Reply</span>
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Inline Reply Composer Box */}
                                {activeReplyCommentId === comm.id && (
                                  <form
                                    onSubmit={(e) => handleAddReply(post.id, comm.id, e)}
                                    className="ml-5 sm:ml-7 p-2.5 rounded-2xl bg-white border border-[#b7e4c7] shadow-xs space-y-2"
                                  >
                                    <div className="flex items-center justify-between text-[11px] text-[#2d6a4f] font-semibold">
                                      <div className="flex items-center gap-1">
                                        <CornerDownRight className="w-3.5 h-3.5 text-[#2d6a4f]" />
                                        <span>
                                          Replying to {replyMentions[comm.id] || comm.authorName}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleCancelReply(comm.id)}
                                        className="text-[#52605d] hover:text-rose-600 p-0.5 rounded-md hover:bg-[#f7f9f7] transition-colors cursor-pointer"
                                        title="Cancel reply"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <div className={`w-6 h-6 rounded-full ${currentUser?.avatar?.includes('bcc-logo.png') ? 'bg-white' : 'bg-[#d8f3dc]'} border border-[#b7e4c7] flex items-center justify-center font-bold text-[#1b4332] text-[9px] shrink-0 overflow-hidden`}>
                                        {currentUser?.avatar ? (
                                          <img
                                            src={currentUser.avatar}
                                            alt={currentUser.name}
                                            referrerPolicy="no-referrer"
                                            className={`w-full h-full ${currentUser.avatar.includes('bcc-logo.png') ? 'object-contain p-0.5 bg-white' : 'object-cover'}`}
                                          />
                                        ) : (
                                          (currentUser?.name || 'U').charAt(0).toUpperCase()
                                        )}
                                      </div>

                                      <input
                                        type="text"
                                        autoFocus
                                        value={replyInputs[comm.id] || ''}
                                        onChange={(e) =>
                                          setReplyInputs((prev) => ({
                                            ...prev,
                                            [comm.id]: e.target.value,
                                          }))
                                        }
                                        placeholder={`Write a reply to ${
                                          replyMentions[comm.id] || comm.authorName
                                        }...`}
                                        className="flex-1 px-3 py-1.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                                      />

                                      <button
                                        type="submit"
                                        disabled={!replyInputs[comm.id]?.trim()}
                                        className="px-3 py-1.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] disabled:opacity-40 text-white font-bold text-xs transition-all cursor-pointer shrink-0 flex items-center gap-1"
                                        title="Send reply"
                                      >
                                        <Send className="w-3 h-3 text-[#74c69d]" />
                                        <span>Reply</span>
                                      </button>
                                    </div>
                                  </form>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Comment Input */}
                      <form
                        onSubmit={(e) => handleAddComment(post.id, e)}
                        className="flex items-center gap-2"
                      >
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full ${currentUser?.avatar?.includes('bcc-logo.png') ? 'bg-white' : 'bg-[#d8f3dc]'} border border-[#b7e4c7] flex items-center justify-center font-bold text-[#1b4332] text-[10px] sm:text-xs shrink-0 overflow-hidden`}>
                          {currentUser?.avatar ? (
                            <img
                              src={currentUser.avatar}
                              alt={currentUser.name}
                              referrerPolicy="no-referrer"
                              className={`w-full h-full ${currentUser.avatar.includes('bcc-logo.png') ? 'object-contain p-0.5 bg-white' : 'object-cover'}`}
                            />
                          ) : (
                            (currentUser?.name || 'U').charAt(0).toUpperCase()
                          )}
                        </div>

                        <input
                          type="text"
                          id={`comment-input-${post.id}`}
                          value={commentInputs[post.id] || ''}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          placeholder="Write a comment..."
                          className="flex-1 px-3 py-1.5 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] text-xs text-[#1b4332] placeholder:text-xs placeholder:text-[#52605d]/70 focus:outline-none focus:border-[#2d6a4f]"
                        />

                        <button
                          type="submit"
                          id={`send-comment-${post.id}`}
                          disabled={!commentInputs[post.id]?.trim()}
                          className="p-1.5 rounded-lg bg-[#1b4332] hover:bg-[#2d6a4f] disabled:opacity-40 text-white transition-all cursor-pointer shrink-0"
                          title="Send comment"
                        >
                          <Send className="w-3 h-3 text-[#74c69d]" />
                        </button>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.article>
            );
          })
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
