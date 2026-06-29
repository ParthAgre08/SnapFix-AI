import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import CommunityFeed from '../components/CommunityFeed';

export default function CommunityFeedPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <CommunityFeed isStandalonePage={true} readOnly={false} />
      </main>
      <Footer />
    </div>
  );
}
