import React, { useState, useEffect } from 'react';
import { getAnalytics, initAnalytics } from '../services/analyticsService';

/**
 * Analytics Dashboard Component
 * Shows website tracking data to admin
 */
const AnalyticsDashboard = ({ db, appId }) => {
    const [loading, setLoading] = useState(true);
    const [summaryStats, setSummaryStats] = useState(null);
    const [recentEvents, setRecentEvents] = useState([]);
    const [jobStats, setJobStats] = useState([]);
    const [agentConversations, setAgentConversations] = useState([]);
    const [recentSessions, setRecentSessions] = useState([]);
    const [activeTab, setActiveTab] = useState('overview');
    // eslint-disable-next-line no-unused-vars
    const [dateRange, setDateRange] = useState(7);

    // Initialize analytics if not already done
    const analytics = getAnalytics() || (db ? initAnalytics(db, appId) : null);

    useEffect(() => {
        loadAnalyticsData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateRange]);

    const loadAnalyticsData = async () => {
        if (!analytics) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const [summary, events, jobs, conversations, sessions] = await Promise.all([
                analytics.getSummaryStats(),
                analytics.getRecentEvents(null, 100),
                analytics.getJobStats(),
                analytics.getAgentConversations(50),
                analytics.getRecentSessions(50)
            ]);

            setSummaryStats(summary);
            setRecentEvents(events);
            setJobStats(jobs);
            setAgentConversations(conversations);
            setRecentSessions(sessions);
        } catch (error) {
            console.error('Error loading analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getEventIcon = (type) => {
        switch (type) {
            case 'page_view': return '👁️';
            case 'job_view': return '💼';
            case 'whatsapp_click': return '📱';
            case 'agent_interaction': return '🤖';
            default: return '📊';
        }
    };

    const getEventColor = (type) => {
        switch (type) {
            case 'page_view': return 'bg-blue-500/20 text-blue-400';
            case 'job_view': return 'bg-purple-500/20 text-purple-400';
            case 'whatsapp_click': return 'bg-green-500/20 text-green-400';
            case 'agent_interaction': return 'bg-yellow-500/20 text-yellow-400';
            default: return 'bg-slate-500/20 text-slate-400';
        }
    };

    if (loading) {
        return (
            <div className="p-6 bg-slate-900 min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading analytics...</p>
                </div>
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="p-6 bg-slate-900 min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <span className="text-6xl mb-4 block">⚠️</span>
                    <p className="text-slate-400">Analytics not initialized</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-slate-900 min-h-screen">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">📊 Analytics Dashboard</h1>
                        <p className="text-slate-400">Track your website visitors and interactions</p>
                    </div>
                    <button
                        onClick={loadAnalyticsData}
                        className="mt-4 md:mt-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                    >
                        🔄 Refresh Data
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-2xl p-6">
                        <div className="text-4xl mb-2">👥</div>
                        <p className="text-slate-400 text-sm">Today's Visitors</p>
                        <p className="text-3xl font-bold text-white">{summaryStats?.today?.sessions || 0}</p>
                        <p className="text-xs text-blue-400 mt-1">
                            Last 7 days: {summaryStats?.last7Days?.totalSessions || 0}
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-2xl p-6">
                        <div className="text-4xl mb-2">👁️</div>
                        <p className="text-slate-400 text-sm">Page Views</p>
                        <p className="text-3xl font-bold text-white">{summaryStats?.today?.pageViews || 0}</p>
                        <p className="text-xs text-purple-400 mt-1">
                            Last 7 days: {summaryStats?.last7Days?.totalViews || 0}
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 rounded-2xl p-6">
                        <div className="text-4xl mb-2">📱</div>
                        <p className="text-slate-400 text-sm">WhatsApp Clicks</p>
                        <p className="text-3xl font-bold text-white">{summaryStats?.today?.whatsappClicks || 0}</p>
                        <p className="text-xs text-green-400 mt-1">
                            Last 7 days: {summaryStats?.last7Days?.totalWhatsApp || 0}
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 border border-yellow-500/30 rounded-2xl p-6">
                        <div className="text-4xl mb-2">🤖</div>
                        <p className="text-slate-400 text-sm">AI Agent Talks</p>
                        <p className="text-3xl font-bold text-white">{summaryStats?.today?.agentSessions || 0}</p>
                        <p className="text-xs text-yellow-400 mt-1">
                            Last 7 days: {summaryStats?.last7Days?.totalAgentSessions || 0}
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    {[
                        { id: 'overview', label: '📈 Overview', icon: '' },
                        { id: 'visitors', label: '📍 Visitors', icon: '' },
                        { id: 'jobs', label: '💼 Job Stats', icon: '' },
                        { id: 'agent', label: '🤖 Agent Logs', icon: '' },
                        { id: 'events', label: '📋 All Events', icon: '' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition ${activeTab === tab.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {/* Daily Breakdown Chart */}
                        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4">📅 Last 7 Days Breakdown</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-slate-400 text-sm">
                                            <th className="text-left py-2">Date</th>
                                            <th className="text-center py-2">Sessions</th>
                                            <th className="text-center py-2">Page Views</th>
                                            <th className="text-center py-2">Job Views</th>
                                            <th className="text-center py-2">WhatsApp</th>
                                            <th className="text-center py-2">AI Agent</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {summaryStats?.dailyBreakdown?.map((day, i) => (
                                            <tr key={i} className="border-t border-slate-700">
                                                <td className="py-3 text-white font-medium">{day.date}</td>
                                                <td className="py-3 text-center text-blue-400">{day.sessions || 0}</td>
                                                <td className="py-3 text-center text-purple-400">{day.pageViews || 0}</td>
                                                <td className="py-3 text-center text-indigo-400">{day.jobViews || 0}</td>
                                                <td className="py-3 text-center text-green-400">{day.whatsappClicks || 0}</td>
                                                <td className="py-3 text-center text-yellow-400">{day.agentSessions || 0}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4">🕐 Recent Activity</h3>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {recentEvents.slice(0, 20).map((event, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl">
                                        <span className={`w-10 h-10 rounded-full flex items-center justify-center ${getEventColor(event.type)}`}>
                                            {getEventIcon(event.type)}
                                        </span>
                                        <div className="flex-1">
                                            <p className="text-white font-medium">
                                                {event.type === 'page_view' && `Viewed: ${event.pageName}`}
                                                {event.type === 'job_view' && `Job: ${event.jobTitle}`}
                                                {event.type === 'whatsapp_click' && `Applied: ${event.jobTitle}`}
                                                {event.type === 'agent_interaction' && `Agent: ${event.interactionType}`}
                                            </p>
                                            <p className="text-slate-500 text-sm">
                                                {event.deviceInfo?.device} • {formatTimestamp(event.timestamp)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'visitors' && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                        <h3 className="text-xl font-bold text-white mb-4">📍 Recent Visitors (with Location)</h3>

                        {recentSessions.length === 0 ? (
                            <div className="text-center py-12">
                                <span className="text-4xl block mb-4">🌍</span>
                                <p className="text-slate-400">No visitor data yet</p>
                                <p className="text-slate-500 text-sm mt-2">Visitors will appear here once they browse your site</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {recentSessions.map((session, i) => (
                                    <div key={i} className="p-4 bg-slate-700/30 rounded-xl">
                                        <div className="flex items-start gap-4">
                                            {/* Location Flag */}
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center text-2xl">
                                                {session.locationInfo?.countryCode === 'IN' ? '🇮🇳' :
                                                    session.locationInfo?.countryCode === 'SA' ? '🇸🇦' :
                                                        session.locationInfo?.countryCode === 'AE' ? '🇦🇪' :
                                                            session.locationInfo?.countryCode === 'PK' ? '🇵🇰' :
                                                                session.locationInfo?.countryCode === 'BD' ? '🇧🇩' :
                                                                    session.locationInfo?.countryCode ? '🌍' : '❓'}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-white font-semibold">
                                                        {session.locationInfo?.city || 'Unknown City'}
                                                    </span>
                                                    <span className="text-slate-500">•</span>
                                                    <span className="text-blue-400">
                                                        {session.locationInfo?.region || '-'}
                                                    </span>
                                                    <span className="text-slate-500">•</span>
                                                    <span className="text-purple-400">
                                                        {session.locationInfo?.country || 'Unknown'}
                                                    </span>
                                                </div>

                                                <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                                                    <span className="flex items-center gap-1">
                                                        💻 {session.deviceInfo?.device || 'Unknown'}
                                                    </span>
                                                    {session.locationInfo?.ip && (
                                                        <span className="flex items-center gap-1">
                                                            🌐 {session.locationInfo.ip}
                                                        </span>
                                                    )}
                                                    {session.locationInfo?.isp && (
                                                        <span className="flex items-center gap-1">
                                                            📶 {session.locationInfo.isp}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-4 mt-2 text-xs">
                                                    <span className="text-slate-500">
                                                        📅 {formatTimestamp(session.startTime)}
                                                    </span>
                                                    {session.duration && (
                                                        <span className="text-green-400">
                                                            ⏱️ {Math.floor(session.duration / 60)}m {session.duration % 60}s
                                                        </span>
                                                    )}
                                                    <span className="text-slate-600">
                                                        ID: {session.visitorId?.slice(-8)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'jobs' && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                        <h3 className="text-xl font-bold text-white mb-4">💼 Job Performance</h3>

                        {jobStats.length === 0 ? (
                            <div className="text-center py-12">
                                <span className="text-4xl block mb-4">📊</span>
                                <p className="text-slate-400">No job statistics yet</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {jobStats.sort((a, b) => (b.views || 0) - (a.views || 0)).map((job, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">💼</span>
                                            <div>
                                                <p className="text-white font-medium">{job.jobId}</p>
                                                <p className="text-slate-500 text-sm">Job ID</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-6">
                                            <div className="text-center">
                                                <p className="text-2xl font-bold text-purple-400">{job.views || 0}</p>
                                                <p className="text-xs text-slate-500">Views</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-2xl font-bold text-green-400">{job.whatsappClicks || 0}</p>
                                                <p className="text-xs text-slate-500">Applies</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-2xl font-bold text-blue-400">
                                                    {job.views > 0 ? Math.round((job.whatsappClicks || 0) / job.views * 100) : 0}%
                                                </p>
                                                <p className="text-xs text-slate-500">Conv. Rate</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'agent' && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                        <h3 className="text-xl font-bold text-white mb-4">🤖 AI Agent Conversations</h3>

                        {agentConversations.length === 0 ? (
                            <div className="text-center py-12">
                                <span className="text-4xl block mb-4">🤖</span>
                                <p className="text-slate-400">No agent conversations yet</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {agentConversations.map((conv, i) => (
                                    <div key={i} className="p-4 bg-slate-700/30 rounded-xl">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`px-3 py-1 rounded-full text-sm ${conv.interactionType === 'started'
                                                ? 'bg-green-500/20 text-green-400'
                                                : conv.interactionType === 'message'
                                                    ? 'bg-blue-500/20 text-blue-400'
                                                    : 'bg-slate-500/20 text-slate-400'
                                                }`}>
                                                {conv.interactionType}
                                            </span>
                                            <span className="text-slate-500 text-sm">
                                                {formatTimestamp(conv.timestamp)}
                                            </span>
                                        </div>
                                        {conv.data?.userMessage && (
                                            <div className="mt-2 p-3 bg-slate-800 rounded-lg">
                                                <p className="text-slate-400 text-xs mb-1">User said:</p>
                                                <p className="text-white">{conv.data.userMessage}</p>
                                            </div>
                                        )}
                                        {conv.data?.aiResponse && (
                                            <div className="mt-2 p-3 bg-blue-900/30 rounded-lg">
                                                <p className="text-slate-400 text-xs mb-1">AI replied:</p>
                                                <p className="text-blue-300">{conv.data.aiResponse}</p>
                                            </div>
                                        )}
                                        <div className="mt-2 text-xs text-slate-600">
                                            {conv.deviceInfo?.device} • Session: {conv.sessionId?.slice(-8)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'events' && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                        <h3 className="text-xl font-bold text-white mb-4">📋 All Events (Last 100)</h3>

                        <div className="space-y-2 max-h-[600px] overflow-y-auto">
                            {recentEvents.map((event, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl text-sm">
                                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${getEventColor(event.type)}`}>
                                        {getEventIcon(event.type)}
                                    </span>
                                    <span className="text-slate-400 w-24">{event.type}</span>
                                    <span className="text-white flex-1">
                                        {event.pageName || event.jobTitle || event.interactionType || '-'}
                                    </span>
                                    <span className="text-slate-500 w-20">{event.deviceInfo?.device}</span>
                                    <span className="text-slate-600 w-32 text-right">{formatTimestamp(event.timestamp)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
