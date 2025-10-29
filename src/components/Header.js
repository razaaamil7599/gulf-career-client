import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

function Header() {
    return (
        <header className="site-header">
            <div className="header-container">
                <Link to="/" className="logo">Gulf Career Gateway</Link>
                <nav>
                    <Link to="/">Home</Link>
                    <Link to="/about">About Us</Link>
                    <Link to="/contact">Contact</Link>
                </nav>
            </div>
        </header>
    );
}

export default Header;