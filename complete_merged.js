// ========== 0. GLOBAL UTILITIES ==========
// 全局错误处理
window.addEventListener('error', (e) => {
  console.error('[Error]', e.message, e.filename, e.lineno);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[Unhandled Promise Rejection]', e.reason);
});

const safeStorage = {
  get(key, fallback = null) {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); return true; } catch { return false; }
  }
};

// 全局音效管理器 - 使用 Web Audio API 生成音效
const SoundManager = {
  enabled: false,
  audioContext: null,
  
  init() {
    if (this.enabled) return;
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.enabled = true;
    } catch (e) {
      console.log('Audio context not supported');
    }
  },
  
  playBeep(frequency, duration, type = 'sine') {
    if (!this.enabled || !this.audioContext) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  },
  
  play(type) {
    if (!this.enabled) return;
    
    switch(type) {
      case 'start': // 红灯音效
        this.playBeep(800, 0.1, 'sine');
        break;
      case 'go': // 绿灯音效
        this.playBeep(1200, 0.2, 'sine');
        break;
      case 'click': // 点击音效
        this.playBeep(1000, 0.05, 'triangle');
        break;
      case 'success': // 成功音效
        const now = this.audioContext.currentTime;
        [440, 554, 659].forEach((freq, i) => {
          setTimeout(() => this.playBeep(freq, 0.15, 'sine'), i * 100);
        });
        break;
      case 'false-start': // 抢跑警告
        this.playBeep(200, 0.3, 'sawtooth');
        break;
      case 'correct': // 答对
        this.playBeep(600, 0.15, 'sine');
        break;
      case 'wrong': // 答错
        this.playBeep(300, 0.2, 'sawtooth');
        break;
      case 'complete': // 完成
        [523, 659, 784, 1047].forEach((freq, i) => {
          setTimeout(() => this.playBeep(freq, 0.2, 'sine'), i * 120);
        });
        break;
    }
  }
};

const eventManager = {
  handlers: [],
  on(element, event, handler, options) {
    element.addEventListener(event, handler, options);
    this.handlers.push({ element, event, handler, options });
  },
  off(element, event, handler) {
    element.removeEventListener(event, handler);
  },
  destroy() {
    this.handlers.forEach(({ element, event, handler, options }) => {
      element.removeEventListener(event, handler, options);
    });
    this.handlers = [];
  }
};

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ========== 1. MAIN APP CORE ==========
class App {
  init() {
    this.scrollToTopOnLoad();
    this.setupLoader();
    this.setupCursor();
    this.setupNavigation();
    this.setupScrollProgress();
    this.setupNavHideOnScroll();
  }

  scrollToTopOnLoad() {
    if (window.location.hash) history.replaceState(null, null, window.location.pathname);
    window.scrollTo(0, 0);
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  }

  setupLoader() {
    const loader = document.getElementById('loader');
    const bar = document.getElementById('loaderBar');
    const percent = document.getElementById('loaderPercent');
    if (!loader) return;
    
    if (percent) percent.style.display = 'none';
    
    let hasLoaded = false;
    const minDisplayTime = 400;
    const startTime = performance.now();
    
    function hideLoader() {
      if (hasLoaded) return;
      hasLoaded = true;
      
      const elapsed = performance.now() - startTime;
      const remainingTime = Math.max(0, minDisplayTime - elapsed);
      
      setTimeout(() => {
        bar.style.width = '100%';
        setTimeout(() => {
          loader.classList.add('hidden');
          const hero = document.querySelector('.section-hero');
          if (hero) hero.classList.add('in-view');
        }, 400);
      }, remainingTime);
    }
    
    if (document.readyState === 'complete') {
      hideLoader();
    } else {
      window.addEventListener('load', hideLoader);
    }
    
    function animateLoader(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / 2000, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      
      bar.style.width = (easedProgress * 100) + '%';
      
      if (progress < 1 && !hasLoaded) {
        requestAnimationFrame(animateLoader);
      }
    }
    
    requestAnimationFrame(animateLoader);
  }

  setupCursor() {
    const dot = document.getElementById('cursorDot');
    const ring = document.getElementById('cursorRing');
    if (!dot || !ring) return;

    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    if (isCoarsePointer || isTouchDevice) {
      dot.style.display = 'none';
      ring.style.display = 'none';
      return;
    }

    let mouseX = 0, mouseY = 0, ringX = 0, ringY = 0;

    eventManager.on(document, 'mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
    });

    const animateRing = () => {
      ringX += (mouseX - ringX) * 0.15;
      ringY += (mouseY - ringY) * 0.15;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(animateRing);
    };
    animateRing();

    document.querySelectorAll(
      'a, button, .nav-menu-btn, .gallery-slide, .store-item, .partner-item, .helmet-item, .lifestyle-item-v2, .result-item, .race-card-item, .magnetic-btn, .tilt-card'
    ).forEach(el => {
      eventManager.on(el, 'mouseenter', () => document.body.classList.add('cursor-hover'));
      eventManager.on(el, 'mouseleave', () => document.body.classList.remove('cursor-hover'));
    });
  }

  setupNavigation() {
    const menuBtn = document.getElementById('menuBtn');
    const mobileMenu = document.getElementById('mobileMenu');

    if (menuBtn && mobileMenu) {
      eventManager.on(menuBtn, 'click', () => {
        const isExpanded = menuBtn.classList.toggle('active');
        menuBtn.setAttribute('aria-expanded', isExpanded);
        menuBtn.setAttribute('aria-label', isExpanded ? '关闭菜单' : '打开菜单');
        mobileMenu.classList.toggle('active');
      });
    }

    document.querySelectorAll('.nav-link, .mobile-menu-link').forEach(link => {
      eventManager.on(link, 'click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href');
        
        if (targetId && targetId !== '#') {
          const target = document.querySelector(targetId);
          if (target) {
            if (menuBtn) {
              menuBtn.classList.remove('active');
              menuBtn.setAttribute('aria-expanded', 'false');
              menuBtn.setAttribute('aria-label', '打开菜单');
            }
            if (mobileMenu) mobileMenu.classList.remove('active');
            target.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });
  }

  setupNavHideOnScroll() {
    const nav = document.getElementById('nav');
    if (!nav) return;
    let lastScroll = 0;
    
    eventManager.on(window, 'scroll', throttle(() => {
      const current = window.pageYOffset;
      if (current > lastScroll && current > 100) {
        nav.classList.add('hidden');
      } else {
        nav.classList.remove('hidden');
      }
      lastScroll = current;
    }, 100), { passive: true });
  }

  setupScrollProgress() {
    const bar = document.getElementById('scrollProgress');
    const currentEl = document.querySelector('.section-indicator-current');
    const allSections = document.querySelectorAll('.section');
    
    const totalEl = document.querySelector('.section-indicator-total');
    if (totalEl) totalEl.textContent = String(allSections.length).padStart(2, '0');

    let currentSectionIndex = 0;
    
    const sectionObserver = new IntersectionObserver((entries) => {
      // 找出视口中心点最接近的区域
      const viewportCenter = window.innerHeight / 2;
      
      entries.forEach(entry => {
        const rect = entry.boundingClientRect;
        const sectionCenter = rect.top + rect.height / 2;
        const index = Array.from(allSections).indexOf(entry.target);
        
        // 当区域中心点接近视口中心时，更新页码
        if (Math.abs(sectionCenter - viewportCenter) < rect.height * 0.3) {
          if (currentSectionIndex !== index) {
            currentSectionIndex = index;
            if (currentEl) currentEl.textContent = String(index + 1).padStart(2, '0');
          }
        }
      });
    }, { threshold: 0, rootMargin: '-10% 0px -90% 0px' });

    allSections.forEach(section => sectionObserver.observe(section));

    eventManager.on(window, 'scroll', () => {
      const scrollTop = window.pageYOffset;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (scrollTop / docHeight) * 100;
      if (bar) bar.style.width = progress + '%';
    }, { passive: true });
  }
}

// ========== 2. SCROLL EFFECTS & PARALLAX ==========
class ScrollEffects {
  constructor() {
    this.heroNumber = document.querySelector('.hero-number');
    this.statsBg = document.querySelector('.stats-bg-text');
    this.setupParallax();
  }

  setupParallax() {
    eventManager.on(document, 'mousemove', (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;

      if (this.heroNumber) this.heroNumber.style.transform = `translate(${x * 20}px, ${y * 15}px)`;
      if (this.statsBg) this.statsBg.style.transform = `translate(calc(-50% + ${x * 30}px), calc(-50% + ${y * 20}px))`;
    });
  }
}

// ========== 3. ANIMATION ENGINE ==========
class AnimationEngine {
  constructor() {
    this.setupTextScramble();
    this.setupDecorativeLines();
  }

  setupTextScramble() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    document.querySelectorAll('.stat-label, .spec-label').forEach(el => {
      const original = el.textContent;
      el.addEventListener('mouseenter', () => {
        let iterations = 0;
        const interval = setInterval(() => {
          el.textContent = original
            .split('')
            .map((char, i) => {
              if (i < iterations) return original[i];
              if (char === ' ') return ' ';
              return chars[Math.floor(Math.random() * chars.length)];
            })
            .join('');

          iterations += 0.5;
          if (iterations >= original.length) {
            clearInterval(interval);
            el.textContent = original;
          }
        }, 30);
      });
    });
  }

  setupDecorativeLines() {
    const sections = document.querySelectorAll('.section');
    sections.forEach((section, i) => {
      if (i % 3 === 0 && i > 0) {
        const line = document.createElement('div');
        line.className = 'decorative-line';
        line.style.cssText = `
          position: absolute; bottom: 0; left: 0; width: 100%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0, 255, 135, 0.2), transparent);
          transform: scaleX(0); transition: transform 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.5s;
          pointer-events: none;
        `;
        section.appendChild(line);
      }
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const line = entry.target.querySelector('.decorative-line');
        if (line && entry.isIntersecting) line.style.transform = 'scaleX(1)';
      });
    }, { threshold: 0.3 });

    sections.forEach(section => {
      if (section.querySelector('.decorative-line')) observer.observe(section);
    });
  }
}

