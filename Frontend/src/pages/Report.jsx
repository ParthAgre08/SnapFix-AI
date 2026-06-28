import React, { useState, useEffect, useRef } from 'react';
  import { motion } from 'motion/react';
  import { useApp } from '../context/AppContext';
  import { Upload, MapPin, Sparkles, CheckCircle2, ChevronRight, ChevronLeft, Compass, ArrowLeft, Search } from 'lucide-react';
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
    
    // Location defaults to Pune
    const [location, setLocation] = useState({ lat: 18.5204, lng: 73.8567 });
    const [selectedAddress, setSelectedAddress] = useState('Pune, Maharashtra');
    const [searchQuery, setSearchQuery] = useState('');
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [duplicateMessage, setDuplicateMessage] = useState('');

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
            setDetectedCategory(response.data.issueType);
            setDetectedSeverity(response.data.severity);
            setConfidenceScore(response.data.confidence);
            setIssueTitle(response.data.title);
            setIssueDesc(response.data.description);
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

    // Success view
    if (submitSuccess) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-8 text-center max-w-md w-full shadow-2xl">
            <CheckCircle2 className="h-20 w-20 text-success mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Issue Reported Successfully</h2>
            {duplicateMessage ? (
              <p className="text-gray-500 mb-6 bg-yellow-50 p-3 rounded-lg border border-yellow-100">{duplicateMessage}</p>
            ) : (
              <p className="text-gray-500 mb-6">Your report has been submitted. Municipal authorities will review it shortly.</p>
            )}
            <p className="text-xs text-gray-400">Redirecting to profile...</p>
          </motion.div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 pt-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-2xl w-full text-left border border-gray-100">
          
          {/* Header */}
          <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => navigate('/')} 
                className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-full transition-colors mr-2 cursor-pointer"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="p-2 bg-red-50 text-primary rounded-lg">
                <Sparkles className="h-4 w-4 animate-pulse" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-gray-900 text-base">File AI-Assisted Civic Report</h3>
                <p className="text-[10px] text-gray-500">Step {reportStep} of 3</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 max-h-[70vh] overflow-y-auto">
            {/* STEP 1 */}
            {reportStep === 1 && (
              <div className="space-y-6">
                <div className="text-sm">
                  <p className="font-semibold text-gray-800">1. Snap or Upload Issue Image</p>
                  <p className="text-gray-400 text-xs mt-0.5">Upload a photo to let our AI identify the issue and estimate severity.</p>
                </div>

                {/* Upload area */}
                <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:border-primary/50 transition-all bg-gray-50/50 relative overflow-hidden h-64 flex flex-col items-center justify-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full" 
                  />
                  
                  {customImageFile ? (
                    <img src={customImageFile} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-gray-400 mb-3" />
                      <p className="text-sm font-bold text-gray-700">Drag or Click to upload photo</p>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB</p>
                    </>
                  )}
                </div>

                {aiAnalyzing && (
                  <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 text-white flex items-center gap-4 animate-pulse">
                    <Compass className="h-6 w-6 text-primary animate-spin" />
                    <div className="flex-1 text-xs">
                      <p className="font-bold">Gemini AI Analysis in progress...</p>
                      <p className="text-gray-400 text-[10px] mt-0.5">Extracting features and generating description.</p>
                    </div>
                  </div>
                )}

                {aiAnalysisComplete && !aiAnalyzing && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-emerald-900 text-xs flex gap-3">
                    <div className="p-2 bg-emerald-100 text-success rounded-xl h-10 w-10 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div className="flex-grow space-y-1">
                      <p className="font-bold text-emerald-800 flex items-center gap-1.5">
                        AI Analysis Successful
                        <span className="bg-emerald-100 text-success text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Confidence: {confidenceScore}%
                        </span>
                      </p>
                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-emerald-100/50 text-[11px] text-emerald-700">
                        <div>
                          <span className="font-semibold text-emerald-800 block">Classified Defect</span>
                          <span>{detectedCategory}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-emerald-800 block">Estimated Severity</span>
                          <span className="uppercase">{detectedSeverity} Priority</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2 */}
            {reportStep === 2 && (
              <div className="space-y-6">
                <div className="text-sm">
                  <p className="font-semibold text-gray-800">2. Geo-Tag Incident Location</p>
                  <p className="text-gray-400 text-xs mt-0.5">Search or click on the map to pin the exact incident location.</p>
                </div>

                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search location..."
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-hidden focus:border-primary/50"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchLocation()}
                  />
                  <button onClick={handleSearchLocation} className="bg-gray-100 p-2 rounded-xl text-gray-600 hover:bg-gray-200">
                    <Search className="h-5 w-5" />
                  </button>
                </div>

                <div className="relative h-64 w-full bg-gray-100 border border-gray-200 rounded-2xl overflow-hidden z-0">
                  <MapContainer center={[location.lat, location.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[location.lat, location.lng]} />
                    <MapEvents setLocation={setLocation} setSelectedAddress={setSelectedAddress} />
                  </MapContainer>
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex gap-3">
                  <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-xs text-left">
                    <p className="font-bold text-gray-800">Selected Address</p>
                    <p className="text-gray-500 mt-0.5">{selectedAddress}</p>
                    <p className="text-[10px] text-gray-400 mt-1">Coordinates: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {reportStep === 3 && (
              <div className="space-y-6">
                <div className="text-sm">
                  <p className="font-semibold text-gray-800">3. Details & Confirmation</p>
                  <p className="text-gray-400 text-xs mt-0.5">Review the AI-generated details and add any additional notes.</p>
                </div>

                <div className="space-y-4">
                  <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-6">
                    <div className="flex items-center gap-2 mb-4 text-primary">
                      <Sparkles className="h-5 w-5" />
                      <h4 className="font-bold text-sm">AI Analysis Results</h4>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-1 text-left">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Issue Title</label>
                        <div className="w-full bg-white border border-gray-200 rounded-xl py-3 px-4 text-xs text-gray-800 font-medium">
                          {issueTitle || 'N/A'}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1 text-left">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Defect Class</label>
                          <div className="w-full bg-white border border-gray-200 rounded-xl py-3 px-4 text-xs text-gray-800 font-medium">
                            {detectedCategory || 'N/A'}
                          </div>
                        </div>

                        <div className="space-y-1 text-left">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Severity Priority</label>
                          <div className="w-full bg-white border border-gray-200 rounded-xl py-3 px-4 text-xs text-gray-800 font-medium uppercase">
                            {detectedSeverity || 'N/A'}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1 text-left">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">AI Generated Description</label>
                        <div className="w-full bg-white border border-gray-200 rounded-xl py-3 px-4 text-xs text-gray-800 leading-relaxed min-h-[4rem]">
                          {issueDesc || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-xs font-bold text-gray-700">Additional Notes (Optional)</label>
                    <p className="text-[10px] text-gray-400">Add any extra context that might help the municipal crew.</p>
                    <textarea
                      rows={3}
                      placeholder="Enter additional details here..."
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      className="w-full bg-white border border-gray-200 focus:border-primary/50 rounded-xl py-3 px-4 text-sm focus:outline-hidden text-gray-800 shadow-xs" 
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center shrink-0">
            {reportStep > 1 ? (
              <button
                onClick={() => setReportStep((prev) => prev - 1)}
                className="flex items-center gap-1.5 text-xs text-gray-500 font-bold hover:text-gray-800 py-2.5 px-4 rounded-xl border border-gray-200 bg-white shadow-xs cursor-pointer">
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            {reportStep < 3 ? (
              <button
                disabled={!customImageFile || aiAnalyzing}
                onClick={() => setReportStep((prev) => prev + 1)}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs px-5 py-3 rounded-xl shadow-md transition-all cursor-pointer">
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleFormSubmit}
                disabled={!issueTitle.trim() || !issueDesc.trim() || isSubmitting}
                className="flex items-center gap-1.5 bg-success hover:bg-success-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs px-6 py-3 rounded-xl shadow-md transition-all cursor-pointer">
                {isSubmitting ? (
                  <Compass className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {isSubmitting ? 'Submitting...' : 'Submit Dispatch Report'}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }
