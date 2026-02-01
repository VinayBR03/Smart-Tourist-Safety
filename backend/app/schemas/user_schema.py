from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str


# 🔽 ADD THIS BELOW (do not remove above code)
class TouristProfile(BaseModel):
    id: int
    email: EmailStr
    role: str

    class Config:
        from_attributes = True
