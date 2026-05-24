import os
import joblib
import pandas as pd
import numpy as np

# Resolve paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "loan_default_pipeline.joblib")
METADATA_PATH = os.path.join(BASE_DIR, "models", "model_metadata.json")

# Lazy loading of model
_pipeline = None
_metadata = None

def get_pipeline():
    global _pipeline
    if _pipeline is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Model file not found at {MODEL_PATH}. Has the model been trained?")
        _pipeline = joblib.load(MODEL_PATH)
    return _pipeline

def get_metadata():
    global _metadata
    if _metadata is None:
        if not os.path.exists(METADATA_PATH):
            # Fallback metadata if file not found
            return {}
        import json
        with open(METADATA_PATH, "r") as f:
            _metadata = json.load(f)
    return _metadata

def predict_single(data: dict) -> dict:
    """
    Takes a dictionary of features, runs prediction, and returns probability, 
    risk classification, and explanation of key risk drivers.
    """
    pipeline = get_pipeline()
    metadata = get_metadata()
    
    # Convert input to DataFrame (1 row)
    df_input = pd.DataFrame([data])
    
    # Run prediction
    prob = float(pipeline.predict_proba(df_input)[0][1])
    prediction = int(pipeline.predict(df_input)[0])
    
    # Define risk category
    if prob < 0.15:
        risk_category = "Low"
    elif prob < 0.35:
        risk_category = "Medium"
    else:
        risk_category = "High"
        
    # Explainability: Calculate contributing factors
    # We retrieve the StandardScaler statistics to compute standard deviations (z-scores)
    # This shows if the user's value is significantly high/low compared to the dataset mean
    preprocessor = pipeline.named_steps["preprocessor"]
    scaler = preprocessor.named_transformers_["num"]
    
    numerical_cols = metadata.get("features", {}).get("numerical", [
        "Age", "Income", "LoanAmount", "CreditScore", 
        "MonthsEmployed", "NumCreditLines", "InterestRate", 
        "LoanTerm", "DTIRatio"
    ])
    
    means = scaler.mean_
    scales = scaler.scale_  # Standard deviation
    
    # Direction of correlation with Default:
    # +1 means higher value increases default risk
    # -1 means higher value decreases default risk (protects against default)
    impact_directions = {
        "Age": -1,          # Older borrowers are less likely to default
        "Income": -1,       # Higher income decreases default risk
        "LoanAmount": 1,    # Larger loans increase default risk
        "CreditScore": -1,  # Higher credit score decreases default risk
        "MonthsEmployed": -1,# Longer employment decreases default risk
        "NumCreditLines": 1,# More credit lines increase default risk
        "InterestRate": 1,  # Higher interest rates increase default risk
        "LoanTerm": 1,      # Longer terms increase default risk
        "DTIRatio": 1       # Higher Debt-to-Income ratio increases default risk
    }
    
    # Labels for display
    friendly_names = {
        "Age": "Age",
        "Income": "Annual Income",
        "LoanAmount": "Loan Amount",
        "CreditScore": "Credit Score",
        "MonthsEmployed": "Employment Duration",
        "NumCreditLines": "Credit Lines",
        "InterestRate": "Interest Rate",
        "LoanTerm": "Loan Term",
        "DTIRatio": "Debt-to-Income (DTI) Ratio"
    }

    factors = []
    
    # Analyze numerical features
    for i, col in enumerate(numerical_cols):
        val = data.get(col)
        if val is None:
            continue
            
        mean_val = means[i]
        std_val = scales[i]
        
        # Calculate standard deviation score (z-score)
        z = (float(val) - mean_val) / std_val
        direction = impact_directions.get(col, 0)
        
        # Score measures how much this feature pushes the risk up (+ve) or down (-ve)
        risk_contribution = z * direction
        
        # If absolute contribution is significant (> 0.4 standard deviations from the impact mean)
        if abs(risk_contribution) > 0.4:
            is_positive = risk_contribution > 0
            
            # Construct friendly reason
            if col == "CreditScore":
                reason = f"Credit Score of {val} is {'low' if val < 600 else 'strong'}"
            elif col == "Income":
                reason = f"Annual Income of ${val:,.0f} is {'below average' if is_positive else 'above average'}"
            elif col == "LoanAmount":
                reason = f"Loan Amount of ${val:,.0f} is {'substantial' if is_positive else 'modest'}"
            elif col == "DTIRatio":
                reason = f"DTI Ratio of {val:.0%} is {'elevated' if is_positive else 'conservative'}"
            elif col == "InterestRate":
                reason = f"Interest Rate of {val:.2f}% is {'high' if is_positive else 'favorable'}"
            elif col == "MonthsEmployed":
                reason = f"Employment of {val} months is {'short' if is_positive else 'stable'}"
            elif col == "NumCreditLines":
                reason = f"Has {val} active credit lines ({'many' if is_positive else 'few'})"
            elif col == "Age":
                reason = f"Age of {val} is {'younger' if is_positive else 'older'}"
            else:
                reason = f"{friendly_names.get(col, col)} of {val} is {'high' if is_positive == (direction > 0) else 'low'}"
                
            factors.append({
                "feature": col,
                "name": friendly_names.get(col, col),
                "value": val,
                "impact": "increase" if is_positive else "decrease",
                "score": float(risk_contribution),
                "reason": reason
            })
            
    # Add categorical analysis for obvious risk factors
    if data.get("EmploymentType") == "Unemployed":
        factors.append({
            "feature": "EmploymentType",
            "name": "Employment Status",
            "value": "Unemployed",
            "impact": "increase",
            "score": 1.2,
            "reason": "Borrower is currently unemployed"
        })
    elif data.get("EmploymentType") == "Full-time":
        factors.append({
            "feature": "EmploymentType",
            "name": "Employment Status",
            "value": "Full-time",
            "impact": "decrease",
            "score": -0.8,
            "reason": "Stable full-time employment"
        })
        
    if data.get("HasCoSigner") == "Yes":
        factors.append({
            "feature": "HasCoSigner",
            "name": "Co-signer",
            "value": "Yes",
            "impact": "decrease",
            "score": -0.7,
            "reason": "Loan has a co-signer"
        })
    elif data.get("HasCoSigner") == "No":
        factors.append({
            "feature": "HasCoSigner",
            "name": "Co-signer",
            "value": "No",
            "impact": "increase",
            "score": 0.5,
            "reason": "No co-signer on loan"
        })

    # Sort factors by absolute impact score descending
    factors = sorted(factors, key=lambda x: abs(x["score"]), reverse=True)

    # Generate recommendations/advice for lowering default risk
    recommendations = []
    if risk_category in ["Medium", "High"]:
        # Rule 1: DTI or Loan Amount adjustment
        if data.get("LoanAmount") > 80000:
            suggested_loan = int(data.get("LoanAmount") * 0.8)
            recommendations.append(
                f"Reduce the loan amount from ${data.get('LoanAmount'):,.0f} to ${suggested_loan:,.0f} to improve debt ratios."
            )
        # Rule 2: Co-signer
        if data.get("HasCoSigner") == "No":
            recommendations.append("Secure a co-signer to guarantee the loan and reduce defaults risk.")
        # Rule 3: Loan Term
        if data.get("LoanTerm") > 36:
            recommendations.append("Shorten the loan term (e.g. to 36 or 24 months) to reduce outstanding interest accumulation.")
        # Rule 4: Interest Rate reduction (refinancing / higher downpayment)
        if data.get("InterestRate") > 12:
            recommendations.append("Require a larger down payment to negotiate a lower Interest Rate (below 10%).")
    else:
        recommendations.append("The application profile is solid. Standard terms are recommended.")

    return {
        "probability": prob,
        "prediction": prediction,
        "risk_category": risk_category,
        "factors": factors[:5], # Top 5 key drivers
        "recommendations": recommendations
    }
