/* Minimal lesson library: vanilla JavaScript, JSON-driven cards, Vimeo/YouTube playback. */
(function () {
  "use strict";

  const $ = selector => document.querySelector(selector);
  const els = {
    courseSelect: $("#courseSelect"),
    search: $("#searchInput"),
    currentCourse: $("#currentCourse"),
    resultCount: $("#resultCount"),
    notice: $("#notice"),
    lessonList: $("#lessonList"),
    modal: $("#videoModal"),
    modalTitle: $("#modalTitle"),
    frameHost: $("#videoFrameHost"),
    closeModal: $("#closeModalButton"),
    toast: $("#toast"),
    categoryNav: $("#categoryNav")
  };

  const state = {
    registry: [],
    course: null,
    lessons: [],
    query: "",
    category: "Tất cả",
    lastFocused: null,
    toastTimer: null
  };
  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalized(value) {
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi");
  }

  function iconPlay() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"/></svg>';
  }

  function iconVideo() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/></svg>';
  }

  function getLessonTitle(lecture, index) {
    return text(lecture.lec_title || lecture.video_titile || lecture.title) || ("Bài học " + (index + 1));
  }

  function getVideoSource(lecture) {
    const vimeo = window.VimeoUtils && window.VimeoUtils.normalizeVimeoId(lecture.vimeo_id);
    if (vimeo) return { type: "vimeo", value: lecture.vimeo_id };
    const youtubeId = text(lecture.youtube_id || lecture.video_id);
    if (youtubeId && /^[a-zA-Z0-9_-]{6,}$/.test(youtubeId)) return { type: "youtube", value: youtubeId };
    return null;
  }

  function inferSection(title, path) {
    const value = normalized([title, ...path].join(" "));
    if (/kanji|han tu/.test(value)) return "Kanji";
    if (/ngu phap|grammar/.test(value)) return "Ngữ pháp";
    if (/doc hieu|reading/.test(value)) return "Đọc hiểu";
    if (/nghe|listening/.test(value)) return "Nghe hiểu";
    if (/tu vung|vocabulary/.test(value)) return "Từ vựng";
    return "Khác";
  }

  function loadLessons(data) {
    const lessons = [];

    function visit(group, ancestors, fallback) {
      if (!group || typeof group !== "object") return;
      const label = text(group.part_title || group.title || group.name || fallback);
      const path = label ? [...ancestors, label] : ancestors;

      if (Array.isArray(group.list_lectures)) {
        group.list_lectures.forEach((lecture, index) => {
          if (!lecture || typeof lecture !== "object") return;
          lessons.push({
            id: text(lecture.id) || (lessons.length + 1).toString(),
            data: lecture,
            title: getLessonTitle(lecture, index),
            breadcrumb: path.join(" / "),
            searchText: normalized([getLessonTitle(lecture, index), ...path].join(" ")),
            source: getVideoSource(lecture),
            section: inferSection(getLessonTitle(lecture, index), path)
          });
        });
      }

      const cats = Array.isArray(group.cats) ? group.cats : [];
      const groups = Array.isArray(group.lessons) ? group.lessons : [];
      cats.forEach((child, index) => visit(child, path, "Danh mục " + (index + 1)));
      groups.forEach((child, index) => visit(child, path, "Phần " + (index + 1)));
    }

    (Array.isArray(data) ? data : []).forEach((group, index) => visit(group, [], "Phần " + (index + 1)));
    return lessons;
  }

  async function init() {
    try {
      state.registry = await CourseData.loadRegistry();
      if (!state.registry.length) throw new Error("Chưa có khóa học trong data/index.json.");

      els.courseSelect.replaceChildren();
      state.registry.forEach(course => {
        const option = document.createElement("option");
        option.value = course.id;
        option.textContent = course.title;
        els.courseSelect.append(option);
      });

      const initial = state.registry.find(course => course.id === "n2") || state.registry[0];
      els.courseSelect.value = initial.id;
      await selectCourse(initial.id);
    } catch (error) {
      showNotice("Không tải được khóa học. " + error.message + " Hãy chạy website qua máy chủ tĩnh, ví dụ: python3 -m http.server 8000.");
      showEmpty("Không tải được dữ liệu", "Kiểm tra data/index.json và các file JSON trong thư mục data.");
    }
  }

  async function selectCourse(id) {
    const course = state.registry.find(item => item.id === id);
    if (!course) return;
    state.course = course;
    state.query = "";
    state.category = "Tất cả";
    els.search.value = "";
    els.currentCourse.textContent = course.title.toLocaleUpperCase("vi");
    els.notice.hidden = true;
    showLoading();

    try {
      const data = await CourseData.loadCourse(course);
      state.lessons = loadLessons(data);
      renderCategoryNav();
      renderLessons();
    } catch (error) {
      showNotice("Không thể tải dữ liệu “" + course.title + "”: " + error.message);
      showEmpty("Chưa thể hiển thị khóa học", "Kiểm tra đường dẫn dữ liệu trong data/index.json rồi tải lại trang.");
    }
  }

  function visibleLessons() {
    const query = normalized(state.query);
    return state.lessons.filter(lesson => (!query || lesson.searchText.includes(query)) && (state.category === "Tất cả" || lesson.section === state.category));
  }

  function showLoading() {
    els.lessonList.replaceChildren();
    const box = document.createElement("div");
    box.className = "empty-state";
    box.innerHTML = '<span class="spinner" aria-hidden="true"></span><p>Đang tải bài học…</p>';
    els.lessonList.append(box);
  }

  function showEmpty(title, description) {
    els.lessonList.replaceChildren();
    const box = document.createElement("div");
    box.className = "empty-state";
    const strong = document.createElement("strong");
    strong.textContent = title;
    const p = document.createElement("p");
    p.textContent = description;
    box.append(strong, p);
    els.lessonList.append(box);
    els.resultCount.textContent = "";
  }

  function renderLessons() {
    const lessons = visibleLessons();
    els.lessonList.replaceChildren();
    els.resultCount.textContent = state.query
      ? lessons.length + " kết quả"
      : lessons.length + " bài học";

    if (!lessons.length) {
      showEmpty("Không tìm thấy bài học", "Thử tìm bằng một từ khóa khác.");
      return;
    }

    const fragment = document.createDocumentFragment();
    lessons.forEach((lesson, index) => fragment.append(createLessonCard(lesson, index)));
    els.lessonList.append(fragment);
  }

  function renderCategoryNav() {
    const preferred = ["Từ vựng", "Kanji", "Ngữ pháp", "Đọc hiểu", "Nghe hiểu", "Khác"];
    const available = new Set(state.lessons.map(item => item.section));
    const categories = ["Tất cả", ...preferred.filter(item => available.has(item))];
    els.categoryNav.replaceChildren();
    categories.forEach(category => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "category-tab" + (state.category === category ? " active" : "");
      button.textContent = category;
      button.addEventListener("click", () => { state.category = category; renderCategoryNav(); renderLessons(); });
      els.categoryNav.append(button);
    });
  }

  function createLessonCard(lesson) {
    const article = document.createElement("article");
    article.className = "lesson-card section-" + ({"Từ vựng":"vocab","Kanji":"kanji","Ngữ pháp":"grammar","Đọc hiểu":"reading","Nghe hiểu":"listening","Khác":"other"}[lesson.section] || "other");
    const cover = document.createElement("button");
    cover.type = "button";
    cover.className = "lesson-cover";
    cover.setAttribute("aria-label", lesson.source ? "Phát " + lesson.title : lesson.title + " — chưa có video");
    if (!lesson.source || lesson.data.is_lock === true) cover.disabled = true;
    const copy = document.createElement("span"); copy.className = "card-copy";
    const section = document.createElement("span"); section.className = "section-label"; section.textContent = lesson.section;
    const title = document.createElement("span"); title.className = "lesson-title"; title.textContent = lesson.title;
    const breadcrumb = document.createElement("span"); breadcrumb.className = "lesson-breadcrumb";
    breadcrumb.textContent = [state.course ? state.course.title : "", lesson.section, lesson.breadcrumb].filter(Boolean).join(" / ");
    copy.append(section, title, breadcrumb); cover.append(copy);
    const sketch = document.createElement("span"); sketch.className = "sketch-lines"; sketch.setAttribute("aria-hidden", "true"); cover.append(sketch);
    if (lesson.source && lesson.data.is_lock !== true) {
      const play = document.createElement("span"); play.className = "play-button"; play.setAttribute("aria-hidden", "true"); play.innerHTML = iconPlay(); cover.append(play);
      cover.addEventListener("click", () => openVideo(lesson));
    }
    article.append(cover); return article;
  }

  function openVideo(lesson) {
    let url;
    if (lesson.source.type === "vimeo") {
      url = window.VimeoUtils.playerUrl(lesson.source.value, true);
    } else {
      url = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(lesson.source.value) + "?autoplay=1&rel=0";
    }
    if (!url) {
      showToast("Bài học chưa có đường dẫn video hợp lệ.");
      return;
    }

    state.lastFocused = document.activeElement;
    els.modalTitle.textContent = lesson.title;
    els.frameHost.replaceChildren();
    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.title = lesson.title;
    iframe.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    els.frameHost.append(iframe);
    els.modal.hidden = false;
    document.body.style.overflow = "hidden";
    els.closeModal.focus();
  }

  function closeVideo() {
    if (els.modal.hidden) return;
    els.modal.hidden = true;
    els.frameHost.replaceChildren();
    document.body.style.overflow = "";
    if (state.lastFocused && typeof state.lastFocused.focus === "function") state.lastFocused.focus();
  }

  function showNotice(message) {
    els.notice.textContent = message;
    els.notice.hidden = false;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2400);
  }

  els.courseSelect.addEventListener("change", event => selectCourse(event.target.value));
  els.search.addEventListener("input", event => {
    state.query = event.target.value;
    renderLessons();
  });
  els.closeModal.addEventListener("click", closeVideo);
  els.modal.addEventListener("click", event => {
    if (event.target === els.modal) closeVideo();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeVideo();
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      els.search.focus();
    }
  });

  init();
})();
