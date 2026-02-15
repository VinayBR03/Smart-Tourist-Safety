from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, incident, tourist, location, iot, websocket

app = FastAPI(
    title="Smart Tourist Safety System",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://192.168.1.8:5173",
        "https://unwhisked-lorine-uncomplaining.ngrok-free.dev",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router, tags=["Auth"])
app.include_router(incident.router, tags=["Incidents"])
app.include_router(tourist.router, tags=["Tourists"])
app.include_router(location.router, tags=["Location"])
app.include_router(iot.router, tags=["IoT"])
app.include_router(websocket.router, tags=["Websocket"])

@app.get("/")
def health_check():
    return {"status": "Backend running"}
