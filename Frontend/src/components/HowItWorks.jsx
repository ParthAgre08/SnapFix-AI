import React from 'react';
import { motion } from 'motion/react';
import { Camera, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

export default function HowItWorks() {
  const steps = [
  {
    number: '01',
    title: 'Snap',
    description: 'Take a quick photo of a pothole, broken streetlight, garbage overflow, or any civic issue right from your phone.',
    icon: Camera,
    color: 'text-primary',
    bgColor: 'bg-red-50',
    borderColor: 'group-hover:border-primary/20',
    shadowColor: 'hover:shadow-primary/5',
    accentColor: 'bg-primary'
  },
  {
    number: '02',
    title: 'AI Analyze',
    description: 'Gemini AI automatically detects the issue class, predicts severity, records GPS, and routes a ticket to the correct municipal department.',
    icon: Sparkles,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    borderColor: 'group-hover:border-purple-200',
    shadowColor: 'hover:shadow-purple-500/5',
    accentColor: 'bg-purple-500'
  },
  {
    number: '03',
    title: 'Fix',
    description: 'The assigned authorities inspect and resolve the issue. Real-time progress is published publicly to the feed and interactive map.',
    icon: CheckCircle2,
    color: 'text-success',
    bgColor: 'bg-emerald-50',
    borderColor: 'group-hover:border-success/20',
    shadowColor: 'hover:shadow-success/5',
    accentColor: 'bg-success'
  }];


  return (
    <section id="how-it-works" className="py-20 bg-sec-bg relative overflow-hidden">
      {/* Background embellishments */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/5 blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/5 blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-gray-900 tracking-tight">
            How It Works
          </h2>
          <div className="h-1 w-12 bg-primary mx-auto mt-4 rounded-full" />
          <p className="text-gray-500 mt-4 text-base sm:text-lg">
            Empowering citizens and municipal teams with a modern, high-speed, and automated infrastructure pipeline.
          </p>
        </div>

        {/* Step Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          
          {/* Connecting line for desktop in background */}
          <div className="hidden md:block absolute top-1/2 left-[15%] right-[15%] h-0.5 border-t border-dashed border-gray-300 -translate-y-12 -z-10" />

          {steps.map((step, idx) => {
            const IconComponent = step.icon;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                whileHover={{ y: -8, scale: 1.01 }}
                className={`group bg-white rounded-3xl p-8 border border-gray-100 shadow-md ${step.shadowColor} transition-all duration-300 relative overflow-hidden flex flex-col justify-between`}>
                
                {/* Decorative index number */}
                <span className="absolute -top-6 -right-6 font-display font-extrabold text-8xl text-gray-50 opacity-80 select-none group-hover:text-gray-100 transition-colors">
                  {step.number}
                </span>

                <div className="relative z-10">
                  {/* Icon container */}
                  <div className={`p-4 rounded-2xl w-14 h-14 flex items-center justify-center mb-6 transition-all duration-300 ${step.bgColor} shadow-inner`}>
                    <IconComponent className={`h-6 w-6 ${step.color} group-hover:scale-110 transition-transform`} />
                  </div>

                  {/* Title */}
                  <h3 className="font-display font-extrabold text-xl text-gray-900 group-hover:text-primary transition-colors">
                    {step.title}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-500 text-sm mt-3 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Progress bar line at card bottom */}
                <div className={`h-1 w-full absolute bottom-0 left-0 ${step.accentColor} scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300`} />
              </motion.div>);

          })}
        </div>
      </div>
    </section>);

}