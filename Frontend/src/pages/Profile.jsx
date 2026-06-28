import React from 'react';
import { motion } from 'motion/react';
import { useApp } from '../context/AppContext';
import { Edit2, MapPin, Mail, AlertTriangle, CheckCircle2, Clock, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user } = useApp();
  const navigate = useNavigate();

  if (!user) return null;

  const stats = [
    { label: 'Reported Issues', value: user.issuesReported || 0, icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Resolved Issues', value: user.issuesResolved || 0, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Pending Issues', value: user.issuesPending || 0, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Back navigation */}
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center text-sm text-gray-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Home
        </button>

        {/* Profile Header Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="h-32 bg-gradient-to-r from-primary/20 to-primary/5"></div>
          <div className="px-8 pb-8">
            <div className="relative flex justify-between items-end -mt-16 mb-6">
              <img 
                src={user.photoURL} 
                alt={user.name} 
                className="w-32 h-32 rounded-full border-4 border-white shadow-lg object-cover bg-white"
                referrerPolicy="no-referrer"
              />
              <button className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                <Edit2 className="w-4 h-4" />
                Edit Profile
              </button>
            </div>
            
            <div className="space-y-1">
              <h1 className="text-3xl font-display font-bold text-gray-900">{user.name}</h1>
              <div className="flex items-center gap-4 text-gray-500 text-sm">
                <span className="flex items-center gap-1"><Mail className="w-4 h-4" /> {user.email}</span>
                {user.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {user.location}</span>}
              </div>
            </div>
            
            {user.bio ? (
              <p className="mt-4 text-gray-600 leading-relaxed">{user.bio}</p>
            ) : (
              <p className="mt-4 text-gray-400 italic text-sm">No bio provided yet.</p>
            )}
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
              <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-8 h-8" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{stat.label}</p>
              </div>
            </div>
          ))}
        </motion.div>

      </div>
    </div>
  );
}
