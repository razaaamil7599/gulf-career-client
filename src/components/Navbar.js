import React, { useState } from 'react';

const Navbar = ({ setPage, user, onLogout }) => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const navLinks = [
        { label: 'Home', href: '#', onClick: () => setPage('public') },
        { label: 'About', href: '#about' },
        { label: 'Contact', href: '#contact' }
    ];

    return (
        <nav className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
            <div className="container mx-auto px-6">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <a href="#" className="flex items-center gap-3" onClick={() => setPage('public')}>
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center font-bold text-white">
                            G
                        </div>
                        <span className="text-xl font-bold text-white hidden sm:block">
                            Gulf Career <span className="text-blue-400">Gateway</span>
                        </span>
                    </a>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center gap-8">
                        {navLinks.map((link, i) => (
                            <a
                                key={i}
                                href={link.href}
                                onClick={link.onClick}
                                className="text-slate-300 hover:text-white font-medium transition-colors"
                            >
                                {link.label}
                            </a>
                        ))}

                        {user ? (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setPage('admin')}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                                >
                                    Dashboard
                                </button>
                                <button
                                    onClick={onLogout}
                                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl font-medium transition-colors"
                                >
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <a
                                href="#admin"
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors border border-white/10"
                            >
                                Admin
                            </a>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="md:hidden p-2 text-white"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {mobileMenuOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            )}
                        </svg>
                    </button>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden py-4 border-t border-slate-800">
                        {navLinks.map((link, i) => (
                            <a
                                key={i}
                                href={link.href}
                                onClick={() => { link.onClick?.(); setMobileMenuOpen(false); }}
                                className="block py-3 text-slate-300 hover:text-white font-medium"
                            >
                                {link.label}
                            </a>
                        ))}
                        <a
                            href="#admin"
                            className="block py-3 text-blue-400 font-medium"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Admin Login
                        </a>
                    </div>
                )}
            </div>
        </nav>
    );
};

export default Navbar;
