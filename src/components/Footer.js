import React from 'react';

const Footer = ({ siteSettings }) => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-slate-900 border-t border-slate-800">
            {/* Main Footer */}
            <div className="container mx-auto px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div className="md:col-span-2">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center font-bold text-white text-xl">
                                G
                            </div>
                            <span className="text-2xl font-bold text-white">
                                Gulf Career <span className="text-blue-400">Gateway</span>
                            </span>
                        </div>
                        <p className="text-slate-400 mb-4 max-w-md">
                            Your trusted partner for Gulf job opportunities. We connect skilled workers
                            with verified employers in Saudi Arabia, UAE, Qatar, and more.
                        </p>
                        <div className="flex gap-4">
                            <a href="#" className="w-10 h-10 bg-slate-800 hover:bg-blue-600 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-all">
                                <span>📘</span>
                            </a>
                            <a href="#" className="w-10 h-10 bg-slate-800 hover:bg-pink-600 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-all">
                                <span>📸</span>
                            </a>
                            <a href={`https://wa.me/${siteSettings?.whatsapp_number || '971501234567'}`} className="w-10 h-10 bg-slate-800 hover:bg-green-600 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-all">
                                <span>📱</span>
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="text-white font-semibold mb-4">Quick Links</h4>
                        <ul className="space-y-2">
                            {['Home', 'About Us', 'Contact', 'Jobs'].map((link, i) => (
                                <li key={i}>
                                    <a href={`#${link.toLowerCase().replace(' ', '')}`} className="text-slate-400 hover:text-blue-400 transition-colors">
                                        {link}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h4 className="text-white font-semibold mb-4">Legal</h4>
                        <ul className="space-y-2">
                            <li><a href="#privacy" className="text-slate-400 hover:text-blue-400 transition-colors">Privacy Policy</a></li>
                            <li><a href="#terms" className="text-slate-400 hover:text-blue-400 transition-colors">Terms of Service</a></li>
                        </ul>
                        {siteSettings?.contact_email && (
                            <div className="mt-4">
                                <p className="text-slate-500 text-sm">Contact:</p>
                                <a href={`mailto:${siteSettings.contact_email}`} className="text-blue-400 text-sm">
                                    {siteSettings.contact_email}
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-slate-800">
                <div className="container mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between text-sm text-slate-500">
                    <p>© {currentYear} Gulf Career Gateway. All Rights Reserved.</p>
                    <p className="mt-2 md:mt-0">Made with ❤️ for Job Seekers</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;