// ========== 4. ENHANCEMENTS (Unified Intersection Observer) ==========
function initEnhancements() {
  // 统一的滚动观察引擎
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        
        // 处理 Section 进场
        if (el.classList.contains('section')) {
          el.classList.add('in-view');
        } 
        // 处理具体元素的动画揭示
        else {
          el.classList.add('revealed');
          revealObserver.unobserve(el); // 动画只触发一次
        }
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });

  // 观察所有 Section
  document.querySelectorAll('.section').forEach(el => revealObserver.observe(el));
  
  // 观察所有需要揭示的子元素
  document.querySelectorAll('.reveal-up, .reveal-left, .reveal-right, .reveal-scale, .title-reveal').forEach(el => {
    revealObserver.observe(el);
  });

  // 图片懒加载优化 - 使用 IntersectionObserver
  initLazyLoading();

  // 3D 倾斜效果 (统管 tilt-card)
  document.querySelectorAll('.tilt-card').forEach(card => {
    eventManager.on(card, 'mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      card.style.setProperty('--rotate-x', `${y * -8}deg`);
      card.style.setProperty('--rotate-y', `${x * 8}deg`);
    });
    eventManager.on(card, 'mouseleave', () => {
      card.style.setProperty('--rotate-x', '0deg');
      card.style.setProperty('--rotate-y', '0deg');
    });
  });

  // 合作伙伴光标追踪高光
  document.querySelectorAll('.partner-item').forEach(item => {
    eventManager.on(item, 'mousemove', e => {
      const rect = item.getBoundingClientRect();
      item.style.setProperty('--mx', `${((e.clientX - rect.left) / rect.width) * 100}%`);
      item.style.setProperty('--my', `${((e.clientY - rect.top) / rect.height) * 100}%`);
    });
  });

  // 磁性按钮效果
  document.querySelectorAll('.magnetic-btn').forEach(btn => {
    eventManager.on(btn, 'mousemove', e => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
    });
    eventManager.on(btn, 'mouseleave', () => {
      btn.style.transform = 'translate(0, 0)';
    });
  });

  // 数字滚动动画增强（带物理缓动）
  const counterObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      if (el.dataset.counted) return;
      el.dataset.counted = 'true';

      const target = parseInt(el.dataset.target, 10);
      const duration = 2000;
      const start = performance.now();

      function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
      function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        el.textContent = Math.round(easeOutExpo(progress) * target);
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      counterObserver.unobserve(el);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.stat-number[data-target]').forEach(n => counterObserver.observe(n));
}

// ========== 5. F1 TIMELINE ENGINE ==========
function initF1Timeline() { 
  const section = document.querySelector('.section-timeline'); 
  if (!section) return; 
  const track = document.getElementById('timelineTrack'); 
  const car = document.getElementById('timelineCar'); 
  const carImg = car?.querySelector('.f1-body'); 
  const tires = car?.querySelectorAll('.f1-tire'); 
  const activeLine = document.getElementById('timelineActiveLine'); 
  const items = section.querySelectorAll('.timeline-item'); 
  
  const kerb = document.getElementById('trackKerb'); 
  const speedLines = document.getElementById('speedLines'); 
  const tailLight = document.getElementById('f1TailLight'); 
  if (!track || !car || !activeLine) return; 
  
  const initialCarWidth = car.offsetWidth || (window.innerWidth * 0.35);
  let cachedMaxTrackMove = track.offsetWidth - window.innerWidth;
  
  let targetProgress = 0, currentProgress = 0; 
  let animationFrameId = null; 
  let scrollHandler = null; 
  let resizeHandler = null; 
  let isRunning = false; // 初始设为 false，等待进入视口
  
  // 新增：IntersectionObserver 监听整个 Timeline 区域
  const timelineObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        isRunning = true;
        onScroll(); // 更新初始进度
        render(); // 进入视口，开始动画
      } else {
        isRunning = false; // 移出视口，暂停动画
      }
    });
  }, { threshold: 0.01 }); // 只要有 1% 可见就开始
  
  timelineObserver.observe(section);
  
  function onScroll() { 
    const rect = section.getBoundingClientRect(); 
    let p = -rect.top / (section.offsetHeight - window.innerHeight); 
    targetProgress = Math.max(0, Math.min(1, p)); 
  } 
  
  function render() { 
    if (!isRunning) {
      animationFrameId = requestAnimationFrame(render);
      return;
    }
    
    currentProgress += (targetProgress - currentProgress) * 0.06; 
    const speed = targetProgress - currentProgress; 
    
    const carStart = window.innerWidth * 0.15;
    let carX;
    
    if (currentProgress < 0.8) { 
        carX = carStart + (currentProgress / 0.8) * (window.innerWidth * 0.4); 
    } else { 
        const p = (currentProgress - 0.8) / 0.2; 
        carX = window.innerWidth * 0.55 + (p * p) * (window.innerWidth * 0.8); 
    } 
    let tiltAngle = Math.max(-6, Math.min(6, speed * 180)); 
    
    // 批量更新 DOM 
    track.style.transform = `translateX(${-currentProgress * cachedMaxTrackMove}px)`; 
    car.style.transform = `translateY(-50%) translateX(${carX}px) rotate(${tiltAngle}deg)`; 
    
    if (kerb) kerb.style.transform = `translateX(${-currentProgress * cachedMaxTrackMove * 1.15}px) skewX(-45deg)`; 
    
    const absoluteCarCenterPos = carX + (currentProgress * cachedMaxTrackMove) + (initialCarWidth / 2); 
    activeLine.style.width = `${Math.min(100, (absoluteCarCenterPos / track.offsetWidth) * 100)}%`; 
    
    // 速度特效 
    if (speedLines && tailLight) { 
        const shouldShowEffects = currentProgress > 0.82; 
        speedLines.style.opacity = shouldShowEffects ? '1' : '0'; 
        tailLight.style.opacity = shouldShowEffects ? '0.8' : '0'; 
    } 
    
    const playState = Math.abs(speed) > 0.001 ? 'running' : 'paused'; 
    if (carImg) carImg.style.animationPlayState = playState; 
    
    const blurValue = Math.min(Math.abs(speed) * 80, 2.5); 
    tires.forEach(tire => { 
        tire.style.animationPlayState = playState; 
        tire.style.filter = `blur(${blurValue}px)`; 
    }); 
    
    items.forEach(item => { 
      const leftPct = parseFloat(item.style.left || '0'); 
      const itemLeftPx = (leftPct / 100) * track.offsetWidth; 
      item.classList.toggle('active', absoluteCarCenterPos >= itemLeftPx - 60); 
    }); 
    
    animationFrameId = requestAnimationFrame(render); 
  } 
  scrollHandler = () => onScroll(); 
  resizeHandler = debounce(() => {
    cachedMaxTrackMove = track.offsetWidth - window.innerWidth;
    onScroll();
  }, 150);
  
  window.addEventListener('scroll', scrollHandler, { passive: true }); 
  window.addEventListener('resize', resizeHandler); 
  
  document.addEventListener('visibilitychange', () => { 
    if (document.hidden) { 
      isRunning = false; 
      if (animationFrameId) cancelAnimationFrame(animationFrameId); 
    } else { 
      isRunning = true; 
      render(); 
    } 
  }); 
  
  window.addEventListener('beforeunload', () => { 
    isRunning = false; 
    if (animationFrameId) cancelAnimationFrame(animationFrameId); 
    if (scrollHandler) window.removeEventListener('scroll', scrollHandler); 
    if (resizeHandler) window.removeEventListener('resize', resizeHandler); 
  }); 
  
  onScroll(); 
  render(); 
}

