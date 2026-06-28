import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider } from '../firebase';
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  signOut 
} from 'firebase/auth';
import axios from 'axios';

const AppContext = createContext(undefined);

const initialIssues = [
{
  id: '1',
  title: 'Severe Double Pothole on Active Lane',
  category: 'Pothole',
  description: 'Two massive, deep potholes have formed on the main northbound lane of Elm Street, right before the school crossing. Cars are forced to swerve dangerously into oncoming traffic to avoid them. Needs urgent patching before accidents happen.',
  status: 'In Progress',
  severity: 'High',
  image: 'https://media.istockphoto.com/id/172705966/photo/broken-gray-asphalt-pavement-with-pothole-puddle.jpg?s=612x612&w=0&k=20&c=hyQLOE5noc6i-rJYf42aBCVVUkNWWG7zs8kVXK_-Rzw=',
  location: 'Baner Road Pune',
  coordinates: { x: 35, y: 42 },
  timestamp: '2 hours ago',
  likes: 42,
  hasLiked: false,
  reporter: {
    name: 'Sarah Jenkins',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150'
  },
  comments: [
  {
    id: 'c1',
    author: 'Marcus Vance',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150',
    text: 'Blew out my tire here yesterday. Be extremely careful driving through this section at night!',
    timestamp: '1 hour ago'
  },
  {
    id: 'c2',
    author: 'Officer Tom Miller',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150',
    text: 'City maintenance crew has placed orange warning pylons around it. Scheduled repair crew is on their way.',
    timestamp: '30 mins ago'
  }],

  timeline: [
  { title: 'Issue Reported', description: 'Reported by Sarah Jenkins with high severity rating.', timestamp: '2 hours ago', status: 'completed' },
  { title: 'AI Classification', description: 'Pothole category validated. AI calculated priority index: 9.2/10. Routed to Public Works.', timestamp: '1.8 hours ago', status: 'completed' },
  { title: 'Work Order Dispatched', description: 'Assigned to Ward 4 Maintenance Crew. Crew and patching materials dispatched.', timestamp: '1 hour ago', status: 'completed' },
  { title: 'On-site Inspection', description: 'Warning pylons placed. Repair active.', timestamp: '30 mins ago', status: 'completed' },
  { title: 'Resolution Pending', description: 'Full asphalt infill and compaction.', timestamp: 'Estimated: Today 5 PM', status: 'upcoming' }]

},
{
  id: '2',
  title: 'Flickering Main Intersection Streetlight',
  category: 'Broken Street Light',
  description: 'The main overhead streetlight at the corner of Oak Avenue and 5th Street is completely dead or occasionally strobe-flickering. This makes the pedestrian crosswalk fully invisible at night, creating a critical safety hazard.',
  status: 'Resolved',
  severity: 'Medium',
  image: 'https://media.istockphoto.com/id/2213349592/photo/damaged-telephone-pole-and-fiber-optics.jpg?s=612x612&w=0&k=20&c=JO2zptrNsKTSuQ2ZacTofMW8_ZajvMoN9WSicpu79hg=',
  location: 'Koregaon Park Pune ',
  coordinates: { x: 62, y: 28 },
  timestamp: '1 day ago',
  likes: 18,
  hasLiked: false,
  reporter: {
    name: 'David Chen',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150'
  },
  comments: [
  {
    id: 'c3',
    author: 'Emily Watson',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=150',
    text: 'Thank you for reporting this! It was incredibly dark and scary walking back from the train station.',
    timestamp: '18 hours ago'
  },
  {
    id: 'c4',
    author: 'City Works Bot',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150',
    text: 'Crew #12 has replaced the standard bulb with an eco-friendly high-intensity LED light. Issue resolved.',
    timestamp: '4 hours ago'
  }],

  timeline: [
  { title: 'Issue Reported', description: 'Reported by David Chen via mobile upload.', timestamp: '1 day ago', status: 'completed' },
  { title: 'AI Classification', description: 'Recognized as Street Light. Dispatched to Grid Safety Division.', timestamp: '1 day ago', status: 'completed' },
  { title: 'Technician Dispatched', description: 'Crew scheduled for night repair.', timestamp: '12 hours ago', status: 'completed' },
  { title: 'Bulb Replaced', description: 'Replaced with energy efficient 120W LED fixture.', timestamp: '4 hours ago', status: 'completed' },
  { title: 'Issue Resolved', description: 'Quality inspection successful. Status closed.', timestamp: '4 hours ago', status: 'completed' }]

},
{
  id: '3',
  title: 'Major Commercial Trash Dumping in Alleyway',
  category: 'Garbage Overflow',
  description: 'An immense pile of discarded wooden shipping pallets, industrial packaging wrap, and construction debris has been illegally dumped blocking the back alleyway behind the central market. It is attracting rodents and completely blocking local delivery trucks.',
  status: 'Reported',
  severity: 'High',
  image: 'https://media.istockphoto.com/id/1489051648/photo/open-garbage-dust-bin-liter-with-plastic-begs-and-waste-items-at-day-from-different-angle.jpg?s=612x612&w=0&k=20&c=slEZ91id04_iQDJ0Q_z8-PHUST7DiOfkFjQ0gCn6L2U=',
  location: 'MG Road Pune',
  coordinates: { x: 48, y: 72 },
  timestamp: '3 hours ago',
  likes: 56,
  hasLiked: false,
  reporter: {
    name: 'Clara Oswald',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=150'
  },
  comments: [
  {
    id: 'c5',
    author: 'Bob Cooper',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=150',
    text: 'This blocks our bakery delivery door! We can\'t load our flour sacks. Hope they clear this soon.',
    timestamp: '2.5 hours ago'
  }],

  timeline: [
  { title: 'Issue Reported', description: 'Reported by Clara Oswald. Identified as Commercial Waste.', timestamp: '3 hours ago', status: 'completed' },
  { title: 'AI Verification', description: 'Automatic severity analysis: HIGH due to obstruction of active commercial alleyway.', timestamp: '2.8 hours ago', status: 'completed' },
  { title: 'Authority Notified', description: 'Sent to Sanitations Dispatch Center and Local Bylaw Enforcement.', timestamp: '2.5 hours ago', status: 'completed' },
  { title: 'Review In Progress', description: 'Awaiting scheduling of bulk haulage vehicle.', timestamp: 'Awaiting assignment', status: 'upcoming' }]

}];


