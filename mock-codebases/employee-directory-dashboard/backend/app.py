from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from data.employees import EMPLOYEES

app = FastAPI(title="Employee Directory API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/employees")
def list_employees():
    return EMPLOYEES
