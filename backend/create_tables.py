from app.database import engine, Base
from app.models.user import User
from app.models.incident import Incident
from app.models.location import Location

Base.metadata.create_all(bind=engine)
