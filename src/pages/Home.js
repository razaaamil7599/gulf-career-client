// src/pages/Home.js (FINAL CORRECTED CODE)
import React, { useState, useEffect } from 'react';
import '../App.css';

function Home() {
    const [vacancies, setVacancies] = useState([]);
    const [loading, setLoading] = useState(true);
    // ... baaki saare states ...

    useEffect(() => {
        const fetchVacancies = async () => {
            setLoading(true);
            setError(null);

            // --- YAHAN NAYA VERCEL URL DAALA GAYA HAI ---
            const LIVE_API_URL = 'https://gulf-career-backend.vercel.app';

            let apiUrl = `${LIVE_API_URL}/api/vacancies?`;
            // ... baaki fetch logic ...

            try {
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error('Could not connect to the new Vercel server.');
                }
                const data = await response.json();
                setVacancies(data);
                // ... baaki logic ...
            } catch (error) {
                // ... error handling ...
            } finally {
                setLoading(false);
            }
        };
        fetchVacancies();
    }, [searchTerm, filterCountry, filterCategory]);

    // ... baaki saara code bilkul waisa hi rahega ...
}

export default Home;