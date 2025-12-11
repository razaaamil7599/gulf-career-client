/**
 * Analytics Service - Gulf Career Gateway
 * Track all user interactions and store in Firebase
 */

import {
    collection,
    addDoc,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
    increment,
    updateDoc
} from 'firebase/firestore';

class AnalyticsService {
    constructor(db, appId) {
        this.db = db;
        this.appId = appId;
        this.sessionId = this.generateSessionId();
        this.visitorId = this.getOrCreateVisitorId();
        this.sessionStartTime = Date.now();

        // Collection paths
        this.analyticsPath = `/artifacts/${appId}/public/data/analytics`;
        this.sessionsPath = `/artifacts/${appId}/public/data/sessions`;
        this.eventsPath = `/artifacts/${appId}/public/data/events`;
        this.dailyStatsPath = `/artifacts/${appId}/public/data/dailyStats`;
    }

    // Generate unique session ID
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Get or create persistent visitor ID
    getOrCreateVisitorId() {
        let visitorId = localStorage.getItem('gcg_visitor_id');
        if (!visitorId) {
            visitorId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('gcg_visitor_id', visitorId);
        }
        return visitorId;
    }

    // Get today's date string
    getTodayString() {
        return new Date().toISOString().split('T')[0];
    }

    // Get device info
    getDeviceInfo() {
        const ua = navigator.userAgent;
        let device = 'Desktop';
        if (/Mobile|Android|iPhone|iPad/.test(ua)) {
            device = /iPad/.test(ua) ? 'Tablet' : 'Mobile';
        }
        return {
            userAgent: ua,
            device: device,
            language: navigator.language,
            platform: navigator.platform,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height
        };
    }

    // Get location info from IP (using free ip-api.com)
    async getLocationInfo() {
        // Check if we already have cached location
        const cachedLocation = sessionStorage.getItem('gcg_location');
        if (cachedLocation) {
            try {
                return JSON.parse(cachedLocation);
            } catch (e) {
                // Continue to fetch
            }
        }

        try {
            // Using ipapi.co which supports HTTPS (free tier: 1000 requests/day)
            const response = await fetch('https://ipapi.co/json/');
            if (response.ok) {
                const data = await response.json();
                if (!data.error) {
                    const locationInfo = {
                        ip: data.ip,
                        country: data.country_name,
                        countryCode: data.country_code,
                        region: data.region,
                        city: data.city,
                        zip: data.postal,
                        lat: data.latitude,
                        lon: data.longitude,
                        isp: data.org
                    };
                    // Cache for this session
                    sessionStorage.setItem('gcg_location', JSON.stringify(locationInfo));
                    return locationInfo;
                }
            }
        } catch (error) {
            console.log('[Analytics] Could not fetch location:', error.message);
        }
        return null;
    }

    // ==========================================
    // TRACKING METHODS
    // ==========================================

    // Track page view
    async trackPageView(pageName, pageData = {}) {
        if (!this.db) return;

        try {
            const event = {
                type: 'page_view',
                pageName: pageName,
                pageData: pageData,
                sessionId: this.sessionId,
                visitorId: this.visitorId,
                deviceInfo: this.getDeviceInfo(),
                timestamp: Timestamp.now(),
                date: this.getTodayString(),
                url: window.location.href,
                referrer: document.referrer || 'direct'
            };

            await addDoc(collection(this.db, this.eventsPath), event);
            await this.updateDailyStats('pageViews');

            console.log('[Analytics] Page view tracked:', pageName);
        } catch (error) {
            console.error('[Analytics] Error tracking page view:', error);
        }
    }

    // Track job view (when user clicks on job card)
    async trackJobView(job) {
        if (!this.db || !job) return;

        try {
            const event = {
                type: 'job_view',
                jobId: job.id,
                jobTitle: job.title,
                jobCompany: job.company,
                sessionId: this.sessionId,
                visitorId: this.visitorId,
                deviceInfo: this.getDeviceInfo(),
                timestamp: Timestamp.now(),
                date: this.getTodayString()
            };

            await addDoc(collection(this.db, this.eventsPath), event);
            await this.updateDailyStats('jobViews');
            await this.updateJobStats(job.id, 'views');

            console.log('[Analytics] Job view tracked:', job.title);
        } catch (error) {
            console.error('[Analytics] Error tracking job view:', error);
        }
    }

    // Track WhatsApp click (apply button)
    async trackWhatsAppClick(job, source = 'job_card') {
        if (!this.db) return;

        try {
            const event = {
                type: 'whatsapp_click',
                jobId: job?.id || 'general',
                jobTitle: job?.title || 'General Inquiry',
                jobCompany: job?.company || '',
                source: source,
                sessionId: this.sessionId,
                visitorId: this.visitorId,
                deviceInfo: this.getDeviceInfo(),
                timestamp: Timestamp.now(),
                date: this.getTodayString()
            };

            await addDoc(collection(this.db, this.eventsPath), event);
            await this.updateDailyStats('whatsappClicks');

            if (job?.id) {
                await this.updateJobStats(job.id, 'whatsappClicks');
            }

            console.log('[Analytics] WhatsApp click tracked:', job?.title || 'General');
        } catch (error) {
            console.error('[Analytics] Error tracking WhatsApp click:', error);
        }
    }

