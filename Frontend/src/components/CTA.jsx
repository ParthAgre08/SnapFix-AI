import React from 'react';
import { motion } from 'motion/react';
import { useApp } from '../context/AppContext';
import { Megaphone, PlusCircle } from 'lucide-react';

import { useNavigate } from 'react-router-dom';

export default function CTA() {
  const navigate = useNavigate();

  return (
    <section className="py-16 md:py-24 bg-[#1F2937] text-white relative overflow-hidden text-center border-t border-gray-800">
      {/* Visual glowing ring details in background */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] border border-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] border border-white/5 rounded-full translate-x-1/2 translate-y-1/2" />
      
      {/* Decorative colored blobs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-red-500/5 blur-3xl -z-10 rounded-full" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Call-to-action content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center">
          
          {/* Circular Megaphone Badge */}
          <div className="p-4 bg-white/5 backdrop-blur-md rounded-xl text-white mb-6 shadow-xl border border-white/10 flex items-center justify-center">
            <Megaphone className="h-6 w-6 text-[#E74C3C] animate-bounce" />
          </div>

          {/* Heading */}
          <h2 className="font-display font-extrabold text-3xl sm:text-5xl text-white tracking-tight leading-tight">
            Ready to improve your community?
          </h2>

          {/* Slogan Text */}
          <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto mt-4 leading-relaxed font-normal">
            Be the change. Report issues. Make an impact.
          </p>

          {/* CTA Action button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/report')}
            className="mt-8 bg-[#E74C3C] hover:bg-[#D32F2F] text-white font-extrabold text-base px-8 py-4 rounded-xl shadow-xl shadow-red-950/20 transition-all cursor-pointer flex items-center gap-2">
            
            <PlusCircle className="h-5 w-5" />
            Start Reporting Now
          </motion.button>
        </motion.div>
      </div>
    </section>);

}