// ========== 6. NEW FEATURES (Theme, Gallery, Keys, Canvas) ==========
function initNewFeatures() {
  // Theme Toggle
  const themeToggle = document.getElementById('themeToggle');
  const iconLight = document.querySelector('.icon-light');
  const iconDark = document.querySelector('.icon-dark');
  
  if (themeToggle) {
    const savedTheme = safeStorage.get('theme', 'dark');
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggle.addEventListener('click', () => {
      const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      safeStorage.set('theme', newTheme);
      updateThemeIcon(newTheme);
    });
  }

  function updateThemeIcon(theme) {
    if(iconLight && iconDark) {
      iconLight.style.display = theme === 'dark' ? 'block' : 'none';
      iconDark.style.display = theme === 'dark' ? 'none' : 'block';
    }
  }

  // Countdown Timer (Next Race)
  const NEXT_RACE = {
    name: 'Australian GP',
    iso: '2026-03-08T15:00:00+11:00'
  };
  const nextRaceDate = new Date(NEXT_RACE.iso).getTime();
  const els = {
    days: document.getElementById('cd-days'), hours: document.getElementById('cd-hours'),
    mins: document.getElementById('cd-mins'), secs: document.getElementById('cd-secs')
  };

  if (els.days) {
    const updateCountdown = () => {
      const distance = nextRaceDate - new Date().getTime();
      if (distance <= 0) {
        Object.values(els).forEach(el => el.innerText = '00');
        return;
      }
      els.days.innerText = String(Math.floor(distance / 86400000)).padStart(2, '0');
      els.hours.innerText = String(Math.floor((distance % 86400000) / 3600000)).padStart(2, '0');
      els.mins.innerText = String(Math.floor((distance % 3600000) / 60000)).padStart(2, '0');
      els.secs.innerText = String(Math.floor((distance % 60000) / 1000)).padStart(2, '0');
    };
    updateCountdown();
    const countdownInterval = setInterval(updateCountdown, 1000);
    
    window.addEventListener('beforeunload', () => {
      clearInterval(countdownInterval);
    });
  }

  // Lightbox Gallery
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const galleryImages = Array.from(document.querySelectorAll('.photo-placeholder img'));
  let currentImageIndex = 0;

  if (lightbox && galleryImages.length > 0) {
    galleryImages.forEach((img, index) => {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', () => openLightbox(index));
    });

    const btnClose = document.getElementById('lightboxClose');
    const btnPrev = document.getElementById('lightboxPrev');
    const btnNext = document.getElementById('lightboxNext');

    if (btnClose) btnClose.addEventListener('click', closeLightbox);
    if (btnPrev) btnPrev.addEventListener('click', prevImage);
    if (btnNext) btnNext.addEventListener('click', nextImage);
    lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

    let touchStartX = 0;
    lightbox.addEventListener('touchstart', e => touchStartX = e.changedTouches[0].screenX, {passive: true});
    lightbox.addEventListener('touchend', e => {
      let touchEndX = e.changedTouches[0].screenX;
      if (touchEndX < touchStartX - 50) nextImage();
      if (touchEndX > touchStartX + 50) prevImage();
    });
  }

  function openLightbox(index) {
    currentImageIndex = index;
    updateLightboxContent();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    const closeBtn = lightbox.querySelector('.lightbox-close');
    if (closeBtn) {
      setTimeout(() => closeBtn.focus(), 100);
    }
  }
  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    
    const lastFocusedImage = galleryImages[currentImageIndex];
    if (lastFocusedImage) {
      lastFocusedImage.focus();
    }
  }
  function prevImage() {
    currentImageIndex = (currentImageIndex === 0) ? galleryImages.length - 1 : currentImageIndex - 1;
    updateLightboxContent();
  }
  function nextImage() {
    currentImageIndex = (currentImageIndex === galleryImages.length - 1) ? 0 : currentImageIndex + 1;
    updateLightboxContent();
  }
  function updateLightboxContent() {
    const targetImg = galleryImages[currentImageIndex];
    lightboxImg.src = targetImg.src;
    document.getElementById('lightboxCounter').innerText = `${currentImageIndex + 1} / ${galleryImages.length}`;
    document.getElementById('lightboxCaption').innerText = targetImg.closest('.photo-placeholder')?.querySelector('p')?.innerText || targetImg.alt;
  }

  // Keyboard Navigation
  const sections = Array.from(document.querySelectorAll('.section'));
  const helpModal = document.getElementById('keyboardHelp');
  
  if (helpModal) {
    document.getElementById('closeHelp').addEventListener('click', () => helpModal.classList.remove('active'));
    document.addEventListener('keydown', e => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      const scrollY = window.scrollY;
      const winH = window.innerHeight;

      switch(e.key.toLowerCase()) {
        case 'j': case 'arrowdown':
          e.preventDefault();
          const nextSec = sections.find(sec => sec.offsetTop > scrollY + winH * 0.5);
          if (nextSec) nextSec.scrollIntoView({ behavior: 'smooth' });
          break;
        case 'k': case 'arrowup':
          e.preventDefault();
          const prevSec = [...sections].reverse().find(sec => sec.offsetTop < scrollY - winH * 0.1);
          if (prevSec) prevSec.scrollIntoView({ behavior: 'smooth' });
          break;
        case 'home': window.scrollTo({ top: 0, behavior: 'smooth' }); break;
        case 'end': window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); break;
        case 'f': document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(()=>{}); break;
        case '?': helpModal.classList.toggle('active'); break;
        case 'escape':
          if (lightbox && lightbox.classList.contains('active')) closeLightbox();
          if (helpModal.classList.contains('active')) helpModal.classList.remove('active');
          break;
      }
    });
  }

  // Hero Canvas Particles
  const canvas = document.getElementById('hero-particles');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width, height, particles = [];
    let mouse = { x: null, y: null, radius: 150 };
    let particlesRunning = true;
    let animationFrameId = null;
    let resizeHandler = null;

    document.addEventListener('visibilitychange', () => {
      particlesRunning = !document.hidden;
    });

    const heroSection = document.querySelector('.section-hero');
    if (heroSection) {
      heroSection.addEventListener('mousemove', e => { mouse.x = e.x; mouse.y = e.y; });
      heroSection.addEventListener('mouseleave', () => { mouse.x = null; mouse.y = null; });
    }

    function initCanvas() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      particles = Array.from({ length: (width * height) / 15000 }, () => ({
        x: Math.random() * width, y: Math.random() * height,
        vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5,
        size: Math.random() * 2 + 1
      }));
    }

    function animateParticles() {
      if (!particlesRunning) {
        animationFrameId = requestAnimationFrame(animateParticles);
        return;
      }
      ctx.clearRect(0, 0, width, height);
      const colorRGB = document.documentElement.getAttribute('data-theme') === 'light' ? '0,0,0' : '0,255,135';

      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${colorRGB}, 0.5)`; ctx.fill();

        if (mouse.x != null) {
          const dist = Math.hypot(mouse.x - p.x, mouse.y - p.y);
          if (dist < mouse.radius) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${colorRGB}, ${1 - dist/mouse.radius})`;
            ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
          }
        }
      });
      animationFrameId = requestAnimationFrame(animateParticles);
    }
    
    initCanvas();
    animateParticles();
    resizeHandler = () => initCanvas();
    window.addEventListener('resize', resizeHandler);
    
    window.addEventListener('beforeunload', () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
      particlesRunning = false;
    });
  }

  // Social Share
  document.querySelectorAll('.share-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const target = e.currentTarget;
      const url = encodeURIComponent(window.location.href);
      const title = encodeURIComponent(document.title);
      const type = target.getAttribute('data-type');

      if (type === 'twitter') window.open(`https://twitter.com/intent/tweet?url=${url}&text=${title}`, '_blank', 'width=600,height=400');
      else if (type === 'facebook') window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
      else if (type === 'copy') navigator.clipboard.writeText(window.location.href).then(() => {
        const ogText = target.innerText;
        target.innerText = '已复制！';
        target.style.color = 'var(--lime)';
        setTimeout(() => { target.innerText = ogText; target.style.color = ''; }, 2000);
      });
    });
  });

  // Ticker Logic (Only reconstruct if not already setup)
  document.querySelectorAll('.nav-ticker, .message-ticker').forEach(ticker => {
    if(ticker.querySelectorAll('.ticker-track').length < 2) {
      const text = ticker.querySelector('span')?.innerText;
      if (text) {
        ticker.innerHTML = `
          <div class="ticker-track"><span>${text}</span><span>${text}</span></div>
          <div class="ticker-track" aria-hidden="true"><span>${text}</span><span>${text}</span></div>
        `;
      }
    }
  });

  // 赛道天气预报
  initWeatherForecast();
  
  // F1 Team Radio 彩蛋
  const radioBtn = document.getElementById('teamRadioBtn');
  const radioAudio = document.getElementById('radioAudio');
  if (radioBtn && radioAudio) {
    radioBtn.addEventListener('click', () => {
      if (radioAudio.paused) {
        radioAudio.volume = 0.5;
        radioAudio.play();
        radioBtn.classList.add('playing');
      } else {
        radioAudio.pause();
        radioAudio.currentTime = 0;
        radioBtn.classList.remove('playing');
      }
    });
    radioAudio.addEventListener('ended', () => {
      radioBtn.classList.remove('playing');
    });
  }
}

// 赛道天气预报功能
function initWeatherForecast() {
  const raceCards = document.querySelectorAll('.race-card-item');
  
  const weatherData = {
    melbourne: { temp: 22, condition: '晴朗', icon: '☀️', humidity: 45, wind: '15 km/h NE' },
    shanghai: { temp: 18, condition: '多云', icon: '☁️', humidity: 60, wind: '10 km/h E' },
    suzuka: { temp: 16, condition: '小雨', icon: '🌧️', humidity: 75, wind: '20 km/h SE' },
    bahrain: { temp: 28, condition: '晴朗', icon: '☀️', humidity: 35, wind: '12 km/h N' },
    saudi: { temp: 26, condition: '晴朗', icon: '☀️', humidity: 40, wind: '8 km/h NW' },
    imola: { temp: 20, condition: '多云', icon: '☁️', humidity: 55, wind: '14 km/h W' },
    monaco: { temp: 21, condition: '晴朗', icon: '☀️', humidity: 50, wind: '11 km/h S' },
    barcelona: { temp: 24, condition: '晴朗', icon: '☀️', humidity: 45, wind: '16 km/h NE' },
    austria: { temp: 19, condition: '多云', icon: '☁️', humidity: 58, wind: '13 km/h N' },
    silverstone: { temp: 17, condition: '小雨', icon: '🌧️', humidity: 70, wind: '18 km/h W' },
    hungaroring: { temp: 23, condition: '晴朗', icon: '☀️', humidity: 48, wind: '12 km/h E' },
    spa: { temp: 18, condition: '多云', icon: '☁️', humidity: 62, wind: '15 km/h NW' },
    zandvoort: { temp: 19, condition: '多云', icon: '☁️', humidity: 65, wind: '22 km/h W' },
    monza: { temp: 22, condition: '晴朗', icon: '☀️', humidity: 52, wind: '10 km/h N' },
    baku: { temp: 25, condition: '晴朗', icon: '☀️', humidity: 42, wind: '17 km/h NE' },
    singapore: { temp: 30, condition: '雷阵雨', icon: '⛈️', humidity: 85, wind: '14 km/h SE' },
    cota: { temp: 27, condition: '晴朗', icon: '☀️', humidity: 40, wind: '19 km/h S' },
    mexico: { temp: 23, condition: '多云', icon: '☁️', humidity: 35, wind: '11 km/h NE' },
    interlagos: { temp: 26, condition: '多云', icon: '☁️', humidity: 68, wind: '16 km/h E' },
    vegas: { temp: 32, condition: '晴朗', icon: '☀️', humidity: 25, wind: '9 km/h W' },
    qatar: { temp: 34, condition: '晴朗', icon: '☀️', humidity: 30, wind: '13 km/h N' },
    abudhabi: { temp: 31, condition: '晴朗', icon: '☀️', humidity: 38, wind: '15 km/h NE' }
  };
  
  raceCards.forEach(card => {
    const location = card.querySelector('.race-location')?.textContent.toLowerCase();
    const cardFooter = card.querySelector('.race-card-footer')?.textContent.toLowerCase();
    
    // 尝试从不同位置获取赛道信息
    let weather = null;
    for (const [key, data] of Object.entries(weatherData)) {
      if (location.includes(key) || cardFooter.includes(key)) {
        weather = data;
        break;
      }
    }
    
    // 如果找到天气数据，更新显示
    if (weather) {
      const weatherEl = card.querySelector('.race-weather');
      if (weatherEl) {
        weatherEl.innerHTML = `
          ${weather.icon} ${weather.temp}°C ${weather.condition}
          <span style="margin-left: 8px; opacity: 0.7;">💧 ${weather.humidity}%</span>
          <span style="margin-left: 8px; opacity: 0.7;">💨 ${weather.wind}</span>
        `;
      }
    }
  });
}

