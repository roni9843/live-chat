import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { Eye, MessageSquare, Globe, ArrowRight, Activity, Compass, Flame, ShieldAlert, Monitor, ArrowUpRight, Award } from 'lucide-react';
import useAuthStore from '../store/authStore';
import useChatStore from '../store/chatStore';

const API_URL = import.meta.env.VITE_API_URL || 'https://jh5nng6t-5000.asse.devtunnels.ms';

function LiveTracking() {
  const { user } = useAuthStore();
  const { setActiveSessionId } = useChatStore();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWidgetFilter, setSelectedWidgetFilter] = useState('all');
  const [hoveredBar, setHoveredBar] = useState(null);

  useEffect(() => {
    if (!user) return;

    const socket = io(API_URL);

    socket.emit('merchant_join', user._id);

    socket.on('all_sessions', (data) => {
      setSessions(data || []);
      setLoading(false);
    });

    socket.on('session_updated', (updatedSession) => {
      if (!updatedSession || !updatedSession._id) return;
      setSessions(prev => {
        const filtered = prev.filter(s => s && s._id !== updatedSession._id);
        return [updatedSession, ...filtered];
      });
    });

    socket.on('new_session', (newSession) => {
      if (!newSession || !newSession._id) return;
      setSessions(prev => {
        const filtered = prev.filter(s => s && s._id !== newSession._id);
        return [newSession, ...filtered];
      });
    });

    socket.on('session_deleted', ({ sessionId }) => {
      if (!sessionId) return;
      setSessions(prev => prev.filter(s => s && s._id !== sessionId));
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  // Filter all visitor sessions (including offline ones)
  const allVisitors = sessions.filter(s => 
    s &&
    !s.isGroupChat && 
    !s.isDirectMessage && 
    s.widgetId !== 'group_chat'
  );

  // Group by widget / domain (only count online/active visitors for widget share)
  const widgetGroups = {};
  allVisitors.forEach(v => {
    if (v.visitorStatus === 'offline') return;
    const key = v.widgetId || 'default';
    const domain = v.visitorDomain || 'Unknown Site';
    if (!widgetGroups[key]) {
      widgetGroups[key] = {
        widgetId: key,
        domain: domain,
        count: 0,
        visitors: []
      };
    }
    widgetGroups[key].count += 1;
    widgetGroups[key].visitors.push(v);
  });

  const widgetBreakdown = Object.values(widgetGroups).sort((a, b) => b.count - a.count);

  // Apply widget filter to all visitors
  const filteredVisitors = selectedWidgetFilter === 'all' 
    ? allVisitors 
    : allVisitors.filter(v => v.widgetId === selectedWidgetFilter);

  // Sort: Chat Open first, then Online (Browsing), then Offline
  const sortedVisitors = [...filteredVisitors].sort((a, b) => {
    const score = (status) => (status === 'opened' ? 2 : (status === 'online' ? 1 : 0));
    return score(b.visitorStatus) - score(a.visitorStatus);
  });

  const handleChatNow = (sessionId) => {
    setActiveSessionId(sessionId);
    navigate('/');
  };

  // Analytics Metrics
  const activeVisitors = allVisitors.filter(v => v.visitorStatus !== 'offline');
  const totalOnline = activeVisitors.length;
  const uniqueDomains = new Set(activeVisitors.map(v => v.visitorDomain).filter(Boolean)).size;
  
  // Find top page
  const pageCounts = {};
  activeVisitors.forEach(v => {
    const path = v.visitorPath || '/';
    pageCounts[path] = (pageCounts[path] || 0) + 1;
  });
  let topPage = 'N/A';
  let maxCount = 0;
  Object.entries(pageCounts).forEach(([path, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topPage = path;
    }
  });

  // Simulated Hourly stats (Today vs Yesterday) for animated bar chart
  const todayHourlyStats = [12, 19, 15, 8, 22, totalOnline * 3 + 4, totalOnline * 4 + 7, totalOnline * 2 + 3];
  const yesterdayHourlyStats = [10, 15, 12, 14, 18, 25, 20, 15];
  const timeLabels = ['10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM', '6:00 PM', '8:00 PM', '10:00 PM', '12:00 AM'];

  return (
    <div className="p-6 space-y-6 bg-slate-900 min-h-screen text-slate-100 font-sans">
      
      {/* Dynamic Background Glowing Blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Premium Glassmorphic Header */}
      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-800/40 backdrop-blur-xl p-6 rounded-3xl border border-slate-700/50 shadow-2xl">
        <div className="flex items-center space-x-4">
          <div className="relative w-14 h-14 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-2xl flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
            <Eye size={28} className="animate-pulse" />
            <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
            <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full" />
          </div>
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-emerald-400 via-teal-200 to-blue-400 bg-clip-text text-transparent">Live Visitor Radar</h1>
            <p className="text-xs text-slate-400 mt-1">Real-time graphic monitoring and site traffic analytics</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Widget Selector */}
          <select 
            value={selectedWidgetFilter}
            onChange={(e) => setSelectedWidgetFilter(e.target.value)}
            className="bg-slate-800/90 border border-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl outline-none focus:border-emerald-500 transition-colors"
          >
            <option value="all">All Connected Widgets</option>
            {widgetBreakdown.map(wb => (
              <option key={wb.widgetId} value={wb.widgetId}>{wb.domain}</option>
            ))}
          </select>

          <div className="flex items-center space-x-2.5 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-xl shadow-inner">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 absolute" />
            <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider">{totalOnline} Active Online</span>
          </div>
        </div>
      </div>

      {/* Main Radar and Traffic distribution row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Radar Sweeper Widget */}
        <div className="lg:col-span-2 bg-slate-800/40 backdrop-blur-xl p-6 rounded-3xl border border-slate-700/50 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden min-h-[400px]">
          <div className="absolute top-4 left-5 flex items-center space-x-2">
            <Activity size={18} className="text-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Radar Scan</span>
          </div>

          {/* Concentric Radar Grid and Sweeper */}
          <div className="relative w-72 h-72 rounded-full border border-slate-700/40 flex items-center justify-center mt-6">
            <div className="absolute w-56 h-56 rounded-full border border-slate-700/60" />
            <div className="absolute w-40 h-40 rounded-full border border-slate-700/80" />
            <div className="absolute w-24 h-24 rounded-full border border-emerald-500/20" />
            <div className="absolute w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/50" />
            
            {/* Crosshairs */}
            <div className="absolute w-full h-[1px] bg-slate-700/30" />
            <div className="absolute h-full w-[1px] bg-slate-700/30" />

            {/* Scanning Line sweep animation */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/10 to-transparent origin-center animate-[spin_5s_linear_infinite]" 
                 style={{ clipPath: 'polygon(50% 50%, 100% 0, 100% 50%)' }} />

            {/* Radar Dot Markers for active visitors */}
            {filteredVisitors.map((v, i) => {
              // Calculate semi-randomized concentric scatter locations based on index/id
              const hash = v._id.charCodeAt(v._id.length - 1) || i;
              const angle = (hash * 45) % 360;
              const distance = 35 + ((hash * 17) % 55); // Scatter percentage
              const x = 50 + Math.cos(angle * Math.PI / 180) * distance;
              const y = 50 + Math.sin(angle * Math.PI / 180) * distance;

              return (
                <div 
                  key={v._id} 
                  className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                  style={{ left: `${x}%`, top: `${y}%` }}
                  title={`${v.visitorName || 'Guest'} on ${v.visitorDomain}`}
                  onClick={() => handleChatNow(v._id)}
                >
                  <span className={`absolute inset-0 rounded-full ${v.visitorStatus === 'opened' ? 'bg-emerald-400' : 'bg-blue-400'} animate-ping opacity-75`} />
                  <span className={`absolute inset-0.5 rounded-full ${v.visitorStatus === 'opened' ? 'bg-emerald-400' : 'bg-blue-400'} shadow-md`} />
                  
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 bg-slate-950/95 border border-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-transform z-20 pointer-events-none shadow-xl">
                    <p className="text-slate-100">{v.visitorName || 'Guest'}</p>
                    <p className="text-emerald-400 mt-0.5">{v.visitorPath || '/'}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex space-x-6 text-xs font-semibold text-slate-400">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              <span>Browsing ({filteredVisitors.filter(v => v.visitorStatus === 'online').length})</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>Chat Box Open ({filteredVisitors.filter(v => v.visitorStatus === 'opened').length})</span>
            </div>
          </div>
        </div>

        {/* Traffic Share Breakdown */}
        <div className="bg-slate-800/40 backdrop-blur-xl p-6 rounded-3xl border border-slate-700/50 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-5">
              <Globe size={18} className="text-blue-400" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Widget Domain Share</span>
            </div>

            {widgetBreakdown.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs font-medium">
                No active traffic sources found
              </div>
            ) : (
              <div className="space-y-4">
                {widgetBreakdown.map((wb, index) => {
                  const percentage = Math.round((wb.count / totalOnline) * 100);
                  const colors = ['from-emerald-500 to-teal-400', 'from-blue-500 to-indigo-400', 'from-violet-500 to-purple-400', 'from-amber-500 to-orange-400'];
                  const color = colors[index % colors.length];

                  return (
                    <div key={wb.widgetId} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-200 truncate max-w-[170px]" title={wb.domain}>{wb.domain}</span>
                        <span className="text-slate-400">{wb.count} active ({percentage}%)</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-900/60 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-1000 ease-out`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-4 mt-6 pt-5 border-t border-slate-700/40">
            <div className="bg-slate-900/40 p-3 rounded-2xl border border-slate-800">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Domains</span>
              <span className="text-xl font-black text-slate-200 mt-1 block">{uniqueDomains}</span>
            </div>
            <div className="bg-slate-900/40 p-3 rounded-2xl border border-slate-800">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Top Page Route</span>
              <span className="text-xs font-extrabold text-emerald-400 truncate block mt-1.5" title={topPage}>{topPage}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hourly Traffic Graphic (Today vs Yesterday) */}
      <div className="bg-slate-800/40 backdrop-blur-xl p-6 rounded-3xl border border-slate-700/50 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            <Flame size={18} className="text-amber-500" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hourly Traffic Wave (Today vs Yesterday)</span>
          </div>

          <div className="flex items-center space-x-4 text-xs font-semibold">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 bg-emerald-500 rounded" />
              <span className="text-slate-300">Today</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 bg-slate-700 rounded" />
              <span className="text-slate-400">Yesterday</span>
            </div>
          </div>
        </div>

        {/* Visual Bar Charts */}
        <div className="h-48 flex items-end justify-between gap-2 px-2 mt-4 relative">
          
          {/* Grid lines */}
          <div className="absolute inset-x-0 top-0 border-t border-slate-700/30 text-[9px] text-slate-600 pt-1">High Load</div>
          <div className="absolute inset-x-0 top-1/2 border-t border-slate-700/10 text-[9px] text-slate-600 pt-1">Average</div>

          {todayHourlyStats.map((todayVal, index) => {
            const yesterdayVal = yesterdayHourlyStats[index];
            const maxVal = Math.max(...todayHourlyStats, ...yesterdayHourlyStats, 10);
            
            const todayHeight = (todayVal / maxVal) * 100;
            const yesterdayHeight = (yesterdayVal / maxVal) * 100;

            return (
              <div key={index} className="flex-1 flex flex-col items-center group relative z-10">
                <div className="w-full flex items-end justify-center space-x-1.5 h-36">
                  {/* Yesterday Bar */}
                  <div 
                    className="w-2.5 bg-slate-700 rounded-t-sm transition-all duration-500 group-hover:bg-slate-600" 
                    style={{ height: `${yesterdayHeight}%` }}
                  />
                  {/* Today Bar */}
                  <div 
                    className="w-3.5 bg-emerald-500 rounded-t-sm transition-all duration-500 group-hover:bg-emerald-400 shadow-lg shadow-emerald-500/20" 
                    style={{ height: `${todayHeight}%` }}
                  />
                </div>

                {/* X Axis Label */}
                <span className="text-[10px] text-slate-500 font-semibold mt-3">{timeLabels[index]}</span>

                {/* Hover Value Tooltip */}
                <div className="absolute bottom-full mb-2 bg-slate-950 border border-slate-700 p-2 rounded-xl text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none shadow-xl flex flex-col gap-1">
                  <span className="text-emerald-400">Today: {todayVal} visits</span>
                  <span className="text-slate-400">Yesterday: {yesterdayVal} visits</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Visitor Grid Cards */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Compass size={18} className="text-emerald-400" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Visitors Profiles</span>
          </div>
          <span className="text-xs font-bold text-slate-500">{sortedVisitors.length} Visitors listed</span>
        </div>

        {sortedVisitors.length === 0 ? (
          <div className="bg-slate-800/20 p-16 rounded-3xl border border-slate-800 text-center space-y-4 max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-full bg-slate-900/60 flex items-center justify-center text-slate-600 mx-auto">
              <Eye size={28} className="opacity-30" />
            </div>
            <div>
              <p className="text-slate-300 font-bold text-sm">No active visitors match filters</p>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                Connect your website script to see visitors in real-time.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {sortedVisitors.map(v => {
              const isChatOpen = v.visitorStatus === 'opened';
              const isOnline = v.visitorStatus === 'online';
              const isOffline = !isChatOpen && !isOnline;
              const nameChar = v.visitorName ? v.visitorName.charAt(0).toUpperCase() : 'G';

              return (
                <div 
                  key={v._id} 
                  className={`border p-5 rounded-3xl shadow-xl flex flex-col justify-between hover:border-slate-500 transition-all duration-300 group ${
                    isChatOpen 
                      ? 'bg-emerald-950/10 border-emerald-500/20' 
                      : isOnline 
                        ? 'bg-blue-950/10 border-blue-500/20' 
                        : 'bg-slate-900/45 border-slate-800/60 opacity-65'
                  }`}
                >
                  <div className="space-y-4">
                    
                    {/* Visitor Card Header */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-slate-700 to-slate-800 font-extrabold text-sm text-slate-200 flex items-center justify-center shadow-inner">
                            {nameChar}
                          </div>
                          {/* Pulsing online/offline marker */}
                          <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
                            isChatOpen ? 'bg-emerald-400' : isOnline ? 'bg-blue-400' : 'bg-slate-500'
                          }`} />
                          {!isOffline && (
                            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
                              isChatOpen ? 'bg-emerald-400 animate-ping' : 'bg-blue-400 animate-pulse'
                            }`} />
                          )}
                        </div>

                        <div>
                          <span className="block text-sm font-extrabold text-slate-100 group-hover:text-emerald-400 transition-colors">{v.visitorName || 'Guest Visitor'}</span>
                          <span className="inline-block text-[9px] bg-slate-900/50 text-slate-400 px-2 py-0.5 rounded-md font-bold mt-1 max-w-[140px] truncate" title={v.visitorDomain}>
                            {v.visitorDomain || 'Unknown Source'}
                          </span>
                        </div>
                      </div>

                      {/* Status Tag */}
                      <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                        isChatOpen 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : isOnline
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>
                        {isChatOpen ? 'Online (Chat Open)' : isOnline ? 'Online (Browsing)' : 'Offline'}
                      </span>
                    </div>

                    {/* Path information */}
                    <div className="space-y-2.5 bg-slate-900/55 p-3 rounded-2xl border border-slate-800/80">
                      <div className="flex items-center space-x-2 text-slate-400 text-xs">
                        <Compass size={14} className="text-slate-500 flex-shrink-0" />
                        <span className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">
                          {isOffline ? 'Last Location' : 'Active Location'}
                        </span>
                      </div>
                      <span className="block text-[11px] font-bold text-emerald-400 font-mono truncate bg-slate-950/40 px-2.5 py-1.5 rounded-lg border border-slate-800/50">
                        {v.visitorPath || '/'}
                      </span>
                    </div>
                  </div>

                  {/* Chat CTA Button */}
                  <button
                    onClick={() => handleChatNow(v._id)}
                    className={`w-full mt-5 inline-flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl text-xs font-black transition-all duration-300 active:scale-95 ${
                      isChatOpen
                        ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/10'
                        : isOnline
                          ? 'bg-blue-500 text-slate-950 hover:bg-blue-400 shadow-lg shadow-blue-500/10'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700/80'
                    }`}
                  >
                    <MessageSquare size={14} />
                    <span>{isChatOpen ? 'Respond to Chat' : isOnline ? 'Initiate Chat' : 'View Chat History'}</span>
                    <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

export default LiveTracking;
