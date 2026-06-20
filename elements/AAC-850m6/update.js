function(instance, properties, context) {
  try {
    const win = window;
    const doc = document;
    const D3 = win.d3;
    const html2canvasRef = win.html2canvas;
    const jsPDFRef = win.jspdf && win.jspdf.jsPDF;
    const canvas = instance.canvas && instance.canvas[0];
    const uid = instance.data._org_uid || ("org_" + Math.random().toString(36).slice(2));
    instance.data._org_uid = uid;

    const FALLBACK_AVATAR = properties.fallback_avatar_url || "https://static.vecteezy.com/ti/vetor-gratis/p1/26434417-padrao-avatar-perfil-icone-do-social-meios-de-comunicacao-do-utilizador-foto-vetor.jpg";
    const noop = function() {};
    const str = function(v) { return v == null ? "" : String(v); };
    const bool = function(v, d) { return typeof v === "boolean" ? v : d; };
    const num = function(v, d, min, max) {
      const n = Number(v);
      const out = Number.isFinite(n) ? n : d;
      return Math.min(max == null ? out : max, Math.max(min == null ? out : min, out));
    };
    const esc = function(v) {
      return str(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    };
    const safePublish = function(name, value) { try { instance.publishState(name, value); } catch (e) {} };
    const safeTrigger = function(name) { try { instance.triggerEvent(name); } catch (e) {} };
    const setStatus = function(status, error) {
      safePublish("plugin_status", status);
      safePublish("plugin_error", error || "");
      if (error) safeTrigger("organograma_error");
    };
    const getField = function(item, field) {
      try {
        if (!item || !field || typeof item.get !== "function") return null;
        const value = item.get(field);
        if (value && typeof value === "object" && typeof value.get === "function") return value.get("_id");
        return value == null ? null : value;
      } catch (e) {
        return null;
      }
    };
    const normalizeHex = function(hex, fallback) {
      const raw = str(hex || "").trim();
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw;
      return fallback;
    };
    const hexToRgb = function(hex) {
      let h = normalizeHex(hex, "#0b6b8b").replace("#", "");
      if (h.length === 3) h = h.split("").map(function(c) { return c + c; }).join("");
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
    };
    const rgbToHex = function(r, g, b) {
      const c = function(v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"); };
      return "#" + c(r) + c(g) + c(b);
    };
    const shade = function(hex, percent) {
      const rgb = hexToRgb(hex);
      const p = percent / 100;
      const target = p < 0 ? 0 : 255;
      const abs = Math.abs(p);
      return rgbToHex(rgb.r + (target - rgb.r) * abs, rgb.g + (target - rgb.g) * abs, rgb.b + (target - rgb.b) * abs);
    };
    const parseJson = function(value, fallback) {
      if (!value) return fallback;
      if (typeof value === "object") return value;
      try { return JSON.parse(String(value)); } catch (e) { return fallback; }
    };
    const icon = {
      search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.5 6.5 0 1 0 14 15.5l.27.28v.79l4.6 4.58 1.42-1.42-4.6-4.58zM9.5 14A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>',
      reset: '<svg viewBox="0 0 24 24"><path d="M12 6V3L8 7l4 4V8a5 5 0 1 1-4.58 7H5.3A7 7 0 1 0 12 6z"/></svg>',
      prev: '<svg viewBox="0 0 24 24"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z"/></svg>',
      next: '<svg viewBox="0 0 24 24"><path d="M8.6 16.6 13.2 12 8.6 7.4 10 6l6 6-6 6z"/></svg>',
      fit: '<svg viewBox="0 0 24 24"><path d="M5 5h5V3H3v7h2V5zm9-2v2h5v5h2V3h-7zM5 14H3v7h7v-2H5v-5zm14 5h-5v2h7v-7h-2v5z"/></svg>',
      vertical: '<svg viewBox="0 0 24 24"><path d="M11 3h2v18h-2zM5 7h2v10H5zM17 7h2v10h-2z"/></svg>',
      horizontal: '<svg viewBox="0 0 24 24"><path d="M3 11h18v2H3zM7 5h10v2H7zM7 17h10v2H7z"/></svg>',
      pdf: '<svg viewBox="0 0 24 24"><path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 1.5V8h4.5zM7 13h2.2a2 2 0 0 1 0 4H8v2H7zm1 1.4v1.2h1.1a.6.6 0 0 0 0-1.2zM12 13h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2zm1.5 1.5v3h.5a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5z"/></svg>',
      image: '<svg viewBox="0 0 24 24"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8.5 8.5A1.5 1.5 0 1 1 7 7a1.5 1.5 0 0 1 1.5 1.5zM5 18l4.2-5.2 3 3.6 2-2.4L19 18z"/></svg>',
      collapse: '<svg viewBox="0 0 24 24"><path d="M5 11h14v2H5z"/></svg>',
      expand: '<svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
      drag: '<svg viewBox="0 0 24 24"><path d="M13 2v8h8v4h-8v8h-4v-8H1v-4h8V2z"/></svg>',
      close: "x"
    };

    setStatus("loading", "");
    safePublish("selected_node", "");
    safePublish("selected_node_id", "");
    safePublish("selected_parent_id", "");
    safePublish("selected_drag_coord", "");
    safePublish("search_result_count", 0);

    if (!canvas) {
      setStatus("error", "Canvas not available");
      return;
    }
    if (!D3) {
      canvas.innerHTML = "<div class='org-pro-root'><div class='org-pro-error'>D3 was not loaded. Check the plugin Header.</div></div>";
      setStatus("error", "D3 was not loaded");
      return;
    }

    const config = {
      showSearch: bool(properties.show_search, true),
      showOrientation: bool(properties.show_orientation, true),
      showExportPdf: bool(properties.show_export_pdf, true),
      showExportPng: bool(properties.show_export_png, true),
      showFit: bool(properties.show_fit_button, true),
      showExpandCollapse: bool(properties.show_expand_collapse_buttons, true),
      showDrag: bool(properties.show_drag_button, true),
      showPanel: bool(properties.show_details_panel, true),
      openPanelOnSearch: bool(properties.open_panel_on_search, true),
      openPanelOnClick: bool(properties.open_panel_on_click, true),
      includeToolbarExport: bool(properties.export_include_toolbar, false),
      autoFit: bool(properties.auto_fit_on_render, true),
      dragSubtree: bool(properties.drag_subtree, true),
      searchFields: str(properties.search_fields || "name,role,field_1,field_2,field_3,field_4,field_5").split(",").map(function(x) { return x.trim(); }).filter(Boolean),
      orientation: (str(instance.data._saved_orientation || properties.default_orientation || "vertical").toLowerCase() === "horizontal") ? "horizontal" : "vertical",
      nodeW: num(properties.card_width, 270, 160, 520),
      nodeH: num(properties.card_height, 104, 70, 260),
      avatarSize: num(properties.card_avatar_size, 58, 28, 140),
      levelSpacing: num(properties.level_spacing, 150, 70, 500),
      siblingSpacing: num(properties.sibling_spacing, 230, 100, 700),
      horizontalExtra: num(properties.horizontal_extra_spacing, 250, 0, 900),
      cardVOffset: num(properties.card_vertical_offset, 8, -200, 200),
      cardHOffset: num(properties.card_horizontal_offset, 100, -300, 500),
      connectorColor: properties.connector_color || "#d2d8dc",
      connectorWidth: num(properties.connector_width, 1.6, 0.5, 8),
      bgColor: normalizeHex(properties.background_color, "#f7fbfc"),
      cardColor: normalizeHex(properties.card_bg_color, "#0b6b8b"),
      accentColor: normalizeHex(properties.accent_color, "#0b6b8b"),
      textColor: properties.text_color || "#0b1b2b",
      popupWidth: num(properties.popup_width, 430, 280, 760),
      exportScale: num(properties.export_scale, 2, 1, 4),
      filenamePrefix: str(properties.export_filename_prefix || "organograma"),
      selectedNodeId: str(properties.selected_node_id || instance.data._saved_selected_id || ""),
      initialCollapsed: parseJson(properties.initial_collapsed_ids, []),
      savedPositions: parseJson(properties.positions_json, null),
      emptyMessage: str(properties.empty_message || "No data"),
      noRootMessage: str(properties.no_root_message || "No root found"),
      title1: str(properties.field_title_1 || "Field 1"),
      title2: str(properties.field_title_2 || "Field 2"),
      title3: str(properties.field_title_3 || "Field 3"),
      title4: str(properties.field_title_4 || "Field 4"),
      title5: str(properties.field_title_5 || "Field 5")
    };
    instance.data._saved_orientation = config.orientation;

    let collapsedMap = instance.data._collapsed_map || {};
    if (Array.isArray(config.initialCollapsed) && !instance.data._collapsed_initialized) {
      config.initialCollapsed.forEach(function(id) { if (id != null) collapsedMap[String(id)] = true; });
      instance.data._collapsed_initialized = true;
    }
    let dragActive = !!instance.data._drag_button_active;
    let selectedId = config.selectedNodeId;
    let searchResults = [];
    let currentResultIndex = -1;
    let renderedNodes = [];
    let roots = [];
    let childMap = {};
    let nodeMap = {};
    let svg;
    let container;
    let zoom;
    let dragLayer;

    canvas.innerHTML = "";
    const wrapper = doc.createElement("div");
    wrapper.id = uid;
    wrapper.className = "org-pro-root";
    wrapper.style.setProperty("--org-bg", config.bgColor);
    wrapper.style.setProperty("--org-accent", config.accentColor);
    wrapper.style.setProperty("--org-accent-strong", shade(config.accentColor, -20));
    wrapper.style.setProperty("--org-text", config.textColor);
    canvas.appendChild(wrapper);

    const canvasLayer = doc.createElement("div");
    canvasLayer.className = "org-pro-canvas";
    wrapper.appendChild(canvasLayer);

    function showToast(message, ms) {
      let toast = wrapper.querySelector(".org-pro-toast");
      if (!toast) {
        toast = doc.createElement("div");
        toast.className = "org-pro-toast org-no-export";
        wrapper.appendChild(toast);
      }
      toast.textContent = message;
      toast.classList.add("is-visible");
      clearTimeout(toast._timer);
      toast._timer = setTimeout(function() { toast.classList.remove("is-visible"); }, ms || 2400);
    }
    function empty(message, isError) {
      canvasLayer.innerHTML = "<div class='" + (isError ? "org-pro-error" : "org-pro-empty") + "'>" + esc(message) + "</div>";
    }
    function renderToolbar() {
      const toolbar = doc.createElement("div");
      toolbar.className = "org-pro-toolbar org-no-export";
      toolbar.innerHTML =
        (config.showSearch ? '<input class="org-pro-search" id="' + uid + '_search" type="search" placeholder="Pesquisar..." autocomplete="off">' : "") +
        '<div class="org-pro-actions">' +
          (config.showSearch ? '<button class="org-pro-btn" id="' + uid + '_search_btn" title="Buscar">' + icon.search + '</button><button class="org-pro-btn" id="' + uid + '_reset_btn" title="Limpar busca">' + icon.reset + '</button>' : "") +
          (config.showFit ? '<button class="org-pro-btn" id="' + uid + '_fit_btn" title="Ajustar na tela">' + icon.fit + '</button>' : "") +
          (config.showExpandCollapse ? '<button class="org-pro-btn" id="' + uid + '_expand_btn" title="Expandir tudo">' + icon.expand + '</button><button class="org-pro-btn" id="' + uid + '_collapse_btn" title="Colapsar tudo">' + icon.collapse + '</button>' : "") +
          (config.showExportPdf ? '<button class="org-pro-btn" id="' + uid + '_pdf_btn" title="Exportar PDF">' + icon.pdf + '</button>' : "") +
          (config.showExportPng ? '<button class="org-pro-btn" id="' + uid + '_png_btn" title="Exportar PNG">' + icon.image + '</button>' : "") +
        '</div>' +
        '<div class="org-pro-nav org-pro-hidden" id="' + uid + '_nav"><button class="org-pro-btn" id="' + uid + '_prev_btn" title="Anterior">' + icon.prev + '</button><span class="org-pro-nav-count" id="' + uid + '_count">0/0</span><button class="org-pro-btn" id="' + uid + '_next_btn" title="Proximo">' + icon.next + '</button></div>' +
        (config.showOrientation ? '<div class="org-pro-orientation"><button class="org-pro-btn org-pro-btn-text" id="' + uid + '_vertical_btn" title="Vertical">' + icon.vertical + '<span>Vertical</span></button><button class="org-pro-btn org-pro-btn-text" id="' + uid + '_horizontal_btn" title="Horizontal">' + icon.horizontal + '<span>Horizontal</span></button></div>' : "");
      wrapper.appendChild(toolbar);

      if (config.showDrag) {
        const floating = doc.createElement("div");
        floating.className = "org-pro-floating-left org-no-export";
        floating.innerHTML = '<div class="org-pro-drag-panel"><button class="org-pro-btn org-pro-btn-text" id="' + uid + '_drag_btn" title="Mover cards">' + icon.drag + '<span>Arrastar</span></button></div>';
        wrapper.appendChild(floating);
      }

      const qs = function(id) { return wrapper.querySelector("#" + uid + "_" + id); };
      if (qs("search_btn")) qs("search_btn").onclick = function() { search(qs("search").value); };
      if (qs("search")) qs("search").addEventListener("keydown", function(e) { if (e.key === "Enter") search(e.target.value); });
      if (qs("reset_btn")) qs("reset_btn").onclick = resetSearch;
      if (qs("fit_btn")) qs("fit_btn").onclick = function() { fitToChart(true); };
      if (qs("expand_btn")) qs("expand_btn").onclick = expandAll;
      if (qs("collapse_btn")) qs("collapse_btn").onclick = collapseAll;
      if (qs("pdf_btn")) qs("pdf_btn").onclick = function() { exportChart("pdf"); };
      if (qs("png_btn")) qs("png_btn").onclick = function() { exportChart("png"); };
      if (qs("prev_btn")) qs("prev_btn").onclick = prevResult;
      if (qs("next_btn")) qs("next_btn").onclick = nextResult;
      if (qs("vertical_btn")) qs("vertical_btn").onclick = function() { setOrientation("vertical"); };
      if (qs("horizontal_btn")) qs("horizontal_btn").onclick = function() { setOrientation("horizontal"); };
      if (qs("drag_btn")) {
        qs("drag_btn").onclick = function() { setDragActive(!dragActive); };
        qs("drag_btn").classList.toggle("is-active", dragActive);
      }
      updateToolbarState();
    }
    renderToolbar();

    function readPositionsMap(raw) {
      const map = {};
      if (!raw) return map;
      if (Array.isArray(raw)) {
        raw.forEach(function(item) {
          const id = item && item.id != null ? String(item.id) : "";
          if (id && Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.y))) map[id] = { x: Number(item.x), y: Number(item.y) };
        });
      } else if (typeof raw === "object") {
        Object.keys(raw).forEach(function(id) {
          const item = raw[id];
          if (item && Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.y))) map[String(id)] = { x: Number(item.x), y: Number(item.y) };
        });
      }
      return map;
    }
    function loadNodes() {
      const src = properties.source_headers;
      const total = src && typeof src.length === "function" ? src.length() : 0;
      if (!total) return { nodes: [], warnings: [] };
      const raw = src.get(0, total);
      const positions = readPositionsMap(config.savedPositions);
      const warnings = [];
      const seen = {};
      const nodes = [];
      for (let i = 0; i < total; i++) {
        const item = raw[i];
        const id = str(getField(item, "_id") || (item && item.get && item.get("_id")) || "");
        if (!id) {
          warnings.push("Item without _id at index " + i);
          continue;
        }
        if (seen[id]) warnings.push("Duplicated id: " + id);
        seen[id] = true;
        let parentId = str(getField(item, properties.headparent) || "");
        if (parentId === id) parentId = "";
        const node = {
          id: id,
          parentId: parentId || null,
          name: str(getField(item, properties.headfieldname) || ""),
          role: str(getField(item, properties.rolefield) || ""),
          avatar: str(getField(item, properties.avatarfield) || ""),
          field_1: str(getField(item, properties.field_value_1) || ""),
          field_2: str(getField(item, properties.field_value_2) || ""),
          field_3: str(getField(item, properties.field_value_3) || ""),
          field_4: str(getField(item, properties.field_value_4) || ""),
          field_5: str(getField(item, properties.field_value_5) || ""),
          __original: item
        };
        if (positions[id]) {
          node._manualX = positions[id].x;
          node._manualY = positions[id].y;
        }
        nodes.push(node);
      }
      return { nodes: nodes, warnings: warnings };
    }
    function validateHierarchy(nodes) {
      const ids = {};
      const warnings = [];
      nodes.forEach(function(n) { ids[n.id] = true; });
      nodes.forEach(function(n) {
        if (n.parentId && !ids[n.parentId]) warnings.push("Parent not found for " + n.id + ": " + n.parentId);
      });
      const visiting = {};
      const visited = {};
      function visit(n) {
        if (visiting[n.id]) {
          warnings.push("Cycle detected at " + n.id);
          n.parentId = null;
          return;
        }
        if (visited[n.id]) return;
        visiting[n.id] = true;
        const parent = n.parentId ? nodeMap[n.parentId] : null;
        if (parent) visit(parent);
        visiting[n.id] = false;
        visited[n.id] = true;
      }
      nodes.forEach(visit);
      return warnings;
    }
    function buildData() {
      const loaded = loadNodes();
      renderedNodes = loaded.nodes;
      nodeMap = {};
      renderedNodes.forEach(function(n) { nodeMap[n.id] = n; });
      const hierarchyWarnings = validateHierarchy(renderedNodes);
      childMap = {};
      renderedNodes.forEach(function(n) {
        const parent = n.parentId && nodeMap[n.parentId] ? n.parentId : null;
        if (!childMap[parent]) childMap[parent] = [];
        childMap[parent].push(n);
      });
      roots = childMap[null] || [];
      const warnings = loaded.warnings.concat(hierarchyWarnings);
      safePublish("node_count", renderedNodes.length);
      safePublish("root_count", roots.length);
      safePublish("warning_count", warnings.length);
      safePublish("warnings_json", JSON.stringify(warnings));
      return warnings;
    }
    const warnings = buildData();
    if (!renderedNodes.length) {
      empty(config.emptyMessage, false);
      setStatus("empty", "");
      return;
    }
    if (!roots.length) {
      empty(config.noRootMessage, true);
      setStatus("error", "Hierarchy error: no root");
      return;
    }
    if (warnings.length) showToast(warnings.length + " warning(s) in data");

    const width = Math.max(320, canvas.clientWidth || instance.canvas.width() || 900);
    const height = Math.max(260, canvas.clientHeight || instance.canvas.height() || 620);
    svg = D3.select(canvasLayer).append("svg")
      .attr("class", "org-pro-svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", [0, 0, width, height]);
    container = svg.append("g").attr("class", "org-pro-container");
    dragLayer = container.append("g").attr("class", "org-pro-drag-layer");
    zoom = D3.zoom().scaleExtent([0.12, 3.5]).on("zoom", function(e) {
      container.attr("transform", e.transform);
      svg.node().__zoom = e.transform;
      instance.data._saved_transform = e.transform;
      safePublish("current_zoom", String(Math.round(e.transform.k * 100) / 100));
    });
    svg.call(zoom);
    svg.on("mousedown.cursor", function() { svg.classed("is-grabbing", true); });
    svg.on("mouseup.cursor mouseleave.cursor", function() { svg.classed("is-grabbing", false); });
    svg.on("click.clear", function() {
      if (dragActive) return;
      clearSelection();
      resetSearch(false);
    });

    function buildTree(n) {
      const kids = childMap[n.id] || [];
      return Object.assign({}, n, { children: collapsedMap[n.id] ? null : kids.map(buildTree) });
    }
    function displayX(d) {
      return config.orientation === "vertical" ? d.x : d.y + config.cardHOffset;
    }
    function displayY(d) {
      return config.orientation === "vertical" ? d.y : d.x;
    }
    function nodeTransform(d) {
      return "translate(" + (displayX(d) - config.nodeW / 2) + "," + (displayY(d) - config.nodeH / 2 + config.cardVOffset) + ")";
    }
    function linkPath(d) {
      if (config.orientation === "vertical") {
        const sx = d.source.x;
        const sy = d.source.y + config.nodeH / 2 + config.cardVOffset;
        const tx = d.target.x;
        const ty = d.target.y - config.nodeH / 2 + config.cardVOffset;
        const cy = (sy + ty) / 2;
        return "M" + sx + "," + sy + " C " + sx + "," + cy + " " + tx + "," + cy + " " + tx + "," + ty;
      }
      const sxh = d.source.y + config.nodeW / 2 + config.cardHOffset;
      const syh = d.source.x + config.cardVOffset;
      const txh = d.target.y - config.nodeW / 2 + config.cardHOffset;
      const tyh = d.target.x + config.cardVOffset;
      const cx = (sxh + txh) / 2;
      return "M" + sxh + "," + syh + " C " + cx + "," + syh + " " + cx + "," + tyh + " " + txh + "," + tyh;
    }
    function cardHtml(d) {
      const n = d.data;
      const hasChildren = (childMap[n.id] || []).length > 0;
      const isCollapsed = !!collapsedMap[n.id];
      const highlighted = searchResults.indexOf(n.id) >= 0;
      const selected = selectedId === n.id;
      const bottom = shade(config.cardColor, -22);
      const bg = "linear-gradient(180deg,#fff 0%," + shade(config.cardColor, 80) + " 42%," + bottom + " 100%)";
      const textColor = highlighted ? "#ffffff" : config.textColor;
      const extra = properties.card_extra_line_1 && n.field_1 ? '<div class="org-pro-card-extra" style="color:' + (highlighted ? "rgba(255,255,255,.90)" : "var(--org-muted)") + '">' + esc(n.field_1) + '</div>' : "";
      return '<div xmlns="http://www.w3.org/1999/xhtml" class="org-pro-card' + (highlighted ? " is-highlighted" : "") + (selected ? " is-selected" : "") + '" style="background:' + bg + ';color:' + textColor + '">' +
        '<img class="org-pro-avatar" src="' + esc(n.avatar || FALLBACK_AVATAR) + '" onerror="this.onerror=null;this.src=\'' + esc(FALLBACK_AVATAR) + '\';" style="width:' + config.avatarSize + 'px;height:' + config.avatarSize + 'px">' +
        '<div class="org-pro-card-main"><div class="org-pro-card-name">' + esc(n.name || "(sem nome)") + '</div><div class="org-pro-card-role" style="color:' + (highlighted ? "rgba(255,255,255,.88)" : "var(--org-muted)") + '">' + esc(n.role) + '</div>' + extra + '</div>' +
        (hasChildren ? '<button type="button" class="org-pro-collapse" data-node-id="' + esc(n.id) + '" title="' + (isCollapsed ? "Expandir" : "Colapsar") + '">' + (isCollapsed ? ">" : "v") + '</button>' : "") +
        '</div>';
    }
    function render() {
      container.selectAll("*").remove();
      dragLayer = container.append("g").attr("class", "org-pro-drag-layer");
      let offsetX = 0;
      roots.forEach(function(root) {
        const tree = D3.tree().nodeSize(config.orientation === "vertical" ? [config.siblingSpacing, config.levelSpacing] : [config.levelSpacing, config.siblingSpacing + config.horizontalExtra]);
        const h = D3.hierarchy(buildTree(root), function(d) { return d.children; });
        tree(h);
        h.descendants().forEach(function(d) {
          const original = nodeMap[d.data.id];
          if (original && Number.isFinite(original._manualX) && Number.isFinite(original._manualY)) {
            d.x = original._manualX;
            d.y = original._manualY;
          }
        });
        const minX = D3.min(h.descendants(), function(d) { return d.x; }) || 0;
        const maxX = D3.max(h.descendants(), function(d) { return d.x; }) || 0;
        const span = Math.max(config.nodeW + 80, (maxX - minX) + config.nodeW + 70);
        const treeGroup = container.append("g").attr("class", "org-pro-tree").attr("transform", "translate(" + (offsetX - minX + config.nodeW / 2) + ",52)");

        treeGroup.append("g").selectAll("path")
          .data(h.links())
          .join("path")
          .attr("class", "org-pro-link")
          .attr("stroke", config.connectorColor)
          .attr("stroke-width", config.connectorWidth)
          .attr("d", linkPath);

        const nodeSel = treeGroup.append("g").selectAll("g.org-pro-node")
          .data(h.descendants(), function(d) { return d.data.id; })
          .join("g")
          .attr("class", "org-pro-node")
          .attr("data-node-id", function(d) { return d.data.id; })
          .attr("transform", nodeTransform)
          .style("cursor", "pointer");

        nodeSel.append("foreignObject")
          .attr("class", "org-pro-card-fo")
          .attr("width", config.nodeW)
          .attr("height", config.nodeH)
          .html(cardHtml);

        nodeSel.on("click", function(event, d) {
          if (dragActive) return;
          if (event.target && event.target.closest && event.target.closest(".org-pro-collapse")) return;
          event.stopPropagation();
          selectNode(d, true);
        });
        nodeSel.on("mousedown.dragCard", function(event, d) {
          if (!dragActive) return;
          event.stopPropagation();
          beginCardDrag(event, d);
        });
        nodeSel.selectAll(".org-pro-collapse").nodes().forEach(function(btn) {
          btn.onclick = function(ev) {
            ev.stopPropagation();
            toggleCollapse(btn.getAttribute("data-node-id"));
          };
        });
        offsetX += span + (config.orientation === "horizontal" ? config.horizontalExtra : 90);
      });
      if (selectedId && findNode(selectedId)) markSelected(selectedId);
    }
    function findNode(id) {
      return container.selectAll(".org-pro-node").filter(function(d) { return d && d.data && d.data.id === id; });
    }
    function markSelected(id) {
      container.selectAll(".org-pro-card").classed("is-selected", false);
      const sel = findNode(id);
      if (!sel.empty()) sel.select(".org-pro-card").classed("is-selected", true);
    }
    function clearSelection() {
      selectedId = "";
      instance.data._saved_selected_id = "";
      instance.data._saved_sidebar_open = false;
      wrapper.querySelectorAll(".org-pro-drawer").forEach(function(el) { el.remove(); });
      safePublish("selected_node", "");
      safePublish("selected_node_id", "");
      safePublish("selected_parent_id", "");
      markSelected("");
    }
    function selectNode(d, userAction) {
      selectedId = d.data.id;
      instance.data._saved_selected_id = selectedId;
      safePublish("selected_node_id", d.data.id);
      safePublish("selected_parent_id", d.data.parentId || "");
      safePublish("selected_node", JSON.stringify(toPublicNode(d.data)));
      markSelected(selectedId);
      if (config.showPanel && config.openPanelOnClick) openPanel(d);
      if (userAction) safeTrigger("organograma_node_clicked");
    }
    function toPublicNode(n) {
      return {
        id: n.id,
        parentId: n.parentId || "",
        name: n.name || "",
        role: n.role || "",
        avatar: n.avatar || "",
        field_1: n.field_1 || "",
        field_2: n.field_2 || "",
        field_3: n.field_3 || "",
        field_4: n.field_4 || "",
        field_5: n.field_5 || "",
        x: Number.isFinite(n._manualX) ? Math.round(n._manualX * 100) / 100 : null,
        y: Number.isFinite(n._manualY) ? Math.round(n._manualY * 100) / 100 : null
      };
    }
    function openPanel(d) {
      wrapper.querySelectorAll(".org-pro-drawer").forEach(function(el) { el.remove(); });
      const n = d.data;
      const fields = [
        { label: config.title1, value: n.field_1 },
        { label: config.title2, value: n.field_2 },
        { label: config.title3, value: n.field_3 },
        { label: config.title4, value: n.field_4 },
        { label: config.title5, value: n.field_5 }
      ].filter(function(f) { return str(f.value).trim(); });
      const coord = {
        id: n.id,
        x: Math.round((Number.isFinite(n._manualX) ? n._manualX : d.x) * 100) / 100,
        y: Math.round((Number.isFinite(n._manualY) ? n._manualY : d.y) * 100) / 100,
        at: new Date().toISOString()
      };
      const drawer = doc.createElement("div");
      drawer.className = "org-pro-drawer org-no-export";
      drawer.style.width = Math.min(config.popupWidth, wrapper.clientWidth || config.popupWidth) + "px";
      drawer.innerHTML =
        '<button class="org-pro-drawer-close" type="button" title="Fechar">' + icon.close + '</button>' +
        '<div class="org-pro-profile"><img src="' + esc(n.avatar || FALLBACK_AVATAR) + '" onerror="this.onerror=null;this.src=\'' + esc(FALLBACK_AVATAR) + '\';"><h2>' + esc(n.name || "(sem nome)") + '</h2><p>' + esc(n.role || "") + '</p></div>' +
        '<div class="org-pro-field-list">' +
        (fields.length ? fields.map(function(f) { return '<div class="org-pro-field"><div class="org-pro-field-label">' + esc(f.label) + '</div><div class="org-pro-field-value">' + esc(f.value) + '</div></div>'; }).join("") : '<div class="org-pro-field-value" style="padding:16px;text-align:center;color:var(--org-muted)">Sem informacoes adicionais</div>') +
        '</div>' +
        '<div class="org-pro-field"><div class="org-pro-field-label">Coordenada JSON</div><textarea class="org-pro-codebox" id="' + uid + '_coord">' + esc(JSON.stringify(coord)) + '</textarea><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px"><button class="org-pro-btn org-pro-btn-text" id="' + uid + '_coord_cancel">Cancelar</button><button class="org-pro-btn org-pro-btn-text is-active" id="' + uid + '_coord_save">Salvar</button></div></div>';
      wrapper.appendChild(drawer);
      instance.data._saved_sidebar_open = true;
      drawer.querySelector(".org-pro-drawer-close").onclick = clearSelection;
      drawer.querySelector("#" + uid + "_coord_cancel").onclick = function() { drawer.remove(); };
      drawer.querySelector("#" + uid + "_coord_save").onclick = function() {
        const raw = drawer.querySelector("#" + uid + "_coord").value;
        const parsed = parseJson(raw, null);
        if (!parsed || !Number.isFinite(Number(parsed.x)) || !Number.isFinite(Number(parsed.y))) {
          showToast("Coordenada invalida");
          return;
        }
        const target = nodeMap[n.id];
        target._manualX = Number(parsed.x);
        target._manualY = Number(parsed.y);
        publishPositions(n.id);
        render();
        drawer.remove();
        safeTrigger("organograma_drag_created");
      };
    }
    function updateToolbarState() {
      const vertical = wrapper.querySelector("#" + uid + "_vertical_btn");
      const horizontal = wrapper.querySelector("#" + uid + "_horizontal_btn");
      const drag = wrapper.querySelector("#" + uid + "_drag_btn");
      if (vertical) vertical.classList.toggle("is-active", config.orientation === "vertical");
      if (horizontal) horizontal.classList.toggle("is-active", config.orientation === "horizontal");
      if (drag) drag.classList.toggle("is-active", dragActive);
      safePublish("current_orientation", config.orientation);
      safePublish("drag_button_active", dragActive ? "1" : "0");
    }
    function setOrientation(next) {
      config.orientation = next === "horizontal" ? "horizontal" : "vertical";
      instance.data._saved_orientation = config.orientation;
      updateToolbarState();
      render();
      fitToChart(true);
      safeTrigger("organograma_orientation_changed");
    }
    function setDragActive(next) {
      dragActive = !!next;
      instance.data._drag_button_active = dragActive;
      updateToolbarState();
      safeTrigger("organograma_drag_mode_changed");
    }
    function toggleCollapse(id) {
      collapsedMap[id] = !collapsedMap[id];
      instance.data._collapsed_map = collapsedMap;
      render();
      safePublish("collapsed_ids_json", JSON.stringify(Object.keys(collapsedMap).filter(function(k) { return collapsedMap[k]; })));
      safeTrigger(collapsedMap[id] ? "organograma_node_collapsed" : "organograma_node_expanded");
    }
    function expandAll() {
      collapsedMap = {};
      instance.data._collapsed_map = collapsedMap;
      render();
      safePublish("collapsed_ids_json", "[]");
      safeTrigger("organograma_expanded_all");
    }
    function collapseAll() {
      collapsedMap = {};
      renderedNodes.forEach(function(n) { if ((childMap[n.id] || []).length) collapsedMap[n.id] = true; });
      roots.forEach(function(r) { collapsedMap[r.id] = false; });
      instance.data._collapsed_map = collapsedMap;
      render();
      safePublish("collapsed_ids_json", JSON.stringify(Object.keys(collapsedMap).filter(function(k) { return collapsedMap[k]; })));
      safeTrigger("organograma_collapsed_all");
    }
    function resetSearch(refit) {
      searchResults = [];
      currentResultIndex = -1;
      const input = wrapper.querySelector("#" + uid + "_search");
      if (input) input.value = "";
      updateSearchNav();
      render();
      safePublish("search_result_count", 0);
      if (refit !== false) fitToChart(true);
    }
    function updateSearchNav() {
      const nav = wrapper.querySelector("#" + uid + "_nav");
      const count = wrapper.querySelector("#" + uid + "_count");
      if (!nav || !count) return;
      nav.classList.toggle("org-pro-hidden", searchResults.length <= 1);
      count.textContent = searchResults.length ? (currentResultIndex + 1) + "/" + searchResults.length : "0/0";
    }
    function openAncestors(id) {
      let node = nodeMap[id];
      while (node && node.parentId) {
        collapsedMap[node.parentId] = false;
        node = nodeMap[node.parentId];
      }
      instance.data._collapsed_map = collapsedMap;
    }
    function search(query) {
      const q = str(query).trim().toLowerCase();
      searchResults = [];
      currentResultIndex = -1;
      if (!q) {
        resetSearch(false);
        return;
      }
      searchResults = renderedNodes.filter(function(n) {
        return config.searchFields.some(function(field) { return str(n[field]).toLowerCase().indexOf(q) >= 0; });
      }).map(function(n) { return n.id; });
      safePublish("search_result_count", searchResults.length);
      safePublish("last_search_query", q);
      safeTrigger("organograma_search_completed");
      if (!searchResults.length) {
        showToast("Nada encontrado");
        updateSearchNav();
        render();
        return;
      }
      goToResult(0);
    }
    function goToResult(index) {
      if (!searchResults.length) return;
      currentResultIndex = (index + searchResults.length) % searchResults.length;
      const id = searchResults[currentResultIndex];
      openAncestors(id);
      render();
      const sel = findNode(id);
      if (!sel.empty()) {
        const d = sel.datum();
        focusNode(d);
        selectedId = id;
        instance.data._saved_selected_id = id;
        safePublish("selected_node_id", id);
        safePublish("selected_parent_id", d.data.parentId || "");
        safePublish("selected_node", JSON.stringify(toPublicNode(d.data)));
        if (config.showPanel && config.openPanelOnSearch) openPanel(d);
      }
      updateSearchNav();
    }
    function nextResult() { goToResult(currentResultIndex + 1); }
    function prevResult() { goToResult(currentResultIndex - 1); }
    function focusNode(d) {
      try {
        const bbox = findNode(d.data.id).node().getBBox();
        const cx = bbox.x + bbox.width / 2;
        const cy = bbox.y + bbox.height / 2;
        const scale = Math.max(0.25, Math.min(2.6, Math.min(width / (config.nodeW * 2.6), height / (config.nodeH * 2.6))));
        const t = D3.zoomIdentity.translate(width / 2 - scale * cx, height / 2 - scale * cy).scale(scale);
        svg.transition().duration(420).call(zoom.transform, t);
      } catch (e) {}
    }
    function fitToChart(animated) {
      try {
        const bbox = container.node().getBBox();
        const pad = 90;
        const scale = Math.max(0.12, Math.min(2.6, Math.min((width - pad) / Math.max(1, bbox.width), (height - pad) / Math.max(1, bbox.height))));
        const tx = width / 2 - scale * (bbox.x + bbox.width / 2);
        const ty = height / 2 - scale * (bbox.y + bbox.height / 2);
        const t = D3.zoomIdentity.translate(tx, ty).scale(scale);
        const target = animated ? svg.transition().duration(520) : svg;
        target.call(zoom.transform, t);
      } catch (e) {}
    }
    function currentPositions() {
      return renderedNodes.filter(function(n) { return Number.isFinite(n._manualX) && Number.isFinite(n._manualY); }).map(function(n) {
        return { id: n.id, x: Math.round(n._manualX * 100) / 100, y: Math.round(n._manualY * 100) / 100 };
      });
    }
    function publishPositions(activeId) {
      const positions = currentPositions();
      const active = activeId && nodeMap[activeId] ? nodeMap[activeId] : null;
      safePublish("positions_json", JSON.stringify(positions));
      safePublish("selected_drag_coord", active ? JSON.stringify({ id: active.id, x: Math.round(active._manualX * 100) / 100, y: Math.round(active._manualY * 100) / 100, at: new Date().toISOString() }) : "");
    }
    function screenToWorld(pt) {
      const t = svg.node().__zoom || D3.zoomIdentity;
      return [(pt[0] - t.x) / t.k, (pt[1] - t.y) / t.k];
    }
    let dragState = null;
    function collectDragNodes(d) {
      const out = [];
      function walk(x) {
        out.push(x);
        if (config.dragSubtree) (x.children || []).forEach(walk);
      }
      walk(d);
      return out;
    }
    function beginCardDrag(event, d) {
      const pt = D3.pointer(event, svg.node());
      dragState = { start: pt, nodes: collectDragNodes(d).map(function(x) {
        return { id: x.data.id, x: x.x, y: x.y };
      }), activeId: d.data.id };
      svg.on("mousemove.dragCard", moveCardDrag);
      svg.on("mouseup.dragCard", endCardDrag);
      safeTrigger("organograma_drag_started");
    }
    function moveCardDrag(event) {
      if (!dragState) return;
      const pt = D3.pointer(event, svg.node());
      const t = svg.node().__zoom || D3.zoomIdentity;
      const dx = (pt[0] - dragState.start[0]) / t.k;
      const dy = (pt[1] - dragState.start[1]) / t.k;
      dragState.nodes.forEach(function(item) {
        const node = nodeMap[item.id];
        if (!node) return;
        node._manualX = item.x + (config.orientation === "vertical" ? dx : dy);
        node._manualY = item.y + (config.orientation === "vertical" ? dy : dx);
      });
      container.selectAll(".org-pro-node").attr("transform", function(d) {
        const node = nodeMap[d.data.id];
        if (node && Number.isFinite(node._manualX) && Number.isFinite(node._manualY)) {
          d.x = node._manualX;
          d.y = node._manualY;
        }
        return nodeTransform(d);
      });
    }
    function endCardDrag() {
      if (!dragState) return;
      publishPositions(dragState.activeId);
      dragState = null;
      svg.on("mousemove.dragCard", null);
      svg.on("mouseup.dragCard", null);
      render();
      safeTrigger("organograma_drag_created");
    }
    function resetPositions() {
      renderedNodes.forEach(function(n) { delete n._manualX; delete n._manualY; });
      publishPositions("");
      render();
      fitToChart(true);
      safeTrigger("organograma_positions_reset");
    }
    async function exportChart(kind) {
      try {
        if (!html2canvasRef) throw new Error("html2canvas was not loaded");
        if (kind === "pdf" && !jsPDFRef) throw new Error("jsPDF was not loaded");
        const oldTransform = svg.node().__zoom || D3.zoomIdentity;
        fitToChart(false);
        await new Promise(function(resolve) { setTimeout(resolve, 80); });
        const canvasEl = await html2canvasRef(wrapper, {
          scale: config.exportScale,
          useCORS: true,
          backgroundColor: config.bgColor,
          ignoreElements: function(el) { return !config.includeToolbarExport && el.classList && el.classList.contains("org-no-export"); }
        });
        svg.call(zoom.transform, oldTransform);
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        const filename = config.filenamePrefix + "_" + stamp;
        const data = canvasEl.toDataURL("image/png");
        if (kind === "png") {
          const a = doc.createElement("a");
          a.href = data;
          a.download = filename + ".png";
          a.click();
          safePublish("last_export_filename", a.download);
          safeTrigger("organograma_png_exported");
          showToast("PNG exportado");
          return;
        }
        const orient = canvasEl.width > canvasEl.height ? "landscape" : "portrait";
        const pdf = new jsPDFRef({ orientation: orient, unit: "px", format: [canvasEl.width, canvasEl.height] });
        pdf.addImage(data, "PNG", 0, 0, canvasEl.width, canvasEl.height);
        pdf.save(filename + ".pdf");
        safePublish("last_export_filename", filename + ".pdf");
        safeTrigger("organograma_pdf_exported");
        showToast("PDF exportado");
      } catch (e) {
        setStatus("error", e && e.message ? e.message : String(e));
        showToast("Erro ao exportar");
      }
    }

    render();
    updateToolbarState();
    if (instance.data._saved_transform) {
      try { svg.call(zoom.transform, instance.data._saved_transform); } catch (e) { if (config.autoFit) fitToChart(false); }
    } else if (config.autoFit) {
      setTimeout(function() { fitToChart(false); }, 80);
    }
    if (selectedId && nodeMap[selectedId]) {
      setTimeout(function() {
        const sel = findNode(selectedId);
        if (!sel.empty()) selectNode(sel.datum(), false);
      }, 120);
    }

    win.OrganogramaPro = win.OrganogramaPro || {};
    win.OrganogramaPro[uid] = {
      fit: function() { fitToChart(true); },
      search: search,
      clearSearch: function() { resetSearch(true); },
      select: function(id) {
        openAncestors(String(id));
        render();
        const sel = findNode(String(id));
        if (!sel.empty()) {
          selectNode(sel.datum(), false);
          focusNode(sel.datum());
        }
      },
      setOrientation: setOrientation,
      expandAll: expandAll,
      collapseAll: collapseAll,
      toggleDrag: setDragActive,
      resetPositions: resetPositions,
      exportPdf: function() { exportChart("pdf"); },
      exportPng: function() { exportChart("png"); },
      getPositions: currentPositions,
      instanceId: uid
    };
    safePublish("api_instance_id", uid);
    safePublish("collapsed_ids_json", JSON.stringify(Object.keys(collapsedMap).filter(function(k) { return collapsedMap[k]; })));
    safePublish("positions_json", JSON.stringify(currentPositions()));
    setStatus("ready", "");
    safeTrigger("organograma_rendered");
  } catch (err) {
    try {
      instance.publishState("plugin_status", "error");
      instance.publishState("plugin_error", err && err.message ? err.message : String(err));
      instance.triggerEvent("organograma_error");
    } catch (e) {}
  }
}
