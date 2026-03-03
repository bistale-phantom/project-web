import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { updateProfile } from "../api/auth";

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();

  const [name, setName] = useState(user?.name || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast("Name is required", "error");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name, avatar_url: avatarUrl });
      await refreshUser();
      addToast("Profile updated!", "success");
    } catch {
      addToast("Failed to update profile", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <h1>✨ Profile</h1>
      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="avatar-preview">
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="avatar-img" />
          ) : (
            <div className="avatar-placeholder">
              {(name || user?.email || "?")[0].toUpperCase()}
            </div>
          )}
        </div>

        <label>
          Display Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label>
          Avatar URL
          <input
            type="url"
            placeholder="https://example.com/avatar.png"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
          />
        </label>

        <label>
          Email
          <input type="email" value={user?.email || ""} disabled />
        </label>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
