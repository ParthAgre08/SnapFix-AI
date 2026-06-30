import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { useApp } from '../context/AppContext';
import { Upload, MapPin, Sparkles, CheckCircle2, ChevronRight, ChevronLeft, Compass, ArrowLeft, Search, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet marker icon issue in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom Map component to handle clicks
function MapEvents({ setLocation, setSelectedAddress }) {
  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      setLocation({ lat, lng });
      // Reverse geocoding
      try {
        const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        if (response.data && response.data.display_name) {
          setSelectedAddress(response.data.display_name);
        }
      } catch (err) {
        console.error("Reverse geocoding failed", err);
      }
    }
  });
  return null;
}

export default function Report() {
  const { user } = useApp();
  const navigate = useNavigate();

  const [reportStep, setReportStep] = useState(1);
  const [customImageFile, setCustomImageFile] = useState(null);
  const [rawFile, setRawFile] = useState(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiAnalysisComplete, setAiAnalysisComplete] = useState(false);

  const [detectedCategory, setDetectedCategory] = useState('');
  const [detectedSeverity, setDetectedSeverity] = useState('');
  const [confidenceScore, setConfidenceScore] = useState(0);

  const [issueTitle, setIssueTitle] = useState('');
  const [issueDesc, setIssueDesc] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  
  const [annotatedImage, setAnnotatedImage] = useState('');
  const [detectionCount, setDetectionCount] = useState(0);
  const [detections, setDetections] = useState([]);
  
  // Location defaults to Pune
  const [location, setLocation] = useState({ lat: 18.5204, lng: 73.8567 });
  const [selectedAddress, setSelectedAddress] = useState('Pune, Maharashtra');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState('');
  
  const [duplicateCheck, setDuplicateCheck] = useState({ checking: false, checked: false, isDuplicate: false, status: '' });

  // Reset duplicate check if location or description changes
  useEffect(() => {
    setDuplicateCheck({ checking: false, checked: false, isDuplicate: false, status: '' });
  }, [location, issueDesc]);

  // Check for duplicate when entering Step 3
  useEffect(() => {
    if (reportStep === 3 && !duplicateCheck.checked && !duplicateCheck.checking && issueDesc) {
      const checkDuplicate = async () => {
        setDuplicateCheck(prev => ({ ...prev, checking: true }));
        try {
          const response = await axios.post('http://127.0.0.1:5000/check-duplicate', {
            latitude: location.lat,
            longitude: location.lng,
            description: issueDesc
          });
          
          if (response.data.success) {
            setDuplicateCheck({
              checking: false,
              checked: true,
              isDuplicate: response.data.isDuplicate,
              status: response.data.existingStatus
            });
          } else {
            setDuplicateCheck(prev => ({ ...prev, checking: false, checked: true }));
          }
        } catch (err) {
          console.error("Duplicate check failed", err);
          setDuplicateCheck(prev => ({ ...prev, checking: false, checked: true }));
        }
      };
      checkDuplicate();
    }
  }, [reportStep, location, issueDesc, duplicateCheck.checked, duplicateCheck.checking]);

  // Get current location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLocation({ lat, lng });
          
          try {
            const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            if (response.data && response.data.display_name) {
              setSelectedAddress(response.data.display_name);
            }
          } catch (err) {
            console.error("Reverse geocoding failed", err);
          }
        },
        (error) => console.log(error)
      );
    }
  }, []);

  const handleFileUpload = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setRawFile(file);
      
      // Preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomImageFile(reader.result);
      };
      reader.readAsDataURL(file);

      // Analyze
      setAiAnalyzing(true);
      setAiAnalysisComplete(false);
      
      try {
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await axios.post('http://127.0.0.1:5000/analyze-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        if (response.data.success) {
          const conf = response.data.confidence;
          setDetectedCategory(response.data.issueType);
          
          // Calculate severity based on confidence
          let calculatedSeverity = 'Low';
          if (conf >= 95) calculatedSeverity = 'High';
          else if (conf >= 85) calculatedSeverity = 'Medium';
          else if (conf >= 70) calculatedSeverity = 'Low';
          else calculatedSeverity = 'Review Required';
          
          setDetectedSeverity(calculatedSeverity);
          setConfidenceScore(conf);
          setIssueTitle(response.data.title);
          setIssueDesc(response.data.description);
          setAnnotatedImage(response.data.annotatedImage || '');
          setDetectionCount(response.data.detectionCount || 0);
          setDetections(response.data.detections || []);
        }
      } catch (error) {
        console.error("Image analysis failed", error);
        // Fallback for development
        setDetectedCategory('Other');
        setDetectedSeverity('Medium');
        setConfidenceScore(85);
        setIssueTitle('Reported Issue');
        setIssueDesc('User uploaded an image.');
      } finally {
        setAiAnalyzing(false);
        setAiAnalysisComplete(true);
      }
    }
  };

  const handleSearchLocation = async () => {
    if (!searchQuery) return;
    try {
      const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}`);
      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        setLocation({ lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
        setSelectedAddress(result.display_name);
      }
    } catch (err) {
      console.error("Location search failed", err);
    }
  };

  const handleFormSubmit = async () => {
    if (!rawFile || !user) return;
    setIsSubmitting(true);
    setDuplicateMessage('');
    
    try {
      console.log("Preparing form data...");
      const formData = new FormData();
      formData.append('image', rawFile);
      formData.append('title', issueTitle);
      formData.append('description', issueDesc);
      formData.append('additionalNotes', additionalNotes);
      formData.append('latitude', location.lat);
      formData.append('longitude', location.lng);
      formData.append('address', selectedAddress);
      formData.append('userId', user.id);
      formData.append('userEmail', user.email);
      formData.append('issueType', detectedCategory);
      formData.append('severity', detectedSeverity);
      if (annotatedImage) formData.append('annotatedImage', annotatedImage);
      formData.append('detectionCount', detectionCount);
      formData.append('detections', JSON.stringify(detections));

      console.log("Sending issue details to backend...");
      const response = await axios.post('http://127.0.0.1:5000/submit-issue', formData, {
          headers: {
              "Content-Type": "multipart/form-data"
          }
      });
      
      if (response.data.success) {
        if (response.data.isDuplicate) {
          setDuplicateMessage(response.data.message);
        }
        setSubmitSuccess(true);
        setTimeout(() => {
          navigate('/profile');
        }, 4000);
      }
    } catch (error) {
      console.error("Failed to submit issue", error);
      alert("Error submitting issue. Error: " + (error.response?.data?.message || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { number: 1, title: 'Visual Ingestion', desc: 'Upload issue photo' },
    { number: 2, title: 'Geospatial Tagging', desc: 'Pin location on map' },
    { number: 3, title: 'Finalize Dispatch', desc: 'Confirm & dispatch logs' }
  ];

  // Success view
  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl p-8 text-center max-w-md w-full shadow-[0_15px_50px_-15px_rgba(0,0,0,0.1)] border border-slate-100"
        >
          <div className="w-20 h-20 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xs animate-bounce">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <h2 className="text-xl font-display font-extrabold text-slate-900 mb-2">Report Transmitted</h2>
          {duplicateMessage ? (
            <p className="text-xs text-slate-500 mb-6 bg-amber-50/50 p-4 rounded-2xl border border-amber-100/50 leading-relaxed font-medium">
              {duplicateMessage}
            </p>
          ) : (
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Your civic ticket has been successfully registered. Municipal field response crews have been dispatched.
            </p>
          )}
          
          <div className="space-y-3">
            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-success to-emerald-400 rounded-full w-full animate-[progress_4s_linear]" />
            </div>
            <p className="text-[10px] text-slate-400 font-bold tracking-wide uppercase">Redirecting to profile desk...</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 md:p-8 pt-24">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl overflow-hidden shadow-[0_10px_40px_-15px_rgba(0,0,0,0.08)] max-w-5xl w-full border border-slate-100 flex flex-col md:flex-row min-h-[620px] transition-all"
      >
        
        {/* Left Panel: Sidebar Progress & HUD */}
        <div className="w-full md:w-80 bg-slate-900 text-slate-100 p-8 flex flex-col justify-between shrink-0 border-r border-slate-800 relative overflow-hidden">
          {/* Subtle decorative glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          
          <div>
            {/* Header / Brand */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 text-primary rounded-xl border border-primary/20">
                <Sparkles className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-white text-sm tracking-tight">SnapFix AI</h3>
                <p className="text-[10px] text-slate-400">Civic Dispatch Portal</p>
              </div>
            </div>

            {/* Steps Visual Tracker */}
            <div className="relative pl-2 space-y-8 my-10">
              {/* Vertical line connector */}
              <div className="absolute left-[21px] top-2 bottom-2 w-[1px] bg-slate-800" />
              
              {steps.map((s) => {
                const isActive = reportStep === s.number;
                const isCompleted = reportStep > s.number;
                
                return (
                  <div key={s.number} className="relative flex items-start gap-4 transition-all duration-300">
                    {/* Circle icon */}
                    <div 
                      className={`z-10 w-7 h-7 rounded-full flex items-center justify-center border font-display text-xs font-bold transition-all duration-300 ${
                        isCompleted 
                          ? 'bg-success border-success text-white shadow-[0_0_12px_rgba(46,204,113,0.3)]' 
                          : isActive 
                            ? 'bg-primary border-primary text-white shadow-[0_0_12px_rgba(231,76,60,0.4)] scale-110' 
                            : 'bg-slate-950 border-slate-800 text-slate-500'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : s.number}
                    </div>
                    <div className="min-w-0">
                      <h4 className={`text-xs font-bold leading-none ${isActive ? 'text-white' : isCompleted ? 'text-slate-300' : 'text-slate-500'}`}>
                        {s.title}
                      </h4>
                      <p className="text-[9px] text-slate-500 mt-1 truncate">{s.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Telemetry HUD */}
          {(customImageFile || selectedAddress || detectedCategory) && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Report Telemetry</span>
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
              </div>
              
              {customImageFile && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-800 shrink-0 bg-slate-900">
                    <img src={customImageFile} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold text-slate-300 truncate">Image Loaded</p>
                    {detectedCategory ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] font-bold text-white px-1.5 py-0.5 bg-slate-800 rounded">
                          {detectedCategory}
                        </span>
                        {confidenceScore > 0 && (
                          <span className="text-[9px] text-emerald-400 font-bold">{confidenceScore}%</span>
                        )}
                      </div>
                    ) : (
                      <p className="text-[9px] text-slate-500">Processing bytes...</p>
                    )}
                  </div>
                </div>
              )}
              
              {reportStep >= 2 && selectedAddress && (
                <div className="space-y-1 pt-1">
                  <p className="text-[9px] font-bold text-slate-300 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-primary shrink-0" /> Geo-Coordinates
                  </p>
                  <p className="text-[9px] text-slate-500 truncate leading-tight pl-4">
                    {selectedAddress}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Right Panel: Workspace */}
        <div className="flex-1 p-6 md:p-8 flex flex-col justify-between bg-slate-50/20">
          
          {/* Workspace Header */}
          <div className="pb-6 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-display font-extrabold text-slate-900 text-base">
                {reportStep === 1 && 'Ingest Visual Evidence'}
                {reportStep === 2 && 'Geo-Locate Incident'}
                {reportStep === 3 && 'Submit Dispatch Order'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {reportStep === 1 && 'Upload photo evidence to initiate real-time AI scanning.'}
                {reportStep === 2 && 'Point or click on the responsive map to lock coordinates.'}
                {reportStep === 3 && 'Review diagnostic logs and dispatch reports to authorities.'}
              </p>
            </div>
            <button 
              onClick={() => navigate('/')}
              className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-50 transition-all cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          </div>

          {/* Active step workspace wrapper */}
          <div className="py-6 flex-1 flex flex-col justify-center min-h-0">
            
            {/* STEP 1 WORKSPACE */}
            {reportStep === 1 && (
              <div className="space-y-6">
                <div className={`relative border-2 border-dashed rounded-3xl p-6 text-center transition-all duration-300 ${
                  customImageFile 
                    ? 'border-emerald-200 bg-emerald-50/10' 
                    : 'border-slate-200 hover:border-primary/50 bg-slate-50/50 hover:bg-white hover:shadow-[0_8px_30px_rgb(0,0,0,0.03)]'
                } h-64 flex flex-col items-center justify-center group overflow-hidden`}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full" 
                  />
                  
                  {customImageFile ? (
                    <>
                      <img src={customImageFile} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-102" />
                      <div className="absolute bottom-4 left-4 right-4 bg-slate-950/80 backdrop-blur-md border border-white/10 rounded-2xl p-3 flex items-center justify-between text-white">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                          <span className="text-[10px] font-bold tracking-wide uppercase">Evidence Loaded</span>
                        </div>
                        <span className="text-[9px] text-slate-400">Click to replace file</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center max-w-sm">
                      <div className="p-4 bg-white rounded-2xl shadow-xs border border-slate-100 mb-3 group-hover:scale-110 transition-transform duration-300">
                        <Upload className="h-7 w-7 text-primary" />
                      </div>
                      <p className="text-sm font-bold text-slate-800 font-display">Ingest Photo Evidence</p>
                      <p className="text-xs text-slate-400 mt-1">Drag file here or click to browse local storage</p>
                      <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-md mt-4">
                        PNG, JPG, WEBP up to 10MB
                      </span>
                    </div>
                  )}
                </div>

                {aiAnalyzing && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-slate-950 border border-slate-850 rounded-3xl p-5 text-white flex items-center gap-4 shadow-xl overflow-hidden relative"
                  >
                    <div className="absolute inset-0 bg-radial-gradient from-primary/10 to-transparent pointer-events-none" />
                    <div className="p-3 bg-primary/10 text-primary rounded-2xl animate-pulse">
                      <Compass className="h-6 w-6 animate-spin" />
                    </div>
                    <div className="flex-1 text-xs">
                      <div className="flex items-center justify-between">
                        <p className="font-bold tracking-wide">YOLO Engine Inference</p>
                        <span className="text-[9px] font-bold text-primary animate-pulse uppercase">Active</span>
                      </div>
                      <p className="text-slate-400 text-[10px] mt-1">Extracting tensor features & calculating coordinates...</p>
                      <div className="w-full h-1 bg-slate-800 rounded-full mt-3 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary to-rose-400 rounded-full w-2/3 animate-[shimmer_1.5s_infinite]" />
                      </div>
                    </div>
                  </motion.div>
                )}

                {aiAnalysisComplete && !aiAnalyzing && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-emerald-50/40 border border-emerald-100/60 rounded-3xl p-5 text-emerald-950 text-xs shadow-xs"
                  >
                    <div className="flex gap-4 items-start">
                      <div className="p-2.5 bg-emerald-100/60 text-success rounded-2xl h-11 w-11 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div className="flex-grow space-y-1 min-w-0">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <p className="font-display font-extrabold text-emerald-900 text-xs tracking-tight">
                            AI Diagnostic Engine Report
                          </p>
                          <span className="bg-emerald-100/80 text-success text-[10px] font-extrabold px-3 py-0.5 rounded-full border border-emerald-200/50">
                            Confidence: {confidenceScore}%
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-emerald-100/50 text-[11px]">
                          <div className="bg-white/60 p-3 rounded-2xl border border-emerald-100/30">
                            <span className="text-[9px] uppercase font-bold text-emerald-800/60 tracking-wider block mb-1">Classified Defect</span>
                            <span className="font-display font-bold text-emerald-900 text-xs truncate block">{detectedCategory}</span>
                          </div>
                          
                          <div className="bg-white/60 p-3 rounded-2xl border border-emerald-100/30">
                            <span className="text-[9px] uppercase font-bold text-emerald-800/60 tracking-wider block mb-1">Estimated Severity</span>
                            <span className={`font-display font-extrabold text-xs block ${
                              confidenceScore >= 95 
                                ? 'text-rose-600' 
                                : confidenceScore >= 85 
                                  ? 'text-amber-600' 
                                  : confidenceScore >= 70 
                                    ? 'text-emerald-700' 
                                    : 'text-slate-600'
                            }`}>
                              {confidenceScore >= 95
                                ? 'HIGH PRIORITY'
                                : confidenceScore >= 85
                                ? 'MEDIUM PRIORITY'
                                : confidenceScore >= 70
                                ? 'LOW PRIORITY'
                                : 'REVIEW REQUIRED'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* STEP 2 WORKSPACE */}
            {reportStep === 2 && (
              <div className="space-y-4">
                <div className="relative rounded-3xl overflow-hidden border border-slate-100 shadow-xs z-0 flex-1">
                  <div className="absolute top-4 left-4 right-4 z-10 flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search coordinates or addresses..."
                        className="w-full bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-xs focus:outline-hidden focus:border-primary/50 shadow-md font-medium text-slate-800 placeholder:text-slate-400"
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchLocation()}
                      />
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    </div>
                    <button 
                      onClick={handleSearchLocation} 
                      className="bg-primary hover:bg-primary-hover text-white p-3 rounded-2xl shadow-md cursor-pointer hover:scale-102 transition-all"
                    >
                      <Search className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="h-64 w-full bg-slate-100">
                    <MapContainer center={[location.lat, location.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Marker position={[location.lat, location.lng]} />
                      <MapEvents setLocation={setLocation} setSelectedAddress={setSelectedAddress} />
                    </MapContainer>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-3xl p-4 flex gap-4">
                  <div className="p-2.5 bg-white text-primary rounded-xl shrink-0 h-10 w-10 flex items-center justify-center shadow-xs border border-slate-100">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="text-xs text-left min-w-0">
                    <p className="font-bold text-slate-800">Pinplaced Location Telemetry</p>
                    <p className="text-slate-500 mt-1 font-medium truncate leading-tight">{selectedAddress}</p>
                    <div className="flex gap-3 mt-2 text-[9px] font-mono text-slate-400">
                      <span>LAT: {location.lat.toFixed(6)}</span>
                      <span>LNG: {location.lng.toFixed(6)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 WORKSPACE */}
            {reportStep === 3 && (
              <div className="space-y-6">
                
                <div className="space-y-4">
                  {/* Duplicate Check Card */}
                  {duplicateCheck.checking && (
                    <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-5 text-blue-900 text-xs flex gap-4 animate-pulse">
                      <div className="p-2.5 bg-blue-100/80 text-blue-600 rounded-2xl h-10 w-10 flex items-center justify-center shrink-0">
                        <Compass className="h-5 w-5 animate-spin" />
                      </div>
                      <div className="flex-grow space-y-1">
                        <p className="font-bold text-blue-800 text-sm">Scanning Similarity Database...</p>
                        <p className="text-blue-600/80 leading-relaxed">Analyzing coordinates and descriptions to rule out duplicate tickets.</p>
                      </div>
                    </div>
                  )}

                  {duplicateCheck.checked && !duplicateCheck.checking && (
                    duplicateCheck.isDuplicate ? (
                      <div className="bg-amber-50/60 border border-amber-200/80 rounded-3xl p-5 text-amber-950 text-xs flex gap-4 shadow-xs">
                        <div className="p-2.5 bg-amber-100 text-amber-600 rounded-2xl h-10 w-10 flex items-center justify-center shrink-0">
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div className="flex-grow space-y-1">
                          <p className="font-display font-extrabold text-amber-800 text-sm">
                            Duplicate Complaint Detected
                          </p>
                          <p className="text-amber-700/90 leading-relaxed font-medium mt-1">
                            A similar issue has already been reported nearby. You can view the existing complaint instead of creating a new one.
                          </p>
                          {duplicateCheck.status && (
                            <div className="mt-3 pt-3 border-t border-amber-200/50 flex items-center gap-2">
                              <span className="font-bold text-amber-800">Existing Status:</span>
                              <span className="font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md text-[10px] uppercase">{duplicateCheck.status}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-3xl p-5 text-emerald-950 text-xs flex gap-4 shadow-xs">
                        <div className="p-2.5 bg-emerald-100 text-success rounded-2xl h-10 w-10 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div className="flex-grow space-y-1">
                          <p className="font-display font-extrabold text-emerald-800 text-sm">
                            Unique Complaint Verification
                          </p>
                          <p className="text-emerald-700/90 font-medium leading-relaxed mt-1">
                            This is a new civic issue and will be submitted to the municipal department.
                          </p>
                        </div>
                      </div>
                    )
                  )}

                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-slate-700">Citizen Observations & Notes (Optional)</label>
                    <p className="text-[10px] text-slate-400">Add any extra details or reference landmarks that might help the response crew.</p>
                    <textarea
                      rows={4}
                      placeholder="e.g. The water leakage is near the public bench, causing a major slippery spot..."
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 rounded-2xl py-3 px-4 text-xs focus:outline-hidden text-slate-800 shadow-xs transition-all placeholder:text-slate-400 leading-relaxed resize-none" 
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Workspace Footer Navigation */}
          <div className="pt-6 border-t border-slate-100 flex justify-between items-center shrink-0">
            {reportStep > 1 ? (
              <button
                type="button"
                onClick={() => setReportStep((prev) => prev - 1)}
                className="flex items-center gap-1.5 text-xs text-slate-500 font-bold hover:text-slate-800 py-3 px-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 shadow-xs cursor-pointer hover:scale-[1.02] active:scale-95 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            {reportStep < 3 ? (
              <button
                type="button"
                disabled={!customImageFile || aiAnalyzing}
                onClick={() => setReportStep((prev) => prev + 1)}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs px-5 py-3 rounded-2xl shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFormSubmit}
                disabled={!issueTitle.trim() || !issueDesc.trim() || isSubmitting || duplicateCheck.checking}
                className="flex items-center gap-1.5 bg-success hover:bg-success-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs px-6 py-3 rounded-2xl shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <Compass className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {isSubmitting ? 'Submitting...' : 'Submit Dispatch Report'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
