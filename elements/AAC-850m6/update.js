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

    const FALLBACK_AVATAR = properties.fallback_avatar_url || "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#e2e8f0"/><circle cx="48" cy="38" r="16" fill="#94a3b8"/><path d="M16 88c4-18 16-26 32-26s28 8 32 26z" fill="#94a3b8"/></svg>');
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
    const parseJson = function(value, fallback) {
      if (!value) return fallback;
      if (typeof value === "object") return value;
      try { return JSON.parse(String(value)); } catch (e) { return fallback; }
    };
    const toCssColor = function(v, fallback) {
      const raw = str(v).trim();
      return raw ? raw : fallback;
    };
    const hexToRgb = function(hex) {
      let h = str(hex).replace("#", "");
      if (/^rgba?\(/.test(str(hex))) {
        const m = str(hex).match(/[\d.]+/g) || [];
        return { r: Number(m[0]) || 0, g: Number(m[1]) || 0, b: Number(m[2]) || 0 };
      }
      if (h.length === 3) h = h.split("").map(function(c) { return c + c; }).join("");
      if (!/^[0-9a-f]{6}$/i.test(h)) h = "4f46e5";
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
    };
    const alpha = function(color, a) {
      const c = hexToRgb(color);
      return "rgba(" + c.r + "," + c.g + "," + c.b + "," + a + ")";
    };
    const raf = win.requestAnimationFrame ? win.requestAnimationFrame.bind(win) : function(fn) { return setTimeout(fn, 16); };
    const rafThrottle = function(fn) {
      let ticking = false;
      let lastArgs = null;
      return function() {
        lastArgs = arguments;
        if (ticking) return;
        ticking = true;
        raf(function() { ticking = false; fn.apply(null, lastArgs); });
      };
    };
    const debounce = function(fn, wait) {
      let timer = null;
      return function() {
        const args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function() { fn.apply(null, args); }, wait);
      };
    };

    /* ---------------- THEMES ---------------- */
    const makeTheme = function(t) {
      const dark = !!t.dark;
      const inkA = function(a) { return dark ? "rgba(255,255,255," + a + ")" : "rgba(15,23,42," + a + ")"; };
      return {
        "--org-bg": t.bg,
        "--org-bg-dot": t.dot || inkA(dark ? 0.06 : 0.055),
        "--org-panel": t.panel || (dark ? "rgba(20,26,40,.82)" : "rgba(255,255,255,.85)"),
        "--org-panel-border": t.panelBorder || inkA(dark ? 0.10 : 0.08),
        "--org-field": t.field || (dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.92)"),
        "--org-seg": inkA(dark ? 0.08 : 0.045),
        "--org-hover": inkA(dark ? 0.09 : 0.06),
        "--org-hover-strong": inkA(dark ? 0.16 : 0.10),
        "--org-text": t.text,
        "--org-muted": t.muted,
        "--org-accent": t.accent,
        "--org-accent-contrast": t.accentContrast || "#ffffff",
        "--org-accent-glow": alpha(t.accent, dark ? 0.35 : 0.18),
        "--org-accent-soft": alpha(t.accent, dark ? 0.18 : 0.10),
        "--org-card": t.card,
        "--org-card-border": t.cardBorder || inkA(dark ? 0.12 : 0.08),
        "--org-card-text": t.cardText || t.text,
        "--org-card-muted": t.cardMuted || t.muted,
        "--org-avatar-ring": inkA(dark ? 0.14 : 0.07),
        "--org-connector": t.connector,
        "--org-shadow": dark ? "rgba(0,0,0,.38)" : "rgba(15,23,42,.09)",
        "--org-shadow-strong": dark ? "rgba(0,0,0,.55)" : "rgba(15,23,42,.16)",
        "--org-drawer": t.drawer || t.card,
        "--org-toast": dark ? "rgba(226,232,240,.96)" : "rgba(15,23,42,.92)",
        "--org-field-sep": inkA(dark ? 0.08 : 0.05)
      };
    };
    const LEVEL_HUES = [0, 32, 64, 96, 128, 160, 200, 240, 280, 320];
    const THEMES = {
      "Executive Light": makeTheme({ bg: "#f6f8fb", text: "#0f172a", muted: "#64748b", accent: "#4f46e5", card: "#ffffff", connector: "#cbd5e1" }),
      "Corporate Blue": makeTheme({ bg: "#f3f7fc", text: "#0c1a2b", muted: "#5b7186", accent: "#1d6fd8", card: "#ffffff", connector: "#c3d3e4" }),
      "Midnight": makeTheme({ dark: true, bg: "#0b1220", text: "#e5eaf3", muted: "#8b98ad", accent: "#38bdf8", accentContrast: "#052030", card: "#141d31", cardBorder: "rgba(255,255,255,.09)", connector: "#2b3852" }),
      "Graphite": makeTheme({ dark: true, bg: "#101113", text: "#ececec", muted: "#9a9aa2", accent: "#f59e0b", accentContrast: "#1a1206", card: "#1a1c1f", cardBorder: "rgba(255,255,255,.09)", connector: "#33363b" }),
      "Emerald": makeTheme({ bg: "#f4faf7", text: "#0b2419", muted: "#5f7a6d", accent: "#059669", card: "#ffffff", connector: "#c6dcd1" }),
      "Royal Purple": makeTheme({ bg: "#f8f6fd", text: "#1e1b31", muted: "#6f6a8a", accent: "#7c3aed", card: "#ffffff", connector: "#d5cdea" }),
      "Warm Sand": makeTheme({ bg: "#faf6f0", text: "#2b1c10", muted: "#8a7461", accent: "#c2410c", card: "#fffdf9", connector: "#e0d3c2" }),
      "Ocean": makeTheme({ bg: "#eef6fa", text: "#093142", muted: "#557687", accent: "#0891b2", card: "#ffffff", connector: "#bcd6e0" }),
      "Minimal Mono": makeTheme({ bg: "#ffffff", dot: "rgba(0,0,0,.05)", text: "#111111", muted: "#737373", accent: "#111111", card: "#ffffff", cardBorder: "rgba(0,0,0,.12)", connector: "#d4d4d4" }),
      "Obsidian": makeTheme({ dark: true, bg: "#12111a", text: "#e9e6f2", muted: "#9d97b3", accent: "#a78bfa", accentContrast: "#1a1030", card: "#1c1a29", cardBorder: "rgba(255,255,255,.09)", connector: "#332f47" }),
      "Nordic": makeTheme({ bg: "#f2f5f7", dot: "rgba(46,62,79,.06)", text: "#2e3e4f", muted: "#6b7f92", accent: "#5e81ac", card: "#fbfcfd", connector: "#c8d4de" }),
      "Rose": makeTheme({ bg: "#fdf5f7", text: "#3d1f2b", muted: "#8a6673", accent: "#be123c", card: "#ffffff", connector: "#e8ccd5" })
    };

    const icon = {
      search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.5 6.5 0 1 0 14 15.5l.27.28v.79l4.6 4.58 1.42-1.42-4.6-4.58zM9.5 14A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>',
      prev: '<svg viewBox="0 0 24 24"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z"/></svg>',
      next: '<svg viewBox="0 0 24 24"><path d="M8.6 16.6 13.2 12 8.6 7.4 10 6l6 6-6 6z"/></svg>',
      fit: '<svg viewBox="0 0 24 24"><path d="M5 5h5V3H3v7h2V5zm9-2v2h5v5h2V3h-7zM5 14H3v7h7v-2H5v-5zm14 5h-5v2h7v-7h-2v5z"/></svg>',
      expand: '<svg viewBox="0 0 24 24"><path d="M12 5.8 8.4 9.4 7 8l5-5 5 5-1.4 1.4zM12 18.2l3.6-3.6L17 16l-5 5-5-5 1.4-1.4z"/></svg>',
      collapse: '<svg viewBox="0 0 24 24"><path d="M7 3.6 8.4 2.2 12 5.8l3.6-3.6L17 3.6 12 8.6zM12 15.4l5 5-1.4 1.4L12 18.2l-3.6 3.6L7 20.4z"/></svg>',
      vertical: '<svg viewBox="0 0 24 24"><path d="M10 2h4v6h-4zM4 14h4v6H4zm6 0h4v6h-4zm6 0h4v6h-4zM11 8h2v3h-2zM5 11h14v2h-5v-2h-4v2H5z"/></svg>',
      horizontal: '<svg viewBox="0 0 24 24"><path d="M2 10h6v4H2zm12-8h6v4h-6zm0 8h6v4h-6zm0 8h6v4h-6zM8 11h3v2H8zm3-7h2v14h-2v-5h3v-2h-3V9h3V7h-3z"/></svg>',
      pdf: '<svg viewBox="0 0 24 24"><path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 1.5V8h4.5zM7 13h2.2a2 2 0 0 1 0 4H8v2H7zm1 1.4v1.2h1.1a.6.6 0 0 0 0-1.2zM12 13h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2zm1.5 1.5v3h.5a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5z"/></svg>',
      image: '<svg viewBox="0 0 24 24"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8.5 8.5A1.5 1.5 0 1 1 7 7a1.5 1.5 0 0 1 1.5 1.5zM5 18l4.2-5.2 3 3.6 2-2.4L19 18z"/></svg>',
      drag: '<svg viewBox="0 0 24 24"><path d="M13 6.99h3L12 3 8 6.99h3v4.01H6.99v-3L3 12l3.99 4v-3H11v4.01H8L12 21l4-3.99h-3V13h4.01v3L21 12l-3.99-4v3H13z"/></svg>',
      chevron: '<svg viewBox="0 0 24 24"><path d="M12 15.4 5.6 9 7 7.6l5 5 5-5L18.4 9z"/></svg>',
      people: '<svg viewBox="0 0 24 24"><path d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13zm8 0a8 8 0 0 0-1 .07 4.2 4.2 0 0 1 2 3.43V19h6v-2.5c0-2.3-4.7-3.5-7-3.5z"/></svg>',
      zoomIn: '<svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
      zoomOut: '<svg viewBox="0 0 24 24"><path d="M5 11h14v2H5z"/></svg>'
    };

    setStatus("loading", "");

    if (!canvas) {
      setStatus("error", "Canvas not available");
      return;
    }
    if (!D3) {
      canvas.innerHTML = "<div class='org-pro-root'><div class='org-pro-error'>D3 was not loaded. Check the plugin Header.</div></div>";
      setStatus("error", "D3 was not loaded");
      return;
    }

    /* ---------------- CONFIG ---------------- */
    const config = {
      theme: str(properties.visual_theme || "Executive Light"),
      cardLayout: (function(v) {
        if (v.indexOf("centraliz") >= 0 || v.indexOf("center") >= 0) return "center";
        if (v.indexOf("compact") >= 0) return "compact";
        return "classic";
      })(str(properties.card_layout || "").toLowerCase()),
      avatarShape: (function(v) {
        if (v.indexOf("quadrad") >= 0 || v.indexOf("square") >= 0) return "square";
        if (v.indexOf("arredond") >= 0 || v.indexOf("rounded") >= 0) return "rounded";
        return "circle";
      })(str(properties.avatar_shape || "").toLowerCase()),
      connectorStyle: (function(v) {
        if (v.indexOf("curva") >= 0 || v.indexOf("curve") >= 0) return "curved";
        if (v.indexOf("reta") >= 0 || v.indexOf("straight") >= 0) return "straight";
        return "elbow";
      })(str(properties.connector_style || "").toLowerCase()),
      accentPosition: (function(v) {
        if (v.indexOf("lateral") >= 0 || v.indexOf("left") >= 0 || v.indexOf("side") >= 0) return "side";
        if (v.indexOf("superior") >= 0 || v.indexOf("top") >= 0) return "top";
        return "none";
      })(str(properties.accent_position || "").toLowerCase()),
      cardShadow: (function(v) {
        if (v.indexOf("nenhum") >= 0 || v.indexOf("none") >= 0) return "none";
        if (v.indexOf("forte") >= 0 || v.indexOf("strong") >= 0) return "strong";
        if (v.indexOf("suave") >= 0 || v.indexOf("soft") >= 0) return "soft";
        return "medium";
      })(str(properties.card_shadow || "").toLowerCase()),
      levelColors: bool(properties.level_colors, false),
      showZoomControls: bool(properties.show_zoom_controls, true),
      perfMode: (function(v) {
        if (v.indexOf("sempre") >= 0 || v.indexOf("always") >= 0 || v.indexOf("on") === 0) return "on";
        if (v.indexOf("deslig") >= 0 || v.indexOf("off") >= 0 || v.indexOf("never") >= 0) return "off";
        return "auto";
      })(str(properties.performance_mode || "").toLowerCase()),
      perfThreshold: num(properties.performance_threshold, 150, 20, 5000),
      showSearch: bool(properties.show_search, true),
      showOrientation: bool(properties.show_orientation, true),
      showExportPdf: bool(properties.show_export_pdf, true),
      showExportPng: bool(properties.show_export_png, true),
      showFit: bool(properties.show_fit_button, true),
      showExpandCollapse: bool(properties.show_expand_collapse_buttons, true),
      showDrag: bool(properties.show_drag_button, true),
      showPanel: bool(properties.show_details_panel, true),
      infoToggle: bool(properties.card_info_toggle, true),
      openPanelOnSearch: bool(properties.open_panel_on_search, false),
      openPanelOnClick: bool(properties.open_panel_on_click, true),
      autoFit: bool(properties.auto_fit_on_render, true),
      dragSubtree: bool(properties.drag_subtree, true),
      applyInitialCoords: bool(properties.apply_initial_coords, true),
      initialCoords: parseJson(properties.initial_coord_json, null),
      initialDisplay: (function(v) {
        if (v.indexOf("recolhido") >= 0 || v.indexOf("collapsed") >= 0) return "collapsed";
        if (v.indexOf("n\u00edvel") >= 0 || v.indexOf("nivel") >= 0 || v.indexOf("level") >= 0) return "levels";
        return "expanded";
      })(str(properties.initial_display || "").toLowerCase()),
      initialLevels: num(properties.initial_expanded_levels, 0, 0, 99),
      searchFields: str(properties.search_fields || "name,role,field_1,field_2,field_3,field_4,field_5").split(",").map(function(x) { return x.trim(); }).filter(Boolean),
      orientation: (str(instance.data._saved_orientation || properties.default_orientation || "vertical").toLowerCase() === "horizontal") ? "horizontal" : "vertical",
      nodeW: num(properties.card_width, 270, 160, 520),
      nodeH: num(properties.card_height, 96, 56, 260),
      autoHeight: (function(v) {
        if (v.indexOf("fixo") >= 0 || v.indexOf("fixed") >= 0) return false;
        return true;
      })(str(properties.card_height_mode || "").toLowerCase()),
      avatarSize: num(properties.card_avatar_size, 54, 28, 140),
      levelSpacing: num(properties.level_spacing, 160, 70, 500),
      siblingSpacing: num(properties.sibling_spacing, 300, 100, 700),
      horizontalExtra: num(properties.horizontal_extra_spacing, 120, 0, 900),
      cardVOffset: num(properties.card_vertical_offset, 0, -200, 200),
      cardHOffset: num(properties.card_horizontal_offset, 0, -300, 500),
      connectorColor: toCssColor(properties.connector_color, ""),
      connectorWidth: num(properties.connector_width, 1.8, 0.5, 8),
      popupWidth: num(properties.popup_width, 430, 280, 760),
      exportScale: num(properties.export_scale, 2, 1, 4),
      filenamePrefix: str(properties.export_filename_prefix || "organograma"),
      emptyMessage: str(properties.empty_message || "Sem dados para exibir"),
      extraLine1: bool(properties.card_extra_line_1, false),
      extraLine2: bool(properties.card_extra_line_2, false),
      title1: str(properties.field_title_1 || "Field 1"),
      title2: str(properties.field_title_2 || "Field 2"),
      title3: str(properties.field_title_3 || "Field 3"),
      title4: str(properties.field_title_4 || "Field 4"),
      title5: str(properties.field_title_5 || "Field 5")
    };
    instance.data._saved_orientation = config.orientation;

    let collapsedMap = instance.data._collapsed_map || {};
    let infoMap = instance.data._info_map || {};
    instance.data._info_map = infoMap;
    let dragActive = !!instance.data._drag_button_active;
    let selectedId = str(instance.data._saved_selected_id || "");
    let searchResults = [];
    let currentResultIndex = -1;
    let renderedNodes = [];
    let roots = [];
    let childMap = {};
    let nodeMap = {};
    let allPositions = [];
    let svg;
    let container;
    let zoom;

    /* ---------------- ROOT + THEME ---------------- */
    canvas.innerHTML = "";
    const wrapper = doc.createElement("div");
    wrapper.id = uid;
    wrapper.className = "org-pro-root"
      + (config.orientation === "horizontal" ? " org-h" : "")
      + " org-layout-" + config.cardLayout
      + " org-avatar-" + config.avatarShape
      + " org-accent-" + config.accentPosition
      + " org-shadow-" + config.cardShadow;
    const themeVars = THEMES[config.theme] || null;
    if (themeVars) {
      Object.keys(themeVars).forEach(function(k) { wrapper.style.setProperty(k, themeVars[k]); });
    } else {
      const custom = makeTheme({
        bg: toCssColor(properties.background_color, "#f6f8fb"),
        text: toCssColor(properties.text_color, "#0f172a"),
        muted: alpha(toCssColor(properties.text_color, "#0f172a"), 0.6),
        accent: toCssColor(properties.accent_color, "#4f46e5"),
        card: toCssColor(properties.card_bg_color, "#ffffff"),
        connector: toCssColor(properties.connector_color, "#cbd5e1")
      });
      Object.keys(custom).forEach(function(k) { wrapper.style.setProperty(k, custom[k]); });
    }
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
      canvasLayer.innerHTML = "<div class='" + (isError ? "org-pro-error" : "org-pro-empty") + "'>" + icon.people + "<span>" + esc(message) + "</span></div>";
    }

    /* ---------------- TOOLBAR ---------------- */
    function renderToolbar() {
      const toolbar = doc.createElement("div");
      toolbar.className = "org-pro-toolbar org-no-export";
      toolbar.innerHTML =
        (config.showSearch
          ? '<div class="org-pro-searchwrap">' + icon.search +
            '<input class="org-pro-search" id="' + uid + '_search" type="search" placeholder="Pesquisar..." autocomplete="off">' +
            '<button class="org-pro-search-clear" id="' + uid + '_clear_btn" title="Limpar busca">&times;</button></div>' +
            '<div class="org-pro-nav" id="' + uid + '_nav">' +
            '<button class="org-pro-btn" id="' + uid + '_prev_btn" title="Resultado anterior">' + icon.prev + '</button>' +
            '<span class="org-pro-nav-count" id="' + uid + '_count">0/0</span>' +
            '<button class="org-pro-btn" id="' + uid + '_next_btn" title="Pr&oacute;ximo resultado">' + icon.next + '</button></div>'
          : "") +
        '<span class="org-pro-spacer"></span>' +
        '<div class="org-pro-group">' +
          (config.showFit ? '<button class="org-pro-btn" id="' + uid + '_fit_btn" title="Ajustar na tela">' + icon.fit + '</button>' : "") +
          (config.showExpandCollapse
            ? '<button class="org-pro-btn" id="' + uid + '_expand_btn" title="Expandir tudo">' + icon.expand + '</button>' +
              '<button class="org-pro-btn" id="' + uid + '_collapse_btn" title="Recolher tudo">' + icon.collapse + '</button>'
            : "") +
        '</div>' +
        (config.showOrientation
          ? '<div class="org-pro-seg" title="Orienta&ccedil;&atilde;o">' +
            '<button class="org-pro-btn" id="' + uid + '_vertical_btn" title="Vertical">' + icon.vertical + '</button>' +
            '<button class="org-pro-btn" id="' + uid + '_horizontal_btn" title="Horizontal">' + icon.horizontal + '</button></div>'
          : "") +
        ((config.showExportPng || config.showExportPdf)
          ? '<div class="org-pro-group">' +
            (config.showExportPng ? '<button class="org-pro-btn" id="' + uid + '_png_btn" title="Exportar PNG">' + icon.image + '</button>' : "") +
            (config.showExportPdf ? '<button class="org-pro-btn" id="' + uid + '_pdf_btn" title="Exportar PDF">' + icon.pdf + '</button>' : "") +
            '</div>'
          : "") +
        (config.showZoomControls
          ? '<div class="org-pro-seg" title="Zoom">' +
            '<button class="org-pro-btn" id="' + uid + '_zoomout_btn" title="Afastar">' + icon.zoomOut + '</button>' +
            '<span class="org-pro-zoom-level" id="' + uid + '_zoom_level">100%</span>' +
            '<button class="org-pro-btn" id="' + uid + '_zoomin_btn" title="Aproximar">' + icon.zoomIn + '</button></div>'
          : "") +
        (config.showDrag ? '<div class="org-pro-divider"></div><button class="org-pro-btn" id="' + uid + '_drag_btn" title="Mover cards">' + icon.drag + '<span class="org-pro-btn-label">Mover</span></button>' : "");
      wrapper.appendChild(toolbar);

      const qs = function(id) { return wrapper.querySelector("#" + uid + "_" + id); };
      const input = qs("search");
      if (input) {
        input.addEventListener("keydown", function(e) { if (e.key === "Enter") search(input.value); });
        input.addEventListener("input", function() {
          input.parentNode.classList.toggle("has-value", !!input.value);
          if (!input.value) resetSearch(false);
        });
      }
      if (qs("clear_btn")) qs("clear_btn").onclick = function() { resetSearch(true); };
      if (qs("fit_btn")) qs("fit_btn").onclick = function() { fitToChart(true); };
      if (qs("expand_btn")) qs("expand_btn").onclick = expandAll;
      if (qs("collapse_btn")) qs("collapse_btn").onclick = collapseAll;
      if (qs("pdf_btn")) qs("pdf_btn").onclick = function() { exportChart("pdf"); };
      if (qs("png_btn")) qs("png_btn").onclick = function() { exportChart("png"); };
      if (qs("prev_btn")) qs("prev_btn").onclick = prevResult;
      if (qs("next_btn")) qs("next_btn").onclick = nextResult;
      if (qs("vertical_btn")) qs("vertical_btn").onclick = function() { setOrientation("vertical"); };
      if (qs("horizontal_btn")) qs("horizontal_btn").onclick = function() { setOrientation("horizontal"); };
      if (qs("drag_btn")) qs("drag_btn").onclick = function() { setDragActive(!dragActive); };
      if (qs("zoomin_btn")) qs("zoomin_btn").onclick = function() { zoomBy(1.25); };
      if (qs("zoomout_btn")) qs("zoomout_btn").onclick = function() { zoomBy(0.8); };
      updateToolbarState();
    }
    renderToolbar();

    /* ---------------- DATA ---------------- */
    function readPositionsMap(raw) {
      const map = {};
      if (!raw) return map;
      const push = function(id, x, y) {
        if (id && Number.isFinite(Number(x)) && Number.isFinite(Number(y))) map[String(id)] = { x: Number(x), y: Number(y) };
      };
      if (Array.isArray(raw)) {
        raw.forEach(function(item) { if (item) push(item.id, item.x, item.y); });
      } else if (typeof raw === "object") {
        Object.keys(raw).forEach(function(id) { const item = raw[id]; if (item) push(id, item.x, item.y); });
      }
      return map;
    }
    function loadNodes() {
      const src = properties.source_headers;
      const total = src && typeof src.length === "function" ? src.length() : 0;
      if (!total) return { nodes: [], warnings: [] };
      const raw = src.get(0, total);
      const positions = config.applyInitialCoords ? readPositionsMap(config.initialCoords) : {};
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
          depth: 0,
          __original: item
        };
        if (positions[id] && !instance.data._positions_applied) {
          node._manualX = positions[id].x;
          node._manualY = positions[id].y;
        }
        const kept = instance.data._manual_positions && instance.data._manual_positions[id];
        if (kept) {
          node._manualX = kept.x;
          node._manualY = kept.y;
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
    function assignDepths() {
      const queue = roots.map(function(r) { return { node: r, depth: 1 }; });
      while (queue.length) {
        const cur = queue.shift();
        cur.node.depth = cur.depth;
        (childMap[cur.node.id] || []).forEach(function(child) {
          queue.push({ node: child, depth: cur.depth + 1 });
        });
      }
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
      assignDepths();
      if (renderedNodes.length) instance.data._positions_applied = true;
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
      empty("Hierarquia inválida: nenhum nó raiz encontrado", true);
      setStatus("error", "Hierarchy error: no root");
      return;
    }
    if (warnings.length) showToast(warnings.length + " aviso(s) nos dados");

    const perfActive = config.perfMode === "on" || (config.perfMode === "auto" && renderedNodes.length >= config.perfThreshold);
    if (perfActive) wrapper.classList.add("org-perf");
    safePublish("performance_mode_active", perfActive ? "1" : "0");

    if (!instance.data._collapsed_initialized) {
      if (config.initialDisplay === "collapsed") {
        renderedNodes.forEach(function(n) {
          if ((childMap[n.id] || []).length) collapsedMap[n.id] = true;
        });
      } else if (config.initialDisplay === "levels") {
        const lv = Math.max(1, config.initialLevels);
        renderedNodes.forEach(function(n) {
          if ((childMap[n.id] || []).length && n.depth >= lv) collapsedMap[n.id] = true;
        });
      }
      instance.data._collapsed_initialized = true;
      instance.data._collapsed_map = collapsedMap;
    }

    /* ---------------- SVG / ZOOM ---------------- */
    const width = Math.max(320, canvas.clientWidth || instance.canvas.width() || 900);
    const height = Math.max(260, canvas.clientHeight || instance.canvas.height() || 620);
    svg = D3.select(canvasLayer).append("svg")
      .attr("class", "org-pro-svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", [0, 0, width, height]);
    container = svg.append("g").attr("class", "org-pro-container");
    const publishZoom = debounce(function(k) {
      safePublish("current_zoom", String(Math.round(k * 100) / 100));
    }, 180);
    const applyTransform = rafThrottle(function(t) { container.attr("transform", t); });
    zoom = D3.zoom().scaleExtent([0.08, 3.5]).on("zoom", function(e) {
      applyTransform(e.transform);
      svg.node().__zoom = e.transform;
      instance.data._saved_transform = e.transform;
      updateZoomLabel(e.transform.k);
      publishZoom(e.transform.k);
    });
    svg.call(zoom);
    svg.on("mousedown.cursor", function() { svg.classed("is-grabbing", true); });
    svg.on("mouseup.cursor mouseleave.cursor", function() { svg.classed("is-grabbing", false); });
    svg.on("click.clear", function() {
      if (dragActive) return;
      clearSelection();
    });

    /* ---------------- LAYOUT ---------------- */
    const isDarkTheme = ["Midnight", "Graphite", "Obsidian"].indexOf(config.theme) >= 0;
    const baseHue = (function() {
      const c = hexToRgb(themeVars ? themeVars["--org-accent"] : toCssColor(properties.accent_color, "#4f46e5"));
      const r = c.r / 255, g = c.g / 255, b = c.b / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn;
      if (!dl) return 220;
      let h;
      if (mx === r) h = ((g - b) / dl) % 6;
      else if (mx === g) h = (b - r) / dl + 2;
      else h = (r - g) / dl + 4;
      return Math.round(h * 60 + 360) % 360;
    })();

    function buildTree(n) {
      const kids = childMap[n.id] || [];
      return Object.assign({}, n, { children: collapsedMap[n.id] ? null : kids.map(buildTree) });
    }
    function detailFields(n) {
      return [
        { label: config.title1, value: n.field_1 },
        { label: config.title2, value: n.field_2 },
        { label: config.title3, value: n.field_3 },
        { label: config.title4, value: n.field_4 },
        { label: config.title5, value: n.field_5 }
      ].filter(function(f) { return str(f.value).trim(); });
    }
    function detailsHeight(n) {
      const rows = detailFields(n).length;
      return rows ? rows * 34 + 18 : 0;
    }
    function textBlockHeight(n) {
      let h = 20;                                   // nome
      if (n.role) h += 17;
      if (config.extraLine1 && n.field_1) h += 15;
      if (config.extraLine2 && n.field_2) h += 15;
      return h;
    }
    function baseCardHeight(n) {
      if (!config.autoHeight) return config.nodeH;
      const pad = config.cardLayout === "center" ? 30 : 26;
      const inner = config.cardLayout === "center"
        ? (config.cardLayout === "compact" ? 0 : config.avatarSize) + 10 + textBlockHeight(n)
        : Math.max(config.cardLayout === "compact" ? 0 : config.avatarSize, textBlockHeight(n));
      return Math.max(58, Math.round(pad + inner));
    }
    function maxCardHeight() {
      if (!config.autoHeight) return config.nodeH;
      let m = 58;
      renderedNodes.forEach(function(n) { m = Math.max(m, baseCardHeight(n)); });
      return m;
    }
    function isInfoOpen(n) {
      return config.infoToggle && !!infoMap[n.id] && detailFields(n).length > 0;
    }
    let cardH = config.nodeH;
    function foHeight(n) {
      return cardH + (isInfoOpen(n) ? detailsHeight(n) : 0);
    }
    function displayX(d) {
      return config.orientation === "vertical" ? d.x : d.y + config.cardHOffset;
    }
    function displayY(d) {
      return config.orientation === "vertical" ? d.y : d.x;
    }
    function nodeTransform(d) {
      return "translate(" + (displayX(d) - config.nodeW / 2) + "," + (displayY(d) - cardH / 2 + config.cardVOffset) + ")";
    }
    function linkPath(d) {
      let sx, sy, tx, ty;
      if (config.connectorStyle === "straight") {
        if (config.orientation === "vertical") {
          return "M" + d.source.x + "," + (d.source.y + cardH / 2 + config.cardVOffset) +
                 " L" + d.target.x + "," + (d.target.y - cardH / 2 + config.cardVOffset);
        }
        return "M" + (d.source.y + config.nodeW / 2 + config.cardHOffset) + "," + (d.source.x + config.cardVOffset) +
               " L" + (d.target.y - config.nodeW / 2 + config.cardHOffset) + "," + (d.target.x + config.cardVOffset);
      }
      if (config.connectorStyle === "curved") {
        if (config.orientation === "vertical") {
          const csx = d.source.x, csy = d.source.y + cardH / 2 + config.cardVOffset;
          const ctx = d.target.x, cty = d.target.y - cardH / 2 + config.cardVOffset;
          const cmy = (csy + cty) / 2;
          return "M" + csx + "," + csy + " C" + csx + "," + cmy + " " + ctx + "," + cmy + " " + ctx + "," + cty;
        }
        const hsx = d.source.y + config.nodeW / 2 + config.cardHOffset, hsy = d.source.x + config.cardVOffset;
        const htx = d.target.y - config.nodeW / 2 + config.cardHOffset, hty = d.target.x + config.cardVOffset;
        const hmx = (hsx + htx) / 2;
        return "M" + hsx + "," + hsy + " C" + hmx + "," + hsy + " " + hmx + "," + hty + " " + htx + "," + hty;
      }
      if (config.orientation === "vertical") {
        sx = d.source.x;
        sy = d.source.y + cardH / 2 + config.cardVOffset;
        tx = d.target.x;
        ty = d.target.y - cardH / 2 + config.cardVOffset;
        const my = (sy + ty) / 2;
        if (Math.abs(tx - sx) < 2) return "M" + sx + "," + sy + " L" + tx + "," + ty;
        const dir = tx > sx ? 1 : -1;
        const r = Math.min(10, Math.abs(tx - sx) / 2, Math.abs(ty - my));
        return "M" + sx + "," + sy +
          " L" + sx + "," + (my - r) +
          " Q" + sx + "," + my + " " + (sx + dir * r) + "," + my +
          " L" + (tx - dir * r) + "," + my +
          " Q" + tx + "," + my + " " + tx + "," + (my + r) +
          " L" + tx + "," + ty;
      }
      sx = d.source.y + config.nodeW / 2 + config.cardHOffset;
      sy = d.source.x + config.cardVOffset;
      tx = d.target.y - config.nodeW / 2 + config.cardHOffset;
      ty = d.target.x + config.cardVOffset;
      const mx = (sx + tx) / 2;
      if (Math.abs(ty - sy) < 2) return "M" + sx + "," + sy + " L" + tx + "," + ty;
      const dirY = ty > sy ? 1 : -1;
      const r2 = Math.min(10, Math.abs(ty - sy) / 2, Math.abs(tx - mx));
      return "M" + sx + "," + sy +
        " L" + (mx - r2) + "," + sy +
        " Q" + mx + "," + sy + " " + mx + "," + (sy + dirY * r2) +
        " L" + mx + "," + (ty - dirY * r2) +
        " Q" + mx + "," + ty + " " + (mx + r2) + "," + ty +
        " L" + tx + "," + ty;
    }
    function cardHtml(d) {
      const n = d.data;
      const kids = (childMap[n.id] || []).length;
      const isCollapsed = !!collapsedMap[n.id];
      const highlighted = searchResults.indexOf(n.id) >= 0;
      const selected = selectedId === n.id;
      const fields = detailFields(n);
      const infoOpen = isInfoOpen(n);
      const extra1 = config.extraLine1 && n.field_1 ? '<div class="org-pro-card-extra">' + esc(n.field_1) + '</div>' : "";
      const extra2 = config.extraLine2 && n.field_2 ? '<div class="org-pro-card-extra">' + esc(n.field_2) + '</div>' : "";
      const details = infoOpen
        ? '<div class="org-pro-card-details">' + fields.map(function(f) {
            return '<div class="org-pro-card-field"><div class="org-pro-card-field-label">' + esc(f.label) + '</div><div class="org-pro-card-field-value">' + esc(f.value) + '</div></div>';
          }).join("") + '</div>'
        : "";
      const levelStyle = config.levelColors ? ' style="--org-accent:hsl(' + ((LEVEL_HUES[((n.depth || 1) - 1) % LEVEL_HUES.length] + baseHue) % 360) + ' 70% ' + (isDarkTheme ? "62%" : "48%") + ')"' : "";
      return '<div xmlns="http://www.w3.org/1999/xhtml" class="org-pro-card' +
        (highlighted ? " is-highlighted" : "") + (selected ? " is-selected" : "") + (infoOpen ? " is-info-open" : "") + '"' + levelStyle + '>' +
        '<div class="org-pro-card-head">' +
          '<img class="org-pro-avatar" loading="lazy" decoding="async" src="' + esc(n.avatar || FALLBACK_AVATAR) + '" onerror="this.onerror=null;this.src=\'' + esc(FALLBACK_AVATAR) + '\';" style="width:' + config.avatarSize + 'px;height:' + config.avatarSize + 'px">' +
          '<div class="org-pro-card-main">' +
            '<div class="org-pro-card-name">' + esc(n.name || "(sem nome)") + '</div>' +
            (n.role ? '<div class="org-pro-card-role">' + esc(n.role) + '</div>' : "") +
            extra1 + extra2 +
          '</div>' +
        '</div>' +
        details +
        (config.infoToggle && fields.length ? '<button type="button" class="org-pro-info-btn" data-info-id="' + esc(n.id) + '" title="' + (infoOpen ? "Recolher informações" : "Ver informações") + '">' + icon.chevron + '</button>' : "") +
        (kids ? '<button type="button" class="org-pro-kids' + (isCollapsed ? " is-collapsed" : "") + '" data-node-id="' + esc(n.id) + '" title="' + (isCollapsed ? "Expandir equipe" : "Recolher equipe") + '">' + icon.chevron + '<span>' + kids + '</span></button>' : "") +
        '</div>';
    }

    /* ---------------- RENDER ---------------- */
    function render() {
      container.selectAll("*").remove();
      allPositions = [];
      cardH = maxCardHeight();
      const gapV = Math.max(config.levelSpacing, cardH + 58);
      const gapH = Math.max(config.levelSpacing, config.nodeW + 70);
      let offsetX = 0;
      roots.forEach(function(root) {
        const tree = D3.tree().nodeSize(config.orientation === "vertical" ? [config.siblingSpacing, gapV] : [Math.max(config.levelSpacing, cardH + 34), config.siblingSpacing + config.horizontalExtra]);
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
          .attr("stroke", config.connectorColor || null)
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
          .attr("height", function(d) { return foHeight(d.data); })
          .html(cardHtml);

        nodeSel.each(function(d) {
          const n = nodeMap[d.data.id];
          allPositions.push({
            id: d.data.id,
            name: d.data.name,
            parentId: d.data.parentId || "",
            depth: n ? n.depth : 0,
            x: Math.round(d.x * 100) / 100,
            y: Math.round(d.y * 100) / 100,
            collapsed: !!collapsedMap[d.data.id],
            manual: !!(n && Number.isFinite(n._manualX))
          });
        });

        nodeSel.on("click", function(event, d) {
          if (dragActive) return;
          if (event.target && event.target.closest && event.target.closest(".org-pro-kids,.org-pro-info-btn")) return;
          event.stopPropagation();
          selectNode(d, true);
        });
        nodeSel.on("mousedown.dragCard", function(event, d) {
          if (!dragActive) return;
          event.stopPropagation();
          beginCardDrag(event, d);
        });
        nodeSel.selectAll(".org-pro-kids").nodes().forEach(function(btn) {
          btn.onclick = function(ev) {
            ev.stopPropagation();
            toggleCollapse(btn.getAttribute("data-node-id"));
          };
        });
        nodeSel.filter(function(d) { return isInfoOpen(d.data) || d.data.id === selectedId; }).raise();
        nodeSel.selectAll(".org-pro-info-btn").nodes().forEach(function(btn) {
          btn.onclick = function(ev) {
            ev.stopPropagation();
            toggleInfo(btn.getAttribute("data-info-id"));
          };
        });
        offsetX += span + (config.orientation === "horizontal" ? config.horizontalExtra : 90);
      });
      if (selectedId && !findNode(selectedId).empty()) markSelected(selectedId);
      svg.classed("is-dragmode", dragActive);
      publishAllPositions();
    }

    /* ---------------- OUTPUTS ---------------- */
    const publishAllPositions = debounce(function() {
      safePublish("all_positions_json", JSON.stringify(allPositions));
      safePublish("collapsed_ids_json", JSON.stringify(Object.keys(collapsedMap).filter(function(k) { return collapsedMap[k]; })));
      safeTrigger("organograma_positions_changed");
    }, 120);
    function currentPositions() {
      return renderedNodes.filter(function(n) { return Number.isFinite(n._manualX) && Number.isFinite(n._manualY); }).map(function(n) {
        return { id: n.id, x: Math.round(n._manualX * 100) / 100, y: Math.round(n._manualY * 100) / 100 };
      });
    }
    function persistManualPositions() {
      const map = {};
      renderedNodes.forEach(function(n) {
        if (Number.isFinite(n._manualX) && Number.isFinite(n._manualY)) map[n.id] = { x: n._manualX, y: n._manualY };
      });
      instance.data._manual_positions = map;
    }
    function publishPositions(activeId) {
      persistManualPositions();
      const positions = currentPositions();
      const active = activeId && nodeMap[activeId] ? nodeMap[activeId] : null;
      safePublish("positions_json", JSON.stringify(positions));
      safePublish("selected_drag_coord", active && Number.isFinite(active._manualX) ? JSON.stringify({ id: active.id, x: Math.round(active._manualX * 100) / 100, y: Math.round(active._manualY * 100) / 100, at: new Date().toISOString() }) : "");
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
        depth: n.depth || 0,
        x: Number.isFinite(n._manualX) ? Math.round(n._manualX * 100) / 100 : null,
        y: Number.isFinite(n._manualY) ? Math.round(n._manualY * 100) / 100 : null
      };
    }

    /* ---------------- SELECTION ---------------- */
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
      safePublish("selected_node", JSON.stringify(toPublicNode(nodeMap[d.data.id] || d.data)));
      markSelected(selectedId);
      if (config.showPanel && config.openPanelOnClick) openPanel(d);
      if (userAction) safeTrigger("organograma_node_clicked");
    }
    function openPanel(d) {
      wrapper.querySelectorAll(".org-pro-drawer").forEach(function(el) { el.remove(); });
      const n = d.data;
      const fields = detailFields(n);
      const drawer = doc.createElement("div");
      drawer.className = "org-pro-drawer org-no-export";
      drawer.style.width = Math.min(config.popupWidth, wrapper.clientWidth || config.popupWidth) + "px";
      drawer.innerHTML =
        '<button class="org-pro-drawer-close" type="button" title="Fechar">&times;</button>' +
        '<div class="org-pro-profile"><img src="' + esc(n.avatar || FALLBACK_AVATAR) + '" onerror="this.onerror=null;this.src=\'' + esc(FALLBACK_AVATAR) + '\';"><h2>' + esc(n.name || "(sem nome)") + '</h2>' + (n.role ? '<p>' + esc(n.role) + '</p>' : "") + '</div>' +
        '<div class="org-pro-field-list">' +
        (fields.length
          ? fields.map(function(f) { return '<div class="org-pro-field"><div class="org-pro-field-label">' + esc(f.label) + '</div><div class="org-pro-field-value">' + esc(f.value) + '</div></div>'; }).join("")
          : '<div class="org-pro-empty-fields">' + icon.people + '<span>Sem informações adicionais</span></div>') +
        '</div>';
      wrapper.appendChild(drawer);
      drawer.querySelector(".org-pro-drawer-close").onclick = clearSelection;
    }

    /* ---------------- TOOLBAR STATE ---------------- */
    function updateToolbarState() {
      const vertical = wrapper.querySelector("#" + uid + "_vertical_btn");
      const horizontal = wrapper.querySelector("#" + uid + "_horizontal_btn");
      const drag = wrapper.querySelector("#" + uid + "_drag_btn");
      if (vertical) vertical.classList.toggle("is-active", config.orientation === "vertical");
      if (horizontal) horizontal.classList.toggle("is-active", config.orientation === "horizontal");
      if (drag) drag.classList.toggle("is-active", dragActive);
      wrapper.classList.toggle("org-h", config.orientation === "horizontal");
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
      svg.classed("is-dragmode", dragActive);
      safeTrigger("organograma_drag_mode_changed");
    }

    /* ---------------- COLLAPSE / INFO ---------------- */
    function toggleCollapse(id) {
      collapsedMap[id] = !collapsedMap[id];
      instance.data._collapsed_map = collapsedMap;
      render();
      safeTrigger(collapsedMap[id] ? "organograma_node_collapsed" : "organograma_node_expanded");
    }
    function toggleInfo(id) {
      infoMap[id] = !infoMap[id];
      instance.data._info_map = infoMap;
      render();
    }
    function expandAll() {
      collapsedMap = {};
      instance.data._collapsed_map = collapsedMap;
      render();
      safeTrigger("organograma_expanded_all");
    }
    function collapseAll() {
      collapsedMap = {};
      renderedNodes.forEach(function(n) { if ((childMap[n.id] || []).length) collapsedMap[n.id] = true; });
      roots.forEach(function(r) { collapsedMap[r.id] = false; });
      instance.data._collapsed_map = collapsedMap;
      render();
      fitToChart(true);
      safeTrigger("organograma_collapsed_all");
    }

    /* ---------------- SEARCH ---------------- */
    function resetSearch(refit) {
      searchResults = [];
      currentResultIndex = -1;
      const input = wrapper.querySelector("#" + uid + "_search");
      if (input) {
        input.value = "";
        input.parentNode.classList.remove("has-value");
      }
      updateSearchNav();
      render();
      safePublish("search_result_count", 0);
      if (refit !== false) fitToChart(true);
    }
    function updateSearchNav() {
      const nav = wrapper.querySelector("#" + uid + "_nav");
      const count = wrapper.querySelector("#" + uid + "_count");
      if (!nav || !count) return;
      nav.classList.toggle("is-on", searchResults.length > 0);
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
        showToast("Nenhum resultado encontrado");
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
        safePublish("selected_node", JSON.stringify(toPublicNode(nodeMap[id] || d.data)));
        markSelected(id);
        if (config.showPanel && config.openPanelOnSearch) openPanel(d);
      }
      updateSearchNav();
    }
    function nextResult() { goToResult(currentResultIndex + 1); }
    function prevResult() { goToResult(currentResultIndex - 1); }
    function focusNode(d) {
      try {
        const node = findNode(d.data.id).node();
        const svgRect = svg.node().getBoundingClientRect();
        const t = svg.node().__zoom || D3.zoomIdentity;
        const rect = node.getBoundingClientRect();
        const cx = (rect.left + rect.width / 2 - svgRect.left - t.x) / t.k;
        const cy = (rect.top + rect.height / 2 - svgRect.top - t.y) / t.k;
        const scale = Math.max(0.4, Math.min(1.4, Math.min(width / (config.nodeW * 2.4), height / (cardH * 3.4))));
        const nt = D3.zoomIdentity.translate(width / 2 - scale * cx, height / 2 - scale * cy).scale(scale);
        svg.transition().duration(480).ease(D3.easeCubicOut).call(zoom.transform, nt);
      } catch (e) {}
    }
    function zoomBy(factor) {
      try { svg.transition().duration(220).call(zoom.scaleBy, factor); } catch (e) {}
    }
    function updateZoomLabel(k) {
      const el = wrapper.querySelector("#" + uid + "_zoom_level");
      if (el) el.textContent = Math.round(k * 100) + "%";
    }
    function fitToChart(animated) {
      try {
        const bbox = container.node().getBBox();
        const pad = 110;
        const scale = Math.max(0.12, Math.min(2.2, Math.min((width - pad) / Math.max(1, bbox.width), (height - pad) / Math.max(1, bbox.height))));
        const tx = width / 2 - scale * (bbox.x + bbox.width / 2);
        const ty = (height + 66) / 2 - scale * (bbox.y + bbox.height / 2);
        const t = D3.zoomIdentity.translate(tx, ty).scale(scale);
        const target = animated ? svg.transition().duration(520).ease(D3.easeCubicOut) : svg;
        target.call(zoom.transform, t);
      } catch (e) {}
    }

    /* ---------------- DRAG ---------------- */
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
      dragState = {
        start: pt,
        nodes: collectDragNodes(d).map(function(x) { return { id: x.data.id, x: x.x, y: x.y }; }),
        activeId: d.data.id
      };
      svg.on("mousemove.dragCard", moveCardDrag);
      svg.on("mouseup.dragCard", endCardDrag);
      safeTrigger("organograma_drag_started");
    }
    const applyDragFrame = rafThrottle(function() {
      container.selectAll(".org-pro-node").attr("transform", function(d) {
        const node = nodeMap[d.data.id];
        if (node && Number.isFinite(node._manualX) && Number.isFinite(node._manualY)) {
          d.x = node._manualX;
          d.y = node._manualY;
        }
        return nodeTransform(d);
      });
      container.selectAll(".org-pro-link").attr("d", linkPath);
    });
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
      applyDragFrame();
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
      instance.data._manual_positions = {};
      publishPositions("");
      render();
      fitToChart(true);
      safeTrigger("organograma_positions_reset");
    }

    /* ---------------- EXPORT ---------------- */
    async function exportChart(kind) {
      try {
        if (!html2canvasRef) throw new Error("html2canvas was not loaded");
        if (kind === "pdf" && !jsPDFRef) throw new Error("jsPDF was not loaded");
        const oldTransform = svg.node().__zoom || D3.zoomIdentity;
        fitToChart(false);
        await new Promise(function(resolve) { setTimeout(resolve, 120); });
        const canvasEl = await html2canvasRef(wrapper, {
          scale: config.exportScale,
          useCORS: true,
          backgroundColor: getComputedStyle(wrapper).getPropertyValue("--org-bg").trim() || "#ffffff",
          ignoreElements: function(el) { return el.classList && el.classList.contains("org-no-export"); }
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

    /* ---------------- BOOT ---------------- */
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
      toggleInfo: toggleInfo,
      resetPositions: resetPositions,
      exportPdf: function() { exportChart("pdf"); },
      exportPng: function() { exportChart("png"); },
      getPositions: currentPositions,
      getAllPositions: function() { return allPositions.slice(); },
      zoomIn: function() { zoomBy(1.25); },
      zoomOut: function() { zoomBy(0.8); },
      zoomTo: function(k) { try { svg.transition().duration(220).call(zoom.scaleTo, Number(k) || 1); } catch (e) {} },
      instanceId: uid
    };
    updateZoomLabel((svg.node().__zoom || D3.zoomIdentity).k);
    safePublish("api_instance_id", uid);
    safePublish("all_positions_json", JSON.stringify(allPositions));
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
