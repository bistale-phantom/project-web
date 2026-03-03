const CACHE_KEY = "external_api_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchExternalData() {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_TTL) {
      return data;
    }
  }

  const res = await fetch(
    "https://jsonplaceholder.typicode.com/posts?_limit=6"
  );
  if (!res.ok) throw new Error("Failed to fetch external data");
  const data = await res.json();

  localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  return data;
}
