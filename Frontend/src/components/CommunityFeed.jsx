import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { Link, useNavigate } from 'react-router-dom';
import {
  Heart, MessageSquare, MapPin, Calendar, Clock, AlertTriangle,
  CheckCircle2, RefreshCw, Send, Search, Filter, Users, TrendingUp,
  ChevronDown, Eye, Share2, Sparkles, ShieldCheck, X, ArrowRight,
  Award, Star, Flame, Building2, Loader2, User, ChevronRight, Zap
} from 'lucide-react';

const API = 'http://localhost:5000';

// ─── Utility ────────────────────────────────────────────────────────────────
const timeAgo = (iso) => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const statusColor = (status) => {
  if (status === 'Resolved') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'In Progress') return 'bg-amber-100 text-amber-900 border-amber-200';
  return 'bg-sky-100 text-sky-800 border-sky-200';
};

const statusDot = (status) => {
  if (status === 'Resolved') return 'bg-emerald-500';
  if (status === 'In Progress') return 'bg-amber-500';
  return 'bg-sky-500';
};

const imgSrc = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API}/${path.replace(/^\/+/, '')}`;
};

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden animate-pulse">
      <div className="flex flex-col md:flex-row h-auto md:h-60">
        <div className="w-full md:w-64 h-48 md:h-full bg-slate-200 shrink-0" />
        <div className="flex-1 p-6 space-y-3">
          <div className="h-3 w-24 bg-slate-200 rounded" />
          <div className="h-5 w-3/4 bg-slate-200 rounded" />
          <div className="h-3 w-full bg-slate-200 rounded" />
          <div className="h-3 w-2/3 bg-slate-200 rounded" />
          <div className="flex gap-3 mt-auto pt-4">
            <div className="h-7 w-16 bg-slate-200 rounded-lg" />
            <div className="h-7 w-16 bg-slate-200 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stats Banner ─────────────────────────────────────────────────────────────
function StatsBanner({ stats }) {
  const items = [
    { label: 'Issues Reported', value: stats.issues_reported, icon: <AlertTriangle className="h-4 w-4" />, color: 'text-blue-400' },
    { label: 'Live Issues', value: stats.live_issues, icon: <Zap className="h-4 w-4" />, color: 'text-amber-400' },
    { label: 'Issues Resolved', value: stats.issues_resolved, icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-emerald-400' },
    { label: 'Citizens Participated', value: stats.citizens_participated, icon: <Users className="h-4 w-4" />, color: 'text-violet-400' },
    { label: 'Avg Resolution', value: stats.avg_resolution_time, icon: <Clock className="h-4 w-4" />, color: 'text-pink-400' },
    { label: 'AI Accuracy', value: stats.avg_ai_accuracy, icon: <Sparkles className="h-4 w-4" />, color: 'text-cyan-400' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          className="bg-white shadow-sm border border-slate-200/80 rounded-xl p-4 text-center"
        >
          <div className={`flex justify-center mb-2 ${item.color}`}>{item.icon}</div>
          <div className={`text-xl font-black ${item.color}`}>{item.value ?? '—'}</div>
          <div className="text-[10px] text-slate-500 font-medium mt-0.5 leading-tight">{item.label}</div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Trending Areas Sidebar ───────────────────────────────────────────────────
function TrendingAreas({ areas }) {
  if (!areas || areas.length === 0) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="h-4 w-4 text-orange-500" />
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Trending Areas</h4>
      </div>
      <div className="space-y-2">
        {areas.map((area, i) => (
          <div key={area.area} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black w-5 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-500' : 'text-amber-700'}`}>
                {i + 1}
              </span>
              <span className="text-xs text-slate-700 truncate max-w-[120px]">{area.area}</span>
            </div>
            <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
              {area.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────
function PostCard({ post, onLike, onViewDetail, currentUserId }) {
  const isResolved = post.post_type === 'resolved';
  const image = isResolved ? (imgSrc(post.image_after) || imgSrc(post.image_before)) : imgSrc(post.image_before);
  const caption = isResolved ? post.resolution_post_caption : post.report_post_caption;
  const ownerName = post.department_name || post.reporter_name || 'PMC';

  return (
    <motion.div
      layoutId={`post-card-${post.id}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35 }}
      whileHover={{ y: -3 }}
          className="group relative rounded-3xl overflow-hidden border border-slate-200/80 bg-[#ecf5fc] shadow-xl shadow-slate-300/30 transition-all duration-300 cursor-pointer"
      onClick={() => onViewDetail(post)}
    >
      <div className="p-5 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold uppercase">
              {ownerName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Posted by</p>
              <h3 className="text-sm font-semibold text-slate-900 truncate">{ownerName}</h3>
            </div>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${statusColor(post.report_status)}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${statusDot(post.report_status)}`} />
            {post.report_status || (isResolved ? 'Resolved' : 'Reported')}
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span className="uppercase tracking-[0.18em]">{post.report_category}</span>
          <span>{timeAgo(post.created_at)}</span>
        </div>

        <div className="rounded-[28px] overflow-hidden border border-slate-200 bg-slate-100 h-96">
          {isResolved && imgSrc(post.image_before) && imgSrc(post.image_after) ? (
            <div className="grid grid-cols-2 gap-px bg-slate-200 h-full">
              <div className="relative overflow-hidden h-full">
                <img src={imgSrc(post.image_before)} alt="Before" className="h-full w-full object-cover" />
                <div className="absolute bottom-3 left-3 rounded-full bg-slate-900/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                  Before
                </div>
              </div>
              <div className="relative overflow-hidden h-full">
                <img src={imgSrc(post.image_after)} alt="After" className="h-full w-full object-cover" />
                <div className="absolute bottom-3 right-3 rounded-full bg-slate-900/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                  After
                </div>
              </div>
            </div>
          ) : image ? (
            <div className="relative h-full w-full">
              <img src={image} alt={post.friendly_title || post.title} className="absolute inset-0 h-full w-full object-cover" />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
              <AlertTriangle className="h-12 w-12" />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 leading-tight">{post.friendly_title || post.title}</h3>
            <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 mt-2">
              {caption || post.content || 'No description provided.'}
            </p>
            <div className="flex items-center gap-2 text-sm text-slate-500 mt-3">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{post.report_location}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); onLike(post.id); }}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${post.has_liked ? 'border-red-200 bg-red-50 text-red-600' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
              >
                <Heart className={`h-5 w-5 ${post.has_liked ? 'text-red-600' : 'text-slate-600'}`} />
                <span>{post.likes_count}</span>
              </button>

              <button
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition"
              >
                <MessageSquare className="h-5 w-5 text-slate-600" />
                <span>{post.comments_count}</span>
              </button>

              <button
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition"
              >
                <Users className="h-5 w-5 text-slate-600" />
                <span>{post.contributors_count}</span>
              </button>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); onViewDetail(post); }}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              View Timeline
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ post, onClose, currentUserId, onLike }) {
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [contributors, setContributors] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [activeTab, setActiveTab] = useState('timeline'); // timeline | comments | heroes

  useEffect(() => {
    const fetchDetail = async () => {
      setLoadingDetail(true);
      try {
        const r = await fetch(`${API}/api/community/post/${post.id}?userId=${currentUserId || 0}`);
        const data = await r.json();
        if (data.success) setDetail(data.post);

        const cr = await fetch(`${API}/api/community/contributors/${post.id}`);
        const cdata = await cr.json();
        if (cdata.success) setContributors(cdata.contributors);
      } catch (e) {
        console.error('Detail load error:', e);
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail();
  }, [post.id, currentUserId]);

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const r = await fetch(`${API}/api/community/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, userId: currentUserId || 1, comment: commentText })
      });
      const data = await r.json();
      if (data.success && detail) {
        setDetail(prev => ({
          ...prev,
          comments: [data.comment, ...(prev.comments || [])],
          comments_count: (prev.comments_count || 0) + 1
        }));
        setCommentText('');
      }
    } catch (e) {
      console.error('Comment error:', e);
    } finally {
      setSubmittingComment(false);
    }
  };

  const isResolved = post.post_type === 'resolved';
  const imageBefore = imgSrc(post.image_before);
  const imageAfter = imgSrc(post.image_after);

  const actionLabels = {
    'Submit Report': 'Citizen Reported',
    'Take Issue': 'PMC Accepted',
    'Resolve Issue': 'Issue Resolved',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xl" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Images + caption */}
        <div className="w-full md:w-2/5 flex flex-col border-r border-slate-200 overflow-y-auto bg-slate-50">
          {/* Image */}
          <div className="relative h-56 shrink-0 bg-slate-100">
            {isResolved && imageBefore && imageAfter ? (
              <div className="flex h-full">
                <div className="w-1/2 relative">
                  <img src={imageBefore} alt="Before" className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 left-2 text-[9px] font-black bg-red-600 text-white px-2 py-0.5 rounded uppercase">Before</div>
                </div>
                <div className="w-1/2 relative border-l border-slate-200">
                  <img src={imageAfter} alt="After" className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 right-2 text-[9px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded uppercase">After</div>
                </div>
              </div>
            ) : (imageBefore || imageAfter) ? (
              <img src={imageBefore || imageAfter} alt={post.friendly_title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-100">
                <AlertTriangle className="h-12 w-12 text-slate-400" />
              </div>
            )}
            <button onClick={onClose} className="absolute top-3 right-3 bg-white shadow-sm text-slate-900 p-1.5 rounded-full transition-colors">
              <X className="h-4 w-4" />
            </button>
            <span className={`absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-white/90 flex items-center gap-1 shadow-sm ${statusColor(post.report_status)}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusDot(post.report_status)}`} />
              {post.report_status}
            </span>
          </div>

          {/* Caption & Meta */}
          <div className="p-5 space-y-4 flex-1 bg-white">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500">{post.report_category}</span>
              <h3 className="font-bold text-lg text-slate-900 mt-1 leading-snug">{post.friendly_title || post.title}</h3>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
                <MapPin className="h-3 w-3 text-slate-500" />
                <span>{post.report_location}</span>
              </div>
            </div>

            {/* AI Story / Resolution Caption */}
            <div className={`rounded-xl p-4 text-xs text-slate-700 leading-relaxed ${isResolved ? 'bg-emerald-50 border border-emerald-200' : 'bg-violet-50 border border-violet-200'}`}>
              <div className={`flex items-center gap-1.5 mb-2 text-[10px] font-bold ${isResolved ? 'text-emerald-700' : 'text-violet-700'}`}>
                {isResolved ? <ShieldCheck className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                {isResolved ? 'PMC Resolution Story' : 'AI Community Story'}
              </div>
              <p className="line-clamp-6 text-slate-700">
                {isResolved ? (detail?.resolution_post_caption || post.resolution_post_caption) : (detail?.report_post_caption || post.report_post_caption)}
              </p>
            </div>

            {/* Officer info */}
            {isResolved && (post.officer_name || post.resolution_time) && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1">
                {post.officer_name && (
                  <div className="flex items-center gap-2 text-xs text-emerald-700">
                    <ShieldCheck className="h-3 w-3" />
                    <span className="font-semibold">Resolved by {post.officer_name}</span>
                  </div>
                )}
                {post.department_name && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Building2 className="h-3 w-3" />
                    <span>{post.department_name}</span>
                  </div>
                )}
                {post.resolution_time && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Clock className="h-3 w-3" />
                    <span>Resolved in {post.resolution_time}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Tabs (Timeline | Comments | Heroes) */}
        <div className="w-full md:w-3/5 flex flex-col overflow-hidden">
          {/* Tab header */}
          <div className="flex border-b border-white/10 shrink-0">
            {[
              { id: 'timeline', label: 'Timeline', icon: <Clock className="h-3.5 w-3.5" /> },
              { id: 'comments', label: `Comments ${detail ? `(${detail.comments_count})` : ''}`, icon: <MessageSquare className="h-3.5 w-3.5" /> },
              { id: 'heroes', label: `Community Heroes ${post.contributors_count > 1 ? `(${post.contributors_count})` : ''}`, icon: <Award className="h-3.5 w-3.5" /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3.5 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === tab.id
                    ? 'text-white border-b-2 border-blue-500 bg-white/5'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {loadingDetail ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-slate-500 animate-spin" />
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">

              {/* TIMELINE TAB */}
              {activeTab === 'timeline' && (
                <div className="flex-1 overflow-y-auto p-6">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-5">Civic Lifecycle</p>
                  {!detail?.timeline?.length ? (
                    <div className="text-center text-slate-500 text-xs py-8">No workflow events recorded yet.</div>
                  ) : (
                    <div className="relative pl-5 space-y-6">
                      <div className="absolute left-2.5 top-2 bottom-2 w-px bg-white/10" />
                      {detail.timeline.map((event, idx) => {
                        const isLast = idx === detail.timeline.length - 1;
                        const color = event.action === 'Resolve Issue' ? 'bg-emerald-500' : event.action === 'Take Issue' ? 'bg-amber-500' : 'bg-blue-500';
                        return (
                          <div key={idx} className="relative">
                            <div className={`absolute -left-[18px] top-1.5 h-3 w-3 rounded-full border-2 border-slate-900 ${color}`} />
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="text-xs font-bold text-white">
                                  {actionLabels[event.action] || event.action}
                                </h4>
                                {event.performed_by && (
                                  <p className="text-[11px] text-slate-500 mt-0.5">by {event.performed_by}</p>
                                )}
                                {event.remarks && (
                                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed line-clamp-2">{event.remarks}</p>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 whitespace-nowrap shrink-0">
                                {event.timestamp ? new Date(event.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* COMMENTS TAB */}
              {activeTab === 'comments' && (
                <>
                  <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-white/[0.02]">
                    {!detail?.comments?.length ? (
                      <div className="text-center text-slate-500 text-xs py-8">No comments yet. Start the conversation!</div>
                    ) : (
                      detail.comments.map((c) => (
                      <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex gap-3">
                          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-slate-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-slate-900">{c.author}</span>
                              <span className="text-[10px] text-slate-500">{timeAgo(c.created_at)}</span>
                            </div>
                            <p className="text-xs text-slate-700 leading-relaxed">{c.comment}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={handleComment} className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2 shrink-0">
                    <input
                      type="text"
                      placeholder="Leave a comment..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 focus:border-blue-500 rounded-xl py-2 px-4 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!commentText.trim() || submittingComment}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white p-2.5 rounded-xl transition-all flex items-center justify-center"
                    >
                      {submittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </form>
                </>
              )}

              {/* HEROES TAB */}
              {activeTab === 'heroes' && (
                <div className="flex-1 overflow-y-auto p-5">
                  <div className="text-center mb-6">
                    <Award className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                    <h4 className="text-sm font-bold text-white">Community Heroes</h4>
                    <p className="text-[11px] text-slate-500 mt-1">{post.contributors_count} citizen{post.contributors_count !== 1 ? 's' : ''} helped report this issue</p>
                  </div>
                  {!contributors.length ? (
                    <div className="text-center text-slate-500 text-xs py-4">No contributor data yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {contributors.map((c, i) => (
                        <div key={c.id} className={`flex items-center gap-3 p-3.5 rounded-xl border ${c.role === 'Original Reporter' ? 'bg-amber-950/40 border-amber-500/30' : 'bg-white/5 border-white/10'}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${c.role === 'Original Reporter' ? 'bg-amber-500/20' : 'bg-slate-700'}`}>
                            {c.role === 'Original Reporter' ? <Star className="h-4 w-4 text-amber-400" /> : <User className="h-4 w-4 text-slate-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{c.name}</span>
                              {c.role === 'Original Reporter' && (
                                <span className="text-[9px] font-black bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">FIRST</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                              <MapPin className="h-2.5 w-2.5" />
                              <span>{c.area}</span>
                              {c.confidence > 0 && <span>• {c.confidence}% confidence</span>}
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${c.role === 'Original Reporter' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {c.role === 'Original Reporter' ? '🥇 Reporter' : '✓ Supporter'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CommunityFeed({ isStandalonePage = false }) {
  const { user } = useApp();
  const navigate = useNavigate();

  // Stats & trending
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Feed state
  const [posts, setPosts] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('all'); // all | reported | resolved
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeSort, setActiveSort] = useState('Newest');

  // Detail modal
  const [selectedPost, setSelectedPost] = useState(null);

  const categories = ['All', 'Potholes', 'Garbage', 'Street Lights', 'Water Leakage'];
  const sortOptions = ['Newest', 'Most Supported', 'Recently Resolved', 'High Priority', 'Most Liked'];

  const currentUserId = user?.id || null;

  // ── Fetch stats ──
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/community/stats`);
        const data = await r.json();
        if (data.success) setStats(data.stats);
      } catch (e) {
        console.error('Stats error:', e);
      } finally {
        setLoadingStats(false);
      }
    };
    load();
  }, []);

  // ── Fetch feed ──
  const fetchFeed = useCallback(async (pg = 1, reset = true) => {
    reset ? setLoadingFeed(true) : setLoadingMore(true);
    try {
      const statusMap = { reported: 'Reported', resolved: 'Resolved', 'in-progress': 'In Progress', all: '' };
      const params = new URLSearchParams({
        page: pg,
        limit: 8,
        sort: activeSort,
        ...(statusMap[activeSection] && { status: statusMap[activeSection] }),
        ...(activeCategory !== 'All' && { category: activeCategory }),
        ...(searchQuery.trim() && { search: searchQuery.trim() }),
        ...(currentUserId && { userId: currentUserId }),
      });

      const r = await fetch(`${API}/api/community/feed?${params}`);
      const data = await r.json();
      if (data.success) {
        setPosts(prev => reset ? data.posts : [...prev, ...data.posts]);
        setTotalPages(data.totalPages || 1);
        setHasMore(pg < (data.totalPages || 1));
        setPage(pg);
      }
    } catch (e) {
      console.error('Feed error:', e);
    } finally {
      setLoadingFeed(false);
      setLoadingMore(false);
    }
  }, [activeSection, activeCategory, activeSort, searchQuery, currentUserId]);

  // Reset feed on filter change
  useEffect(() => {
    const timer = setTimeout(() => fetchFeed(1, true), searchQuery ? 400 : 0);
    return () => clearTimeout(timer);
  }, [activeSection, activeCategory, activeSort, searchQuery]);

  // Like toggle
  const handleLike = async (postId) => {
    if (!currentUserId) { navigate('/login'); return; }
    try {
      const r = await fetch(`${API}/api/community/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, userId: currentUserId })
      });
      const data = await r.json();
      if (data.success) {
        setPosts(prev => prev.map(p => p.id === postId
          ? { ...p, has_liked: data.liked, likes_count: data.likesCount }
          : p
        ));
      }
    } catch (e) {
      console.error('Like error:', e);
    }
  };

  const sectionBtns = [
    { id: 'all', label: 'All Issues', icon: <Filter className="h-3.5 w-3.5" /> },
    { id: 'reported', label: '📢 Reported', icon: null },
    { id: 'resolved', label: '✅ Resolved', icon: null },
  ];

  const containerClass = "py-20 bg-slate-50 relative overflow-hidden";

  return (
    <section id="community" className={containerClass}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Hero */}
        <div className="text-center mb-10">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full mb-4">
              <Zap className="h-3 w-3" /> Live Community Feed
            </span>
            <h1 className="font-black text-4xl md:text-5xl text-slate-900 tracking-tight">
              Civic <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-violet-500">Timeline</span>
            </h1>
            <p className="text-slate-600 text-base mt-3 max-w-xl mx-auto">
              Every issue from report to resolution — publicly tracked, community-powered.
            </p>
          </motion.div>
        </div>

        {/* Stats Banner */}
        {loadingStats ? (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8 animate-pulse">
            {[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-slate-100 border border-slate-200 rounded-xl" />)}
          </div>
        ) : stats ? (
          <StatsBanner stats={stats} />
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Sidebar */}
          <div className="lg:col-span-3 space-y-5 lg:sticky lg:top-24">

            {/* Section Switcher */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 shadow-sm">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Show</p>
              {sectionBtns.map(btn => (
                <button
                  key={btn.id}
                  onClick={() => setActiveSection(btn.id)}
                  className={`w-full text-left text-sm px-3 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                    activeSection === btn.id
                      ? 'bg-blue-50 text-blue-700 border border-blue-100'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  {btn.icon}
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Search</p>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Area, category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Category</p>
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`text-[11px] px-3 py-1.5 rounded-lg font-semibold border transition-all ${
                      activeCategory === cat
                        ? 'bg-blue-50 border-blue-100 text-blue-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Sort By</p>
              <div className="space-y-1">
                {sortOptions.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setActiveSort(opt)}
                    className={`w-full text-left text-xs px-3 py-2 rounded-lg font-semibold transition-all ${
                      activeSort === opt
                        ? 'bg-blue-50 text-blue-700 border border-blue-100'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Trending Areas */}
            {stats?.trending_areas?.length > 0 && <TrendingAreas areas={stats.trending_areas} />}

            {/* Quick Report Widget */}
            <div className="bg-gradient-to-br from-red-950/50 to-slate-900 border border-red-500/20 rounded-2xl p-5">
              <AlertTriangle className="h-6 w-6 text-red-400 mb-3" />
              <h4 className="font-bold text-sm text-white">Spotted an issue?</h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">Report it with a photo — our AI handles the rest.</p>
              <Link
                to="/report"
                className="mt-4 bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5 transition-all"
              >
                Report Now <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Feed */}
          <div className="lg:col-span-9 space-y-5">

            {/* Filter summary bar */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">
                {loadingFeed ? 'Loading...' : `${posts.length} post${posts.length !== 1 ? 's' : ''} found`}
              </span>
              {(activeCategory !== 'All' || activeSection !== 'all' || searchQuery) && (
                <button
                  onClick={() => { setActiveCategory('All'); setActiveSection('all'); setSearchQuery(''); }}
                  className="text-xs text-slate-500 hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="h-3 w-3" /> Clear filters
                </button>
              )}
            </div>

            <AnimatePresence mode="popLayout">
              {loadingFeed ? (
                <div className="space-y-5">
                  {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : posts.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <Search className="h-6 w-6 text-slate-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">No posts found</h3>
                  <p className="text-slate-500 text-sm mt-2">Try adjusting your filters, or submit the first report in this area!</p>
                </motion.div>
              ) : (
                <>
                  {posts.map(post => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onLike={handleLike}
                      onViewDetail={setSelectedPost}
                      currentUserId={currentUserId}
                    />
                  ))}

                  {/* Load more */}
                  {hasMore && (
                    <div className="text-center pt-2">
                      <button
                        onClick={() => fetchFeed(page + 1, false)}
                        disabled={loadingMore}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-sm font-semibold px-8 py-3 rounded-xl transition-all flex items-center gap-2 mx-auto"
                      >
                        {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
                        {loadingMore ? 'Loading...' : 'Load More'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedPost && (
          <DetailModal
            post={selectedPost}
            onClose={() => setSelectedPost(null)}
            currentUserId={currentUserId}
            onLike={handleLike}
          />
        )}
      </AnimatePresence>
    </section>
  );
}