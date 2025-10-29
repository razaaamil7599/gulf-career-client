import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

function Footer() {
    return (
        <footer className="site-footer">
            <div className="footer-container">
                <div className="footer-links">
                    <Link to="/privacy-policy">Privacy Policy</Link>
                    <Link to="/terms">Terms of Service</Link>
                    <Link to="/contact">Contact Us</Link>
                </div>
                <div className="copyright">
                    © {new Date().getFullYear()} Gulf Career Gateway. All Rights Reserved.
                </div>
            </div>
        </footer>
    );
}

export default Footer;