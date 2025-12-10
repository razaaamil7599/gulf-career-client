import React, { useState, useEffect, useRef } from 'react';

/**
 * AI Voice Agent v4.0 - With Gemini AI
 * Uses Google's Gemini API for natural conversation
 * No scripted responses - Real AI understanding
 */

const VoiceAgent = ({ siteWhatsapp, jobs = [] }) => {
    // States
    const [showWelcome, setShowWelcome] = useState(true);
    const [isActive, setIsActive] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState('hi-IN');
    const [debugInfo, setDebugInfo] = useState('');
    const [conversationHistory, setConversationHistory] = useState([]);

    // Refs
    const recognitionRef = useRef(null);
    const audioRef = useRef(null);
    const isProcessingRef = useRef(false);

    // API Keys
    const GOOGLE_TTS_KEY = process.env.REACT_APP_GOOGLE_TTS_KEY || '';
    const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || '';

    // Log helper
    const log = (msg) => {
        console.log(`[VoiceAgent] ${msg}`);
        setDebugInfo(msg);
    };

    // Language configs
    const languages = {
        'hi-IN': {
            flag: '🇮🇳',
            code: 'hi',
            voiceName: 'hi-IN-Wavenet-A',
            welcomeTitle: 'Gulf Career Gateway 🙏',
            welcomeText: 'AI Assistant से बात करें',
            startBtn: 'बात करें 🎤',
            greeting: 'Gulf Career Gateway mein aapka swagat hai. Main aapki AI assistant hun. Jobs, visa, salary - kuch bhi puchiye, main batati hun.',
            thinking: 'Soch rahi hun...',
            error: 'Sorry, kuch problem ho gayi. Phir se boliye.'
        },
        'ur-PK': {
            flag: '🇵🇰',
            code: 'ur',
            voiceName: 'ur-PK-Wavenet-A',
            welcomeTitle: 'السلام علیکم! 🙏',
            welcomeText: 'AI Assistant سے بات کریں',
            startBtn: 'بات کریں 🎤',
            greeting: 'السلام علیکم! میں گلف کیریئر کا AI اسسٹنٹ ہوں۔ آپ مجھ سے جابز، ویزا، تنخواہ، کوئی بھی سوال پوچھ سکتے ہیں۔ بولیے۔',
            thinking: 'سوچ رہا ہوں...',
            error: 'معذرت، کچھ غلط ہو گیا۔ دوبارہ بولیے۔'
        },
        'en-IN': {
            flag: '🇬🇧',
            code: 'en',
            voiceName: 'en-IN-Wavenet-D',
            welcomeTitle: 'Hello! 👋',
            welcomeText: 'Talk to AI Assistant',
            startBtn: 'Start Talking 🎤',
            greeting: 'Hello! I am Gulf Career AI Assistant. Ask me anything about jobs, visa, salary, documents, or any other question. Go ahead, I am listening.',
            thinking: 'Thinking...',
            error: 'Sorry, something went wrong. Please try again.'
        },
        'ar-SA': {
            flag: '🇸🇦',
            code: 'ar',
            voiceName: 'ar-XA-Wavenet-A',
            welcomeTitle: 'السلام عليكم! 🙏',
            welcomeText: 'تحدث مع المساعد الذكي',
            startBtn: 'تحدث الآن 🎤',
            greeting: 'السلام عليكم! أنا مساعد غلف كارير الذكي. اسألني عن الوظائف، التأشيرة، الراتب، أي سؤال. تفضل.',
            thinking: 'أفكر...',
            error: 'عذراً، حدث خطأ. حاول مرة أخرى.'
        },
        'bn-IN': {
            flag: '🇧🇩',
            code: 'bn',
            voiceName: 'bn-IN-Wavenet-A',
            welcomeTitle: 'নমস্কার! 🙏',
            welcomeText: 'AI অ্যাসিস্ট্যান্টের সাথে কথা বলুন',
            startBtn: 'কথা বলুন 🎤',
            greeting: 'নমস্কার! আমি গাল্ফ ক্যারিয়ারের AI অ্যাসিস্ট্যান্ট। চাকরি, ভিসা, বেতন, যেকোনো প্রশ্ন করুন। বলুন।',
            thinking: 'ভাবছি...',
            error: 'দুঃখিত, কিছু ভুল হয়েছে। আবার বলুন।'
        }
    };

    const lang = languages[selectedLanguage];

    // Build context about available jobs from Firebase
    const getJobsContext = () => {
        if (jobs && jobs.length > 0) {
            const jobList = jobs.slice(0, 15).map(j => {
                // Parse description for salary info if not in separate field
                let salary = j.salary || '';
                let desc = j.description || '';

                // Try to extract salary from description if not set
                if (!salary && desc) {
                    const salaryMatch = desc.match(/(\d{3,4})\s*(SAR|riyal|रियाल)/i);
                    if (salaryMatch) salary = salaryMatch[1] + ' SAR';
                }

                return `- ${j.title}: Company ${j.company || 'Gulf Company'}${salary ? `, Salary ${salary}` : ''}`;
            }).join('\n');

            return `CURRENT VACANCIES (${jobs.length} total jobs available):\n${jobList}\n\nUser ko yeh sab jobs ke baare mein bata sakte ho.`;
        }
        return `Currently no specific jobs loaded. Tell user to check website or WhatsApp for latest vacancies.`;
    };

    // GEMINI AI - Get response
    const getAIResponse = async (userMessage) => {
        if (!GEMINI_API_KEY) {
            log('No Gemini API key!');
            return lang.error;
        }

        setIsThinking(true);
        log('Asking Gemini AI...');

        const systemPrompt = `You are a professional multilingual AI customer service assistant for Gulf Career Gateway, a job recruitment agency for Gulf countries.

UNIVERSAL LANGUAGE SUPPORT:
- You can speak ANY language in the world - use whatever language the user speaks
- Auto-detect user's language and REPLY IN THAT SAME LANGUAGE
- Support includes: Hindi, English, Arabic, Urdu, Bengali, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Punjabi, Odia, Assamese, Nepali, Bhojpuri, Persian/Farsi, Indonesian, Malay, Filipino, Thai, Vietnamese, Chinese, Japanese, Korean, Russian, French, Spanish, Portuguese, German, Italian, Turkish, Swahili, Amharic, and ALL other languages that you know
- If user speaks in their regional language/dialect, respond in that same language
- For Indian users: support all state languages - Tamil (तमिल), Telugu (తెలుగు), Kannada (ಕನ್ನಡ), Malayalam (മലയാളം), Bengali (বাংলা), Marathi (मराठी), Gujarati (ગુજરાતી), Punjabi (ਪੰਜਾਬੀ), Odia (ଓଡ଼ିଆ), Assamese (অসমীয়া)
- For Arabic dialects: Gulf Arabic, Egyptian Arabic, Levantine, Moroccan, etc.

TONE & STYLE:
- Professional and respectful customer service tone
- Use polite forms (Aap, Ji, Sir, Madam)
- Warm but professional - NOT casual street talk
- Sound like trained call center professional
- Keep responses SHORT (2-3 sentences) for voice

YOUR PERSONA:
- You are a FEMALE assistant - your voice is female
- Use FEMININE forms in Hindi: "main batati hun", "main karti hun", "main sun rahi hun", "main madad karungi"
- NEVER use masculine forms like "batata hun", "karta hun", "sun raha hun"
- In Urdu/Hindi: Always use feminine verb endings (-ti, -rahi, -gi)

IMPORTANT - DO NOT ASK ABOUT LANGUAGE:
- NEVER ask "Main aapki kis language mein madad karun" or similar
- Just detect the user's language from their message and respond in THAT language
- If user asks about jobs, tell them about jobs - don't ask which language
- Answer the question directly, don't waste time asking language preference

AGENCY INFO:
- Company: Gulf Career Gateway  
- WhatsApp: ${siteWhatsapp || '+91 98765 43210'}
- Process: Documents → Medical → MOFA → Visa (45-60 days)
- Documents: Passport, Photo, Certificate, Medical, Police Clearance

${getJobsContext()}

VISA PROCESS:
1. Document Collection (5-7 days)
2. Medical Test (2-3 days)
3. MOFA Attestation (7-10 days)
4. Embassy Stamping (3-5 days)
5. Visa Issuance (7-14 days)

RULES:
- Short voice-friendly answers (2-3 lines max)
- Ask them to WhatsApp for applying
- If unsure, offer to connect with human agent
- End with "Aur kuch?" in their language
- SALARY: Say "1200 riyal" normally

CRITICAL - PHONE NUMBERS:
⚠️ NEVER EVER say phone numbers as "91 crore" or "918 million" etc!
⚠️ ALWAYS say each digit separately with small pauses
✅ CORRECT: "nau ek, nau aath do two zero, six two four, three six one" 
✅ CORRECT: "nine one, nine eight two zero, six two four, three six one"
❌ WRONG: "ninety one crore eighty two lakh..."
The WhatsApp number is: ${siteWhatsapp}. Say it DIGIT BY DIGIT like: "${siteWhatsapp.split('').join(' ')}"`;


        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [
                            {
                                role: 'user',
                                parts: [{
                                    text: systemPrompt + '\n\nConversation so far:\n' +
                                        conversationHistory.map(m => `${m.role}: ${m.text}`).join('\n') +
                                        '\n\nUser says: ' + userMessage + '\n\nRespond naturally:'
                                }]
                            }
                        ],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 150
                        }
                    })
                }
            );

            const data = await response.json();
            setIsThinking(false);

            if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                const aiResponse = data.candidates[0].content.parts[0].text;

                // Update conversation history
                setConversationHistory(prev => [
                    ...prev.slice(-6), // Keep last 6 messages for context
                    { role: 'User', text: userMessage },
                    { role: 'Assistant', text: aiResponse }
                ]);

                return aiResponse;
            } else {
                log('Gemini error: ' + JSON.stringify(data));
                return lang.error;
            }
        } catch (error) {
            log('Gemini fetch error: ' + error.message);
            setIsThinking(false);
            return lang.error;
        }
    };

    // SPEAK function
    const speak = async (text, onComplete) => {
        if (!text || isSpeaking || isProcessingRef.current) return;

        isProcessingRef.current = true;
        setIsSpeaking(true);
        log(`Speaking: "${text.substring(0, 50)}..."`);

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        window.speechSynthesis.cancel();

        // Detect language from text and get appropriate voice
        // Using Neural2 voices (most human-like) where available, fallback to Wavenet
        const detectVoice = (txt) => {
            // Check for Arabic script - Neural2 available
            if (/[\u0600-\u06FF]/.test(txt)) return { lang: 'ar-XA', voice: 'ar-XA-Neural2-A' };
            // Bengali script - Wavenet only
            if (/[\u0980-\u09FF]/.test(txt)) return { lang: 'bn-IN', voice: 'bn-IN-Wavenet-A' };
            // Tamil script - Neural2 available
            if (/[\u0B80-\u0BFF]/.test(txt)) return { lang: 'ta-IN', voice: 'ta-IN-Neural2-A' };
            // Telugu script - Neural2 available
            if (/[\u0C00-\u0C7F]/.test(txt)) return { lang: 'te-IN', voice: 'te-IN-Neural2-A' };
            // Kannada script - Neural2 available
            if (/[\u0C80-\u0CFF]/.test(txt)) return { lang: 'kn-IN', voice: 'kn-IN-Neural2-A' };
            // Malayalam script - Neural2 available
            if (/[\u0D00-\u0D7F]/.test(txt)) return { lang: 'ml-IN', voice: 'ml-IN-Neural2-A' };
            // Gujarati script - Neural2 available
            if (/[\u0A80-\u0AFF]/.test(txt)) return { lang: 'gu-IN', voice: 'gu-IN-Neural2-A' };
            // Punjabi/Gurmukhi script - Wavenet only
            if (/[\u0A00-\u0A7F]/.test(txt)) return { lang: 'pa-IN', voice: 'pa-IN-Wavenet-A' };
            // Marathi - Wavenet only (Neural2 not available)
            if (/[\u0900-\u097F]/.test(txt) && (txt.includes('आहे') || txt.includes('करू') || txt.includes('मी'))) {
                return { lang: 'mr-IN', voice: 'mr-IN-Wavenet-A' };
            }
            // Hindi - Neural2 available (most natural)
            if (/[\u0900-\u097F]/.test(txt)) return { lang: 'hi-IN', voice: 'hi-IN-Neural2-D' };
            // Default English - Neural2
            return { lang: 'en-IN', voice: 'en-IN-Neural2-A' };
        };

        const voiceConfig = detectVoice(text);
        log(`Using voice: ${voiceConfig.voice}`);

        // Try Google Cloud TTS first
        if (GOOGLE_TTS_KEY && GOOGLE_TTS_KEY.length > 10) {
            try {
                const response = await fetch(
                    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            input: { text },
                            voice: { languageCode: voiceConfig.lang, name: voiceConfig.voice, ssmlGender: 'FEMALE' },
                            audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 0, volumeGainDb: 2 }
                        })
                    }
                );

                if (response.ok) {
                    const data = await response.json();
                    const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
                    audioRef.current = audio;

                    audio.onended = () => {
                        setIsSpeaking(false);
                        isProcessingRef.current = false;
                        if (onComplete) setTimeout(onComplete, 300);
                    };

                    audio.onerror = () => speakFallback(text, onComplete, voiceConfig.lang);
                    await audio.play();
                    return;
                }
            } catch (error) {
                log('TTS error: ' + error.message);
            }
        }

        speakFallback(text, onComplete, voiceConfig.lang);
    };

    const speakFallback = (text, onComplete) => {
        const synth = window.speechSynthesis;
        synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = selectedLanguage;
        utterance.rate = 0.95;

        utterance.onend = () => {
            setIsSpeaking(false);
            isProcessingRef.current = false;
            if (onComplete) setTimeout(onComplete, 300);
        };

        utterance.onerror = () => {
            setIsSpeaking(false);
            isProcessingRef.current = false;
            if (onComplete) setTimeout(onComplete, 300);
        };

        synth.speak(utterance);
    };

    // LISTEN function
    const startListening = () => {
        if (isListening || isSpeaking || isProcessingRef.current || isThinking) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            log('Speech Recognition not supported');
            return;
        }

        log('Listening...');
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;

        recognition.lang = selectedLanguage;
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => setIsListening(true);

        recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript;
            log(`Heard: "${transcript}"`);
            setIsListening(false);

            // Check for WhatsApp intent
            const req = transcript.toLowerCase();

            // If user is ASKING for the number, let AI respond with the number
            const isAskingNumber = req.includes('number') || req.includes('नंबर') ||
                req.includes('bataiye') || req.includes('बताइए') ||
                req.includes('batao') || req.includes('बताओ') ||
                req.includes('kya hai') || req.includes('क्या है');

            // Only open WhatsApp if explicitly asking to open/connect, NOT asking for number
            const isOpenWhatsAppIntent = !isAskingNumber && (
                (req.includes('whatsapp') && (req.includes('kholo') || req.includes('खोलो') || req.includes('open'))) ||
                req.includes('व्हाट्सएप खोलो') ||
                (req.includes('call') && req.includes('karo')) ||
                (req.includes('कॉल') && req.includes('करो')) ||
                req.includes('agent se baat karo') ||
                req.includes('एजेंट से बात करो')
            );

            if (isOpenWhatsAppIntent) {
                speak('WhatsApp khol raha hun. Agent se baat karein.', () => {
                    window.open(`https://wa.me/${siteWhatsapp || '919876543210'}?text=Hi, I need help with Gulf jobs.`, '_blank');
                    setTimeout(startListening, 1000);
                });
                return;
            }

            // Get AI response
            const aiResponse = await getAIResponse(transcript);
            speak(aiResponse, startListening);
        };

        recognition.onerror = (event) => {
            log('Listen error: ' + event.error);
            setIsListening(false);
            if (event.error === 'no-speech') {
                setTimeout(startListening, 500);
            }
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    };

    // START button click
    const handleStart = () => {
        setShowWelcome(false);
        setIsActive(true);
        setTimeout(() => {
            speak(lang.greeting, startListening);
        }, 500);
    };

    // Language change
    const handleLanguageChange = (langCode) => {
        if (langCode === selectedLanguage) return;
        window.speechSynthesis.cancel();
        if (audioRef.current) audioRef.current.pause();
        if (recognitionRef.current) try { recognitionRef.current.abort(); } catch (e) { }
        setIsSpeaking(false);
        setIsListening(false);
        isProcessingRef.current = false;
        setSelectedLanguage(langCode);
        setConversationHistory([]);
    };

    // Cleanup
    useEffect(() => {
        return () => {
            window.speechSynthesis.cancel();
            if (audioRef.current) audioRef.current.pause();
            if (recognitionRef.current) try { recognitionRef.current.abort(); } catch (e) { }
        };
    }, []);

    // ============================================
    // RENDER
    // ============================================

    // Welcome screen
    if (showWelcome) {
        return (
            <div className="fixed bottom-0 left-0 right-0 md:bottom-6 md:left-auto md:right-6 md:w-80 z-50">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 md:rounded-3xl shadow-2xl border-t md:border border-slate-700 overflow-hidden">
                    <div className="p-3 bg-slate-800/50 flex justify-center gap-2">
                        {Object.entries(languages).map(([code, l]) => (
                            <button
                                key={code}
                                onClick={() => handleLanguageChange(code)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${selectedLanguage === code ? 'bg-green-600 scale-110 ring-2 ring-green-400' : 'bg-slate-700 hover:bg-slate-600'
                                    }`}
                            >
                                {l.flag}
                            </button>
                        ))}
                    </div>

                    <div className="p-8 text-center">
                        <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden ring-4 ring-green-500 shadow-xl">
                            <img src="/ai-assistant.png" alt="AI Assistant" className="w-full h-full object-cover" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">{lang.welcomeTitle}</h2>
                        <p className="text-slate-400 mb-6">{lang.welcomeText}</p>

                        <button
                            onClick={handleStart}
                            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xl font-bold rounded-2xl hover:scale-105 transition-transform shadow-lg"
                        >
                            {lang.startBtn}
                        </button>
                    </div>

                    <div className="p-3 border-t border-slate-700 text-center">
                        <button onClick={() => { setShowWelcome(false); setIsMinimized(true); }} className="text-slate-500 text-sm hover:text-slate-300">
                            Skip (baad mein baat karein)
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Minimized
    if (isMinimized) {
        return (
            <button
                onClick={() => {
                    setIsMinimized(false);
                    setIsActive(true);
                    speak('Haan boliye, main sun rahi hun.', startListening);
                }}
                className="fixed bottom-6 left-6 w-16 h-16 rounded-full overflow-hidden ring-4 ring-green-500 shadow-2xl hover:scale-110 transition-transform z-50"
            >
                <img src="/ai-assistant.png" alt="AI" className="w-full h-full object-cover" />
            </button>
        );
    }

    if (!isActive) return null;

    // Main UI
    return (
        <div className="fixed bottom-0 left-0 right-0 md:bottom-6 md:left-auto md:right-6 md:w-80 z-50">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 md:rounded-3xl shadow-2xl border-t md:border border-slate-700">

                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full overflow-hidden ring-2 ring-white/50 ${isSpeaking || isThinking ? 'animate-pulse' : ''}`}>
                            <img src="/ai-assistant.png" alt="AI" className="w-full h-full object-cover" />
                        </div>
                        {isListening && (
                            <div className="flex items-center gap-1 h-8">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="w-1 bg-white rounded-full animate-pulse" style={{ height: `${15 + i * 5}px`, animationDelay: `${i * 0.1}s` }} />
                                ))}
                            </div>
                        )}
                        {isThinking && <span className="text-white text-sm">{lang.thinking}</span>}
                    </div>
                    <button onClick={() => setIsMinimized(true)} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
                        ➖
                    </button>
                </div>

                {/* Debug */}
                <div className="px-4 py-1 bg-slate-800/50 text-xs text-slate-500 font-mono truncate">
                    {debugInfo}
                </div>

                {/* Main Content */}
                <div className="p-6 flex flex-col items-center">
                    <div className="text-5xl mb-4">
                        {isThinking ? '🤔' : isSpeaking ? '🗣️' : isListening ? '👂' : '💭'}
                    </div>

                    {/* Mic Button */}
                    <button
                        onClick={() => {
                            if (isListening && recognitionRef.current) {
                                recognitionRef.current.stop();
                            } else if (!isSpeaking && !isThinking) {
                                startListening();
                            }
                        }}
                        disabled={isSpeaking || isThinking}
                        className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl transition-all ${isListening ? 'bg-red-500 animate-pulse' :
                            isThinking ? 'bg-yellow-500 cursor-wait' :
                                isSpeaking ? 'bg-blue-500 cursor-wait' :
                                    'bg-gradient-to-r from-green-500 to-emerald-600 hover:scale-105'
                            } text-white shadow-xl`}
                    >
                        {isThinking ? '⏳' : isListening ? '⏹️' : isSpeaking ? '🔊' : '🎤'}
                    </button>

                    {/* Quick Actions */}
                    {!isSpeaking && !isThinking && (
                        <div className="grid grid-cols-4 gap-3 mt-6 w-full">
                            <button
                                onClick={() => speak('अभी हमारे पास Indoor Cleaning, Warehouse Helper, Driver, Tea Boy जैसी जॉब्स हैं। सैलरी 1200 से 1800 रियाल तक। क्या आप अप्लाई करना चाहेंगे?', startListening)}
                                className="p-4 bg-slate-700 hover:bg-slate-600 rounded-2xl text-3xl"
                            >💼</button>
                            <button
                                onClick={() => speak('वीजा प्रोसेस में पहले डॉक्यूमेंट, फिर मेडिकल, MOFA, और फाइनल वीजा होता है। कुल 45 से 60 दिन लगते हैं। कुछ और पूछना है?', startListening)}
                                className="p-4 bg-slate-700 hover:bg-slate-600 rounded-2xl text-3xl"
                            >📋</button>
                            <button
                                onClick={() => speak('आपको पासपोर्ट, फोटो, एजुकेशन सर्टिफिकेट, मेडिकल रिपोर्ट और पुलिस क्लीयरेंस चाहिए होगा। और कुछ?', startListening)}
                                className="p-4 bg-slate-700 hover:bg-slate-600 rounded-2xl text-3xl"
                            >📄</button>
                            <button
                                onClick={() => {
                                    speak('WhatsApp खोल रहा हूं।', () => {
                                        window.open(`https://wa.me/${siteWhatsapp || '919876543210'}?text=Hi, I need help with Gulf jobs.`, '_blank');
                                    });
                                }}
                                className="p-4 bg-green-600 hover:bg-green-700 rounded-2xl text-3xl"
                            >📞</button>
                        </div>
                    )}
                </div>

                {/* Language Flags */}
                <div className="p-3 border-t border-slate-700">
                    <div className="flex justify-center gap-2">
                        {Object.entries(languages).map(([code, l]) => (
                            <button
                                key={code}
                                onClick={() => handleLanguageChange(code)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${selectedLanguage === code ? 'bg-green-600 scale-110 ring-2 ring-green-400' : 'bg-slate-700 hover:bg-slate-600'
                                    }`}
                            >
                                {l.flag}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VoiceAgent;
