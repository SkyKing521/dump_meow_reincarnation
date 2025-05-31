from database import engine
import models
import os
import config

def init_db():
    # Ensure the data directory exists
    os.makedirs(config.DB_DIR, exist_ok=True)
    
    # Create all tables
    try:
        models.Base.metadata.create_all(bind=engine)
        print("Database tables created successfully")
    except Exception as e:
        print(f"Error creating database tables: {e}")

if __name__ == "__main__":
    init_db() 