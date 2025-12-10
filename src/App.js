/* global __firebase_config, __app_id, __initial_auth_token */

/**
 * Gulf Career Gateway - App.js (complete)
 * - Hardcoded admin login (per user request)
 * - Privacy Policy & Terms included on same page
 * - Cloudinary unsigned upload helper expected at ./upload-cloudinary
 */

import React, { useState, useEffect, useRef } from 'react';

// Firebase imports
import { initializeApp } from "firebase/app";
import {
    getAuth,
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
    deleteDoc,
    getDoc
} from "firebase/firestore";

// Cloudinary upload helper
import { uploadToCloudinary } from './upload-cloudinary';

// Google Generative AI SDK import (kept for AI scan usage)
import { GoogleGenerativeAI } from '@google/generative-ai';


// Premium Components
import VoiceAgent from './components/VoiceAgent';
import HeroSection from './components/HeroSection';
import JobCard from './components/JobCard';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// --------- CONFIGURATION (Final) ---------

const firebaseConfigJson =
    process.env.REACT_APP_FIREBASE_CONFIG ||
    (typeof __firebase_config !== 'undefined'
        ? __firebase_config
        : '{"apiKey":"FALLBACK_API_KEY","authDomain":"FALLBACK_AUTH_DOMAIN","projectId":"FALLBACK_PROJECT_ID"}');

