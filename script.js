// script.js — Nuflux site wiring (playlist + UA + player)
// Tip: open DevTools (F12) > Console to see logs.

(function () {
    const log = (...a) => console.log("[nuflux]", ...a);
    const warn = (...a) => console.warn("[nuflux]", ...a);
    const err = (...a) => console.error("[nuflux]", ...a);

    // === DOM refs (match your current HTML) ===
    const sys = document.getElementById("sysInfo");
    const audio = document.getElementById("audio");
    // System info chips
    document.getElementById('ua').textContent = 'UA: ' + navigator.userAgent;
    document.getElementById('plat').textContent = 'Platform: ' + navigator.platform;
    document.getElementById('lang').textContent = 'Lang: ' + navigator.language;

    const titleEl = document.getElementById("trackTitle");
    const playBtn = document.getElementById("play");
    const pauseBtn = document.getElementById("pause");
    const prevBtn = document.getElementById("prev");
    const nextBtn = document.getElementById("next");
    const vol = document.getElementById("volume");
    const bar = document.getElementById("bar");
    const fill = document.getElementById("fill");
    const cur = document.getElementById("cur");
    const dur = document.getElementById("dur");

    // If any key element is missing, bail early (prevents silent JS errors)
    function assertEl(el, id) {
        if (!el) { err(`Missing element #${id}. Check HTML id.`); }
        return !!el;
    }
    if (![audio, titleEl, playBtn, pauseBtn, prevBtn, nextBtn, vol, bar, fill, cur, dur].every(Boolean)) {
        err("One or more required elements missing. Verify IDs in index.html.");
    }

    // === System info (UA/platform/lang) ===
    if (sys) {
        const info = [
            `UA: ${navigator.userAgent}`,
            `Platform: ${navigator.platform}`,
            `Lang: ${navigator.language}`
        ];
        // Render as chips similar to your styling
        sys.innerHTML = info.map(t => `<div class="chip" style="display:block;margin:2px 0;">${t}</div>`).join("");
    } else {
        warn("#sysInfo not found — UA display skipped.");
    }

    // === Helpers ===
    const fmt = t => (!isFinite(t) ? "0:00" : `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,"0")}`);
    const prettify = s => s.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().replace(/\s+/g, " ").replace(/\b\w/g, m => m.toUpperCase());

    // === Playlist loading ===
    const isHttp = location.protocol === "http:" || location.protocol === "https:";

    async function tryLoadPlaylistJson() {
        try {
            const r = await fetch("assets/music/playlist.json", { cache: "no-store" });
            if (!r.ok) return null;
            const arr = await r.json();
            if (!Array.isArray(arr) || !arr.length) return null;
            log(`Loaded ${arr.length} tracks from playlist.json`);
            return arr.map(it => ({
                title: it.title || prettify((it.url || "").split("/").pop() || "Track"),
                                  url: it.url,
                                  artist: it.artist || "",
                                  album: it.album || "",
                                  track: typeof it.track === "number" ? it.track : null,
                                  duration: typeof it.duration === "number" ? it.duration : null
            }));
        } catch (e) {
            warn("playlist.json fetch failed:", e);
            return null;
        }
    }

    async function probeTracksHttp() {
        // Only works over HTTP(S); uses HEAD to check existence.
        const out = [];
        for (let i = 1; i <= 30; i++) {
            const url = `assets/music/track${i}.mp3`;
            try {
                const r = await fetch(url, { method: "HEAD" });
                if (r.ok) out.push({ title: `Track ${i}`, url });
            } catch (_e) {}
        }
        if (out.length) log(`Probed ${out.length} tracks via HEAD`);
        return out.length ? out : null;
    }

    async function loadPlaylist() {
        if (isHttp) {
            const json = await tryLoadPlaylistJson();
            if (json) return json;

            const probed = await probeTracksHttp();
            if (probed) return probed;

            warn("No playlist.json and no trackN.mp3 found. Falling back to demo.");
            return [{ title: "Demo Track", url: "assets/track.mp3" }];
        } else {
            // file:// — fetch/HEAD are blocked; we can’t discover files.
            warn("Running from file:// — Start a local server so playlist.json can load. Falling back to demo track.");
            return [{ title: "Demo Track", url: "assets/track.mp3" }];
        }
    }

    // === Player wiring ===
    let playlist = [];
    let idx = 0;

    function setTitle(i) {
        const t = playlist[i];
        titleEl.textContent = t ? (t.title || prettify((t.url||"").split("/").pop() || "Track")) : "—";
    }

    function setTrack(i, autoplay = true) {
        if (!playlist.length) return;
        idx = (i + playlist.length) % playlist.length;
        const tr = playlist[idx];
        audio.src = tr.url;
        setTitle(idx);
        audio.load();
        if (autoplay) {
            audio.play().catch(e => {
                // Autoplay may be blocked until user gesture; that’s fine.
                warn("Autoplay blocked until user interacts:", e?.message || e);
            });
        }
    }

    // time & progress
    audio.addEventListener("loadedmetadata", () => {
        dur.textContent = fmt(audio.duration);
    });
    audio.addEventListener("timeupdate", () => {
        cur.textContent = fmt(audio.currentTime);
        fill.style.width = `${(audio.currentTime / (audio.duration || 1)) * 100}%`;
    });
    audio.addEventListener("ended", () => setTrack(idx + 1));

    bar.addEventListener("click", (e) => {
        const r = bar.getBoundingClientRect();
        const x = Math.min(Math.max(0, e.clientX - r.left), r.width);
        audio.currentTime = (x / r.width) * (audio.duration || 0);
    });

    // controls
    playBtn?.addEventListener("click", () => audio.play());
    pauseBtn?.addEventListener("click", () => audio.pause());
    nextBtn?.addEventListener("click", () => setTrack(idx + 1));
    prevBtn?.addEventListener("click", () => setTrack(idx - 1));

    // volume
    if (vol) {
        vol.value = 1;
        audio.volume = 1;
        vol.addEventListener("input", () => { audio.volume = parseFloat(vol.value); });
    }

    // keyboard shortcuts
    document.addEventListener("keydown", (e) => {
        if (e.code === "Space") { e.preventDefault(); audio.paused ? audio.play() : audio.pause(); }
        if (e.key === "ArrowRight") setTrack(idx + 1);
        if (e.key === "ArrowLeft")  setTrack(idx - 1);
    });

        // init
        loadPlaylist().then(pl => {
            playlist = pl;
            setTrack(0, false); // don’t autoplay until the user clicks
            setTitle(0);
        }).catch((e) => {
            err("Playlist load failed hard:", e);
            playlist = [{ title: "Demo Track", url: "assets/track.mp3" }];
            setTrack(0, false);
            setTitle(0);
        });
})();
