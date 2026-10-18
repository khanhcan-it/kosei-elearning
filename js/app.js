/* Study Notes app controller. All course content is rendered from JSON. */
(function () {
  "use strict";
  const $ = selector => document.querySelector(selector);
  const els = {
    courseSelect: $("#courseSelect"), search: $("#searchInput"), tree: $("#courseTree"),
    lessonList: $("#lessonList"), pageTitle: $("#pageTitle"), pageSubtitle: $("#pageSubtitle"),
    breadcrumb: $("#breadcrumb"), sectionTitle: $("#sectionTitle"), sectionMeta: $("#sectionMeta"),
    filter: $("#filterSelect"), progressPercent: $("#progressPercent"), progressText: $("#progressText"),
    progressBar: $("#progressBar"), resultCount: $("#resultCount"), notice: $("#notice"),
    modal: $("#videoModal"), modalTitle: $("#modalTitle"), frameHost: $("#videoFrameHost"),
    closeModal: $("#closeModalButton"), collapseAll: $("#collapseAllButton"),
    mobileMenu: $("#mobileMenuButton"), sidebar: $("#sidebar"), sidebarBackdrop: $("#sidebarBackdrop"),
    gridView: $("#gridViewButton"), listView: $("#listViewButton"), toast: $("#toast")
  };
  const STORAGE_PROGRESS = "study-notes:progress:v1";
  const state = {
    registry: [], course: null, raw: [], nodes: [], lectures: [], selectedNodeId: "all",
    search: "", filter: "all", view: "grid", expanded: new Set(), progress: readProgress(),
    lastFocused: null, toastTimer: null, treeIndex: new Map()
  };

  function readProgress() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_PROGRESS) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch (_) { return {}; }
  }
  function saveProgress() {
    try { localStorage.setItem(STORAGE_PROGRESS, JSON.stringify(state.progress)); } catch (_) {
      showToast("Trình duyệt không cho phép lưu tiến độ trên thiết bị này.");
    }
  }
  function escText(value) { return String(value == null ? "" : value); }
  function normalized(value) {
    return escText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi").trim();
  }
  function validArray(value) { return Array.isArray(value) ? value : []; }
  function safeId(value) { return value == null ? "" : String(value); }
  function isVideo(lecture) { return !!(window.VimeoUtils && window.VimeoUtils.normalizeVimeoId(lecture && lecture.vimeo_id)); }
  function isLearned(lecture) {
    const key = progressKey(lecture);
    return Object.prototype.hasOwnProperty.call(state.progress, key) ? !!state.progress[key] : Number(lecture.learned) === 1 || lecture.learned === true;
  }
  function progressKey(lecture) { return String(state.course ? state.course.id : "course") + ":" + safeId(lecture.id); }
  function countLectures(node) {
    if (!node) return 0;
    if (node.kind === "lecture") return 1;
    return (node.children || []).reduce((sum, child) => sum + countLectures(child), 0);
  }
  function allLectures(node) {
    if (!node) return [];
    if (node.kind === "lecture") return [node.data];
    return (node.children || []).flatMap(allLectures);
  }
  function buildTree(data) {
    const nodes = [];
    function addGroup(item, parent, path, fallbackLabel) {
      if (!item || typeof item !== "object") return;
      const title = escText(item.part_title || item.title || item.name || fallbackLabel || "Nội dung");
      const id = safeId(item.id || (path.join("-") + "-" + title));
      const node = { id: id, title, data: item, parent, path: [...path, title], children: [], kind: "group" };
      if (parent) parent.children.push(node); else nodes.push(node);
      state.treeIndex.set(id, node);
      // Actual supplied schema: root[].cats[].lessons[].list_lectures[].
      validArray(item.cats).forEach((child, i) => addGroup(child, node, node.path, "Nhóm " + (i + 1)));
      validArray(item.lessons).forEach((child, i) => addGroup(child, node, node.path, "Bài " + (i + 1)));
      validArray(item.list_lectures).forEach((lecture, i) => {
        if (!lecture || typeof lecture !== "object") return;
        const lectureNode = { id: safeId(lecture.id || (id + "-lecture-" + i)), title: escText(lecture.lec_title || lecture.video_titile || ("Bài học " + (i + 1))), data: lecture, parent: node, path: [...node.path, escText(lecture.lec_title || "Bài học")], children: [], kind: "lecture" };
        node.children.push(lectureNode);
        state.treeIndex.set(lectureNode.id, lectureNode);
      });
    }
    state.treeIndex.clear();
    validArray(data).forEach((item, i) => addGroup(item, null, [], "Phần " + (i + 1)));
    return nodes;
  }
  function flattenLectures(nodes) { return nodes.flatMap(node => node.kind === "lecture" ? [node] : flattenLectures(node.children || [])); }
  function countGroups(nodes) { return nodes.reduce((sum, node) => sum + (node.kind === "group" ? 1 + countGroups(node.children || []) : 0), 0); }

  async function init() {
    try {
      state.registry = await CourseData.loadRegistry();
      if (!state.registry.length) throw new Error("Chưa có khóa học nào trong data/index.json.");
      els.courseSelect.replaceChildren();
      state.registry.forEach(course => {
        const option = document.createElement("option");
        option.value = course.id; option.textContent = course.title; els.courseSelect.append(option);
      });
      const preferred = state.registry.find(item => item.id === "n2") || state.registry[0];
      els.courseSelect.value = preferred.id;
      await selectCourse(preferred.id);
    } catch (error) {
      showNotice("Không thể khởi tạo website: " + error.message + ". Hãy chạy qua máy chủ tĩnh (ví dụ python3 -m http.server 8000), không mở index.html trực tiếp.");
      els.tree.textContent = "Không thể tải danh mục.";
      els.lessonList.innerHTML = '<div class="empty-state"><strong>Không tải được dữ liệu</strong><p>Kiểm tra data/index.json và chạy website qua máy chủ cục bộ.</p></div>';
      els.sectionMeta.textContent = "Lỗi tải dữ liệu";
    }
  }

  async function selectCourse(id) {
    const course = state.registry.find(item => item.id === id);
    if (!course) return;
    state.course = course; state.selectedNodeId = "all"; state.expanded.clear(); state.treeIndex.clear();
    els.pageTitle.textContent = course.title;
    els.pageSubtitle.textContent = "Một không gian gọn gàng để học tập theo nhịp độ của riêng bạn.";
    els.sectionTitle.textContent = "Tất cả bài học";
    els.notice.hidden = true;
    els.tree.innerHTML = '<div class="tree-loading"><span class="spinner"></span> Đang tải nội dung…</div>';
    els.lessonList.innerHTML = '<div class="empty-state"><span class="spinner"></span><p>Đang tải bài học…</p></div>';
    try {
      const data = await CourseData.loadCourse(course);
      if (!Array.isArray(data)) throw new Error("Dữ liệu khóa học phải là một mảng JSON.");
      state.raw = data;
      state.nodes = buildTree(data);
      state.lectures = flattenLectures(state.nodes).map(node => node.data);
      state.nodes.forEach(node => state.expanded.add(node.id));
      state.nodes.forEach(node => (node.children || []).forEach(child => state.expanded.add(child.id)));
      renderTree(); renderLessons(); updateProgress();
      els.pageTitle.textContent = course.title;
      els.pageSubtitle.textContent = state.lectures.length + " bài học · " + countGroups(state.nodes) + " mục nội dung để bạn khám phá.";
    } catch (error) {
      showNotice("Không thể tải dữ liệu khóa học “" + course.title + "”: " + error.message + ". Kiểm tra lại đường dẫn trong data/index.json.");
      els.tree.textContent = "Không có dữ liệu để hiển thị.";
      els.lessonList.innerHTML = '<div class="empty-state"><strong>Chưa thể hiển thị khóa học</strong><p>Hãy kiểm tra file JSON và tải lại trang.</p></div>';
      els.sectionMeta.textContent = "Lỗi tải dữ liệu";
    }
  }

  function icon(name) {
    const paths = {
      chevron: '<path d="m9 18 6-6-6-6"/>',
      folder: '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/>',
      book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16M8 7h8"/>',
      video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
      file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      circle: '<circle cx="12" cy="12" r="9"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || paths.folder) + '</svg>';
  }
  function makeTreeRow(node, level) {
    const row = document.createElement("button");
    row.type = "button"; row.className = "tree-row";
    row.style.paddingLeft = (9 + Math.min(level, 5) * 8) + "px";
    const expanded = state.expanded.has(node.id);
    row.setAttribute("aria-expanded", String(expanded));
    if (state.selectedNodeId === node.id) row.classList.add("selected");
    const chev = document.createElement("span"); chev.className = "tree-chevron"; chev.innerHTML = node.kind === "group" && node.children.length ? icon("chevron") : ""; row.append(chev);
    const sym = document.createElement("span"); sym.className = "tree-symbol"; sym.innerHTML = icon(node.kind === "lecture" ? (isVideo(node.data) ? "video" : "file") : "folder"); row.append(sym);
    const label = document.createElement("span"); label.className = "tree-label"; label.textContent = node.title; row.append(label);
    const count = document.createElement("span"); count.className = "tree-count"; count.textContent = node.kind === "lecture" ? "" : String(countLectures(node)); row.append(count);
    row.addEventListener("click", () => {
      if (node.kind === "group" && node.children.length) {
        if (state.expanded.has(node.id)) state.expanded.delete(node.id); else state.expanded.add(node.id);
      }
      state.selectedNodeId = node.id;
      renderTree(); renderLessons(); closeMobileSidebar();
    });
    const wrapper = document.createElement("div"); wrapper.className = "tree-node"; wrapper.append(row);
    if (node.kind === "group" && node.children.length && expanded) {
      const children = document.createElement("div"); children.className = "tree-children";
      node.children.forEach(child => children.append(makeTreeRow(child, level + 1)));
      wrapper.append(children);
    }
    return wrapper;
  }
  function renderTree() {
    els.tree.replaceChildren();
    const allButton = document.createElement("button");
    allButton.type = "button"; allButton.className = "tree-row" + (state.selectedNodeId === "all" ? " selected" : "");
    allButton.innerHTML = '<span class="tree-chevron"></span><span class="tree-symbol">' + icon("book") + '</span><span class="tree-label">Tất cả bài học</span><span class="tree-count">' + state.lectures.length + '</span>';
    allButton.addEventListener("click", () => { state.selectedNodeId = "all"; renderTree(); renderLessons(); closeMobileSidebar(); });
    els.tree.append(allButton);
    state.nodes.forEach(node => els.tree.append(makeTreeRow(node, 0)));
  }

  function getVisibleLectures() {
    let nodes;
    if (state.selectedNodeId === "all") nodes = flattenLectures(state.nodes);
    else {
      const selected = state.treeIndex.get(state.selectedNodeId);
      nodes = selected ? flattenLectures([selected]) : flattenLectures(state.nodes);
      if (selected && selected.kind === "lecture") nodes = [selected];
    }
    const query = normalized(state.search);
    return nodes.filter(node => {
      const lecture = node.data;
      const path = node.path.join(" ");
      const queryMatch = !query || normalized([lecture.lec_title, lecture.video_titile, path].join(" ")).includes(query);
      if (!queryMatch) return false;
      const video = isVideo(lecture), learned = isLearned(lecture);
      switch (state.filter) {
        case "free": return Number(lecture.free) === 1;
        case "learned": return learned;
        case "unlearned": return !learned;
        case "video": return video;
        case "no-video": return !video;
        default: return true;
      }
    });
  }
  function createThumb(lecture) {
    const button = document.createElement("button");
    button.className = "lesson-thumb"; button.type = "button";
    const hasVideo = isVideo(lecture);
    button.setAttribute("aria-label", hasVideo ? "Phát " + escText(lecture.lec_title) : "Mục không có video: " + escText(lecture.lec_title));
    const placeholder = document.createElement("div"); placeholder.className = "thumb-placeholder"; placeholder.innerHTML = icon(hasVideo ? "video" : "file");
    const label = document.createElement("span"); label.textContent = hasVideo ? "Đang tải thumbnail…" : "Bài kiểm tra / tài liệu"; placeholder.append(label);
    button.append(placeholder);
    if (hasVideo) {
      const badge = document.createElement("span"); badge.className = "thumb-label" + (lecture.is_lock === true ? " locked" : Number(lecture.free) === 1 ? " free" : "");
      badge.textContent = lecture.is_lock === true ? "Đã khóa" : Number(lecture.free) === 1 ? "MIỄN PHÍ" : "VIDEO";
      button.append(badge);
      const play = document.createElement("span"); play.className = "play-button"; play.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"/></svg>'; button.append(play);
      button.addEventListener("click", () => {
        if (lecture.is_lock === true) { showToast("Bài học này đang được đánh dấu là đã khóa."); return; }
        openVideo(lecture);
      });
      const loadThumbnail = async () => {
        const url = await VimeoUtils.thumbnail(lecture.vimeo_id);
        if (!url || !button.isConnected) {
          const span = placeholder.querySelector("span"); if (span) span.textContent = "Video Vimeo";
          return;
        }
        const img = document.createElement("img");
        img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.src = url;
        img.onerror = () => { img.remove(); const span = placeholder.querySelector("span"); if (span) span.textContent = "Video Vimeo"; };
        button.insertBefore(img, button.firstChild);
        placeholder.remove();
      };
      if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver(entries => {
          if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); loadThumbnail(); }
        }, { rootMargin: "180px" });
        observer.observe(button);
      } else loadThumbnail();
    } else {
      button.disabled = true;
      button.style.cursor = "default";
    }
    return button;
  }
  function createLessonCard(node) {
    const lecture = node.data, video = isVideo(lecture), learned = isLearned(lecture);
    const card = document.createElement("article"); card.className = "lesson-card";
    card.append(createThumb(lecture));
    const body = document.createElement("div"); body.className = "lesson-body";
    const title = document.createElement("h3"); title.className = "lesson-title"; title.textContent = escText(lecture.lec_title || lecture.video_titile || node.title); title.title = title.textContent; body.append(title);
    const footer = document.createElement("div"); footer.className = "lesson-card-footer";
    const type = document.createElement("span"); type.className = "lesson-type"; type.innerHTML = icon(video ? "video" : "file");
    const typeText = document.createElement("span"); typeText.textContent = video ? "Bài học video" : "Bài kiểm tra / tài liệu"; type.append(typeText); footer.append(type);
    const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "learn-toggle" + (learned ? " is-learned" : "");
    toggle.innerHTML = icon(learned ? "check" : "circle");
    const toggleText = document.createElement("span"); toggleText.textContent = learned ? "Đã học" : "Đánh dấu học"; toggle.append(toggleText);
    toggle.setAttribute("aria-pressed", String(learned));
    toggle.addEventListener("click", () => {
      state.progress[progressKey(lecture)] = !isLearned(lecture);
      saveProgress(); renderLessons(); updateProgress();
      showToast(state.progress[progressKey(lecture)] ? "Đã lưu trạng thái hoàn thành." : "Đã cập nhật trạng thái bài học.");
    });
    footer.append(toggle); body.append(footer); card.append(body);
    return card;
  }
  function renderLessons() {
    if (!state.nodes.length) return;
    const visible = getVisibleLectures();
    els.lessonList.className = state.view === "list" ? "lesson-list" : "lesson-grid";
    els.lessonList.replaceChildren();
    const selected = state.selectedNodeId === "all" ? null : state.treeIndex.get(state.selectedNodeId);
    const title = selected ? selected.title : (state.search ? "Kết quả tìm kiếm" : "Tất cả bài học");
    els.sectionTitle.textContent = title;
    const path = selected ? selected.path : [];
    els.breadcrumb.replaceChildren();
    const crumbAll = document.createElement("span"); crumbAll.textContent = state.course ? state.course.title : "Khóa học"; els.breadcrumb.append(crumbAll);
    path.forEach(part => { const span = document.createElement("span"); span.textContent = part; els.breadcrumb.append(span); });
    const learnedCount = visible.filter(node => isLearned(node.data)).length;
    els.sectionMeta.textContent = visible.length + " bài học · " + learnedCount + " đã hoàn thành";
    els.resultCount.textContent = "Hiển thị " + visible.length + " / " + state.lectures.length + " bài";
    if (!visible.length) {
      const empty = document.createElement("div"); empty.className = "empty-state";
      empty.innerHTML = '<div class="empty-icon">' + icon("file") + '</div>';
      const strong = document.createElement("strong"); strong.textContent = "Không tìm thấy bài học phù hợp"; empty.append(strong);
      const p = document.createElement("p"); p.textContent = "Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc."; empty.append(p);
      els.lessonList.append(empty); return;
    }
    visible.forEach(node => els.lessonList.append(createLessonCard(node)));
  }
  function updateProgress() {
    const total = state.lectures.length;
    const learned = state.lectures.filter(isLearned).length;
    const percent = total ? Math.round(learned / total * 100) : 0;
    els.progressPercent.textContent = percent + "%";
    els.progressText.textContent = learned + " / " + total + " bài đã hoàn thành";
    els.progressBar.style.width = percent + "%";
  }
  function openVideo(lecture) {
    const url = VimeoUtils.playerUrl(lecture.vimeo_id, true);
    if (!url) { showToast("Bài học này chưa có mã Vimeo hợp lệ."); return; }
    state.lastFocused = document.activeElement;
    els.modalTitle.textContent = escText(lecture.lec_title || "Bài học");
    els.frameHost.replaceChildren();
    const iframe = document.createElement("iframe");
    iframe.src = url; iframe.title = escText(lecture.lec_title || "Vimeo video");
    iframe.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
    iframe.allowFullscreen = true; iframe.referrerPolicy = "strict-origin-when-cross-origin";
    els.frameHost.append(iframe);
    els.modal.hidden = false; document.body.style.overflow = "hidden";
    els.closeModal.focus();
  }
  function closeVideo() {
    if (els.modal.hidden) return;
    els.modal.hidden = true; els.frameHost.replaceChildren(); document.body.style.overflow = "";
    if (state.lastFocused && typeof state.lastFocused.focus === "function") state.lastFocused.focus();
  }
  function showNotice(message) { els.notice.textContent = message; els.notice.hidden = false; }
  function showToast(message) {
    els.toast.textContent = message; els.toast.classList.add("show");
    clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2400);
  }
  function closeMobileSidebar() {
    els.sidebar.classList.remove("open"); els.sidebarBackdrop.classList.remove("show");
    els.mobileMenu.setAttribute("aria-expanded", "false");
  }
  function toggleSearchFocus() {
    if (window.matchMedia("(max-width: 600px)").matches) {
      const box = document.querySelector(".searchbox");
      box.classList.toggle("search-open");
      if (box.classList.contains("search-open")) els.search.focus();
    } else els.search.focus();
  }

  els.courseSelect.addEventListener("change", event => selectCourse(event.target.value));
  els.search.addEventListener("input", event => { state.search = event.target.value; renderLessons(); });
  els.filter.addEventListener("change", event => { state.filter = event.target.value; renderLessons(); });
  els.gridView.addEventListener("click", () => { state.view = "grid"; els.gridView.classList.add("active"); els.listView.classList.remove("active"); renderLessons(); });
  els.listView.addEventListener("click", () => { state.view = "list"; els.listView.classList.add("active"); els.gridView.classList.remove("active"); renderLessons(); });
  els.collapseAll.addEventListener("click", () => {
    if (state.expanded.size) { state.expanded.clear(); els.collapseAll.textContent = "Mở rộng"; }
    else { state.treeIndex.forEach(node => { if (node.kind === "group" && node.children.length) state.expanded.add(node.id); }); els.collapseAll.textContent = "Thu gọn"; }
    renderTree();
  });
  els.closeModal.addEventListener("click", closeVideo);
  els.modal.addEventListener("click", event => { if (event.target === els.modal) closeVideo(); });
  document.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); toggleSearchFocus(); }
    if (event.key === "Escape") { closeVideo(); closeMobileSidebar(); }
  });
  els.mobileMenu.addEventListener("click", () => {
    const open = !els.sidebar.classList.contains("open");
    els.sidebar.classList.toggle("open", open); els.sidebarBackdrop.classList.toggle("show", open);
    els.mobileMenu.setAttribute("aria-expanded", String(open));
  });
  els.sidebarBackdrop.addEventListener("click", closeMobileSidebar);
  document.querySelector(".searchbox").addEventListener("click", event => {
    if (event.target.closest("kbd")) toggleSearchFocus();
    else if (window.matchMedia("(max-width: 600px)").matches && !document.querySelector(".searchbox").classList.contains("search-open")) toggleSearchFocus();
  });
  init();
})();