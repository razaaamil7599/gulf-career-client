import React from 'react';

const JobCard = ({ job, siteWhatsapp, defaultNumber, onViewDetails }) => {
    const handleApply = (e) => {
        e.stopPropagation(); // Prevent card click
        const number = (job.whatsapp_number || siteWhatsapp || defaultNumber || '971501234567').replace(/\D/g, '');
        const message = encodeURIComponent(`Hello, I am interested in the position of ${job.title} that I saw on Gulf Career Gateway. Please send me more details.`);
        window.open(`https://wa.me/${number}?text=${message}`, '_blank');
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'Recent';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        if (diff === 0) return 'Today';
        if (diff === 1) return 'Yesterday';
        if (diff < 7) return `${diff} days ago`;
        return date.toLocaleDateString();
    };

    const handleCardClick = () => {
        if (onViewDetails) {
            onViewDetails(job);
        }
    };

    return (
        <div
            onClick={handleCardClick}
            className="group bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/10 transform hover:-translate-y-2 transition-all duration-300 cursor-pointer"
        >
            {/* Image */}
            {job.image_url ? (
                <div className="relative h-48 overflow-hidden">
                    <img
                        src={job.image_url}
                        alt={job.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
                    <div className="absolute bottom-3 left-3">
                        <span className="px-3 py-1 bg-green-500/90 text-white text-xs font-bold rounded-full">
                            ✓ Verified
                        </span>
                    </div>
                    <div className="absolute top-3 right-3">
                        <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg">
                            Click for Details
                        </span>
                    </div>
                </div>
            ) : (
                <div className="h-32 bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center relative">
                    <span className="text-4xl">💼</span>
                    <div className="absolute top-3 right-3">
                        <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg">
                            Click for Details
                        </span>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="p-5">
                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-3">
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-lg font-medium">
                        Full Time
                    </span>
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-lg font-medium">
                        Gulf
                    </span>
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors line-clamp-2">
                    {job.title}
                </h3>

                {/* Company */}
                <div className="flex items-center gap-2 text-slate-400 mb-3">
                    <span>🏢</span>
                    <span className="font-medium">{job.company}</span>
                </div>

                {/* Description */}
                <p className="text-slate-400 text-sm line-clamp-3 mb-4">
                    {job.description}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                        <span>📅</span> {formatDate(job.createdAt)}
                    </span>

                    <button
                        onClick={handleApply}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-green-500/25 transform hover:scale-105 transition-all text-sm"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                        </svg>
                        Apply Now
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JobCard;

