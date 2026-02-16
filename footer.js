/**
 * FA GENESIS - Footer Component
 * Composant footer réutilisable injecté sur toutes les pages
 */
(function() {
    'use strict';

    // Base path pour GitHub Pages (racine relative)
    var BASE = '';

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
        '.fg-footer__bottom { padding: 24px 0; text-align: center; }',
        '.fg-footer__copyright { font-size: 12px; color: #000000; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px 0; }',
        '.fg-footer__copyright strong { color: #000000; }',
        '.fg-footer__bottom-links { display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; }',
        '.fg-footer__bottom-links a { font-size: 12px; color: #000000; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }',
        '.fg-footer__bottom-links a:hover { color: #000000; }',

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

        /* Mobile: accordions */
        '@media (max-width: 640px) {',
        '  .fg-footer__grid { display: none; }',
        '  .fg-footer__accordion { display: block; }',
        '  .fg-footer__brand-name { font-size: 22px; }',
        '  .fg-footer__brand { padding: 32px 0 24px; }',
        '  .fg-footer__bottom-links { gap: 16px; }',
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
                { label: 'FAQ', href: 'faq.html' },
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
                { label: 'Conditions g\u00e9n\u00e9rales', href: 'contact.html' },
                { label: 'Confidentialit\u00e9', href: 'contact.html' },
                { label: 'Mentions l\u00e9gales', href: 'contact.html' },
                { label: 'R\u00e9clamation', href: 'contact.html' }
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

    function renderFooter() {
        var target = document.getElementById('site-footer');
        if (!target) return;

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
        html += '<div class="fg-footer__bottom-links">';
        html += buildLink('contact.html', 'Confidentialit\u00e9');
        html += buildLink('contact.html', 'CGV');
        html += buildLink('contact.html', 'Contact');
        html += '</div>';
        html += '</div>';

        html += '</div>'; // inner
        html += '</footer>';

        target.innerHTML = html;
    }

    // Executer au chargement du DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderFooter);
    } else {
        renderFooter();
    }
})();