// ========== 7. HELMET REVEAL EFFECT (Moved from HTML) ==========
function initHelmetReveal() {
  const hero = document.querySelector('.section-hero');
  const reveal = document.getElementById('helmetReveal');
  if (!hero || !reveal) return;

  const RADIUS = 150;
  let mouseX = 0, mouseY = 0;
  let currentX = 0, currentY = 0;
  let isInHero = false;
  let rafId = null;
  let isTouch = false;

  hero.addEventListener('mouseenter', () => {
    if (isTouch) return;
    isInHero = true;
    if (!rafId) animate();
  });

  hero.addEventListener('mouseleave', () => {
    if (isTouch) return;
    isInHero = false;
    reveal.style.clipPath = `circle(0px at ${currentX}px ${currentY}px)`;
  });

  hero.addEventListener('mousemove', e => {
    if (isTouch) return;
    const rect = hero.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });

  hero.addEventListener('touchstart', e => {
    isTouch = true;
    isInHero = true;
    
    // 添加触觉反馈 (如果设备支持)
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    
    const rect = hero.getBoundingClientRect();
    mouseX = e.touches[0].clientX - rect.left;
    mouseY = e.touches[0].clientY - rect.top;
    currentX = mouseX;
    currentY = mouseY;
    if (!rafId) animate();
  }, { passive: true });

  hero.addEventListener('touchmove', e => {
    const rect = hero.getBoundingClientRect();
    mouseX = e.touches[0].clientX - rect.left;
    mouseY = e.touches[0].clientY - rect.top;
  }, { passive: true });

  const handleTouchEnd = () => {
    isInHero = false;
    reveal.style.clipPath = `circle(0px at ${currentX}px ${currentY}px)`;
    setTimeout(() => { isTouch = false; }, 500);
  };

  hero.addEventListener('touchend', handleTouchEnd);
  hero.addEventListener('touchcancel', handleTouchEnd);

  function animate() {
    currentX += (mouseX - currentX) * 0.12;
    currentY += (mouseY - currentY) * 0.12;
    const radius = window.innerWidth <= 768 ? 120 : RADIUS;
    if (isInHero) {
      reveal.style.clipPath = `circle(${radius}px at ${currentX}px ${currentY}px)`;
      rafId = requestAnimationFrame(animate);
    } else {
      reveal.style.clipPath = `circle(0px at ${currentX}px ${currentY}px)`;
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }
}

// ========== 8. FAN MESSAGES ==========
function initFanMessages() {
  const form = document.getElementById('fanMessageForm');
  const list = document.getElementById('fanMessagesList');
  if (!form || !list) return;

  const defaultMessages = [
    { id: 1, name: 'McLarenFan_4', text: 'Lando 今年表现太棒了！迈阿密那一站看得我热血沸腾，期待拿到总冠军！🏆', date: '2025/01/15' },
    { id: 2, name: 'SpeedDemon', text: '一直支持 LN4！你的驾驶风格太有魅力了，永远是四号车迷！🧡', date: '2025/02/10' },
    { id: 3, name: 'PapayaRules', text: 'Lando 和 Oscar 绝对是围场里最强的车手阵容！今年迈凯伦继续冲啊，捍卫车队总冠军！🧡🏎️', date: '2026/02/21' },
    { id: 4, name: 'LN4_Forever', text: '昨晚 Twitch 的直播太搞笑了，什么时候再开个高尔夫直播？⛳️ 另外新头盔的设计真的绝了！', date: '2026/02/18' },
    { id: 5, name: 'RacingNerd', text: '不得不说，这两年 Lando 的保胎能力和比赛阅读能力提升了太多，完全具备了夺冠的硬实力。', date: '2026/02/12' },
    { id: 6, name: 'QuadrantFan', text: 'Quadrant 刚出的那套衣服我已经下单了！赛道外也能把电竞和潮流结合得这么好的车手只有你了 🔥🔥', date: '2026/02/05' },
    { id: 7, name: 'SilverstoneLocal', text: '等不及今年的英国站了！我们已经在主看台买好票了，到时候全场都会为你欢呼的！🇬🏆', date: '2026/01/28' },
    { id: 8, name: 'AussieMcLaren', text: '墨尔本揭幕战见！希望能看到两台木瓜色赛车一二带回！Let\'s go Lando!', date: '2026/01/15' },
    { id: 9, name: 'SpeedKing88', text: 'Lando 的无线电通讯总是那么有趣，特别是和工程师的互动，能感受到整个团队的氛围都很好！🎧', date: '2026/01/08' },
    { id: 10, name: 'McLarenGirl', text: '圣诞快乐 Lando！感谢你这一年带来的精彩表现，2025 年一定会是你的年份！🎄', date: '2025/12/25' },
    { id: 11, name: 'F1Statistics', text: '数据不会说谎：Lando 在过去 10 场比赛中的平均排位赛成绩是 2.3 位，正赛平均完赛位置 2.8 位，绝对是顶级表现！📊', date: '2025/12/18' },
    { id: 12, name: 'NewbieFan', text: '我是因为 Lando 才开始看 F1 的，现在已经是迈凯伦铁粉了！他的驾驶风格和个性都太吸引人了 😄', date: '2025/12/10' },
    { id: 13, name: 'SimRacer_Pro', text: '在模拟赛车游戏里用过 Lando 的设置，转向过度真的很难控制...职业车手的实力不是盖的！🎮', date: '2025/12/01' },
    { id: 14, name: 'BritishPride', text: '作为英国车迷，看到 Lando 在银石的表现真的超级自豪！他是我们国家的骄傲！🇬🇧🏁', date: '2025/11/22' },
    { id: 15, name: 'PapayaArmy', text: '迈凯伦这几年真的回来了！从 2022 年的低谷到现在的争冠车队，Lando 功不可没！🧡💪', date: '2025/11/15' }
  ];

  let messages = JSON.parse(safeStorage.get('ln4_fan_messages'));
  
  if (!messages || messages.length === 0) {
    messages = defaultMessages;
    safeStorage.set('ln4_fan_messages', JSON.stringify(messages));
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
  }

  function renderMessages() {
    list.innerHTML = '';
    [...messages].reverse().forEach(msg => {
      const el = document.createElement('div');
      el.className = 'message-item';
      el.innerHTML = `
        <div class="msg-header"><span class="msg-author">${escapeHTML(msg.name)}</span><span class="msg-date">${msg.date}</span></div>
        <div class="msg-body">${escapeHTML(msg.text)}</div>
      `;
      list.appendChild(el);
    });
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const nameInput = document.getElementById('msgName');
    const textInput = document.getElementById('msgText');
    if(!nameInput.value.trim() || !textInput.value.trim()) return;

    messages.push({
      id: Date.now(), name: nameInput.value.trim(), text: textInput.value.trim(),
      date: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    });
    safeStorage.set('ln4_fan_messages', JSON.stringify(messages));
    
    nameInput.value = ''; textInput.value = '';
    renderMessages();
    
    const btn = form.querySelector('button');
    const ogText = btn.querySelector('span').innerText;
    btn.querySelector('span').innerText = '发送成功！';
    btn.classList.add('success-state');
    setTimeout(() => { btn.querySelector('span').innerText = ogText; btn.classList.remove('success-state'); }, 2000);
  });

  renderMessages();
}

// ========== 9. GAMIFICATION ==========
function initGamification() { 
  if (!document.querySelector('.section-games')) return; 
  let GameState = { 
    userName: 'LandoFan', achievements: [], reactionBest: 0, quizBest: 0, totalPoints: 0 
  }; 
  GameState.userName = safeStorage.get('ln4_username', 'LandoFan'); 
  GameState.achievements = JSON.parse(safeStorage.get('ln4_achievements', '[]')); 
  GameState.reactionBest = parseInt(safeStorage.get('ln4_reaction_best', '0')); 
  GameState.quizBest = parseInt(safeStorage.get('ln4_quiz_best', '0')); 
  GameState.totalPoints = parseInt(safeStorage.get('ln4_total_points', '0')); 
  initGameTabs(); 
  initReactionGame(GameState); 
  initQuizGame(GameState); 
  
  const achievementManager = initAchievements(GameState);
  window.checkAchievements = achievementManager.checkAchievements; 
  
  initLeaderboard(GameState); 
}

function initGameTabs() {
  document.querySelectorAll('.game-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.game-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.game-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
    });
  });
}

function initReactionGame(GameState) {
  const reactionArea = document.getElementById('reactionArea');
  const reactionLights = document.querySelectorAll('.reaction-light');
  const reactionText = document.getElementById('reactionText');
  let reactionState = 'waiting', reactionStartTime = 0, reactionTimeout, reactionInterval;

  if (!reactionArea) return;

  // 初始化音效（在用户首次交互时）
  const initAudio = () => {
    SoundManager.init();
    reactionArea.removeEventListener('click', initAudio);
  };
  reactionArea.addEventListener('click', initAudio, { once: true });

  reactionArea.addEventListener('click', () => {
    if (['waiting', 'result', 'false-start'].includes(reactionState)) {
      SoundManager.play('start');
      startReaction();
    } else if (reactionState === 'ready') {
      clearTimeout(reactionTimeout); clearInterval(reactionInterval);
      reactionState = 'false-start';
      SoundManager.play('false-start');
      reactionArea.className = 'reaction-area false-start';
      reactionText.innerHTML = '抢跑！<br><span style="font-size: 16px;">点击重试</span>';
      reactionLights.forEach(l => l.classList.remove('on'));
    } else if (reactionState === 'go') {
      const time = Math.round(performance.now() - reactionStartTime);
      reactionState = 'result';
      SoundManager.play('click');
      setTimeout(() => SoundManager.play('success'), 200);
      reactionArea.className = 'reaction-area result';
      if (GameState.reactionBest === 0 || time < GameState.reactionBest) {
        GameState.reactionBest = time;
        safeStorage.set('ln4_reaction_best', time.toString());
      }
      reactionText.innerHTML = `<span class="reaction-time">${time}ms</span><span class="reaction-message">点击重试</span>`;
      document.getElementById('reactionBest').textContent = GameState.reactionBest + 'ms';
    }
  });

  function startReaction() {
    reactionState = 'ready';
    reactionArea.className = 'reaction-area ready';
    reactionText.innerHTML = '等待绿灯...';
    reactionLights.forEach(l => l.classList.remove('on', 'go'));
    clearInterval(reactionInterval); clearTimeout(reactionTimeout);
    
    let index = 0;
    reactionInterval = setInterval(() => {
      if (index < reactionLights.length) { 
        reactionLights[index++].classList.add('on');
        SoundManager.play('start');
      } 
      else {
        clearInterval(reactionInterval);
        reactionTimeout = setTimeout(() => {
          if (reactionState === 'ready') {
            reactionState = 'go'; 
            reactionArea.className = 'reaction-area go'; 
            reactionText.innerHTML = '点击！';
            SoundManager.play('go');
            reactionLights.forEach(l => { l.classList.remove('on'); l.classList.add('go'); });
            reactionStartTime = performance.now();
          }
        }, 1000 + Math.random() * 3000);
      }
    }, 300);
  }
}

