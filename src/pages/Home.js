// src/pages/Home.js (Final Code)
import React, { useState, useEffect } from 'react';
import '../App.css';

function Home() {
    // ... (saare states waise hi rahenge) ...
    const [vacancies, setVacancies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCountry, setFilterCountry] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [uniqueCountries, setUniqueCountries] = useState([]);
    const [uniqueCategories, setUniqueCategories] = useState([]);

    useEffect(() => {
        const fetchVacancies = async () => {
            setLoading(true);
            setError(null);

            // --- YAHAN NAYA VERCEL URL DAALA GAYA HAI ---
            const LIVE_API_URL = 'https://gulf-career-backend.vercel.app';

            let apiUrl = `${LIVE_API_URL}/api/vacancies?`;
            if (searchTerm) apiUrl += `search=${encodeURIComponent(searchTerm)}&`;
            if (filterCountry) apiUrl += `country=${encodeURIComponent(filterCountry)}&`;
            if (filterCategory) apiUrl += `category=${encodeURIComponent(filterCategory)}&`;

            try {
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error('Could not connect to the new Vercel server.');
                }
                const data = await response.json();
                setVacancies(data);

                const countries = [...new Set(data.map(v => v.country))].sort();
                const categories = [...new Set(data.map(v => v.category))].sort();
                setUniqueCountries(countries);
                setUniqueCategories(categories);

            } catch (error) {
                setError(error.message);
                setVacancies([]);
            } finally {
                setLoading(false);
            }
        };
        fetchVacancies();
    }, [searchTerm, filterCountry, filterCategory]);

    // ... (baaki saara code bilkul waisa hi rahega) ...
    const handleSearchChange = (event) => setSearchTerm(event.target.value);
    const handleCountryChange = (event) => setFilterCountry(event.target.value);
    const handleCategoryChange = (event) => setFilterCategory(event.target.value);

    return (
        <div className="main-content-area">
            {/* Search and Filter Controls */}
            <div className="search-filter-controls">
                <input
                    type="text"
                    placeholder="Search by job title or keyword..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="search-input"
                />
                <div className="filter-dropdowns">
                    <select value={filterCountry} onChange={handleCountryChange} className="filter-select">
                        <option value="">All Countries</option>
                        {uniqueCountries.map(country => <option key={country} value={country}>{country}</option>)}
                    </select>
                    <select value={filterCategory} onChange={handleCategoryChange} className="filter-select">
                        <option value="">All Categories</option>
                        {uniqueCategories.map(category => <option key={category} value={category}>{category}</option>)}
                    </select>
                </div>
            </div>

            {/* Loading/Error Messages */}
            {loading && <p className="status-message">Loading vacancies...</p>}
            {error && <p className="status-message error">Error: {error}</p>}

            {/* Vacancy List */}
            <div className="vacancy-list">
                {!loading && !error && vacancies.length === 0 && (
                    <p className="status-message">No vacancies found matching your criteria.</p>
                )}
                {vacancies.map((vacancy) => {
                    const whatsappMessage = `Hello, I'm interested in the "${vacancy.title}" position.`;
                    const whatsappUrl = `https://wa.me/${vacancy.contactNumber}?text=${encodeURIComponent(whatsappMessage)}`;
                    return (
                        <div key={vacancy._id} className="vacancy-card">
                            {vacancy.imageUrl && <img src={vacancy.imageUrl} alt={vacancy.title} className="vacancy-image" />}
                            <div className="card-content">
                                <h2>{vacancy.title}</h2>
                                <div className="card-details">
                                    <p><strong>📍 Location:</strong> {vacancy.country}</p>
                                    <p><strong>📁 Category:</strong> {vacancy.category}</p>
                                    {vacancy.salary && <p><strong>💰 Salary:</strong> {vacancy.salary}</p>}
                                </div>
                                <div className="card-description">
                                    <h3>Description</h3>
                                    <p>{vacancy.description}</p>
                                    <h3>Requirements</h3>
                                    <p>{vacancy.requirements}</p>
                                </div>
                                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="apply-btn">Apply Now</a>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default Home;