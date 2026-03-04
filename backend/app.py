import asyncio
import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from jose import jwt, JWTError
import bcrypt
from sse_starlette.sse import EventSourceResponse

from database import engine, get_db, Base
from models import User, Project, Task, project_members

# --------------- Config ---------------
SECRET_KEY = "super-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

# --------------- SSE Hub ---------------
# project_id -> list of asyncio.Queue
sse_connections: dict[int, list[asyncio.Queue]] = {}


def broadcast(project_id: int, event_type: str, data: dict):
    """Push an event to all SSE listeners of a project."""
    queues = sse_connections.get(project_id, [])
    message = {"event": event_type, "data": data}
    for q in queues:
        q.put_nowait(message)


# --------------- Schemas ---------------
class RegisterBody(BaseModel):
    email: str
    password: str
    name: str = ""


class LoginBody(BaseModel):
    email: str
    password: str


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None


class ProjectCreate(BaseModel):
    title: str
    description: str = ""


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class MemberAdd(BaseModel):
    email: str


class TaskCreate(BaseModel):
    title: str
    status: str = "todo"
    priority: str = "medium"
    assigned_user_id: Optional[int] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_user_id: Optional[int] = None


# --------------- Auth helpers ---------------
def create_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def user_dict(u: User) -> dict:
    return {"id": u.id, "email": u.email, "name": u.name, "avatar_url": u.avatar_url}


def task_dict(t: Task, include_project_title: bool = False) -> dict:
    d = {
        "id": t.id,
        "title": t.title,
        "status": t.status,
        "priority": t.priority,
        "project_id": t.project_id,
        "assigned_user_id": t.assigned_user_id,
        "assignee_name": t.assignee.name if t.assignee else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }
    if include_project_title and t.project:
        d["project_title"] = t.project.title
    return d


def project_dict(p: Project) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "description": p.description,
        "owner_id": p.owner_id,
        "members": [user_dict(m) for m in p.members],
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


# --------------- Auth routes ---------------
@app.post("/api/register")
def register(body: RegisterBody, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(400, "Email already registered")
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        name=body.name or body.email.split("@")[0],
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"token": create_token(user.id), "user": user_dict(user)}


