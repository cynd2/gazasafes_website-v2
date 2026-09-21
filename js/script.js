document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.querySelector('.nav-toggle');
  const siteHeader = document.querySelector('.site-header');

  if (navToggle && siteHeader) {
    navToggle.addEventListener('click', () => {
      const isOpen = siteHeader.classList.toggle('menu-open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    siteHeader.querySelectorAll('.main-nav a').forEach((link) => {
      link.addEventListener('click', () => {
        siteHeader.classList.remove('menu-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  const activeCityLabel = document.getElementById('active-city');
  const mapFrame = document.getElementById('branch-map-frame');
  const pills = document.querySelectorAll('.city-pill');

  if (activeCityLabel && mapFrame && pills.length) {
    const cityQueryOverrides = { Jogja: 'Yogyakarta' };
    const cityMapQueries = {
      Madiun: 'Brankas GAZASAFES Madiun',
      Kediri: 'Brankas Murah Kediri',
      Mojokerto: 'Saiful Brankas Mojokerto, Jl. Kartini Stand Utara Lapangan, Seduri, Mojosari, Kabupaten Mojokerto',
    };

    const setActiveCity = (city) => {
      const query = cityMapQueries[city] || (cityQueryOverrides[city] || city) + ', Jawa, Indonesia';
      activeCityLabel.textContent = city;
      mapFrame.src = 'https://maps.google.com/maps?q=' + encodeURIComponent(query) + '&z=15&output=embed';
    };

    pills.forEach((pill) => {
      pill.addEventListener('click', () => setActiveCity(pill.dataset.city));
    });

    setActiveCity('Madiun');
  }

  document.querySelectorAll('.faq-item').forEach((item) => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    const icon = item.querySelector('.faq-icon');

    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');

      document.querySelectorAll('.faq-item.is-open').forEach((openItem) => {
        if (openItem !== item) {
          openItem.classList.remove('is-open');
          openItem.querySelector('.faq-answer').style.maxHeight = '0px';
          openItem.querySelector('.faq-icon').textContent = '+';
        }
      });

      if (isOpen) {
        item.classList.remove('is-open');
        answer.style.maxHeight = '0px';
        icon.textContent = '+';
      } else {
        item.classList.add('is-open');
        answer.style.maxHeight = answer.scrollHeight + 'px';
        icon.textContent = '−';
      }
    });
  });

  document.querySelectorAll('.gallery-carousel').forEach((carousel) => {
    const track = carousel.querySelector('.carousel-track');
    const slides = carousel.querySelectorAll('.carousel-slide');
    const prevBtn = carousel.querySelector('.carousel-arrow--prev');
    const nextBtn = carousel.querySelector('.carousel-arrow--next');
    const dots = carousel.querySelectorAll('.carousel-dot');
    const autoplayDelay = 4000;
    let index = 0;
    let autoplayTimer = null;

    const goTo = (i) => {
      index = (i + slides.length) % slides.length;
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((dot, di) => dot.classList.toggle('is-active', di === index));
    };

    const stopAutoplay = () => {
      if (autoplayTimer) clearInterval(autoplayTimer);
    };

    const startAutoplay = () => {
      stopAutoplay();
      autoplayTimer = setInterval(() => goTo(index + 1), autoplayDelay);
    };

    const manualGoTo = (i) => {
      goTo(i);
      startAutoplay();
    };

    if (prevBtn) prevBtn.addEventListener('click', () => manualGoTo(index - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => manualGoTo(index + 1));
    dots.forEach((dot, di) => dot.addEventListener('click', () => manualGoTo(di)));

    carousel.addEventListener('mouseenter', stopAutoplay);
    carousel.addEventListener('mouseleave', startAutoplay);

    let touchStartX = null;
    track.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      stopAutoplay();
    }, { passive: true });

    track.addEventListener('touchend', (e) => {
      if (touchStartX === null) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(deltaX) > 40) {
        goTo(deltaX < 0 ? index + 1 : index - 1);
      }
      touchStartX = null;
      startAutoplay();
    });

    startAutoplay();
  });
});
