/**
 * 收藏页面（重构）
 * 影视 + IPTV 双 Tab，懒加载、搜索、筛选、多选删除、清除全部
 */
import { useState, useMemo, useEffect } from 'react';
import { useVideoStore, useUserStore, useIPTVStore, useNavStore } from '@/stores';
import { VideoCard } from '@/components/VideoCard';
import IPTVChannelCard from '@/components/IPTVChannelCard';
import { Empty } from '@/components/common';
import { Search, X, Trash2, CheckSquare, Square } from 'lucide-react';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import type { Video, VideoType } from '@/types/video';
import type { IPTVChannel } from '@/types/iptv';
import type { CollectionRecord } from '@/types/store';
import './Collections.css';

const TYPE_OPTIONS: { label: string; value: VideoType | '' }[] = [
  { label: '全部', value: '' }, { label: '电影', value: 'movie' },
  { label: '剧集', value: 'tv' }, { label: '综艺', value: 'variety' }, { label: '动漫', value: 'anime' },
];

type Tab = 'video' | 'iptv';

interface CollectionVideoItem extends Video {
  _rating?: number;
}

export default function CollectionsPage() {
  const { videos } = useVideoStore();
  const { collections, removeCollection } = useUserStore();
  const { channels: iptvChannels, toggleFavorite, clearFavorites } = useIPTVStore();
  const { getState, saveState } = useNavStore();
  const saved = getState('collections');

  const [activeTab, setActiveTab] = useState<Tab>((saved?.tab as Tab) || 'video');
  const [search, setSearch] = useState(saved?.search || '');
  const [typeFilter, setTypeFilter] = useState<VideoType | ''>((saved?.filter?.type as VideoType | '') || '');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useScrollRestore('collections');

  // 离开时保存状态
  useEffect(() => {
    return () => { saveState('collections', { tab: activeTab, search, filter: { type: typeFilter } }); };
  }, [activeTab, search, typeFilter, saveState]);

  useEffect(() => { setSearch(saved?.search || ''); setSelected(new Set()); }, [activeTab, saved?.search]);

  // ── 影视收藏 ─────────────────────────────────
  const collectedVideos = useMemo<CollectionVideoItem[]>(() => {
    let list: CollectionVideoItem[] = collections
      .filter((c: CollectionRecord) => c.type !== 'iptv')
      .map((c: CollectionRecord): CollectionVideoItem => {
        const sv = videos.find((v) => v.id === c.videoId);
        if (sv) return { ...sv, _rating: c.rating };
        return {
          id: c.videoId,
          title: c.title || '',
          cover: c.cover || '',
          type: (c.type as VideoType) || 'movie',
          year: c.year,
          tags: [],
          actors: [],
          sources: [],
          createdAt: c.addedAt,
          updatedAt: c.addedAt,
          _rating: c.rating,
        };
      });
    if (search.trim()) { const kw = search.toLowerCase(); list = list.filter((v) => v.title?.toLowerCase().includes(kw)); }
    if (typeFilter) list = list.filter((v) => v.type === typeFilter);
    return list;
  }, [collections, videos, search, typeFilter]);

  // ── IPTV 收藏 ────────────────────────────────
  const favoriteChannels = useMemo(() => {
    let list = iptvChannels.filter(ch => ch.isFavorite);
    if (search.trim()) { const kw = search.toLowerCase(); list = list.filter(ch => ch.name?.toLowerCase().includes(kw)); }
    return list;
  }, [iptvChannels, search]);

  const currentList: CollectionVideoItem[] | IPTVChannel[] = activeTab === 'video' ? collectedVideos : favoriteChannels;

  const toggleSelect = (id: string) => setSelected((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const selectAll = () => setSelected(selected.size === currentList.length ? new Set() : new Set(currentList.map((v) => v.id)));
  const deleteSelected = () => {
    if (activeTab === 'video') selected.forEach(id => removeCollection(id));
    else selected.forEach(id => toggleFavorite(id));
    setSelected(new Set());
  };
  const clearAll = () => {
    if (activeTab === 'video') collections.filter(c => c.type !== 'iptv').forEach(c => removeCollection(c.videoId));
    else clearFavorites();
  };

  return (
    <div className="collection-page">
      <div className="collection-header">
        <h1>我的收藏</h1>
        <button className="collection-btn collection-btn--danger" onClick={clearAll}><Trash2 size={16} /> 清除全部</button>
      </div>

      {/* Tab 切换 */}
      <div className="category-tabs">
        <button className={`category-tab ${activeTab === 'video' ? 'active' : ''}`} onClick={() => setActiveTab('video')}>影视 ({collectedVideos.length})</button>
        <button className={`category-tab ${activeTab === 'iptv' ? 'active' : ''}`} onClick={() => setActiveTab('iptv')}>IPTV ({favoriteChannels.length})</button>
      </div>

      {/* 搜索 + 筛选 */}
      <div className="collection-toolbar">
        <div className="collection-search">
          <Search size={16} /><input placeholder="搜索…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')}><X size={14} /></button>}
        </div>
        {activeTab === 'video' && (
          <div className="collection-filters">{TYPE_OPTIONS.map(t => (
            <button key={t.value} className={`collection-chip ${typeFilter === t.value ? 'active' : ''}`} onClick={() => setTypeFilter(t.value)}>{t.label}</button>
          ))}</div>
        )}
        {selected.size > 0 && (
          <button className="collection-btn collection-btn--danger" onClick={deleteSelected}><Trash2 size={14} /> 删除选中 ({selected.size})</button>
        )}
      </div>

      {/* 全选 */}
      {currentList.length > 0 && (
        <div className="collection-select-all" onClick={selectAll}>
          {selected.size === currentList.length ? <CheckSquare size={16} /> : <Square size={16} />}<span>全选</span>
        </div>
      )}

      {/* 内容 */}
      {currentList.length === 0 ? (
        <Empty title="暂无收藏" description={activeTab === 'video' ? '去首页发现喜欢的影片吧' : '去 IPTV 页面收藏喜欢的频道吧'} />
      ) : activeTab === 'video' ? (
        <div className="collection-grid">
          {activeTab === 'video' && (currentList as CollectionVideoItem[]).map((video, idx) => (
            <div key={video.id} className={`collection-card ${selected.has(video.id) ? 'selected' : ''}`}>
              <button className="collection-card-check" onClick={(e) => { e.stopPropagation(); toggleSelect(video.id); }}>
                {selected.has(video.id) ? <CheckSquare size={18} /> : <Square size={18} />}
              </button>
              <button className="collection-card-del" onClick={(e) => { e.stopPropagation(); removeCollection(video.id); }} title="删除"><Trash2 size={14} /></button>
              <VideoCard video={video} index={idx} rating={video._rating} hideFavorite />
            </div>
          ))}
        </div>
      ) : (
        <div className="iptv-channel-grid">
          {activeTab === 'iptv' && (currentList as IPTVChannel[]).map((ch, idx) => (
            <IPTVChannelCard key={ch.id} channel={ch} index={idx} hideFavorite />
          ))}
        </div>
      )}

    </div>
  );
}
