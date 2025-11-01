/* global __firebase_config, __app_id, __initial_auth_token */ // <-- YEH HAI NAYA FIX

/**
 * Naya Project: Gulf Career Gateway (Full Stack)
 * FINAL VERSION
 * Yeh version __firebase_config (Canvas ke liye) aur .env file (localhost ke liye)
 * dono ko support karta hai.
 */

import React, { useState, useEffect, useRef } from 'react';

// Firebase imports
import { initializeApp } from "firebase/app";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    signInAnonymously,
    signInWithCustomToken
} from "firebase/auth";
import {
    getFirestore,
    collection,
    addDoc,
    query,
    onSnapshot,
    doc,
    setDoc,
    deleteDoc
} from "firebase/firestore";

// --------- CONFIGURATION (Final) ---------

// Yeh .env file (localhost) ya __firebase_config (Canvas) se config padhega
const firebaseConfigJson =
    process.env.REACT_APP_FIREBASE_CONFIG || // Pehle .env file check karega
    (typeof __firebase_config !== 'undefined'
        ? __firebase_config
        : '{"apiKey":"FALLBACK_API_KEY","authDomain":"FALLBACK_AUTH_DOMAIN","projectId":"FALLBACK_PROJECT_ID"}'); // Aakhiri fallback

let firebaseConfig;
try {
    firebaseConfig = JSON.parse(firebaseConfigJson);
} catch (e) {
    console.error("Firebase config parse error:", e);
    firebaseConfig = { apiKey: "INVALID_JSON", authDomain: "", projectId: "" }; // Error state
}

// *** YEH HAI SAHI (CORRECT) 'appId' ***
// Ab yeh Firebase Rules (-v2) se match karega
const appId = typeof __app_id !== 'undefined' ? __app_id : 'gulf-career-gateway-v2';

// Firebase App ko initialize karein
let app;
let auth;
let db;

// Check karein ki config valid hai ya nahi
if (firebaseConfig.apiKey === "FALLBACK_API_KEY" || firebaseConfig.apiKey === "INVALID_JSON") {
    console.error("Firebase Config nahi mila! App nahi chalega.");
} else {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
}

// ---------------------------------------------------------------


/**
 * === Admin Panel Component ===
 * Yahaan se admin photo upload karke job daal sakta hai.
 */
