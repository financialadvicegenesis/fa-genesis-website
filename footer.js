/**
 * FA GENESIS - Footer Component
 * Composant footer réutilisable injecté sur toutes les pages
 */
(function() {
    'use strict';

    // Base path pour GitHub Pages (racine relative)
    var BASE = '';

    // === Langues supportees (moteur AppI18n, partage avec app.html) ===
    // Emoji drapeaux : plus simple a maintenir que les SVG a la main precedents,
    // et coherent avec les 10 langues du moteur (vs 2 avant: FR/EN).
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

    // Charge le moteur AppI18n + les 9 dictionnaires de langue dynamiquement
    // (meme pattern que l'ancien chargement dynamique de i18n.js ci-dessous),
    // puis initialise la langue. Defensif : si une page a deja charge ces
    // scripts elle-meme dans son <head> (cf. app-i18n.js?v=... ajoute
    // directement sur les 23 pages du site), on ne recharge rien.
    function ensureAppI18nLoaded(callback) {
        if (typeof window.AppI18n !== 'undefined') {
            callback();
            return;
        }
        var files = [
            'app-i18n.js', 'app-i18n-en.js', 'app-i18n-es.js', 'app-i18n-pt.js',
            'app-i18n-ar.js', 'app-i18n-de.js', 'app-i18n-zh.js', 'app-i18n-it.js',
            'app-i18n-ja.js', 'app-i18n-hi.js'
        ];
        function loadNext(i) {
            if (i >= files.length) {
                waitForAppI18n(callback, 0);
                return;
            }
            var s = document.createElement('script');
            s.src = BASE + files[i] + '?v=20261016b';
            s.onload = function() { loadNext(i + 1); };
            s.onerror = function() { loadNext(i + 1); }; // un fichier manquant ne doit pas tout bloquer
            document.head.appendChild(s);
        }
        loadNext(0);
    }

    function waitForAppI18n(callback, attempts) {
        if (typeof window.AppI18n !== 'undefined') {
            callback();
            return;
        }
        if (attempts > 40) return; // ~2s, abandon silencieux
        setTimeout(function() { waitForAppI18n(callback, attempts + 1); }, 50);
    }

    // Injecter le CSS du footer
    var style = document.createElement('style');
    style.textContent = [
        '/* ============ FA GENESIS FOOTER ============ */',
        '.fg-footer { background: #ffffff; color: #000000; border-top: 6px solid #FFD700; font-family: "Space Grotesk", sans-serif; font-weight: 900; }',
        '.fg-footer * { box-sizing: border-box; }',
        '.fg-footer a { color: #000000; text-decoration: none; transition: opacity 0.2s; font-weight: 900; }',
        '.fg-footer a:hover { opacity: 0.6; text-decoration: underline; }',
        '.fg-footer a:focus-visible { outline: 2px solid #FFD700; outline-offset: 2px; }',

        /* Container */
        '.fg-footer__inner { max-width: 1140px; margin: 0 auto; padding: 0 24px; }',

        /* A) Branding */
        '.fg-footer__brand { padding: 48px 0 32px; text-align: center; }',
        '.fg-footer__brand-name { font-family: "Unbounded", cursive; font-size: 28px; font-weight: 900; font-style: italic; text-transform: uppercase; letter-spacing: 1px; margin: 0; }',
        '.fg-footer__brand-slogan { font-size: 14px; font-weight: 500; margin-top: 10px; color: #444444; max-width: 520px; margin-left: auto; margin-right: auto; line-height: 1.5; }',
        '.fg-footer__brand-group { font-size: 10px; text-transform: uppercase; letter-spacing: 3px; font-style: italic; font-weight: 900; margin-top: 4px; color: #000000; }',

        /* Socials */
        '.fg-footer__socials { display: flex; justify-content: center; gap: 20px; margin-top: 20px; }',
        '.fg-footer__socials a { font-size: 22px; color: #000000; text-decoration: none; }',
        '.fg-footer__socials a:hover { color: #FFD700; opacity: 1; }',

        /* Separator */
        '.fg-footer__sep { border: none; border-top: 1px solid #eaeaea; margin: 0; }',

        /* B) Disclaimer */
        '.fg-footer__disclaimer { padding: 24px 0; text-align: center; }',
        '.fg-footer__disclaimer p { font-size: 13px; line-height: 1.6; color: #000000; max-width: 800px; margin: 0 auto; font-weight: 900; }',

        /* C) Link grid */
        '.fg-footer__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; padding: 40px 0; }',
        '.fg-footer__col-title { font-family: "Unbounded", cursive; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px 0; color: #000000; text-align: center; }',
        '.fg-footer__col-list { list-style: none; margin: 0; padding: 0; text-align: center; }',
        '.fg-footer__col-list li { margin-bottom: 10px; }',
        '.fg-footer__col-list a { font-size: 14px; font-weight: 900; color: #000000; }',
        '.fg-footer__col-list a:hover { color: #000000; }',

        /* D) Bottom bar */
        '.fg-footer__bottom { padding: 24px 0; }',
        '.fg-footer__copyright { font-size: 12px; color: #000000; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px 0; text-align: center; }',
        '.fg-footer__copyright strong { color: #000000; }',
        '.fg-footer__bottom-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }',
        '.fg-footer__bottom-left a { font-size: 12px; color: #000000; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }',
        '.fg-footer__bottom-links { display: flex; gap: 24px; flex-wrap: wrap; }',
        '.fg-footer__bottom-links a { font-size: 12px; color: #000000; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }',
        '.fg-footer__bottom-links a:hover { color: #000000; }',

        /* Language selector */
        '.fg-footer__lang { position: relative; }',
        '.fg-footer__lang-btn { display: flex; align-items: center; gap: 8px; background: none; border: 2px solid #000; padding: 6px 14px; cursor: pointer; font-family: "Space Grotesk", sans-serif; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #000; transition: all 0.2s; }',
        '.fg-footer__lang-btn:hover { background: #000; color: #fff; }',
        '.fg-footer__lang-btn:hover svg rect[fill="#FFFFFF"], .fg-footer__lang-btn:hover svg rect[fill="#FFF"] { fill: #FFF; }',
        '.fg-footer__lang-dropdown { display: none; position: absolute; bottom: 100%; right: 0; background: #fff; border: 2px solid #000; box-shadow: 4px 4px 0px #000; min-width: 200px; max-height: 280px; overflow-y: auto; margin-bottom: 4px; z-index: 100; }',
        '.fg-footer__lang-dropdown.open { display: block; }',
        '.fg-footer__lang-option { display: flex; align-items: center; gap: 10px; padding: 12px 16px; cursor: pointer; font-size: 13px; font-weight: 700; transition: background 0.15s; }',
        '.fg-footer__lang-option:hover { background: #FFD700; }',
        '.fg-footer__lang-option.active { background: #f0f0f0; font-weight: 900; }',

        /* Cookie banner */
        '.fg-cookie-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10000; display: flex; align-items: flex-end; justify-content: center; }',
        '.fg-cookie-banner { background: #fff; color: #000; border-top: 6px solid #FFD700; padding: 32px; max-width: 700px; width: 100%; margin: 0 16px 0 16px; font-family: "Space Grotesk", sans-serif; }',
        '.fg-cookie-banner h3 { font-family: "Unbounded", cursive; font-size: 18px; font-weight: 900; text-transform: uppercase; margin: 0 0 16px 0; }',
        '.fg-cookie-banner p { font-size: 14px; line-height: 1.7; font-weight: 500; margin: 0 0 12px 0; }',
        '.fg-cookie-banner a { color: #000; font-weight: 900; text-decoration: underline; }',
        '.fg-cookie-accept { background: #FFD700; color: #000; border: 3px solid #000; box-shadow: 4px 4px 0px #000; padding: 12px 32px; font-family: "Space Grotesk", sans-serif; font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; cursor: pointer; transition: all 0.1s; margin-top: 16px; }',
        '.fg-cookie-accept:hover { box-shadow: 2px 2px 0px #000; transform: translate(2px, 2px); }',
        '.fg-cookie-accept:active { box-shadow: 0px 0px 0px #000; transform: translate(4px, 4px); }',
        '.fg-cookie-icon { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }',
        '.fg-cookie-icon i { font-size: 32px; color: #FFD700; }',

        /* Mobile accordion */
        '.fg-footer__accordion { display: none; }',
        '.fg-footer__accordion summary { font-family: "Unbounded", cursive; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; padding: 16px 0; cursor: pointer; list-style: none; display: flex; justify-content: center; align-items: center; gap: 8px; border-bottom: 1px solid #eaeaea; text-align: center; }',
        '.fg-footer__accordion summary::-webkit-details-marker { display: none; }',
        '.fg-footer__accordion summary::after { content: "+"; font-size: 20px; font-weight: 900; color: #FFD700; transition: transform 0.2s; }',
        '.fg-footer__accordion[open] summary::after { content: "\\2212"; }',
        '.fg-footer__accordion .fg-footer__col-list { padding: 12px 0 8px; text-align: center; }',

        /* Tablet: 2 columns */
        '@media (max-width: 900px) {',
        '  .fg-footer__grid { grid-template-columns: repeat(2, 1fr); gap: 24px; }',
        '}',
        /* 3-col stays fine; at tablet it becomes 2 then hides on mobile */

        /* Mobile */
        '@media (max-width: 640px) {',
        '  .fg-footer__grid { display: none; }',
        '  .fg-footer__accordion { display: block; }',
        '  .fg-footer__brand-name { font-size: 22px; }',
        '  .fg-footer__brand { padding: 32px 0 24px; text-align: center; }',
        '  .fg-footer__brand-slogan { text-align: center; font-size: 13px; }',
        '  .fg-footer__socials { justify-content: center; }',
        '  .fg-footer__disclaimer { text-align: center; }',
        '  .fg-footer__copyright { text-align: center; }',
        '  .fg-footer__bottom-row { flex-direction: column; align-items: center; gap: 12px; }',
        '  .fg-footer__bottom-links { gap: 16px; justify-content: center; flex-wrap: wrap; }',
        '  .fg-footer__bottom-left { text-align: center; }',
        '  .fg-footer__lang { display: flex; justify-content: center; }',
        '  .fg-footer__lang-dropdown { right: auto; left: 50%; transform: translateX(-50%); }',
        '  .fg-cookie-banner { padding: 24px 16px; }',
        '}'
    ].join('\n');
    document.head.appendChild(style);

    // Colonnes de liens
    var columns = [
        {
            title: 'Plateforme',
            links: [
                { label: 'Espace client', href: 'app.html' },
                { label: 'Espace prestataire', href: 'app.html' },
                { label: 'Fonctionnalit\u00e9s', href: 'index.html#fonctionnalites' },
                { label: 'T\u00e9l\u00e9charger l\u2019app', href: 'index.html#app' }
            ]
        },
        {
            title: 'Entreprise',
            links: [
                { label: '\u00c0 propos', href: 'a-propos.html' },
                { label: 'Actualit\u00e9s', href: 'index.html#actualites' },
                { label: 'Contact', href: 'contact.html' },
                { label: 'FAQ', href: 'faq.html' }
            ]
        },
        {
            title: 'L\u00e9gal',
            links: [
                { label: 'Conditions g\u00e9n\u00e9rales', href: 'conditions-generales.html' },
                { label: 'Confidentialit\u00e9', href: 'confidentialite.html' },
                { label: 'Mentions l\u00e9gales', href: 'mentions-legales.html' },
                { label: 'Cookies', href: 'cookies.html' }
            ]
        }
    ];

    function buildLink(href, label) {
        return '<a href="' + BASE + href + '">' + label + '</a>';
    }

    function buildList(links) {
        var html = '<ul class="fg-footer__col-list">';
        for (var i = 0; i < links.length; i++) {
            html += '<li>' + buildLink(links[i].href, links[i].label) + '</li>';
        }
        html += '</ul>';
        return html;
    }

    // === COOKIE BANNER ===
    function showCookieBanner() {
        // Si deja accepte, ne pas afficher
        try {
            if (localStorage.getItem('fa_genesis_cookies_accepted') === 'true') return;
        } catch(e) {}

        var overlay = document.createElement('div');
        overlay.className = 'fg-cookie-overlay';
        overlay.id = 'fg-cookie-overlay';
        overlay.innerHTML = '<div class="fg-cookie-banner">' +
            '<div class="fg-cookie-icon"><i class="fas fa-cookie-bite"></i><h3>Gestion des cookies</h3></div>' +
            '<p>Ce site utilise uniquement des <strong>cookies techniques</strong> n\u00e9cessaires au fonctionnement du service (authentification, session).</p>' +
            '<p>Aucun cookie publicitaire ou de tracking n\u2019est utilis\u00e9.</p>' +
            '<p><a href="confidentialite.html">En savoir plus sur notre politique de confidentialit\u00e9</a></p>' +
            '<button class="fg-cookie-accept" id="fg-cookie-accept">J\u2019ai compris</button>' +
            '</div>';
        document.body.appendChild(overlay);

        var acceptBtn = document.getElementById('fg-cookie-accept');
        if (acceptBtn) {
            acceptBtn.addEventListener('click', function() {
                try { localStorage.setItem('fa_genesis_cookies_accepted', 'true'); } catch(e) {}
                var ov = document.getElementById('fg-cookie-overlay');
                if (ov) ov.remove();
            });
        }
    }

    function renderFooter() {
        var target = document.getElementById('site-footer');
        if (!target) return;

        // Langue courante : lue via AppI18n si deja initialise, sinon fr par defaut
        // (ensureAppI18nLoaded() plus bas l'initialisera si besoin).
        var currentLang = 'fr';
        try {
            if (typeof window.AppI18n !== 'undefined' && window.AppI18n.getAppLanguage) {
                currentLang = window.AppI18n.getAppLanguage();
            }
        } catch(e) {}
        var currentInfo = langByCode(currentLang);

        var html = '<footer class="fg-footer" role="contentinfo">';
        html += '<div class="fg-footer__inner">';

        // A) Branding
        html += '<div class="fg-footer__brand">';
        html += '<p class="fg-footer__brand-name">FA GENESIS</p>';
        html += '<p class="fg-footer__brand-slogan">La plateforme qui connecte clients et prestataires de services en France et à l’international.</p>';
        html += '<p class="fg-footer__brand-group">Groupe FA Industries</p>';
        html += '<div class="fg-footer__socials">';
        html += '<a href="https://www.linkedin.com/in/financial-advice-genesis-772b653aa/" target="_blank" rel="noopener" aria-label="LinkedIn"><i class="fab fa-linkedin"></i></a>';
        html += '<a href="https://www.instagram.com/financial_advice_genesis/?hl=en" target="_blank" rel="noopener" aria-label="Instagram"><i class="fab fa-instagram"></i></a>';
        html += '<a href="https://www.tiktok.com/@financial.advice.genesis" target="_blank" rel="noopener" aria-label="TikTok"><i class="fab fa-tiktok"></i></a>';
        html += '</div>';
        html += '</div>';

        // Separator
        html += '<hr class="fg-footer__sep">';

        // B) Disclaimer
        html += '<div class="fg-footer__disclaimer">';
        html += '<p>Avertissement : FA Genesis est une plateforme mettant en relation des clients avec des prestataires ind\u00e9pendants. Aucun r\u00e9sultat n\u2019est garanti. Les livrables d\u00e9pendent du prestataire choisi et de l\u2019implication du client.</p>';
        html += '</div>';

        // Separator
        html += '<hr class="fg-footer__sep">';

        // C) Grid (desktop/tablet)
        html += '<div class="fg-footer__grid">';
        for (var c = 0; c < columns.length; c++) {
            html += '<div>';
            html += '<h3 class="fg-footer__col-title">' + columns[c].title + '</h3>';
            html += buildList(columns[c].links);
            html += '</div>';
        }
        html += '</div>';

        // C bis) Accordions (mobile)
        for (var a = 0; a < columns.length; a++) {
            html += '<details class="fg-footer__accordion">';
            html += '<summary>' + columns[a].title + '</summary>';
            html += buildList(columns[a].links);
            html += '</details>';
        }

        // Separator
        html += '<hr class="fg-footer__sep">';

        // D) Bottom bar
        html += '<div class="fg-footer__bottom">';
        html += '<p class="fg-footer__copyright">\u00a9 2026 <strong>Financial Advice Genesis</strong>. Tous droits r\u00e9serv\u00e9s. D\u00c9VELOPP\u00c9 PAR L\u2019\u00c9LITE WEB</p>';
        html += '<div class="fg-footer__bottom-row">';

        // Gauche : Cookies
        html += '<div class="fg-footer__bottom-left">';
        html += '<a href="#" id="fg-cookies-btn"><i class="fas fa-cookie-bite" style="margin-right:6px;"></i>Cookies</a>';
        html += '</div>';

        // Centre : liens
        html += '<div class="fg-footer__bottom-links">';
        html += buildLink('confidentialite.html', 'Confidentialit\u00e9');
        html += buildLink('protection-donnees.html', 'Donn\u00e9es pers.');
        html += buildLink('cookies.html', 'Cookies');
        html += buildLink('conditions-generales.html', 'CGV');
        html += buildLink('contact.html', 'Contact');
        html += '</div>';

        // Droite : Langue (10 langues, drapeaux emoji)
        html += '<div class="fg-footer__lang">';
        html += '<button class="fg-footer__lang-btn" id="fg-lang-btn">';
        html += '<span id="fg-lang-flag">' + currentInfo.flag + '</span>';
        html += '<span id="fg-lang-label">' + currentInfo.label + '</span>';
        html += '<i class="fas fa-chevron-down" style="font-size:10px;margin-left:4px;"></i>';
        html += '</button>';
        html += '<div class="fg-footer__lang-dropdown" id="fg-lang-dropdown">';
        for (var li = 0; li < LANGS.length; li++) {
            html += '<div class="fg-footer__lang-option' + (currentLang === LANGS[li].code ? ' active' : '') + '" data-lang="' + LANGS[li].code + '">';
            html += LANGS[li].flag + ' <span style="margin-left:4px;">' + LANGS[li].label + '</span>';
            html += '</div>';
        }
        html += '</div>';
        html += '</div>';

        html += '</div>'; // bottom-row
        html += '</div>'; // bottom

        html += '</div>'; // inner
        html += '</footer>';

        target.innerHTML = html;

        // === Langue selector logic (moteur AppI18n partage avec app.html) ===
        var langBtn = document.getElementById('fg-lang-btn');
        var langDropdown = document.getElementById('fg-lang-dropdown');

        if (langBtn && langDropdown) {
            langBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                langDropdown.classList.toggle('open');
            });

            var options = langDropdown.querySelectorAll('.fg-footer__lang-option');
            for (var i = 0; i < options.length; i++) {
                options[i].addEventListener('click', function() {
                    var lang = this.getAttribute('data-lang');
                    // AppI18n.setAppLanguage() sauvegarde le choix (localStorage) ET
                    // recharge la page : pas besoin de retraduire/mettre a jour le
                    // bouton nous-memes, le reload repart avec initAppLanguage().
                    try {
                        if (typeof window.AppI18n !== 'undefined' && window.AppI18n.setAppLanguage) {
                            window.AppI18n.setAppLanguage(lang);
                        }
                    } catch(e) {}
                });
            }

            // Fermer si clic ailleurs
            document.addEventListener('click', function() {
                langDropdown.classList.remove('open');
            });
        }

        // === Cookies button -> banniere ===
        var cookiesBtn = document.getElementById('fg-cookies-btn');
        if (cookiesBtn) {
            cookiesBtn.addEventListener('click', function(e) {
                e.preventDefault();
                // Forcer l'affichage meme si deja accepte (on re-ouvre)
                try { localStorage.removeItem('fa_genesis_cookies_accepted'); } catch(e) {}
                // Supprimer l'ancien overlay s'il existe
                var old = document.getElementById('fg-cookie-overlay');
                if (old) old.remove();
                showCookieBanner();
            });
        }

        // Charger le moteur AppI18n (+ dictionnaires) si pas deja present sur la
        // page, puis initialiser la langue courante (no-op si deja fait par la
        // page elle-meme via app-i18n.js?v=... + initAppLanguage() dans son <head>).
        ensureAppI18nLoaded(function() {
            try { window.AppI18n.initAppLanguage(); } catch(e) {}
        });

        // Afficher la banniere cookies au premier chargement
        showCookieBanner();
    }

    // Executer au chargement du DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderFooter);
    } else {
        renderFooter();
    }
})();
