import React, { useState, useEffect, useRef } from 'react';

// API Base URL (FastAPI)
const API_URL = 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('single'); // 'single', 'batch', 'analytics', 'history'
  const [modelStatus, setModelStatus] = useState('loading'); // 'loading', 'active', 'error'
  const [modelMeta, setModelMeta] = useState(null);
  
  // Mobile navigation state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // User/Session state
  const [username, setUsername] = useState('Mihir');

  // Single prediction states
  const [formInputs, setFormInputs] = useState({
    Age: 40,
    Income: 80000,
    LoanAmount: 50000,
    CreditScore: 680,
    MonthsEmployed: 48,
    NumCreditLines: 3,
    InterestRate: 10.5,
    LoanTerm: 36,
    DTIRatio: 0.35,
    Education: "Bachelor's",
    EmploymentType: "Full-time",
    MaritalStatus: "Married",
    HasMortgage: "No",
    HasDependents: "No",
    LoanPurpose: "Business",
    HasCoSigner: "No"
  });
  
  const [singleResult, setSingleResult] = useState(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleError, setSingleError] = useState(null);

  // Batch prediction states
  const [batchFile, setBatchFile] = useState(null);
  const [batchResult, setBatchResult] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [batchPage, setBatchPage] = useState(1);
  const [batchError, setBatchError] = useState(null);
  const fileInputRef = useRef(null);

  // Database History states
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState('All');
  const [historyPage, setHistoryPage] = useState(1);

  // Fetch model metadata on load
  useEffect(() => {
    fetchModelInfo();
  }, []);

  // Fetch database history when history tab is active or username changes
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, username]);

  const fetchModelInfo = async () => {
    setModelStatus('loading');
    try {
      const response = await fetch(`${API_URL}/model-info`);
      if (!response.ok) {
        throw new Error('Failed to retrieve model info');
      }
      const data = await response.json();
      setModelMeta(data);
      setModelStatus('active');
    } catch (err) {
      console.error(err);
      setModelStatus('error');
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await fetch(`${API_URL}/history?username=${username}`);
      if (!response.ok) {
        throw new Error('Failed to retrieve history logs');
      }
      const data = await response.json();
      setHistoryRecords(data);
      setHistoryPage(1);
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const deleteRecord = async (id) => {
    if (!window.confirm(`Are you sure you want to delete prediction record #${id}?`)) {
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/history/${id}?username=${username}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to delete database record');
      }
      // Remove from local state
      setHistoryRecords(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Load a historical applicant into the Single Predict form
  const loadHistoryRecord = (record) => {
    setFormInputs({
      Age: record.Age,
      Income: record.Income,
      LoanAmount: record.LoanAmount,
      CreditScore: record.CreditScore,
      MonthsEmployed: record.MonthsEmployed,
      NumCreditLines: record.NumCreditLines,
      InterestRate: record.InterestRate,
      LoanTerm: record.LoanTerm,
      DTIRatio: record.DTIRatio,
      Education: record.Education,
      EmploymentType: record.EmploymentType,
      MaritalStatus: record.MaritalStatus,
      HasMortgage: record.HasMortgage,
      HasDependents: record.HasDependents,
      LoanPurpose: record.LoanPurpose,
      HasCoSigner: record.HasCoSigner
    });
    
    setSingleResult({
      probability: record.probability,
      prediction: record.prediction,
      risk_category: record.risk_category,
      factors: [],
      recommendations: [`Loaded record #${record.id} created by ${record.username}. Click Evaluate to run fresh explanations.`]
    });
    
    setActiveTab('single');
  };

  // Form input handler
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormInputs(prev => ({
      ...prev,
      [name]: type === 'number' || type === 'range' ? parseFloat(value) : value
    }));
  };

  // Single prediction submit handler
  const handleSinglePredict = async (e) => {
    e.preventDefault();
    setSingleLoading(true);
    setSingleError(null);
    
    // Slight artificial delay for UX
    await new Promise(resolve => setTimeout(resolve, 800));

    const payload = {
      Username: username,
      ...formInputs
    };

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Prediction failed');
      }
      
      const data = await response.json();
      setSingleResult(data);
    } catch (err) {
      setSingleError(err.message);
    } finally {
      setSingleLoading(false);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv')) {
        setBatchFile(file);
        setBatchResult(null);
        setBatchError(null);
      } else {
        setBatchError('Please select a valid CSV file.');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setBatchFile(e.target.files[0]);
      setBatchResult(null);
      setBatchError(null);
    }
  };

  // Batch prediction submit
  const handleBatchPredict = async () => {
    if (!batchFile) return;
    setBatchLoading(true);
    setBatchError(null);
    
    const formData = new FormData();
    formData.append('file', batchFile);

    try {
      const response = await fetch(`${API_URL}/predict-batch`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Batch prediction failed');
      }
      
      const data = await response.json();
      setBatchResult(data);
      setBatchPage(1);
    } catch (err) {
      setBatchError(err.message);
    } finally {
      setBatchLoading(false);
    }
  };

  // Generate and download sample CSV
  const downloadSampleCSV = () => {
    const headers = "Age,Income,LoanAmount,CreditScore,MonthsEmployed,NumCreditLines,InterestRate,LoanTerm,DTIRatio,Education,EmploymentType,MaritalStatus,HasMortgage,HasDependents,LoanPurpose,HasCoSigner\n";
    const rows = [
      "45,95000,120000,740,84,2,6.5,36,0.22,Master's,Full-time,Married,Yes,No,Home,Yes",
      "28,42000,180000,520,12,5,18.5,48,0.65,High School,Self-employed,Single,No,Yes,Business,No",
      "35,65000,30000,680,36,1,8.0,24,0.18,Bachelor's,Full-time,Divorced,No,No,Auto,No",
      "52,110000,90000,810,110,3,4.2,60,0.30,PhD,Full-time,Married,Yes,Yes,Education,Yes",
      "21,28000,65000,430,6,4,22.0,36,0.52,High School,Unemployed,Single,Yes,No,Other,No"
    ].join("\n");
    
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'loan_applicants_sample.csv');
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Trigger file download
  const downloadResultsCSV = () => {
    if (!batchResult || !batchResult.full_results_csv) return;
    
    const blob = new Blob([batchResult.full_results_csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `predicted_loan_results_${batchFile.name}`);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Render Risk Gauge Calculations
  const getGaugeProps = (probability) => {
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (probability * circumference);
    
    let color = 'var(--color-success)';
    if (probability >= 0.15 && probability < 0.35) {
      color = 'var(--color-warning)';
    } else if (probability >= 0.35) {
      color = 'var(--color-danger)';
    }
    
    return { circumference, strokeDashoffset, stroke: color };
  };

  // Form Reset
  const resetForm = () => {
    setFormInputs({
      Age: 40,
      Income: 80000,
      LoanAmount: 50000,
      CreditScore: 680,
      MonthsEmployed: 48,
      NumCreditLines: 3,
      InterestRate: 10.5,
      LoanTerm: 36,
      DTIRatio: 0.35,
      Education: "Bachelor's",
      EmploymentType: "Full-time",
      MaritalStatus: "Married",
      HasMortgage: "No",
      HasDependents: "No",
      LoanPurpose: "Business",
      HasCoSigner: "No"
    });
    setSingleResult(null);
    setSingleError(null);
  };

  // Filter history records based on search query and risk rating
  const filteredHistory = historyRecords.filter(record => {
    const matchesSearch = record.id.toString().includes(historySearch) || 
                          record.LoanAmount.toString().includes(historySearch) ||
                          record.CreditScore.toString().includes(historySearch) ||
                          (record.username && record.username.toLowerCase().includes(historySearch.toLowerCase()));
    const matchesFilter = historyFilter === 'All' || record.risk_category === historyFilter;
    return matchesSearch && matchesFilter;
  });

  const isAdmin = username.toLowerCase() === 'admin';

  return (
    <div className="app-container">
      {/* Mobile Sticky Header (Hidden on Desktop) */}
      <div className="mobile-header">
        <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>
          ☰
        </button>
        <span className="brand-name" style={{ fontSize: '1.1rem' }}>RiskShield AI</span>
        <div style={{ width: '24px' }}></div> {/* Spacer */}
      </div>

      {/* Dark Blur Overlay (closes sidebar drawer on tap) */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>
      )}

      {/* Navigation Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand-section">
          <div className="brand-icon">L</div>
          <div className="brand-name">RiskShield AI</div>
        </div>

        {/* User Session Profile Card */}
        <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.4rem', fontWeight: 600 }}>
            Underwriter Profile
          </label>
          <input 
            type="text" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Type username..."
            style={{ width: '100%', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', padding: '0.4rem 0.6rem', fontSize: '0.85rem', outline: 'none' }}
          />
          {isAdmin && (
            <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 700, marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span>🔑</span> Admin Privileges Active
            </div>
          )}
        </div>
        
        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'single' ? 'active' : ''}`}
            onClick={() => { setActiveTab('single'); setSidebarOpen(false); }}
          >
            <span className="nav-icon">👤</span>
            Single Predict
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'batch' ? 'active' : ''}`}
            onClick={() => { setActiveTab('batch'); setSidebarOpen(false); }}
          >
            <span className="nav-icon">📁</span>
            Batch Upload
          </button>

          <button 
            className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => { setActiveTab('history'); setSidebarOpen(false); }}
          >
            <span className="nav-icon">💾</span>
            Database History
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => { setActiveTab('analytics'); setSidebarOpen(false); }}
          >
            <span className="nav-icon">📊</span>
            Model Analytics
          </button>
        </nav>
        
        <div className="sidebar-footer">
          {modelStatus === 'active' && (
            <div className="model-status-badge">
              <span className="model-status-dot"></span>
              API Online (RF V1)
            </div>
          )}
          {modelStatus === 'loading' && (
            <div className="model-status-badge" style={{ color: 'var(--text-secondary)', backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}>
              <span className="model-status-dot" style={{ backgroundColor: 'var(--text-muted)' }}></span>
              Connecting...
            </div>
          )}
          {modelStatus === 'error' && (
            <div className="model-status-badge" style={{ color: 'var(--color-danger)', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
              <span className="model-status-dot" style={{ backgroundColor: 'var(--color-danger)', boxShadow: '0 0 8px var(--color-danger)' }}></span>
              API Connection Offline
            </div>
          )}
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-content">
        
        {/* Tab 1: Single Prediction Tool */}
        {activeTab === 'single' && (
          <div className="tab-content">
            <header>
              <h1>Single Loan Risk Evaluator</h1>
              <p>Assess default probability and identify risk factors. Saves results under underwriter **{username}**.</p>
            </header>

            {modelStatus === 'error' && (
              <div className="error-banner">
                <span>⚠️</span>
                <div>
                  <strong>FastAPI Backend Server Offline.</strong> Please ensure the backend is running at <code>http://localhost:8000</code>.
                  <button onClick={fetchModelInfo} className="sample-csv-link" style={{ border: 'none', background: 'none', marginLeft: '10px' }}>[Retry Connection]</button>
                </div>
              </div>
            )}

            <div className="grid-2col">
              <div className="glass-card">
                <form onSubmit={handleSinglePredict}>
                  <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2><span>📝</span> Applicant Details</h2>
                    <button type="button" onClick={resetForm} className="sample-csv-link" style={{ background: 'none', border: 'none' }}>
                      Clear Form
                    </button>
                  </div>
                  
                  {/* Section 1: Demographics */}
                  <div className="form-section-title">👤 Borrower Demographics</div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label htmlFor="Age">
                        Age
                        <span className="value-bubble">{formInputs.Age} yrs</span>
                      </label>
                      <input 
                        type="range" 
                        id="Age"
                        name="Age" 
                        min="18" 
                        max="80" 
                        value={formInputs.Age} 
                        onChange={handleInputChange}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="Education">Education</label>
                      <select id="Education" name="Education" value={formInputs.Education} onChange={handleInputChange}>
                        <option value="High School">High School</option>
                        <option value="Bachelor's">Bachelor's</option>
                        <option value="Master's">Master's</option>
                        <option value="PhD">PhD</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="MaritalStatus">Marital Status</label>
                      <select id="MaritalStatus" name="MaritalStatus" value={formInputs.MaritalStatus} onChange={handleInputChange}>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="HasDependents">Dependents</label>
                      <select id="HasDependents" name="HasDependents" value={formInputs.HasDependents} onChange={handleInputChange}>
                        <option value="No">No Dependents</option>
                        <option value="Yes">Has Dependents</option>
                      </select>
                    </div>
                  </div>

                  {/* Section 2: Finances */}
                  <div className="form-section-title">💵 Financial Profile</div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label htmlFor="Income">
                        Annual Income
                        <span className="value-bubble">${formInputs.Income.toLocaleString()}</span>
                      </label>
                      <input 
                        type="range" 
                        id="Income"
                        name="Income" 
                        min="10000" 
                        max="180000" 
                        step="2500"
                        value={formInputs.Income} 
                        onChange={handleInputChange}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="EmploymentType">Employment Status</label>
                      <select id="EmploymentType" name="EmploymentType" value={formInputs.EmploymentType} onChange={handleInputChange}>
                        <option value="Full-time">Full-time</option>
                        <option value="Part-time">Part-time</option>
                        <option value="Self-employed">Self-employed</option>
                        <option value="Unemployed">Unemployed</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="MonthsEmployed">
                        Employment Length
                        <span className="value-bubble">{formInputs.MonthsEmployed} mo</span>
                      </label>
                      <input 
                        type="range" 
                        id="MonthsEmployed"
                        name="MonthsEmployed" 
                        min="0" 
                        max="120" 
                        value={formInputs.MonthsEmployed} 
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="HasMortgage">Mortgage</label>
                      <select id="HasMortgage" name="HasMortgage" value={formInputs.HasMortgage} onChange={handleInputChange}>
                        <option value="No">No Mortgage</option>
                        <option value="Yes">Has Mortgage</option>
                      </select>
                    </div>
                  </div>

                  {/* Section 3: Credit & Loan details */}
                  <div className="form-section-title">💳 Credit & Loan Details</div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label htmlFor="CreditScore">
                        Credit Score (FICO)
                        <span className="value-bubble">{formInputs.CreditScore}</span>
                      </label>
                      <input 
                        type="range" 
                        id="CreditScore"
                        name="CreditScore" 
                        min="300" 
                        max="850" 
                        value={formInputs.CreditScore} 
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="DTIRatio">
                        DTI Ratio
                        <span className="value-bubble">{(formInputs.DTIRatio * 100).toFixed(0)}%</span>
                      </label>
                      <input 
                        type="range" 
                        id="DTIRatio"
                        name="DTIRatio" 
                        min="0.10" 
                        max="0.90" 
                        step="0.01"
                        value={formInputs.DTIRatio} 
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="NumCreditLines">Credit Lines</label>
                      <input 
                        type="number" 
                        id="NumCreditLines"
                        name="NumCreditLines" 
                        min="1" 
                        max="10" 
                        value={formInputs.NumCreditLines} 
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="LoanAmount">
                        Loan Amount
                        <span className="value-bubble">${formInputs.LoanAmount.toLocaleString()}</span>
                      </label>
                      <input 
                        type="range" 
                        id="LoanAmount"
                        name="LoanAmount" 
                        min="5000" 
                        max="250000" 
                        step="5000"
                        value={formInputs.LoanAmount} 
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label htmlFor="InterestRate">
                        Interest Rate
                        <span className="value-bubble">{formInputs.InterestRate}%</span>
                      </label>
                      <input 
                        type="range" 
                        id="InterestRate"
                        name="InterestRate" 
                        min="2.0" 
                        max="25.0" 
                        step="0.1"
                        value={formInputs.InterestRate} 
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="LoanTerm">Term</label>
                      <select id="LoanTerm" name="LoanTerm" value={formInputs.LoanTerm} onChange={handleInputChange}>
                        <option value="12">12 Months</option>
                        <option value="24">24 Months</option>
                        <option value="36">36 Months</option>
                        <option value="48">48 Months</option>
                        <option value="60">60 Months</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="LoanPurpose">Purpose</label>
                      <select id="LoanPurpose" name="LoanPurpose" value={formInputs.LoanPurpose} onChange={handleInputChange}>
                        <option value="Auto">Auto</option>
                        <option value="Business">Business</option>
                        <option value="Education">Education</option>
                        <option value="Home">Home</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="HasCoSigner">Co-signer</label>
                      <select id="HasCoSigner" name="HasCoSigner" value={formInputs.HasCoSigner} onChange={handleInputChange}>
                        <option value="No">No Co-signer</option>
                        <option value="Yes">Co-signer Present</option>
                      </select>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ width: '100%', marginTop: '1rem' }}
                    disabled={singleLoading || modelStatus !== 'active'}
                  >
                    {singleLoading ? 'Running Model Analysis...' : 'Evaluate Default Risk'}
                  </button>
                </form>
              </div>

              <div className="glass-card results-card" style={{ justifyContent: singleLoading ? 'center' : 'flex-start' }}>
                <div className="glass-card-header" style={{ width: '100%', textAlign: 'left' }}>
                  <h2><span>🛡️</span> Risk Assessment</h2>
                </div>

                {singleLoading && (
                  <div className="scanning-container">
                    <div className="scanning-circle"></div>
                    <div className="scanning-text">Analyzing credit profile features...</div>
                  </div>
                )}

                {!singleLoading && !singleResult && !singleError && (
                  <div style={{ padding: '4rem 1.5rem', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>📈</div>
                    <h3>Ready for Evaluation</h3>
                    <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                      Adjust parameters on the left and click "Evaluate Default Risk" to view probability scores, risk bands, and explanatory drivers.
                    </p>
                  </div>
                )}

                {singleError && (
                  <div style={{ padding: '3rem 1rem', color: 'var(--color-danger)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>❌</div>
                    <h3>Analysis Failed</h3>
                    <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>{singleError}</p>
                  </div>
                )}

                {!singleLoading && singleResult && (
                  <>
                    <div className="gauge-container">
                      <svg className="gauge-svg" viewBox="0 0 200 200">
                        <circle className="gauge-bg" cx="100" cy="100" r="80" />
                        <circle 
                          className="gauge-fill" 
                          cx="100" 
                          cy="100" 
                          r="80"
                          style={{
                            strokeDasharray: getGaugeProps(singleResult.probability).circumference,
                            strokeDashoffset: getGaugeProps(singleResult.probability).strokeDashoffset,
                            stroke: getGaugeProps(singleResult.probability).stroke
                          }}
                        />
                      </svg>
                      <div className="gauge-text">
                        <span className="gauge-percentage">{(singleResult.probability * 100).toFixed(1)}%</span>
                        <span className="gauge-label">Default Risk</span>
                      </div>
                    </div>

                    <div className={`risk-pill risk-${singleResult.risk_category.toLowerCase()}`}>
                      {singleResult.risk_category} Risk Rating
                    </div>

                    {singleResult.db_id && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                        Saved to Credit Registry: <strong>Record #{singleResult.db_id}</strong> by <strong>{username}</strong>
                      </div>
                    )}

                    <div className="xai-title">Key Credit Drivers</div>
                    <div className="xai-factors-list">
                      {singleResult.factors && singleResult.factors.length > 0 ? (
                        singleResult.factors.map((factor, index) => (
                          <div 
                            key={index} 
                            className={`xai-factor-item factor-${factor.impact === 'increase' ? 'increase' : 'decrease'}`}
                          >
                            <span className="xai-factor-badge">
                              {factor.impact === 'increase' ? '+' : '-'}
                            </span>
                            <span className="xai-factor-text">{factor.reason}</span>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'left', padding: '0.5rem' }}>
                          Loaded history item. Adjust sliders on left and click Evaluate to run fresh explanations.
                        </div>
                      )}
                    </div>

                    <div className="advisor-card">
                      <div className="advisor-title"><span>💡</span> Actionable Recommendations</div>
                      <ul className="advisor-list">
                        {singleResult.recommendations && singleResult.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Batch Prediction / CSV Upload */}
        {activeTab === 'batch' && (
          <div className="tab-content">
            <header>
              <h1>Batch Loan Underwriting</h1>
              <p>Process bulk files of loan applicants. Submit a CSV to run model evaluation on multiple profiles instantly.</p>
            </header>

            <div className="glass-card" style={{ marginBottom: '2rem' }}>
              <div className="glass-card-header">
                <h2><span>📤</span> Upload Loan Application Batch</h2>
              </div>
              
              <div 
                className={`uploader-box ${dragActive ? 'dragover' : ''}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  accept=".csv" 
                  onChange={handleFileChange}
                />
                <div className="uploader-icon">📥</div>
                <div className="uploader-text">
                  <p>{batchFile ? `Selected: ${batchFile.name}` : "Drag and drop your loan CSV file here or click to browse"}</p>
                  <span>File must follow standard headers. Maximum size 10MB.</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button 
                  onClick={downloadSampleCSV} 
                  className="sample-csv-link"
                  style={{ border: 'none', background: 'none' }}
                >
                  📥 Download Sample CSV Template
                </button>

                <button
                  onClick={handleBatchPredict}
                  className="btn btn-primary"
                  disabled={!batchFile || batchLoading || modelStatus !== 'active'}
                >
                  {batchLoading ? 'Processing Batch Inference...' : 'Run Batch Analysis'}
                </button>
              </div>

              {batchError && (
                <div className="error-banner" style={{ marginTop: '1.5rem' }}>
                  <span>❌</span>
                  <div>{batchError}</div>
                </div>
              )}
            </div>

            {batchLoading && (
              <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 0' }}>
                <div className="scanning-container">
                  <div className="scanning-circle"></div>
                  <div className="scanning-text">Running parallel probability scores across batch dataset...</div>
                </div>
              </div>
            )}

            {!batchLoading && batchResult && (
              <div className="tab-content">
                <div className="summary-grid">
                  <div className="summary-card">
                    <span className="summary-card-title">Total Records</span>
                    <span className="summary-card-value">{batchResult.summary.total_records.toLocaleString()}</span>
                  </div>
                  
                  <div className="summary-card">
                    <span className="summary-card-title">Predicted Defaults</span>
                    <span className="summary-card-value summary-card-danger">{batchResult.summary.predicted_defaults.toLocaleString()}</span>
                  </div>

                  <div className="summary-card">
                    <span className="summary-card-title">Healthy Loans</span>
                    <span className="summary-card-value summary-card-success">{batchResult.summary.predicted_non_defaults.toLocaleString()}</span>
                  </div>

                  <div className="summary-card">
                    <span className="summary-card-title">Predicted Default Rate</span>
                    <span className="summary-card-value summary-card-accent">{(batchResult.summary.default_rate * 100).toFixed(2)}%</span>
                  </div>
                </div>

                <div className="glass-card">
                  <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2><span>📋</span> Batch Preview (First 100 rows)</h2>
                    <button onClick={downloadResultsCSV} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
                      💾 Export Full Scored CSV
                    </button>
                  </div>
                  
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Application ID</th>
                          <th>Age</th>
                          <th>Annual Income</th>
                          <th>Loan Amount</th>
                          <th>Credit Score</th>
                          <th>Risk Category</th>
                          <th>Default Probability</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchResult.records
                          .slice((batchPage - 1) * 10, batchPage * 10)
                          .map((row) => (
                            <tr key={row.id}>
                              <td style={{ fontWeight: 600, color: 'white' }}>{row.id}</td>
                              <td>{row.age}</td>
                              <td>${row.income.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                              <td>${row.loan_amount.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                              <td>{row.credit_score}</td>
                              <td>
                                <span className={`table-badge badge-${row.risk_category.toLowerCase()}`}>
                                  {row.risk_category}
                                </span>
                              </td>
                              <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'white' }}>
                                {(row.probability * 100).toFixed(2)}%
                              </td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pagination">
                    <span className="pagination-text">
                      Showing {Math.min(batchResult.records.length, (batchPage - 1) * 10 + 1)}-
                      {Math.min(batchResult.records.length, batchPage * 10)} of {batchResult.records.length} previews
                    </span>
                    <div className="pagination-buttons">
                      <button 
                        className="pagination-btn"
                        onClick={() => setBatchPage(p => Math.max(1, p - 1))}
                        disabled={batchPage === 1}
                      >
                        Prev
                      </button>
                      <button 
                        className="pagination-btn"
                        onClick={() => setBatchPage(p => Math.min(Math.ceil(batchResult.records.length / 10), p + 1))}
                        disabled={batchPage * 10 >= batchResult.records.length}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Database History Registry */}
        {activeTab === 'history' && (
          <div className="tab-content">
            <header>
              <h1>Credit Registry Database</h1>
              <p>
                {isAdmin 
                  ? "Viewing all historical application logs across all underwriters (Admin Mode)." 
                  : `Viewing historical application logs created by underwriter **${username}**.`
                }
              </p>
            </header>

            <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flexGrow: 1, minWidth: '200px' }}>
                <input 
                  type="text" 
                  placeholder={isAdmin ? "Search by ID, Score, Amount or Officer..." : "Search by ID, Score or Amount..."}
                  value={historySearch}
                  onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                  style={{ width: '100%', backgroundColor: 'rgba(22, 20, 38, 0.6)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.65rem 0.85rem', outline: 'none' }}
                />
              </div>

              <div>
                <select 
                  value={historyFilter} 
                  onChange={(e) => { setHistoryFilter(e.target.value); setHistoryPage(1); }}
                  style={{ backgroundColor: 'rgba(22, 20, 38, 0.6)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '0.65rem 0.85rem', outline: 'none' }}
                >
                  <option value="All">All Risks</option>
                  <option value="Low">Low Risk</option>
                  <option value="Medium">Medium Risk</option>
                  <option value="High">High Risk</option>
                </select>
              </div>

              <button onClick={fetchHistory} className="btn" style={{ padding: '0.65rem 1rem', fontSize: '0.85rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'white' }}>
                🔄 Refresh
              </button>
            </div>

            {historyLoading && (
              <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 0' }}>
                <div className="scanning-container">
                  <div className="scanning-circle"></div>
                  <div className="scanning-text">Loading registry logs from SQL database...</div>
                </div>
              </div>
            )}

            {!historyLoading && historyError && (
              <div className="error-banner">
                <span>❌</span>
                <div>Failed to query database history: {historyError}</div>
              </div>
            )}

            {!historyLoading && !historyError && filteredHistory.length === 0 && (
              <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>📭</div>
                <h3>No Applications Found</h3>
                <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                  There are no records matching your criteria. Process an applicant in "Single Predict" to log database records.
                </p>
              </div>
            )}

            {!historyLoading && !historyError && filteredHistory.length > 0 && (
              <div className="glass-card">
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Timestamp</th>
                        {isAdmin && <th>Officer</th>}
                        <th>Credit Score</th>
                        <th>Annual Income</th>
                        <th>Loan Amount</th>
                        <th>DTI</th>
                        <th>Risk Level</th>
                        <th>Score</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory
                        .slice((historyPage - 1) * 10, historyPage * 10)
                        .map((row) => (
                          <tr key={row.id}>
                            <td style={{ fontWeight: 600, color: 'white' }}>#{row.id}</td>
                            <td>{new Date(row.timestamp).toLocaleDateString()}</td>
                            {isAdmin && (
                              <td style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                                {row.username}
                              </td>
                            )}
                            <td style={{ fontWeight: 600 }}>{row.CreditScore}</td>
                            <td>${row.Income.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                            <td>${row.LoanAmount.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                            <td>{(row.DTIRatio * 100).toFixed(0)}%</td>
                            <td>
                              <span className={`table-badge badge-${row.risk_category.toLowerCase()}`}>
                                {row.risk_category}
                              </span>
                            </td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'white' }}>
                              {(row.probability * 100).toFixed(1)}%
                            </td>
                            <td style={{ display: 'flex', gap: '0.5rem' }}>
                              <button 
                                onClick={() => loadHistoryRecord(row)}
                                className="pagination-btn"
                                style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)', color: '#60a5fa', padding: '0.2rem 0.6rem' }}
                              >
                                Load
                              </button>
                              <button 
                                onClick={() => deleteRecord(row.id)}
                                className="pagination-btn"
                                style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.2rem 0.6rem' }}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pagination">
                  <span className="pagination-text">
                    Showing {Math.min(filteredHistory.length, (historyPage - 1) * 10 + 1)}-
                    {Math.min(filteredHistory.length, historyPage * 10)} of {filteredHistory.length} applications
                  </span>
                  <div className="pagination-buttons">
                    <button 
                      className="pagination-btn"
                      onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                      disabled={historyPage === 1}
                    >
                      Prev
                    </button>
                    <button 
                      className="pagination-btn"
                      onClick={() => setHistoryPage(p => Math.min(Math.ceil(filteredHistory.length / 10), p + 1))}
                      disabled={historyPage * 10 >= filteredHistory.length}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Model Diagnostics & Metrics */}
        {activeTab === 'analytics' && (
          <div className="tab-content">
            <header>
              <h1>Model Overview & Analytics</h1>
              <p>Review the trained machine learning pipeline parameters, statistical metrics, and credit feature importance weightings.</p>
            </header>

            {modelStatus !== 'active' ? (
              <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>⏳</div>
                <h3>Analytics Unavailable</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  Please ensure the model training is complete and the backend server is active to load diagnostics.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                <div className="grid-2col" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="glass-card">
                    <div className="glass-card-header">
                      <h2><span>⚙️</span> Model Specifications</h2>
                    </div>
                    <table className="metrics-table">
                      <tbody>
                        <tr>
                          <th>Classifier Type</th>
                          <td>{modelMeta?.model_name || 'Random Forest'}</td>
                        </tr>
                        <tr>
                          <th>Number of Trees</th>
                          <td>{modelMeta?.parameters?.n_estimators || '100'}</td>
                        </tr>
                        <tr>
                          <th>Maximum Tree Depth</th>
                          <td>{modelMeta?.parameters?.max_depth || '12'}</td>
                        </tr>
                        <tr>
                          <th>Imbalance Strategy</th>
                          <td>Class Weights Balanced</td>
                        </tr>
                        <tr>
                          <th>Total Features</th>
                          <td>{modelMeta?.feature_importances?.length || 16} input features</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="glass-card">
                    <div className="glass-card-header">
                      <h2><span>📈</span> Performance Metrics</h2>
                    </div>
                    <table className="metrics-table">
                      <tbody>
                        <tr>
                          <th>Accuracy</th>
                          <td>{(modelMeta?.metrics?.accuracy * 100).toFixed(2)}%</td>
                        </tr>
                        <tr>
                          <th>ROC-AUC Score</th>
                          <td>{(modelMeta?.metrics?.roc_auc * 100).toFixed(2)}%</td>
                        </tr>
                        <tr>
                          <th>Precision (Default)</th>
                          <td>{(modelMeta?.metrics?.precision_default * 100).toFixed(2)}%</td>
                        </tr>
                        <tr>
                          <th>Recall (Default Sensitivity)</th>
                          <td>{(modelMeta?.metrics?.recall_default * 100).toFixed(2)}%</td>
                        </tr>
                        <tr>
                          <th>F1-Score (Default)</th>
                          <td>{(modelMeta?.metrics?.f1_score_default * 100).toFixed(2)}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid-2col">
                  <div className="glass-card">
                    <div className="glass-card-header">
                      <h2><span>📊</span> Feature Importances</h2>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Relative weight the model assigns to each base feature when computing default probabilities.
                    </p>
                    
                    <div className="chart-container">
                      {modelMeta?.feature_importances?.map((item) => (
                        <div key={item.feature} className="chart-bar-wrapper">
                          <div className="chart-bar-label">{item.feature}</div>
                          <div className="chart-bar-bg">
                            <div 
                              className="chart-bar-fill"
                              style={{ width: `${item.importance * 100 * 3.5}%` }}
                            />
                          </div>
                          <div className="chart-bar-value">{ (item.importance * 100).toFixed(1) }%</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div className="glass-card-header">
                      <h2><span>🎯</span> Test Set Confusion Matrix</h2>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1rem' }}>
                      Actual vs. Predicted class counts on the 20% test validation slice.
                    </p>

                    {modelMeta?.metrics?.confusion_matrix && (
                      <div className="matrix-grid">
                        <div></div>
                        <div className="matrix-header">Pred: 0 (No)</div>
                        <div className="matrix-header">Pred: 1 (Yes)</div>
                        
                        <div className="matrix-label rotated">Actual</div>
                        
                        <div className="matrix-cell diagonal-true">
                          <span className="matrix-cell-val">
                            {modelMeta.metrics.confusion_matrix[0][0].toLocaleString()}
                          </span>
                          <span className="matrix-cell-label">True Neg</span>
                        </div>
                        <div className="matrix-cell">
                          <span className="matrix-cell-val">
                            {modelMeta.metrics.confusion_matrix[0][1].toLocaleString()}
                          </span>
                          <span className="matrix-cell-label">False Pos</span>
                        </div>
                        
                        <div className="matrix-cell">
                          <span className="matrix-cell-val">
                            {modelMeta.metrics.confusion_matrix[1][0].toLocaleString()}
                          </span>
                          <span className="matrix-cell-label">False Neg</span>
                        </div>
                        <div className="matrix-cell diagonal-true">
                          <span className="matrix-cell-val">
                            {modelMeta.metrics.confusion_matrix[1][1].toLocaleString()}
                          </span>
                          <span className="matrix-cell-label">True Pos</span>
                        </div>
                      </div>
                    )}
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '1rem' }}>
                      <em>Imbalance handling ensures higher sensitivity (recall) on predicted defaults.</em>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