    // Track AI Agent interaction
    async trackAgentInteraction(interactionType, data = {}) {
        if (!this.db) return;

        try {
            const event = {
                type: 'agent_interaction',
                interactionType: interactionType, // 'started', 'message', 'ended', 'language_change'
                data: data,
                sessionId: this.sessionId,
                visitorId: this.visitorId,
                deviceInfo: this.getDeviceInfo(),
                timestamp: Timestamp.now(),
                date: this.getTodayString()
            };

            await addDoc(collection(this.db, this.eventsPath), event);

            if (interactionType === 'started') {
                await this.updateDailyStats('agentSessions');
            } else if (interactionType === 'message') {
                await this.updateDailyStats('agentMessages');
            }

            console.log('[Analytics] Agent interaction tracked:', interactionType);
        } catch (error) {
            console.error('[Analytics] Error tracking agent interaction:', error);
        }
    }

    // Track session start
    async trackSessionStart() {
        if (!this.db) return;

        try {
            // Fetch location info (async, won't block if fails)
            const locationInfo = await this.getLocationInfo();

            const session = {
                sessionId: this.sessionId,
                visitorId: this.visitorId,
                startTime: Timestamp.now(),
                endTime: null,
                deviceInfo: this.getDeviceInfo(),
                locationInfo: locationInfo || null,
                date: this.getTodayString(),
                pagesViewed: [],
                jobsViewed: [],
                agentInteracted: false,
                whatsappClicked: false
            };

            await setDoc(doc(this.db, this.sessionsPath, this.sessionId), session);
            await this.updateDailyStats('sessions');

            // Check if this is a new visitor
            const isNewVisitor = await this.checkIfNewVisitor();
            if (isNewVisitor) {
                await this.updateDailyStats('newVisitors');
            }

            console.log('[Analytics] Session started:', this.sessionId, locationInfo ? `from ${locationInfo.city}, ${locationInfo.country}` : '');
        } catch (error) {
            console.error('[Analytics] Error tracking session start:', error);
        }
    }

    // Update session end time
    async trackSessionEnd() {
        if (!this.db) return;

        try {
            const sessionRef = doc(this.db, this.sessionsPath, this.sessionId);
            await updateDoc(sessionRef, {
                endTime: Timestamp.now(),
                duration: Math.floor((Date.now() - this.sessionStartTime) / 1000) // in seconds
            });
            console.log('[Analytics] Session ended');
        } catch (error) {
            console.error('[Analytics] Error tracking session end:', error);
        }
    }

    // ==========================================
    // HELPER METHODS
    // ==========================================

    // Update daily stats
    async updateDailyStats(field) {
        if (!this.db) return;

        try {
            const today = this.getTodayString();
            const statsRef = doc(this.db, this.dailyStatsPath, today);

            const statsDoc = await getDoc(statsRef);

            if (statsDoc.exists()) {
                await updateDoc(statsRef, {
                    [field]: increment(1),
                    lastUpdated: Timestamp.now()
                });
            } else {
                await setDoc(statsRef, {
                    date: today,
                    pageViews: field === 'pageViews' ? 1 : 0,
                    sessions: field === 'sessions' ? 1 : 0,
                    newVisitors: field === 'newVisitors' ? 1 : 0,
                    jobViews: field === 'jobViews' ? 1 : 0,
                    whatsappClicks: field === 'whatsappClicks' ? 1 : 0,
                    agentSessions: field === 'agentSessions' ? 1 : 0,
                    agentMessages: field === 'agentMessages' ? 1 : 0,
                    lastUpdated: Timestamp.now()
                });
            }
        } catch (error) {
            console.error('[Analytics] Error updating daily stats:', error);
        }
    }

    // Update job-specific stats
    async updateJobStats(jobId, field) {
        if (!this.db || !jobId) return;

        try {
            const jobStatsPath = `/artifacts/${this.appId}/public/data/jobStats`;
            const statsRef = doc(this.db, jobStatsPath, jobId);

            const statsDoc = await getDoc(statsRef);

            if (statsDoc.exists()) {
                await updateDoc(statsRef, {
                    [field]: increment(1),
                    lastUpdated: Timestamp.now()
                });
            } else {
                await setDoc(statsRef, {
                    jobId: jobId,
                    views: field === 'views' ? 1 : 0,
                    whatsappClicks: field === 'whatsappClicks' ? 1 : 0,
                    lastUpdated: Timestamp.now()
                });
            }
        } catch (error) {
            console.error('[Analytics] Error updating job stats:', error);
        }
    }

