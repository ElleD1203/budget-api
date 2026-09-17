import os

from dotenv import load_dotenv
from sqlalchemy import URL
from sqlmodel import Session, create_engine


# Load variables from .env
load_dotenv()


# Build PostgreSQL connection information
DATABASE_URL = URL.create(
    drivername="postgresql+psycopg",
    username=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    host=os.getenv("DB_HOST", "localhost"),
    port=int(os.getenv("DB_PORT", "5432")),
    database=os.getenv("DB_NAME"),
)


# Create one database engine for the application
engine = create_engine(
    DATABASE_URL,
    echo=True,
)


# Give FastAPI endpoints a database session
def get_session():
    with Session(engine) as session:
        yield session