function initQuizGame(GameState) {
  const QUIZ_QUESTIONS = [
    { category: 'Lando Norris', question: 'Lando Norris 在哪一年首次参加F1比赛？', options: ['2017年', '2018年', '2019年', '2020年'], correct: 2, explanation: 'Lando Norris 于2019年正式加入迈凯伦F1车队。' },
    { category: 'F1知识', question: 'F1比赛中，DRS代表什么？', options: ['动态赛道系统', '可调尾翼系统', '驾驶员响应系统', '差速器赛车系统'], correct: 1, explanation: 'DRS (Drag Reduction System) 是可调尾翼系统，用于减少阻力。' },
    { category: 'Lando Norris', question: 'Lando Norris 的车号是多少？', options: ['3号', '4号', '7号', '16号'], correct: 1, explanation: 'Lando Norris 使用4号作为他的赛车号码。' },
    { category: '迈凯伦', question: '迈凯伦F1车队成立于哪一年？', options: ['1963年', '1966年', '1970年', '1974年'], correct: 0, explanation: '由布鲁斯·迈凯伦于1963年创立。' },
    { category: 'Lando Norris', question: 'Lando Norris 在2024赛季获得了几场分站冠军？', options: ['2场', '3场', '4场', '5场'], correct: 2, explanation: '迈阿密、荷兰、新加坡和阿布扎比四场。' }
  ];

  let currentQuestion = 0, quizScore = 0, quizAnswered = [], shuffledQuestions = [];
  const quizContainer = document.getElementById('quizContainer');
  const quizProgress = document.getElementById('quizProgress');
  const quizQuestionCard = document.getElementById('quizQuestionCard');

  if (!quizContainer) return;

  document.getElementById('quizStartBtn')?.addEventListener('click', startQuiz);
  document.getElementById('quizRestartBtn')?.addEventListener('click', startQuiz);

  function startQuiz() {
    SoundManager.init();
    currentQuestion = 0; quizScore = 0; quizAnswered = [];
    shuffledQuestions = [...QUIZ_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 5);
    renderQuizProgress();
    renderQuestion();
    document.getElementById('quizScoreCard').style.display = 'none';
    quizQuestionCard.style.display = 'block';
  }

  function renderQuizProgress() {
    if (quizProgress) quizProgress.innerHTML = shuffledQuestions.map((_, i) => `<div class="quiz-progress-dot ${i === 0 ? 'current' : ''}"></div>`).join('');
  }

  function renderQuestion() {
    const q = shuffledQuestions[currentQuestion];
    quizQuestionCard.innerHTML = `
      <div class="quiz-category">${q.category}</div>
      <div class="quiz-question">${q.question}</div>
      <div class="quiz-options">
        ${q.options.map((opt, i) => `
          <div class="quiz-option" data-index="${i}">
            <span class="quiz-option-letter">${String.fromCharCode(65 + i)}</span>
            <span class="quiz-option-text">${opt}</span>
          </div>`).join('')}
      </div>
      <div class="quiz-explanation" id="quizExplanation">${q.explanation}</div>
    `;
    quizQuestionCard.querySelectorAll('.quiz-option').forEach(opt => {
      opt.addEventListener('click', () => handleQuizAnswer(parseInt(opt.dataset.index)));
    });
  }

  function handleQuizAnswer(answerIndex) {
    if (quizAnswered.includes(currentQuestion)) return;
    quizAnswered.push(currentQuestion);
    
    const q = shuffledQuestions[currentQuestion];
    const isCorrect = answerIndex === q.correct;
    if (isCorrect) {
      quizScore += 20;
      SoundManager.play('correct');
    } else {
      SoundManager.play('wrong');
    }

    quizQuestionCard.querySelectorAll('.quiz-option').forEach((opt, i) => {
      opt.classList.add('disabled');
      if (i === q.correct) opt.classList.add('correct');
      else if (i === answerIndex && !isCorrect) opt.classList.add('wrong');
    });

    document.getElementById('quizExplanation').classList.add('show');
    
    const dots = quizProgress.querySelectorAll('.quiz-progress-dot');
    if(dots[currentQuestion]) {
      dots[currentQuestion].classList.remove('current');
      dots[currentQuestion].classList.add(isCorrect ? 'correct' : 'wrong');
    }
    if(dots[currentQuestion + 1]) dots[currentQuestion + 1].classList.add('current');

    setTimeout(() => {
      currentQuestion++;
      if (currentQuestion < shuffledQuestions.length) renderQuestion();
      else showQuizResult();
    }, 2000);
  }

  function showQuizResult() {
    if (quizScore > GameState.quizBest) {
      GameState.quizBest = quizScore;
      safeStorage.set('ln4_quiz_best', quizScore.toString());
    }
    GameState.totalPoints += quizScore;
    safeStorage.set('ln4_total_points', GameState.totalPoints.toString());

    quizQuestionCard.style.display = 'none';
    const scoreCard = document.getElementById('quizScoreCard');
    scoreCard.style.display = 'block';
    scoreCard.querySelector('.quiz-score-value').textContent = quizScore;
    
    const msg = scoreCard.querySelector('.quiz-score-message');
    if (quizScore === 100) {
      msg.textContent = '完美！你是真正的 F1 专家！🏆';
      SoundManager.play('complete');
    } else if (quizScore >= 80) {
      msg.textContent = '太棒了！你对 F1 非常了解！🎯';
      SoundManager.play('success');
    } else {
      msg.textContent = '不错！继续学习 F1 知识！📚';
    }

    renderLeaderboard('quiz', GameState);
    
    if (typeof window.checkAchievements === 'function') {
      window.checkAchievements();
    } 
  }
}

// ========== 成就系统 ==========
function initAchievements(GameState) {
  const ACHIEVEMENTS = [
    { id: 'first_reaction', title: '发车新手', desc: '完成第一次反应测试', icon: '🏎️', points: 10, condition: s => s.reactionBest > 0 },
    { id: 'reaction_pro', title: '闪电起步', desc: '反应时间低于200ms', icon: '⚡', points: 50, condition: s => s.reactionBest > 0 && s.reactionBest < 200 },
    { id: 'first_quiz', title: '知识入门', desc: '完成第一次问答', icon: '📚', points: 10, condition: s => s.quizBest > 0 },
    { id: 'quiz_master', title: '知识大师', desc: '问答满分', icon: '👑', points: 100, condition: s => s.quizBest === 100 }
  ];

  function renderAchievements() {
    const grid = document.getElementById('achievementsGrid');
    if (!grid) return;
    grid.innerHTML = ACHIEVEMENTS.map(ach => {
      const isUnlocked = GameState.achievements.includes(ach.id);
      return `
        <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}" role="article" aria-label="${ach.title}">
          <div class="achievement-icon" aria-hidden="true">${ach.icon}</div>
          <div class="achievement-title">${ach.title}</div>
          <div class="achievement-desc">${ach.desc}</div>
          ${isUnlocked ? `<div class="achievement-date">已解锁</div>` : ''}
        </div>`;
    }).join('');
    
    const totalEl = document.getElementById('totalPoints');
    if(totalEl) totalEl.textContent = GameState.totalPoints;
  }

  function checkAchievements() {
    let newUnlocks = [];
    ACHIEVEMENTS.forEach(ach => {
      if (!GameState.achievements.includes(ach.id) && ach.condition(GameState)) {
        GameState.achievements.push(ach.id);
        GameState.totalPoints += ach.points;
        newUnlocks.push(ach);
      }
    });

    if (newUnlocks.length > 0) {
      safeStorage.set('ln4_achievements', JSON.stringify(GameState.achievements));
      safeStorage.set('ln4_total_points', GameState.totalPoints.toString());
      
      const ach = newUnlocks[0];
      const existing = document.querySelector('.achievement-notification');
      if (existing) existing.remove();
      
      const notif = document.createElement('div');
      notif.className = 'achievement-notification';
      notif.setAttribute('role', 'alert');
      notif.setAttribute('aria-live', 'polite');
      notif.innerHTML = `<div class="achievement-notification-icon" aria-hidden="true">${ach.icon}</div>
                         <div><div class="achievement-notification-label">成就解锁！</div>
                         <div class="achievement-notification-title">${ach.title}</div></div>`;
      document.body.appendChild(notif);
      setTimeout(() => {
        notif.classList.add('show');
        SoundManager.play('success');
      }, 100);
      setTimeout(() => {
        notif.classList.remove('show');
        setTimeout(() => notif.remove(), 500);
      }, 3000);

      renderAchievements();
    }
  }

  renderAchievements();
  return { checkAchievements };
}

function initLeaderboard(GameState) {
  const leaderboardList = document.getElementById('leaderboardList');
  if (!leaderboardList) return;

  document.querySelectorAll('.leaderboard-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.leaderboard-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderLeaderboard(tab.dataset.type, GameState);
    });
  });

  renderLeaderboard('reaction', GameState);
}

function renderLeaderboard(type, GameState) {
  const leaderboardList = document.getElementById('leaderboardList');
  if (!leaderboardList) return;
  
  let data = type === 'reaction' 
    ? [{name:'MaxV', score:142}, {name:'Lewis44', score:156}, {name:'Charles16', score:168}, {name:'Oscar81', score:182}]
    : [{name:'F1Fanatic', score:100}, {name:'McLarenFan', score:80}, {name:'SpeedDemon', score:80}];

  const userScore = type === 'reaction' ? GameState.reactionBest : GameState.quizBest;
  if (userScore > 0) {
    data.push({ name: GameState.userName, score: userScore, isUser: true });
  }

  data.sort((a, b) => type === 'reaction' ? a.score - b.score : b.score - a.score);

  leaderboardList.innerHTML = data.slice(0, 10).map((item, i) => `
    <div class="leaderboard-item ${item.isUser ? 'highlight' : ''}">
      <div class="leaderboard-rank">${i + 1}</div>
      <div class="leaderboard-avatar">${item.name.charAt(0).toUpperCase()}</div>
      <div class="leaderboard-info">
        <div class="leaderboard-name ${item.isUser ? 'you' : ''}">${item.name}${item.isUser ? ' (你)' : ''}</div>
        <div class="leaderboard-detail">${type === 'reaction' ? item.score + 'ms' : item.score + '分'}</div>
      </div>
      <div class="leaderboard-score">${type === 'reaction' ? item.score + 'ms' : item.score}</div>
    </div>
  `).join('');
}

