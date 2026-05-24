# RiskShield AI: End-to-End Loan Default Prediction System

RiskShield AI is an industry-ready, full-stack machine learning application designed to predict the probability of loan default. It includes a Python ML pipeline for training a Random Forest classifier, a fast FastAPI REST backend, and a modern Vite + React glassmorphism web dashboard.

---

## Features

- **Robust ML Pipeline**: Preprocesses tabular data (One-Hot Encodings + Standardization) and trains a Random Forest Classifier on 255k rows with target stratification and class balancing.
- **Lightweight Backend API (FastAPI)**: Serves single and batch predictions using Pydantic models for request validation and CORS middleware.
- **Explainable AI (XAI)**: The backend computes how much each feature deviates from the mean, explaining *why* the model scored an applicant as High, Medium, or Low risk.
- **Actionable Advisor**: Evaluates risk profiles and outputs structured credit actions (e.g., "Negotiate Interest Rate below 10%", "Request Co-signer", "Reduce requested Loan Amount by 20%").
- **Bulk Loan Underwriting**: Drag-and-drop CSV parser that handles thousands of application reviews simultaneously, showing aggregates, visual lists, and exporting scores.
- **Model Diagnostics Dashboard**: Displays model parameters, confusion matrices, and base-feature importances rendered inside reactive charts.
- **Containerization**: Configured with Multi-stage Docker builds and Docker Compose for instant local reproduction and cloud hosting.

---

## Local Development Setup

You can run this application locally either as **native processes** (highly recommended for debugging and training) or inside **Docker containers**.

### Method A: Native Processes (Recommended for Development)

First, make sure you have Python (>=3.9) and Node.js (>=18) installed.

#### 1. Train the ML Model (Optional - Pre-trained model is already generated)
If you want to re-train the model on the `Loan_default.csv` dataset:
```bash
# From the project root directory
# Set up a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install requirements and run training script
pip install -r scripts/requirements.txt
python scripts/train.py
```
This trains the model and saves `loan_default_pipeline.joblib` and `model_metadata.json` directly into `backend/models/`.

#### 2. Launch the FastAPI Backend
```bash
# In a new terminal window / tab, activate the virtual environment
source .venv/bin/activate

# Install backend dependencies
pip install -r backend/requirements.txt

# Run uvicorn server (port 8000)
python backend/main.py
```
The backend API is now running at `http://localhost:8000`. You can inspect the interactive documentation at `http://localhost:8000/docs`.

#### 3. Start the React Frontend
```bash
# In a new terminal window / tab, navigate to the frontend directory
cd frontend

# Install package dependencies
npm install

# Start Vite dev server (port 5173)
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

---

### Method B: Containerized Execution (Using Docker Compose)

Make sure you have Docker Desktop installed.

To build and run both frontend and backend services in a unified container network:
```bash
# From the root project directory
docker-compose up --build
```
- **Web App Interface**: `http://localhost` (mapped to port 80 inside the container)
- **FastAPI API Documentation**: `http://localhost:8000/docs`

To stop the containers:
```bash
docker-compose down
```

---

## Production Deployment & Hosting Guide

To share this project with the world, you can host it for free using modern cloud platforms.

### Step 1: Push to GitHub
Create a GitHub repository and push your project code.
```bash
git init
git add .
git commit -m "Initial commit of end-to-end ML project"
# Link and push to your remote GitHub repository
```

### Step 2: Deploy the Backend API
You can host the FastAPI service on **Render** (free web service tier):
1. Sign up on [Render](https://render.com/).
2. Create a new **Web Service** and connect your GitHub repository.
3. Configure the following settings:
   - **Environment**: `Python`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `PYTHONPATH=. uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
   - Or configure it to build using Docker (Render will automatically detect `Dockerfile.backend` if you specify it as the Dockerfile target).
4. Save and deploy. Render will give you a public URL (e.g. `https://loan-risk-backend.onrender.com`).

### Step 3: Deploy the Frontend Client
You can host the React static site on **Vercel** or **Netlify** (both offer free tiers):
1. Sign up on [Vercel](https://vercel.com/).
2. Create a new Project and link the same GitHub repository.
3. In settings, configure:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend` (Important: target the subfolder!)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Set Environment Variables:
   - In `frontend/src/App.jsx`, replace `http://localhost:8000` with your deployed Render URL (e.g., `https://loan-risk-backend.onrender.com`). *Tip: You can use `import.meta.env.VITE_API_URL` to toggle this dynamically!*
5. Deploy. You will receive a secure web URL (e.g. `https://loan-risk-dashboard.vercel.app`).

### Step 4: Alternative (Single Space on Hugging Face)
Hugging Face Spaces offers free Docker hosting:
1. Create a Hugging Face account and create a new **Space**.
2. Select **Docker** as the SDK.
3. Set up a simple unified `Dockerfile` that runs both Nginx and Uvicorn under a process manager like `supervisord`, or push the Backend Docker image to HF Spaces and build the Vercel frontend.
