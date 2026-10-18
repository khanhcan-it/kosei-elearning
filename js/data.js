/* Loads the course registry and JSON data; keeps source JSON read-only. */
(function () {
  "use strict";
  const cache = new Map();

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw new Error("Không tải được " + url + " (HTTP " + response.status + ")");
    return response.json();
  }

  async function loadRegistry() {
    const registry = await fetchJson("./data/index.json");
    if (!Array.isArray(registry)) throw new Error("data/index.json phải là một mảng khóa học.");
    return registry.filter(item => item && typeof item.id === "string" && typeof item.title === "string" && typeof item.file === "string");
  }

  async function loadCourse(course) {
    if (!course || !course.file) throw new Error("Khóa học không có đường dẫn dữ liệu hợp lệ.");
    if (!cache.has(course.id)) {
      cache.set(course.id, fetchJson(course.file).catch(error => {
        cache.delete(course.id);
        throw error;
      }));
    }
    return cache.get(course.id);
  }

  window.CourseData = { loadRegistry, loadCourse };
})();