import React from 'react';

const HeroSection = ({ jobCount }) => {
    return (
        <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden" style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)'
        }}>
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 container mx-auto px-6 text-center">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 rounded-full border border-blue-500/30 mb-8" style={{ animation: 'fadeInUp 0.6s ease' }}>
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    <span className="text-blue-300 text-sm font-medium">Trusted by 10,000+ Job Seekers</span>
                </div>

                {/* Main Heading */}
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white mb-6 leading-tight" style={{ animation: 'fadeInUp 0.6s ease 0.1s backwards' }}>
                    Your Gateway to
                    <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                        Gulf Careers
                    </span>
                </h1>

                {/* Subtitle */}
                <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10" style={{ animation: 'fadeInUp 0.6s ease 0.2s backwards' }}>
                    Discover verified job opportunities in Saudi Arabia, UAE, Qatar & more.
                    Government approved process with 100% genuine vacancies.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16" style={{ animation: 'fadeInUp 0.6s ease 0.3s backwards' }}>
                    <a
                        href="#jobs"
                        className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-2xl hover:shadow-2xl hover:shadow-blue-500/25 transform hover:-translate-y-1 transition-all"
                    >
                        <span>🔍</span> Browse {jobCount || '50+'} Jobs
                    </a>
                    <a
                        href="#contact"
                        className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur border border-white/20 text-white font-semibold rounded-2xl hover:bg-white/20 transition-all"
                    >
                        <span>📞</span> Contact Agent
                    </a>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto" style={{ animation: 'fadeInUp 0.6s ease 0.4s backwards' }}>
                    {[
                        { number: '500+', label: 'Placed Candidates' },
                        { number: '50+', label: 'Active Vacancies' },
                        { number: '15+', label: 'Countries' },
                        { number: '24/7', label: 'Support' }
                    ].map((stat, i) => (
                        <div key={i} className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-4">
                            <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                {stat.number}
                            </div>
                            <div className="text-slate-400 text-sm">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Scroll Indicator */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
                <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center">
                    <div className="w-1 h-3 bg-white/50 rounded-full mt-2 animate-pulse"></div>
                </div>
            </div>
        </section>
    );
};

export default HeroSection;