@app.post("/api/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    return {"token": create_token(user.id), "user": user_dict(user)}


@app.get("/api/me")
def me(user: User = Depends(get_current_user)):
    return user_dict(user)


@app.put("/api/me")
def update_profile(body: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.name is not None:
        user.name = body.name
    if body.avatar_url is not None:
        user.avatar_url = body.avatar_url
    db.commit()
    db.refresh(user)
    return user_dict(user)


# --------------- Project routes ---------------
@app.get("/api/projects")
def list_projects(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owned = db.query(Project).filter(Project.owner_id == user.id).all()
    member_of = user.projects  # via backref
    all_projects = {p.id: p for p in owned}
    for p in member_of:
        all_projects[p.id] = p
    return [project_dict(p) for p in all_projects.values()]


@app.post("/api/projects")
def create_project(body: ProjectCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = Project(title=body.title, description=body.description, owner_id=user.id)
    project.members.append(user)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project_dict(project)


@app.get("/api/projects/{project_id}")
def get_project(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    if user.id != project.owner_id and user not in project.members:
        raise HTTPException(403, "Access denied")
    return project_dict(project)


@app.put("/api/projects/{project_id}")
def update_project(project_id: int, body: ProjectUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).get(project_id)
    if not project or (user.id != project.owner_id and user not in project.members):
        raise HTTPException(403, "Access denied")
    if body.title is not None:
        project.title = body.title
    if body.description is not None:
        project.description = body.description
    db.commit()
    db.refresh(project)
    broadcast(project_id, "project_updated", project_dict(project))
    return project_dict(project)


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).get(project_id)
    if not project or project.owner_id != user.id:
        raise HTTPException(403, "Only owner can delete")
    db.delete(project)
    db.commit()
    broadcast(project_id, "project_deleted", {"id": project_id})
    return {"ok": True}


@app.post("/api/projects/{project_id}/members")
def add_member(project_id: int, body: MemberAdd, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).get(project_id)
    if not project or (user.id != project.owner_id and user not in project.members):
        raise HTTPException(403, "Access denied")
    new_member = db.query(User).filter(User.email == body.email).first()
    if not new_member:
        raise HTTPException(404, "User not found")
    if new_member not in project.members:
        project.members.append(new_member)
        db.commit()
        db.refresh(project)
    broadcast(project_id, "members_updated", project_dict(project))
    return project_dict(project)


# --------------- Task routes ---------------
@app.get("/api/tasks/recent")
def list_recent_tasks(limit: int = 10, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return recent tasks across all projects the user has access to."""
    owned = db.query(Project).filter(Project.owner_id == user.id).all()
    member_of = user.projects
    all_projects = {p.id: p for p in owned}
    for p in member_of:
        all_projects[p.id] = p
    tasks = []
    for p in all_projects.values():
        for t in p.tasks:
            tasks.append(task_dict(t, include_project_title=True))
    tasks.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return tasks[:limit]


@app.get("/api/projects/{project_id}/tasks")
def list_tasks(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).get(project_id)
    if not project or (user.id != project.owner_id and user not in project.members):
        raise HTTPException(403, "Access denied")
    return [task_dict(t) for t in project.tasks]


@app.post("/api/projects/{project_id}/tasks")
def create_task(project_id: int, body: TaskCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).get(project_id)
    if not project or (user.id != project.owner_id and user not in project.members):
        raise HTTPException(403, "Access denied")
    task = Task(
        title=body.title,
        status=body.status,
        priority=body.priority,
        project_id=project_id,
        assigned_user_id=body.assigned_user_id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    broadcast(project_id, "task_created", task_dict(task))
    return task_dict(task)


@app.put("/api/projects/{project_id}/tasks/{task_id}")
def update_task(project_id: int, task_id: int, body: TaskUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).get(project_id)
    if not project or (user.id != project.owner_id and user not in project.members):
        raise HTTPException(403, "Access denied")
    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    if body.title is not None:
        task.title = body.title
    if body.status is not None:
        task.status = body.status
    if body.priority is not None:
        task.priority = body.priority
    if body.assigned_user_id is not None:
        task.assigned_user_id = body.assigned_user_id
    db.commit()
    db.refresh(task)
    broadcast(project_id, "task_updated", task_dict(task))
    return task_dict(task)


@app.delete("/api/projects/{project_id}/tasks/{task_id}")
def delete_task(project_id: int, task_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).get(project_id)
    if not project or (user.id != project.owner_id and user not in project.members):
        raise HTTPException(403, "Access denied")
    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    db.delete(task)
    db.commit()
    broadcast(project_id, "task_deleted", {"id": task_id, "project_id": project_id})
    return {"ok": True}


# --------------- SSE endpoint ---------------
@app.get("/api/projects/{project_id}/stream")
async def project_stream(project_id: int, request: Request, db: Session = Depends(get_db)):
    token = request.query_params.get("token", "")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(401, "Invalid token")

    user = db.query(User).get(user_id)
    project = db.query(Project).get(project_id)
    if not user or not project or (user.id != project.owner_id and user not in project.members):
        raise HTTPException(403, "Access denied")

    queue: asyncio.Queue = asyncio.Queue()
    if project_id not in sse_connections:
        sse_connections[project_id] = []
    sse_connections[project_id].append(queue)

    async def event_generator():
        try:
            yield {"event": "connected", "data": json.dumps({"project_id": project_id})}
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=30)
                    yield {"event": msg["event"], "data": json.dumps(msg["data"])}
                except asyncio.TimeoutError:
                    yield {"event": "ping", "data": ""}
        finally:
            sse_connections[project_id].remove(queue)
            if not sse_connections[project_id]:
                del sse_connections[project_id]

    return EventSourceResponse(event_generator())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
