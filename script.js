/* ============================================================
   求婚 Web App — script.js
   ① 信封開啟 + 音樂淡入
   ② 照片輪播（scroll-snap + 按鈕 + 圓點）
   ③ 捲動浮現（Intersection Observer）
   ④ 漂浮光點
   ⑤ 逃跑的「再想想」按鈕
   ⑥ 「我願意」→ canvas-confetti + 最終告白字卡
   ============================================================ */

(() => {
  "use strict";

  const bgm = document.getElementById("bgm");
  const intro = document.getElementById("intro");
  const envelope = document.getElementById("envelope");
  const story = document.getElementById("story");
  const musicToggle = document.getElementById("musicToggle");

  /* ------------------------------------------------------------
     ⓪ 密碼鎖：驗證通過才放行
     密碼只存 SHA-256 雜湊值，頁面原始碼看不到明碼。
     （注意：這只能擋「打開網址的訪客」，公開 repo 內的檔案
       仍然可被直接瀏覽，並非真正的資安防護。）
     ------------------------------------------------------------ */
  const LOCK_HASH = "46437ab18a6657040b4535297ff247b20c535c02263713f88b6a9e17484f1f3f";
  const LOCK_HASH_FALLBACK = 2088290667; // djb2，給不支援 crypto.subtle 的環境用

  const lock = document.getElementById("lock");
  const lockForm = document.getElementById("lockForm");
  const lockInput = document.getElementById("lockInput");
  const lockError = document.getElementById("lockError");
  const lockCard = lock.querySelector(".lock-card");

  async function sha256Hex(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function djb2(text) {
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = (h * 33 + text.charCodeAt(i)) >>> 0;
    return h;
  }

  lockForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const value = lockInput.value.trim();

    let ok = false;
    if (window.crypto && crypto.subtle) {
      ok = (await sha256Hex(value)) === LOCK_HASH;
    } else {
      ok = djb2(value) === LOCK_HASH_FALLBACK;
    }

    if (ok) {
      lock.classList.add("fade-out");
      setTimeout(() => lock.remove(), 1000);
    } else {
      lockError.hidden = false;
      lockInput.value = "";
      lockCard.classList.remove("shake");
      requestAnimationFrame(() => lockCard.classList.add("shake"));
      lockInput.focus();
    }
  });

  lockInput.focus();

  /* ------------------------------------------------------------
     ① 信封開啟：CSS 動畫 → 淡出首頁 → 顯示時間軸 + 音樂淡入
     ------------------------------------------------------------ */
  const TARGET_VOLUME = 0.7;

  function fadeInMusic(duration = 3000) {
    bgm.volume = 0;
    const play = bgm.play();
    if (play) play.catch(() => {/* 若被瀏覽器擋下，之後點音樂鈕仍可播放 */});

    const steps = 60;
    const stepTime = duration / steps;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      bgm.volume = Math.min(TARGET_VOLUME, (i / steps) * TARGET_VOLUME);
      if (i >= steps) clearInterval(timer);
    }, stepTime);
  }

  envelope.addEventListener("click", () => {
    if (envelope.classList.contains("open")) return;
    envelope.classList.add("open");   // 觸發信封開啟 CSS 動畫
    fadeInMusic();                    // 音樂淡入

    // 等信封動畫演完，再優雅地淡出首頁
    setTimeout(() => {
      intro.classList.add("fade-out");
      story.hidden = false;
      musicToggle.hidden = false;
      requestAnimationFrame(() => setupReveal());
      setTimeout(() => intro.remove(), 1400);
    }, 1200);
  });

  /* --- 音樂開關 --- */
  musicToggle.addEventListener("click", () => {
    if (bgm.paused) {
      bgm.play();
      bgm.volume = TARGET_VOLUME;
      musicToggle.classList.remove("muted");
    } else {
      bgm.pause();
      musicToggle.classList.add("muted");
    }
  });

  /* ------------------------------------------------------------
     ② 照片輪播：每個 .carousel 自動接上按鈕與圓點
     ------------------------------------------------------------ */
  document.querySelectorAll(".carousel").forEach((carousel) => {
    const track = carousel.querySelector(".car-track");
    const slides = [...carousel.querySelectorAll(".slide")];
    const dotsBox = carousel.querySelector(".car-dots");

    // 依照片張數生成圓點
    const dots = slides.map((_, i) => {
      const dot = document.createElement("button");
      dot.className = "dot" + (i === 0 ? " active" : "");
      dot.setAttribute("aria-label", `第 ${i + 1} 張`);
      dot.addEventListener("click", () => scrollToSlide(i));
      dotsBox.appendChild(dot);
      return dot;
    });

    function scrollToSlide(i) {
      track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft, behavior: "smooth" });
    }

    function currentIndex() {
      return Math.round(track.scrollLeft / track.clientWidth);
    }

    carousel.querySelector(".prev").addEventListener("click", () => {
      scrollToSlide(Math.max(0, currentIndex() - 1));
    });
    carousel.querySelector(".next").addEventListener("click", () => {
      scrollToSlide(Math.min(slides.length - 1, currentIndex() + 1));
    });

    // 滑動時同步圓點狀態
    let raf = null;
    track.addEventListener("scroll", () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const idx = currentIndex();
        dots.forEach((d, i) => d.classList.toggle("active", i === idx));
        raf = null;
      });
    });
  });

  /* --- 燈箱：點照片放大 --- */
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = lightbox.querySelector("img");

  document.querySelectorAll(".slide img").forEach((img) => {
    img.addEventListener("click", () => {
      lightboxImg.src = img.src;
      lightbox.hidden = false;
      requestAnimationFrame(() => lightbox.classList.add("show"));
    });
  });

  lightbox.addEventListener("click", () => {
    lightbox.classList.remove("show");
    setTimeout(() => { lightbox.hidden = true; lightboxImg.src = ""; }, 450);
  });

  /* ------------------------------------------------------------
     ③ 捲動浮現動畫（Intersection Observer）
     ------------------------------------------------------------ */
  function setupReveal() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target); // 只演一次，保持乾淨
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
  }

  /* ------------------------------------------------------------
     ④ 漂浮光點：隨機大小、位置、速度
     ------------------------------------------------------------ */
  const sparkleBox = document.getElementById("sparkles");
  const SPARKLE_COUNT = 26;

  for (let i = 0; i < SPARKLE_COUNT; i++) {
    const s = document.createElement("span");
    s.className = "sparkle";
    const size = 4 + Math.random() * 9;
    s.style.width = `${size}px`;
    s.style.height = `${size}px`;
    s.style.left = `${Math.random() * 100}%`;
    s.style.setProperty("--drift", `${(Math.random() - 0.5) * 140}px`);
    s.style.animationDuration = `${9 + Math.random() * 14}s`;
    s.style.animationDelay = `${Math.random() * 16}s`;
    sparkleBox.appendChild(s);
  }

  /* ------------------------------------------------------------
     ⑤ 逃跑的「再想想」按鈕（絕對按不到）
     ------------------------------------------------------------ */
  const noBtn = document.getElementById("noBtn");
  const noTexts = ["再想想", "真的嗎？", "不考慮喔？", "抓不到我～", "要不要再想想你的選擇 😏", "點左邊那顆啦！"];
  let noCount = 0;

  function dodge() {
    const pad = 16;
    const w = noBtn.offsetWidth;
    const h = noBtn.offsetHeight;
    const maxX = window.innerWidth - w - pad;
    const maxY = window.innerHeight - h - pad;

    // 第一次逃跑時，在原位置留一個隱形佔位，避免「我願意」突然位移
    if (!noBtn.classList.contains("runaway")) {
      const ghost = document.createElement("span");
      ghost.style.cssText = `display:inline-block;width:${w}px;height:${h}px;visibility:hidden;`;
      noBtn.parentElement.insertBefore(ghost, noBtn);
    }

    noBtn.classList.add("runaway");

    // 隨機找位置，但不能壓在「我願意」上面
    const yesRect = yesBtn.getBoundingClientRect();
    let x, y, tries = 0;
    do {
      x = pad + Math.random() * (maxX - pad);
      y = pad + Math.random() * (maxY - pad);
      tries++;
    } while (
      tries < 20 &&
      x < yesRect.right + 30 && x + w > yesRect.left - 30 &&
      y < yesRect.bottom + 30 && y + h > yesRect.top - 30
    );

    noBtn.style.left = `${x}px`;
    noBtn.style.top = `${y}px`;
    noBtn.style.transform = `rotate(${(Math.random() - 0.5) * 14}deg)`;

    noCount++;
    noBtn.textContent = noTexts[Math.min(noCount, noTexts.length - 1)];
  }

  // Hover（桌機）、touchstart（手機）、click（保險）通通逃跑
  noBtn.addEventListener("mouseenter", dodge);
  noBtn.addEventListener("touchstart", (e) => { e.preventDefault(); dodge(); }, { passive: false });
  noBtn.addEventListener("click", (e) => { e.preventDefault(); dodge(); });

  /* ------------------------------------------------------------
     ⑥ 「我願意」→ 彩帶雨 + 最終告白字卡
     ------------------------------------------------------------ */
  const yesBtn = document.getElementById("yesBtn");
  const finalModal = document.getElementById("finalModal");

  function celebrate() {
    const colors = ["#e58ba1", "#b94d68", "#f6d186", "#fffdf8", "#c9a86a"];

    // 開場大爆發
    confetti({ particleCount: 160, spread: 100, origin: { y: 0.6 }, colors });

    // 兩側持續灑花 4 秒
    const end = Date.now() + 4000;
    (function frame() {
      confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors });
      confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();

    // 最後再從天而降愛心色彩帶
    setTimeout(() => {
      confetti({ particleCount: 220, spread: 160, startVelocity: 40, origin: { y: 0.2 }, colors });
    }, 800);
  }

  yesBtn.addEventListener("click", () => {
    celebrate();
    noBtn.style.display = "none"; // 答應了，「再想想」功成身退

    setTimeout(() => {
      finalModal.hidden = false;
      requestAnimationFrame(() => finalModal.classList.add("show"));
    }, 900);
  });

  /* ------------------------------------------------------------
     ⑦ 回顧按鈕：關閉告白卡，回到回憶時間軸頂端重新瀏覽
     ------------------------------------------------------------ */
  document.getElementById("reviewBtn").addEventListener("click", () => {
    finalModal.classList.remove("show");
    setTimeout(() => {
      finalModal.hidden = true;
      document.querySelector(".hero").scrollIntoView({ behavior: "smooth", block: "start" });
    }, 600); // 等淡出動畫演完再捲動
  });
})();
