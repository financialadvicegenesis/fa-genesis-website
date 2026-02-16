/**
 * FA GENESIS - Footer Component
 * Composant footer réutilisable injecté sur toutes les pages
 */
(function() {
    'use strict';

    // Base path pour GitHub Pages (racine relative)
    var BASE = '';

    // === SVG Drapeaux ===
    var FLAG_FR = '<svg viewBox="0 0 30 20" style="width:24px;height:16px;border:1px solid #ccc;vertical-align:middle;display:inline-block;"><rect x="0" y="0" width="10" height="20" fill="#002395"/><rect x="10" y="0" width="10" height="20" fill="#FFFFFF"/><rect x="20" y="0" width="10" height="20" fill="#ED2939"/></svg>';
    var FLAG_US = '<svg viewBox="0 0 30 20" style="width:24px;height:16px;border:1px solid #ccc;vertical-align:middle;display:inline-block;"><rect width="30" height="20" fill="#B22234"/><rect y="1.54" width="30" height="1.54" fill="#FFF"/><rect y="4.62" width="30" height="1.54" fill="#FFF"/><rect y="7.69" width="30" height="1.54" fill="#FFF"/><rect y="10.77" width="30" height="1.54" fill="#FFF"/><rect y="13.85" width="30" height="1.54" fill="#FFF"/><rect y="16.92" width="30" height="1.54" fill="#FFF"/><rect width="12" height="10.77" fill="#3C3B6E"/><circle cx="2" cy="1.5" r="0.6" fill="#FFF"/><circle cx="4" cy="1.5" r="0.6" fill="#FFF"/><circle cx="6" cy="1.5" r="0.6" fill="#FFF"/><circle cx="8" cy="1.5" r="0.6" fill="#FFF"/><circle cx="10" cy="1.5" r="0.6" fill="#FFF"/><circle cx="3" cy="3" r="0.6" fill="#FFF"/><circle cx="5" cy="3" r="0.6" fill="#FFF"/><circle cx="7" cy="3" r="0.6" fill="#FFF"/><circle cx="9" cy="3" r="0.6" fill="#FFF"/><circle cx="2" cy="4.5" r="0.6" fill="#FFF"/><circle cx="4" cy="4.5" r="0.6" fill="#FFF"/><circle cx="6" cy="4.5" r="0.6" fill="#FFF"/><circle cx="8" cy="4.5" r="0.6" fill="#FFF"/><circle cx="10" cy="4.5" r="0.6" fill="#FFF"/><circle cx="3" cy="6" r="0.6" fill="#FFF"/><circle cx="5" cy="6" r="0.6" fill="#FFF"/><circle cx="7" cy="6" r="0.6" fill="#FFF"/><circle cx="9" cy="6" r="0.6" fill="#FFF"/><circle cx="2" cy="7.5" r="0.6" fill="#FFF"/><circle cx="4" cy="7.5" r="0.6" fill="#FFF"/><circle cx="6" cy="7.5" r="0.6" fill="#FFF"/><circle cx="8" cy="7.5" r="0.6" fill="#FFF"/><circle cx="10" cy="7.5" r="0.6" fill="#FFF"/><circle cx="3" cy="9" r="0.6" fill="#FFF"/><circle cx="5" cy="9" r="0.6" fill="#FFF"/><circle cx="7" cy="9" r="0.6" fill="#FFF"/><circle cx="9" cy="9" r="0.6" fill="#FFF"/></svg>';

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
        '.fg-footer__brand-slogan { font-size: 11px; text-transform: uppercase; letter-spacing: 6px; font-style: italic; font-weight: 900; margin-top: 8px; color: #000000; }',
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
        '.fg-footer__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; padding: 40px 0; }',
        '.fg-footer__col-title { font-family: "Unbounded", cursive; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px 0; color: #000000; }',
        '.fg-footer__col-list { list-style: none; margin: 0; padding: 0; }',
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
        '.fg-footer__lang-dropdown { display: none; position: absolute; bottom: 100%; right: 0; background: #fff; border: 2px solid #000; box-shadow: 4px 4px 0px #000; min-width: 200px; margin-bottom: 4px; z-index: 100; }',
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
        '.fg-footer__accordion summary { font-family: "Unbounded", cursive; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; padding: 16px 0; cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eaeaea; }',
        '.fg-footer__accordion summary::-webkit-details-marker { display: none; }',
        '.fg-footer__accordion summary::after { content: "+"; font-size: 20px; font-weight: 900; color: #FFD700; transition: transform 0.2s; }',
        '.fg-footer__accordion[open] summary::after { content: "\\2212"; }',
        '.fg-footer__accordion .fg-footer__col-list { padding: 12px 0 8px; }',

        /* Tablet: 2 columns */
        '@media (max-width: 900px) {',
        '  .fg-footer__grid { grid-template-columns: repeat(2, 1fr); gap: 24px; }',
        '}',

        /* Mobile */
        '@media (max-width: 640px) {',
        '  .fg-footer__grid { display: none; }',
        '  .fg-footer__accordion { display: block; }',
        '  .fg-footer__brand-name { font-size: 22px; }',
        '  .fg-footer__brand { padding: 32px 0 24px; }',
        '  .fg-footer__bottom-row { flex-direction: column; align-items: center; gap: 12px; }',
        '  .fg-footer__bottom-links { gap: 16px; }',
        '  .fg-footer__lang-dropdown { right: auto; left: 50%; transform: translateX(-50%); }',
        '  .fg-cookie-banner { padding: 24px 16px; }',
        '}'
    ].join('\n');
    document.head.appendChild(style);

    // Colonnes de liens
    var columns = [
        {
            title: 'FA Genesis',
            links: [
                { label: 'Accueil', href: 'index.html' },
                { label: '\u00c0 propos', href: 'a-propos.html' },
                { label: 'Offres', href: 'offres.html' },
                { label: 'FAQ', href: 'index.html#faq' },
                { label: 'Contact', href: 'contact.html' }
            ]
        },
        {
            title: 'Offres',
            links: [
                { label: 'Offres \u00c9tudiants', href: 'offres.html#offres-etudiants' },
                { label: 'Offres Particuliers', href: 'offres.html#offres-particuliers' },
                { label: 'Offres Entreprises', href: 'offres.html#offres-entreprises' },
                { label: 'Devis personnalis\u00e9', href: 'contact.html' }
            ]
        },
        {
            title: 'Espace',
            links: [
                { label: 'Se connecter', href: 'login.html' },
                { label: 'Cr\u00e9er un compte', href: 'register.html' },
                { label: 'Espace client', href: 'dashboard.html' },
                { label: 'Support', href: 'contact.html' }
            ]
        },
        {
            title: 'L\u00e9gal',
            links: [
                { label: 'Conditions g\u00e9n\u00e9rales', href: 'conditions-generales.html' },
                { label: 'Confidentialit\u00e9', href: 'confidentialite.html' },
                { label: 'Mentions l\u00e9gales', href: 'mentions-legales.html' },
                { label: 'R\u00e9clamation', href: 'reclamation.html' }
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

        // Langue sauvegardee
        var currentLang = 'fr';
        try { currentLang = localStorage.getItem('fa_genesis_lang') || 'fr'; } catch(e) {}
        var currentFlag = currentLang === 'en' ? FLAG_US : FLAG_FR;
        var currentLabel = currentLang === 'en' ? 'English' : 'Fran\u00e7ais';

        var html = '<footer class="fg-footer" role="contentinfo">';
        html += '<div class="fg-footer__inner">';

        // A) Branding
        html += '<div class="fg-footer__brand">';
        html += '<p class="fg-footer__brand-name">FA GENESIS</p>';
        html += '<p class="fg-footer__brand-slogan">Build. Launch. Impact.</p>';
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
        html += '<p>Avertissement : FA Genesis propose un accompagnement strat\u00e9gique et p\u00e9dagogique. Aucun r\u00e9sultat n\u2019est garanti. Les livrables et recommandations d\u00e9pendent de l\u2019implication du client.</p>';
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
        html += buildLink('conditions-generales.html', 'CGV');
        html += buildLink('contact.html', 'Contact');
        html += '</div>';

        // Droite : Langue avec drapeaux SVG
        html += '<div class="fg-footer__lang">';
        html += '<button class="fg-footer__lang-btn" id="fg-lang-btn">';
        html += '<span id="fg-lang-flag">' + currentFlag + '</span>';
        html += '<span id="fg-lang-label">' + currentLabel + '</span>';
        html += '<i class="fas fa-chevron-down" style="font-size:10px;margin-left:4px;"></i>';
        html += '</button>';
        html += '<div class="fg-footer__lang-dropdown" id="fg-lang-dropdown">';
        html += '<div class="fg-footer__lang-option' + (currentLang === 'fr' ? ' active' : '') + '" data-lang="fr">';
        html += FLAG_FR + ' <span style="margin-left:4px;">Fran\u00e7ais</span>';
        html += '</div>';
        html += '<div class="fg-footer__lang-option' + (currentLang === 'en' ? ' active' : '') + '" data-lang="en">';
        html += FLAG_US + ' <span style="margin-left:4px;">English</span>';
        html += '</div>';
        html += '</div>';
        html += '</div>';

        html += '</div>'; // bottom-row
        html += '</div>'; // bottom

        html += '</div>'; // inner
        html += '</footer>';

        target.innerHTML = html;

        // === Langue selector logic ===
        var langBtn = document.getElementById('fg-lang-btn');
        var langDropdown = document.getElementById('fg-lang-dropdown');
        var langFlag = document.getElementById('fg-lang-flag');
        var langLabel = document.getElementById('fg-lang-label');

        if (langBtn && langDropdown) {
            langBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                langDropdown.classList.toggle('open');
            });

            var options = langDropdown.querySelectorAll('.fg-footer__lang-option');
            for (var i = 0; i < options.length; i++) {
                options[i].addEventListener('click', function() {
                    var lang = this.getAttribute('data-lang');

                    // Mettre a jour le drapeau et le label
                    if (lang === 'en') {
                        langFlag.innerHTML = FLAG_US;
                        langLabel.textContent = 'English';
                    } else {
                        langFlag.innerHTML = FLAG_FR;
                        langLabel.textContent = 'Fran\u00e7ais';
                    }

                    // Mettre a jour la classe active
                    for (var j = 0; j < options.length; j++) {
                        options[j].classList.remove('active');
                    }
                    this.classList.add('active');

                    // Sauvegarder le choix
                    try { localStorage.setItem('fa_genesis_lang', lang); } catch(e) {}

                    // Fermer le dropdown
                    langDropdown.classList.remove('open');

                    // Traduire la page
                    if (window.FA_i18n && window.FA_i18n.translatePage) {
                        window.FA_i18n.translatePage(lang);
                    }
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

        // Charger i18n.js dynamiquement
        var i18nScript = document.createElement('script');
        i18nScript.src = BASE + 'i18n.js';
        document.body.appendChild(i18nScript);

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
