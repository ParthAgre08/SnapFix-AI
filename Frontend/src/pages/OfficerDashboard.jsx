import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Inbox,
  Clock,
  CheckCircle,
  BarChart3,
  User,
  LogOut,
  Building,
  Bell,
  AlertTriangle,
  MapPin,
  Calendar,
  AlertCircle,
  UserCheck,
  Upload,
  Check,
  ChevronRight,
  Info,
  Layers,
  Sparkles,
  TrendingUp,
  ShieldAlert,
  Search,
  Filter,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

export default function OfficerDashboard() {
  const navigate = useNavigate();
  const [officer, setOfficer] = useState(null);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    reported: 0,
    in_progress: 0,
    resolved: 0,
    high_priority: 0,
    duplicate: 0,
    today: 0
  });
  const [deptStats, setDeptStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Resolution Form State
  const [resNotes, setResNotes] = useState('');
  const [resImageFile, setResImageFile] = useState(null);
  const [resImagePath, setResImagePath] = useState('');
  const [resImageUploading, setResImageUploading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const fileInputRef = useRef(null);

  // Search and Filter States for Lists
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Notifications State
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  // Analytics & Profile State
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [profileStats, setProfileStats] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Pagination states for reports list
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReports, setTotalReports] = useState(0);
  const limit = 20;

  // Verify authentication on mount
  useEffect(() => {
    const cachedOfficer = localStorage.getItem('pmc_officer');
    if (!cachedOfficer) {
      navigate('/officer/login');
    } else {
      setOfficer(JSON.parse(cachedOfficer));
    }
  }, [navigate]);

  // Consolidated Dashboard fetch
  const fetchDashboardData = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:5000/api/officer/dashboard');
      if (res.data.success) {
        setStats(res.data.stats);
        setDeptStats(res.data.departmentSummary);
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unread_count);
      }
    } catch (err) {
      console.error('Error fetching dashboard consolidated data:', err);
    }
  };

  // Fetch Dashboard consolidated data on mount
  useEffect(() => {
    if (!officer) return;
    fetchDashboardData();

    // Auto-refresh stats and notifications every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);

    return () => clearInterval(interval);
  }, [officer]);

  // Fetch reports when tab, page, or filters change
  useEffect(() => {
    if (!officer) return;

    // Do not fetch reports if not in Reported, In Progress, or Resolved tabs
    if (!['Reported Issues', 'In Progress', 'Resolved Issues'].includes(activeTab)) return;

    const fetchReports = async () => {
      setLoading(true);
      try {
        let statusFilter = '';
        if (activeTab === 'Reported Issues') statusFilter = 'Reported';
        else if (activeTab === 'In Progress') statusFilter = 'In Progress';
        else if (activeTab === 'Resolved Issues') statusFilter = 'Resolved';

        const params = {
          page: currentPage,
          limit: limit,
          status: statusFilter,
          search: searchQuery !== '' ? searchQuery : undefined,
          priority: priorityFilter !== 'All' ? priorityFilter : undefined
        };

        if (categoryFilter !== 'All') {
          params.search = categoryFilter;
        }

        const res = await axios.get('http://127.0.0.1:5000/api/officer/reports', { params });
        if (res.data.success) {
          setReports(res.data.reports);
          setTotalPages(res.data.pagination.pages);
          setTotalReports(res.data.pagination.total);
        }
      } catch (err) {
        console.error('Error fetching reports:', err);
        showToast('Unable to load dashboard reports data.');
      } finally {
        setLoading(false);
      }
    };

    fetchReports();

    // Set up auto-refresh for reports list every 30 seconds
    const interval = setInterval(() => {
      fetchReports();
    }, 30000);

    return () => clearInterval(interval);
  }, [activeTab, currentPage, searchQuery, priorityFilter, categoryFilter, officer]);

  // Fetch Analytics data when tab becomes active
  useEffect(() => {
    if (!officer) return;
    if (activeTab !== 'Department Analytics') return;

    const fetchAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        const res = await axios.get('http://127.0.0.1:5000/api/officer/analytics');
        if (res.data.success) {
          setAnalyticsData(res.data);
        }
      } catch (err) {
        console.error('Error fetching analytics:', err);
        showToast('Unable to load analytics data.');
      } finally {
        setAnalyticsLoading(false);
      }
    };

    fetchAnalytics();
  }, [activeTab, officer]);

  // Fetch Profile data when tab becomes active
  useEffect(() => {
    if (!officer) return;
    if (activeTab !== 'Officer Profile') return;

    const fetchProfile = async () => {
      setProfileLoading(true);
      try {
        const res = await axios.get(`http://127.0.0.1:5000/api/officer/profile?officer_id=${officer.id}`);
        if (res.data.success) {
          setProfileStats(res.data.profile);
        }
      } catch (err) {
        console.error('Error fetching profile stats:', err);
        showToast('Unable to load officer profile stats.');
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [activeTab, officer]);

  // Lazy Fetch report details when report ID changes
  useEffect(() => {
    if (!selectedReportId) {
      setSelectedReport(null);
      return;
    }

    const fetchDetails = async () => {
      setDetailLoading(true);
      try {
        const res = await axios.get(`http://127.0.0.1:5000/api/officer/report/${selectedReportId}`);
        if (res.data.success) {
          setSelectedReport(res.data.report);
          setResNotes('');
          setResImagePath('');
          setResImageFile(null);
        }
      } catch (err) {
        console.error('Error fetching report details:', err);
        showToast('Failed to load report details.');
      } finally {
        setDetailLoading(false);
      }
    };

    fetchDetails();
  }, [selectedReportId]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const handleLogout = () => {
    localStorage.removeItem('pmc_officer');
    navigate('/officer/login');
  };

  // Toggle notifications list dropdown
  const handleToggleNotifications = async () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications && unreadCount > 0) {
      try {
        const res = await axios.post('http://127.0.0.1:5000/api/officer/notifications/read');
        if (res.data.success) {
          setUnreadCount(0);
        }
      } catch (err) {
        console.error('Error marking notifications as read:', err);
      }
    }
  };

  // Accept a report (Take Issue)
  const handleTakeIssue = async (reportId) => {
    if (!officer) return;
    setActionLoading(true);
    try {
      const res = await axios.post('http://127.0.0.1:5000/api/officer/take-issue', {
        reportId,
        officerId: officer.id,
        remarks: `Issue taken up by PMC Officer ${officer.name} (${officer.department})`
      });

      if (res.data.success) {
        showToast('You have successfully accepted this issue!');
        setSelectedReportId(null);
        setActiveTab('In Progress');
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
      showToast('Error taking up the issue.');
    } finally {
      setActionLoading(false);
    }
  };

  // Upload resolution image
  const handleResolutionImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setResImageFile(file);
    setResImageUploading(true);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await axios.post('http://127.0.0.1:5000/api/officer/upload-resolution', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setResImagePath(res.data.imagePath);
        showToast('Resolution image uploaded successfully!');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to upload resolution image.');
    } finally {
      setResImageUploading(false);
    }
  };

  // Resolve an issue
  const handleResolveIssue = async (e) => {
    e.preventDefault();
    if (!selectedReport || !resImagePath || !officer) {
      showToast('Resolution image is required.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await axios.post('http://127.0.0.1:5000/api/officer/resolve-issue', {
        reportId: selectedReport.id,
        officerId: officer.id,
        resolutionImage: resImagePath,
        notes: resNotes,
        department: officer.department
      });

      if (res.data.success) {
        showToast('Issue marked as Resolved. Summary generated!');
        setSelectedReportId(null);
        setActiveTab('Resolved Issues');
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
      showToast('Error resolving the issue. Resolution image is mandatory.');
    } finally {
      setActionLoading(false);
    }
  };

  // Generate Gemini Summary (For Manual Re-generation)
  const handleGenerateSummary = async (reportId) => {
    setActionLoading(true);
    try {
      const res = await axios.post('http://127.0.0.1:5000/api/officer/generate-summary', {
        reportId
      });
      if (res.data.success) {
        showToast('Professional summary successfully re-generated!');
        const detailsRes = await axios.get(`http://127.0.0.1:5000/api/officer/report/${reportId}`);
        if (detailsRes.data.success) {
          setSelectedReport(detailsRes.data.report);
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to generate summary.');
    } finally {
      setActionLoading(false);
    }
  };

  // Format Helper for Date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handlePriorityChange = (e) => {
    setPriorityFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (e) => {
    setCategoryFilter(e.target.value);
    setCurrentPage(1);
  };

  const uniqueCategories = ['All', 'Pothole', 'Garbage', 'Broken Street Light', 'Water Leakage'];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">

      {/* Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-blue-600 border border-blue-400 text-white font-semibold text-sm px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header */}
      <header className="bg-slate-950 border-b border-slate-800/80 sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* PMC Logo Badge */}
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
            <Building className="h-5 w-5 text-amber-500" />
            <span className="font-display font-extrabold text-amber-500 text-xs tracking-wider uppercase">
              PMC Pune
            </span>
          </div>

          <div className="h-5 w-[1px] bg-slate-800" />

          {/* SnapFix AI Logo */}
          <div className="flex items-center gap-1.5">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <span className="font-display font-black text-base tracking-tight text-white">
              SnapFix<span className="text-blue-500 font-bold">AI</span>
            </span>
          </div>
        </div>

        {/* User Info / Controls */}
        <div className="flex items-center gap-6">
          {/* Notifications Indicator */}
          <div className="relative">
            <button
              onClick={handleToggleNotifications}
              className="relative p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-5 h-5 bg-red-600 text-[10px] font-black text-white flex items-center justify-center px-1 rounded-full animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-3 w-80 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50"
                >
                  <div className="px-4 py-3 border-b border-slate-850 flex justify-between items-center bg-slate-900/40">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] bg-red-600/10 border border-red-500/20 text-red-400 font-extrabold px-2 py-0.5 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>

                  <div className="divide-y divide-slate-900 max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No notifications found.
                      </div>
                    ) : (
                      notifications.map((n) => {
                        let typeColor = 'text-blue-500 bg-blue-500/10';
                        if (n.type === 'high_priority') typeColor = 'text-red-500 bg-red-500/10';
                        if (n.type === 'duplicate') typeColor = 'text-violet-500 bg-violet-500/10 font-bold';
                        if (n.type === 'resolved') typeColor = 'text-emerald-500 bg-emerald-500/10';

                        return (
                          <div
                            key={n.id}
                            onClick={() => {
                              if (n.report_id) {
                                setSelectedReportId(n.report_id);
                                if (n.type === 'resolved') {
                                  setActiveTab('Resolved Issues');
                                } else if (n.type === 'assigned') {
                                  setActiveTab('In Progress');
                                } else {
                                  setActiveTab('Reported Issues');
                                }
                              }
                              setShowNotifications(false);
                            }}
                            className={`p-3.5 hover:bg-slate-900/55 cursor-pointer flex gap-3 transition-colors text-left ${!n.is_read ? 'bg-blue-600/[0.02]' : ''}`}
                          >
                            <div className={`p-2 rounded-xl shrink-0 h-9 w-9 flex items-center justify-center ${typeColor}`}>
                              <AlertCircle className="h-4.5 w-4.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-[11px] font-bold text-slate-200 leading-tight">
                                {n.title}
                              </h4>
                              <p className="text-[10px] text-slate-400 leading-normal mt-1 break-words">
                                {n.message}
                              </p>
                              <span className="text-[9px] text-slate-500 block mt-1.5 font-medium">
                                {formatDate(n.created_at)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Officer Tag */}
          {officer && (
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-100 leading-tight">
                {officer.name}
              </span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                {officer.department} • {officer.designation}
              </span>
            </div>
          )}

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-red-950/40 border border-slate-700 hover:border-red-900/60 rounded-xl text-xs text-slate-300 hover:text-red-200 transition-all cursor-pointer font-medium"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Workspace Area */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar Navigation */}
        <aside className="w-64 bg-slate-950/50 border-r border-slate-800/80 p-4 hidden md:flex flex-col gap-1 shrink-0">
          <div className="px-3 mb-4">
            <span className="text-[10px] font-black text-slate-500 tracking-widest uppercase">
              Operations
            </span>
          </div>

          {[
            { name: 'Dashboard', icon: LayoutDashboard },
            { name: 'Reported Issues', icon: Inbox, count: stats.reported },
            { name: 'In Progress', icon: Clock, count: stats.in_progress },
            { name: 'Resolved Issues', icon: CheckCircle, count: stats.resolved },
            { name: 'Department Analytics', icon: BarChart3 },
            { name: 'Officer Profile', icon: User }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.name;
            return (
              <button
                key={item.name}
                onClick={() => {
                  setActiveTab(item.name);
                  setSelectedReportId(null);
                }}
                className={`flex items-center justify-between w-full px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all cursor-pointer ${isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/10'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.name}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                      }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Tab Content Body */}
        <main className="flex-1 p-6 overflow-y-auto flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col justify-center items-center gap-3">
              <div className="w-10 h-10 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-sm text-slate-400 font-semibold">Retrieving PMC Records...</span>
            </div>
          ) : (
            <div className="space-y-6 flex-1 flex flex-col">

              {/* Dashboard Content */}
              {activeTab === 'Dashboard' && (
                <div className="space-y-8 flex-1">

                  {/* Title Bar */}
                  <div>
                    <h1 className="text-2xl font-bold font-display text-white">Pune Municipal Operations</h1>
                    <p className="text-slate-400 text-xs mt-1">
                      PMC Central Ward Central Command Center • Real-time Civic Dispatch
                    </p>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {[
                      { label: 'Total Reports', val: stats.total, color: 'border-slate-800 text-slate-100 bg-slate-900/30' },
                      { label: 'Reported', val: stats.reported, color: 'border-blue-500/20 text-blue-400 bg-blue-500/[0.02]' },
                      { label: 'In Progress', val: stats.in_progress, color: 'border-amber-500/20 text-amber-400 bg-amber-500/[0.02]' },
                      { label: 'Resolved', val: stats.resolved, color: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/[0.02]' },
                      { label: 'High Priority', val: stats.high_priority, color: 'border-red-500/20 text-red-400 bg-red-500/[0.02]' },
                      { label: 'Duplicate Reports', val: stats.duplicate, color: 'border-violet-500/20 text-violet-400 bg-violet-500/[0.02]' },
                      { label: 'Today\'s Reports', val: stats.today, color: 'border-cyan-500/20 text-cyan-400 bg-cyan-500/[0.02]' }
                    ].map((card, i) => (
                      <div
                        key={i}
                        className={`border rounded-2xl p-5 flex flex-col justify-between h-28 hover:border-slate-700/80 transition-all ${card.color}`}
                      >
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block leading-tight">
                          {card.label}
                        </span>
                        <span className="text-2xl font-black tracking-tight mt-2">{card.val}</span>
                      </div>
                    ))}
                  </div>

                  {/* Department-wise Pending Issues */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-blue-500" />
                      <h2 className="text-lg font-bold text-white">Department-wise Dispatch</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {deptStats.map((dept, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-950/40 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-6 space-y-4 shadow-sm hover:shadow-md transition-all text-left"
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-white text-sm">{dept.name}</h3>
                            <div className="bg-slate-900 p-2 rounded-xl text-blue-400">
                              <Building className="h-4 w-4" />
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed min-h-8">
                            Municipal agency handling dispatched reports for {dept.name.toLowerCase()}.
                          </p>

                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-slate-900 text-left">
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase block">Reported</span>
                              <span className="text-sm font-black text-blue-400">{dept.reported}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase block">In Progress</span>
                              <span className="text-sm font-black text-amber-400">{dept.in_progress}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase block">Resolved</span>
                              <span className="text-sm font-black text-emerald-400">{dept.resolved}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase block">Priority</span>
                              <span className="text-sm font-black text-red-400">{dept.high_priority}</span>
                            </div>
                            <div className="col-span-2 pt-1 border-t border-slate-900/60 flex justify-between items-center">
                              <span className="text-[9px] font-bold text-slate-500 uppercase">Avg Speed</span>
                              <span className="text-xs font-bold text-slate-300">{dept.avg_resolution_time}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Lists (Reported, In Progress, Resolved) */}
              {(activeTab === 'Reported Issues' || activeTab === 'In Progress' || activeTab === 'Resolved Issues') && (
                <div className="flex-1 flex gap-6 overflow-hidden">

                  {/* Left Column: Filterable List */}
                  <div className="w-[45%] flex flex-col gap-4 overflow-y-auto pr-2">

                    {/* List Title */}
                    <div>
                      <h1 className="text-2xl font-bold text-white font-display">{activeTab}</h1>
                      <p className="text-slate-400 text-xs mt-1">
                        {totalReports} records retrieved from SnapFix database.
                      </p>
                    </div>

                    {/* Filters block */}
                    <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Search location, category, report ID..."
                          value={searchQuery}
                          onChange={handleSearchChange}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
                        />
                      </div>

                      {/* Filters */}
                      <div className="flex gap-2">
                        <select
                          value={priorityFilter}
                          onChange={handlePriorityChange}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300 outline-none"
                        >
                          <option value="All">All Priorities</option>
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Urgent">Urgent</option>
                        </select>

                        <select
                          value={categoryFilter}
                          onChange={handleCategoryChange}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-300 outline-none"
                        >
                          <option value="All">All Categories</option>
                          {uniqueCategories.filter(cat => cat !== 'All').map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Cards Container */}
                    <div className="space-y-4 flex-1">
                      {reports.length === 0 ? (
                        <div className="border border-slate-800/60 rounded-2xl p-10 text-center text-slate-500 text-xs">
                          {activeTab === 'Resolved Issues' ? 'No resolved issue history available.' : 'No matching issues found.'}
                        </div>
                      ) : (
                        reports.map((report) => (
                          <div
                            key={report.id}
                            onClick={() => setSelectedReportId(report.id)}
                            className={`border rounded-2xl p-4 flex gap-4 cursor-pointer hover:border-slate-700 transition-all text-left ${selectedReportId === report.id
                                ? 'bg-blue-500/10 border-blue-500'
                                : 'bg-slate-950/20 border-slate-800/80'
                              }`}
                          >
                            {/* Issue Thumbnail */}
                            <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-800 shrink-0 relative">
                              <img
                                src={`http://127.0.0.1:5000/${report.uploaded_image}`}
                                alt="Report path"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.src = 'https://images.unsplash.com/photo-1599740831464-59bb078f1918?auto=format&fit=crop&q=80&w=200';
                                }}
                              />
                              {report.priority === 'Urgent' && (
                                <div className="absolute top-1 left-1 bg-red-600 text-[8px] font-black uppercase text-white px-1.5 py-0.5 rounded-sm">
                                  Urgent
                                </div>
                              )}
                            </div>

                            {/* Content Details */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-start gap-1">
                                  <h3 className="font-bold text-white text-xs truncate">
                                    #{report.id}: {report.issue_type}
                                  </h3>
                                  <span
                                    className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${report.severity === 'Critical' || report.severity === 'High'
                                        ? 'bg-red-500/20 text-red-400'
                                        : 'bg-amber-500/20 text-amber-400'
                                      }`}
                                  >
                                    {report.severity}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 text-slate-400 text-[10px] mt-1 truncate">
                                  <MapPin className="h-3 w-3 shrink-0 text-slate-500" />
                                  <span>{report.location}</span>
                                </div>

                                {/* Dynamic Visual Badges */}
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {report.badges?.ai_generated && (
                                    <span className="text-[7px] font-black uppercase tracking-wider bg-blue-600/10 text-blue-400 border border-blue-500/10 px-1 rounded">
                                      AI Generated
                                    </span>
                                  )}
                                  {report.badges?.duplicate && (
                                    <span className="text-[7px] font-black uppercase tracking-wider bg-violet-600/10 text-violet-400 border border-violet-500/10 px-1 rounded">
                                      Duplicate
                                    </span>
                                  )}
                                  {report.badges?.high_priority && (
                                    <span className="text-[7px] font-black uppercase tracking-wider bg-red-600/10 text-red-400 border border-red-500/10 px-1 rounded">
                                      High Priority
                                    </span>
                                  )}
                                  {report.badges?.urgent && (
                                    <span className="text-[7px] font-black uppercase tracking-wider bg-amber-600/10 text-amber-400 border border-amber-500/10 px-1 rounded">
                                      Urgent
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[9px] text-slate-500 mt-2">
                                <span>Confidence: {report.ai_confidence_score}%</span>
                                <span>{formatDate(report.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-4 border-t border-slate-900 bg-slate-950/20 px-2 rounded-xl mt-4">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-800 text-xs px-3 py-1.5 rounded-xl cursor-pointer disabled:cursor-not-allowed font-semibold text-slate-300 transition-all"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                          Prev
                        </button>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                          Page {currentPage} of {totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-800 text-xs px-3 py-1.5 rounded-xl cursor-pointer disabled:cursor-not-allowed font-semibold text-slate-300 transition-all"
                        >
                          Next
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Details Pane */}
                  <div className="w-[55%] bg-slate-950/40 border border-slate-800/80 rounded-[32px] overflow-hidden flex flex-col">
                    {detailLoading ? (
                      <div className="flex-1 flex flex-col justify-center items-center gap-3">
                        <div className="w-8 h-8 border-3 border-slate-800 border-t-blue-500 rounded-full animate-spin" />
                        <span className="text-xs text-slate-400">Loading details...</span>
                      </div>
                    ) : selectedReport ? (
                      <div className="flex-1 flex flex-col overflow-y-auto">

                        {/* Images comparison section */}
                        {selectedReport.status === 'Resolved' ? (
                          <div className="grid grid-cols-3 gap-[1px] bg-slate-800 h-60 shrink-0 relative">
                            <div className="relative">
                              <span className="absolute bottom-3 left-3 bg-slate-950/80 text-[8px] font-bold tracking-wider text-slate-300 px-2 py-1 rounded z-10">
                                BEFORE (CITIZEN UPLOAD)
                              </span>
                              <img
                                src={`http://127.0.0.1:5000/${selectedReport.uploaded_image}`}
                                alt="Original report"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.src = 'https://images.unsplash.com/photo-1599740831464-59bb078f1918?auto=format&fit=crop&q=80&w=400';
                                }}
                              />
                            </div>

                            <div className="relative bg-slate-900">
                              <span className="absolute bottom-3 left-3 bg-blue-950/90 text-[8px] font-bold tracking-wider text-blue-300 px-2 py-1 rounded z-10 flex items-center gap-1">
                                <Sparkles className="h-3 w-3 text-blue-400" />
                                AI ANNOTATED
                              </span>
                              <img
                                src={`http://127.0.0.1:5000/${selectedReport.annotated_image || selectedReport.uploaded_image}`}
                                alt="AI annotated report"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.src = 'https://images.unsplash.com/photo-1599740831464-59bb078f1918?auto=format&fit=crop&q=80&w=400';
                                }}
                              />
                            </div>

                            <div className="relative bg-slate-900">
                              <span className="absolute bottom-3 left-3 bg-emerald-950/90 text-[8px] font-bold tracking-wider text-emerald-300 px-2 py-1 rounded z-10 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3 text-emerald-400" />
                                AFTER (OFFICER UPLOAD)
                              </span>
                              <img
                                src={`http://127.0.0.1:5000/${selectedReport.assignments_history[0]?.resolution_image || selectedReport.uploaded_image}`}
                                alt="Resolution path"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.src = 'https://images.unsplash.com/photo-1599740831464-59bb078f1918?auto=format&fit=crop&q=80&w=400';
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-[1px] bg-slate-800 h-60 shrink-0 relative">
                            <div className="relative">
                              <span className="absolute bottom-3 left-3 bg-slate-950/80 text-[9px] font-bold tracking-wider text-slate-300 px-2.5 py-1.5 rounded-lg z-10">
                                ORIGINAL IMAGE
                              </span>
                              <img
                                src={`http://127.0.0.1:5000/${selectedReport.uploaded_image}`}
                                alt="Original report"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.src = 'https://images.unsplash.com/photo-1599740831464-59bb078f1918?auto=format&fit=crop&q=80&w=400';
                                }}
                              />
                            </div>

                            <div className="relative bg-slate-900">
                              <span className="absolute bottom-3 left-3 bg-blue-950/90 text-[9px] font-bold tracking-wider text-blue-300 px-2.5 py-1.5 rounded-lg z-10 flex items-center gap-1.5">
                                <Sparkles className="h-3 w-3 text-blue-400" />
                                AI ANNOTATED DETECTION
                              </span>
                              <img
                                src={`http://127.0.0.1:5000/${selectedReport.annotated_image || selectedReport.uploaded_image}`}
                                alt="AI annotated report"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.src = 'https://images.unsplash.com/photo-1599740831464-59bb078f1918?auto=format&fit=crop&q=80&w=400';
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Content section */}
                        <div className="p-6 space-y-6 flex-1">

                          {/* Heading info */}
                          <div>
                            <div className="flex justify-between items-start gap-4">
                              <h2 className="text-xl font-bold text-white font-display leading-snug">
                                {selectedReport.ai_title || `Report #${selectedReport.id}`}
                              </h2>
                              <span
                                className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full shrink-0 border ${selectedReport.status === 'Resolved'
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                    : selectedReport.status === 'In Progress'
                                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                      : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                  }`}
                              >
                                {selectedReport.status}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 text-slate-400 text-xs mt-2">
                              <MapPin className="h-4 w-4 shrink-0 text-slate-500" />
                              <span>{selectedReport.location}</span>
                            </div>
                          </div>

                          {/* Grid info details */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase block">Issue Type</span>
                              <span className="text-xs font-bold text-slate-200 mt-0.5 block">{selectedReport.issue_type}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase block">Priority</span>
                              <span className="text-xs font-bold text-slate-200 mt-0.5 block">{selectedReport.priority}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase block">Severity</span>
                              <span className="text-xs font-bold text-slate-200 mt-0.5 block">{selectedReport.severity}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase block">Road Damage %</span>
                              <span className="text-xs font-bold text-blue-400 mt-0.5 block">
                                {selectedReport.road_damage_percentage || '18%'}
                              </span>
                            </div>
                          </div>

                          {/* Reporter information */}
                          <div className="p-4 bg-slate-900/20 border border-slate-800/50 rounded-2xl space-y-2.5">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Reporter Details</h3>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                              <div>
                                <span className="text-slate-500 font-semibold">Name:</span>{' '}
                                <span className="text-slate-300">{selectedReport.reporter_name}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 font-semibold">Email:</span>{' '}
                                <span className="text-slate-300">{selectedReport.reporter_email}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-slate-500 font-semibold">Reporter ID:</span>{' '}
                                <span className="text-slate-400 font-mono text-[11px]">
                                  {selectedReport.reporter_uid}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 font-semibold">Report Time:</span>{' '}
                                <span className="text-slate-300">{formatDate(selectedReport.created_at)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Descriptions Section */}
                          <div className="space-y-4">
                            {/* Citizen Input */}
                            <div className="space-y-1.5">
                              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                Citizen Description
                              </h3>
                              <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/30 p-3.5 border border-slate-800/40 rounded-xl">
                                {selectedReport.user_description || 'No description provided.'}
                              </p>
                            </div>

                            {/* AI Generated Content */}
                            <div className="space-y-1.5">
                              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                                <Sparkles className="h-3.5 w-3.5" />
                                AI Generated Description
                              </h3>
                              <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/30 p-3.5 border border-slate-800/40 rounded-xl">
                                {selectedReport.ai_description}
                              </p>
                            </div>

                            {/* AI Recommended Action */}
                            <div className="space-y-1.5">
                              <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider">
                                AI Recommended Action
                              </h3>
                              <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/30 p-3.5 border border-slate-800/40 rounded-xl">
                                {selectedReport.recommended_action || 'Inspect the issue location and assign repairs.'}
                              </p>
                            </div>
                          </div>

                          {/* Resolution Info (Visible on Resolved Issues tab) */}
                          {activeTab === 'Resolved Issues' && (
                            <div className="space-y-6 pt-4 border-t border-slate-800">

                              {/* Resolution Summary */}
                              <div className="bg-emerald-950/20 border border-emerald-900/40 p-5 rounded-2xl space-y-2.5">
                                <div className="flex justify-between items-center">
                                  <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Gemini Resolution Summary
                                  </h3>
                                  <button
                                    onClick={() => handleGenerateSummary(selectedReport.id)}
                                    disabled={actionLoading}
                                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-md font-semibold cursor-pointer shrink-0 disabled:opacity-50"
                                  >
                                    Re-Generate Summary
                                  </button>
                                </div>
                                <p className="text-xs text-emerald-100/90 leading-relaxed italic">
                                  "{selectedReport.resolution_summary || 'No resolution summary generated yet.'}"
                                </p>
                              </div>

                              {/* Officer Notes */}
                              <div className="space-y-1.5">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                  Officer Completion Notes
                                </h3>
                                <p className="text-xs text-slate-300 bg-slate-900/30 p-3.5 border border-slate-800/40 rounded-xl">
                                  {selectedReport.assignments_history[0]?.officer_notes || 'No closing notes logged.'}
                                </p>
                              </div>

                              {/* Officer Details & Speed Metadata */}
                              <div className="p-4 bg-slate-900/20 border border-slate-800/50 rounded-2xl space-y-3 text-left">
                                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Resolution Metadata</h3>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                  <div>
                                    <span className="text-slate-500 font-semibold">Resolved Officer:</span>{' '}
                                    <span className="text-slate-300">
                                      {selectedReport.assigned_officer?.name || 'Assigned Officer'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 font-semibold">Department:</span>{' '}
                                    <span className="text-slate-300">
                                      {selectedReport.assigned_officer?.department || 'Road Department'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 font-semibold">Resolution Time:</span>{' '}
                                    <span className="text-slate-300">{formatDate(selectedReport.resolved_at)}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 font-semibold">Total Turnaround:</span>{' '}
                                    <span className="text-blue-400 font-bold">{selectedReport.total_resolution_time}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Workflow Timeline */}
                              <div className="space-y-4">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                  Resolution Timeline
                                </h3>
                                <div className="relative border-l border-slate-800 pl-4 ml-2 space-y-4 text-xs">
                                  {selectedReport.workflow_history && selectedReport.workflow_history.map((step, idx) => (
                                    <div key={idx} className="relative">
                                      {/* dot */}
                                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-800 border border-blue-500" />
                                      <div className="font-semibold text-slate-200">
                                        {step.action} ({step.previous_status} → {step.new_status})
                                      </div>
                                      <div className="text-[10px] text-slate-500 mt-0.5">
                                        Performed by {step.performed_by} • {formatDate(step.created_at)}
                                      </div>
                                      {step.remarks && (
                                        <div className="text-slate-400 mt-1 leading-relaxed text-[11px]">
                                          Remarks: {step.remarks}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Workflow Actions Section */}
                          <div className="pt-6 border-t border-slate-850">
                            {/* Take Issue (Reported Tab) */}
                            {activeTab === 'Reported Issues' && (
                              <button
                                onClick={() => handleTakeIssue(selectedReport.id)}
                                disabled={actionLoading}
                                className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm py-4 rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-xl transition-all"
                              >
                                {actionLoading ? (
                                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                  <>
                                    <UserCheck className="h-4 w-4" />
                                    <span>Take Issue & Assign Department</span>
                                  </>
                                )}
                              </button>
                            )}

                            {/* Resolve Issue Form (In Progress Tab) */}
                            {activeTab === 'In Progress' && (
                              <form onSubmit={handleResolveIssue} className="space-y-4">
                                <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider block">
                                  Officer Resolution Panel
                                </h3>

                                {/* Upload Image Field */}
                                <div className="space-y-2">
                                  <label className="text-xs font-semibold text-slate-400 block">
                                    Upload Resolution Image (Required)
                                  </label>

                                  <div className="flex gap-4 items-center">
                                    <button
                                      type="button"
                                      onClick={() => fileInputRef.current.click()}
                                      disabled={resImageUploading}
                                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                    >
                                      <Upload className="h-3.5 w-3.5" />
                                      <span>Select Image</span>
                                    </button>

                                    <input
                                      type="file"
                                      accept="image/*"
                                      ref={fileInputRef}
                                      onChange={handleResolutionImageUpload}
                                      className="hidden"
                                    />

                                    {resImageUploading && (
                                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                        <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin" />
                                        <span>Saving image to server...</span>
                                      </div>
                                    )}

                                    {resImagePath && (
                                      <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                                        <Check className="h-3.5 w-3.5" />
                                        Uploaded (res_image.jpg)
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Notes Input */}
                                <div className="space-y-1.5">
                                  <label className="text-xs font-semibold text-slate-400 block">
                                    Officer Completion Notes
                                  </label>
                                  <textarea
                                    required
                                    rows={3}
                                    placeholder="Provide detailed notes on the repair work done, materials used, and final safety status..."
                                    value={resNotes}
                                    onChange={(e) => setResNotes(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500/50 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none transition-all"
                                  />
                                </div>

                                {/* Submit button */}
                                <button
                                  type="submit"
                                  disabled={actionLoading || !resImagePath}
                                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 active:bg-emerald-700 text-white font-bold text-sm py-4 rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-xl transition-all"
                                >
                                  {actionLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                  ) : (
                                    <>
                                      <CheckCircle className="h-4 w-4" />
                                      <span>Mark Issue as Resolved</span>
                                    </>
                                  )}
                                </button>
                              </form>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col justify-center items-center p-8 text-center text-slate-500">
                        <Info className="h-8 w-8 mb-2 text-slate-600" />
                        <span className="text-xs font-medium">Select a report from the list to view original images, AI analysis, locations, and actions.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Department Analytics Tab */}
              {activeTab === 'Department Analytics' && (
                <div className="space-y-8 flex-1">
                  <div>
                    <h1 className="text-2xl font-bold text-white font-display">Department Performance Analytics</h1>
                    <p className="text-slate-400 text-xs mt-1">
                      Historical resolution speeds, category distributions, workloads, and efficiency ratios.
                    </p>
                  </div>

                  {analyticsLoading || !analyticsData ? (
                    <div className="flex-1 flex flex-col justify-center items-center gap-3 py-20">
                      <div className="w-8 h-8 border-3 border-slate-800 border-t-blue-500 rounded-full animate-spin" />
                      <span className="text-xs text-slate-400">Loading operational analytics...</span>
                    </div>
                  ) : (
                    <div className="space-y-8 text-left">
                      {/* Grid of Averages and KPIs */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average AI Confidence</span>
                          <span className="text-2xl font-black text-blue-400 mt-2 block">
                            {analyticsData.department_analytics?.length > 0
                              ? (analyticsData.department_analytics.reduce((acc, curr) => acc + curr.avg_confidence, 0) / analyticsData.department_analytics.length).toFixed(1)
                              : '0.0'}%
                          </span>
                        </div>
                        <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Road Damage %</span>
                          <span className="text-2xl font-black text-rose-400 mt-2 block">
                            {analyticsData.department_analytics?.length > 0
                              ? (analyticsData.department_analytics.reduce((acc, curr) => acc + curr.avg_damage_pct, 0) / analyticsData.department_analytics.length).toFixed(1)
                              : '0.0'}%
                          </span>
                        </div>
                        <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duplicate Issues Ratio</span>
                          <span className="text-2xl font-black text-violet-400 mt-2 block">
                            {analyticsData.department_analytics?.length > 0
                              ? (analyticsData.department_analytics.reduce((acc, curr) => acc + curr.duplicate_pct, 0) / analyticsData.department_analytics.length).toFixed(1)
                              : '0.0'}%
                          </span>
                        </div>
                        <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Dispatched Reports</span>
                          <span className="text-2xl font-black text-slate-200 mt-2 block">
                            {analyticsData.department_analytics?.reduce((acc, curr) => acc + curr.total_reports, 0) || 0}
                          </span>
                        </div>
                      </div>

                      {/* Charts Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Chart 1: Reports by Department */}
                        <div className="bg-slate-950/40 border border-slate-800/80 rounded-[32px] p-6 space-y-4">
                          <h3 className="font-bold text-white text-sm">Reports by Department</h3>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={analyticsData.by_department}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="department" stroke="#94a3b8" fontSize={10} />
                                <YAxis stroke="#94a3b8" fontSize={10} />
                                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '12px' }} labelStyle={{ fontWeight: 'bold' }} />
                                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Chart 2: Resolution Performance */}
                        <div className="bg-slate-950/40 border border-slate-800/80 rounded-[32px] p-6 space-y-4">
                          <h3 className="font-bold text-white text-sm">Resolution Performance (Avg Days to Complete)</h3>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={analyticsData.resolution_performance} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis type="number" stroke="#94a3b8" fontSize={10} />
                                <YAxis dataKey="department" type="category" stroke="#94a3b8" fontSize={10} width={100} />
                                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '12px' }} />
                                <Bar dataKey="avg_days" fill="#10b981" radius={[0, 6, 6, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Chart 3: Issue Category Distribution */}
                        <div className="bg-slate-950/40 border border-slate-800/80 rounded-[32px] p-6 space-y-4">
                          <h3 className="font-bold text-white text-sm">Issue Category Distribution</h3>
                          <div className="h-64 flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={analyticsData.by_category}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={80}
                                  paddingAngle={4}
                                  dataKey="count"
                                  nameKey="category"
                                >
                                  {analyticsData.by_category?.map((entry, index) => {
                                    const colors = ['#f43f5e', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899'];
                                    return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                  })}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '12px' }} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" fontSize={10} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Chart 4: Report Status Distribution */}
                        <div className="bg-slate-950/40 border border-slate-800/80 rounded-[32px] p-6 space-y-4">
                          <h3 className="font-bold text-white text-sm">Report Status Distribution</h3>
                          <div className="h-64 flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={analyticsData.by_status}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={80}
                                  paddingAngle={4}
                                  dataKey="count"
                                  nameKey="status"
                                >
                                  {analyticsData.by_status?.map((entry, index) => {
                                    const statusColors = {
                                      'Reported': '#3b82f6',
                                      'In Progress': '#f59e0b',
                                      'Resolved': '#10b981'
                                    };
                                    return <Cell key={`cell-${index}`} fill={statusColors[entry.status] || '#94a3b8'} />;
                                  })}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '12px' }} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" fontSize={10} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Chart 5: Priority Distribution */}
                        <div className="bg-slate-950/40 border border-slate-800/80 rounded-[32px] p-6 space-y-4">
                          <h3 className="font-bold text-white text-sm">Priority Distribution</h3>
                          <div className="h-64 flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={analyticsData.by_priority}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={0}
                                  outerRadius={80}
                                  paddingAngle={2}
                                  dataKey="count"
                                  nameKey="priority"
                                >
                                  {analyticsData.by_priority?.map((entry, index) => {
                                    const priorityColors = {
                                      'Low': '#94a3b8',
                                      'Medium': '#3b82f6',
                                      'High': '#f97316',
                                      'Urgent': '#ef4444'
                                    };
                                    return <Cell key={`cell-${index}`} fill={priorityColors[entry.priority] || '#64748b'} />;
                                  })}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '12px' }} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" fontSize={10} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Chart 6: Monthly Reports Trend */}
                        <div className="bg-slate-950/40 border border-slate-800/80 rounded-[32px] p-6 space-y-4">
                          <h3 className="font-bold text-white text-sm">Monthly Reports Trend</h3>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={analyticsData.monthly_trend}>
                                <defs>
                                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} />
                                <YAxis stroke="#94a3b8" fontSize={10} />
                                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '12px' }} />
                                <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      {/* Detailed Department Metrics Table */}
                      <div className="bg-slate-950/40 border border-slate-800/80 rounded-[32px] p-6 overflow-x-auto text-left">
                        <h3 className="font-bold text-white text-sm mb-4">Agency Performance Metrics</h3>
                        <table className="w-full text-xs text-slate-300">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                              <th className="pb-3 text-left">Agency</th>
                              <th className="pb-3 text-center">Total Reports</th>
                              <th className="pb-3 text-center">Avg AI Confidence</th>
                              <th className="pb-3 text-center">Avg Damage %</th>
                              <th className="pb-3 text-center">Avg Resolution Speed</th>
                              <th className="pb-3 text-center">Duplicate Rate</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900">
                            {analyticsData.department_analytics?.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-900/30">
                                <td className="py-4 font-bold text-slate-200">{item.name}</td>
                                <td className="py-4 text-center">{item.total_reports}</td>
                                <td className="py-4 text-center text-blue-400 font-bold">{item.avg_confidence}%</td>
                                <td className="py-4 text-center text-rose-400 font-bold">{item.avg_damage_pct}%</td>
                                <td className="py-4 text-center text-emerald-400 font-bold">{item.avg_resolution_time}</td>
                                <td className="py-4 text-center text-violet-400 font-bold">{item.duplicate_pct}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Officer Profile Tab */}
              {activeTab === 'Officer Profile' && officer && (
                <div className="space-y-8 flex-1 max-w-2xl mx-auto pt-6 text-left">
                  {profileLoading || !profileStats ? (
                    <div className="bg-slate-950/40 border border-slate-800/80 rounded-[32px] p-8 text-center flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-3 border-slate-800 border-t-blue-500 rounded-full animate-spin" />
                      <span className="text-xs text-slate-400">Loading profile statistics...</span>
                    </div>
                  ) : (
                    <div className="bg-slate-950/40 border border-slate-800/80 rounded-[32px] p-8 space-y-8">
                      {/* Avatar & Header */}
                      <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b border-slate-900 text-center sm:text-left">
                        <div className="w-20 h-20 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/10 shrink-0">
                          <User className="h-10 w-10" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-black text-white font-display leading-tight">{profileStats.name}</h2>
                          <p className="text-slate-400 text-xs uppercase tracking-wider font-extrabold mt-1">
                            {profileStats.designation} • {profileStats.department}
                          </p>
                          <span className="inline-block bg-slate-900 border border-slate-800 text-[10px] text-slate-400 px-3 py-1 rounded-xl mt-3 font-mono">
                            Employee ID: {profileStats.employee_code}
                          </span>
                        </div>
                      </div>

                      {/* Expanded Duty Stats Grid */}
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Operational Success Metrics</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4.5 bg-slate-900/30 border border-slate-850 rounded-2xl flex flex-col justify-between h-24">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Assigned Today</span>
                            <span className="text-2xl font-black text-slate-200 mt-2 block">{profileStats.assigned_today}</span>
                          </div>
                          <div className="p-4.5 bg-slate-900/30 border border-slate-850 rounded-2xl flex flex-col justify-between h-24">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Resolved Today</span>
                            <span className="text-2xl font-black text-emerald-400 mt-2 block">{profileStats.resolved_today}</span>
                          </div>
                          <div className="p-4.5 bg-slate-900/30 border border-slate-850 rounded-2xl flex flex-col justify-between h-24">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Active Issues</span>
                            <span className="text-2xl font-black text-amber-500 mt-2 block">{profileStats.active_issues}</span>
                          </div>
                          <div className="p-4.5 bg-slate-900/30 border border-slate-850 rounded-2xl flex flex-col justify-between h-24">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Success Rate</span>
                            <span className="text-2xl font-black text-blue-400 mt-2 block">{profileStats.success_rate}</span>
                          </div>
                        </div>
                      </div>

                      {/* General Metadata */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-900">
                        <div className="p-4.5 bg-slate-900/10 border border-slate-850 rounded-2xl">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Duty Email</span>
                          <span className="text-xs font-bold text-slate-300 mt-1 block break-all font-mono">
                            {profileStats.email}
                          </span>
                        </div>
                        <div className="p-4.5 bg-slate-900/10 border border-slate-850 rounded-2xl">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">Avg Speed (All Time)</span>
                          <span className="text-xs font-bold text-slate-300 mt-1 block">
                            {profileStats.avg_resolution_time}
                          </span>
                        </div>
                      </div>

                      {/* Duty Station Info */}
                      <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-start gap-3">
                        <Building className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs font-bold text-blue-400 block">Duty Station Location</span>
                          <span className="text-xs text-slate-300 leading-relaxed mt-1 block">
                            Pune Municipal Corporation (PMC) Main Building, Shivaji Nagar, Pune, Maharashtra 411005
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </main>
      </div>

    </div>
  );
}
