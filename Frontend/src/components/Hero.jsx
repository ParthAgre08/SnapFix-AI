import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useApp } from '../context/AppContext';
import { Play, Sparkles, CheckCircle2, ShieldAlert, Cpu, ClipboardCheck, ArrowRight, PlayCircle } from 'lucide-react';

import { useNavigate } from 'react-router-dom';

export default function Hero() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  // Cycle through workflow steps on the hero visualization to make it feel alive!
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const steps = [
  {
    id: 0,
    title: 'AI Analysis',
    desc: 'Gemini analyzes the image for category, size & severity.',
    icon: Cpu,
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
    lightBg: 'bg-blue-50',
    borderGlow: 'border-blue-400 shadow-blue-100'
  },
  {
    id: 1,
    title: 'Report Generated',
    desc: 'Location is pinned, and structured dispatch ticket is compiled.',
    icon: ClipboardCheck,
    color: 'bg-purple-500',
    textColor: 'text-purple-500',
    lightBg: 'bg-purple-50',
    borderGlow: 'border-purple-400 shadow-purple-100'
  },
  {
    id: 2,
    title: 'Authority Notified',
    desc: 'Ticket automatically routed directly to local Ward Works crew.',
    icon: ShieldAlert,
    color: 'bg-orange-500',
    textColor: 'text-orange-500',
    lightBg: 'bg-orange-50',
    borderGlow: 'border-orange-400 shadow-orange-100'
  },
  {
    id: 3,
    title: 'Track Progress',
    desc: 'Public status moves from Reported to Resolved in real-time.',
    icon: CheckCircle2,
    color: 'bg-success',
    textColor: 'text-success',
    lightBg: 'bg-emerald-50',
    borderGlow: 'border-emerald-400 shadow-emerald-100'
  }];


  return (
    <section id="home" className="relative pt-10 pb-20 md:py-24 bg-gradient-to-b from-white via-gray-50/50 to-white overflow-hidden">
      {/* Decorative blurred backgrounds */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-radial from-primary/5 via-transparent to-transparent -z-10 pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-72 h-72 rounded-full bg-red-500/5 blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 rounded-full bg-emerald-500/5 blur-3xl -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Text & Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="lg:col-span-6 text-center lg:text-left flex flex-col justify-center">
            
            {/* Small Badge */}
            <div className="inline-flex items-center gap-1.5 self-center lg:self-start bg-red-50 border border-red-100 rounded-full px-3 py-1 text-primary text-[10px] font-bold uppercase tracking-widest mb-6">
              <Sparkles className="h-3 w-3 animate-pulse" />
              AI Powered • Community Driven
            </div>

            {/* Main Headline */}
            <h1 className="font-display font-extrabold text-5xl sm:text-6xl lg:text-[70px] text-gray-900 leading-[0.95] tracking-tight mb-6">
              Snap it.<br />
              <span className="text-gray-400 font-extrabold">Let AI handle</span><br />
              the rest.
            </h1>

            {/* Description */}
            <p className="text-gray-500 text-lg sm:text-xl max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal mb-8">
              Report community issues in seconds using AI-powered detection, automated report generation, and transparent resolution tracking.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/report')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white font-bold text-base px-8 py-4 rounded-xl shadow-xl shadow-red-200 transition-all cursor-pointer">
                
                Report Issue Now
                <ArrowRight className="h-5 w-5" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsVideoOpen(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 font-bold text-base px-8 py-4 rounded-xl shadow-sm hover:bg-gray-50 transition-all cursor-pointer">
                
                <PlayCircle className="h-5 w-5 text-primary" />
                Watch Demo
              </motion.button>
            </div>

            {/* Small trust indicator */}
            <div className="mt-10 pt-8 border-t border-gray-100 flex items-center justify-center lg:justify-start gap-6">
              <div className="flex -space-x-2">
                <img className="w-8 h-8 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150" alt="user" referrerPolicy="no-referrer" />
                <img className="w-8 h-8 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=150" alt="user" referrerPolicy="no-referrer" />
                <img className="w-8 h-8 rounded-full border-2 border-white object-cover" src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=150" alt="user" referrerPolicy="no-referrer" />
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Joined by over <span className="font-bold text-gray-900">12,000+ citizens</span> in 15+ municipalities
              </p>
            </div>
          </motion.div>

          {/* Right Column: Mobile mockup & Step Cards */}
          <div className="lg:col-span-6 flex flex-col md:flex-row items-center justify-center gap-8 relative mt-10 lg:mt-0">
            
            {/* 1. Large Phone Mockup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative w-72 sm:w-80 h-[580px] bg-gray-900 rounded-[40px] p-3 shadow-2xl border-4 border-gray-800 shrink-0 select-none overflow-hidden">
              
              {/* Ear Speaker & Camera Island */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 h-5 w-28 bg-gray-950 rounded-full z-30 flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-gray-800 rounded-full mr-12" />
                <div className="w-1.5 h-1.5 bg-blue-900 rounded-full" />
              </div>

              {/* Screen Content Wrapper */}
              <div className="relative w-full h-full bg-slate-900 rounded-[30px] overflow-hidden flex flex-col">
                
                {/* Simulated App Header */}
                <div className="pt-8 pb-3 px-4 bg-white/10 backdrop-blur-md flex justify-between items-center z-10">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-display font-extrabold text-[11px] tracking-tight text-white">SnapFix AI</span>
                  </div>
                  <span className="text-[10px] bg-white/20 text-white rounded-full px-2 py-0.5">Live Feed</span>
                </div>

                {/* Simulated Pothole Image with scanning laser line */}
                <div className="relative flex-1 bg-slate-950 overflow-hidden flex items-center justify-center">
                  <img
                    src="https://media.istockphoto.com/id/929942316/photo/old-highway-with-holes-and-snow-landscape-road-potholes-in-cloudy-winter-weather-concept.jpg?s=612x612&w=0&k=20&c=ZtK8wJgXLQYEWGMJVGeyZBqVPKsdHMQlml1Vx8i17aw="
                    alt="Pothole AI Scan"
                    className="w-full h-full object-cover opacity-80"
                    referrerPolicy="no-referrer" />
                  

                  {/* Red AI bounding box */}
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0.5 }}
                    animate={{ scale: [0.95, 1.02, 0.95], opacity: [0.7, 1, 0.7] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-x-8 top-1/4 bottom-1/3 border-2 border-red-500 rounded-xl flex flex-col justify-between p-2 shadow-[0_0_15px_rgba(231,76,60,0.4)]">
                    
                    {/* Bounding box corners styling */}
                    <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-red-500 -mt-0.5 -ml-0.5" />
                    <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-red-500 -mt-0.5 -mr-0.5" />
                    <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-red-500 -mb-0.5 -ml-0.5" />
                    <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-red-500 -mb-0.5 -mr-0.5" />

                    <div className="bg-red-500/80 backdrop-blur-xs text-[10px] text-white font-bold px-1.5 py-0.5 rounded-sm self-start shadow-md">
                      Pothole Detected (94.2%)
                    </div>
                  </motion.div>

                  {/* AI Scanning laser animation */}
                  <motion.div
                    animate={{ top: ['20%', '80%', '20%'] }}
                    transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
                    className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_10px_#E74C3C]" />
                  

                  {/* Floating HUD Information panel */}
                  <div className="absolute bottom-4 left-3 right-3 bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl p-3 text-white text-[11px] shadow-xl">
                    <div className="flex justify-between font-bold mb-1 border-b border-white/5 pb-1">
                      <span>ANALYZING ASSET</span>
                      <span className="text-red-400">HIGH PRIORITY</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-300">
                      <div>
                        <p className="text-gray-500">CATEGORY</p>
                        <p className="font-semibold text-white">Road Hazard</p>
                      </div>
                      <div>
                        <p className="text-gray-500">SEVERITY</p>
                        <p className="font-semibold text-white">6.5/10 (Critical)</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-gray-500">AUTO-ROUTE CODE</p>
                        <p className="font-semibold text-white">Karve Road Pune</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Simulated App Footer Bar */}
                <div className="bg-white p-4 flex flex-col gap-2 border-t border-gray-100">
                  <div className="h-1.5 w-1/3 bg-gray-200 rounded-full" />
                  <div className="h-3 w-3/4 bg-gray-300 rounded-full" />
                  <div className="flex justify-between items-center mt-1">
                    <div className="flex gap-1">
                      <div className="h-5 w-5 rounded-full bg-gray-200" />
                      <div className="h-5 w-5 rounded-full bg-gray-200" />
                    </div>
                    <div className="h-6 w-16 bg-primary rounded-md" />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 2. Beside the phone: four stacked process cards with dotted workflow lines */}
            <div className="flex flex-col gap-4 w-full max-w-sm md:max-w-xs relative pl-2 md:pl-0">
              
              {/* Dotted Connecting Line in background */}
              <div className="absolute left-6 md:left-6 top-8 bottom-8 w-0.5 border-l-2 border-dashed border-gray-200 -z-10 pointer-events-none" />

              {steps.map((step, idx) => {
                const IconComponent = step.icon;
                const isActive = activeStep === step.id;
                const stepNumStr = `0${step.id + 1}`;

                return (
                  <motion.div
                    key={step.id}
                    onClick={() => setActiveStep(step.id)}
                    whileHover={{ scale: 1.03 }}
                    animate={{
                      scale: isActive ? 1.02 : 1
                    }}
                    className={`flex items-start gap-4 p-4 bg-white rounded-xl border-y border-r cursor-pointer transition-all shadow-md border-l-4 ${
                    step.id === 0 ? 'border-l-blue-500' :
                    step.id === 1 ? 'border-l-purple-500' :
                    step.id === 2 ? 'border-l-orange-500' :
                    'border-l-success'} ${

                    isActive ?
                    'shadow-lg bg-gray-50/30' :
                    'border-gray-100 hover:border-gray-200 hover:shadow-lg'}`
                    }>
                    
                    {/* Circle icon container */}
                    <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                    isActive ?
                    step.id === 0 ? 'bg-blue-500 text-white' :
                    step.id === 1 ? 'bg-purple-500 text-white' :
                    step.id === 2 ? 'bg-orange-500 text-white' :
                    'bg-success text-white' :
                    'bg-gray-50 text-gray-400'}`
                    }>
                      <IconComponent className="h-4 w-4" />
                    </div>

                    <div className="text-left flex-1">
                      <div className={`text-[10px] font-bold uppercase mb-0.5 tracking-wider ${
                      step.id === 0 ? 'text-blue-500' :
                      step.id === 1 ? 'text-purple-500' :
                      step.id === 2 ? 'text-orange-500' :
                      'text-success'}`
                      }>
                        Step {stepNumStr}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-display font-bold text-sm text-gray-900 leading-tight">
                          {step.title}
                        </h4>
                        {isActive &&
                        <span className={`inline-flex h-2 w-2 rounded-full ${
                        step.id === 0 ? 'bg-blue-500' :
                        step.id === 1 ? 'bg-purple-500' :
                        step.id === 2 ? 'bg-orange-500' :
                        'bg-success'}`
                        } />
                        }
                      </div>
                      <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </motion.div>);

              })}
            </div>

          </div>

        </div>
      </div>

      {/* Video Modal Demo simulation */}
      {isVideoOpen &&
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-md">
          <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-2xl w-full">
          
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-display font-bold text-gray-800 text-base">SnapFix AI System Walkthrough</h3>
              <button
              onClick={() => setIsVideoOpen(false)}
              className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-full transition-colors">
              
                ✕
              </button>
            </div>
            <div className="relative aspect-video bg-black flex items-center justify-center p-8 text-center text-white">
              <div className="absolute inset-0 bg-cover bg-center opacity-60" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&q=80&w=800')" }} />
              <div className="relative z-10 max-w-md">
                <div className="bg-primary hover:bg-primary-hover text-white h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg cursor-pointer">
                  <Play className="h-6 w-6 ml-1 fill-white" />
                </div>
                <p className="font-bold text-lg leading-snug">Simulating Interactive Video Demo</p>
                <p className="text-sm text-gray-200 mt-2">
                  In a real deployment, this would load our detailed product video showing how computer vision automates civic maintenance ticketing.
                </p>
                <button
                onClick={() => setIsVideoOpen(false)}
                className="mt-6 bg-white text-gray-900 font-bold text-xs px-5 py-2.5 rounded-full shadow-sm hover:bg-gray-50">
                
                  Close Walkthrough
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      }
    </section>);

}