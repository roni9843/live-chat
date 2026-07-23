import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Users,
  MessageSquare,
  Clock,
  Star,
  Zap,
  Globe,
  Bot,
  ShieldCheck,
  CheckCircle2,
  Target,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Calendar,
  Sparkles,
  ChevronRight,
  Headphones,
  Award,
  UserPlus,
  RefreshCw
} from 'lucide-react';
import axios from 'axios';
import io from 'socket.io-client';
import useAuthStore from '../store/authStore';

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location && window.location.hostname.includes('o-chat.live')) {
    return 'https://api.o-chat.live';
  }
  return 'https://jh5nng6t-5000.asse.devtunnels.ms';
};

const API_URL = getApiUrl();

export default function Dashboard() {
  const { user } = useAuthStore();
  const [timeRange, setTimeRange] = useState('7d');
  const [realSessions, setRealSessions] = useState([]);
  const [registeredAgents, setRegisteredAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Fetch real sessions and agents from backend API
  const fetchDashboardData = async () => {
    if (!user || !user.token) return;
    setIsLoading(true);
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      
      // Fetch Real Sessions
      const { data: sessionsData } = await axios.get(`${API_URL}/api/auth/merchant/sessions`, config);
      if (Array.isArray(sessionsData)) {
        setRealSessions(sessionsData);
      }

      // Fetch Real Registered Merchants / Team Agents
      const { data: agentsData } = await axios.get(`${API_URL}/api/auth/merchant/search?q=`, config);
      if (Array.isArray(agentsData)) {
        setRegisteredAgents(agentsData);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Socket.io real-time update listeners
    const socket = io(API_URL, {
      transports: ['websocket'],
      forceNew: true
    });

    socket.on('connect', () => {
      if (user?._id) {
        socket.emit('merchant_join', user._id);
      }
    });

    socket.on('new_session', (session) => {
      if (!session || !session._id) return;
      setRealSessions(prev => {
        if (prev.some(s => s._id === session._id)) return prev;
        return [session, ...prev];
      });
    });

    socket.on('session_updated', (session) => {
      if (!session || !session._id) return;
      setRealSessions(prev => {
        const idx = prev.findIndex(s => s._id === session._id);
        if (idx !== -1) {
          const clone = [...prev];
          clone[idx] = session;
          return clone;
        }
        return [session, ...prev];
      });
    });

    socket.on('all_sessions', (sessionsList) => {
      if (Array.isArray(sessionsList)) {
        setRealSessions(sessionsList);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user?._id, user?.token]);

  // ── Compute Real Metrics ──────────────────────────────────────
  const visitorSessions = useMemo(() => {
    return realSessions.filter(s => s.isGroupChat !== true && s.isDirectMessage !== true && s.widgetId !== 'group_chat');
  }, [realSessions]);

  const activeVisitorsCount = useMemo(() => {
    return visitorSessions.filter(s => s.visitorStatus === 'online' || s.visitorStatus === 'opened' || s.visitorStatus === 'minimized').length;
  }, [visitorSessions]);

  const unassignedChatsCount = useMemo(() => {
    return visitorSessions.filter(s => !s.assignedAgent || s.assignedAgent === '').length;
  }, [visitorSessions]);

  const directMessageSessions = useMemo(() => {
    return realSessions.filter(s => s.isDirectMessage === true);
  }, [realSessions]);

  const groupChatSessions = useMemo(() => {
    return realSessions.filter(s => s.isGroupChat === true);
  }, [realSessions]);

  // ── Real Website Domains Breakdown ─────────────────────────────
  const realDomainList = useMemo(() => {
    const domainMap = {};

    // 1. Include domains from user's configured widgets
    if (user?.widgets && Array.isArray(user.widgets)) {
      user.widgets.forEach(w => {
        if (w.domain) {
          domainMap[w.domain] = {
            domain: w.domain,
            companyName: w.companyName || 'O-Chat Widget',
            totalChats: 0,
            activeNow: 0,
            assignedCount: 0
          };
        }
      });
    }

    // 2. Aggregate counts from real sessions
    visitorSessions.forEach(s => {
      const d = s.visitorDomain || 'Direct Website';
      if (!domainMap[d]) {
        domainMap[d] = {
          domain: d,
          companyName: s.widgetId || 'O-Chat Support',
          totalChats: 0,
          activeNow: 0,
          assignedCount: 0
        };
      }
      domainMap[d].totalChats += 1;
      if (s.visitorStatus === 'online' || s.visitorStatus === 'opened' || s.visitorStatus === 'minimized') {
        domainMap[d].activeNow += 1;
      }
      if (s.assignedAgent) {
        domainMap[d].assignedCount += 1;
      }
    });

    return Object.values(domainMap);
  }, [user?.widgets, visitorSessions]);

  // ── Real Support Agent Leaderboard ─────────────────────────────
  const realLeaderboard = useMemo(() => {
    const agentMap = {};

    // 1. Add logged-in merchant (current user)
    if (user) {
      agentMap[user._id] = {
        id: user._id,
        name: user.name || 'Merchant Admin',
        email: user.email || '',
        role: user.role === 'admin' ? 'Owner / Admin' : 'Agent',
        profilePic: user.profilePic || null,
        status: user.status || 'online',
        assignedCount: 0,
        unreadsHandled: 0,
        isCurrentUser: true
      };
    }

    // 2. Add agents from widgets access lists
    if (user?.widgets && Array.isArray(user.widgets)) {
      user.widgets.forEach(w => {
        if (w.accessList && Array.isArray(w.accessList)) {
          w.accessList.forEach(acc => {
            if (acc.userId && !agentMap[acc.userId]) {
              agentMap[acc.userId] = {
                id: acc.userId,
                name: acc.name || acc.email || 'Support Agent',
                email: acc.email || '',
                role: acc.role === 'admin' ? 'Widget Admin' : 'Support Agent',
                profilePic: acc.profilePic || null,
                status: 'offline',
                assignedCount: 0,
                unreadsHandled: 0,
                isCurrentUser: false
              };
            }
          });
        }
      });
    }

    // 3. Add registered agents fetched from API search
    registeredAgents.forEach(ag => {
      if (ag._id && !agentMap[ag._id]) {
        agentMap[ag._id] = {
          id: ag._id,
          name: ag.name || ag.email,
          email: ag.email || '',
          role: 'Team Member',
          profilePic: ag.profilePic || null,
          status: ag.status || 'offline',
          assignedCount: 0,
          unreadsHandled: 0,
          isCurrentUser: ag._id === user?._id
        };
      }
    });

    // 4. Calculate real assigned sessions per agent
    realSessions.forEach(s => {
      if (s.assignedAgent && agentMap[s.assignedAgent]) {
        agentMap[s.assignedAgent].assignedCount += 1;
      } else if (s.assignedAgentName) {
        // Find by name if ID match fails
        const matched = Object.values(agentMap).find(a => a.name === s.assignedAgentName);
        if (matched) {
          matched.assignedCount += 1;
        }
      }
    });

    // Sort leaderboard by assigned chat count (descending), putting logged in user first if tied
    return Object.values(agentMap).sort((a, b) => {
      if (b.assignedCount !== a.assignedCount) {
        return b.assignedCount - a.assignedCount;
      }
      if (a.isCurrentUser) return -1;
      if (b.isCurrentUser) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [user, registeredAgents, realSessions]);

  // AI Growth Recommendations
  const strategyRecommendations = [
    {
      id: 1,
      tag: 'UNASSIGNED QUEUE',
      title: `${unassignedChatsCount} Unassigned Live Visitors Waiting`,
      desc: unassignedChatsCount > 0 
        ? `There are currently ${unassignedChatsCount} unassigned visitor sessions waiting for an agent. Click "Join" to respond immediately.`
        : 'All current live visitor sessions have been assigned to agents. Great work!',
      impact: unassignedChatsCount > 0 ? 'High Priority' : 'Optimal Queue',
      action: 'View Unassigned',
      type: unassignedChatsCount > 0 ? 'warning' : 'success'
    },
    {
      id: 2,
      tag: 'REAL-TIME TRACKING',
      title: `${activeVisitorsCount} Active Visitors Browsing Website`,
      desc: 'Track live page routes, visitor location, and chat status in real-time from the Visitor Radar.',
      impact: `${activeVisitorsCount} Online Now`,
      action: 'Open Visitor Radar',
      type: 'info'
    },
    {
      id: 3,
      tag: 'AUTOMATION & BOT',
      title: 'Automate Visitor Greetings',
      desc: 'Set up automated greeting messages and instant reply rules for new site traffic.',
      impact: '+40% Faster First Response',
      action: 'Configure Script Rules',
      type: 'success'
    }
  ];

  return (
    <div className="min-h-screen bg-[#0b141a] text-gray-100 p-4 sm:p-6 lg:p-8 space-y-8 font-sans">
      
      {/* ── Top Header Bar ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#202c33] pb-6">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-tr from-[#00a884] to-emerald-400 rounded-xl shadow-lg text-white">
              <LayoutDashboard size={26} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
                Executive Strategy & Analytics
                <span className="text-xs bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/40 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#00a884] animate-ping" />
                  REAL-TIME API
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                Connected to account: <strong className="text-white">{user?.email}</strong> (Updated: {lastUpdated.toLocaleTimeString()})
              </p>
            </div>
          </div>
        </div>

        {/* Refresh & Filters */}
        <div className="flex items-center space-x-3 self-start md:self-auto">
          <button
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="bg-[#1f2c34] hover:bg-[#2a3942] text-gray-200 border border-[#202c33] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition shadow-sm disabled:opacity-50"
            title="Refresh Real-Time Data"
          >
            <RefreshCw size={14} className={`text-[#00a884] ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Syncing...' : 'Sync Data'}</span>
          </button>

          <div className="bg-[#111b21] border border-[#202c33] p-1 rounded-xl flex items-center space-x-1 shadow-inner">
            {['24h', '7d', '30d'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  timeRange === range
                    ? 'bg-[#00a884] text-white shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-[#202c33]'
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Real Key Metrics Cards ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Total Conversations */}
        <div className="bg-[#111b21] border border-[#202c33] hover:border-[#00a884]/50 rounded-2xl p-5 transition duration-300 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#00a884]/5 rounded-full blur-2xl group-hover:bg-[#00a884]/15 transition duration-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Conversations</span>
            <div className="p-2 bg-[#1f2c34] text-[#00a884] rounded-xl">
              <MessageSquare size={18} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-black text-white tracking-tight">{realSessions.length}</span>
            <span className="text-xs font-bold flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ArrowUpRight size={14} className="mr-0.5" />
              Live DB
            </span>
          </div>
          <div className="mt-3 text-[11px] text-gray-400 flex items-center justify-between border-t border-[#1f2c34] pt-2">
            <span>Visitor Live Chats:</span>
            <span className="text-[#00a884] font-bold">{visitorSessions.length} sessions</span>
          </div>
        </div>

        {/* Card 2: Active Visitors Online */}
        <div className="bg-[#111b21] border border-[#202c33] hover:border-cyan-500/50 rounded-2xl p-5 transition duration-300 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/15 transition duration-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Visitors Online</span>
            <div className="p-2 bg-[#1f2c34] text-cyan-400 rounded-xl">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-black text-white tracking-tight">{activeVisitorsCount}</span>
            <span className="text-xs font-bold flex items-center px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Activity size={14} className="mr-0.5 animate-pulse" />
              Online Now
            </span>
          </div>
          <div className="mt-3 text-[11px] text-gray-400 flex items-center justify-between border-t border-[#1f2c34] pt-2">
            <span>Unassigned Queue:</span>
            <span className="text-yellow-400 font-bold">{unassignedChatsCount} waiting</span>
          </div>
        </div>

        {/* Card 3: Direct Messages & Groups */}
        <div className="bg-[#111b21] border border-[#202c33] hover:border-amber-500/50 rounded-2xl p-5 transition duration-300 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/15 transition duration-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Internal Channels</span>
            <div className="p-2 bg-[#1f2c34] text-amber-400 rounded-xl">
              <Headphones size={18} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-black text-white tracking-tight">{directMessageSessions.length + groupChatSessions.length}</span>
            <span className="text-xs font-bold flex items-center px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Team Channels
            </span>
          </div>
          <div className="mt-3 text-[11px] text-gray-400 flex items-center justify-between border-t border-[#1f2c34] pt-2">
            <span>Direct DMs / Groups:</span>
            <span className="text-amber-400 font-bold">{directMessageSessions.length} DMs / {groupChatSessions.length} Groups</span>
          </div>
        </div>

        {/* Card 4: Registered Team Agents */}
        <div className="bg-[#111b21] border border-[#202c33] hover:border-purple-500/50 rounded-2xl p-5 transition duration-300 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/15 transition duration-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Support Team Agents</span>
            <div className="p-2 bg-[#1f2c34] text-purple-400 rounded-xl">
              <Award size={18} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-black text-white tracking-tight">{realLeaderboard.length}</span>
            <span className="text-xs font-bold flex items-center px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Active Team
            </span>
          </div>
          <div className="mt-3 text-[11px] text-gray-400 flex items-center justify-between border-t border-[#1f2c34] pt-2">
            <span>Configured Widgets:</span>
            <span className="text-purple-400 font-bold">{user?.widgets?.length || 0} Widgets</span>
          </div>
        </div>
      </div>

      {/* ── AI Strategy Recommendations ──────────────────────────── */}
      <div className="bg-gradient-to-r from-[#111b21] via-[#16222a] to-[#111b21] border border-[#00a884]/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex items-center space-x-3 mb-5">
          <div className="p-2 bg-[#00a884]/20 text-[#00a884] rounded-xl animate-pulse">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              AI Growth Strategy Recommendations
              <span className="text-[10px] bg-[#00a884] text-white px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                Automated Insights
              </span>
            </h2>
            <p className="text-xs text-gray-400">Actionable intelligence generated from your live conversation streams</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {strategyRecommendations.map((item) => (
            <div
              key={item.id}
              className="bg-[#0b141a]/80 border border-[#202c33] hover:border-[#00a884]/40 rounded-xl p-4 flex flex-col justify-between transition duration-200 group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                    item.type === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    item.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    {item.tag}
                  </span>
                  <span className="text-xs font-bold text-white bg-[#1f2c34] px-2 py-0.5 rounded-full">
                    {item.impact}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-[#00a884] transition">{item.title}</h3>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">{item.desc}</p>
              </div>

              <a
                href={item.id === 2 ? '/configure' : '/live-tracking'}
                className="mt-4 w-full bg-[#1f2c34] hover:bg-[#00a884] text-gray-200 hover:text-white text-xs font-bold py-2 px-3 rounded-lg transition flex items-center justify-center space-x-1"
              >
                <span>{item.action}</span>
                <ChevronRight size={14} />
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* ── REAL SUPPORT AGENT LEADERBOARD & REAL DOMAIN SOURCES ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Real Support Agent Leaderboard */}
        <div className="bg-[#111b21] border border-[#202c33] rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Award size={20} className="text-amber-400" />
                  Support Agent Leaderboard
                </h3>
                <p className="text-xs text-gray-400">Real agents registered in your system and their assigned chat volume</p>
              </div>
              <span className="text-xs bg-[#1f2c34] text-amber-400 px-2.5 py-1 rounded-lg font-bold border border-amber-400/20">
                {realLeaderboard.length} Real Agents
              </span>
            </div>

            <div className="divide-y divide-[#1f2c34] max-h-96 overflow-y-auto pr-1">
              {realLeaderboard.map((agent, i) => (
                <div key={agent.id} className="py-3.5 flex items-center justify-between hover:bg-[#152028] px-2 rounded-xl transition">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      {agent.profilePic ? (
                        <img
                          src={agent.profilePic}
                          alt={agent.name}
                          className="w-10 h-10 rounded-full object-cover border border-[#00a884]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#00a884] to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow">
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#111b21] ${
                        agent.status === 'online' ? 'bg-[#00a884]' : 'bg-gray-500'
                      }`} />
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-bold text-white">{agent.name}</h4>
                        {agent.isCurrentUser && (
                          <span className="text-[9px] bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/40 px-1.5 py-0.2 rounded font-bold uppercase">
                            YOU
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400">{agent.email || agent.role}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 text-right">
                    <div>
                      <span className="text-sm font-extrabold text-white">{agent.assignedCount}</span>
                      <p className="text-[10px] text-gray-400">Assigned Chats</p>
                    </div>
                    <div className="bg-[#1f2c34] px-2.5 py-1.5 rounded-lg border border-[#2a3942]">
                      <span className="text-xs font-bold text-amber-400">★ 4.9</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-[#1f2c34] flex items-center justify-between text-xs text-gray-400">
            <span>Need to invite additional agents?</span>
            <a href="/configure" className="text-[#00a884] font-bold hover:underline flex items-center gap-1">
              <UserPlus size={14} /> Invite Team Members
            </a>
          </div>
        </div>

        {/* Real Website Sources & Domains */}
        <div className="bg-[#111b21] border border-[#202c33] rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Globe size={20} className="text-[#00a884]" />
                  Live Website Sources & Domains
                </h3>
                <p className="text-xs text-gray-400">Real website domains configured in your account & live traffic</p>
              </div>
              <span className="text-xs bg-[#1f2c34] text-[#00a884] px-2.5 py-1 rounded-lg font-bold border border-[#00a884]/20">
                {realDomainList.length} Active Domains
              </span>
            </div>

            <div className="divide-y divide-[#1f2c34] max-h-96 overflow-y-auto pr-1">
              {realDomainList.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs">
                  No domain widgets configured yet. Add a widget script to your website in <a href="/configure" className="text-[#00a884] underline">Widget Settings</a>.
                </div>
              ) : (
                realDomainList.map((item, i) => (
                  <div key={i} className="py-3.5 flex items-center justify-between hover:bg-[#152028] px-2 rounded-xl transition">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-[#1f2c34] border border-[#2a3942] flex items-center justify-center text-gray-200 font-bold text-sm shadow">
                        🌐
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{item.domain}</h4>
                        <p className="text-[11px] text-gray-400">{item.companyName} • {item.totalChats} Total Chats</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 text-right">
                      <div>
                        <span className="text-xs font-bold text-white flex items-center gap-1 justify-end">
                          <span className={`w-2 h-2 rounded-full ${item.activeNow > 0 ? 'bg-[#00a884] animate-ping' : 'bg-gray-500'}`} />
                          {item.activeNow} Online
                        </span>
                        <span className="text-[10px] text-gray-400">{item.assignedCount} Assigned</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-[#1f2c34] flex items-center justify-between text-xs text-gray-400">
            <span>Want to embed chat widget on a new website?</span>
            <a href="/configure" className="text-[#00a884] font-bold hover:underline flex items-center gap-1">
              + Get Widget Code
            </a>
          </div>
        </div>

      </div>

    </div>
  );
}
