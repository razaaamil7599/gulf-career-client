/* global __firebase_config, __app_id, __initial_auth_token */

/**
* Gulf Career Gateway - App.js (patched to use Cloudinary unsigned upload)
*
* Changes:
* - (FIXED) PublicJobList <img> height increased from h-32 to h-48 for bigger image.
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
    deleteDoc,
    getDoc
} from "firebase/firestore";

// Cloudinary upload helper
import { uploadToCloudinary } from './upload-cloudinary';

// Google Generative AI SDK import (kept for AI scan usage)
import { GoogleGenerativeAI } from '@google/generative-ai';

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

            {/* Settings Panel */}
            <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md mb-8">
                <h3 className="text-2xl font-bold mb-4">Site Contact Settings</h3>
                <form onSubmit={handleSaveSettings}>
                    <div className="mb-4">
                        <label htmlFor="siteWhatsapp" className="block text-sm font-medium text-gray-700">Default WhatsApp Number</label>
                        <input type="text" id="siteWhatsapp" value={siteWhatsapp} onChange={(e) => setSiteWhatsapp(e.target.value)}
                            placeholder="e.g. 971501234567 (include country code, no +)"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                        <p className="text-xs text-gray-500 mt-1">Yeh number public site par floating button aur fallback ke liye use hoga.</p>
                    </div>
                    <div className="mb-4">
                        <label htmlFor="siteEmail" className="block text-sm font-medium text-gray-700">Contact Email</label>
                        <input type="email" id="siteEmail" value={siteContactEmail} onChange={(e) => setSiteContactEmail(e.target.value)}
                            placeholder="contact@example.com"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <button type="submit" disabled={savingSettings}
                        className={`px-4 py-2 font-semibold rounded-lg text-white ${savingSettings ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"} transition duration-300 disabled:opacity-50`}>
                        {savingSettings ? "Saving..." : "Save Settings"}
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
            <div className="text-gray-700 space-y-4">
                {content.split('\n').map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                ))}
            </div>
        </div>
    </div>
);

