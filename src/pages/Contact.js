import React, { useState, useEffect } from 'react';
import '../App.css';

function Contact() {
    // 1. State banayein taaki fetched settings ko store kar sakein
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);

    // 2. useEffect ka istemaal karke page load hote hi data fetch karein
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/settings');
                const data = await response.json();
                setSettings(data);
            } catch (error) {
                console.error("Error fetching settings:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []); // Khaali array ka matlab hai ki yeh sirf ek baar chalega

    return (
        <div className="main-content-area">
            <div className="page-card">
                <h1>Contact Us</h1>
                <p>We are here to help you take the next step in your career. Feel free to reach out to us with any questions.</p>

                {loading ? (
                    <p>Loading contact details...</p>
                ) : settings ? (
                    <div className="contact-info">
                        <h3>Get In Touch</h3>
                        {/* 3. Hardcoded text ki jagah, state se dynamic data dikhayein */}
                        <p><strong>Email:</strong> {settings.email}</p>
                        <p><strong>WhatsApp:</strong> {settings.whatsapp}</p>

                        <h3>Office Address</h3>
                        <p>{settings.address}</p>
                    </div>
                ) : (
                    <p>Contact details could not be loaded. Please add them in the admin panel.</p>
                )}
            </div>
        </div>
    );
}

export default Contact;