const AdminPanel = ({ user }) => {
    const [jobTitle, setJobTitle] = useState("");
    const [jobCompany, setJobCompany] = useState("");
    const [jobDescription, setJobDescription] = useState("");

    const [imageFile, setImageFile] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    const fileInputRef = useRef(null);

    // Step 1: Image ko base64 string mein convert karein
    const toBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]); // Data URL se base64 hissa nikaalein
        reader.onerror = error => reject(error);
    });

    // Step 2: Gemini AI se image ko scan karwayein
    const scanImageWithAI = async () => {
        if (!imageFile) {
            setScanError("Pehle ek image select karein.");
            return;
        }

        setIsScanning(true);
        setScanError(null);
        setJobTitle(""); // Purana data saaf karein
        setJobCompany("");
        setJobDescription("");

        try {
            const base64ImageData = await toBase64(imageFile);
            // *** YEH HAI NAYA CHANGE: .env file se key padhein ***
            const apiKey = process.env.REACT_APP_GEMINI_API_KEY || "";

            // Check karein ki key mili ya nahi
            if (!apiKey) {
                setScanError("Gemini API Key nahi mili. .env file check karein aur server restart karein.");
                setIsScanning(false);
                return;
            }

            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

            // Gemini ko prompt (hidayat) de rahe hain
            const systemPrompt = "Aap ek expert data extractor hain. Is image se job vacancy ki details nikaalein. Sirf JSON format mein response dein.";
            const userQuery = "Is job vacancy ki image se 'title', 'company', aur 'description' extract karo. Agar koi detail na mile, toh use 'N/A' set kar dena.";

            // JSON Schema Gemini ko batata hai ki humein kaisa response chahiye
            const jsonSchema = {
                "type": "OBJECT",
                "properties": {
                    "title": { "type": "STRING" },
                    "company": { "type": "STRING" },
                    "description": { "type": "STRING" }
                }
            };

            const payload = {
                contents: [
                    {
                        role: "user",
                        parts: [
                            { text: userQuery },
                            {
                                inlineData: {
                                    mimeType: imageFile.type,
                                    data: base64ImageData
                                }
                            }
                        ]
                    }
                ],
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: jsonSchema
                }
            };

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.json();
                console.error("Gemini API Error Body:", errorBody);
                throw new Error(`Gemini API Error: ${response.statusText} - ${errorBody?.error?.message || 'Unknown error'}`);
            }

            const result = await response.json();

            const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (jsonText) {
                const parsedJson = JSON.parse(jsonText);
                // AI se mila data form mein bhar dein
                setJobTitle(parsedJson.title || "N/A");
                setJobCompany(parsedJson.company || "N/A");
                setJobDescription(parsedJson.description || "N/A");
            } else {
                throw new Error("AI se JSON response nahi mila.");
            }

        } catch (error) {
            console.error("AI Scan Error:", error);
            setScanError(`Image scan karne mein error hua: ${error.message}`);
        } finally {
            setIsScanning(false);
        }
    };

    // Step 3: Form data ko Firebase database mein save karein
    const handleJobUpload = async (e) => {
        e.preventDefault();
        if (!jobTitle) {
            alert("Job title zaroori hai.");
            return;
        }

        setIsUploading(true);
        try {
            // '/artifacts/{appId}/public/data/jobs' path par data save karein
            // ** Yahaan 'appId' ab 'gulf-career-gateway-v2' hoga **
            const jobsCollectionPath = `/artifacts/${appId}/public/data/jobs`;
            await addDoc(collection(db, jobsCollectionPath), {
                title: jobTitle,
                company: jobCompany,
                description: jobDescription,
                createdAt: new Date()
            });

            // Form ko reset karein
            setJobTitle("");
            setJobCompany("");
            setJobDescription("");
            setImageFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            alert("Nayi job safaltapoorvak add ho gayi!");

        } catch (error) {
            console.error("Job Upload Error:", error);
            alert("Job upload karne mein error hua.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="p-6 bg-gray-100 min-h-screen">
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
                <h2 className="text-3xl font-bold mb-6 text-gray-800">Admin Panel</h2>
                <p className="mb-4 text-gray-600">Nayi job vacancy daalne ke liye photo upload karein:</p>

                {/* Section 1: Photo Upload */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vacancy Image</label>
                    <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        ref={fileInputRef}
                        onChange={(e) => setImageFile(e.target.files[0])}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                </div>

                {/* Section 2: AI Scan Button */}
                <div className="mb-6">
                    <button
                        onClick={scanImageWithAI}
                        disabled={isScanning || !imageFile}
                        className={`w-full px-4 py-2 font-semibold rounded-lg text-white ${isScanning ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
                            } transition duration-300 disabled:opacity-50`}
                    >
                        {isScanning ? "Scanning... (AI kaam kar raha hai)" : "AI se Data Scan Karein"}
                    </button>
                    {scanError && <p className="text-red-500 text-sm mt-2">{scanError}</p>}
                </div>

                {/* Section 3: Job Form */}
                <form onSubmit={handleJobUpload}>
                    <div className="mb-4">
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700">Job Title</label>
                        <input
                            type="text"
                            id="title"
                            value={jobTitle}
                            onChange={(e) => setJobTitle(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="AI yahaan title daal dega"
                        />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="company" className="block text-sm font-medium text-gray-700">Company</label>
                        <input
                            type="text"
                            id="company"
                            value={jobCompany}
                            onChange={(e) => setJobCompany(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="AI yahaan company ka naam daal dega"
                        />
                    </div>
                    <div className="mb-6">
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                        <textarea
                            id="description"
                            rows="6"
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="AI yahaan poora description daal dega"
                        />
                    </div>

                    {/* Section 4: Submit Button */}
                    <button
                        type="submit"
                        disabled={isUploading || !jobTitle}
                        className={`w-full px-4 py-3 font-bold rounded-lg text-white ${isUploading ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"
                            } transition duration-300 disabled:opacity-50`}
                    >
                        {isUploading ? "Uploading..." : "Job ko Database Mein Save Karein"}
                    </button>
                </form>
            </div>
        </div>
    );
};

/**
 * === Public Job List Component ===
 * Yahaan sabko database se jobs dikhengi.
 */
const PublicJobList = () => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Database se real-time mein jobs fetch karein
        // ** Yahaan 'appId' ab 'gulf-career-gateway-v2' hoga **
        const jobsCollectionPath = `/artifacts/${appId}/public/data/jobs`;
        const q = query(collection(db, jobsCollectionPath));

        // onSnapshot real-time connection banata hai
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const jobsData = [];
            querySnapshot.forEach((doc) => {
                jobsData.push({ id: doc.id, ...doc.data() });
            });
            // Jobs ko sort karein, nayi job upar
            jobsData.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                return dateB - dateA;
            });
            setJobs(jobsData);
            setLoading(false);
        }, (error) => {
            console.error("Jobs fetch karne mein error:", error);
            setLoading(false);
        });

        // Cleanup function
        return () => unsubscribe();
    }, []);

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-4xl font-extrabold text-center mb-8 text-gray-900">Gulf Career Gateway</h1>
                {loading && <p className="text-center text-gray-600">Loading jobs...</p>}

                {!loading && jobs.length === 0 && (
                    <p className="text-center text-gray-600">Abhi koi job available nahi hai.</p>
                )}

                <div className="space-y-6">
                    {jobs.map((job) => (
                        <div key={job.id} className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-300">
                            <h2 className="text-2xl font-bold text-blue-700 mb-2">{job.title}</h2>
                            <h3 className="text-lg font-semibold text-gray-700 mb-3">{job.company}</h3>
                            <p className="text-gray-600 whitespace-pre-wrap">{job.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

/**
 * === Admin Login Component ===
 * Yahaan admin login karega.
 */
const AdminLogin = ({ setPage }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Login successful, App component state badal dega
        } catch (error) {
            console.error("Login Error:", error);
            setError("Login fail ho gaya. Email ya password ghalat hai.");
        } finally {
            setLoading(false);
        }
    };

    /**
     * === NAYA ADMIN BANANE KA FUNCTION ===
     * Is function ko humne neeche 'window' par add kar diya hai.
     * Aapko browser console mein jaakar yeh chalaana hai:
     * * createNewAdmin("admin@email.com", "password123")
     * * Isse aapka pehla admin user ban jaayega.
     */
    window.createNewAdmin = async (adminEmail, adminPassword) => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
            console.log("Naya admin user ban gaya:", userCredential.user.email);
            alert("Naya admin user safaltapoorvak ban gaya!");
        } catch (error) {
            console.error("Admin banane mein error:", error);
            alert("Admin banane mein error hua: " + error.message);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-xl">
                <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Admin Login</h2>
                <form onSubmit={handleLogin}>
                    <div className="mb-4">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>
                    <div className="mb-6">
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full px-4 py-2 font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition duration-300 disabled:opacity-50"
                    >
                        {loading ? "Logging in..." : "Login"}
                    </button>
                </form>
                <p className="text-center text-gray-500 text-xs mt-6">
                    Admin user banane ke liye, browser console mein `createNewAdmin('email', 'password')` command chalayein.
                </p>
            </div>
        </div>
    );
};


/**
 * === Main App Component ===
 * Yeh component decide karta hai ki kaun sa page dikhaana hai.
 */
export default function App() {
    const [user, setUser] = useState(null); // Current user
    const [page, setPage] = useState('public'); // 'public', 'admin', 'admin-login'
    const [authReady, setAuthReady] = useState(false); // Auth check karne ke liye

    // Auth state check karein
    useEffect(() => {
        // Agar firebase hi initialize nahi hua, toh kuch mat karo
        if (!auth || !db) {
            setAuthReady(false); // Auth ready nahi hai
            return;
        }

        // Canvas environment se token check karein
        const initAuth = async () => {
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    // Koi token nahi, toh anonymously sign in karein
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Auth initialization error:", error);
                // Agar auth fail ho, tab bhi anonymously try karein
                if (!auth.currentUser) {
                    await signInAnonymously(auth);
                }
            }

            // Auth state change par listen karein
            const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
                if (currentUser && !currentUser.isAnonymous) {
                    // Agar user anonymous nahi hai (yaani admin hai)
                    setUser(currentUser);
                    setPage('admin'); // Seedha admin panel par bhej do
                } else {
                    // Agar user anonymous hai ya logged out hai
                    setUser(null);
                    // Check karein ki user '/admin' URL par jaana chahta hai kya
                    if (window.location.hash === '#admin') {
                        setPage('admin-login');
                    } else {
                        setPage('public');
                    }
                }
                setAuthReady(true);
            });
            return unsubscribe;
        };

        initAuth();
    }, []);

    // URL hash change par listen karein (taaki /#admin kaam kare)
    useEffect(() => {
        const handleHashChange = () => {
            if (window.location.hash === '#admin' && !user) {
                setPage('admin-login');
            } else if (window.location.hash === '#admin' && user) {
                setPage('admin');
            } else {
                setPage('public');
                window.location.hash = ''; // Hash saaf karein
            }
        };
        window.addEventListener('hashchange', handleHashChange);
        // Initial load par bhi check karein
        if (window.location.hash === '#admin' && !user && authReady) {
            setPage('admin-login');
        }

        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [user, authReady]);

    // Logout function
    const handleLogout = async () => {
        if (auth) {
            await signOut(auth);
        }
        setPage('public');
        window.location.hash = '';
    };

    // Agar Firebase config hi nahi hai, toh error dikhayein
    if (firebaseConfig.apiKey === "FALLBACK_API_KEY" || firebaseConfig.apiKey === "INVALID_JSON") {
        return (
            <div className="flex items-center justify-center min-h-screen p-10 bg-red-100 text-red-800">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">Configuration Error!</h1>
                    <p>Firebase API keys nahi mili.</p>
                    <p>Kripya `client` folder mein `.env` file banayein aur usmein `REACT_APP_FIREBASE_CONFIG` set karein.</p>
                </div>
            </div>
        );
    }

    // Loading state jab tak auth ready na ho
    if (!authReady) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-xl text-gray-600">Loading Gulf Career Gateway...</p>
            </div>
        );
    }

    // Admin Panel (Header ke saath)
    if (page === 'admin') {
        return (
            <div>
                <nav className="bg-gray-800 text-white p-4 flex justify-between items-center shadow-md">
                    <h1 className="text-xl font-bold">Admin Panel</h1>
                    <button
                        onClick={handleLogout}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition duration-300"
                    >
                        Logout
                    </button>
                </nav>
                <AdminPanel user={user} />
            </div>
        );
    }

    // Admin Login Page
    if (page === 'admin-login') {
        return <AdminLogin setPage={setPage} />;
    }

    // Public Job List (default)
    return (
        <div>
            <nav className="bg-white text-gray-800 p-4 flex justify-between items-center shadow-md">
                <h1 className="text-2xl font-bold text-blue-700">Gulf Career Gateway</h1>
                <a
                    href="#admin"
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition duration-300"
                >
                    Admin Login
                </a>
            </nav>
            <PublicJobList />
        </div>
    );
}

