import React, { useState, useEffect } from 'react';
import { AnnouncementsView } from './AnnouncementsView';
import { NewsFeed } from './NewsFeed';
import { Megaphone, MessageSquareText, Sparkles } from 'lucide-react';
import { store } from '../lib/db';
import { useLoader } from '../context/LoaderContext';

export type UpdatesSubTab = 'announcements' | 'feed';

export const UpdatesHub: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<UpdatesSubTab>('announcements');
  const { refreshTick } = useLoader();
  const [announcementsCount, setAnnouncementsCount] = useState(0);
  const [feedCount, setFeedCount] = useState(0);

  useEffect(() => {
    setAnnouncementsCount(store.getAnnouncements().length);
    setFeedCount(store.getPosts().length);
  }, [refreshTick]);

  return (
    <div className="space-y-3 sm:space-y-4 max-w-5xl mx-auto w-full">
      {/* Sub-Tabs Header Navigation */}
      <div className="bg-white p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl border border-[#e2ece2] shadow-xs flex items-center justify-between gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto">
          {/* Sub-Tab 1: News Update (Official Club Announcements) */}
          <button
            type="button"
            id="subtab-news-update"
            onClick={() => setActiveSubTab('announcements')}
            className={`flex-1 sm:flex-initial px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 ${
              activeSubTab === 'announcements'
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'bg-[#f7f9f7] text-[#52605d] hover:bg-[#e8f2e9] hover:text-[#1b4332] border border-[#e2ece2]'
            }`}
          >
            <Megaphone
              className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${
                activeSubTab === 'announcements' ? 'text-[#74c69d]' : 'text-[#2d6a4f]'
              }`}
            />
            <span className="whitespace-nowrap">News Update</span>
            {announcementsCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[9.5px] sm:text-[10px] font-bold ${
                  activeSubTab === 'announcements'
                    ? 'bg-[#2d6a4f] text-[#d8f3dc]'
                    : 'bg-[#e2ece2] text-[#2d6a4f]'
                }`}
              >
                {announcementsCount}
              </span>
            )}
          </button>

          {/* Sub-Tab 2: News Feed (Social Community Feed) */}
          <button
            type="button"
            id="subtab-news-feed"
            onClick={() => setActiveSubTab('feed')}
            className={`flex-1 sm:flex-initial px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 ${
              activeSubTab === 'feed'
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'bg-[#f7f9f7] text-[#52605d] hover:bg-[#e8f2e9] hover:text-[#1b4332] border border-[#e2ece2]'
            }`}
          >
            <MessageSquareText
              className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${
                activeSubTab === 'feed' ? 'text-[#74c69d]' : 'text-[#2d6a4f]'
              }`}
            />
            <span className="whitespace-nowrap">News Feed</span>
            {feedCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[9.5px] sm:text-[10px] font-bold ${
                  activeSubTab === 'feed'
                    ? 'bg-[#2d6a4f] text-[#d8f3dc]'
                    : 'bg-[#e2ece2] text-[#2d6a4f]'
                }`}
              >
                {feedCount}
              </span>
            )}
          </button>
        </div>

        {/* Small Badge / Sub-heading Hint */}
        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-[#52605d] font-semibold pr-2">
          <Sparkles className="w-3.5 h-3.5 text-[#2d6a4f]" />
          <span>
            {activeSubTab === 'announcements'
              ? 'Official Club Bulletins & Directives'
              : 'Community Stories, Photos & Video Clips'}
          </span>
        </div>
      </div>

      {/* Sub-Tab Content */}
      <div>
        {activeSubTab === 'announcements' ? (
          <AnnouncementsView />
        ) : (
          <NewsFeed />
        )}
      </div>
    </div>
  );
};