let firebaseConfig;
try {
    firebaseConfig = JSON.parse(firebaseConfigJson);
} catch (e) {
    console.error("Firebase config parse error:", e);
    firebaseConfig = { apiKey: "INVALID_JSON", authDomain: "", projectId: "" };
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'gulf-career-gateway-v2';

let app;
let auth;
let db;

if (firebaseConfig.apiKey === "FALLBACK_API_KEY" || firebaseConfig.apiKey === "INVALID_JSON") {
    console.error("Firebase Config nahi mila! App nahi chalega.");
} else {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
}

// Global fallback WhatsApp number (will be overridden by settings if present)
const WHATSAPP_NUMBER = "971501234567";
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || "";

// Cloudinary config (set to your values)
const CLOUDINARY_CLOUD = 'ddisi6e7m';
const CLOUDINARY_PRESET = 'GULFCAREER';

/**
 * =========================================================================
 * === COMPONENT DEFINITIONS (Must be before App() function) ================
 * =========================================================================
 */

/**
 * === Admin Panel Component ===
 */
const AdminPanel = ({ user }) => {
    // Job Creation/Edit Form States
    const [jobId, setJobId] = useState(null);
    const [jobTitle, setJobTitle] = useState("");
    const [jobCompany, setJobCompany] = useState("");
    const [jobDescription, setJobDescription] = useState("");
    const [jobWhatsapp, setJobWhatsapp] = useState("");
    const [jobImageUrl, setJobImageUrl] = useState(""); // existing image url for edit

    const [jobs, setJobs] = useState([]);

    // Settings (site-wide contact)
    const [siteWhatsapp, setSiteWhatsapp] = useState("");
    const [siteContactEmail, setSiteContactEmail] = useState("");
    const [settingsLoaded, setSettingsLoaded] = useState(false);

    // Other States
    const [imageFile, setImageFile] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [loadingJobs, setLoadingJobs] = useState(true);
    const [savingSettings, setSavingSettings] = useState(false);

    const fileInputRef = useRef(null);
    const jobsCollectionPath = `/artifacts/${appId}/public/data/jobs`;
    const settingsDocRef = doc(db, `/artifacts/${appId}/public/data/settings`, "site");

    // --- Load Jobs ---
    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, jobsCollectionPath));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const jobsData = [];
            querySnapshot.forEach((docSnap) => {
                jobsData.push({ id: docSnap.id, ...docSnap.data() });
            });
            jobsData.sort((a, b) => (b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0)) - (a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0)));
            setJobs(jobsData);
            setLoadingJobs(false);
        }, (error) => {
            console.error("Admin Jobs fetch karne mein error:", error);
            setLoadingJobs(false);
        });

        return () => unsubscribe();
    }, []);

    // --- Load Site Settings (default contact) ---
    useEffect(() => {
        if (!db) return;
        let mounted = true;
        const loadSettings = async () => {
            try {
                const snap = await getDoc(settingsDocRef);
                if (snap.exists() && mounted) {
                    const data = snap.data();
                    setSiteWhatsapp(data.whatsapp_number || "");
                    setSiteContactEmail(data.contact_email || "");
                }
            } catch (err) {
                console.error("Settings load error:", err);
            } finally {
                if (mounted) setSettingsLoaded(true);
            }
        };
        loadSettings();
        return () => { mounted = false; };
    }, []);

    // --- AI Scan Logic (keeps same behavior: fills fields) ---
    const toBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });

    const scanImageWithAI = async () => {
        if (!imageFile) {
            setScanError("Pehle ek image select karein.");
            return;
        }

        setIsScanning(true);
        setScanError(null);
        setJobTitle("");
        setJobCompany("");
        setJobDescription("");
        // Do not clear jobWhatsapp or jobImageUrl so admin can keep them

        try {
            const base64ImageData = await toBase64(imageFile);
            const apiKey = GEMINI_API_KEY;

            if (!apiKey) {
                setScanError("Gemini API Key nahi mili. .env file check karein.");
                setIsScanning(false);
                return;
            }

            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

            const systemPrompt = "Aap ek expert data extractor hain. Is image se job vacancy ki details nikaalein. Sirf JSON format mein response dein.";
            const userQuery = "Is job vacancy ki image se 'title', 'company', aur 'description' extract karo. Agar koi detail na mile, toh use 'N/A' set kar dena. Description mein sabhi requirements, salary, aur location shaamil karna.";

            const imagePart = {
                inlineData: {
                    data: base64ImageData,
                    mimeType: imageFile.type,
                },
            };

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
                            imagePart
                        ]
                    }
                ],
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: jsonSchema
                },
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
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
                throw new Error(`[${response.status}] ${errorBody?.error?.message || 'Unknown API error'}`);
            }

            const result = await response.json();
            const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
            const cleanedJsonText = jsonText ? jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '') : null;

            if (cleanedJsonText) {
                const parsedJson = JSON.parse(cleanedJsonText);
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

    // --- Normalize helper for WhatsApp ---
    const normalizeWhatsapp = (raw) => {
        if (!raw) return "";
        const digits = raw.replace(/\D/g, '');
        return digits;
    };

    // --- Create/Edit/Save Logic (with Cloudinary image upload) ---
    const handleJobUpload = async (e) => {
        e.preventDefault();
        if (!jobTitle) {
            alert("Job title zaroori hai.");
            return;
        }

        setIsUploading(true);
        try {
            const normalizedWhatsapp = normalizeWhatsapp(jobWhatsapp);

            // If editing, keep the same doc ref; else create new doc
            let imageUrlToSave = jobImageUrl || "";

            // If an image file is selected, upload it to Cloudinary and overwrite image_url
            if (imageFile) {
                try {
                    // Use Cloudinary unsigned upload
                    imageUrlToSave = await uploadToCloudinary(imageFile, CLOUDINARY_CLOUD, CLOUDINARY_PRESET);
                } catch (uploadErr) {
                    console.error("Cloudinary upload failed:", uploadErr);
                    alert("Image upload mein error hua. Job save nahi hua.");
                    setIsUploading(false);
                    return;
                }
            }

            const jobData = {
                title: jobTitle,
                company: jobCompany,
                description: jobDescription,
                whatsapp_number: normalizedWhatsapp,
                image_url: imageUrlToSave || "",
                updatedAt: new Date()
            };

            if (jobId) {
                // Update existing
                await setDoc(doc(db, jobsCollectionPath, jobId), jobData, { merge: true });
                alert("Job safaltapoorvak Edit ho gayi!");
            } else {
                // Create new job
                await addDoc(collection(db, jobsCollectionPath), {
                    ...jobData,
                    createdAt: new Date()
                });
                alert("Nayi job safaltapoorvak add ho gayi!");
            }

            // Reset form
            setJobId(null);
            setJobTitle("");
            setJobCompany("");
            setJobDescription("");
            setJobWhatsapp("");
            setJobImageUrl("");
            setImageFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";

        } catch (error) {
            console.error("Job Upload Error:", error);
            alert("Job upload/edit karne mein error hua.");
        } finally {
            setIsUploading(false);
        }
    };

    // --- Edit existing job: populate fields including image_url ---
    const handleEdit = (job) => {
        setJobId(job.id);
        setJobTitle(job.title);
        setJobCompany(job.company);
        setJobDescription(job.description);
        setJobWhatsapp(job.whatsapp_number || "");
        setJobImageUrl(job.image_url || "");
        setScanError(null);
        // clear file input selection (imageFile should be null until user chooses a new file)
        setImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // --- Delete job ---
    const handleDelete = async (id, title) => {
        if (!window.confirm(`Kya aap sach mein '${title}' job ko delete karna chahte hain?`)) {
            return;
        }
        try {
            await deleteDoc(doc(db, jobsCollectionPath, id));
            alert(`Job '${title}' delete ho gayi.`);
        } catch (error) {
            console.error("Delete Error:", error);
            alert("Job delete karne mein error hua.");
        }
    };

    // --- Save Site Settings ---
    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setSavingSettings(true);
        try {
            const normalized = normalizeWhatsapp(siteWhatsapp);
            await setDoc(settingsDocRef, {
                whatsapp_number: normalized,
                contact_email: siteContactEmail,
                updatedAt: new Date()
            }, { merge: true });
            alert("Settings save ho gaye.");
        } catch (err) {
            console.error("Settings save error:", err);
            alert("Settings save karne mein error hua.");
        } finally {
            setSavingSettings(false);
        }
    };

    // --- Reset job form ---
    const handleReset = () => {
        setJobId(null);
        setJobTitle("");
        setJobCompany("");
        setJobDescription("");
        setJobWhatsapp("");
        setJobImageUrl("");
        setScanError(null);
        setImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div className="p-6 bg-gray-100 min-h-screen">
            <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md mb-8">
                <h2 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-3">{jobId ? `Job Edit Karein: ${jobTitle}` : "Nayi Job Post Karein"}</h2>

                {/* Reset Button */}
                {jobId && (
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 mb-4 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition duration-300"
                    >
                        + Nayi Job Shuru Karein
                    </button>
                )}

                {/* Section: Image (AI Scan) */}
                <div className="flex space-x-4 mb-6 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Vacancy Image (AI Scan / Upload)</label>
                        <input
                            type="file"
                            accept="image/png, image/jpeg, image/webp"
                            ref={fileInputRef}
                            onChange={(e) => {
                                const f = e.target.files[0];
                                setImageFile(f || null);
                            }}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        {jobImageUrl && !imageFile && (
                            <p className="text-xs text-gray-500 mt-2">Existing image attached: <a href={jobImageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a></p>
                        )}
                    </div>
                    <div className="flex flex-col space-y-2">
                        <button
                            onClick={scanImageWithAI}
                            disabled={isScanning || !imageFile}
                            className={`px-6 py-2 h-10 font-semibold rounded-lg text-white ${isScanning ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"} transition duration-300 disabled:opacity-50`}
                        >
                            {isScanning ? "Scanning..." : "AI Scan"}
                        </button>
                        <div className="text-right">
                            <p className="text-xs text-gray-500">Tip: AI scan will extract text but image will be uploaded only on Save.</p>
                        </div>
                    </div>
                </div>
                {scanError && <p className="text-red-500 text-sm mb-4">{scanError}</p>}

                {/* Job Form */}
                <form onSubmit={handleJobUpload}>
                    <div className="mb-4">
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700">Job Title</label>
                        <input type="text" id="title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="company" className="block text-sm font-medium text-gray-700">Company</label>
                        <input type="text" id="company" value={jobCompany} onChange={(e) => setJobCompany(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700">WhatsApp Number (for this vacancy)</label>
                        <input
                            type="text"
                            id="whatsapp"
                            value={jobWhatsapp}
                            onChange={(e) => setJobWhatsapp(e.target.value)}
                            placeholder="e.g. 971501234567 (include country code, no +)"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Optional. If left empty, site-wide default number will be used.</p>
                    </div>
                    <div className="mb-6">
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                        <textarea id="description" rows="6" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" required />
                    </div>

                    {/* Submit Button */}
                    <button type="submit" disabled={isUploading || !jobTitle}
                        className={`w-full px-4 py-3 font-bold rounded-lg text-white ${isUploading ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"} transition duration-300 disabled:opacity-50`}>
                        {isUploading ? (jobId ? "Updating..." : "Uploading...") : (jobId ? "Job Update Karein" : "Job Ko Database Mein Save Karein")}
                    </button>
                </form>
            </div>

            {/* Settings Panel - Enhanced */}
            <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md mb-8">
                <h3 className="text-2xl font-bold mb-4 text-gray-800">📋 Site Contact & Business Settings</h3>
                <form onSubmit={handleSaveSettings}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="mb-4">
                            <label htmlFor="siteWhatsapp" className="block text-sm font-medium text-gray-700">📱 Default WhatsApp Number</label>
                            <input type="text" id="siteWhatsapp" value={siteWhatsapp} onChange={(e) => setSiteWhatsapp(e.target.value)}
                                placeholder="e.g. 971501234567"
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            <p className="text-xs text-gray-500 mt-1">Country code ke saath, + ke bina</p>
                        </div>
                        <div className="mb-4">
                            <label htmlFor="siteEmail" className="block text-sm font-medium text-gray-700">📧 Contact Email</label>
                            <input type="email" id="siteEmail" value={siteContactEmail} onChange={(e) => setSiteContactEmail(e.target.value)}
                                placeholder="contact@example.com"
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                        </div>
                    </div>
                    <button type="submit" disabled={savingSettings}
                        className={`px-6 py-3 font-semibold rounded-lg text-white ${savingSettings ? "bg-gray-400" : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"} transition duration-300 disabled:opacity-50`}>
                        {savingSettings ? "Saving..." : "💾 Save Settings"}
                    </button>
                </form>
                {!settingsLoaded && <p className="text-xs text-gray-500 mt-2">Loading settings...</p>}
            </div>

            {/* Job Management List */}
            <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md">
                <h3 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-2">Current Job Vacancies ({jobs.length})</h3>

                {loadingJobs && <p className="text-center text-gray-600">Job list load ho rahi hai...</p>}

                <div className="space-y-4">
                    {jobs.map((job) => (
                        <div key={job.id} className="p-4 border rounded-lg flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition duration-150">
                            <div className="flex-1 pr-4">
                                <p className="font-semibold text-lg text-gray-800">{job.title} ({job.company})</p>
                                <p className="text-xs text-gray-500">Post Date: {job.createdAt ? new Date(job.createdAt.toDate()).toLocaleDateString() : 'N/A'}</p>
                                <p className="text-xs text-gray-500 mt-1">WhatsApp: {job.whatsapp_number ? job.whatsapp_number : `Default (${siteWhatsapp || WHATSAPP_NUMBER})`}</p>
                                {job.image_url && (
                                    <p className="text-xs text-gray-500 mt-1">Image: <a href={job.image_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a></p>
                                )}
                            </div>
                            <div className="flex space-x-2">
                                <button onClick={() => handleEdit(job)}
                                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-300">
                                    Edit
                                </button>
                                <button onClick={() => handleDelete(job.id, job.title)}
                                    className="px-3 py-1 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition duration-300">
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

/**
 * === Static Content Page Component ===
 */
const StaticContentPage = ({ title, content }) => (
    <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-lg">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-6 border-b pb-3">{title}</h1>
            <div className="text-gray-700 space-y-4 whitespace-pre-wrap">
                {content}
            </div>
        </div>
    </div>
);

/**
 * === Public Job List Component ===
 */
const PublicJobList = ({ setPage, onViewDetails }) => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [siteSettings, setSiteSettings] = useState({ whatsapp_number: "", contact_email: "" });
    const settingsDocRef = doc(db, `/artifacts/${appId}/public/data/settings`, "site");

    useEffect(() => {
        if (!db) return;
        const jobsCollectionPath = `/artifacts/${appId}/public/data/jobs`;
        const q = query(collection(db, jobsCollectionPath));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const jobsData = [];
            querySnapshot.forEach((docSnap) => {
                jobsData.push({ id: docSnap.id, ...docSnap.data() });
            });

            jobsData.sort((a, b) => {
                const dateA = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                const dateB = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                return dateB - dateA;
            });
            setJobs(jobsData);
            setLoading(false);
        }, (error) => {
            console.error("Jobs fetch karne mein error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Load site settings for default contact
    useEffect(() => {
        if (!db) return;
        let mounted = true;
        const loadSettings = async () => {
            try {
                const snap = await getDoc(settingsDocRef);
                if (snap.exists() && mounted) {
                    setSiteSettings(snap.data() || {});
                }
            } catch (err) {
                console.error("Public settings load error:", err);
            }
        };
        loadSettings();
        return () => { mounted = false; };
    }, []);

    return (
        <div className="min-h-screen bg-slate-950">
            {/* Hero Section */}
            <HeroSection jobCount={jobs.length} />

            {/* Jobs Section */}
            <section id="jobs" className="py-20 bg-slate-900">
                <div className="container mx-auto px-6">
                    {/* Section Header */}
                    <div className="text-center mb-12">
                        <span className="inline-block px-4 py-2 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium mb-4">
                            💼 Latest Opportunities
                        </span>
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Current Job Openings
                        </h2>
                        <p className="text-slate-400 max-w-2xl mx-auto">
                            Browse through our verified job vacancies in Gulf countries.
                            Apply directly via WhatsApp for quick response.
                        </p>
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div className="flex justify-center items-center py-20">
                            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}

                    {/* No Jobs */}
                    {!loading && jobs.length === 0 && (
                        <div className="text-center py-20 bg-slate-800/50 rounded-2xl border border-slate-700">
                            <span className="text-6xl mb-4 block">📭</span>
                            <h3 className="text-xl font-semibold text-white mb-2">No Vacancies Available</h3>
                            <p className="text-slate-400">Check back soon for new opportunities!</p>
                        </div>
                    )}

                    {/* Job Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {jobs.map((job, index) => (
                            <div key={job.id} style={{ animation: `fadeInUp 0.5s ease ${index * 0.1}s backwards` }}>
                                <JobCard
                                    job={job}
                                    siteWhatsapp={siteSettings.whatsapp_number}
                                    defaultNumber={WHATSAPP_NUMBER}
                                    onViewDetails={onViewDetails}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Why Choose Us Section */}
            <section className="py-20 bg-slate-950">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-white mb-4">Why Choose Us?</h2>
                        <p className="text-slate-400">Trusted by thousands of job seekers</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { icon: '✅', title: 'Verified Jobs', desc: 'All vacancies are verified by our team' },
                            { icon: '🛡️', title: 'Govt Approved', desc: 'Legal and government approved process' },
                            { icon: '💬', title: '24/7 Support', desc: 'Round the clock WhatsApp support' }
                        ].map((item, i) => (
                            <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 text-center hover:border-blue-500/50 transition-colors">
                                <span className="text-4xl mb-4 block">{item.icon}</span>
                                <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
                                <p className="text-slate-400">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};

/**
 * === Job Detail Page Component ===
 */
const JobDetailPage = ({ job, onBack, siteWhatsapp, defaultNumber }) => {
    if (!job) return null;

    const handleApply = () => {
        const number = (job.whatsapp_number || siteWhatsapp || defaultNumber || '971501234567').replace(/\D/g, '');
        const message = encodeURIComponent(`Hello, I am interested in the position of ${job.title} at ${job.company}. Please send me more details.`);
        window.open(`https://wa.me/${number}?text=${message}`, '_blank');
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'Recent';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    return (
        <div className="min-h-screen bg-slate-950 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                <button onClick={onBack} className="mb-6 flex items-center gap-2 text-blue-400 hover:text-blue-300">
                    ← Back to All Jobs
                </button>
                <div className="bg-slate-800/50 border border-slate-700 rounded-3xl overflow-hidden">
                    {job.image_url && (
                        <div className="relative h-64 md:h-80">
                            <img src={job.image_url} alt={job.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
                        </div>
                    )}
                    <div className="p-6 md:p-8">
                        <div className="flex flex-wrap gap-2 mb-4">
                            <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded-lg">✓ Verified</span>
                            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-sm rounded-lg">Full Time</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">{job.title}</h1>
                        <div className="flex items-center gap-3 text-slate-300 mb-6 text-lg">
                            <span>🏢</span><span className="font-semibold">{job.company}</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                                <span className="text-2xl block mb-2">📅</span>
                                <span className="text-slate-400 text-sm">Posted</span>
                                <span className="text-white font-medium block">{formatDate(job.createdAt)}</span>
                            </div>
                            <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                                <span className="text-2xl block mb-2">🌍</span>
                                <span className="text-slate-400 text-sm">Location</span>
                                <span className="text-white font-medium block">Gulf</span>
                            </div>
                            <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                                <span className="text-2xl block mb-2">⏰</span>
                                <span className="text-slate-400 text-sm">Type</span>
                                <span className="text-white font-medium block">Full Time</span>
                            </div>
                            <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                                <span className="text-2xl block mb-2">✅</span>
                                <span className="text-slate-400 text-sm">Status</span>
                                <span className="text-green-400 font-medium block">Available</span>
                            </div>
                        </div>
                        <div className="mb-8">
                            <h2 className="text-xl font-bold text-white mb-4">📋 Job Description</h2>
                            <div className="bg-slate-700/30 rounded-xl p-6 text-slate-300 whitespace-pre-wrap leading-relaxed">
                                {job.description}
                            </div>
                        </div>
                        <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-2xl p-6 text-center">
                            <h3 className="text-2xl font-bold text-white mb-2">Interested in this job?</h3>
                            <p className="text-slate-300 mb-6">Contact us on WhatsApp to apply!</p>
                            <button onClick={handleApply} className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-lg rounded-2xl hover:scale-105 transition-all">
                                📱 Apply on WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * === Admin Login (Hardcoded Version) ===
 */
const AdminLogin = ({ setPage, setUser }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    // Hardcoded credentials (as requested)
    const ADMIN_EMAIL = "razaaamil7599@gmail.com";
    const ADMIN_PASSWORD = "Aamil@759922";

    const handleLogin = (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Simulate small delay for UX
        setTimeout(() => {
            if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
                // Login successful
                alert("Admin login successful!");
                setUser({ email: ADMIN_EMAIL, isAdmin: true });
                setPage('admin');
            } else {
                setError("Incorrect email or password!");
            }
            setLoading(false);
        }, 600);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-xl">
                <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
                    Admin Login
                </h2>
                <form onSubmit={handleLogin}>
                    <div className="mb-4">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                            Email
                        </label>
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
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                            Password
                        </label>
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
                    Admin user: Use provided credentials only.
                </p>
            </div>
        </div>
    );
};

/**
 * =========================================================================
 * === Main App Component (Routing) ===
 * =========================================================================
 */
export default function App() {
    const [user, setUser] = useState(null);
    const [page, setPage] = useState('public');
    const [authReady, setAuthReady] = useState(false);
    const [selectedJob, setSelectedJob] = useState(null); // For job detail view
    const settingsDocRef = doc(db, `/artifacts/${appId}/public/data/settings`, "site");
    const [siteSettings, setSiteSettings] = useState({ whatsapp_number: "", contact_email: "" });

    useEffect(() => {
        if (!auth || !db) {
            setAuthReady(false);
            return;
        }

        const initAuth = async () => {
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Auth initialization error:", error);
                if (!auth.currentUser) {
                    await signInAnonymously(auth);
                }
            }

            const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
                const isAdmin = currentUser && !currentUser.isAnonymous;

                if (isAdmin) {
                    setUser(currentUser);
                    setPage('admin');
                } else {
                    setUser(null);
                }
                setAuthReady(true);
            });
            return unsubscribe;
        };

        initAuth();
    }, []);

    // load public settings for header/contact display & fallback
    useEffect(() => {
        if (!db) return;
        let mounted = true;
        const loadSettings = async () => {
            try {
                const snap = await getDoc(settingsDocRef);
                if (snap.exists() && mounted) {
                    setSiteSettings(snap.data() || {});
                }
            } catch (err) {
                console.error("App settings load error:", err);
            }
        };
        loadSettings();
        return () => { mounted = false; };
    }, []);

    // Load public jobs for VoiceAgent
    const [publicJobs, setPublicJobs] = useState([]);
    const jobsCollectionPath = `/artifacts/${appId}/public/data/jobs`;

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, jobsCollectionPath));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const jobsData = [];
            querySnapshot.forEach((docSnap) => {
                jobsData.push({ id: docSnap.id, ...docSnap.data() });
            });
            setPublicJobs(jobsData);
        }, (error) => {
            console.error("Public jobs fetch error:", error);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            const isAdmin = user && user.isAdmin;

            if (hash === '#admin' && isAdmin) {
                setPage('admin');
            } else if (hash === '#admin' && !isAdmin) {
                setPage('admin-login');
            } else if (hash === '#about' || hash === '#contact' || hash === '#privacy' || hash === '#terms') {
                setPage(hash.substring(1)); // 'about', 'contact', etc.
            } else {
                setPage('public');
                if (hash) {
                    window.location.hash = '';
                }
            }
        };

        window.addEventListener('hashchange', handleHashChange);
        handleHashChange(); // Initial check
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [authReady, user]); // user par depend karein


    const handleLogout = async () => {
        if (auth) {
            await signOut(auth);
        }
        setUser(null);
        setPage('public');
        window.location.hash = '';
    };

    // Static Pages Content (uses siteSettings for contact)
    const contentData = {
        'about': {
            title: "🌟 About Gulf Career Gateway",
            content: `Gulf Career Gateway ek premium AI-powered job portal hai jo specifically Gulf countries (Saudi Arabia, UAE, Qatar, Kuwait, Bahrain, Oman) mein job seekers ko verified job opportunities provide karta hai.

🎯 HAMARA MISSION
Job seekers ko reliable aur verified Gulf job opportunities provide karna - bilkul transparent aur trustworthy process ke saath.

🚀 KYA HAI HUMARI SPECIALTY?

✅ AI-Powered Job Posting
Hum latest Gemini AI technology use karte hain jo job advertisements se automatically information extract karta hai - faster aur error-free.

✅ Verified Employers
Har job listing carefully verify hoti hai genuine employers se.

✅ Complete Support
Document preparation se lekar visa approval tak - hum har step mein aapke saath hain.

✅ Transparent Process
Koi hidden charges nahi, koi fake promises nahi - sirf genuine opportunities.

📊 HAMARE STATISTICS
• 500+ Successful Placements
• 50+ Active Job Vacancies
• 15+ Gulf Countries Coverage
• 24/7 Customer Support

🏢 HAMARE SERVICES

1️⃣ Job Matching - Aapki skills ke according perfect job
2️⃣ Document Assistance - Passport, Medical, MOFA, Visa
3️⃣ Interview Preparation - Tips aur guidance
4️⃣ Travel Arrangement - Ticket aur accommodation help
5️⃣ Post-Arrival Support - Gulf mein settle hone mein madad

📞 CONTACT KAISE KAREIN?
WhatsApp: +${siteSettings.whatsapp_number || WHATSAPP_NUMBER}
Email: ${siteSettings.contact_email || 'contact@gulfcareergateway.com'}

Hum aapki Gulf career journey ko successful banana chahte hain! 🌅`
        },
        'contact': {
            title: "📞 Contact Us",
            content: `Gulf Career Gateway ki team aapki madad ke liye 24/7 available hai!

📱 WHATSAPP (PREFERRED)
+${siteSettings.whatsapp_number || WHATSAPP_NUMBER}
Fast response - usually within 30 minutes!

📧 EMAIL
${siteSettings.contact_email || 'contact@gulfcareergateway.com'}
Business inquiries aur detailed queries ke liye

⏰ WORKING HOURS
Monday - Saturday: 9:00 AM - 9:00 PM (IST)
Sunday: 10:00 AM - 6:00 PM (IST)

🌍 SERVICE AREAS
• Saudi Arabia (KSA)
• United Arab Emirates (UAE)
• Qatar
• Kuwait
• Bahrain
• Oman

💬 QUICK QUERIES

Job Vacancies ke liye:
WhatsApp karein "JOB" likh ke

Visa Process ke liye:
WhatsApp karein "VISA" likh ke

Document Help ke liye:
WhatsApp karein "DOCUMENT" likh ke

🤝 PARTNERSHIPS & BUSINESS
Agar aap employer hain aur workers recruit karna chahte hain,
ya aap agent hain aur partnership mein interested hain:
Email: ${siteSettings.contact_email || 'contact@gulfcareergateway.com'}

Subject: "Business Partnership Inquiry"

Hum jaldi se jaldi aapse contact karenge! 🚀`
        },
        'privacy': {
            title: "🔒 Privacy Policy",
            content:
                `Last Updated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}

Gulf Career Gateway ("Company", "we", "us", "our") aapki privacy ko seriously leta hai. Yeh Privacy Policy explain karti hai ki hum aapka personal data kaise collect, use, aur protect karte hain.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 SECTION 1: INFORMATION WE COLLECT

1.1 Personal Information (Aap provide karte hain):
• Full Name aur Contact Details
• Phone Number / WhatsApp Number
• Email Address
• Passport Details (job application ke liye)
• Educational Qualifications
• Work Experience
• Photographs

1.2 Automatically Collected Information:
• IP Address aur Browser Type
• Device Information
• Website Usage Analytics
• Cookies aur Similar Technologies

1.3 Third-Party Information:
• WhatsApp messaging data (WhatsApp ke terms ke under)
• Job referrals aur recommendations

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 SECTION 2: HOW WE USE YOUR DATA

2.1 Primary Uses:
• Job matching aur recommendations
• Application processing
• Employer ko profile sharing
• Communication aur updates

2.2 Secondary Uses:
• Service improvement
• Analytics aur reporting
• Legal compliance
• Fraud prevention

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔐 SECTION 3: DATA SECURITY

3.1 Technical Measures:
• SSL/TLS Encryption
• Secure Firebase Cloud Storage
• Regular Security Audits
• Access Controls

3.2 Organizational Measures:
• Limited staff access
• Confidentiality agreements
• Regular training

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 SECTION 4: AI & TECHNOLOGY

4.1 Gemini AI Usage:
• Job advertisement text extraction
• No personal data processing unnecessarily
• Data minimization principles

4.2 Third-Party Services:
• Google Cloud (AI Processing)
• Firebase (Data Storage)
• Cloudinary (Image Hosting)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 SECTION 5: YOUR RIGHTS

Aap hamesha:
✅ Apna data access kar sakte hain
✅ Corrections request kar sakte hain
✅ Deletion request kar sakte hain
✅ Processing restrict kar sakte hain
✅ Consent withdraw kar sakte hain

Request ke liye contact karein:
📧 ${siteSettings.contact_email || 'contact@gulfcareergateway.com'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🍪 SECTION 6: COOKIES

Hum minimal cookies use karte hain:
• Essential cookies (site functionality)
• Analytics cookies (optional)

Browser settings se cookies manage kar sakte hain.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👶 SECTION 7: CHILDREN'S PRIVACY

Yeh service 18 saal se upar ke logon ke liye hai.
Hum knowingly minors ka data collect nahi karte.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 SECTION 8: POLICY UPDATES

Yeh policy kabhi bhi update ho sakti hai.
Major changes ke baare mein hum notify karenge.
Regular check karte rahein.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📞 CONTACT FOR PRIVACY CONCERNS

Gulf Career Gateway
Email: ${siteSettings.contact_email || 'contact@gulfcareergateway.com'}
WhatsApp: +${siteSettings.whatsapp_number || WHATSAPP_NUMBER}

Aapki privacy hamari priority hai! 🛡️`
        },
        'terms': {
            title: "📜 Terms of Service",
            content:
                `Effective Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}

Gulf Career Gateway ke Terms of Service padhne ke liye shukriya. Website use karne se pehle in terms ko carefully padhein.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ SECTION 1: ACCEPTANCE OF TERMS

1.1 Is website ko access ya use karke aap in Terms aur Privacy Policy ko accept karte hain.

1.2 Agar aap agree nahi karte, toh website use na karein.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 SECTION 2: SERVICE DESCRIPTION

2.1 Gulf Career Gateway provide karta hai:
• Gulf countries mein job listings
• AI-powered job matching
• Employer connections
• Visa assistance information

2.2 Hum intermediary hain - final employment decision employer ki hoti hai.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 SECTION 3: USER RESPONSIBILITIES

Aap agree karte hain ki:

✅ Accurate information provide karenge
✅ Fake documents nahi denge
✅ Site ko misuse nahi karenge
✅ Others ko harm nahi karenge
✅ Illegal activities mein engage nahi honge

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔐 SECTION 4: ADMIN ACCESS

4.1 Admin panel sirf authorized personnel ke liye hai.

4.2 Unauthorized access attempt criminal offense hai.

4.3 Admin credentials share karna strictly prohibited hai.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ SECTION 5: DISCLAIMERS

5.1 Job Listings:
• Accuracy ke liye best efforts karte hain
• 100% guarantee nahi de sakte
• Final verification user ki responsibility

5.2 Third Parties:
• External links ki responsibility nahi
• Employer actions ke liye liable nahi

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 SECTION 6: FEES & PAYMENTS

6.1 Website browsing free hai.

6.2 Service charges jo bhi hon, clearly disclose honge.

6.3 Fraud se bachein - sirf official channels use karein.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚫 SECTION 7: LIMITATION OF LIABILITY

Maximum extent permitted by law:

• Hum direct, indirect, incidental damages ke liye liable nahi
• Service disruptions ke liye liable nahi
• Third-party actions ke liye liable nahi

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚖️ SECTION 8: GOVERNING LAW

8.1 Yeh Terms Indian laws ke under governed hain.

8.2 Disputes Indian courts mein resolve honge.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 SECTION 9: MODIFICATIONS

9.1 Terms kabhi bhi modify ho sakte hain.

9.2 Continued use = acceptance of new terms.

9.3 Major changes ke notifications denge.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📞 CONTACT

Questions ke liye:
Email: ${siteSettings.contact_email || 'contact@gulfcareergateway.com'}
WhatsApp: +${siteSettings.whatsapp_number || WHATSAPP_NUMBER}

Gulf Career Gateway - Your Trusted Gulf Job Partner! 🌅`
        }
    };


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

    if (!authReady) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-xl text-gray-600">Loading Gulf Career Gateway...</p>
            </div>
        );
    }

    // Router
    let PageComponent;
    const currentPage = page;

    if (currentPage === 'admin') {
        return (
            <div>
                <nav className="bg-gray-800 text-white p-4 flex justify-between items-center shadow-md">
                    <h1 className="text-xl font-bold">Admin Panel</h1>
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => { setPage('public'); }}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-sm font-semibold transition duration-300"
                        >
                            Public
                        </button>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition duration-300"
                        >
                            Logout
                        </button>
                    </div>
                </nav>
                <AdminPanel user={user} />
            </div>
        );
    } else if (currentPage === 'admin-login') {
        PageComponent = <AdminLogin setPage={setPage} setUser={setUser} />;
    } else if (contentData[currentPage]) {
        PageComponent = <StaticContentPage title={contentData[currentPage].title} content={contentData[currentPage].content} />;
    } else if (selectedJob) {
        // Show job detail page
        PageComponent = <JobDetailPage
            job={selectedJob}
            onBack={() => setSelectedJob(null)}
            siteWhatsapp={siteSettings.whatsapp_number}
            defaultNumber={WHATSAPP_NUMBER}
        />;
    } else {
        PageComponent = <PublicJobList setPage={setPage} onViewDetails={(job) => setSelectedJob(job)} />;
    }

    // Public Layout
    return (
        <div className="min-h-screen flex flex-col bg-slate-950">
            {/* Premium Navbar */}
            <Navbar setPage={setPage} user={user} onLogout={handleLogout} />

            {/* Main Content */}
            <main className="flex-grow">
                {PageComponent}
            </main>

            {/* AI Voice Agent - Auto greets users */}
            <VoiceAgent siteWhatsapp={siteSettings.whatsapp_number || WHATSAPP_NUMBER} jobs={publicJobs} />

            {/* Premium Footer */}
            <Footer siteSettings={siteSettings} />
        </div>
    );
}
