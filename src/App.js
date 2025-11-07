/* global __firebase_config, __app_id, __initial_auth_token */

/**
 * Gulf Career Gateway - App.js (FULL)
 * - Hardcoded admin login (per user request)
 * - Separate Privacy Policy & Terms pages
 * - Firebase (Firestore) init kept
 * - Cloudinary unsigned upload helper expected at ./upload-cloudinary
 * - Gemini AI scan logic kept (uses GEMINI_API_KEY env var)
 */

import React, { useState, useEffect, useRef } from "react";

// Firebase imports
import { initializeApp } from "firebase/app";
import {
    getAuth,
    signInAnonymously,
    signInWithCustomToken,
    onAuthStateChanged,
    signOut
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

// Cloudinary upload helper (must exist in project)
import { uploadToCloudinary } from "./upload-cloudinary";

// GeminI key from env (if used)
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || "";

// --------- CONFIGURATION ---------
const firebaseConfigJson =
    process.env.REACT_APP_FIREBASE_CONFIG ||
    (typeof __firebase_config !== "undefined" ? __firebase_config : '{"apiKey":"FALLBACK_API_KEY","authDomain":"","projectId":""}');

let firebaseConfig;
try {
    firebaseConfig = JSON.parse(firebaseConfigJson);
} catch (e) {
    console.error("Firebase config parse error:", e);
    firebaseConfig = { apiKey: "INVALID_JSON", authDomain: "", projectId: "" };
}

const appId = typeof __app_id !== "undefined" ? __app_id : "gulf-career-gateway-v2";

let app = null;
let auth = null;
let db = null;

if (firebaseConfig.apiKey !== "FALLBACK_API_KEY" && firebaseConfig.apiKey !== "INVALID_JSON") {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
}

// Cloudinary defaults (adjust if needed)
const CLOUDINARY_CLOUD = "ddisi6e7m";
const CLOUDINARY_PRESET = "GULFCAREER";

// Fallback WhatsApp (if settings not set)
const WHATSAPP_NUMBER = "971501234567";

// ---------------- COMPONENTS ----------------

/** Admin Panel - create/edit jobs, settings */
const AdminPanel = ({ user }) => {
    const [jobId, setJobId] = useState(null);
    const [jobTitle, setJobTitle] = useState("");
    const [jobCompany, setJobCompany] = useState("");
    const [jobDescription, setJobDescription] = useState("");
    const [jobWhatsapp, setJobWhatsapp] = useState("");
    const [jobImageUrl, setJobImageUrl] = useState("");
    const [jobs, setJobs] = useState([]);
    const [imageFile, setImageFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState(null);
    const [siteWhatsapp, setSiteWhatsapp] = useState("");
    const [siteContactEmail, setSiteContactEmail] = useState("");
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const fileInputRef = useRef(null);

    const jobsCollectionPath = `/artifacts/${appId}/public/data/jobs`;
    const settingsDocRef = doc(db, `/artifacts/${appId}/public/data/settings`, "site");

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, jobsCollectionPath));
        const unsubscribe = onSnapshot(q, (qs) => {
            const arr = [];
            qs.forEach(s => arr.push({ id: s.id, ...s.data() }));
            arr.sort((a, b) => (b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0)) - (a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0)));
            setJobs(arr);
        }, (err) => {
            console.error("Jobs snapshot error:", err);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!db) return;
        let mounted = true;
        (async () => {
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
        })();
        return () => { mounted = false; };
    }, []);

    // Helper to convert file -> base64 (for AI)
    const toBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = err => reject(err);
    });

    const scanImageWithAI = async () => {
        if (!imageFile) {
            setScanError("Pehle image select karein.");
            return;
        }
        setIsScanning(true);
        setScanError(null);
        setJobTitle("");
        setJobCompany("");
        setJobDescription("");

        try {
            if (!GEMINI_API_KEY) {
                setScanError("Gemini API key missing. Set REACT_APP_GEMINI_API_KEY.");
                setIsScanning(false);
                return;
            }

            const base64 = await toBase64(imageFile);
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

            const payload = {
                contents: [{
                    role: "user",
                    parts: [
                        { text: "Extract job 'title', 'company', 'description' from this image. Return only JSON." },
                        { inlineData: { data: base64, mimeType: imageFile.type } }
                    ]
                }],
                generationConfig: { responseMimeType: "application/json" },
                systemInstruction: { parts: [{ text: "You are an expert extractor. Return valid JSON." }] }
            };

            const resp = await fetch(apiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            if (!resp.ok) {
                const body = await resp.text();
                throw new Error(`Gemini API error: ${resp.status} ${body}`);
            }
            const json = await resp.json();
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const cleaned = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
            const parsed = JSON.parse(cleaned);
            setJobTitle(parsed.title || "N/A");
            setJobCompany(parsed.company || "N/A");
            setJobDescription(parsed.description || "N/A");
        } catch (err) {
            console.error("AI scan error:", err);
            setScanError("AI scan error: " + (err.message || err));
        } finally {
            setIsScanning(false);
        }
    };

    const normalizeWhatsapp = (raw) => raw ? raw.replace(/\D/g, "") : "";

    const handleJobUpload = async (e) => {
        e.preventDefault();
        if (!jobTitle) { alert("Job title required."); return; }
        setIsUploading(true);
        try {
            let imageUrlToSave = jobImageUrl || "";
            if (imageFile) {
                try {
                    imageUrlToSave = await uploadToCloudinary(imageFile, CLOUDINARY_CLOUD, CLOUDINARY_PRESET);
                } catch (upErr) {
                    console.error("Cloudinary upload failed:", upErr);
                    alert("Image upload failed.");
                    setIsUploading(false);
                    return;
                }
            }

            const jobData = {
                title: jobTitle,
                company: jobCompany,
                description: jobDescription,
                whatsapp_number: normalizeWhatsapp(jobWhatsapp),
                image_url: imageUrlToSave || "",
                updatedAt: new Date()
            };

            if (jobId) {
                await setDoc(doc(db, jobsCollectionPath, jobId), jobData, { merge: true });
                alert("Job updated.");
            } else {
                await addDoc(collection(db, jobsCollectionPath), { ...jobData, createdAt: new Date() });
                alert("Job added.");
            }

            // reset fields
            setJobId(null);
            setJobTitle("");
            setJobCompany("");
            setJobDescription("");
            setJobWhatsapp("");
            setJobImageUrl("");
            setImageFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (err) {
            console.error("Job save error:", err);
            alert("Error saving job: " + (err.message || err));
        } finally {
            setIsUploading(false);
        }
    };

    const handleEdit = (job) => {
        setJobId(job.id);
        setJobTitle(job.title);
        setJobCompany(job.company);
        setJobDescription(job.description);
        setJobWhatsapp(job.whatsapp_number || "");
        setJobImageUrl(job.image_url || "");
        setScanError(null);
        setImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleDelete = async (id, title) => {
        if (!window.confirm(`Kya aap '${title}' delete karna chahte hain?`)) return;
        try {
            await deleteDoc(doc(db, jobsCollectionPath, id));
            alert("Job deleted.");
        } catch (err) {
            console.error("Delete error:", err);
            alert("Error deleting job.");
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        try {
            await setDoc(settingsDocRef, { whatsapp_number: normalizeWhatsapp(siteWhatsapp), contact_email: siteContactEmail, updatedAt: new Date() }, { merge: true });
            alert("Settings saved.");
        } catch (err) {
            console.error("Settings save error:", err);
            alert("Error saving settings.");
        }
    };

    return (
        <div className="p-6 bg-gray-100 min-h-screen">
            <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md mb-8">
                <h2 className="text-3xl font-bold mb-6">{jobId ? `Edit Job: ${jobTitle}` : "Add New Job"}</h2>

                {/* Image + AI scan */}
                <div className="flex space-x-4 mb-6 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Vacancy Image (AI Scan / Upload)</label>
                        <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            ref={fileInputRef}
                            onChange={(e) => setImageFile(e.target.files[0] || null)}
                            className="block w-full text-sm text-gray-500"
                        />
                        {jobImageUrl && !imageFile && <p className="text-xs text-gray-500 mt-2">Existing image attached: <a href={jobImageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a></p>}
                    </div>
                    <div className="flex flex-col space-y-2">
                        <button onClick={scanImageWithAI} disabled={isScanning || !imageFile} className={`px-6 py-2 h-10 font-semibold rounded-lg text-white ${isScanning ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}>
                            {isScanning ? "Scanning..." : "AI Scan"}
                        </button>
                        <p className="text-xs text-gray-500">Tip: AI extracts text; image uploads only when you save.</p>
                    </div>
                </div>
                {scanError && <p className="text-red-500 mb-4">{scanError}</p>}

                <form onSubmit={handleJobUpload}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Job Title</label>
                        <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded" required />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Company</label>
                        <input type="text" value={jobCompany} onChange={(e) => setJobCompany(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded" required />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">WhatsApp Number</label>
                        <input type="text" value={jobWhatsapp} onChange={(e) => setJobWhatsapp(e.target.value)} placeholder="e.g. 971501234567" className="mt-1 block w-full px-3 py-2 border rounded" />
                        <p className="text-xs text-gray-500 mt-1">Optional. If left empty, site default will be used.</p>
                    </div>
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} rows="6" className="mt-1 block w-full px-3 py-2 border rounded" required />
                    </div>

                    <button type="submit" disabled={isUploading} className={`w-full px-4 py-3 font-bold rounded-lg text-white ${isUploading ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"}`}>
                        {isUploading ? (jobId ? "Updating..." : "Uploading...") : (jobId ? "Update Job" : "Save Job")}
                    </button>
                </form>
            </div>

            {/* Settings */}
            <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md mb-8">
                <h3 className="text-2xl font-bold mb-4">Site Contact Settings</h3>
                <form onSubmit={handleSaveSettings}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Default WhatsApp Number</label>
                        <input type="text" value={siteWhatsapp} onChange={(e) => setSiteWhatsapp(e.target.value)} placeholder="e.g. 971501234567" className="mt-1 block w-full px-3 py-2 border rounded" />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Contact Email</label>
                        <input type="email" value={siteContactEmail} onChange={(e) => setSiteContactEmail(e.target.value)} placeholder="contact@example.com" className="mt-1 block w-full px-3 py-2 border rounded" />
                    </div>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded">{settingsLoaded ? "Save Settings" : "Saving..."}</button>
                </form>
            </div>

            {/* Jobs list for admin */}
            <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md">
                <h3 className="text-2xl font-bold mb-6">Current Job Vacancies</h3>
                <div className="space-y-4">
                    {jobs.map(j => (
                        <div key={j.id} className="p-4 border rounded-lg flex justify-between items-center">
                            <div className="flex-1 pr-4">
                                <p className="font-semibold">{j.title} ({j.company})</p>
                                <p className="text-xs text-gray-500">WhatsApp: {j.whatsapp_number || siteWhatsapp || WHATSAPP_NUMBER}</p>
                                {j.image_url && <p className="text-xs mt-1">Image: <a href={j.image_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a></p>}
                            </div>
                            <div className="flex space-x-2">
                                <button onClick={() => handleEdit(j)} className="px-3 py-1 bg-blue-500 text-white rounded">Edit</button>
                                <button onClick={() => handleDelete(j.id, j.title)} className="px-3 py-1 bg-red-500 text-white rounded">Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

/** Public job list */
const PublicJobList = ({ siteSettings }) => {
    const [jobs, setJobs] = useState([]);
    const settingsDocRef = doc(db, `/artifacts/${appId}/public/data/settings`, "site");

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, `/artifacts/${appId}/public/data/jobs`));
        const unsubscribe = onSnapshot(q, (qs) => {
            const arr = [];
            qs.forEach(s => arr.push({ id: s.id, ...s.data() }));
            arr.sort((a, b) => (b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0)) - (a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0)));
            setJobs(arr);
        });
        return () => unsubscribe();
    }, []);

    const normalizeForWa = (raw) => raw ? raw.replace(/\D/g, "") : "";

    const handleApply = (title, wa) => {
        const number = normalizeForWa(wa) || normalizeForWa(siteSettings?.whatsapp_number) || WHATSAPP_NUMBER;
        const message = encodeURIComponent(`Hello, I am interested in the position of ${title} that I saw on your job portal. Please send me more details.`);
        window.open(`https://wa.me/${number}?text=${message}`, "_blank");
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-extrabold text-center mb-8">Current Openings</h1>
                {jobs.length === 0 && <p className="text-center text-gray-600 border p-8 mt-10 bg-white rounded-lg shadow">No jobs available right now. Admin se nayi job add karein.</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {jobs.map(job => (
                        <div key={job.id} className="bg-white p-6 rounded-lg shadow-lg border hover:shadow-xl flex flex-col justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-blue-700 mb-2">{job.title}</h2>
                                <h3 className="text-md font-semibold text-gray-700 mb-3">{job.company}</h3>
                                {job.image_url && <img src={job.image_url} alt={job.title} className="w-full h-48 object-contain rounded-md my-3" />}
                                <p className="text-gray-600 text-sm whitespace-pre-wrap line-clamp-4">{job.description}</p>
                            </div>
                            <button onClick={() => handleApply(job.title, job.whatsapp_number)} className="mt-4 w-full bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600">
                                Apply Now (WhatsApp)
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

/** Static page component (Privacy / Terms / About / Contact) */
const StaticContentPage = ({ title, content }) => (
    <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-lg">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-6 border-b pb-3">{title}</h1>
            <div className="text-gray-700 whitespace-pre-wrap">{content}</div>
        </div>
    </div>
);

/** Admin Login - HARDCODED credentials as requested */
const AdminLogin = ({ setPage, setUser }) => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const ADMIN_EMAIL = "razaaamil7599@gmail.com";
    const ADMIN_PASSWORD = "Aamil@759922";

    const handleLogin = (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setTimeout(() => {
            if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
                setUser({ email: ADMIN_EMAIL, isAdmin: true });
                setPage("admin");
                alert("Admin login successful!");
            } else {
                setError("Incorrect email or password.");
            }
            setLoading(false);
        }, 400);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-xl">
                <h2 className="text-3xl font-bold text-center mb-6">Admin Login</h2>
                <form onSubmit={handleLogin}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium">Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded" required />
                    </div>
                    <div className="mb-6">
                        <label className="block text-sm font-medium">Password</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded" required />
                    </div>
                    {error && <p className="text-red-500 mb-4">{error}</p>}
                    <button type="submit" disabled={loading} className="w-full px-4 py-2 bg-blue-600 text-white rounded">
                        {loading ? "Logging in..." : "Login"}
                    </button>
                </form>
                <p className="text-xs text-gray-500 mt-4">Use provided admin credentials only.</p>
            </div>
        </div>
    );
};

// ---------------- MAIN APP ----------------
export default function App() {
    const [user, setUser] = useState(null); // holds admin object if logged in via hardcoded login
    const [page, setPage] = useState("public");
    const [siteSettings, setSiteSettings] = useState({ whatsapp_number: WHATSAPP_NUMBER, contact_email: "contact@gulfcareergateway.com" });

    // If Firebase auth present, keep existing anonymous/custom token behavior for Firestore read/write
    useEffect(() => {
        if (!auth || !db) return;
        const init = async () => {
            try {
                if (typeof __initial_auth_token !== "undefined" && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (err) {
                console.error("Auth init err:", err);
                try { await signInAnonymously(auth); } catch (e) { console.error(e); }
            }

            const unsub = onAuthStateChanged(auth, (currentUser) => {
                // we don't treat firebase user as admin here; we rely on hardcoded login for admin
                // but keep auth ready for Firestore permissions
            });
            return () => unsub();
        };
        init();
    }, []);

    // load site settings (whatsapp/email)
    useEffect(() => {
        if (!db) return;
        let mounted = true;
        (async () => {
            try {
                const snap = await getDoc(doc(db, `/artifacts/${appId}/public/data/settings`, "site"));
                if (snap.exists() && mounted) {
                    setSiteSettings(snap.data() || siteSettings);
                }
            } catch (err) {
                console.error("Load settings err:", err);
            }
        })();
        return () => { mounted = false; };
    }, []);

    // Static pages content (separate privacy & terms)
    const contentData = {
        about: {
            title: "About Gulf Career Gateway",
            content: `Gulf Career Gateway ek platform hai jo Gulf countries mein naukri dhoondhne mein madad karta hai. Admin panel AI scanning se job posters se text nikalta hai aur Firestore par save hota hai.`
        },
        contact: {
            title: "Contact Us",
            content: `Agar aap contact karna chahte hain:\n\nWhatsApp: +${siteSettings.whatsapp_number || WHATSAPP_NUMBER}\nEmail: ${siteSettings.contact_email || "contact@gulfcareergateway.com"}\n\nHamari team business hours mein respond karegi.`
        },
        privacy: {
            title: "Privacy Policy",
            content: `Last updated: ${new Date().toLocaleDateString()}\n\n1. Introduction\nHum aapke data ko surakshit rakhte hain. Ye policy batati hai ki hum kya collect karte hain aur kaise use karte hain.\n\n2. Data Collected\n- Job posts (title, company, description)\n- Contact info (WhatsApp, email)\n- Uploaded images\n\n3. Use\n- Job listings ko display karna\n- AI scan ke liye images process karna\n\n4. Storage\n- Data Firebase Firestore aur images Cloudinary par store hoti hain.\n\n5. Third Parties\n- Hum Google (Gemini), Cloudinary, Firebase aur WhatsApp services use karte hain. Unke apne policies lagu honge.\n\nContact: ${siteSettings.contact_email || "contact@gulfcareergateway.com"}`
        },
        terms: {
            title: "Terms of Service",
            content: `Effective date: ${new Date().toLocaleDateString()}\n\n1. Acceptance\nSite use karke aap in terms ko accept karte hain.\n2. Service\nHum job listing information provide karte hain. Hum job authenticity ki guarantee nahi dete.\n3. Admin Access\nAdmin panel sirf authorized user ke liye hai.\n4. Liability\nHum site use se hone wale losses ke liye responsible nahi hain.\n\nContact: ${siteSettings.contact_email || "contact@gulfcareergateway.com"}`
        }
    };

    // Router selection
    let PageComponent;
    if (page === "admin") {
        PageComponent = <AdminPanel user={user} />;
    } else if (page === "admin-login") {
        PageComponent = <AdminLogin setPage={setPage} setUser={setUser} />;
    } else if (contentData[page]) {
        PageComponent = <StaticContentPage title={contentData[page].title} content={contentData[page].content} />;
    } else {
        PageComponent = <PublicJobList siteSettings={siteSettings} />;
    }

    // Logout handler (for hardcoded admin — clears local user object)
    const handleLogout = () => {
        setUser(null);
        setPage("public");
        alert("Logged out.");
    };

    // If Firebase not configured show error
    if (firebaseConfig.apiKey === "FALLBACK_API_KEY" || firebaseConfig.apiKey === "INVALID_JSON") {
        return (
            <div className="flex items-center justify-center min-h-screen p-10 bg-red-100 text-red-800">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">Configuration Error!</h1>
                    <p>Firebase API keys nahi mili.</p>
                    <p>Kripya `REACT_APP_FIREBASE_CONFIG` environment variable set karein ya __firebase_config global provide karein.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <nav className="bg-white text-gray-800 p-4 flex justify-between items-center shadow-md sticky top-0 z-10">
                <a href="#" onClick={(e) => { e.preventDefault(); setPage("public"); }} className="text-2xl font-bold text-blue-700">Gulf Career Gateway</a>
                <div className="flex space-x-4 items-center text-sm font-semibold">
                    <button onClick={() => setPage("about")} className="hover:text-blue-700">About</button>
                    <button onClick={() => setPage("contact")} className="hover:text-blue-700">Contact</button>
                    <button onClick={() => setPage("privacy")} className="hover:text-blue-700">Privacy</button>
                    <button onClick={() => setPage("terms")} className="hover:text-blue-700">Terms</button>
                    {user ? (
                        <>
                            <button onClick={() => setPage("admin")} className="px-4 py-2 bg-gray-100 rounded">Admin Panel</button>
                            <button onClick={handleLogout} className="px-4 py-2 bg-red-600 text-white rounded">Logout</button>
                        </>
                    ) : (
                        <button onClick={() => setPage("admin-login")} className="px-4 py-2 bg-gray-100 rounded">Admin Login</button>
                    )}
                </div>
            </nav>

            <main className="flex-grow">
                {PageComponent}
            </main>

            {/* Floating WhatsApp */}
            <a
                href={`https://wa.me/${(siteSettings.whatsapp_number && siteSettings.whatsapp_number.replace(/\D/g, '')) || WHATSAPP_NUMBER}?text=Hello%2C%20I%20am%20interested%20in%20a%20job%20vacancy%20at%20Gulf%20Career%20Gateway.`}
                target="_blank"
                rel="noopener noreferrer"
                className="fixed bottom-6 right-6 w-14 h-14 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-green-600"
                aria-label="Contact us on WhatsApp"
            >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12.039 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-2.039 17.519c-.328 0-.64-.176-.807-.478l-1.397-2.736c-.198-.39.027-.852.455-.916l2.365-.352c.319-.047.632.086.814.336l.542.748c.182.25.44.382.72.382h.001c.291 0 .564-.139.75-.38l2.67-3.486c.216-.282.25-.662.089-.974l-1.02-1.928c-.143-.271-.43-.443-.74-.443h-.001c-.347 0-.66.191-.825.503l-1.144 2.226c-.167.324-.492.532-.843.532h-.001c-.352 0-.678-.208-.845-.532l-.99-1.944c-.266-.523-.082-1.157.433-1.423l4.314-2.22c.241-.124.512-.13.753-.012l3.79 1.761c.287.133.488.423.518.749l.66 4.757c.05.353-.11.71-.397.904l-5.11 3.55c-.297.206-.694.206-.991 0z" /></svg>
            </a>

            {/* Footer */}
            <footer className="bg-gray-800 text-white p-4 text-center text-sm">
                <div className="flex justify-center space-x-6 mb-2">
                    <button onClick={() => setPage("privacy")} className="hover:text-blue-400">Privacy Policy</button>
                    <button onClick={() => setPage("terms")} className="hover:text-blue-400">Terms of Service</button>
                    <button onClick={() => setPage("contact")} className="hover:text-blue-400">Contact</button>
                </div>
                <p>&copy; {new Date().getFullYear()} Gulf Career Gateway. All Rights Reserved.</p>
            </footer>
        </div>
    );
}
