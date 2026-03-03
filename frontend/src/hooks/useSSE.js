import { useEffect, useRef } from "react";

export function useSSE(projectId, onEvent) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!projectId) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    const url = `http://localhost:8000/api/projects/${projectId}/stream?token=${token}`;
    const source = new EventSource(url);

    const EVENTS = [
      "task_created",
      "task_updated",
      "task_deleted",
      "project_updated",
      "project_deleted",
      "members_updated",
    ];

    EVENTS.forEach((evt) => {
      source.addEventListener(evt, (e) => {
        try {
          const data = JSON.parse(e.data);
          onEventRef.current(evt, data);
        } catch {
          /* ignore parse errors */
        }
      });
    });

    source.onerror = () => {
      source.close();
    };

    return () => source.close();
  }, [projectId]);
}
