import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProject, addMember } from "../api/projects";
import { getTasks, createTask, updateTask, deleteTask } from "../api/tasks";
import { useSSE } from "../hooks/useSSE";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";

const COLUMNS = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

export default function ProjectView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newAssignee, setNewAssignee] = useState("");
  const [memberEmail, setMemberEmail] = useState("");

  const loadData = async () => {
    try {
      const [proj, taskList] = await Promise.all([
        getProject(id),
        getTasks(id),
      ]);
      setProject(proj);
      setTasks(taskList);
    } catch {
      addToast("Failed to load project", "error");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleSSE = useCallback((event, data) => {
    switch (event) {
      case "task_created":
        setTasks((prev) => {
          if (prev.find((t) => t.id === data.id)) return prev;
          return [...prev, data];
        });
        break;
      case "task_updated":
        setTasks((prev) => prev.map((t) => (t.id === data.id ? data : t)));
        break;
      case "task_deleted":
        setTasks((prev) => prev.filter((t) => t.id !== data.id));
        break;
      case "project_updated":
      case "members_updated":
        setProject(data);
        break;
      case "project_deleted":
        addToast("Project was deleted", "info");
        navigate("/");
        break;
    }
  }, [navigate, addToast]);

  useSSE(id, handleSSE);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const task = await createTask(id, {
        title: newTitle,
        priority: newPriority,
        assigned_user_id: newAssignee ? parseInt(newAssignee) : null,
      });
      setTasks((prev) => {
        if (prev.find((t) => t.id === task.id)) return prev;
        return [...prev, task];
      });
      setNewTitle("");
      setNewAssignee("");
    } catch {
      addToast("Failed to create task", "error");
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    try {
      const updated = await updateTask(id, task.id, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch {
      addToast("Failed to update task", "error");
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await deleteTask(id, taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch {
      addToast("Failed to delete task", "error");
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!memberEmail.trim()) return;
    try {
      const updated = await addMember(id, memberEmail);
      setProject(updated);
      setMemberEmail("");
      addToast("Member added", "success");
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to add member", "error");
    }
  };

  if (loading) return <div className="spinner" />;
  if (!project) return null;

  return (
    <div className="project-view">
      <div className="project-view-header">
        <div>
          <h1>{project.title}</h1>
          <p className="project-desc">{project.description}</p>
        </div>
        <div className="project-members">
          <span>Members: {project.members?.map((m) => m.name || m.email).join(", ")}</span>
          <form className="inline-form" onSubmit={handleAddMember}>
            <input
              placeholder="Add by email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
            />
            <button type="submit" className="btn-sm">Add</button>
          </form>
        </div>
      </div>

      <form className="task-form" onSubmit={handleAddTask}>
        <input
          placeholder="New task title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          required
        />
        <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <select value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)}>
          <option value="">Unassigned</option>
          {project.members?.map((m) => (
            <option key={m.id} value={m.id}>{m.name || m.email}</option>
          ))}
        </select>
        <button type="submit" className="btn-primary">Add Task</button>
      </form>

      <div className="kanban">
        {COLUMNS.map((col) => (
          <div key={col.key} className="kanban-column">
            <h3 className="kanban-column-title">{col.label}</h3>
            <div className="kanban-cards">
              {tasks
                .filter((t) => t.status === col.key)
                .map((task) => (
                  <div key={task.id} className={`kanban-card priority-${task.priority}`}>
                    <div className="kanban-card-header">
                      <span className="task-title">{task.title}</span>
                      <button
                        className="btn-delete-sm"
                        onClick={() => handleDeleteTask(task.id)}
                      >
                        ×
                      </button>
                    </div>
                    <div className="kanban-card-meta">
                      <span className={`priority-badge ${task.priority}`}>
                        {task.priority}
                      </span>
                      {task.assignee_name && (
                        <span className="assignee">{task.assignee_name}</span>
                      )}
                    </div>
                    <div className="kanban-card-actions">
                      {COLUMNS.filter((c) => c.key !== task.status).map((c) => (
                        <button
                          key={c.key}
                          className="btn-move"
                          onClick={() => handleStatusChange(task, c.key)}
                        >
                          → {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
