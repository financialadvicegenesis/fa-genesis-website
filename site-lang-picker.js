/**
 * FA GENESIS - Selecteur de langue flottant (pages sans footer.js)
 *
 * Les pages qui chargent deja footer.js ont leur propre selecteur de langue
 * dans le footer (10 langues, moteur AppI18n). Les pages qui n'ont pas de
 * footer.js (landing, formulaires d'inscription/connexion, etc.) n'ont aucun
 * moyen visible de changer de langue : ce script ajoute un petit bouton
 * flottant (bas-gauche) + une liste deroulante des 10 langues, branche sur le
 * meme moteur AppI18n que app.html et footer.js.
 *
 * Chargement attendu : apres app-i18n.js + les 9 app-i18n-<lang>.js + l'appel
 * a AppI18n.initAppLanguage() dans le <head> de la page hote (voir ces pages).
 * Defensif malgre tout : si AppI18n n'est pas encore pret, on patiente un peu
 * avant de renoncer silencieusement (jamais d'erreur bloquante).
 */
(function () {
  'use strict';

  var LANGS = [
    { code: 'fr', flag: '🇫🇷', label: 'Français' },
    { code: 'en', flag: '🇬🇧', label: 'English' },
    { code: 'es', flag: '🇪🇸', label: 'Español' },
    { code: 'pt', flag: '🇵🇹', label: 'Português' },
    { code: 'ar', flag: '🇸🇦', label: 'العربية' },
    { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
    { code: 'zh', flag: '🇨🇳', label: '中文' },
    { code: 'it', flag: '🇮🇹', label: 'Italiano' },
    { code: 'ja', flag: '🇯🇵', label: '日本語' },
    { code: 'hi', flag: '🇮🇳', label: 'हिन्दी' }
  ];

  function langByCode(code) {
    for (var i = 0; i < LANGS.length; i++) {
      if (LANGS[i].code === code) return LANGS[i];
    }
    return LANGS[0];
  }

  function buildPicker() {
    // Evite un doublon si le script est inclus deux fois par erreur sur une page.
    if (document.getElementById('fg-site-lang-picker')) return;

    var currentLang = 'fr';
    try {
      if (typeof window.AppI18n !== 'undefined' && window.AppI18n.getAppLanguage) {
        currentLang = window.AppI18n.getAppLanguage();
      }
    } catch (e) {}
    var currentInfo = langByCode(currentLang);

    var style = document.createElement('style');
    style.textContent = [
      '#fg-site-lang-picker{position:fixed;bottom:16px;left:16px;z-index:9999;font-family:"Space Grotesk",Arial,sans-serif;}',
      '#fg-slp-btn{display:flex;align-items:center;gap:6px;background:#111;color:#fff;border:2px solid #FFD700;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.35);}',
      '#fg-slp-btn:hover{background:#000;}',
      '#fg-slp-dropdown{display:none;position:absolute;bottom:100%;left:0;margin-bottom:8px;background:#fff;border:2px solid #000;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.35);min-width:190px;max-height:260px;overflow-y:auto;}',
      '#fg-slp-dropdown.open{display:block;}',
      '.fg-slp-option{display:flex;align-items:center;gap:8px;padding:10px 14px;font-size:13px;font-weight:600;color:#111;cursor:pointer;white-space:nowrap;}',
      '.fg-slp-option:hover{background:#FFD700;}',
      '.fg-slp-option.active{background:#f0f0f0;font-weight:900;}'
    ].join('\n');
    document.head.appendChild(style);

    var wrap = document.createElement('div');
    wrap.id = 'fg-site-lang-picker';

    var btn = document.createElement('button');
    btn.id = 'fg-slp-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Changer de langue');
    btn.innerHTML = '<span id="fg-slp-flag">' + currentInfo.flag + '</span><span id="fg-slp-code">' + currentInfo.code.toUpperCase() + '</span>';

    var dropdown = document.createElement('div');
    dropdown.id = 'fg-slp-dropdown';
    for (var i = 0; i < LANGS.length; i++) {
      var opt = document.createElement('div');
      opt.className = 'fg-slp-option' + (LANGS[i].code === currentLang ? ' active' : '');
      opt.setAttribute('data-lang', LANGS[i].code);
      opt.innerHTML = LANGS[i].flag + ' <span style="margin-left:4px;">' + LANGS[i].label + '</span>';
      opt.addEventListener('click', function () {
        var lang = this.getAttribute('data-lang');
        try {
          if (typeof window.AppI18n !== 'undefined' && window.AppI18n.setAppLanguage) {
            window.AppI18n.setAppLanguage(lang);
          }
        } catch (e) {}
      });
      dropdown.appendChild(opt);
    }

    wrap.appendChild(btn);
    wrap.appendChild(dropdown);
    document.body.appendChild(wrap);

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    document.addEventListener('click', function () {
      dropdown.classList.remove('open');
    });
  }

  function init(attempts) {
    attempts = attempts || 0;
    // On patiente un court instant si AppI18n n'est pas encore charge (ne devrait
    // pas arriver si ce script est place apres app-i18n.js dans le <head>, mais
    // reste defensif en cas de page qui l'inclut dans un autre ordre).
    if (typeof window.AppI18n === 'undefined' && attempts < 40) {
      setTimeout(function () { init(attempts + 1); }, 50);
      return;
    }
    buildPicker();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(0); });
  } else {
    init(0);
  }
})();