// ========== 赛季走势图 ==========
function initTrendChart() {
  const canvas = document.getElementById('trendCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  
  const races = ['BHR','SAU','AUS','JPN','CHN','MIA','IMO','CAN','ESP','AUT','GBR','HUN','BEL','NED','ITA','AZE','SGP','USA','MEX','BRA','LAS','QAT','ABU'];
  const finishPositions = [3, 8, 3, 2, 2, 1, 2, 2, 2, 1, 2, 2, 5, 1, 3, 1, 2, 2, 2, 2, 1, 1, 1];
  const gridPositions = [2, 7, 4, 3, 3, 1, 1, 1, 3, 3, 1, 1, 4, 1, 3, 1, 1, 2, 1, 1, 1, 1, 1];

  function draw() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    const maxPos = Math.max(...finishPositions, ...gridPositions);
    const minPos = 1;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '10px Inter';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const pos = Math.round(minPos + ((maxPos - minPos) / 5) * (5 - i));
      const y = padding.top + (chartHeight / 5) * i;
      ctx.fillText('P' + pos, padding.left - 8, y + 4);
    }

    function getY(pos) {
      return padding.top + ((pos - minPos) / (maxPos - minPos)) * chartHeight;
    }

    function getX(index) {
      return padding.left + (index / (races.length - 1)) * chartWidth;
    }

    function drawLine(data, color, animate = true) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      data.forEach((pos, i) => {
        const x = getX(i);
        const y = getY(pos);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      data.forEach((pos, i) => {
        const x = getX(i);
        const y = getY(pos);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
    }

    drawLine(gridPositions, '#ff6b00');
    drawLine(finishPositions, '#00ff87');

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '9px Inter';
    ctx.textAlign = 'center';
    races.forEach((race, i) => {
      if (i % 3 === 0) {
        const x = getX(i);
        ctx.fillText(race, x, height - 8);
      }
    });
  }

  draw();
  window.addEventListener('resize', draw);
}

// ========== 启动逻辑（放在最后，确保所有类和函数都已定义） ==========
const AppCleanupRegistry = {
  intervals: [],
  timeouts: [],
  rafIds: [],
  observers: [],
  
  register(type, id) {
    this[type].push(id);
  },
  
  cleanup() {
    this.intervals.forEach(id => clearInterval(id));
    this.timeouts.forEach(id => clearTimeout(id));
    this.rafIds.forEach(id => cancelAnimationFrame(id));
    this.observers.forEach(obs => obs.disconnect());
    this.intervals = [];
    this.timeouts = [];
    this.rafIds = [];
    this.observers = [];
  }
};

function initWebsite() {
  const app = new App();
  app.init();

  new ScrollEffects();
  new AnimationEngine();
  initEnhancements();

  initF1Timeline();
  initNewFeatures();
  initHelmetReveal();
  initFanMessages();
  initGamification();
  initTrendChart();
  initBackToTop();
  initStandings();
  initMilestones();
  initTrackMap();
  initPredictionGame();
  initOnTrackJump();
  initComparison();
  initPoll();
  initMobileBottomNav();
  initAccessibility();
  initVideos();
  
  window.addEventListener('beforeunload', () => {
    eventManager.destroy();
    AppCleanupRegistry.cleanup();
  });
}

function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;

  const toggleVisibility = () => {
    if (window.pageYOffset > 500) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  };

  window.addEventListener('scroll', toggleVisibility, { passive: true });
  
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  toggleVisibility();
}

// ========== 11. STANDINGS (积分榜) ==========
function initStandings() {
  const section = document.querySelector('.section-standings');
  if (!section) return;

  const DRIVERS_DATA = [
    { pos: 1, name: 'Max Verstappen', flag: '🇳🇱', team: 'Red Bull Racing', points: 437 },
    { pos: 2, name: 'Lando Norris', flag: '🇬🇧', team: 'McLaren', points: 374, highlight: true },
    { pos: 3, name: 'Charles Leclerc', flag: '🇲🇨', team: 'Ferrari', points: 356 },
    { pos: 4, name: 'Oscar Piastri', flag: '🇦🇺', team: 'McLaren', points: 292 },
    { pos: 5, name: 'Carlos Sainz', flag: '🇪🇸', team: 'Ferrari', points: 290 },
    { pos: 6, name: 'George Russell', flag: '🇬🇧', team: 'Mercedes', points: 245 },
    { pos: 7, name: 'Lewis Hamilton', flag: '🇬🇧', team: 'Mercedes', points: 223 },
    { pos: 8, name: 'Sergio Perez', flag: '🇲🇽', team: 'Red Bull Racing', points: 152 },
    { pos: 9, name: 'Fernando Alonso', flag: '🇪🇸', team: 'Aston Martin', points: 70 },
    { pos: 10, name: 'Lance Stroll', flag: '🇨🇦', team: 'Aston Martin', points: 24 }
  ];

  const CONSTRUCTORS_DATA = [
    { pos: 1, name: 'McLaren', points: 666, isMcLaren: true },
    { pos: 2, name: 'Ferrari', points: 652, isMcLaren: false },
    { pos: 3, name: 'Red Bull Racing', points: 589, isMcLaren: false },
    { pos: 4, name: 'Mercedes', points: 468, isMcLaren: false },
    { pos: 5, name: 'Aston Martin', points: 94, isMcLaren: false },
    { pos: 6, name: 'Alpine', points: 65, isMcLaren: false }
  ];

  const maxDriverPoints = DRIVERS_DATA[0].points;
  const maxConstructorPoints = CONSTRUCTORS_DATA[0].points;

  function renderDriversStandings() {
    const table = section.querySelector('.standings-table');
    if (!table) return;

    const rows = DRIVERS_DATA.map(driver => `
      <div class="standings-row ${driver.highlight ? 'highlight' : ''}">
        <span class="standings-pos">${driver.pos}</span>
        <span class="standings-name">
          <span class="standings-flag">${driver.flag}</span>
          ${driver.name}
        </span>
        <span class="standings-team">${driver.team}</span>
        <span class="standings-points">${driver.points}</span>
        <span class="standings-bar">
          <span class="standings-bar-fill" style="width: ${(driver.points / maxDriverPoints) * 100}%"></span>
        </span>
      </div>
    `).join('');

    table.innerHTML = `
      <div class="standings-row header">
        <span class="standings-pos">#</span>
        <span class="standings-name">车手</span>
        <span class="standings-team">车队</span>
        <span class="standings-points">积分</span>
        <span class="standings-bar"></span>
      </div>
      ${rows}
    `;
  }

  function renderConstructorsStandings() {
    const grid = section.querySelector('.constructors-grid');
    if (!grid) return;

    grid.innerHTML = CONSTRUCTORS_DATA.map(team => `
      <div class="constructor-card ${team.isMcLaren ? 'mclaren' : ''}">
        <div class="constructor-header">
          <span class="constructor-pos">P${team.pos}</span>
          <span class="constructor-name">${team.name}</span>
        </div>
        <div class="constructor-points">${team.points}</div>
        <div class="constructor-points-label">积分</div>
        <div class="constructor-bar">
          <div class="constructor-bar-fill" style="width: ${(team.points / maxConstructorPoints) * 100}%"></div>
        </div>
      </div>
    `).join('');
  }

  renderDriversStandings();
  renderConstructorsStandings();
  
  // 初始化：隐藏车队积分榜
  const constructorsPanel = document.getElementById('constructorsStandings');
  if (constructorsPanel) {
    constructorsPanel.style.display = 'none';
  }

  section.querySelectorAll('.standings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      section.querySelectorAll('.standings-tab').forEach(t => t.classList.remove('active'));
      section.querySelectorAll('.standings-panel').forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
      });
      
      tab.classList.add('active');
      const type = tab.dataset.type;
      const panel = document.getElementById(`${type}Standings`);
      panel.classList.add('active');
      panel.style.display = 'block';
    });
  });
}

