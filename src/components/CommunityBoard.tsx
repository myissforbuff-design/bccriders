import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { store } from '../lib/db';
import { CommunityPost, PaceLevel } from '../types';
import { CustomSelect } from './CustomSelect';
import {
  MessageSquare,
  Plus,
  ThumbsUp,
  Share2,
  MapPin,
  Clock,
  Bike,
  Filter,
  X,
  Send,
  UserCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const CommunityBoard: React.FC = () => {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>(() => store.getPosts());
  const [catFilter, setCatFilter] = useState<string>('All');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<CommunityPost['category']>('Group Ride Setup');
  const [paceLevel, setPaceLevel] = useState<PaceLevel>('Moderate 20-25mph');
  const [distanceMiles, setDistanceMiles] = useState(40);
  const [meetingPoint, setMeetingPoint] = useState('');
  const [meetingTime, setMeetingTime] = useState('');

  // Comment Drawer State
  const [activePostForComments, setActivePostForComments] = useState<CommunityPost | null>(null);
  const [commentText, setCommentText] = useState('');

  useModalDismiss(createModalOpen, () => setCreateModalOpen(false));
  useModalDismiss(!!activePostForComments, () => setActivePostForComments(null));
  const [commentsMap, setCommentsMap] = useState<Record<string, Array<{ authorName: string; text: string; time: string }>>>({
    post_201: [
      { authorName: 'Marcus Vance', text: 'Count me in! Bike is prepped.', time: '1 hour ago' },
      { authorName: 'David Chen', text: 'Will bring the GoPro for footage.', time: '30 mins ago' },
    ],
  });

  const refreshList = () => {
    setPosts([...store.getPosts()]);
  };

  const filteredPosts = posts.filter(
    (p) => catFilter === 'All' || p.category === catFilter
  );

  const handleLike = (postId: string) => {
    if (!currentUser) return;
    store.toggleLikePost(postId, currentUser.id);
    refreshList();
  };

  const handleCreatePostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    store.createPost({
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar,
      authorRole: currentUser.role,
      title,
      content,
      category,
      paceLevel: category === 'Group Ride Setup' ? paceLevel : undefined,
      distanceMiles: category === 'Group Ride Setup' ? distanceMiles : undefined,
      meetingPoint: category === 'Group Ride Setup' ? meetingPoint : undefined,
      meetingTime: category === 'Group Ride Setup' ? meetingTime : undefined,
    });

    setCreateModalOpen(false);
    setTitle('');
    setContent('');
    refreshList();
  };

  const handleAddComment = (postId: string) => {
    if (!commentText.trim() || !currentUser) return;

    const existing = commentsMap[postId] || [];
    const updated = [
      ...existing,
      { authorName: currentUser.name, text: commentText, time: 'Just now' },
    ];
    setCommentsMap({ ...commentsMap, [postId]: updated });
    setCommentText('');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-extrabold text-[#1b4332] flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-[#2d6a4f]" />
            Community Ride Board
          </h2>
          <p className="text-xs text-[#52605d] mt-0.5">
            Share casual weekend meetups, route suggestions, gear advice, and rider talk
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="py-2.5 px-4 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Create Community Post
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {['All', 'Group Ride Setup', 'Route Suggestion', 'General Talk', 'Equipment & Gear'].map((cat) => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              catFilter === cat
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'bg-white text-[#52605d] border border-[#e2ece2] hover:text-[#1b4332]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Post Cards Feed */}
      <div className="space-y-4">
        {filteredPosts.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-[#e2ece2] space-y-3 shadow-xs">
            <MessageSquare className="w-10 h-10 text-[#2d6a4f] mx-auto opacity-40" />
            <h3 className="font-heading font-bold text-[#1b4332] text-base">No Community Posts Yet</h3>
            <p className="text-xs text-[#52605d] max-w-md mx-auto">
              Be the first to share a casual ride setup, route suggestion, or gear discussion on the BCC Ride Board!
            </p>
          </div>
        ) : (
          filteredPosts.map((post) => {
          const isLiked = currentUser ? post.likedBy.includes(currentUser.id) : false;
          const postComments = commentsMap[post.id] || [];

          return (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-3xl bg-white border border-[#e2ece2] space-y-4 shadow-xs"
            >
              {/* Post Author Info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={post.authorAvatar}
                    alt={post.authorName}
                    className="w-10 h-10 rounded-full object-cover border-2 border-[#e2ece2]"
                  />
                  <div>
                    <h4 className="font-heading font-bold text-[#1b4332] text-sm flex items-center gap-2">
                      {post.authorName}
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#d8f3dc] text-[#1b4332] capitalize font-medium">
                        {post.authorRole}
                      </span>
                    </h4>
                    <p className="text-[10px] text-[#52605d]">{post.createdAt}</p>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#f7f9f7] text-[#52605d] border border-[#e2ece2]">
                  {post.category}
                </span>
              </div>

              {/* Title & Body */}
              <div className="space-y-2">
                <h3 className="font-heading text-base font-bold text-[#1b4332]">
                  {post.title}
                </h3>
                <p className="text-xs text-[#52605d] leading-relaxed whitespace-pre-line">
                  {post.content}
                </p>
              </div>

              {/* Ride Setup Attributes */}
              {post.category === 'Group Ride Setup' && (
                <div className="p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {post.meetingPoint && (
                    <div className="flex items-center gap-2 text-[#2d3a3a]">
                      <MapPin className="w-4 h-4 text-[#2d6a4f] shrink-0" />
                      <div>
                        <span className="text-[10px] text-[#52605d] block">Meeting Point</span>
                        <strong className="text-[#1b4332]">{post.meetingPoint}</strong>
                      </div>
                    </div>
                  )}

                  {post.meetingTime && (
                    <div className="flex items-center gap-2 text-[#2d3a3a]">
                      <Clock className="w-4 h-4 text-[#2d6a4f] shrink-0" />
                      <div>
                        <span className="text-[10px] text-[#52605d] block">Meeting Time</span>
                        <strong className="text-[#1b4332]">{post.meetingTime}</strong>
                      </div>
                    </div>
                  )}

                  {post.paceLevel && (
                    <div className="flex items-center gap-2 text-[#2d3a3a]">
                      <Bike className="w-4 h-4 text-[#2d6a4f] shrink-0" />
                      <div>
                        <span className="text-[10px] text-[#52605d] block">Pace & Distance</span>
                        <strong className="text-[#2d6a4f]">{post.distanceMiles} mi ({post.paceLevel})</strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Interactive Toolbar */}
              <div className="pt-3 border-t border-[#e2ece2] flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleLike(post.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                      isLiked
                        ? 'bg-[#d8f3dc] text-[#1b4332] border-[#b7e4c7]'
                        : 'bg-[#f7f9f7] text-[#52605d] border-[#e2ece2] hover:text-[#1b4332]'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5 text-[#2d6a4f]" />
                    <span>{post.likesCount} Likes</span>
                  </button>

                  <button
                    onClick={() => setActivePostForComments(post)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f7f9f7] text-[#2d3a3a] border border-[#e2ece2] hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#2d6a4f]" />
                    <span>{post.commentsCount + postComments.length} Comments</span>
                  </button>
                </div>

                <button
                  onClick={() => alert('Post link copied to clipboard!')}
                  className="p-2 text-[#52605d] hover:text-[#1b4332] rounded-lg hover:bg-gray-100 cursor-pointer"
                  title="Share Post"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })
      )}
      </div>

      {/* Create Post Modal */}
      <AnimatePresence>
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl bg-white border border-[#e2ece2] p-6 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto text-[#2d3a3a]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#e2ece2]">
                <h3 className="font-heading font-bold text-[#1b4332] text-lg">
                  Create Ride Board Post
                </h3>
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="p-1.5 text-[#52605d] hover:text-[#1b4332] rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreatePostSubmit} className="space-y-4 text-xs">
                <div>
                  <CustomSelect
                    label="Category"
                    value={category}
                    onChange={(val) => setCategory(val as any)}
                    options={['Group Ride Setup', 'Route Suggestion', 'General Talk', 'Equipment & Gear']}
                  />
                </div>

                <div>
                  <label className="text-[#2d3a3a] font-semibold mb-1 block">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g. Saturday Sunset Cruise down Topanga"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                  />
                </div>

                {category === 'Group Ride Setup' && (
                  <div className="space-y-3 p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2]">
                    <span className="font-bold text-[#1b4332] block">Ride Logistics Details</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[#52605d] mb-1 block">Meeting Point</label>
                        <input
                          type="text"
                          value={meetingPoint}
                          onChange={(e) => setMeetingPoint(e.target.value)}
                          placeholder="Shell Gas Station"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-[#e2ece2] text-[#2d3a3a]"
                        />
                      </div>
                      <div>
                        <label className="text-[#52605d] mb-1 block">Meeting Time</label>
                        <input
                          type="text"
                          value={meetingTime}
                          onChange={(e) => setMeetingTime(e.target.value)}
                          placeholder="5:30 PM, Saturday"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-[#e2ece2] text-[#2d3a3a]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[#2d3a3a] font-semibold mb-1 block">Content</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                    rows={4}
                    placeholder="Describe the ride route, pace expectations, and coffee stops..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-4 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Publish to Ride Board
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Comment Thread Drawer */}
      <AnimatePresence>
        {activePostForComments && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-3xl bg-white border border-[#e2ece2] p-6 space-y-4 shadow-2xl text-[#2d3a3a]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#e2ece2]">
                <h3 className="font-heading font-bold text-[#1b4332] text-base truncate pr-2">
                  Comments: {activePostForComments.title}
                </h3>
                <button
                  onClick={() => setActivePostForComments(null)}
                  className="p-1.5 text-[#52605d] hover:text-[#1b4332] rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Existing Comments */}
              <div className="max-h-60 overflow-y-auto space-y-2.5 divide-y divide-[#e2ece2]">
                {(commentsMap[activePostForComments.id] || []).length === 0 ? (
                  <p className="text-[#52605d] text-xs text-center py-4">No comments yet. Be the first to reply!</p>
                ) : (
                  (commentsMap[activePostForComments.id] || []).map((c, idx) => (
                    <div key={idx} className="pt-2 text-xs space-y-1">
                      <div className="flex justify-between items-center text-[#52605d]">
                        <strong className="text-[#1b4332] font-semibold">{c.authorName}</strong>
                        <span className="text-[10px] text-[#52605d]">{c.time}</span>
                      </div>
                      <p className="text-[#2d3a3a] leading-relaxed">{c.text}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment Input */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#e2ece2]">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a reply..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] text-xs focus:outline-none focus:border-[#2d6a4f]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddComment(activePostForComments.id);
                  }}
                />
                <button
                  onClick={() => handleAddComment(activePostForComments.id)}
                  className="p-2.5 bg-[#1b4332] hover:bg-[#2d6a4f] text-white rounded-xl font-bold cursor-pointer transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
