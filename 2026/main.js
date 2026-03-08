const I18N = {
  vi: {
    pageTitle: "Thiệp 8/3 - Gửi trọn sự trân trọng",
    eyebrow: "Ngày Quốc tế Phụ nữ",
    title: "Chúc mừng 8/3 thật rạng rỡ",
    subtitle: "Gửi đến những người phụ nữ tuyệt vời một lời chúc ngọt ngào và chân thành.",
    line1: "Chúc bạn luôn xinh đẹp, tự tin và hạnh phúc trên hành trình riêng của mình.",
    line2: "Mong rằng mỗi ngày đều được bao bọc bởi sự tôn trọng, yêu thương và bình yên.",
    signature: "Yêu thương và trân trọng.",
    musicOn: "Tắt nhạc",
    musicOff: "Bật nhạc",
    audioErrorTitle: "Không tải được file nhạc. Hãy thay file trong thư mục assets."
  },
  en: {
    pageTitle: "Women's Day Card - A Floral Wish",
    eyebrow: "International Women's Day",
    title: "Happy Women's Day 8/3",
    subtitle: "A gentle note for the women who bring warmth, strength, and grace.",
    line1: "Wishing you confidence, joy, and beautiful moments in every chapter ahead.",
    line2: "May each day surround you with respect, kindness, and the love you deserve.",
    signature: "With admiration and love.",
    musicOn: "Mute Music",
    musicOff: "Play Music",
    audioErrorTitle: "Unable to load the music file. Please replace it in the assets folder."
  }
};

const ASSETS = {
  bgImage: "assets/floral-bg.svg",
  musicFile: "assets/sample-music.wav",
  musicVolume: 0.45,
  musicFadeInMs: 820,
  musicFadeOutMs: 420
};

const LANG_STORAGE_KEY = "womens_day_lang";
const DEFAULT_LANG = "vi";

let currentLang = DEFAULT_LANG;
let isMusicOn = false;
let musicAudio;
let latestMusicRequestId = 0;
let activeFadeJob = null;

function detectLanguage() {
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  if (stored && I18N[stored]) {
    return stored;
  }

  const browserLanguages = navigator.languages || [navigator.language || ""];
  const normalized = browserLanguages
    .filter(Boolean)
    .map((lang) => lang.toLowerCase());

  if (normalized.some((lang) => lang.startsWith("vi"))) {
    return "vi";
  }
  if (normalized.some((lang) => lang.startsWith("en"))) {
    return "en";
  }
  return DEFAULT_LANG;
}

function applyLanguage(lang, shouldPersist) {
  currentLang = I18N[lang] ? lang : DEFAULT_LANG;
  const dict = I18N[currentLang];

  document.documentElement.lang = currentLang;
  document.title = dict.pageTitle;

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    if (dict[key]) {
      node.textContent = dict[key];
    }
  });

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    const isActive = btn.dataset.lang === currentLang;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  });

  syncMusicButtonState();

  if (shouldPersist) {
    window.localStorage.setItem(LANG_STORAGE_KEY, currentLang);
  }
}

function initMusicAudio() {
  if (musicAudio) {
    return musicAudio;
  }

  musicAudio = new Audio(ASSETS.musicFile);
  musicAudio.preload = "auto";
  musicAudio.loop = true;
  musicAudio.volume = 0;

  musicAudio.addEventListener("error", () => {
    const button = document.getElementById("musicToggle");
    if (button) {
      button.disabled = true;
      button.title = I18N[currentLang].audioErrorTitle;
    }
    isMusicOn = false;
    syncMusicButtonState();
  });

  return musicAudio;
}

function updateMusicButtonText() {
  const label = document.querySelector(".music-btn__label");
  if (!label) {
    return;
  }
  label.textContent = isMusicOn ? I18N[currentLang].musicOn : I18N[currentLang].musicOff;
}

function syncMusicButtonState() {
  const button = document.getElementById("musicToggle");
  if (!button) {
    return;
  }

  button.setAttribute("aria-pressed", String(isMusicOn));
  button.setAttribute(
    "aria-label",
    currentLang === "vi"
      ? (isMusicOn ? "Tắt nhạc nền" : "Bật nhạc nền")
      : (isMusicOn ? "Mute background music" : "Play background music")
  );
  updateMusicButtonText();
}

function stopCurrentFade() {
  if (!activeFadeJob) {
    return;
  }
  cancelAnimationFrame(activeFadeJob.frameId);
  activeFadeJob.resolve();
  activeFadeJob = null;
}