// ========== 13. PREDICTION GAME (比赛预测) ==========
function initPredictionGame() {
  const panel = document.getElementById('panel-prediction');
  if (!panel) return;

  const DRIVER_NAMES = {
    norris: 'Lando Norris',
    verstappen: 'Max Verstappen',
    leclerc: 'Charles Leclerc',
    piastri: 'Oscar Piastri',
    russell: 'George Russell'
  };

  let predictions = {
    pole: null,
    winner: null,
    landoPos: null,
    safetyCar: null
  };

  let predictionHistory = JSON.parse(safeStorage.get('ln4_predictions', '[]'));
  let predictionCount = predictionHistory.length;
  let correctCount = predictionHistory.filter(p => p.correct).length;

  document.getElementById('predictionCount').textContent = predictionCount;
  if (predictionCount > 0) {
    document.getElementById('predictionAccuracy').textContent = Math.round((correctCount / predictionCount) * 100) + '%';
  }

  function updateSubmitButton() {
    const btn = document.getElementById('submitPrediction');
    const allSelected = predictions.pole && predictions.winner && predictions.landoPos && predictions.safetyCar;
    
    if (allSelected) {
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
      btn.classList.add('ready');
      showSummary();
    } else {
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
      btn.classList.remove('ready');
      document.getElementById('predictionSummary').style.display = 'none';
    }
  }

  function showSummary() {
    const summary = document.getElementById('predictionSummary');
    const content = summary.querySelector('.prediction-summary-content');
    
    content.innerHTML = `
      <div class="prediction-summary-item"><span>杆位:</span><span>${DRIVER_NAMES[predictions.pole]}</span></div>
      <div class="prediction-summary-item"><span>冠军:</span><span>${DRIVER_NAMES[predictions.winner]}</span></div>
      <div class="prediction-summary-item"><span>Lando名次:</span><span>${predictions.landoPos}</span></div>
      <div class="prediction-summary-item"><span>安全车:</span><span>${predictions.safetyCar}次</span></div>
    `;
    
    summary.style.display = 'block';
  }

  panel.querySelectorAll('.prediction-options').forEach(optionsGroup => {
    const options = optionsGroup.querySelectorAll('.prediction-option');
    
    options.forEach(option => {
      option.addEventListener('click', () => {
        options.forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');

        if (option.dataset.driver) {
          if (optionsGroup.id === 'poleOptions') predictions.pole = option.dataset.driver;
          if (optionsGroup.id === 'winnerOptions') predictions.winner = option.dataset.driver;
        }
        if (option.dataset.pos) predictions.landoPos = option.dataset.pos;
        if (option.dataset.sc) predictions.safetyCar = option.dataset.sc;

        updateSubmitButton();
      });
    });
  });

  document.getElementById('submitPrediction').addEventListener('click', () => {
    if (!predictions.pole || !predictions.winner || !predictions.landoPos || !predictions.safetyCar) return;

    predictionHistory.push({
      ...predictions,
      timestamp: Date.now(),
      race: 'Australian GP 2025',
      correct: null
    });
    
    safeStorage.set('ln4_predictions', JSON.stringify(predictionHistory));
    
    predictionCount++;
    document.getElementById('predictionCount').textContent = predictionCount;

    const game = panel.querySelector('.prediction-game');
    game.innerHTML = `
      <div class="prediction-success">
        <div class="prediction-success-icon">🎯</div>
        <h4>预测已提交！</h4>
        <p>比赛结束后将自动计算你的得分</p>
        <p style="margin-top: 16px; font-size: 12px; color: var(--text-dim);">
          杆位: ${DRIVER_NAMES[predictions.pole]} | 冠军: ${DRIVER_NAMES[predictions.winner]}
        </p>
        <button class="magnetic-btn" onclick="location.reload()" style="margin-top: 24px; padding: 12px 30px; background: transparent; border: 1px solid var(--lime); color: var(--lime); border-radius: 8px; font-family: var(--font-display); cursor: pointer;">
          返回
        </button>
      </div>
    `;
  });
}

// ========== 12. MILESTONES (里程碑动画) ==========
function initMilestones() {
  const items = document.querySelectorAll('.milestone-item');
  if (items.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('revealed');
        }, index * 100);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -50px 0px' });

  items.forEach(item => observer.observe(item));
}

// ========== 12. TRACK MAP (赛道地图) ==========
function initTrackMap() {
  const section = document.querySelector('.section-trackmap');
  if (!section) return;

  const TRACK_DATA = {
    silverstone: {
      name: '银石赛道', country: '��', length: '5.891km', turns: 18, result: 'P2', year: 2024, type: 'podium',
      svgPath: "M150,450 C100,300 150,200 250,150 C400,100 500,150 650,250 C750,350 600,450 400,500 C200,550 200,600 150,450 Z"
    },
    monaco: {
      name: '摩纳哥蒙特卡洛', country: '🇲🇨', length: '3.337km', turns: 19, result: 'P2', year: 2024, type: 'podium',
      svgPath: "M200,250 L350,150 L450,200 L550,150 L650,300 C650,400 550,450 450,400 L350,450 L200,350 Z"
    },
    austria: {
      name: '红牛环赛道', country: '🇦🇹', length: '4.318km', turns: 10, result: 'P1', year: 2024, type: 'win',
      svgPath: "M250,450 L200,200 C300,100 500,150 600,250 L550,400 C450,500 350,450 250,450 Z"
    },
    singapore: {
      name: '新加坡滨海湾', country: '🇸🇬', length: '4.940km', turns: 23, result: 'P1', year: 2024, type: 'win',
      svgPath: "M200,200 L300,200 L300,300 L500,300 L500,450 L600,450 L600,550 L200,550 Z"
    }
  };

  const dots = section.querySelectorAll('.track-dot');
  const panel = document.getElementById('trackInfoPanel');
  const pathEl = section.querySelector('.track-svg-path');
  
  function drawTrack(trackId) {
    const data = TRACK_DATA[trackId];
    if (!data) return;
    
    if (pathEl && data.svgPath) {
      pathEl.style.transition = 'none';
      pathEl.setAttribute('d', data.svgPath);
      pathEl.setAttribute('stroke', data.type === 'win' ? '#FFD700' : 'var(--lime)');
      
      const length = pathEl.getTotalLength();
      pathEl.style.strokeDasharray = length;
      pathEl.style.strokeDashoffset = length;
      pathEl.getBoundingClientRect();
      pathEl.style.transition = 'stroke-dashoffset 2.5s cubic-bezier(0.25, 1, 0.3, 1)';
      pathEl.style.strokeDashoffset = '0';
    }
    
    if (panel) {
      panel.innerHTML = `
        <div class="track-info-header" style="opacity: 0; animation: fadeIn 0.5s forwards;">
          <h3 class="track-info-name">${data.name}<span class="track-info-flag">${data.country}</span></h3>
        </div>
        <div class="track-info-content" style="opacity: 0; animation: fadeIn 0.5s 0.2s forwards;">
          <p><strong>赛道长度:</strong> ${data.length}</p>
          <p><strong>弯道数量:</strong> ${data.turns}个</p>
          <p><strong>最近比赛:</strong> ${data.year}赛季</p>
        </div>
        <div class="track-info-result ${data.type === 'win' ? 'winner' : ''}" style="opacity: 0; animation: fadeIn 0.5s 0.4s forwards;">
          <div>
            <div class="track-info-result-label">Lando 战绩</div>
            <div class="track-info-result-value">${data.result} ${data.type === 'win' ? '🏆' : data.type === 'podium' ? '🥈' : ''}</div>
          </div>
        </div>
      `;
    }
  }

  dots.forEach(dot => {
    const trackId = dot.dataset.track;
    const data = TRACK_DATA[trackId];
    
    if (data && data.type === 'win') dot.classList.add('winner');

    dot.addEventListener('click', () => {
      if (dot.classList.contains('active')) return;
      dots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      drawTrack(trackId);
    });

    dot.addEventListener('mouseenter', () => dot.style.transform = 'scale(1.5)');
    dot.addEventListener('mouseleave', () => {
      if (!dot.classList.contains('active')) dot.style.transform = 'scale(1)';
    });
  });

  let hasDrawnInitial = false;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !hasDrawnInitial) {
        hasDrawnInitial = true;
        const activeDot = section.querySelector('.track-dot.active');
        if (activeDot) drawTrack(activeDot.dataset.track);
      }
    });
  }, { threshold: 0.3 });

  observer.observe(section);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWebsite);
} else {
  initWebsite();
}

function initOnTrackJump() {
  const jumpBtns = document.querySelectorAll('.ontrack-jump-btn');
  if (jumpBtns.length === 0) return;

  jumpBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.jump;
      if (target) {
        const el = document.querySelector(target);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          jumpBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
      }
    });
  });
}

