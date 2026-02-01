from fastapi import FastAPI

from app.routers import auth, incident, tourist, location, iot

app = FastAPI(
    title="Smart Tourist Safety System",
    version="1.0.0"
)

app.include_router(auth.router, tags=["Auth"])
app.include_router(incident.router, tags=["Incidents"])
app.include_router(tourist.router, tags=["Tourists"])
app.include_router(location.router, tags=["Location"])
app.include_router(iot.router, tags=["IoT"])

@app.get("/")
def health_check():
    return {"status": "Backend running"}