function animateVolume(targetVolume, durationMs) {
  const audio = musicAudio;
  if (!audio) {
    return Promise.resolve();
  }

  stopCurrentFade();

  const from = audio.volume;
  const to = Math.min(1, Math.max(0, targetVolume));
  if (Math.abs(from - to) < 0.001 || durationMs <= 0) {
    audio.volume = to;
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const start = performance.now();
    const job = {
      frameId: 0,
      resolved: false,
      resolve: () => {
        if (job.resolved) {
          return;
        }
        job.resolved = true;
        activeFadeJob = null;
        resolve();
      }
    };

    const step = (timestamp) => {
      if (activeFadeJob !== job) {
        job.resolve();
        return;
      }

      const elapsed = timestamp - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      audio.volume = from + (to - from) * eased;

      if (progress >= 1) {
        audio.volume = to;
        job.resolve();
        return;
      }
      job.frameId = requestAnimationFrame(step);
    };

    activeFadeJob = job;
    job.frameId = requestAnimationFrame(step);
  });
}

function safePlayAudio(audio) {
  const result = audio.play();
  if (result && typeof result.then === "function") {
    return result;
  }
  return Promise.resolve();
}

async function setMusicState(nextState) {
  const button = document.getElementById("musicToggle");
  if (!button) {
    return;
  }

  const audio = initMusicAudio();
  const requestId = ++latestMusicRequestId;
  isMusicOn = nextState;
  button.classList.add("is-busy");
  syncMusicButtonState();

  try {
    if (nextState) {
      if (audio.paused) {
        await safePlayAudio(audio);
      }
      if (requestId !== latestMusicRequestId) {
        return;
      }
      await animateVolume(ASSETS.musicVolume, ASSETS.musicFadeInMs);
    } else {
      await animateVolume(0, ASSETS.musicFadeOutMs);
      if (requestId !== latestMusicRequestId) {
        return;
      }
      if (!isMusicOn && !audio.paused) {
        audio.pause();
      }
    }
  } catch (error) {
    isMusicOn = false;
    stopCurrentFade();
    audio.volume = 0;
    audio.pause();
    console.warn("Music playback failed:", error);
  } finally {
    if (requestId === latestMusicRequestId) {
      button.classList.remove("is-busy");
      syncMusicButtonState();
    }
  }
}

function bootAnimations() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const narrowViewport = window.matchMedia("(max-width: 768px)").matches;
  const motionScale = reduceMotion ? 0 : narrowViewport ? 0.72 : 1;

  document.documentElement.style.setProperty("--motion-scale", String(motionScale));

  if (reduceMotion || typeof window.gsap === "undefined") {
    return;
  }

  const { gsap } = window;
  gsap.from(".card", {
    opacity: 0,
    y: 36 * motionScale,
    duration: 0.95,
    ease: "power3.out"
  });

  gsap.from([".eyebrow", ".title", ".subtitle", ".message p", ".signature"], {
    opacity: 0,
    y: 18 * motionScale,
    stagger: 0.11,
    duration: 0.7,
    ease: "power2.out",
    delay: 0.2
  });

  gsap.to(".scene__halo--a", {
    opacity: 0.58,
    scale: 1.08,
    duration: 4.8,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });

  gsap.to(".scene__halo--b", {
    opacity: 0.5,
    scale: 0.92,
    duration: 5.4,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });

  gsap.to(".scene__flowers", {
    x: 9 * motionScale,
    y: -8 * motionScale,
    rotation: 1.2 * motionScale,
    duration: 6.8,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });

  gsap.to(".petal--1", {
    x: 14 * motionScale,
    y: -19 * motionScale,
    rotation: 46,
    duration: 7.2,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });

  gsap.to(".petal--2", {
    x: -11 * motionScale,
    y: 16 * motionScale,
    rotation: -36,
    duration: 6.3,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });

  gsap.to(".petal--3", {
    x: 17 * motionScale,
    y: -12 * motionScale,
    rotation: 64,
    duration: 7.7,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });

  gsap.to(".petal--4", {
    x: -13 * motionScale,
    y: -15 * motionScale,
    rotation: -28,
    duration: 7,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });
}

function bindControls() {
  const flowerImage = document.querySelector(".scene__flowers");
  if (flowerImage) {
    flowerImage.src = ASSETS.bgImage;
  }

  document.querySelectorAll(".lang-btn").forEach((button) => {
    button.addEventListener("click", () => {
      applyLanguage(button.dataset.lang, true);
    });
  });

  const musicButton = document.getElementById("musicToggle");
  if (musicButton) {
    musicButton.addEventListener("click", () => {
      void setMusicState(!isMusicOn);
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  bindControls();
  initMusicAudio();
  applyLanguage(detectLanguage(), false);
  syncMusicButtonState();
  bootAnimations();
});
