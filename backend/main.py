import os
import io
from typing import List
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session

# Import model inference helper
try:
    from backend.model_loader import predict_single, get_metadata, get_pipeline
    from backend.database import get_db, init_db, LoanApplicationModel
except ImportError:
    # Handle absolute import paths when running main.py directly
    from model_loader import predict_single, get_metadata, get_pipeline
    from database import get_db, init_db, LoanApplicationModel

# Initialize SQLite database schema
init_db()

app = FastAPI(
    title="Loan Default Prediction API",
    description="Industry-ready machine learning API for predicting loan default risk.",
    version="1.1.0"
)

# Enable CORS (Cross-Origin Resource Sharing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Input data validation schema
class LoanPredictionInput(BaseModel):
    Age: int = Field(..., ge=18, le=100, description="Age of the borrower (18-100)", examples=[35])
    Income: int = Field(..., ge=0, description="Annual income in USD", examples=[75000])
    LoanAmount: int = Field(..., ge=0, description="Requested loan amount in USD", examples=[20000])
    CreditScore: int = Field(..., ge=300, le=850, description="Credit score of the borrower (300-850)", examples=[720])
    MonthsEmployed: int = Field(..., ge=0, description="Number of months employed", examples=[48])
    NumCreditLines: int = Field(..., ge=0, le=20, description="Number of active credit lines (0-20)", examples=[3])
    InterestRate: float = Field(..., ge=0.0, le=100.0, description="Interest rate percentage (0-100)", examples=[7.5])
    LoanTerm: int = Field(..., ge=1, le=360, description="Loan term in months", examples=[36])
    DTIRatio: float = Field(..., ge=0.0, le=5.0, description="Debt-to-Income ratio (0.0 to 5.0)", examples=[0.35])
    Education: str = Field(..., description="Education level of borrower", examples=["Bachelor's"])
    EmploymentType: str = Field(..., description="Employment type of borrower", examples=["Full-time"])
    MaritalStatus: str = Field(..., description="Marital status of borrower", examples=["Married"])
    HasMortgage: str = Field(..., description="Does borrower have a mortgage (Yes/No)", examples=["No"])
    HasDependents: str = Field(..., description="Does borrower have dependents (Yes/No)", examples=["No"])
    LoanPurpose: str = Field(..., description="Purpose of the loan", examples=["Business"])
    HasCoSigner: str = Field(..., description="Is there a co-signer (Yes/No)", examples=["No"])

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "service": "Loan Default Prediction Service with DB History",
        "docs_url": "/docs"
    }

@app.post("/predict")
def predict(payload: LoanPredictionInput, db: Session = Depends(get_db)):
    """
    Run prediction for a single loan applicant.
    Saves details and prediction result into the SQL database.
    Returns default probability, risk assessment, and key contributing factors.
    """
    try:
        input_dict = payload.model_dump()
        result = predict_single(input_dict)
        
        # Save application and ML output into the database
        db_app = LoanApplicationModel(
            age=input_dict["Age"],
            education=input_dict["Education"],
            marital_status=input_dict["MaritalStatus"],
            has_dependents=input_dict["HasDependents"],
            income=input_dict["Income"],
            employment_type=input_dict["EmploymentType"],
            months_employed=input_dict["MonthsEmployed"],
            has_mortgage=input_dict["HasMortgage"],
            credit_score=input_dict["CreditScore"],
            dti_ratio=input_dict["DTIRatio"],
            num_credit_lines=input_dict["NumCreditLines"],
            loan_amount=input_dict["LoanAmount"],
            interest_rate=input_dict["InterestRate"],
            loan_term=input_dict["LoanTerm"],
            loan_purpose=input_dict["LoanPurpose"],
            has_co_signer=input_dict["HasCoSigner"],
            probability=result["probability"],
            prediction=result["prediction"],
            risk_category=result["risk_category"]
        )
        db.add(db_app)
        db.commit()
        db.refresh(db_app)
        
        # Add DB record ID to the result
        result["db_id"] = db_app.id
        return result
        
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.get("/history")
def get_history(db: Session = Depends(get_db)):
    """
    Fetch all loan prediction logs from the SQLite database.
    """
    try:
        records = db.query(LoanApplicationModel).order_by(LoanApplicationModel.id.desc()).all()
        
        # Format database output for the frontend
        history_list = []
        for r in records:
            history_list.append({
                "id": r.id,
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                "Age": r.age,
                "Education": r.education,
                "MaritalStatus": r.marital_status,
                "HasDependents": r.has_dependents,
                "Income": r.income,
                "EmploymentType": r.employment_type,
                "MonthsEmployed": r.months_employed,
                "HasMortgage": r.has_mortgage,
                "CreditScore": r.credit_score,
                "DTIRatio": r.dti_ratio,
                "NumCreditLines": r.num_credit_lines,
                "LoanAmount": r.loan_amount,
                "InterestRate": r.interest_rate,
                "LoanTerm": r.loan_term,
                "LoanPurpose": r.loan_purpose,
                "HasCoSigner": r.has_co_signer,
                "probability": r.probability,
                "prediction": r.prediction,
                "risk_category": r.risk_category
            })
        return history_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")

