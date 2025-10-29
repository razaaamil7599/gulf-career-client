import React from 'react';
import { Link } from 'react-router-dom';
import '../App.css';

function About() {
    return (
        <div className="main-content-area">
            <div className="page-card">
                <h1>About Gulf Career Gateway</h1>
                <p className="about-subtitle">Your Trusted Partner in Building a Global Career</p>

                <p>
                    At Gulf Career Gateway, we are more than just a recruitment agency; we are career architects dedicated to building a secure bridge between the aspirations of Indian talent and the vast opportunities in the Gulf region. Our foundation is built on the principles of trust, transparency, and an unwavering commitment to our candidates' success.
                </p>

                <hr className="divider" />

                <h2>Our Story: The 'Saarathi' Vision</h2>
                <p>
                    Born from a vision to eliminate the hurdles faced by job seekers, Gulf Career Gateway was established to be a true 'Saarathi' (guide and companion) for every individual dreaming of a career in the Gulf. We witnessed firsthand the potential of hardworking individuals from regions like Uttar Pradesh who sought a better future but were often lost in a sea of misinformation and fraudulent agents. We decided to create a platform that was not just a job board, but a complete support system.
                </p>

                <hr className="divider" />

                <h2>Our Mission and Vision</h2>
                <p>
                    <strong>Our Mission:</strong> To empower Indian professionals and skilled workers by connecting them with safe, verified, and rewarding career opportunities in the Gulf (UAE, Saudi Arabia, Qatar, Oman, Bahrain, and Kuwait), ensuring their journey is smooth, transparent, and successful from start to finish.
                </p>
                <p>
                    <strong>Our Vision:</strong> To become India's most trusted and respected overseas placement consultancy, known for our ethical practices, high success rate, and the positive impact we make on the lives of our candidates and their families.
                </p>

                <hr className="divider" />

                <h2>What Sets Us Apart?</h2>
                <p>In an industry filled with challenges, we stand out by adhering to our core values:</p>
                <ul>
                    <li><strong>Integrity & Transparency:</strong> No hidden fees, no false promises. We provide clear, honest information about every job vacancy and the entire process. Your trust is our most valuable asset.</li>
                    <li><strong>Candidate-First Approach:</strong> Your career goals are our top priority. We listen to your aspirations and guide you towards opportunities that best match your skills and ambitions. You are not just a number to us; you are our partner.</li>
                    <li><strong>Direct Company Partnerships:</strong> We work directly with reputable companies in the Gulf, eliminating middlemen and ensuring the authenticity of every job listing.</li>
                    <li><strong>End-to-End Support:</strong> Our support doesn't end once you get a job. We provide guidance on everything from resume building and interview preparation to visa processing and pre-departure briefings.</li>
                </ul>

                <hr className="divider" />

                <div className="cta-section">
                    <h2>Ready to Take the Next Step?</h2>
                    <p>Your dream career in the Gulf is just a step away. Let us be the gateway to your success.</p>
                    <Link to="/" className="apply-btn">Explore Current Vacancies</Link>
                </div>
            </div>
        </div>
    );
}

export default About;