import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';

import { Heart, MessageSquare, MapPin, Calendar, Clock, AlertTriangle, CheckCircle2, RefreshCw, Send, Search, Filter, HelpCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CommunityFeed() {
  const {
    issues,
    likeIssue,
    addComment,
    selectedIssueForDetail,
    setSelectedIssueForDetail
  } = useApp();

  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeStatus, setActiveStatus] = useState('All');
  const [newCommentText, setNewCommentText] = useState('');

  // Filtering options
  const categories = ['All', 'Pothole', 'Broken Street Light', 'Garbage Overflow', 'Graffiti', 'Water Leak'];
  const statuses = ['All', 'Reported', 'In Progress', 'Resolved'];

  const filteredIssues = issues.filter((issue) => {
    const matchesSearch = issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    issue.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    issue.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = activeCategory === 'All' || issue.category === activeCategory;
    const matchesStatus = activeStatus === 'All' || issue.status === activeStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Reported':
        return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'In Progress':
        return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Resolved':
        return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Pothole':
        return <AlertTriangle className="h-4 w-4" />;
      case 'Broken Street Light':
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const handleCommentSubmit = (e, issueId) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    addComment(issueId, newCommentText.trim());
    setNewCommentText('');
  };

  return (
    <section id="community" className="py-20 bg-sec-bg relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Section Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Left Column: Title, Description, Filter Sidebar */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-8">
            <div className="text-left">
              <span className="text-primary font-bold text-xs uppercase tracking-wider">Citizen Transparency</span>
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-gray-900 tracking-tight mt-1">
                Community Feed
              </h2>
              <div className="h-1 w-12 bg-primary mt-4 rounded-full" />
              <p className="text-gray-500 mt-4 text-sm sm:text-base leading-relaxed">
                Explore real civic issues submitted by neighbors. Track progress, support issues with upvotes/likes, and converse with city officials.
              </p>
            </div>

            {/* Filter and Search Box */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
              
              {/* Search */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block">Search Issues</label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search pothole, main street..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 focus:border-primary/30 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-hidden transition-all placeholder:text-gray-400 text-gray-800" />
                  
                </div>
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block">Filter Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) =>
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`text-xs px-3 py-2 rounded-xl border transition-all font-semibold ${
                    activeCategory === cat ?
                    'bg-primary border-primary text-white shadow-xs' :
                    'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'}`
                    }>
                    
                      {cat}
                    </button>
                  )}
                </div>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block">Filter Status</label>
                <div className="flex flex-wrap gap-1.5">
                  {statuses.map((stat) =>
                  <button
                    key={stat}
                    onClick={() => setActiveStatus(stat)}
                    className={`text-xs px-3 py-2 rounded-xl border transition-all font-semibold ${
                    activeStatus === stat ?
                    'bg-dark border-dark text-white shadow-xs' :
                    'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'}`
                    }>
                    
                      {stat}
                    </button>
                  )}
                </div>
              </div>

              {/* Reset Filters button */}
              {(activeCategory !== 'All' || activeStatus !== 'All' || searchQuery !== '') &&
              <button
                onClick={() => {
                  setActiveCategory('All');
                  setActiveStatus('All');
                  setSearchQuery('');
                }}
                className="w-full py-2.5 text-xs text-primary font-bold hover:bg-red-50 rounded-xl transition-all border border-dashed border-primary/20 flex items-center justify-center gap-1">
                
                  <RefreshCw className="h-3 w-3 animate-spin-reverse" />
                  Clear Filters
                </button>
              }
            </div>

            {/* Quick Report Widget */}
            <div className="bg-gradient-to-br from-red-50 to-red-100/50 rounded-3xl p-6 border border-red-100 text-left relative overflow-hidden shadow-xs">
              <div className="absolute right-0 bottom-0 h-20 w-20 text-primary opacity-5 select-none -mr-4 -mb-4">
                <AlertTriangle className="h-full w-full" />
              </div>
              <h4 className="font-display font-extrabold text-lg text-gray-900">Found something broken?</h4>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                Take a quick snap, let our AI handle routing to public works, and keep your community safe!
              </p>
              <button
                onClick={() => navigate('/report')}
                className="mt-4 bg-primary hover:bg-primary-hover text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs hover:shadow-md transition-all inline-flex items-center gap-1.5">
                
                File Report Now
              </button>
            </div>
          </div>

          {/* Right Column: Interactive Issues Feed */}
          <div className="lg:col-span-8 space-y-6">
            <AnimatePresence mode="popLayout">
              {filteredIssues.length === 0 ?
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-xs flex flex-col items-center justify-center">
                
                  <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 mb-4">
                    <HelpCircle className="h-6 w-6" />
                  </div>
                  <h3 className="font-display font-extrabold text-lg text-gray-800">No issues found</h3>
                  <p className="text-gray-400 text-xs mt-1.5 max-w-sm">
                    Try adjusting your search query, clearing filters, or be the first to report an issue in this category!
                  </p>
                </motion.div> :

              filteredIssues.map((issue) =>
              <motion.div
                key={issue.id}
                layoutId={`issue-card-${issue.id}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4 }}
                whileHover={{ y: -4 }}
                className="bg-white rounded-3xl overflow-hidden border border-gray-100 hover:border-gray-200 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col md:flex-row h-full md:h-64">
                
                    {/* Card Image */}
                    <div className="relative w-full md:w-64 h-48 md:h-full shrink-0 bg-gray-100">
                      <img
                    src={issue.image}
                    alt={issue.title}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    referrerPolicy="no-referrer" />
                  
                      
                      {/* Floating status tag */}
                      <span className={`absolute top-4 left-4 text-xs font-bold px-3 py-1.5 rounded-full border shadow-md backdrop-blur-xs flex items-center gap-1.5 ${getStatusStyle(issue.status)}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${issue.status === 'Resolved' ? 'bg-emerald-500' : issue.status === 'In Progress' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                        {issue.status}
                      </span>

                      {/* Severity badge */}
                      <span className={`absolute bottom-4 left-4 text-[10px] font-bold px-2 py-1 rounded bg-black/60 text-white backdrop-blur-xs uppercase tracking-wide`}>
                        {issue.severity} severity
                      </span>
                    </div>

                    {/* Card Content */}
                    <div className="flex-1 p-6 flex flex-col justify-between text-left">
                      <div>
                        {/* Reporter & Date */}
                        <div className="flex justify-between items-center text-xs text-gray-400 mb-2">
                          <div className="flex items-center gap-2">
                            <img
                          src={issue.reporter.avatar}
                          alt={issue.reporter.name}
                          className="w-5 h-5 rounded-full object-cover"
                          referrerPolicy="no-referrer" />
                        
                            <span className="font-semibold text-gray-600">{issue.reporter.name}</span>
                          </div>
                          <span>{issue.timestamp}</span>
                        </div>

                        {/* Title */}
                        <h3 className="font-display font-bold text-lg text-gray-900 leading-snug line-clamp-1">
                          {issue.title}
                        </h3>

                        {/* Description */}
                        <p className="text-gray-500 text-xs mt-2 line-clamp-2 leading-relaxed">
                          {issue.description}
                        </p>

                        {/* Location */}
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-4">
                          <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">{issue.location}</span>
                        </div>
                      </div>

                      {/* Interactive Footer (likes & comments count) */}
                      <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-4">
                        <div className="flex items-center gap-4">
                          {/* Like button */}
                          <button
                        onClick={() => likeIssue(issue.id)}
                        className={`flex items-center gap-1.5 text-xs font-semibold py-1 px-2.5 rounded-lg transition-colors ${
                        issue.hasLiked ?
                        'bg-red-50 text-primary' :
                        'text-gray-500 hover:text-primary hover:bg-gray-50'}`
                        }>
                        
                            <Heart className={`h-4 w-4 ${issue.hasLiked ? 'fill-primary text-primary' : ''}`} />
                            <span>{issue.likes}</span>
                          </button>

                          {/* Comments Trigger */}
                          <button
                        onClick={() => setSelectedIssueForDetail(issue)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-primary py-1 px-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                        
                            <MessageSquare className="h-4 w-4" />
                            <span>{issue.comments.length}</span>
                          </button>
                        </div>

                        {/* Details Link */}
                        <button
                      onClick={() => setSelectedIssueForDetail(issue)}
                      className="text-primary hover:text-primary-hover text-xs font-bold transition-all flex items-center gap-1 group/btn">
                      
                          View Progress
                          <span className="group-hover/btn:translate-x-1 transition-transform inline-block">→</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
              )
              }
            </AnimatePresence>
          </div>

        </div>
      </div>

      {/* Full Details Modal including Timeline Tracker and Comments Thread */}
      <AnimatePresence>
        {selectedIssueForDetail &&
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-md">
            <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-4xl w-full h-[85vh] flex flex-col md:flex-row text-left">
            
              
              {/* Left Side: Photo & Timeline (scrollable) */}
              <div className="w-full md:w-1/2 flex flex-col border-r border-gray-100 overflow-y-auto">
                {/* Photo Header */}
                <div className="relative h-56 shrink-0 bg-gray-100">
                  <img
                  src={selectedIssueForDetail.image}
                  alt={selectedIssueForDetail.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer" />
                
                  <button
                  onClick={() => setSelectedIssueForDetail(null)}
                  className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-xs transition-colors">
                  
                    ✕
                  </button>
                  <span className={`absolute top-4 left-4 text-xs font-bold px-3 py-1.5 rounded-full border shadow-md backdrop-blur-xs flex items-center gap-1.5 ${getStatusStyle(selectedIssueForDetail.status)}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${selectedIssueForDetail.status === 'Resolved' ? 'bg-emerald-500' : selectedIssueForDetail.status === 'In Progress' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                    {selectedIssueForDetail.status}
                  </span>
                </div>

                {/* Progress Timeline Section */}
                <div className="p-6 space-y-6">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded">AUTOMATED WORKFLOW TRACKING</span>
                    <h3 className="font-display font-extrabold text-xl text-gray-900 mt-2">Resolution Timeline</h3>
                  </div>

                  {/* Vertically Aligned Step Progress list */}
                  <div className="relative pl-6 space-y-6">
                    {/* Main thread line */}
                    <div className="absolute left-2.5 top-2.5 bottom-2.5 w-0.5 bg-gray-100" />

                    {selectedIssueForDetail.timeline.map((event, idx) => {
                    const isCompleted = event.status === 'completed';
                    return (
                      <div key={idx} className="relative">
                          {/* Circle dot representing step state */}
                          <div className={`absolute -left-[21px] top-1 h-3.5 w-3.5 rounded-full border-2 ${
                        isCompleted ?
                        'bg-success border-success' :
                        'bg-white border-gray-300'}`
                        } />

                          <div>
                            <div className="flex justify-between items-start gap-2">
                              <h4 className={`font-semibold text-xs leading-none ${isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>
                                {event.title}
                              </h4>
                              <span className="text-[10px] text-gray-400 font-medium shrink-0">{event.timestamp}</span>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                              {event.description}
                            </p>
                          </div>
                        </div>);

                  })}
                  </div>
                </div>
              </div>

              {/* Right Side: Header Info, Live Comments feed & input */}
              <div className="w-full md:w-1/2 flex flex-col h-full overflow-hidden">
                {/* Header Information */}
                <div className="p-6 border-b border-gray-100 shrink-0">
                  <div className="flex justify-between items-center text-xs text-gray-400 mb-1.5">
                    <span className="bg-red-50 text-primary font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                      {selectedIssueForDetail.category}
                    </span> 
                    <span>{selectedIssueForDetail.timestamp}</span>
                  </div>

                  <h3 className="font-display font-extrabold text-lg text-gray-900 leading-snug">
                    {selectedIssueForDetail.title}
                  </h3>
                  
                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-2.5">
                    <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span>{selectedIssueForDetail.location}</span>
                  </div>

                  <p className="text-gray-500 text-xs mt-3 leading-relaxed max-h-24 overflow-y-auto">
                    {selectedIssueForDetail.description}
                  </p>
                </div>

                {/* Comments Scroll Container */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
                  <h4 className="font-display font-bold text-xs text-gray-500 uppercase tracking-wider">Comments ({selectedIssueForDetail.comments.length})</h4>
                  
                  {selectedIssueForDetail.comments.length === 0 ?
                <div className="text-center py-8 text-gray-400 text-xs">
                      No comments yet. Start the conversation!
                    </div> :

                selectedIssueForDetail.comments.map((comment) =>
                <div key={comment.id} className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-2xs flex items-start gap-3">
                        <img
                    src={comment.avatar}
                    alt={comment.author}
                    className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                    referrerPolicy="no-referrer" />
                  
                        <div className="flex-1">
                          <div className="flex justify-between items-center text-[11px] text-gray-400 mb-1">
                            <span className="font-bold text-gray-700">{comment.author}</span>
                            <span>{comment.timestamp}</span>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed">
                            {comment.text}
                          </p>
                        </div>
                      </div>
                )
                }
                </div>

                {/* Comment Input Box */}
                <form onSubmit={(e) => handleCommentSubmit(e, selectedIssueForDetail.id)} className="p-4 border-t border-gray-100 bg-white flex gap-2 items-center">
                  <input
                  type="text"
                  placeholder="Ask a question or leave updates..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  className="flex-grow bg-gray-50 border border-gray-100 focus:border-primary/20 rounded-xl py-2 px-4 text-xs focus:outline-hidden text-gray-800" />
                
                  <button
                  type="submit"
                  className="bg-primary hover:bg-primary-hover text-white p-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center shrink-0">
                  
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>

            </motion.div>
          </div>
        }
      </AnimatePresence>

    </section>);

}