export const AppProvider = ({ children }) => {
  const [issues, setIssues] = useState(initialIssues);
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  const [selectedIssueForDetail, setSelectedIssueForDetail] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userData = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'Anonymous Citizen',
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150'
          };
          
          // Sync with MySQL backend
          const response = await axios.post('http://127.0.0.1:5000/sync-user', userData);
          
          if (response.data.success) {
            setUser({
              ...userData,
              id: response.data.userId,
              createdAt: new Date().toISOString(),
              issuesReported: 0,
              issuesResolved: 0,
              issuesPending: 0,
              bio: "",
              location: ""
            });
          } else {
            console.error('Failed to sync user via API');
            setUser(null);
          }
        } catch (error) {
          console.error('Error syncing user', error);
          // Fallback user state in case backend is unreachable during dev
          setUser({
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'Anonymous Citizen',
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150',
            issuesReported: 0,
            issuesResolved: 0,
            issuesPending: 0
          });
        }
      } else {
        setUser(null);
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signupWithEmail = async (email, password, name) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const userData = {
      uid: userCredential.user.uid,
      name: name || 'Anonymous Citizen',
      email: userCredential.user.email,
      photoURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150'
    };
    
    try {
      const response = await axios.post('http://127.0.0.1:5000/sync-user', userData);
      setUser({
        ...userData,
        id: response.data.userId,
        createdAt: new Date().toISOString(),
        issuesReported: 0,
        issuesResolved: 0,
        issuesPending: 0,
        bio: "",
        location: ""
      });
    } catch (error) {
      console.error('Failed to sync new user', error);
    }
    
    return userCredential;
  };

  const loginWithGoogle = () => {
    return signInWithPopup(auth, googleProvider);
  };

  const logout = () => {
    return signOut(auth);
  };

  const reportIssue = (issueData) => {
    const newIssue = {
      ...issueData,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: 'Just now',
      likes: 0,
      hasLiked: false,
      comments: [],
      reporter: user ? { name: user.name, avatar: user.photoURL } : { name: 'Anonymous Citizen', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150' },
      timeline: [
      { title: 'Issue Reported', description: 'Logged into SnapFix network by citizen.', timestamp: 'Just now', status: 'completed' },
      { title: 'AI Classification', description: `Detected: ${issueData.category} (${issueData.severity} Severity). Auto-routing enabled.`, timestamp: 'Just now', status: 'completed' },
      { title: 'Authority Routing', description: 'Queued for delivery to corresponding local municipal team.', timestamp: 'Pending', status: 'upcoming' }]

    };

    setIssues((prevIssues) => [newIssue, ...prevIssues]);
    
    // In Phase 2, we would update the user's reported count in MySQL as well.
    if (user) {
      setUser((prev) => prev ? { ...prev, issuesReported: (prev.issuesReported || 0) + 1 } : null);
    }
  };

  const likeIssue = (issueId) => {
    setIssues((prevIssues) =>
    prevIssues.map((issue) => {
      if (issue.id === issueId) {
        const alreadyLiked = issue.hasLiked;
        return {
          ...issue,
          likes: alreadyLiked ? issue.likes - 1 : issue.likes + 1,
          hasLiked: !alreadyLiked
        };
      }
      return issue;
    })
    );
  };

  const addComment = (issueId, text) => {
    const newComment = {
      id: Math.random().toString(36).substr(2, 9),
      author: user ? user.name : 'Anonymous Citizen',
      avatar: user ? user.photoURL : 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150',
      text,
      timestamp: 'Just now'
    };

    setIssues((prevIssues) =>
    prevIssues.map((issue) => {
      if (issue.id === issueId) {
        return {
          ...issue,
          comments: [...issue.comments, newComment]
        };
      }
      return issue;
    })
    );
  };

  return (
    <AppContext.Provider
      value={{
        issues,
        user,
        loadingAuth,
        selectedIssueForDetail,
        setSelectedIssueForDetail,
        loginWithEmail,
        signupWithEmail,
        loginWithGoogle,
        logout,
        reportIssue,
        likeIssue,
        addComment
      }}>
      
      {children}
    </AppContext.Provider>);

};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};