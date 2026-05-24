import os
from datetime import datetime, timezone
from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Load PostgreSQL connection string from environment
DATABASE_URL = os.environ.get("DATABASE_URL")

# Enforce PostgreSQL configuration - Raise error if missing
if not DATABASE_URL:
    raise RuntimeError(
        "CRITICAL ERROR: DATABASE_URL environment variable is missing! "
        "PostgreSQL is strictly required for database operations. "
        "Please configure the DATABASE_URL environment variable in your local environment or host provider."
    )

# Auto-correct old Heroku/Render "postgres://" links to "postgresql://" for SQLAlchemy compatibility
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Enforce that it is indeed a PostgreSQL connection
if not DATABASE_URL.startswith("postgresql://"):
    raise ValueError(
        f"CRITICAL ERROR: Invalid database URL format! "
        f"DATABASE_URL must start with 'postgresql://' or 'postgres://'. Got: {DATABASE_URL[:15]}..."
    )

# Create SQLAlchemy engine (No extra connect_args like check_same_thread needed for PostgreSQL)
engine = create_engine(DATABASE_URL)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base class for models
Base = declarative_base()

class LoanApplicationModel(Base):
    __tablename__ = "loan_applications"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Applicant Demographic inputs
    age = Column(Integer)
    education = Column(String)
    marital_status = Column(String)
    has_dependents = Column(String)

    # Financial Profile inputs
    income = Column(Float)
    employment_type = Column(String)
    months_employed = Column(Integer)
    has_mortgage = Column(String)

    # Credit & Loan Details inputs
    credit_score = Column(Integer)
    dti_ratio = Column(Float)
    num_credit_lines = Column(Integer)
    loan_amount = Column(Float)
    interest_rate = Column(Float)
    loan_term = Column(Integer)
    loan_purpose = Column(String)
    has_co_signer = Column(String)

    # ML Inference outputs
    probability = Column(Float)
    prediction = Column(Integer)
    risk_category = Column(String)

def init_db():
    """Create database tables if they do not exist."""
    Base.metadata.create_all(bind=engine)

def get_db():
    """Dependency generator to yield database sessions to FastAPI routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
