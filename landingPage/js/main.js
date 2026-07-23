// O-Chat Landing Page Interactivity & Translation Engine

let currentLang = localStorage.getItem('ochat_lang') || 'bn';

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('ochat_lang', lang);

  const langLabel = document.getElementById('langLabel');
  if (langLabel) {
    langLabel.textContent = lang === 'bn' ? 'English (EN)' : 'বাংলা (BN)';
  }

  // Update all text nodes with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (i18n[lang] && i18n[lang][key] !== undefined) {
      // Preserve child HTML elements if any or replace text
      el.innerHTML = i18n[lang][key];
    }
  });

  document.documentElement.lang = lang;
}

document.addEventListener('DOMContentLoaded', () => {
  // Apply saved language (default Bangla)
  setLanguage(currentLang);

  // Language Toggle Event Listener
  const langToggleBtn = document.getElementById('langToggle');
  if (langToggleBtn) {
    langToggleBtn.addEventListener('click', () => {
      const nextLang = currentLang === 'bn' ? 'en' : 'bn';
      setLanguage(nextLang);
    });
  }

  // Navbar scroll background effect
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navbar?.classList.add('scrolled');
    } else {
      navbar?.classList.remove('scrolled');
    }
  });

  // FAQ Accordion Toggle
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    question?.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      faqItems.forEach(other => other.classList.remove('active'));
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });

  // Mobile Navigation Drawer Toggle
  const mobileToggle = document.getElementById('mobileMenuToggle');
  const navLinks = document.querySelector('.nav-links');

  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      const icon = mobileToggle.querySelector('i');
      if (icon) {
        if (navLinks.classList.contains('active')) {
          icon.className = 'fa-solid fa-xmark';
        } else {
          icon.className = 'fa-solid fa-bars';
        }
      }
    });

    // Close menu when clicking nav link
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        const icon = mobileToggle.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-bars';
      });
    });
  }

});