    // Check if new visitor
    async checkIfNewVisitor() {
        if (!this.db) return true;

        try {
            const q = query(
                collection(this.db, this.sessionsPath),
                where('visitorId', '==', this.visitorId),
                limit(2)
            );
            const snapshot = await getDocs(q);
            return snapshot.size <= 1; // Only current session exists
        } catch (error) {
            return true;
        }
    }

    // ==========================================
    // ANALYTICS DATA RETRIEVAL (for Admin)
    // ==========================================

    // Get daily stats for date range
    async getDailyStats(days = 7) {
        if (!this.db) return [];

        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const stats = [];
            const q = query(
                collection(this.db, this.dailyStatsPath),
                orderBy('date', 'desc'),
                limit(days)
            );

            const snapshot = await getDocs(q);
            snapshot.forEach(doc => {
                stats.push({ id: doc.id, ...doc.data() });
            });

            return stats;
        } catch (error) {
            console.error('[Analytics] Error getting daily stats:', error);
            return [];
        }
    }

    // Get recent events
    async getRecentEvents(eventType = null, limitCount = 50) {
        if (!this.db) return [];

        try {
            let q;
            if (eventType) {
                q = query(
                    collection(this.db, this.eventsPath),
                    where('type', '==', eventType),
                    orderBy('timestamp', 'desc'),
                    limit(limitCount)
                );
            } else {
                q = query(
                    collection(this.db, this.eventsPath),
                    orderBy('timestamp', 'desc'),
                    limit(limitCount)
                );
            }

            const snapshot = await getDocs(q);
            const events = [];
            snapshot.forEach(doc => {
                events.push({ id: doc.id, ...doc.data() });
            });

            return events;
        } catch (error) {
            console.error('[Analytics] Error getting recent events:', error);
            return [];
        }
    }

    // Get job stats
    async getJobStats() {
        if (!this.db) return [];

        try {
            const jobStatsPath = `/artifacts/${this.appId}/public/data/jobStats`;
            const q = query(collection(this.db, jobStatsPath));

            const snapshot = await getDocs(q);
            const stats = [];
            snapshot.forEach(doc => {
                stats.push({ id: doc.id, ...doc.data() });
            });

            return stats;
        } catch (error) {
            console.error('[Analytics] Error getting job stats:', error);
            return [];
        }
    }

    // Get agent conversation history
    async getAgentConversations(limitCount = 20) {
        if (!this.db) return [];

        try {
            const q = query(
                collection(this.db, this.eventsPath),
                where('type', '==', 'agent_interaction'),
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            );

            const snapshot = await getDocs(q);
            const conversations = [];
            snapshot.forEach(doc => {
                conversations.push({ id: doc.id, ...doc.data() });
            });

            return conversations;
        } catch (error) {
            console.error('[Analytics] Error getting agent conversations:', error);
            return [];
        }
    }

    // Get summary stats
    async getSummaryStats() {
        if (!this.db) return null;

        try {
            const today = this.getTodayString();
            const todayRef = doc(this.db, this.dailyStatsPath, today);
            const todayDoc = await getDoc(todayRef);

            const dailyStats = await this.getDailyStats(7);

            let totalViews = 0;
            let totalSessions = 0;
            let totalWhatsApp = 0;
            let totalAgentSessions = 0;

            dailyStats.forEach(day => {
                totalViews += day.pageViews || 0;
                totalSessions += day.sessions || 0;
                totalWhatsApp += day.whatsappClicks || 0;
                totalAgentSessions += day.agentSessions || 0;
            });

            return {
                today: todayDoc.exists() ? todayDoc.data() : null,
                last7Days: {
                    totalViews,
                    totalSessions,
                    totalWhatsApp,
                    totalAgentSessions
                },
                dailyBreakdown: dailyStats
            };
        } catch (error) {
            console.error('[Analytics] Error getting summary stats:', error);
            return null;
        }
    }

    // Get recent sessions with location info
    async getRecentSessions(limitCount = 50) {
        if (!this.db) return [];

        try {
            const q = query(
                collection(this.db, this.sessionsPath),
                orderBy('startTime', 'desc'),
                limit(limitCount)
            );

            const snapshot = await getDocs(q);
            const sessions = [];
            snapshot.forEach(doc => {
                sessions.push({ id: doc.id, ...doc.data() });
            });

            return sessions;
        } catch (error) {
            console.error('[Analytics] Error getting recent sessions:', error);
            return [];
        }
    }
}

// Export singleton creator
let analyticsInstance = null;

export const initAnalytics = (db, appId) => {
    if (!analyticsInstance && db) {
        analyticsInstance = new AnalyticsService(db, appId);
    }
    return analyticsInstance;
};

export const getAnalytics = () => analyticsInstance;

export default AnalyticsService;
