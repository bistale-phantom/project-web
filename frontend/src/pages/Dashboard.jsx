import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getProjects, createProject, deleteProject } from "../api/projects";
import { fetchExternalData } from "../api/external";
import { useToast } from "../context/ToastContext";

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const { addToast } = useToast();
  const navigate = useNavigate();

  // External data
  const [externalData, setExternalData] = useState([]);
  const [extLoading, setExtLoading] = useState(true);

  useEffect(() => {
    loadProjects();
    loadExternal();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch {
      addToast("Failed to load projects", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadExternal = async () => {
    try {
      const data = await fetchExternalData();
      setExternalData(data);
    } catch {
      addToast("Failed to load external data", "error");
    } finally {
      setExtLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createProject({ title, description });
      addToast("Project created", "success");
      setTitle("");
      setDescription("");
      setShowForm(false);
      loadProjects();
    } catch {
      addToast("Failed to create project", "error");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this project?")) return;
    try {
      await deleteProject(id);
      addToast("Project deleted", "success");
      loadProjects();
    } catch {
      addToast("Failed to delete project", "error");
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1><span className="cute-emoji">✨</span> Dashboard</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Project"}
        </button>
      </div>

      {showForm && (
        <form className="project-form" onSubmit={handleCreate}>
          <input
            placeholder="Project title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button type="submit" className="btn-primary">Create</button>
        </form>
      )}

      <section className="section">
        <h2><span className="section-emoji">📁</span> My Projects</h2>
        {loading ? (
          <div className="spinner" />
        ) : projects.length === 0 ? (
          <p className="empty-text"><span className="empty-emoji">💖</span> No projects yet. Create your first one!</p>
        ) : (
          <div className="project-grid">
            {projects.map((p) => (
              <div key={p.id} className="project-card">
                <h3>
                  <Link to={`/projects/${p.id}`}>{p.title}</Link>
                </h3>
                <p>{p.description || "No description"}</p>
                <div className="project-card-footer">
                  <span className="member-count">{p.members?.length || 0} members</span>
                  <button className="btn-danger-sm" onClick={() => handleDelete(p.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2><span className="section-emoji">📡</span> Latest Posts (External API)</h2>
        {extLoading ? (
          <div className="spinner" />
        ) : (
          <div className="widget-grid">
            {externalData.map((post) => (
              <div key={post.id} className="widget-card">
                <h4>{post.title}</h4>
                <p>{post.body.slice(0, 100)}...</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
