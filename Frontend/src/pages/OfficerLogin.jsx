import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Shield, Mail, Lock, AlertCircle, ArrowRight, Building } from 'lucide-react';

export default function OfficerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('http://127.0.0.1:5000/api/officer/login', {
        email,
        password
      });

      if (response.data.success) {
        // Save officer data to local storage
        localStorage.setItem('pmc_officer', JSON.stringify(response.data.officer));
        navigate('/officer/dashboard');
      } else {
        setError(response.data.message || 'Login failed. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Invalid credentials or connection issue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Decorative background glows */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      {/* Main glass login card */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md bg-white/[0.03] border border-white/[0.08] backdrop-blur-2xl rounded-[32px] p-8 md:p-10 shadow-2xl relative z-10"
      >
        {/* Logos & Branding */}
        <div className="flex flex-col items-center mb-8 text-center">
          {/* Circular Shield Badge */}
          <div className="w-16 h-16 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center text-blue-400 mb-4 shadow-lg shadow-blue-500/10">
            <Shield className="h-8 w-8" />
          </div>

          <div className="flex items-center gap-1.5 justify-center mb-1">
            <Building className="h-5 w-5 text-gray-400" />
            <span className="font-display font-extrabold text-white text-sm tracking-widest uppercase">
              PMC Officer Portal
            </span>
          </div>
          <h2 className="text-2xl font-bold font-display text-white tracking-tight">
            SnapFix<span className="text-blue-500">AI</span> Dashboard
          </h2>
          <p className="text-gray-400 text-xs mt-2 max-w-xs">
            Access authorized for Pune Municipal Corporation officers only.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-2xl flex items-start gap-2.5"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block ml-1">
              Officer Email or Username
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                required
                placeholder="officer@pmc.gov.in or pmc"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-blue-500/50 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white placeholder-gray-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center ml-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 h-4 w-4 text-gray-500" />
              <input
                type="password"
                required
                placeholder="pmc"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-blue-500/50 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white placeholder-gray-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm py-4 rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 transition-all"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo credentials hint for users */}
        <div className="mt-8 pt-6 border-t border-white/[0.05] text-center">
          <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">
            Authorized Credentials
          </p>
          <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-2.5 text-[11px] text-gray-400 space-y-0.5 inline-block text-left">
            <div><span className="text-blue-400 font-medium">Username:</span> pmc</div>
            <div><span className="text-blue-400 font-medium">Password:</span> pmc</div>
          </div>
        </div>
      </motion.div>

      {/* Footer copyright */}
      <span className="text-[10px] text-gray-600 mt-6 relative z-10 tracking-widest uppercase">
        © 2026 Pune Municipal Corporation (PMC). All rights reserved.
      </span>
    </div>
  );
}