@app.delete("/history/{id}")
def delete_history_record(id: int, db: Session = Depends(get_db)):
    """
    Delete a specific loan application record from the database.
    """
    record = db.query(LoanApplicationModel).filter(LoanApplicationModel.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    try:
        db.delete(record)
        db.commit()
        return {"status": "success", "message": f"Record {id} successfully deleted"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete record: {str(e)}")

@app.post("/predict-batch")
async def predict_batch(file: UploadFile = File(...)):
    """
    Accepts a CSV file of applicants, runs bulk inference, and returns 
    aggregated risk stats and an array of individual predictions.
    Note: Batch predictions are not logging to DB by default to avoid bloating,
    but can be enabled easily.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")
    
    try:
        # Read uploaded file
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        # Verify required columns are present
        required_cols = [
            "Age", "Income", "LoanAmount", "CreditScore", "MonthsEmployed", 
            "NumCreditLines", "InterestRate", "LoanTerm", "DTIRatio", 
            "Education", "EmploymentType", "MaritalStatus", "HasMortgage", 
            "HasDependents", "LoanPurpose", "HasCoSigner"
        ]
        
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise HTTPException(
                status_code=400, 
                detail=f"Uploaded CSV is missing required columns: {', '.join(missing_cols)}"
            )
            
        pipeline = get_pipeline()
        
        # Prepare subset of data for inference
        df_inference = df[required_cols].copy()
        
        # Run inference
        probabilities = pipeline.predict_proba(df_inference)[:, 1]
        predictions = pipeline.predict(df_inference)
        
        # Add predictions back to the dataframe
        df["Default_Probability"] = probabilities
        df["Predicted_Default"] = predictions
        df["Risk_Category"] = np.where(probabilities < 0.15, "Low", np.where(probabilities < 0.35, "Medium", "High"))
        
        # Calculate summary statistics
        total = len(df)
        defaults = int((predictions == 1).sum())
        non_defaults = total - defaults
        default_rate = float(defaults / total) if total > 0 else 0
        
        # Build individual records list for frontend display
        records = []
        has_id = "LoanID" in df.columns
        for idx, row in df.head(100).iterrows():
            records.append({
                "id": str(row["LoanID"]) if has_id else f"APP_{idx:05d}",
                "age": int(row["Age"]),
                "income": float(row["Income"]),
                "loan_amount": float(row["LoanAmount"]),
                "credit_score": int(row["CreditScore"]),
                "probability": float(row["Default_Probability"]),
                "prediction": int(row["Predicted_Default"]),
                "risk_category": str(row["Risk_Category"])
            })
            
        # Also return a base64 encoded version of the full results CSV
        output_buffer = io.StringIO()
        df.to_csv(output_buffer, index=False)
        csv_content = output_buffer.getvalue()
        
        return {
            "summary": {
                "total_records": total,
                "predicted_defaults": defaults,
                "predicted_non_defaults": non_defaults,
                "default_rate": default_rate
            },
            "records": records,
            "full_results_csv": csv_content
        }
        
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {str(e)}")

@app.get("/model-info")
def model_info():
    """
    Returns metrics and feature importances from the trained model.
    """
    try:
        metadata = get_metadata()
        if not metadata:
            raise HTTPException(status_code=503, detail="Model metadata is empty or missing.")
        return metadata
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading model info: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
