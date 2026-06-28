import React from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import HowItWorks from '../components/HowItWorks';
import Stats from '../components/Stats';
import CommunityFeed from '../components/CommunityFeed';
import AIFeatures from '../components/AIFeatures';
import CTA from '../components/CTA';
import Footer from '../components/Footer';

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-white">
      {/* 1. NAVBAR */}
      <Navbar />

      {/* 2. HERO SECTION */}
      <Hero />

      {/* 3. HOW IT WORKS SECTION */}
      <HowItWorks />

      {/* 4. STATS SECTION */}
      <Stats />

      {/* 5. COMMUNITY FEED PREVIEW */}
      <CommunityFeed />

      {/* 6. AI FEATURES SECTION */}
      <AIFeatures />

      {/* 7. CTA SECTION */}
      <CTA />

      {/* 8. FOOTER */}
      <Footer />
    </div>);

}