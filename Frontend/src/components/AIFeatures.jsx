import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { Sparkles, Check, MapPin, Eye, AlertTriangle, TrendingUp, Cpu, Compass } from 'lucide-react';

export default function AIFeatures() {
  const { issues, setSelectedIssueForDetail } = useApp();
  const [hoveredPin, setHoveredPin] = useState(null);

  const features = [
  { title: 'Smart Issue Detection with Gemini AI', desc: 'Analyzes user photos to automatically classify defects and verify duplicates.' },
  { title: 'Severity Prediction & Auto Categorization', desc: 'Determines priority scores based on public hazard, obstruction index, and traffic.' },
  { title: 'Automatic Report Generation', desc: 'Compiles full metadata, GPS positioning, timestamp, and a structured municipal dispatch ticket.' },
  { title: 'Right Authority Routing', desc: 'Addresses are geocoded to immediately dispatch the ticket to corresponding ward works crew.' },
  { title: 'Real-Time Progress Tracking', desc: 'Provides active, public timeline updates from inspection right down to pothole filling.' },
  { title: 'Data Insights for Better Decisions', desc: 'Helps city administrators identify high-frequency defect spots and budget infrastructure.' }];


  return (
    <section id="ai-features" className="py-20 bg-white relative overflow-hidden">
      {/* Decorative blurry nodes */}
      <div className="absolute top-1/4 right-0 w-80 h-80 bg-red-500/5 blur-3xl -z-10" />
      <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-blue-500/5 blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Interactive Map, Dashboard mockup & Analytics widgets */}
          <div className="lg:col-span-6 space-y-6 order-2 lg:order-1">
            
            {/* Interactive Vector Map Wrapper */}
            <div className="bg-slate-900 rounded-[32px] p-6 border border-slate-800 shadow-2xl relative overflow-hidden">
              {/* Grid background overlay for HUD look */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-15 pointer-events-none" />

              {/* Map Header HUD */}
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800 z-10 relative">
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-primary animate-spin-slow" />
                  <div>
                    <span className="font-display font-bold text-xs text-white uppercase tracking-wider block">MUNICIPAL RADAR</span>
                    <span className="text-[10px] text-gray-500">Live geo-tagged incident markers</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  <span className="text-[9px] font-bold text-gray-400">CONNECT SYSTEM</span>
                </div>
              </div>

              {/* Stylized Interactive Map Canvas (pure CSS/SVG) */}
              <div className="relative h-64 sm:h-80 w-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                
                {/* Simulated Map Streets & Rivers */}
                <svg className="absolute inset-0 h-full w-full opacity-35" xmlns="http://www.w3.org/2000/svg">
                  {/* Styled River */}
                  <path d="M-10,40 Q120,60 210,140 T500,220" fill="none" stroke="#2563eb" strokeWidth="24" strokeLinecap="round" />
                  
                  {/* Styled Grid Roads */}
                  <line x1="10%" y1="0" x2="10%" y2="100%" stroke="#475569" strokeWidth="2" />
                  <line x1="40%" y1="0" x2="40%" y2="100%" stroke="#475569" strokeWidth="4" />
                  <line x1="75%" y1="0" x2="75%" y2="100%" stroke="#475569" strokeWidth="2" />
                  
                  <line x1="0" y1="30%" x2="100%" y2="30%" stroke="#475569" strokeWidth="4" />
                  <line x1="0" y1="65%" x2="100%" y2="65%" stroke="#475569" strokeWidth="2" />
                  
                  {/* Diagonals */}
                  <line x1="0" y1="10%" x2="100%" y2="90%" stroke="#334155" strokeWidth="1.5" />
                </svg>

                {/* Pulsing incident pins */}
                {issues.map((issue) => {
                  const isHovered = hoveredPin === issue.id;

                  return (
                    <div
                      key={issue.id}
                      style={{ left: `${issue.coordinates.x}%`, top: `${issue.coordinates.y}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer"
                      onMouseEnter={() => setHoveredPin(issue.id)}
                      onMouseLeave={() => setHoveredPin(null)}
                      onClick={() => setSelectedIssueForDetail(issue)}>
                      
                      {/* Pulse Circle rings */}
                      <span className={`absolute inline-flex h-8 w-8 -left-2.5 -top-2.5 rounded-full opacity-40 animate-ping ${
                      issue.status === 'Resolved' ?
                      'bg-emerald-500' :
                      issue.status === 'In Progress' ?
                      'bg-amber-500' :
                      'bg-blue-500'}`
                      } />

                      {/* Map Pin marker */}
                      <div className={`p-1.5 rounded-full border shadow-md transition-all ${
                      isHovered ? 'scale-125 z-30' : 'scale-100'} ${

                      issue.status === 'Resolved' ?
                      'bg-emerald-500 border-emerald-400 text-white' :
                      issue.status === 'In Progress' ?
                      'bg-amber-500 border-amber-400 text-white' :
                      'bg-blue-500 border-blue-400 text-white'}`
                      }>
                        <MapPin className="h-3.5 w-3.5 fill-current" />
                      </div>

                      {/* Mini hover Info box */}
                      <AnimatePresence>
                        {isHovered &&
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: -45, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          className="absolute -translate-x-1/2 bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-xl w-40 text-left pointer-events-none">
                          
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{issue.category}</p>
                            <h5 className="font-bold text-white text-xs leading-tight truncate mt-0.5">{issue.title}</h5>
                            <div className="flex justify-between items-center mt-1 pt-1 border-t border-slate-800">
                              <span className="text-[8px] text-gray-500">Status:</span>
                              <span className={`text-[8px] font-bold ${
                            issue.status === 'Resolved' ? 'text-emerald-400' : issue.status === 'In Progress' ? 'text-amber-400' : 'text-blue-400'}`
                            }>{issue.status}</span>
                            </div>
                          </motion.div>
                        }
                      </AnimatePresence>
                    </div>);

                })}

                {/* Map HUD controls overlay */}
                <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-xs border border-slate-800 p-2 rounded-lg text-[9px] text-gray-400 space-y-1 select-none pointer-events-none">
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 bg-blue-500 rounded-full" />
                    <span>Reported</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 bg-amber-500 rounded-full" />
                    <span>In Progress</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full" />
                    <span>Resolved</span>
                  </div>
                </div>

                <div className="absolute bottom-3 right-3 bg-slate-900/90 backdrop-blur-xs border border-slate-800 px-2 py-1 rounded-lg text-[9px] text-gray-400 flex items-center gap-1 select-none">
                  <Eye className="h-3 w-3 text-primary" />
                  <span>Click pin for details</span>
                </div>
              </div>

              {/* Sub-Mockup Row: Two analytics widgets inside the dashboard view */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                {/* Analytics card 1 */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">MUNICIPAL SPEED</span>
                    <TrendingUp className="h-3.5 w-3.5 text-success" />
                  </div>
                  <p className="font-display font-extrabold text-white text-lg mt-1">-35%</p>
                  <p className="text-[9px] text-gray-500 mt-0.5">Average dispatch ticket latency</p>
                </div>

                {/* Analytics card 2 */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">AI PRECISION</span>
                    <Cpu className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="font-display font-extrabold text-white text-lg mt-1">98.4%</p>
                  <p className="text-[9px] text-gray-500 mt-0.5">Object localization accuracy</p>
                </div>
              </div>

            </div>
          </div>

          {/* Right Column: AI Feature List details */}
          <div className="lg:col-span-6 text-left space-y-8 order-1 lg:order-2">
            <div>
              <div className="inline-flex items-center gap-1 bg-red-50 text-primary border border-red-100 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider mb-4">
                <Sparkles className="h-3.5 w-3.5" />
                Gemini AI Engine
              </div>
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-gray-900 tracking-tight">
                AI-Powered for <br />Smarter Communities
              </h2>
              <div className="h-1 w-12 bg-primary mt-4 rounded-full" />
            </div>

            {/* Feature List Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
              {features.map((feature, idx) =>
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className="flex gap-3">
                
                  <div className="p-1 rounded-full bg-emerald-50 border border-emerald-100 text-success shrink-0 h-6 w-6 flex items-center justify-center mt-0.5">
                    <Check className="h-3.5 w-3.5 stroke-[3px]" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-sm text-gray-900 leading-tight">
                      {feature.title}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      {feature.desc}
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

        </div>
      </div>
    </section>);

}