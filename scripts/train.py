import os
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix
import joblib

def main():
    print("Step 1: Loading dataset...")
    # Path to dataset
    dataset_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Loan_default.csv"))
    if not os.path.exists(dataset_path):
        print(f"Error: Dataset not found at {dataset_path}")
        return
        
    df = pd.read_csv(dataset_path)
    print(f"Loaded dataset with shape: {df.shape}")
    
    # Step 2: Separate features and target
    target_col = "Default"
    if target_col not in df.columns:
        print(f"Error: Target column '{target_col}' not found in dataset.")
        return
        
    # Drop LoanID as it is just a unique identifier
    if "LoanID" in df.columns:
        df = df.drop(columns=["LoanID"])
        
    X = df.drop(columns=[target_col])
    y = df[target_col]
    
    # Calculate class imbalance
    class_counts = y.value_counts()
    imbalance_ratio = class_counts.get(1, 0) / len(y)
    print(f"Target distribution - Non-Default (0): {class_counts.get(0, 0)}, Default (1): {class_counts.get(1, 0)} ({imbalance_ratio:.2%} defaults)")

    # Define columns
    numerical_cols = [
        "Age", "Income", "LoanAmount", "CreditScore", 
        "MonthsEmployed", "NumCreditLines", "InterestRate", 
        "LoanTerm", "DTIRatio"
    ]
    
    categorical_cols = [
        "Education", "EmploymentType", "MaritalStatus", 
        "HasMortgage", "HasDependents", "LoanPurpose", "HasCoSigner"
    ]
    
    # Check that all columns exist
    for col in numerical_cols + categorical_cols:
        if col not in X.columns:
            print(f"Warning: Expected column '{col}' is missing from the dataset features!")

    print("\nStep 3: Splitting data into train and test sets...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"Training set size: {X_train.shape[0]}, Test set size: {X_test.shape[0]}")

    print("\nStep 4: Creating preprocessing pipeline...")
    # Numeric transformer: StandardScaler
    numeric_transformer = StandardScaler()
    
    # Categorical transformer: OneHotEncoder (handle unknown features gracefully)
    categorical_transformer = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    
    # Combine preprocessors
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, numerical_cols),
            ("cat", categorical_transformer, categorical_cols)
        ]
    )

    print("\nStep 5: Training Random Forest Classifier...")
    # Initialize Random Forest with balanced class weights to address target imbalance
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=12,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
        verbose=1
    )
    
    # Create the complete execution pipeline
    pipeline = Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("classifier", model)
    ])
    
    # Fit the pipeline
    pipeline.fit(X_train, y_train)
    print("Model training complete.")

    print("\nStep 6: Evaluating model...")
    # Make predictions
    y_pred = pipeline.predict(X_test)
    y_pred_proba = pipeline.predict_proba(X_test)[:, 1]
    
    # Calculate metrics
    roc_auc = roc_auc_score(y_test, y_pred_proba)
    report = classification_report(y_test, y_pred, output_dict=True)
    conf_matrix = confusion_matrix(y_test, y_pred).tolist()
    
    print(f"ROC-AUC Score: {roc_auc:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))

    print("\nStep 7: Extracting Feature Importance...")
    # Get feature names from preprocessor
    # We fit preprocessor on X_train to get feature names
    fitted_preprocessor = pipeline.named_steps["preprocessor"]
    
    # Get numerical column names (stay the same)
    num_feature_names = numerical_cols
    
    # Get categorical column names (expanded by OneHotEncoder)
    cat_encoder = fitted_preprocessor.named_transformers_["cat"]
    cat_feature_names = cat_encoder.get_feature_names_out(categorical_cols).tolist()
    
    all_feature_names = num_feature_names + cat_feature_names
    
    # Get importance values from classifier
    importances = pipeline.named_steps["classifier"].feature_importances_
    
    # Pair feature names with their importances
    feature_importance_list = []
    for name, imp in zip(all_feature_names, importances):
        feature_importance_list.append({"feature": name, "importance": float(imp)})
        
    # Sort by importance descending
    feature_importance_list = sorted(feature_importance_list, key=lambda x: x["importance"], reverse=True)
    
    # Group original categories for simplified explanation
    # (Combining one-hot encoded categories back to their base features for user-friendly display)
    base_feature_importances = {}
    for item in feature_importance_list:
        feat = item["feature"]
        imp = item["importance"]
        base_found = False
        for base in categorical_cols:
            if feat.startswith(base + "_"):
                base_feature_importances[base] = base_feature_importances.get(base, 0.0) + imp
                base_found = True
                break
        if not base_found:
            base_feature_importances[feat] = imp
            
    sorted_base_importances = [
        {"feature": k, "importance": float(v)} 
        for k, v in sorted(base_feature_importances.items(), key=lambda x: x[1], reverse=True)
    ]

    print("\nTop Base Feature Importances:")
    for item in sorted_base_importances[:5]:
        print(f" - {item['feature']}: {item['importance']:.4f}")

    print("\nStep 8: Saving model pipeline and metadata...")
    # Create models directory inside backend if it doesn't exist
    models_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "models"))
    os.makedirs(models_dir, exist_ok=True)
    
    model_path = os.path.join(models_dir, "loan_default_pipeline.joblib")
    joblib.dump(pipeline, model_path)
    print(f"Saved pipeline to: {model_path}")
    
    # Save metadata as JSON for API consumption
    metadata = {
        "model_name": "Random Forest Classifier",
        "parameters": {
            "n_estimators": 100,
            "max_depth": 12,
            "class_weight": "balanced"
        },
        "metrics": {
            "accuracy": report["accuracy"],
            "roc_auc": roc_auc,
            "precision_default": report["1"]["precision"],
            "recall_default": report["1"]["recall"],
            "f1_score_default": report["1"]["f1-score"],
            "precision_non_default": report["0"]["precision"],
            "recall_non_default": report["0"]["recall"],
            "f1_score_non_default": report["0"]["f1-score"],
            "confusion_matrix": conf_matrix
        },
        "feature_importances": sorted_base_importances,
        "raw_feature_importances": feature_importance_list[:25], # Top 25 fine-grained features
        "features": {
            "numerical": numerical_cols,
            "categorical": categorical_cols
        }
    }
    
    metadata_path = os.path.join(models_dir, "model_metadata.json")
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=4)
    print(f"Saved model metadata to: {metadata_path}")
    print("Phase 1 execution successfully completed!")

if __name__ == "__main__":
    main()
