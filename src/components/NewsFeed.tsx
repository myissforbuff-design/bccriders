import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLoader } from '../context/LoaderContext';
import { store } from '../lib/db';
import { CommunityPost, ReactionType, FeedCommentItem } from '../types';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { ModalPortal } from './ModalPortal';
import {
  Heart,
  ThumbsUp,
  Smile,
  Frown,
  Flame,
  MessageCircle,
  Share2,
  Image as ImageIcon,
  Video as VideoIcon,
  Send,
  Trash2,
  X,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  CornerDownRight,
  Filter,
  Search,
  Plus,
  Play,
  Maximize2,
  Sparkles,
  User,
  MapPin,
  Compass,
  Wrench,
  Check,
  Pencil,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// 5 Standard Interactive Reactions
export const REACTION_CONFIG: Record<
  ReactionType,
  { label: string; emoji: string; color: string; bg: string; activeColor: string }
> = {
  like: {
    label: 'Like',
    emoji: '👍',
    color: '#1877f2',
    bg: '#e7f0fe',
    activeColor: 'text-[#1877f2] font-bold',
  },
  heart: {
    label: 'Heart',
    emoji: '❤️',
    color: '#e11d48',
    bg: '#ffe4e6',
    activeColor: 'text-[#e11d48] font-bold',
  },
  care: {
    label: 'Care',
    emoji: '🥰',
    color: '#f59e0b',
    bg: '#fef3c7',
    activeColor: 'text-[#d97706] font-bold',
  },
  sad: {
    label: 'Sad',
    emoji: '😢',
    color: '#6366f1',
    bg: '#e0e7ff',
    activeColor: 'text-[#4f46e5] font-bold',
  },
  angry: {
    label: 'Angry',
    emoji: '😡',
    color: '#dc2626',
    bg: '#fee2e2',
    activeColor: 'text-[#dc2626] font-bold',
  },
};

export const CATEGORY_OPTIONS: {
  value: CommunityPost['category'];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}[] = [
  {
    value: 'General Talk',
    label: 'General Talk',
    icon: MessageCircle,
    description: 'General cycling discussions, check-ins, or questions',
  },
  {
    value: 'Photos & Videos',
    label: 'Photos & Videos',
    icon: ImageIcon,
    description: 'Ride snapshots, reels, scenic captures, and clips',
  },
  {
    value: 'Group Ride Setup',
    label: 'Group Ride Setup',
    icon: Sparkles,
    description: 'Coordinate upcoming weekend club rides & meetups',
  },
  {
    value: 'Route Suggestion',
    label: 'Route Suggestion',
    icon: Compass,
    description: 'Recommend scenic trails, climbs, and GPX paths',
  },
  {
    value: 'Equipment & Gear',
    label: 'Equipment & Gear',
    icon: Wrench,
    description: 'Bikes, components, gear reviews, and maintenance',
  },
];

const CATEGORIES = [
  'All',
  'General Talk',
  'Photos & Videos',
  'Group Ride Setup',
  'Route Suggestion',
  'Equipment & Gear',
] as const;

export const NewsFeed: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const { runWithLoader, refreshTick } = useLoader();

  const [posts, setPosts] = useState<CommunityPost[]>(() => store.getPosts());
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Create Post Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<CommunityPost['category']>('General Talk');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [mediaFile, setMediaFile] = useState<{
    dataUrl: string;
    type: 'image' | 'video';
    name: string;
    driveUrl?: string;
    driveFileId?: string;
    driveWebViewLink?: string;
  } | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null);

  // Edit Post Modal State
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState<CommunityPost['category']>('General Talk');
  const [isEditCategoryDropdownOpen, setIsEditCategoryDropdownOpen] = useState(false);
  const [editMediaFile, setEditMediaFile] = useState<{
    dataUrl?: string;
    type: 'image' | 'video';
    name?: string;
    driveUrl?: string;
    driveFileId?: string;
    driveWebViewLink?: string;
  } | null>(null);
  const [isUploadingEditMedia, setIsUploadingEditMedia] = useState(false);
  const [editUploadStatusMsg, setEditUploadStatusMsg] = useState<string | null>(null);

  // Interactive Confirmation Delete Modal State
  const [postToDelete, setPostToDelete] = useState<CommunityPost | null>(null);

  // Active Reaction Popover State
  const [hoveredPostId, setHoveredPostId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Lightbox Media Modal
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; type: 'image' | 'video'; title?: string } | null>(null);

  // Active Reply State
  const [activeReplyState, setActiveReplyState] = useState<{
    postId: string;
    commentId: string;
    authorName: string;
  } | null>(null);

  // Quick Comment Inputs
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});

  // Share Toast
  const [shareToast, setShareToast] = useState<string | null>(null);

  // File Input Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  useModalDismiss(isCreateOpen, () => setIsCreateOpen(false));
  useModalDismiss(!!editingPost, () => setEditingPost(null));
  useModalDismiss(!!postToDelete, () => setPostToDelete(null));
  useModalDismiss(!!lightboxMedia, () => setLightboxMedia(null));

  useEffect(() => {
    setPosts([...store.getPosts()]);
    // Fetch latest newsFeed document entries from MongoDB
    store.refreshNewsFeedFromServer().then((updatedPosts) => {
      if (updatedPosts) setPosts([...updatedPosts]);
    }).catch(() => {});

    const handleNewsFeedUpdated = (e: any) => {
      if (e.detail) {
        setPosts([...e.detail]);
      } else {
        setPosts([...store.getPosts()]);
      }
    };

    window.addEventListener('bcc_newsfeed_updated', handleNewsFeedUpdated);
    return () => {
      window.removeEventListener('bcc_newsfeed_updated', handleNewsFeedUpdated);
    };
  }, [refreshTick]);

  const refreshPosts = () => {
    setPosts([...store.getPosts()]);
  };

  // Upload to Google Shared Drive via /api/drive/upload (Create)
  const handleMediaSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isImage && !isVideo) {
      setShareToast('Please select a valid image or video file (JPG, PNG, WEBP, MP4, MOV).');
      setTimeout(() => setShareToast(null), 3000);
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      const mediaType: 'image' | 'video' = isVideo ? 'video' : 'image';

      setMediaFile({
        dataUrl: base64Data,
        type: mediaType,
        name: file.name,
      });

      setIsUploadingMedia(true);
      setUploadStatusMsg('Uploading to Google Shared Drive...');

      try {
        const response = await fetch('/api/drive/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            media: base64Data,
            fileName: `feed-${currentUser?.name?.toLowerCase().replace(/\s+/g, '_') || 'rider'}-${Date.now()}`,
            riderName: currentUser?.name,
            folder: 'newsFeed',
          }),
        });

        const data = await response.json();
        if (data && (data.url || data.webViewLink)) {
          setMediaFile({
            dataUrl: base64Data,
            type: mediaType,
            name: file.name,
            driveUrl: data.url,
            driveFileId: data.fileId,
            driveWebViewLink: data.webViewLink,
          });
          setUploadStatusMsg('✓ Saved to Google Shared Drive');
        } else {
          setUploadStatusMsg('✓ Ready to publish');
        }
      } catch (err) {
        console.warn('Direct Google Drive upload fallback:', err);
        setUploadStatusMsg('✓ Ready to publish (Local)');
      } finally {
        setIsUploadingMedia(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Upload to Google Shared Drive via /api/drive/upload (Edit)
  const handleEditMediaSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isImage && !isVideo) {
      setShareToast('Please select a valid image or video file (JPG, PNG, WEBP, MP4, MOV).');
      setTimeout(() => setShareToast(null), 3000);
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      const mediaType: 'image' | 'video' = isVideo ? 'video' : 'image';

      setEditMediaFile({
        dataUrl: base64Data,
        type: mediaType,
        name: file.name,
      });

      setIsUploadingEditMedia(true);
      setEditUploadStatusMsg('Uploading to Google Shared Drive...');

      try {
        const response = await fetch('/api/drive/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            media: base64Data,
            fileName: `feed-${currentUser?.name?.toLowerCase().replace(/\s+/g, '_') || 'rider'}-${Date.now()}`,
            riderName: currentUser?.name,
            folder: 'newsFeed',
          }),
        });

        const data = await response.json();
        if (data && (data.url || data.webViewLink)) {
          setEditMediaFile({
            dataUrl: base64Data,
            type: mediaType,
            name: file.name,
            driveUrl: data.url,
            driveFileId: data.fileId,
            driveWebViewLink: data.webViewLink,
          });
          setEditUploadStatusMsg('✓ Saved to Google Shared Drive');
        } else {
          setEditUploadStatusMsg('✓ Ready to save');
        }
      } catch (err) {
        console.warn('Direct Google Drive upload fallback:', err);
        setEditUploadStatusMsg('✓ Ready to save (Local)');
      } finally {
        setIsUploadingEditMedia(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Open Edit Modal
  const handleOpenEditModal = (post: CommunityPost) => {
    setEditingPost(post);
    setEditTitle(post.title || '');
    setEditContent(post.content || '');
    setEditCategory(post.category || 'General Talk');
    setIsEditCategoryDropdownOpen(false);
    if (post.mediaUrl) {
      setEditMediaFile({
        dataUrl: post.mediaUrl,
        type: post.mediaType || (post.mediaUrl.includes('.mp4') ? 'video' : 'image'),
        name: 'Attached Media',
        driveUrl: post.mediaUrl,
        driveFileId: post.driveFileId,
        driveWebViewLink: post.driveWebViewLink,
      });
      setEditUploadStatusMsg(post.driveWebViewLink ? '✓ Linked to Google Shared Drive' : null);
    } else {
      setEditMediaFile(null);
      setEditUploadStatusMsg(null);
    }
  };

  // Submit Edit Post
  const handleUpdatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost || !currentUser || (!editContent.trim() && !editMediaFile)) return;

    await runWithLoader(
      async () => {
        store.updatePost(editingPost.id, {
          title: editTitle.trim() || `${editingPost.authorName}'s Update`,
          content: editContent.trim(),
          category: editCategory,
          mediaUrl: editMediaFile ? (editMediaFile.driveUrl || editMediaFile.dataUrl) : undefined,
          mediaType: editMediaFile?.type,
          driveFileId: editMediaFile?.driveFileId,
          driveWebViewLink: editMediaFile?.driveWebViewLink,
        });

        refreshPosts();
        setEditingPost(null);
        setShareToast('Post updated successfully!');
        setTimeout(() => setShareToast(null), 2500);
      },
      { message: 'Saving changes...' }
    );
  };

  // Submit Post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || (!newContent.trim() && !mediaFile)) return;

    await runWithLoader(
      async () => {
        store.createPost({
          authorId: currentUser.id,
          authorName: currentUser.name,
          authorAvatar: currentUser.avatar || '',
          authorRole: currentUser.role,
          title: newTitle.trim() || `${currentUser.name}'s Update`,
          content: newContent.trim(),
          category: (newCategory as any) || 'General Talk',
          mediaUrl: mediaFile?.driveUrl || mediaFile?.dataUrl,
          mediaType: mediaFile?.type,
          driveFileId: mediaFile?.driveFileId,
          driveWebViewLink: mediaFile?.driveWebViewLink,
        });

        refreshPosts();
        setIsCreateOpen(false);
        setNewTitle('');
        setNewContent('');
        setMediaFile(null);
        setUploadStatusMsg(null);
        setShareToast('Post published to News Feed!');
        setTimeout(() => setShareToast(null), 2500);
      },
      { message: 'Publishing to News Feed...' }
    );
  };

  // Handle Reactions
  const handleReactionClick = (postId: string, reaction: ReactionType) => {
    if (!currentUser) return;
    store.setPostReaction(postId, currentUser.id, reaction);
    setHoveredPostId(null);
    refreshPosts();
  };

  const handleQuickReaction = (postId: string) => {
    if (!currentUser) return;
    const post = posts.find((p) => p.id === postId);
    const existing = post?.reactions?.[currentUser.id];
    if (existing) {
      store.setPostReaction(postId, currentUser.id, existing); // Toggles off
    } else {
      store.setPostReaction(postId, currentUser.id, 'like');
    }
    refreshPosts();
  };

  // Comments
  const handleAddComment = (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!currentUser || !text) return;

    store.addPostComment(postId, {
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar,
      authorRole: currentUser.role,
      content: text,
    });

    setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
    refreshPosts();
  };

  // Replies
  const handleAddReply = (postId: string, commentId: string) => {
    const text = replyInputs[commentId]?.trim();
    if (!currentUser || !text) return;

    store.addCommentReply(postId, commentId, {
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar,
      authorRole: currentUser.role,
      content: text,
      replyToUserName: activeReplyState?.authorName,
    });

    setReplyInputs((prev) => ({ ...prev, [commentId]: '' }));
    setActiveReplyState(null);
    refreshPosts();
  };

  // Delete Post (Triggered from Interactive Confirmation Modal)
  const handleConfirmDeletePost = async () => {
    if (!postToDelete) return;
    const postId = postToDelete.id;
    await runWithLoader(
      async () => {
        store.deletePost(postId);
        refreshPosts();
        setPostToDelete(null);
        setShareToast('Post removed successfully.');
        setTimeout(() => setShareToast(null), 2500);
      },
      { message: 'Deleting post...' }
    );
  };

  // Filter Posts
  const filteredPosts = posts.filter((p) => {
    const matchesCategory =
      activeCategory === 'All' ||
      (activeCategory === 'Photos & Videos' && !!p.mediaUrl) ||
      p.category === activeCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.authorName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-3 sm:space-y-4 max-w-3xl mx-auto w-full">
      {/* Share Feedback Toast */}
      {shareToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#1b4332] text-white text-[11px] font-semibold px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#74c69d]" />
          <span>{shareToast}</span>
        </div>
      )}

      {/* Top Composer Bar */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-[#e2ece2] p-2.5 sm:p-4 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#e8f2e9] border border-[#d8e6d9] overflow-hidden flex items-center justify-center shrink-0">
            {currentUser?.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-[#2d6a4f]" />
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex-1 min-w-0 text-left px-3 sm:px-4 py-2 sm:py-2.5 bg-[#f7f9f7] hover:bg-[#eef5ef] text-[#52605d] text-[11px] sm:text-xs font-medium rounded-lg sm:rounded-xl border border-[#e2ece2] transition-colors cursor-pointer flex items-center justify-between gap-1.5"
          >
            <span className="truncate">
              Share photos, videos or story...
            </span>
            <Sparkles className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
          </button>
        </div>

        <div className="mt-2.5 pt-2.5 sm:mt-3 sm:pt-3 border-t border-[#f0f4f0] flex items-center justify-between gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              setIsCreateOpen(true);
              setTimeout(() => fileInputRef.current?.click(), 100);
            }}
            className="flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 px-1.5 sm:px-2 rounded-lg bg-[#f7f9f7] hover:bg-[#e8f2e9] text-[#2d6a4f] text-[10px] sm:text-xs font-bold transition-colors cursor-pointer"
          >
            <ImageIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 shrink-0" />
            <span className="whitespace-nowrap">Photo / Video</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNewCategory('Group Ride Setup');
              setIsCreateOpen(true);
            }}
            className="flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 px-1.5 sm:px-2 rounded-lg bg-[#f7f9f7] hover:bg-[#e8f2e9] text-[#2d6a4f] text-[10px] sm:text-xs font-bold transition-colors cursor-pointer"
          >
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600 shrink-0" />
            <span className="whitespace-nowrap">Ride Story</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-[10px] sm:text-xs font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-3 h-3 text-[#74c69d]" />
            <span>Post</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-white p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border border-[#e2ece2] shadow-xs">
        {/* Categories Chips */}
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto pb-0.5 sm:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-[#1b4332] text-white shadow-xs'
                  : 'bg-[#f7f9f7] text-[#52605d] hover:bg-[#e8f2e9] hover:text-[#1b4332] border border-[#e2ece2]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-48">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search feed..."
            className="w-full pl-6 pr-2.5 py-1 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] text-[10.5px] sm:text-xs text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
          />
          <Search className="w-3 h-3 text-[#52605d] absolute left-2 top-1.5" />
        </div>
      </div>

      {/* Posts List */}
      <div className="space-y-3 sm:space-y-4">
        {filteredPosts.length === 0 ? (
          <div className="bg-white rounded-xl sm:rounded-2xl border border-[#e2ece2] p-6 sm:p-8 text-center shadow-xs">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#f0f7f1] text-[#2d6a4f] mx-auto flex items-center justify-center mb-2.5 sm:mb-3">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h3 className="text-xs sm:text-sm font-extrabold text-[#1b4332]">No posts yet</h3>
            <p className="text-[11px] sm:text-xs text-[#52605d] mt-1 max-w-sm mx-auto">
              Be the first rider to share photos, video clips, or stories with the club!
            </p>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="mt-3.5 px-3.5 py-1.5 rounded-lg sm:rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-[11px] sm:text-xs font-extrabold inline-flex items-center gap-1 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3 h-3 text-[#74c69d]" />
              <span>Create Post</span>
            </button>
          </div>
        ) : (
          filteredPosts.map((post) => {
            const userReaction = currentUser?.id ? post.reactions?.[currentUser.id] : undefined;
            const currentReactionData = userReaction ? REACTION_CONFIG[userReaction] : null;

            // Tally non-zero reactions for summary
            const activeReactions = (['like', 'heart', 'care', 'sad', 'angry'] as ReactionType[])
              .map((type) => ({
                type,
                count: post.reactionCounts?.[type] || (type === 'like' && post.likedBy?.length ? post.likedBy.length : 0),
                emoji: REACTION_CONFIG[type].emoji,
              }))
              .filter((r) => r.count > 0);

            const totalReactionsCount =
              post.likesCount ||
              activeReactions.reduce((acc, curr) => acc + curr.count, 0) ||
              post.likedBy?.length ||
              0;

            const comments = post.commentsList || [];

            return (
              <div
                key={post.id}
                className="bg-white rounded-xl sm:rounded-2xl border border-[#e2ece2] p-3 sm:p-4 shadow-xs transition-all hover:border-[#c8ddc9]"
              >
                {/* Post Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#e8f2e9] border border-[#d8e6d9] overflow-hidden flex items-center justify-center shrink-0">
                      {post.authorAvatar ? (
                        <img
                          src={post.authorAvatar}
                          alt={post.authorName}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User className="w-3.5 h-3.5 text-[#2d6a4f]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-xs sm:text-sm font-extrabold text-[#1b4332] truncate">
                          {post.authorName}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-[#e8f2e9] text-[#2d6a4f] border border-[#d8e6d9]">
                          {post.authorRole}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] sm:text-[10.5px] text-[#52605d] mt-0.5">
                        <span>{post.createdAt}</span>
                        <span>&bull;</span>
                        <span className="font-semibold text-[#2d6a4f]">{post.category}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions / Edit & Delete */}
                  <div className="flex items-center gap-1">
                    {(isAdmin || currentUser?.id === post.authorId) && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(post)}
                          className="p-1 sm:p-1.5 rounded-lg text-[#52605d] hover:text-[#1b4332] hover:bg-[#e8f2e9] transition-colors cursor-pointer"
                          title="Edit Post"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPostToDelete(post)}
                          className="p-1 sm:p-1.5 rounded-lg text-[#8a9695] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete Post"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Post Content */}
                <div className="mt-2.5 text-[11.5px] sm:text-xs text-[#2d3a3a] leading-relaxed whitespace-pre-line">
                  {post.content}
                </div>

                {/* Media Attachment (Photo or Video with Google Drive integration) */}
                {post.mediaUrl && (
                  <div className="mt-2.5 rounded-lg sm:rounded-xl overflow-hidden border border-[#e2ece2] bg-[#0c1a14] relative group">
                    {post.mediaType === 'video' || post.mediaUrl.includes('.mp4') || post.mediaUrl.startsWith('data:video') ? (
                      <div className="relative">
                        <video
                          src={post.mediaUrl}
                          controls
                          playsInline
                          className="w-full max-h-[320px] object-contain mx-auto bg-black"
                        />
                        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-white text-[9.5px] font-bold flex items-center gap-1">
                          <VideoIcon className="w-2.5 h-2.5 text-[#74c69d]" />
                          <span>Video</span>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => setLightboxMedia({ url: post.mediaUrl!, type: 'image', title: post.title })}
                        className="cursor-pointer relative overflow-hidden flex items-center justify-center max-h-[360px] bg-black/5"
                      >
                        <img
                          src={post.mediaUrl}
                          alt="Post attachment"
                          className="w-full h-auto max-h-[360px] object-cover group-hover:scale-[1.01] transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-2 right-2 p-1.5 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <Maximize2 className="w-3 h-3" />
                        </div>
                      </div>
                    )}

                    {/* Google Drive Status Bar if synced */}
                    {post.driveWebViewLink && (
                      <div className="px-2.5 py-1 bg-[#f7f9f7] border-t border-[#e2ece2] flex items-center justify-between text-[10px] text-[#52605d]">
                        <span className="flex items-center gap-1 font-semibold text-[#2d6a4f]">
                          <UploadCloud className="w-2.5 h-2.5 text-emerald-600" />
                          <span>Shared Drive</span>
                        </span>
                        <a
                          href={post.driveWebViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#1877f2] hover:underline flex items-center gap-0.5"
                        >
                          <span>Drive Link</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Reaction Counters Summary */}
                {totalReactionsCount > 0 && (
                  <div className="mt-2.5 pt-2 flex items-center justify-between text-[10.5px] text-[#52605d] border-t border-[#f0f4f0]">
                    <div className="flex items-center gap-1">
                      <div className="flex items-center -space-x-1">
                        {activeReactions.map((r) => (
                          <span
                            key={r.type}
                            className="w-3.5 h-3.5 rounded-full bg-white shadow-2xs flex items-center justify-center text-[9px]"
                          >
                            {r.emoji}
                          </span>
                        ))}
                      </div>
                      <span className="font-bold text-[#1b4332] text-[10.5px]">{totalReactionsCount}</span>
                    </div>

                    <span className="text-[10px] text-[#8a9695]">
                      {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
                    </span>
                  </div>
                )}

                {/* Interactive Action Bar (Like/Reactions, Comment, Share) */}
                <div className="mt-2 pt-1.5 border-t border-[#f0f4f0] flex items-center justify-between gap-1 relative">
                  {/* Floating 5-Reaction Picker */}
                  <div
                    className="relative flex-1"
                    onMouseEnter={() => {
                      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                      setHoveredPostId(post.id);
                    }}
                    onMouseLeave={() => {
                      hoverTimeoutRef.current = setTimeout(() => setHoveredPostId(null), 350);
                    }}
                  >
                    <AnimatePresence>
                      {hoveredPostId === post.id && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.85 }}
                          animate={{ opacity: 1, y: -40, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.85 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-0 z-30 bg-white border border-[#e2ece2] rounded-full p-0.5 sm:p-1 shadow-lg flex items-center gap-0.5"
                        >
                          {(['like', 'heart', 'care', 'sad', 'angry'] as ReactionType[]).map((rKey) => {
                            const conf = REACTION_CONFIG[rKey];
                            return (
                              <button
                                key={rKey}
                                type="button"
                                onClick={() => handleReactionClick(post.id, rKey)}
                                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full hover:scale-125 transition-transform flex items-center justify-center text-base cursor-pointer hover:bg-[#f0f7f1]"
                                title={conf.label}
                              >
                                {conf.emoji}
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      type="button"
                      onClick={() => handleQuickReaction(post.id)}
                      className={`w-full py-1 px-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        currentReactionData
                          ? `${currentReactionData.activeColor} bg-[#f7f9f7]`
                          : 'text-[#52605d] hover:bg-[#f7f9f7] hover:text-[#1b4332]'
                      }`}
                    >
                      {currentReactionData ? (
                        <>
                          <span className="text-xs">{currentReactionData.emoji}</span>
                          <span className="whitespace-nowrap">{currentReactionData.label}</span>
                        </>
                      ) : (
                        <>
                          <ThumbsUp className="w-3 h-3" />
                          <span className="whitespace-nowrap">Like</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Comment Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById(`comment-input-${post.id}`);
                      input?.focus();
                    }}
                    className="flex-1 py-1 px-1.5 rounded-lg text-[10px] sm:text-xs font-bold text-[#52605d] hover:bg-[#f7f9f7] hover:text-[#1b4332] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <MessageCircle className="w-3 h-3" />
                    <span className="whitespace-nowrap">Comment</span>
                  </button>

                  {/* Share Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: post.title,
                          text: post.content,
                          url: window.location.href,
                        }).catch(() => {});
                      } else {
                        navigator.clipboard?.writeText(window.location.href);
                        setShareToast('Link copied!');
                        setTimeout(() => setShareToast(null), 2000);
                      }
                    }}
                    className="flex-1 py-1 px-1.5 rounded-lg text-[10px] sm:text-xs font-bold text-[#52605d] hover:bg-[#f7f9f7] hover:text-[#1b4332] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Share2 className="w-3 h-3" />
                    <span className="whitespace-nowrap">Share</span>
                  </button>
                </div>

                {/* Comments Section */}
                <div className="mt-2.5 pt-2 border-t border-[#f0f4f0] space-y-2">
                  {/* Existing Comments */}
                  {comments.map((comm) => (
                    <div key={comm.id} className="space-y-1.5 text-xs">
                      <div className="flex items-start gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-[#e8f2e9] border border-[#d8e6d9] overflow-hidden flex items-center justify-center shrink-0 mt-0.5">
                          {comm.authorAvatar ? (
                            <img
                              src={comm.authorAvatar}
                              alt={comm.authorName}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <User className="w-3 h-3 text-[#2d6a4f]" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="bg-[#f7f9f7] rounded-lg sm:rounded-xl p-2 border border-[#e2ece2]">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-extrabold text-[#1b4332] text-[10.5px]">
                                {comm.authorName}
                              </span>
                              <span className="text-[9px] text-[#8a9695]">{comm.createdAt}</span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-[#2d3a3a] leading-tight">
                              {comm.content}
                            </p>
                          </div>

                          {/* Reply Toggle */}
                          <div className="flex items-center gap-2 mt-0.5 ml-1 text-[10px]">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveReplyState({
                                  postId: post.id,
                                  commentId: comm.id,
                                  authorName: comm.authorName,
                                });
                              }}
                              className="font-bold text-[#2d6a4f] hover:underline cursor-pointer flex items-center gap-0.5"
                            >
                              <CornerDownRight className="w-2.5 h-2.5" />
                              <span>Reply</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Nested Threaded Replies */}
                      {comm.replies && comm.replies.length > 0 && (
                        <div className="ml-6 pl-2.5 border-l-2 border-[#e2ece2] space-y-1.5 mt-1.5">
                          {comm.replies.map((reply) => (
                            <div key={reply.id} className="flex items-start gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-[#e8f2e9] border border-[#d8e6d9] overflow-hidden flex items-center justify-center shrink-0 mt-0.5">
                                {reply.authorAvatar ? (
                                  <img
                                    src={reply.authorAvatar}
                                    alt={reply.authorName}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <User className="w-2.5 h-2.5 text-[#2d6a4f]" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0 bg-[#fbfdfb] rounded-lg p-1.5 border border-[#e2ece2]">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-extrabold text-[#1b4332] text-[10px]">
                                    {reply.authorName}
                                  </span>
                                  <span className="text-[8.5px] text-[#8a9695]">{reply.createdAt}</span>
                                </div>
                                <p className="mt-0.5 text-[10.5px] text-[#2d3a3a] leading-tight">
                                  {reply.replyToUserName && (
                                    <span className="font-semibold text-[#2d6a4f] mr-1">
                                      @{reply.replyToUserName}
                                    </span>
                                  )}
                                  {reply.content}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Inline Reply Input */}
                      {activeReplyState?.commentId === comm.id && (
                        <div className="ml-6 pl-2.5 border-l-2 border-[#2d6a4f] flex items-center gap-1 mt-1.5">
                          <input
                            type="text"
                            value={replyInputs[comm.id] || ''}
                            onChange={(e) =>
                              setReplyInputs((prev) => ({ ...prev, [comm.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddReply(post.id, comm.id);
                            }}
                            placeholder={`Reply to ${comm.authorName}...`}
                            className="flex-1 px-2.5 py-1 rounded-md bg-[#f7f9f7] border border-[#e2ece2] text-[10.5px] text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleAddReply(post.id, comm.id)}
                            className="px-2 py-1 rounded-md bg-[#1b4332] text-white hover:bg-[#2d6a4f] text-[10px] font-bold cursor-pointer"
                          >
                            <Send className="w-2.5 h-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveReplyState(null)}
                            className="p-1 rounded-md text-[#8a9695] hover:bg-[#f7f9f7] cursor-pointer"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add New Comment Input */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <div className="w-6 h-6 rounded-full bg-[#e8f2e9] border border-[#d8e6d9] overflow-hidden flex items-center justify-center shrink-0">
                      {currentUser?.avatar ? (
                        <img
                          src={currentUser.avatar}
                          alt={currentUser.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User className="w-3 h-3 text-[#2d6a4f]" />
                      )}
                    </div>

                    <div className="flex-1 relative">
                      <input
                        id={`comment-input-${post.id}`}
                        type="text"
                        value={commentInputs[post.id] || ''}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddComment(post.id);
                        }}
                        placeholder="Write a comment..."
                        className="w-full pl-2.5 pr-7 py-1 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] text-[10.5px] sm:text-xs text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddComment(post.id)}
                        disabled={!commentInputs[post.id]?.trim()}
                        className="absolute right-1 top-1 p-0.5 rounded text-[#2d6a4f] hover:bg-[#e8f2e9] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CREATE POST MODAL */}
      {isCreateOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-[#e2ece2] overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-3.5 sm:p-4 border-b border-[#e2ece2] flex items-center justify-between bg-[#fafcfa]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#e8f2e9] text-[#1b4332] flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-[#1b4332]">Create News Feed Post</h3>
                    <p className="text-[10.5px] text-[#52605d]">Share photos, videos and updates with all members</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1 rounded-lg text-[#8a9695] hover:bg-[#e2ece2] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleCreatePost} className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs">
                {/* Author Details Pill */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#e8f2e9] overflow-hidden">
                    {currentUser?.avatar ? (
                      <img src={currentUser.avatar} alt="User" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 m-2 text-[#2d6a4f]" />
                    )}
                  </div>
                  <div>
                    <div className="font-extrabold text-[#1b4332] text-xs">{currentUser?.name}</div>
                    <div className="text-[10px] text-[#2d6a4f] font-semibold">Posting to Public News Feed</div>
                  </div>
                </div>

                {/* Interactive Custom Category Dropdown */}
                <div className="relative">
                  <label className="block text-[11px] font-bold text-[#1b4332] mb-1">Category</label>
                  <button
                    type="button"
                    onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
                    className={`w-full px-3 py-2 rounded-xl bg-[#f7f9f7] border text-xs font-semibold text-[#1b4332] flex items-center justify-between transition-all cursor-pointer ${
                      isCategoryDropdownOpen
                        ? 'border-[#2d6a4f] ring-2 ring-[#2d6a4f]/10 bg-white'
                        : 'border-[#e2ece2] hover:border-[#c8ddc9]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {(() => {
                        const currentOpt = CATEGORY_OPTIONS.find((c) => c.value === newCategory) || CATEGORY_OPTIONS[0];
                        const IconComp = currentOpt.icon;
                        return (
                          <>
                            <IconComp className="w-3.5 h-3.5 text-[#2d6a4f]" />
                            <span>{currentOpt.label}</span>
                          </>
                        );
                      })()}
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-[#52605d] transition-transform duration-200 ${
                        isCategoryDropdownOpen ? 'rotate-180 text-[#2d6a4f]' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {isCategoryDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 right-0 top-full mt-1 z-30 bg-white rounded-xl border border-[#d8e6d9] shadow-lg py-1 max-h-56 overflow-y-auto"
                      >
                        {CATEGORY_OPTIONS.map((cat) => {
                          const isSelected = newCategory === cat.value;
                          const Icon = cat.icon;
                          return (
                            <button
                              key={cat.value}
                              type="button"
                              onClick={() => {
                                setNewCategory(cat.value);
                                setIsCategoryDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-[#e8f2e9] text-[#1b4332] font-bold'
                                  : 'text-[#2d3a3a] hover:bg-[#f7f9f7]'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                    isSelected
                                      ? 'bg-[#1b4332] text-white'
                                      : 'bg-[#f0f4f0] text-[#2d6a4f]'
                                  }`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[11.5px] font-extrabold truncate">{cat.label}</div>
                                  <div className="text-[10px] text-[#52605d] truncate leading-none mt-0.5">
                                    {cat.description}
                                  </div>
                                </div>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Title (Optional) */}
                <div>
                  <label className="block text-[11px] font-bold text-[#1b4332] mb-1">Title / Headline (Optional)</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Weekend Ride Highlights / New Gear Review"
                    className="w-full px-3 py-2 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-[11px] font-bold text-[#1b4332] mb-1">Story / Caption</label>
                  <textarea
                    rows={4}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Write your story, ride recap, or thoughts..."
                    className="w-full px-3 py-2 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] resize-none"
                    required={!mediaFile}
                  />
                </div>

                {/* Media Uploader (Google Shared Drive Integrated) */}
                <div>
                  <label className="block text-[11px] font-bold text-[#1b4332] mb-1 flex items-center justify-between">
                    <span>Photo or Video Attachment</span>
                    <span className="text-[10px] text-[#2d6a4f] font-normal flex items-center gap-1">
                      <UploadCloud className="w-3 h-3" />
                      <span>Google Shared Drive</span>
                    </span>
                  </label>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleMediaSelected}
                    className="hidden"
                  />

                  {!mediaFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-[#c8ddc9] hover:border-[#2d6a4f] rounded-xl p-4 text-center bg-[#f7f9f7] hover:bg-[#eef5ef] transition-colors cursor-pointer"
                    >
                      <div className="flex justify-center items-center gap-2 text-[#2d6a4f] mb-1">
                        <ImageIcon className="w-5 h-5 text-emerald-600" />
                        <VideoIcon className="w-5 h-5 text-indigo-600" />
                      </div>
                      <p className="text-[11.5px] font-bold text-[#1b4332]">
                        Click to select Photo or Video
                      </p>
                      <p className="text-[10px] text-[#8a9695] mt-0.5">
                        Supports JPG, PNG, WEBP, MP4, MOV. Uploaded directly to Shared Drive.
                      </p>
                    </div>
                  ) : (
                    <div className="relative rounded-xl border border-[#e2ece2] bg-[#f7f9f7] p-2.5 flex items-center gap-3">
                      {mediaFile.type === 'video' ? (
                        <div className="w-14 h-14 bg-black rounded-lg flex items-center justify-center text-white shrink-0">
                          <Play className="w-5 h-5 text-[#74c69d]" />
                        </div>
                      ) : (
                        <img
                          src={mediaFile.dataUrl}
                          alt="Selected"
                          className="w-14 h-14 object-cover rounded-lg shrink-0 border border-[#e2ece2]"
                        />
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#1b4332] truncate">{mediaFile.name}</p>
                        <p className="text-[10.5px] text-[#52605d]">
                          {mediaFile.type === 'video' ? 'Video clip' : 'Photo'}
                        </p>
                        {uploadStatusMsg && (
                          <p className="text-[10px] font-semibold text-emerald-700 mt-0.5 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{uploadStatusMsg}</span>
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setMediaFile(null);
                          setUploadStatusMsg(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#f0f4f0]">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#52605d] hover:bg-[#f0f4f0] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploadingMedia || (!newContent.trim() && !mediaFile)}
                    className="px-5 py-2 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-extrabold shadow-xs transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5 text-[#74c69d]" />
                    <span>Publish Post</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </ModalPortal>
      )}

      {/* EDIT POST MODAL */}
      {editingPost && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-[#e2ece2] overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-3.5 sm:p-4 border-b border-[#e2ece2] flex items-center justify-between bg-[#fafcfa]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#e8f2e9] text-[#1b4332] flex items-center justify-center">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-[#1b4332]">Edit News Feed Post</h3>
                    <p className="text-[10.5px] text-[#52605d]">Update post content, category or media</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingPost(null)}
                  className="p-1 rounded-lg text-[#8a9695] hover:bg-[#e2ece2] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleUpdatePost} className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs">
                {/* Author Details Pill */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#e8f2e9] overflow-hidden">
                    {editingPost.authorAvatar ? (
                      <img src={editingPost.authorAvatar} alt="User" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 m-2 text-[#2d6a4f]" />
                    )}
                  </div>
                  <div>
                    <div className="font-extrabold text-[#1b4332] text-xs">{editingPost.authorName}</div>
                    <div className="text-[10px] text-[#2d6a4f] font-semibold">Editing Published Post</div>
                  </div>
                </div>

                {/* Interactive Custom Category Dropdown */}
                <div className="relative">
                  <label className="block text-[11px] font-bold text-[#1b4332] mb-1">Category</label>
                  <button
                    type="button"
                    onClick={() => setIsEditCategoryDropdownOpen((prev) => !prev)}
                    className={`w-full px-3 py-2 rounded-xl bg-[#f7f9f7] border text-xs font-semibold text-[#1b4332] flex items-center justify-between transition-all cursor-pointer ${
                      isEditCategoryDropdownOpen
                        ? 'border-[#2d6a4f] ring-2 ring-[#2d6a4f]/10 bg-white'
                        : 'border-[#e2ece2] hover:border-[#c8ddc9]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {(() => {
                        const currentOpt = CATEGORY_OPTIONS.find((c) => c.value === editCategory) || CATEGORY_OPTIONS[0];
                        const IconComp = currentOpt.icon;
                        return (
                          <>
                            <IconComp className="w-3.5 h-3.5 text-[#2d6a4f]" />
                            <span>{currentOpt.label}</span>
                          </>
                        );
                      })()}
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-[#52605d] transition-transform duration-200 ${
                        isEditCategoryDropdownOpen ? 'rotate-180 text-[#2d6a4f]' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {isEditCategoryDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 right-0 top-full mt-1 z-30 bg-white rounded-xl border border-[#d8e6d9] shadow-lg py-1 max-h-56 overflow-y-auto"
                      >
                        {CATEGORY_OPTIONS.map((cat) => {
                          const isSelected = editCategory === cat.value;
                          const Icon = cat.icon;
                          return (
                            <button
                              key={cat.value}
                              type="button"
                              onClick={() => {
                                setEditCategory(cat.value);
                                setIsEditCategoryDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-[#e8f2e9] text-[#1b4332] font-bold'
                                  : 'text-[#2d3a3a] hover:bg-[#f7f9f7]'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                    isSelected
                                      ? 'bg-[#1b4332] text-white'
                                      : 'bg-[#f0f4f0] text-[#2d6a4f]'
                                  }`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[11.5px] font-extrabold truncate">{cat.label}</div>
                                  <div className="text-[10px] text-[#52605d] truncate leading-none mt-0.5">
                                    {cat.description}
                                  </div>
                                </div>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-[11px] font-bold text-[#1b4332] mb-1">Title (Optional)</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="E.g., Sunday Dawn Ride Highlights"
                    className="w-full px-3 py-2 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-[11px] font-bold text-[#1b4332] mb-1">Content</label>
                  <textarea
                    rows={4}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Share ride details, equipment updates, or route highlights..."
                    className="w-full px-3 py-2 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] resize-none"
                  />
                </div>

                {/* Media Attachment */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-[#1b4332]">Photo or Video Attachment</label>
                    <span className="text-[10px] text-[#2d6a4f] font-semibold flex items-center gap-1">
                      <UploadCloud className="w-3 h-3 text-emerald-600" />
                      <span>Google Shared Drive</span>
                    </span>
                  </div>

                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleEditMediaSelected}
                    className="hidden"
                  />

                  {!editMediaFile ? (
                    <div
                      onClick={() => editFileInputRef.current?.click()}
                      className="border-2 border-dashed border-[#c8ddc9] hover:border-[#2d6a4f] rounded-xl p-4 text-center bg-[#f7f9f7] hover:bg-[#eef5ef] transition-colors cursor-pointer"
                    >
                      <div className="flex justify-center items-center gap-2 text-[#2d6a4f] mb-1">
                        <ImageIcon className="w-5 h-5 text-emerald-600" />
                        <VideoIcon className="w-5 h-5 text-indigo-600" />
                      </div>
                      <p className="text-[11.5px] font-bold text-[#1b4332]">
                        Click to select Photo or Video
                      </p>
                      <p className="text-[10px] text-[#8a9695] mt-0.5">
                        Supports JPG, PNG, WEBP, MP4, MOV. Uploaded directly to Shared Drive.
                      </p>
                    </div>
                  ) : (
                    <div className="relative rounded-xl border border-[#e2ece2] bg-[#f7f9f7] p-2.5 flex items-center gap-3">
                      {editMediaFile.type === 'video' ? (
                        <div className="w-14 h-14 bg-black rounded-lg flex items-center justify-center text-white shrink-0">
                          <Play className="w-5 h-5 text-[#74c69d]" />
                        </div>
                      ) : (
                        <img
                          src={editMediaFile.dataUrl}
                          alt="Selected"
                          className="w-14 h-14 object-cover rounded-lg shrink-0 border border-[#e2ece2]"
                        />
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#1b4332] truncate">{editMediaFile.name || 'Current media attachment'}</p>
                        <p className="text-[10.5px] text-[#52605d]">
                          {editMediaFile.type === 'video' ? 'Video clip' : 'Photo'}
                        </p>
                        {editUploadStatusMsg && (
                          <p className="text-[10px] font-semibold text-emerald-700 mt-0.5 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{editUploadStatusMsg}</span>
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setEditMediaFile(null);
                          setEditUploadStatusMsg(null);
                          if (editFileInputRef.current) editFileInputRef.current.value = '';
                        }}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Remove media"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#f0f4f0]">
                  <button
                    type="button"
                    onClick={() => setEditingPost(null)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#52605d] hover:bg-[#f0f4f0] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploadingEditMedia || (!editContent.trim() && !editMediaFile)}
                    className="px-5 py-2 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-extrabold shadow-xs transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 text-[#74c69d]" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </ModalPortal>
      )}

      {/* INTERACTIVE DELETE CONFIRMATION MODAL */}
      {postToDelete && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-[#e2ece2] overflow-hidden flex flex-col p-4 sm:p-5"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-extrabold text-[#1b4332]">Delete Post?</h3>
                  <p className="text-xs text-[#52605d] mt-1 leading-relaxed">
                    Are you sure you want to delete this post? This action will remove the post, attachments, and comments permanently.
                  </p>
                  {postToDelete.title && (
                    <div className="mt-2.5 p-2 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] text-[11px] text-[#2d3a3a] truncate font-medium">
                      "{postToDelete.title}"
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[#f0f4f0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPostToDelete(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#52605d] hover:bg-[#f0f4f0] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeletePost}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Post</span>
                </button>
              </div>
            </motion.div>
          </div>
        </ModalPortal>
      )}

      {/* LIGHTBOX MODAL */}
      {lightboxMedia && (
        <ModalPortal>
          <div
            onClick={() => setLightboxMedia(null)}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
          >
            <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
              <img
                src={lightboxMedia.url}
                alt="Full preview"
                className="max-h-[80vh] max-w-full rounded-lg object-contain"
                referrerPolicy="no-referrer"
              />
              <button
                type="button"
                onClick={() => setLightboxMedia(null)}
                className="absolute -top-10 right-0 text-white hover:text-rose-400 p-2 cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
