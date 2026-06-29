import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Send, Mail, Phone, MapPin, Twitter, Github, Linkedin, MessageCircle, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);
    setEmail('');
    setTimeout(() => {
      setSubscribed(false);
    }, 4000);
  };

  const scrollHome = (e) => {
    e.preventDefault();
    const target = document.querySelector('#home');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-slate-900 border-t border-slate-800 text-gray-400 text-sm py-16 relative overflow-hidden">
      
      {/* Decorative details */}
      <div className="absolute top-0 right-10 w-64 h-64 bg-red-500/5 blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 pb-12 border-b border-slate-800">
          
          {/* Column 1: App Info */}
          <div className="col-span-12 md:col-span-4 space-y-4 text-left">
            <a href="#home" onClick={scrollHome} className="flex items-center gap-2">
              <div className="bg-primary hover:bg-primary-hover p-2 rounded-xl text-white flex items-center justify-center shadow-md">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <span className="font-display font-extrabold text-xl tracking-tight text-white">
                SnapFix<span className="text-primary">AI</span>
              </span>
            </a>
            <p className="text-xs text-gray-500 leading-relaxed max-w-xs">
              Empowering citizens to report municipal defects and street issues instantly. Automatically routed by AI directly to ward work units.
            </p>
            {/* Social Icons */}
            <div className="flex gap-3 pt-2">
              <a href="#" className="p-2 rounded-lg bg-slate-800 hover:bg-primary hover:text-white transition-colors text-gray-400">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="#" className="p-2 rounded-lg bg-slate-800 hover:bg-primary hover:text-white transition-colors text-gray-400">
                <Github className="h-4 w-4" />
              </a>
              <a href="#" className="p-2 rounded-lg bg-slate-800 hover:bg-primary hover:text-white transition-colors text-gray-400">
                <Linkedin className="h-4 w-4" />
              </a>
              <a href="#" className="p-2 rounded-lg bg-slate-800 hover:bg-primary hover:text-white transition-colors text-gray-400">
                <MessageCircle className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="col-span-6 md:col-span-2 text-left space-y-4">
            <h4 className="font-display font-bold text-xs text-white uppercase tracking-wider">Quick Links</h4>
            <ul className="space-y-2.5 text-xs">
              <li><a href="#home" className="hover:text-primary transition-colors">Home</a></li>
              <li><a href="#how-it-works" className="hover:text-primary transition-colors">How It Works</a></li>
              <li><a href="#community" className="hover:text-primary transition-colors">Community Feed</a></li>
              <li><a href="#ai-features" className="hover:text-primary transition-colors">AI Features</a></li>
              <li><Link to="/officer/login" className="hover:text-blue-400 font-bold text-blue-500 hover:underline transition-all">Login as Municipal Officer</Link></li>
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div className="col-span-6 md:col-span-2 text-left space-y-4">
            <h4 className="font-display font-bold text-xs text-white uppercase tracking-wider">Resources</h4>
            <ul className="space-y-2.5 text-xs">
              <li><a href="#" className="hover:text-primary transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Municipal Guidelines</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">API Access</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Terms of Service</a></li>
            </ul>
          </div>

          {/* Column 4: Contact / Connect */}
          <div className="col-span-12 md:col-span-4 text-left space-y-4">
            <h4 className="font-display font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>Stay Updated</span>
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed max-w-xs">
              Subscribe to weekly municipal resolution summaries and local neighborhood safety bulletins.
            </p>

            {/* Newsletter form */}
            <form onSubmit={handleSubscribe} className="space-y-2 max-w-xs">
              <div className="relative flex items-center">
                <input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-primary/40 rounded-xl py-2.5 pl-3 pr-10 text-xs focus:outline-hidden text-white"
                  required />
                
                <button
                  type="submit"
                  className="absolute right-1.5 bg-primary hover:bg-primary-hover text-white p-2 rounded-lg transition-colors flex items-center justify-center shrink-0">
                  
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>

              {subscribed &&
              <p className="text-emerald-400 font-medium text-[10px] animate-pulse">
                  ✓ Successfully subscribed to newsletter bulletins.
                </p>
              }
            </form>
          </div>

        </div>

        {/* Footer Base bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-8 text-xs text-gray-600 gap-4">
          <p>© 2026 SnapFix AI Inc. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Made with <Heart className="h-3 w-3 text-primary fill-primary" /> for cleaner, safer communities.
          </p>
        </div>

      </div>
    </footer>);

}