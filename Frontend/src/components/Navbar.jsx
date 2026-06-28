import React from 'react';
import { motion } from 'motion/react';
import { useApp } from '../context/AppContext';
import { AlertTriangle, LogIn, LogOut, User, Menu, X, PlusCircle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export default function Navbar() {
  const { user, logout } = useApp();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navLinks = [
  { name: 'Home', href: '/' },
  { name: 'How It Works', href: '/#how-it-works' },
  { name: 'Community', href: '/#community' },
  { name: 'AI Features', href: '/#ai-features' }];


  const handleScroll = (e, href) => {
    if (href.startsWith('/#')) {
      const id = href.replace('/#', '#');
      if (window.location.pathname !== '/') {
        navigate(href);
      } else {
        e.preventDefault();
        setMobileMenuOpen(false);
        const target = document.querySelector(id);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  };

  return (
    <motion.nav
      id="navbar"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="sticky top-0 z-50 w-full bg-white border-b border-gray-100 shadow-xs backdrop-blur-md bg-opacity-95">
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2">
              <div className="bg-primary hover:bg-primary-hover p-2 rounded-xl text-white flex items-center justify-center shadow-md shadow-primary/20 transition-colors">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <span className="font-display font-extrabold text-xl tracking-tight text-gray-900">
                SnapFix<span className="text-primary font-bold">AI</span>
              </span>
            </Link>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex space-x-8 items-center">
            {navLinks.map((link) =>
            <a
              key={link.name}
              href={link.href}
              onClick={(e) => handleScroll(e, link.href)}
              className="text-gray-600 hover:text-primary font-medium text-sm transition-colors relative py-2">
              
                {link.name}
              </a>
            )}
          </div>

          {/* Desktop Right Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {user ?
            <div className="flex items-center gap-3">
                <Link to="/profile" className="flex items-center gap-2 border border-gray-100 rounded-full py-1.5 pl-2 pr-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <img
                  src={user.photoURL}
                  alt={user.name}
                  className="w-7 h-7 rounded-full object-cover border border-white shadow-xs"
                  referrerPolicy="no-referrer" />
                
                  <div className="text-xs text-left">
                    <p className="font-semibold text-gray-800 leading-tight">{user.name}</p>
                    <p className="text-[10px] text-gray-500 leading-tight">{user.issuesReported || 0} reported</p>
                  </div>
                </Link>
                <button
                onClick={async () => {
                  await logout();
                  navigate('/login');
                }}
                className="p-2 text-gray-400 hover:text-primary hover:bg-gray-50 rounded-xl transition-all cursor-pointer"
                title="Logout">
                
                  <LogOut className="h-4 w-4" />
                </button>
              </div> :

            <Link
              to="/login"
              className="flex items-center gap-1.5 px-4 py-2 text-gray-700 hover:text-primary font-medium text-sm transition-colors rounded-xl hover:bg-gray-50">
              
                <LogIn className="h-4 w-4" />
                Login
              </Link>
            }

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/report')}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-primary/20 transition-all cursor-pointer">
              
              <PlusCircle className="h-4 w-4" />
              Report Issue
            </motion.button>
          </div>

          {/* Mobile hamburger menu */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen &&
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        className="md:hidden bg-white border-b border-gray-100 px-4 pt-2 pb-6 space-y-3 shadow-inner">
        
          {navLinks.map((link) =>
        <a
          key={link.name}
          href={link.href}
          onClick={(e) => handleScroll(e, link.href)}
          className="block px-3 py-2.5 rounded-xl text-base font-medium text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors">
          
              {link.name}
            </a>
        )}

          <div className="pt-4 border-t border-gray-100 flex flex-col gap-3">
            {user ?
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl">
                <Link to="/profile" className="flex items-center gap-3">
                  <img
                src={user.photoURL}
                alt={user.name}
                className="w-10 h-10 rounded-full object-cover border border-white shadow-sm"
                referrerPolicy="no-referrer" />
              
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </Link>
                <button
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
              className="p-2 text-gray-400 hover:text-primary hover:bg-red-50 rounded-xl transition-all cursor-pointer">
              
                  <LogOut className="h-5 w-5" />
                </button>
              </div> :

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              navigate('/login');
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">
            
                <LogIn className="h-5 w-5" />
                Login
              </button>
          }

            <button
            onClick={() => {
              setMobileMenuOpen(false);
              navigate('/report');
            }}
            className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white font-semibold py-3 rounded-xl shadow-lg shadow-primary/20 transition-all">
            
              <PlusCircle className="h-5 w-5" />
              Report Issue
            </button>
          </div>
        </motion.div>
      }
    </motion.nav>);

}