/**
* === Public Job List Component ===
*/
const PublicJobList = ({ setPage }) => {
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

    const normalizeForWa = (raw) => {
        if (!raw) return "";
        return raw.replace(/\D/g, '');
    };

    const handleApply = (jobTitle, jobWhatsapp) => {
        const number = normalizeForWa(jobWhatsapp) || normalizeForWa(siteSettings.whatsapp_number) || WHATSAPP_NUMBER;
        const message = encodeURIComponent(`Hello, I am interested in the position of ${jobTitle} that I saw on your job portal. Please send me more details.`);
        window.open(`https://wa.me/${number}?text=${message}`, '_blank');
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-extrabold text-center mb-8 text-gray-900">Current Openings</h1>

                {loading && <p className="text-center text-gray-600">Loading jobs...</p>}

                {!loading && jobs.length === 0 && (
                    <p className="text-center text-gray-600 border p-8 mt-10 bg-white rounded-lg shadow">Abhi koi job available nahi hai. Admin panel se nayi job daaliye.</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {jobs.map((job) => (
                        <div key={job.id} className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-300 flex flex-col justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-blue-700 mb-2">{job.title}</h2>
                                <h3 className="text-md font-semibold text-gray-700 mb-3">{job.company}</h3>

                                {/* --- BADLAAV: Yahaan Image Dikhayega --- */}
                                {job.image_url && (
                                    <img
                                        src={job.image_url}
                                        alt={job.title}
                                        /* BADLAAV: 'h-32' ko 'h-48' kar diya hai */
                                        className="w-full h-48 object-contain rounded-md my-3"
                                    />
                                )}
                                {/* --- BADLAAV KHATAM --- */}

                                <p className="text-gray-600 text-sm whitespace-pre-wrap line-clamp-4">{job.description}</p>

                            </div>
                            <button
                                onClick={() => handleApply(job.title, job.whatsapp_number)}
                                className="mt-4 w-full bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600 transition duration-300 flex items-center justify-center text-sm"
                            >
                                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M12.039 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-2.039 17.519c-.328 0-.64-.176-.807-.478l-1.397-2.736c-.198-.39.027-.852.455-.916l2.365-.352c.319-.047.632.086.814.336l.542.748c.182.25.44.382.72.382h.001c.291 0 .564-.139.75-.38l2.67-3.486c.216-.282.25-.662.089-.974l-1.02-1.928c-.143-.271-.43-.443-.74-.443h-.001c-.347 0-.66.191-.825.503l-1.144 2.226c-.167.324-.492.532-.843.532h-.001c-.352 0-.678-.208-.845-.532l-.99-1.944c-.266-.523-.082-1.157.433-1.423l4.314-2.22c.241-.124.512-.13.753-.012l3.79 1.761c.287.133.488.423.518.749l.66 4.757c.05.353-.11.71-.397.904l-5.11 3.55c-.297.206-.694.206-.991 0z" /></svg>
                                Apply Now (WhatsApp)
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

/**
* === Admin Login Component ===
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
        } catch (error) {
            console.error("Login Error:", error);
            setError("Login fail ho gaya. Email ya password ghalat hai.");
        } finally {
            setLoading(false);
        }
    };

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
* =========================================================================
* === Main App Component (Routing) ===
* =========================================================================
*/
export default function App() {
    const [user, setUser] = useState(null);
    const [page, setPage] = useState('public');
    const [authReady, setAuthReady] = useState(false);
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

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            const isAdmin = auth.currentUser && !auth.currentUser.isAnonymous;

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
        setPage('public');
        window.location.hash = '';
    };

    // Static Pages Content (uses siteSettings for contact)
    const contentData = {
        'about': {
            title: "About Gulf Career Gateway",
            content: "Gulf Career Gateway ek naya platform hai jo AI (Gemini) ka istemaal karke Gulf countries mein job vacancies dhoondhta aur publish karta hai. Hamara mission hai ki job seekers ko aasaan aur tez tareeke se job ki jaankari mile, bina kisi mehnat ke. AI Feature: Hamara Admin Panel job ads ki images ko seedha scan karke text nikalta hai, jisse data entry bahut tez ho jaati hai."
        },
        'contact': {
            title: "Contact Us",
            content: `Agar aapke koi sawal ya sujhav hain, toh kripya hamein sampark karein:\n- WhatsApp: +${siteSettings.whatsapp_number || WHATSAPP_NUMBER}\n- Email: ${siteSettings.contact_email || 'contact@gulfcareergateway.com'}\n\nHamari team aapki madad karne ke liye hamesha taiyaar hai.`
        },
        'privacy': {
            title: "Privacy Policy",
            content: "Hamari Privacy Policy bahut saaf hai:\n1. User Data: Hum sirf woh data collect karte hain jo aap hamein bhejte hain (jaise job application ke liye WhatsApp message).\n2. Data Security: Aapka data Firebase Firestore mein surakshit (secure) hai.\n3. AI Use: Hum Gemini AI ka istemaal sirf job vacancy se data extract karne ke liye karte hain. Koi bhi personal information AI ko nahi bheji jaati."
        },
        'terms': {
            title: "Terms of Service",
            content: "1. Content Use: Is website par di gayi sabhi job listings sirf jaankari ke liye hain. Hum job ki zimmedari nahi lete.\n2. User Conduct: Admin panel ka istemaal sirf authorized users hi kar sakte hain. Ghalat data daalne par account block ho sakta hai."
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
    } else if (currentPage === 'admin-login') {
        PageComponent = <AdminLogin setPage={setPage} />;
    } else if (contentData[currentPage]) {
        PageComponent = <StaticContentPage title={contentData[currentPage].title} content={contentData[currentPage].content} />;
    } else {
        PageComponent = <PublicJobList setPage={setPage} />;
    }

    // Public Layout
    return (
        <div className="min-h-screen flex flex-col">
            {/* Header Navigation Bar */}
            <nav className="bg-white text-gray-800 p-4 flex justify-between items-center shadow-md sticky top-0 z-10">
                <a href="#" className="text-2xl font-bold text-blue-700">Gulf Career Gateway</a>
                <div className="flex space-x-4 items-center text-sm font-semibold">
                    <a href="#" className="hover:text-blue-700">Home</a>
                    <a href="#about" className="hover:text-blue-700">About Us</a>
                    <a href="#contact" className="hover:text-blue-700">Contact</a>
                    <a
                        href="#admin"
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition duration-300"
                    >
                        Admin Login
                    </a>
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-grow">
                {PageComponent}
            </main>

            {/* Floating WhatsApp Button (uses saved site settings if present) */}
            <a
                href={`https://wa.me/${(siteSettings.whatsapp_number && siteSettings.whatsapp_number.replace(/\D/g, '')) || WHATSAPP_NUMBER}?text=Hello%2C%20I%20am%20interested%20in%20a%20job%20vacancy%20at%20Gulf%20Career%20Gateway.`}
                target="_blank"
                rel="noopener noreferrer"
                className="fixed bottom-6 right-6 w-14 h-14 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-green-600 transition duration-300 z-50"
                aria-label="Contact us on WhatsApp"
            >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12.039 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-2.039 17.519c-.328 0-.64-.176-.807-.478l-1.397-2.736c-.198-.39.027-.852.455-.916l2.365-.352c.319-.047.632.086.814.336l.542.748c.182.25.44.382.72.382h.001c.291 0 .564-.139.75-.38l2.67-3.486c.216-.282.25-.662.089-.974l-1.02-1.928c-.143-.271-.43-.443-.74-.443h-.001c-.347 0-.66.191-.825.503l-1.144 2.226c-.167.324-.492.532-.843.532h-.001c-.352 0-.678-.208-.845-.532l-.99-1.944c-.266-.523-.082-1.157.433-1.423l4.314-2.22c.241-.124.512-.13.753-.012l3.79 1.761c.287.133.488.423.518.749l.66 4.757c.05.353-.11.71-.397.904l-5.11 3.55c-.297.206-.694.206-.991 0z" /></svg>
            </a>

            {/* Footer */}
            <footer className="bg-gray-800 text-white p-4 text-center text-sm shadow-inner mt-auto">
                <div className="flex justify-center space-x-6 mb-2">
                    <a href="#privacy" className="hover:text-blue-400 transition duration-300">Privacy Policy</a>
                    <a href="#terms" className="hover:text-blue-400 transition duration-300">Terms of Service</a>
                </div>
                <p>&copy; {new Date().getFullYear()} Gulf Career Gateway. All Rights Reserved.</p>
            </footer>
        </div>
    );
}