// ========== Enhanced Features IIFE ==========
(() => {
  // ===== 1) Mobile Menu: Lock scroll when open + Esc to close =====
  const menuBtn = document.getElementById('menuBtn');
  const mobileMenu = document.getElementById('mobileMenu');

  function setMenu(open) {
    if (!menuBtn || !mobileMenu) return;
    menuBtn.setAttribute('aria-expanded', String(open));
    mobileMenu.classList.toggle('active', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      const open = menuBtn.getAttribute('aria-expanded') !== 'true';
      setMenu(open);
    });

    mobileMenu.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (a) setMenu(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setMenu(false);
    });
  }

  // ===== 2) Footer Share Buttons: Web Share / Copy Link =====
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.share-btn');
    if (!btn) return;

    const type = btn.getAttribute('data-type');
    const url = location.href;

    if (type === 'copy') {
      try {
        await navigator.clipboard.writeText(url);
        btn.textContent = '已复制 ✅';
        setTimeout(() => (btn.textContent = '复制链接'), 1200);
      } catch {
        alert('复制失败，请手动复制地址栏链接。');
      }
      return;
    }

    // Prefer native share (best mobile experience)
    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, url });
        return;
      } catch {}
    }

    // Fallback: open share links
    if (type === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(document.title)}`, '_blank');
    }
    if (type === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    }
  });
})();

// ========== 职业生涯对比功能 ==========
function initComparison() {
  const section = document.querySelector('.section-comparison');
  if (!section) return;
  
  const DRIVER_DATA = {
    norris: { wins: 4, podiums: 21, poles: 6 },
    verstappen: { wins: 61, podiums: 107, poles: 40 },
    leclerc: { wins: 7, podiums: 36, poles: 25 },
    piastri: { wins: 2, podiums: 9, poles: 0 }
  };
  
  const buttons = section.querySelectorAll('.driver-btn');
  const norrisData = DRIVER_DATA.norris;
  
  buttons.forEach(btn => {
    eventManager.on(btn, 'click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const driver = btn.dataset.driver;
      const compareData = DRIVER_DATA[driver];
      
      updateComparison(norrisData, compareData);
    });
  });
  
  function updateComparison(norris, compare) {
    const stats = ['wins', 'podiums', 'poles'];
    const statElements = section.querySelectorAll('.comparison-stat');
    
    statElements.forEach((el, i) => {
      const stat = stats[i];
      const norrisValue = norris[stat];
      const compareValue = compare[stat];
      const max = Math.max(norrisValue, compareValue);
      
      const norrisBar = el.querySelector('.norris-bar');
      const compareBar = el.querySelector('.compare-bar');
      const norrisLabel = el.querySelector('.norris-value');
      const compareLabel = el.querySelector('.compare-value');
      
      norrisBar.style.width = `${(norrisValue / max) * 50}%`;
      compareBar.style.width = `${(compareValue / max) * 50}%`;
      norrisLabel.textContent = norrisValue;
      compareLabel.textContent = compareValue;
    });
  }
  
  // 初始化：触发第一个按钮的点击事件
  const firstBtn = section.querySelector('.driver-btn.active');
  if (firstBtn) {
    updateComparison(norrisData, DRIVER_DATA[firstBtn.dataset.driver]);
  }
}

// ========== 图片懒加载优化 ==========
function initLazyLoading() { 
  if ('IntersectionObserver' in window) { 
    const imageObserver = new IntersectionObserver((entries, observer) => { 
      entries.forEach(entry => { 
        if (entry.isIntersecting) { 
          const img = entry.target; 
          const placeholder = img.closest('.photo-placeholder'); 
          
          const dataSrc = img.dataset.src;
          if (dataSrc && img.src !== dataSrc) { 
            if (placeholder) placeholder.classList.add('loading'); 
            
            img.onload = () => { 
              if (placeholder) { 
                placeholder.classList.remove('loading'); 
                placeholder.classList.add('loaded'); 
              } 
            }; 
            
            img.onerror = () => { 
              if (placeholder) placeholder.classList.remove('loading'); 
            }; 
            
            img.src = dataSrc; 
          } else if (placeholder && img.complete) { 
            // 图片已加载完成 
            placeholder.classList.remove('loading'); 
            placeholder.classList.add('loaded'); 
          } 
          
          observer.unobserve(img); 
        } 
      }); 
    }, { rootMargin: '50px' }); 
    
    // 观察所有懒加载图片 
    document.querySelectorAll('img[loading="lazy"]').forEach(img => { 
      imageObserver.observe(img); 
    }); 
  } 
}

// ========== 车迷投票功能 ==========
function initPoll() {
  const section = document.querySelector('.section-poll');
  if (!section) return;
  
  // 动态引入撒花库
  if (!window.confetti) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
    document.head.appendChild(script);
  }

  const options = Array.from(section.querySelectorAll('.poll-option'));
  const totalEl = section.querySelector('.poll-total strong');
  
  let hasVoted = safeStorage.get('ln4_poll_voted') === 'true';
  let storedVotes = safeStorage.get('ln4_poll_votes');
  
  // 如果没有存储的投票数据，重置为未投票状态
  if (!storedVotes) {
    hasVoted = false;
    safeStorage.set('ln4_poll_voted', 'false');
  }
  
  let votes = JSON.parse(storedVotes || '[124, 452, 305, 102]'); // 初始基数做大一点显得真实
  let liveUpdateInterval;
  
  function updatePoll(animateSort = false) {
    const total = votes.reduce((a, b) => a + b, 0);
    totalEl.textContent = total;
    
    options.forEach((opt, i) => {
      const percentage = total > 0 ? Math.round((votes[i] / total) * 100) : 0;
      opt.querySelector('.poll-bar-fill').style.width = percentage + '%';
      opt.querySelector('.poll-percentage').textContent = percentage + '%';
      
      // 动态排序：票数越高的排在越上面 (利用 flex order，负数越小越靠前)
      if (animateSort) {
        opt.style.order = -votes[i];
      }
      
      if (hasVoted) {
        opt.classList.add('voted');
        opt.style.cursor = 'default';
      } else {
        opt.classList.remove('voted');
        opt.style.cursor = 'pointer';
        opt.style.order = 0; // 未投票前不排序
      }
    });
  }

  // 伪实时跳动：模拟其他人在投票
  function startFakeLiveUpdates() {
    if (liveUpdateInterval) return;
    liveUpdateInterval = setInterval(() => {
      const randomOption = Math.floor(Math.random() * options.length);
      votes[randomOption] += Math.floor(Math.random() * 3); // 随机增加 0-2 票
      updatePoll(true);
    }, 4500);
  }
  
  options.forEach((opt, i) => {
    opt.addEventListener('click', (e) => {
      if (hasVoted) return showAlreadyVotedMessage();
      
      votes[i]++;
      hasVoted = true;
      safeStorage.set('ln4_poll_votes', JSON.stringify(votes));
      safeStorage.set('ln4_poll_voted', 'true');
      
      updatePoll(true);
      startFakeLiveUpdates(); // 投完票后开始观察"实时"数据
      
      // 撒花特效
      if (window.confetti) {
        const rect = opt.getBoundingClientRect();
        const x = (rect.left + rect.width / 2) / window.innerWidth;
        const y = (rect.top + rect.height / 2) / window.innerHeight;
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { x, y },
          colors: ['#00ff87', '#ff6b00', '#ffffff'] // 迈凯伦配色
        });
      }
      SoundManager.play('success');
    });
  });
  
  updatePoll(hasVoted);
  if (hasVoted) startFakeLiveUpdates();

  const resetBtn = document.getElementById('resetPollBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('确定要重置投票数据吗？这将清除你的投票记录。')) {
        safeStorage.set('ln4_poll_voted', 'false');
        safeStorage.set('ln4_poll_votes', '[124, 452, 305, 102]');
        hasVoted = false;
        votes = [124, 452, 305, 102];
        updatePoll(false);
        if (liveUpdateInterval) {
          clearInterval(liveUpdateInterval);
          liveUpdateInterval = null;
        }
        
        // 显示成功提示
        const successMsg = document.createElement('div');
        successMsg.textContent = '投票已重置！现在可以重新投票了 ✓';
        successMsg.style.cssText = `
          position: fixed; top: 100px; right: 40px; background: var(--lime);
          color: var(--bg); padding: 16px 24px; border-radius: 8px;
          font-family: var(--font-display); font-weight: 700; z-index: 10001;
          animation: slideInRight 0.5s var(--ease);
        `;
        document.body.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);
        
        SoundManager.play('success');
      }
    });
  }
}

function showAlreadyVotedMessage() {
  const existing = document.querySelector('.poll-already-voted');
  if (existing) existing.remove();
  
  const message = document.createElement('div');
  message.className = 'poll-already-voted';
  message.textContent = '你已经投过票了！✓';
  message.style.cssText = `
    position: fixed; top: 100px; right: 40px; background: rgba(0, 0, 0, 0.8);
    color: var(--text); padding: 16px 24px; border-radius: 8px;
    font-family: var(--font-display); font-weight: 600; z-index: 10001;
    animation: slideInRight 0.5s var(--ease); border: 1px solid var(--lime);
  `;
  document.body.appendChild(message);
  setTimeout(() => message.remove(), 2500);
}

// ========== 视频播放 ==========
// ========== 视频播放 (终极纯净版) ==========
function initVideos() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target;
      // 滚出视口时自动暂停
      if (!entry.isIntersecting && !video.paused) {
        video.pause();
        const n = video.id.replace('video', '');
        document.getElementById(`videoCard${n}`)?.classList.remove('playing');
      }
    });
  }, { threshold: 0.2 });

  [1, 2].forEach(num => {
    const video = document.getElementById(`video${num}`);
    const card = document.getElementById(`videoCard${num}`);
    const playBtn = document.getElementById(`playBtn${num}`);
    const duration = document.getElementById(`duration${num}`);
    
    if (!video || !card) return;
    
    observer.observe(video);
    let previewTimeout;

    function formatTime(s) {
      if (isNaN(s)) return '--:--';
      const m = Math.floor(s / 60);
      return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
    }

    // 悬停静音预览逻辑 (1.5 倍速)
    card.addEventListener('mouseenter', () => {
      // 如果正在正式播放，则不触发预览
      if (!video.paused && card.classList.contains('playing')) return;
      
      previewTimeout = setTimeout(() => {
        video.muted = true;
        video.playbackRate = 1.5;
        video.play().catch(()=>{});
        card.classList.add('previewing');
      }, 800);
    });

    card.addEventListener('mouseleave', () => {
      clearTimeout(previewTimeout);
      if (card.classList.contains('previewing')) {
        video.pause();
        video.currentTime = 0; // 重置进度
        card.classList.remove('previewing');
      }
    });

    // 正式播放/暂停切换逻辑
    function togglePlay() {
      clearTimeout(previewTimeout);
      card.classList.remove('previewing');
      
      // 互斥播放：暂停页面上的其他视频
      document.querySelectorAll('video').forEach(v => {
        if (v !== video && !v.paused) {
          v.pause();
          const vCard = document.getElementById(`videoCard${v.id.replace('video', '')}`);
          if(vCard) vCard.classList.remove('playing');
        }
      });

      if (video.paused) {
        video.muted = false;
        video.playbackRate = 1.0;
        video.play();
        card.classList.add('playing');
      } else {
        video.pause();
        card.classList.remove('playing');
      }
    }

    // 1. 点击播放按钮触发
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlay();
    });

    // 2. 关键修复：点击视频画面本身也能暂停 (替代原生控件)
    video.addEventListener('click', (e) => {
      e.stopPropagation();
      // 只有在正式播放状态下，点击画面才触发暂停
      if (card.classList.contains('playing')) {
        togglePlay();
      }
    });

    video.addEventListener('play', () => {
      if (!card.classList.contains('previewing')) card.classList.add('playing');
    });
    
    video.addEventListener('pause', () => {
      card.classList.remove('playing');
    });

    video.addEventListener('loadedmetadata', () => {
      duration.textContent = formatTime(video.duration);
    });
  });
}

// ========== 移动端底部导航栏 ==========
function initMobileBottomNav() {
  const nav = document.getElementById('mobileBottomNav');
  if (!nav) return;
  
  // 只在移动端激活
  if (window.innerWidth > 768) return;
  
  const items = nav.querySelectorAll('.bottom-nav-item');
  const sections = document.querySelectorAll('.section');
  
  // 滚动时高亮当前区域
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        items.forEach(item => {
          const href = item.getAttribute('href').substring(1);
          item.classList.toggle('active', href === id);
        });
      }
    });
  }, { threshold: 0.5 });
  
  sections.forEach(section => {
    if (section.id) observer.observe(section);
  });
  
  // 点击平滑滚动
  items.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(item.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

// ========== 可访问性改进：键盘导航 ==========
function initAccessibility() {
  if (document.getElementById('a11y-focus-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'a11y-focus-styles';
  style.textContent = `
    *:focus-visible {
      outline: 2px solid var(--lime);
      outline-offset: 4px;
      border-radius: 4px;
    }
    
    button:focus-visible,
    a:focus-visible,
    input:focus-visible,
    textarea:focus-visible,
    select:focus-visible,
    [tabindex]:focus-visible {
      box-shadow: 0 0 0 4px rgba(0, 255, 135, 0.2);
    }
  `;
  document.head.appendChild(style);
  
  // 为重要交互元素添加 tabindex（如果还没有）
  document.querySelectorAll('button, a, input, textarea, select, [role="button"]').forEach(el => {
    if (!el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '0');
    }
  });
  
  // 键盘快捷键提示
  document.addEventListener('keydown', (e) => {
    if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
      const helpModal = document.getElementById('keyboardHelp');
      if (helpModal) {
        helpModal.classList.add('show');
      }
    }
  });
}