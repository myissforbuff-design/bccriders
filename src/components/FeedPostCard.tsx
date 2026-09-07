import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock,
  Trash2,
  Maximize2,
  Smile,
  MessageSquare,
  Send,
  CornerDownRight,
  Eye,
  Sparkles,
} from 'lucide-react';
import { WhiteLabelVideoPlayer } from './WhiteLabelVideoPlayer';
import {
  CommunityPost,
  SocialReactionType,
  PostComment,
  CommentReply,
  ReactionRecord,
} from '../types';
import { store } from '../lib/db';

export interface ReactionConfig {
  type: SocialReactionType;
  label: string;
  emoji: string;
  activeColor: string;
  activeBg: string;
  activeBorder: string;
  badgeBg: string;
}

export const REACTIONS: ReactionConfig[] = [
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

export function formatRelativeTime(dateString: string): string {
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

export function computePostViews(post: CommunityPost): number {
  if (post.viewsCount && post.viewsCount > 0) return post.viewsCount;
  // Believable calculated view count derived from reactions and comments
  const likes = post.likesCount || 0;
  const comments = post.comments?.length || post.commentsCount || 0;
  const charSeed = post.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return likes * 14 + comments * 18 + ((charSeed % 73) + 19);
}

interface FeedPostCardProps {
  post: CommunityPost;
  currentUser: any;
  isAdmin: boolean;
  isAlgorithmPick?: boolean;
  onOpenDeleteModal: (post: CommunityPost) => void;
  onOpenReactionsModal: (data: {
    title: string;
    reactions?: CommunityPost['reactions'];
    reactionsDetails?: ReactionRecord[];
  }) => void;
  onPhotoClick: (url: string) => void;
}

export const FeedPostCard: React.FC<FeedPostCardProps> = ({
  post,
  currentUser,
  isAdmin,
  isAlgorithmPick = false,
  onOpenDeleteModal,
  onOpenReactionsModal,
  onPhotoClick,
}) => {
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [activeReactionPickerKey, setActiveReactionPickerKey] = useState<string | null>(null);
  const reactionPickerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Replying state
  const [activeReplyCommentId, setActiveReplyCommentId] = useState<string | null>(null);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [replyMentions, setReplyMentions] = useState<Record<string, string>>({});

  const isAuthor = currentUser?.id === post.authorId;
  const canDelete = isAuthor || isAdmin;

  // Reactions tally
  const reactionCounts = {
    like: post.reactions?.like?.length || 0,
    heart: post.reactions?.heart?.length || 0,
    care: post.reactions?.care?.length || 0,
    blessed: post.reactions?.blessed?.length || 0,
  };
  const totalReactions = Object.values(reactionCounts).reduce((a, b) => a + b, 0);
  const activeReactionTypes = REACTIONS.filter((r) => reactionCounts[r.type] > 0);

  const userReaction = post.reactionsDetails?.find((r) => r.userId === currentUser?.id);
  const activeReactionConfig = userReaction
    ? REACTIONS.find((r) => r.type === userReaction.type)
    : null;

  const commentsList = post.comments || [];
  const commentsCount = commentsList.length || post.commentsCount || 0;
  const views = computePostViews(post);

  // Reaction picker timer helpers
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

  // Post Reactions
  const handleReact = (reactionType: SocialReactionType) => {
    if (!currentUser) return;
    setActiveReactionPickerKey(null);
    store.reactToPost(
      post.id,
      currentUser.id,
      currentUser.name || currentUser.username || 'Member',
      reactionType,
      currentUser.role || 'Member',
      currentUser.avatar || ''
    );
  };

  const handleQuickReact = () => {
    if (!currentUser) return;
    if (userReaction) {
      handleReact(userReaction.type);
    } else {
      handleReact('like');
    }
  };

  // Comments Handling
  const handleAddComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser || !commentInput.trim()) return;

    store.addCommentToPost(post.id, {
      authorId: currentUser.id,
      authorName: currentUser.name || currentUser.username || 'Member',
      authorAvatar: currentUser.avatar || '',
      authorRole: currentUser.role || 'Member',
      content: commentInput.trim(),
    });

    setCommentInput('');
    setIsCommentsOpen(true);
  };

  const handleDeleteComment = (commentId: string) => {
    store.deleteCommentFromPost(post.id, commentId);
  };

  // Comment React
  const handleReactToComment = (commentId: string, reactionType: SocialReactionType) => {
    if (!currentUser) return;
    setActiveReactionPickerKey(null);
    store.reactToComment(
      post.id,
      commentId,
      currentUser.id,
      currentUser.name || currentUser.username || 'Member',
      reactionType,
      currentUser.role || 'Member',
      currentUser.avatar || ''
    );
  };

  const handleQuickReactToComment = (comment: PostComment) => {
    if (!currentUser) return;
    const existing = comment.reactionsDetails?.find((r) => r.userId === currentUser.id);
    if (existing) {
      handleReactToComment(comment.id, existing.type);
    } else {
      handleReactToComment(comment.id, 'like');
    }
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

  const handleAddReply = (commentId: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser) return;
    const text = (replyInputs[commentId] || '').trim();
    if (!text) return;

    const mention = replyMentions[commentId];

    store.addReplyToComment(post.id, commentId, {
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

  const handleDeleteReply = (commentId: string, replyId: string) => {
    store.deleteReplyFromComment(post.id, commentId, replyId);
  };

  // Reply React
  const handleReactToReply = (commentId: string, replyId: string, reactionType: SocialReactionType) => {
    if (!currentUser) return;
    setActiveReactionPickerKey(null);
    store.reactToReply(
      post.id,
      commentId,
      replyId,
      currentUser.id,
      currentUser.name || currentUser.username || 'Member',
      reactionType,
      currentUser.role || 'Member',
      currentUser.avatar || ''
    );
  };

  const handleQuickReactToReply = (commentId: string, reply: CommentReply) => {
    if (!currentUser) return;
    const existing = reply.reactionsDetails?.find((r) => r.userId === currentUser.id);
    if (existing) {
      handleReactToReply(commentId, reply.id, existing.type);
    } else {
      handleReactToReply(commentId, reply.id, 'like');
    }
  };

  // Media photos array
  const photoList =
    post.photos && post.photos.length > 0
      ? post.photos
      : (post.media || [])
          .filter((m) => m.type === 'photo' || (m.type as any) === 'image')
          .map((m) => m.url);

  return (
    <div
      style={{ contentVisibility: 'auto', containIntrinsicSize: '480px' }}
      className="will-change-contents"
    >
      <motion.article
        id={`post-card-${post.id}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 border transition-all ${
          isAlgorithmPick
            ? 'border-[#74c69d] shadow-sm bg-gradient-to-b from-[#f7fbf8] to-white'
            : 'border-[#e2ece2] shadow-xs hover:border-[#b7e4c7]'
        } space-y-2.5 sm:space-y-3`}
      >
        {/* ALGORITHM PICK BADGE */}
        {isAlgorithmPick && (
          <div className="flex items-center justify-between pb-2 border-b border-[#e2ece2]">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#d8f3dc] text-[#1b4332] text-[10px] sm:text-xs font-bold shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-[#2d6a4f] animate-pulse" />
              <span>Algorithm Pick • Featured for You</span>
            </div>
            <span className="text-[10px] text-[#52605d] font-medium hidden sm:inline">
              Random discovery feed
            </span>
          </div>
        )}

        {/* POST HEADER */}
        <div className="flex items-start justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* Author Avatar */}
            <div
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full ${
                post.authorAvatar?.includes('bcc-logo.png') ? 'bg-white' : 'bg-[#d8f3dc]'
              } border border-[#b7e4c7] flex items-center justify-center font-heading font-black text-[#1b4332] text-xs shrink-0 shadow-xs overflow-hidden`}
            >
              {post.authorAvatar ? (
                <img
                  src={post.authorAvatar}
                  alt={post.authorName}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  className={`w-full h-full ${
                    post.authorAvatar.includes('bcc-logo.png')
                      ? 'object-contain p-0.5 bg-white'
                      : 'object-cover'
                  }`}
                />
              ) : (
                post.authorName.charAt(0).toUpperCase()
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="font-heading font-black text-xs sm:text-sm text-[#1b4332] truncate">
                  {post.authorName}
                </h4>
                {post.authorRole && (
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-[#d8f3dc] text-[#1b4332] border border-[#b7e4c7] shrink-0">
                    {post.authorRole}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-[#52605d] mt-0.5 flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#52605d]" />
                  <span>{formatRelativeTime(post.createdAt)}</span>
                </span>
                <span className="text-[#a0aba0]">•</span>
                <span className="flex items-center gap-1 font-medium text-[#2d6a4f]">
                  <Eye className="w-3 h-3" />
                  <span>{views} views</span>
                </span>
              </div>
            </div>
          </div>

          {/* Delete Action */}
          {canDelete && (
            <button
              type="button"
              id={`delete-post-btn-${post.id}`}
              onClick={() => onOpenDeleteModal(post)}
              className="p-1.5 rounded-lg text-[#52605d] hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
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

        {/* POST MEDIA: VIDEO */}
        {post.videoUrl && (
          <div className="w-full flex justify-center">
            <WhiteLabelVideoPlayer src={post.videoUrl} title={post.title} />
          </div>
        )}

        {/* POST MEDIA: PHOTOS */}
        {photoList.length > 0 && (
          <div
            className={`grid gap-1.5 rounded-xl sm:rounded-2xl overflow-hidden ${
              photoList.length === 1
                ? 'grid-cols-1'
                : photoList.length === 2
                ? 'grid-cols-2'
                : photoList.length === 3
                ? 'grid-cols-3'
                : 'grid-cols-2 sm:grid-cols-4'
            }`}
          >
            {photoList.map((photoUrl, idx) => (
              <div
                key={idx}
                onClick={() => onPhotoClick(photoUrl)}
                className="relative aspect-video sm:aspect-square bg-[#f0f4f0] cursor-pointer group overflow-hidden"
              >
                <img
                  src={photoUrl}
                  alt={`Post attachment ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Maximize2 className="w-4 h-4 text-white drop-shadow-md" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* REACTION & COMMENTS SUMMARY ROW */}
        {(totalReactions > 0 || commentsCount > 0) && (
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-[#52605d] pt-1.5 border-t border-[#f0f4f0]">
            {/* Reactions Tally */}
            {totalReactions > 0 ? (
              <button
                type="button"
                onClick={() =>
                  onOpenReactionsModal({
                    title: 'Post Reactions',
                    reactions: post.reactions,
                    reactionsDetails: post.reactionsDetails,
                  })
                }
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
                onClick={() => setIsCommentsOpen(!isCommentsOpen)}
                className="hover:underline cursor-pointer font-medium"
              >
                {commentsCount} {commentsCount === 1 ? 'comment' : 'comments'}
              </button>
            )}
          </div>
        )}

        {/* INTERACTIVE ACTIONS BAR */}
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
                    onClick={() => handleReact(rec.type)}
                    className="p-1 hover:bg-[#f7f9f7] rounded-full text-base sm:text-lg transition-transform hover:scale-125 cursor-pointer active:scale-95"
                    title={rec.label}
                  >
                    {rec.emoji}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick React Action Button */}
          <div
            className="relative flex-1 sm:flex-initial"
            onMouseEnter={() => handleReactionButtonMouseEnter(`post_${post.id}`)}
            onMouseLeave={handleReactionButtonMouseLeave}
          >
            <button
              type="button"
              id={`react-btn-${post.id}`}
              onClick={handleQuickReact}
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
            onClick={() => setIsCommentsOpen(!isCommentsOpen)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f7f9f7] hover:bg-[#e8f2e9] text-[#52605d] hover:text-[#1b4332] text-xs font-bold transition-all cursor-pointer border border-[#e2ece2]"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#2d6a4f]" />
            <span>Comment</span>
            {commentsCount > 0 && <span>({commentsCount})</span>}
          </button>
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
                          <div
                            className={`w-7 h-7 rounded-full ${
                              comm.authorAvatar?.includes('bcc-logo.png')
                                ? 'bg-white'
                                : 'bg-[#d8f3dc]'
                            } border border-[#b7e4c7] flex items-center justify-center font-bold text-[#1b4332] text-[10px] shrink-0 overflow-hidden`}
                          >
                            {comm.authorAvatar ? (
                              <img
                                src={comm.authorAvatar}
                                alt={comm.authorName}
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                className={`w-full h-full ${
                                  comm.authorAvatar.includes('bcc-logo.png')
                                    ? 'object-contain p-0.5 bg-white'
                                    : 'object-cover'
                                }`}
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
                                    onClick={() => handleDeleteComment(comm.id)}
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
                                  activeReactionPickerKey === `comment_${comm.id}` ? 'z-50' : 'z-10'
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
                                          onClick={() => handleReactToComment(comm.id, rec.type)}
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
                                  onClick={() => handleQuickReactToComment(comm)}
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
                                  onClick={() =>
                                    onOpenReactionsModal({
                                      title: 'Comment Reactions',
                                      reactions: comm.reactions,
                                      reactionsDetails: comm.reactionsDetails,
                                    })
                                  }
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

                              {/* Reply Trigger */}
                              <button
                                type="button"
                                onClick={() => handleStartReply(comm.id, comm.authorName)}
                                className="font-bold text-[#2d6a4f] hover:text-[#1b4332] hover:underline cursor-pointer flex items-center gap-1"
                              >
                                <CornerDownRight className="w-3 h-3" />
                                <span>Reply</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* NESTED REPLIES */}
                        {repliesList.length > 0 && (
                          <div className="pl-6 pt-1 space-y-2 border-l-2 border-[#b7e4c7]/50 ml-3">
                            {repliesList.map((rep) => {
                              const isReplyAuthor = rep.authorId === currentUser?.id;
                              const canDeleteReply = isReplyAuthor || isAdmin;
                              const userReplyReaction = rep.reactionsDetails?.find(
                                (r) => r.userId === currentUser?.id
                              )?.type;
                              const userReplyReactionConfig = userReplyReaction
                                ? REACTIONS.find((r) => r.type === userReplyReaction)
                                : null;
                              const replyReactionsCount = rep.reactionsDetails?.length || 0;
                              const replyDistinctEmojis = Array.from(
                                new Set(
                                  (rep.reactionsDetails || [])
                                    .map((r) => REACTIONS.find((rc) => rc.type === r.type)?.emoji)
                                    .filter(Boolean)
                                )
                              );

                              return (
                                <div
                                  key={rep.id}
                                  className={`p-2.5 rounded-xl bg-white border border-[#e2ece2] text-xs space-y-1.5 relative ${
                                    activeReactionPickerKey === `reply_${rep.id}` ? 'z-30' : 'z-0'
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    <div
                                      className={`w-6 h-6 rounded-full ${
                                        rep.authorAvatar?.includes('bcc-logo.png')
                                          ? 'bg-white'
                                          : 'bg-[#d8f3dc]'
                                      } border border-[#b7e4c7] flex items-center justify-center font-bold text-[#1b4332] text-[9px] shrink-0 overflow-hidden`}
                                    >
                                      {rep.authorAvatar ? (
                                        <img
                                          src={rep.authorAvatar}
                                          alt={rep.authorName}
                                          referrerPolicy="no-referrer"
                                          loading="lazy"
                                          className={`w-full h-full ${
                                            rep.authorAvatar.includes('bcc-logo.png')
                                              ? 'object-contain p-0.5 bg-white'
                                              : 'object-cover'
                                          }`}
                                        />
                                      ) : (
                                        rep.authorName.charAt(0).toUpperCase()
                                      )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-heading font-black text-[#1b4332] text-[11px]">
                                            {rep.authorName}
                                          </span>
                                          {rep.authorRole && (
                                            <span className="text-[8px] px-1 py-0.2 rounded-md bg-[#f0f4f0] border border-[#e2ece2] text-[#52605d] font-semibold">
                                              {rep.authorRole}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="text-[9px] text-[#52605d]">
                                            {formatRelativeTime(rep.createdAt)}
                                          </span>
                                          {canDeleteReply && (
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteReply(comm.id, rep.id)}
                                              className="text-[#52605d] hover:text-rose-600 p-0.5 ml-1 transition-colors cursor-pointer"
                                              title="Delete reply"
                                            >
                                              <Trash2 className="w-2.5 h-2.5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>

                                      <p className="text-[#2d4036] mt-0.5 leading-relaxed text-[11px]">
                                        {rep.replyToUserName && (
                                          <span className="font-bold text-[#2d6a4f] mr-1">
                                            @{rep.replyToUserName}
                                          </span>
                                        )}
                                        {rep.content}
                                      </p>

                                      {/* Reply Action Row */}
                                      <div className="flex items-center gap-2 mt-1 text-[10px]">
                                        {/* Floating React Popover */}
                                        <div
                                          className={`relative ${
                                            activeReactionPickerKey === `reply_${rep.id}`
                                              ? 'z-50'
                                              : 'z-10'
                                          }`}
                                          onMouseEnter={() =>
                                            handleReactionButtonMouseEnter(`reply_${rep.id}`)
                                          }
                                          onMouseLeave={handleReactionButtonMouseLeave}
                                        >
                                          <AnimatePresence>
                                            {activeReactionPickerKey === `reply_${rep.id}` && (
                                              <motion.div
                                                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                                                transition={{ duration: 0.15 }}
                                                onMouseEnter={() =>
                                                  handleReactionButtonMouseEnter(`reply_${rep.id}`)
                                                }
                                                onMouseLeave={handleReactionButtonMouseLeave}
                                                className="absolute left-0 bottom-full mb-1 z-50 bg-white px-2 py-1 rounded-full shadow-2xl border border-[#e2ece2] flex items-center gap-1 whitespace-nowrap"
                                              >
                                                {REACTIONS.map((rec) => (
                                                  <button
                                                    key={rec.type}
                                                    type="button"
                                                    onClick={() =>
                                                      handleReactToReply(comm.id, rep.id, rec.type)
                                                    }
                                                    className="p-1 hover:bg-[#f7f9f7] rounded-full text-sm transition-transform hover:scale-125 cursor-pointer active:scale-95"
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
                                            onClick={() => handleQuickReactToReply(comm.id, rep)}
                                            className={`font-bold transition-colors cursor-pointer flex items-center gap-0.5 ${
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

                                        {replyReactionsCount > 0 && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              onOpenReactionsModal({
                                                title: 'Reply Reactions',
                                                reactions: rep.reactions,
                                                reactionsDetails: rep.reactionsDetails,
                                              })
                                            }
                                            className="flex items-center gap-0.5 px-1 py-0.2 rounded-full bg-[#f7f9f7] border border-[#e2ece2] text-[9px] font-bold text-[#1b4332]"
                                          >
                                            <span>{replyDistinctEmojis.join('')}</span>
                                            <span>{replyReactionsCount}</span>
                                          </button>
                                        )}

                                        <span className="text-[#c2d1c2]">•</span>

                                        <button
                                          type="button"
                                          onClick={() => handleStartReply(comm.id, rep.authorName)}
                                          className="font-bold text-[#2d6a4f] hover:text-[#1b4332] hover:underline cursor-pointer"
                                        >
                                          Reply
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Inline Reply Input for this comment */}
                        {activeReplyCommentId === comm.id && (
                          <div className="pl-6 pt-1">
                            <form
                              onSubmit={(e) => handleAddReply(comm.id, e)}
                              className="flex items-center gap-2"
                            >
                              <div className="flex-1 relative">
                                {replyMentions[comm.id] && (
                                  <div className="text-[10px] text-[#2d6a4f] font-semibold mb-1 flex items-center justify-between">
                                    <span>Replying to @{replyMentions[comm.id]}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleCancelReply(comm.id)}
                                      className="text-stone-400 hover:text-stone-700 underline text-[9px]"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
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
                                  placeholder={`Reply to ${comm.authorName}...`}
                                  className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#e2ece2] text-xs text-[#1b4332] placeholder:text-xs placeholder:text-[#52605d]/70 focus:outline-none focus:border-[#2d6a4f]"
                                />
                              </div>
                              <button
                                type="submit"
                                disabled={!replyInputs[comm.id]?.trim()}
                                className="p-1.5 rounded-lg bg-[#1b4332] hover:bg-[#2d6a4f] disabled:opacity-40 text-white transition-all cursor-pointer shrink-0"
                                title="Send reply"
                              >
                                <Send className="w-3 h-3 text-[#74c69d]" />
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Comment Input */}
              <form onSubmit={handleAddComment} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full ${
                    currentUser?.avatar?.includes('bcc-logo.png') ? 'bg-white' : 'bg-[#d8f3dc]'
                  } border border-[#b7e4c7] flex items-center justify-center font-bold text-[#1b4332] text-[10px] sm:text-xs shrink-0 overflow-hidden`}
                >
                  {currentUser?.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className={`w-full h-full ${
                        currentUser.avatar.includes('bcc-logo.png')
                          ? 'object-contain p-0.5 bg-white'
                          : 'object-cover'
                      }`}
                    />
                  ) : (
                    (currentUser?.name || 'U').charAt(0).toUpperCase()
                  )}
                </div>

                <input
                  type="text"
                  id={`comment-input-${post.id}`}
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] text-xs text-[#1b4332] placeholder:text-xs placeholder:text-[#52605d]/70 focus:outline-none focus:border-[#2d6a4f]"
                />

                <button
                  type="submit"
                  id={`send-comment-${post.id}`}
                  disabled={!commentInput.trim()}
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
    </div>
  );
};
