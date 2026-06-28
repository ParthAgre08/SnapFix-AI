import React, { useEffect, useState } from 'react';
import { motion, useInView } from 'motion/react';
import { FileHeart, ShieldCheck, Clock, Building2 } from 'lucide-react';







const CountUp = ({ end, suffix = '', duration = 1500 }) => {
  const [count, setCount] = useState(0);
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  useEffect(() => {
    if (!isInView) return;

    let start = 0;
    const increment = end / (duration / 16); // ~60fps
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [end, duration, isInView]);

  return <span ref={ref}>{count}{suffix}</span>;
};

export default function Stats() {
  const stats = [
  {
    label: 'Issues Reported',
    end: 540,
    suffix: '+',
    icon: FileHeart,
    color: 'bg-red-50 text-primary',
    borderColor: 'border-red-100'
  },
  {
    label: 'Resolution Rate',
    end: 85,
    suffix: '%',
    icon: ShieldCheck,
    color: 'bg-emerald-50 text-success',
    borderColor: 'border-emerald-100'
  },
  {
    label: 'Average Response',
    end: 24,
    suffix: 'h',
    icon: Clock,
    color: 'bg-blue-50 text-blue-500',
    borderColor: 'border-blue-100'
  },
  {
    label: 'Partner Communities',
    end: 18,
    suffix: '+',
    icon: Building2,
    color: 'bg-purple-50 text-purple-500',
    borderColor: 'border-purple-100'
  }];


  return (
    <section className="bg-white border-y border-gray-100 relative py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat, idx) => {
            const IconComponent = stat.icon;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className="flex flex-col items-center text-center p-4">
                
                {/* Icon Container */}
                <div className={`p-3.5 rounded-2xl ${stat.color} border ${stat.borderColor} shadow-xs mb-4 flex items-center justify-center`}>
                  <IconComponent className="h-6 w-6" />
                </div>

                {/* Counter */}
                <h3 className="font-display font-extrabold text-3xl sm:text-4xl text-gray-900 tracking-tight leading-tight">
                  <CountUp end={stat.end} suffix={stat.suffix} />
                </h3>

                {/* Label */}
                <p className="text-gray-500 font-semibold text-xs mt-1.5 uppercase tracking-wider">
                  {stat.label}
                </p>
              </motion.div>);

          })}
        </div>
      </div>
    </section>);

}