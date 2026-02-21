// nav-global.js - Navigation globale FA GENESIS
// Gere le bouton "Espace client" / "Mon compte" selon l'etat de connexion
// Inclure ce script sur toutes les pages publiques APRES auth.js (ou standalone)

(function() {
    'use strict';

    /**
     * Recuperer l'utilisateur connecte depuis localStorage
     */
    function getUser() {
        try {
            var session = localStorage.getItem('fa_genesis_session');
            var token = localStorage.getItem('fa_genesis_token');
            if (!session || !token) return null;
            return JSON.parse(session);
        } catch (e) {
            return null;
        }
    }

    /**
     * Deconnexion (appelle logout() si dispo, sinon fait le minimum)
     */
    function doLogout() {
        if (typeof logout === 'function') {
            logout();
            return;
        }
        // Fallback si auth.js non charge
        localStorage.removeItem('fa_genesis_session');
        localStorage.removeItem('fa_genesis_token');
        window.location.href = 'login.html';
    }

    /**
     * Ferme tous les dropdowns ouverts
     */
    function closeAllDropdowns() {
        var menus = document.querySelectorAll('.nav-compte-dropdown');
        for (var i = 0; i < menus.length; i++) {
            menus[i].style.display = 'none';
        }
    }

    /**
     * Creer le bouton "Mon compte" avec dropdown (desktop)
     */
    function createDesktopDropdown(user) {
        var prenom = user.prenom || user.firstName || 'Client';

        var wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';

        // Bouton principal
        var btn = document.createElement('button');
        btn.className = 'border-4 border-[var(--genesis-yellow)] text-[var(--genesis-yellow)] px-6 py-3 text-[12px] tracking-widest font-black hover:bg-[var(--genesis-yellow)] hover:text-black transition uppercase';
        btn.innerHTML = '<i class="fas fa-user" style="margin-right:6px;"></i>Mon compte';
        btn.type = 'button';
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-haspopup', 'true');

        // Menu deroulant
        var dropdown = document.createElement('div');
        dropdown.className = 'nav-compte-dropdown';
        dropdown.style.cssText = 'display:none;position:absolute;top:100%;right:0;margin-top:8px;'
            + 'background:#000;border:4px solid var(--genesis-yellow);min-width:260px;z-index:9999;'
            + 'box-shadow:6px 6px 0 var(--genesis-yellow);';

        // Contenu du dropdown
        var items = [
            { label: 'Bonjour ' + prenom + ' !', href: null, icon: 'fa-hand-wave', isGreeting: true },
            { label: 'Mon espace client', href: 'dashboard.html', icon: 'fa-tachometer-alt' },
            { label: 'Mes projets / commandes', href: 'dashboard.html#commandes', icon: 'fa-folder-open' },
            { label: 'Mes paiements', href: 'payment.html', icon: 'fa-credit-card' },
            { label: 'Mon compte', href: 'mon-compte.html', icon: 'fa-user-cog' },
            { label: 'Se d\u00e9connecter', href: 'logout', icon: 'fa-sign-out-alt', isLogout: true }
        ];

        var html = '';
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.isGreeting) {
                html += '<div style="padding:12px 16px;color:var(--genesis-yellow);font-weight:900;'
                    + 'font-size:13px;text-transform:uppercase;border-bottom:2px solid var(--genesis-yellow);'
                    + 'letter-spacing:0.05em;">'
                    + '<i class="fas ' + item.icon + '" style="margin-right:8px;"></i>'
                    + item.label + '</div>';
            } else if (item.isLogout) {
                html += '<a href="#" class="nav-dropdown-logout" style="display:block;padding:12px 16px;'
                    + 'color:#f44336;font-weight:900;font-size:12px;text-transform:uppercase;'
                    + 'text-decoration:none;transition:background 0.2s;letter-spacing:0.05em;'
                    + 'border-top:2px solid #333;">'
                    + '<i class="fas ' + item.icon + '" style="margin-right:8px;"></i>'
                    + item.label + '</a>';
            } else {
                html += '<a href="' + item.href + '" style="display:block;padding:12px 16px;'
                    + 'color:#fff;font-weight:900;font-size:12px;text-transform:uppercase;'
                    + 'text-decoration:none;transition:background 0.2s;letter-spacing:0.05em;"'
                    + ' onmouseover="this.style.background=\'var(--genesis-yellow)\';this.style.color=\'#000\';"'
                    + ' onmouseout="this.style.background=\'transparent\';this.style.color=\'#fff\';">'
                    + '<i class="fas ' + item.icon + '" style="margin-right:8px;"></i>'
                    + item.label + '</a>';
            }
        }

        dropdown.innerHTML = html;

        // Event: click sur le bouton toggle
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var isOpen = dropdown.style.display !== 'none';
            closeAllDropdowns();
            if (!isOpen) {
                dropdown.style.display = 'block';
                btn.setAttribute('aria-expanded', 'true');
            } else {
                btn.setAttribute('aria-expanded', 'false');
            }
        });

        wrapper.appendChild(btn);
        wrapper.appendChild(dropdown);

        // Event: logout
        setTimeout(function() {
            var logoutLink = dropdown.querySelector('.nav-dropdown-logout');
            if (logoutLink) {
                logoutLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    doLogout();
                });
            }
        }, 0);

        return wrapper;
    }

    /**
     * Mettre a jour le menu mobile selon l'etat de connexion
     */
    function updateMobileMenu(user) {
        var mobileMenu = document.getElementById('mobileMenu');
        if (!mobileMenu) return;

        // Trouver le lien "Espace client" dans le menu mobile
        var links = mobileMenu.querySelectorAll('a');
        var espaceClientLink = null;
        var espaceClientParent = null;

        for (var i = 0; i < links.length; i++) {
            if (links[i].textContent.trim() === 'Espace client') {
                espaceClientLink = links[i];
                espaceClientParent = links[i].parentElement;
                break;
            }
        }

        if (!user) return; // Non connecte: garder "Espace client" tel quel

        var prenom = user.prenom || user.firstName || 'Client';

        if (espaceClientLink && espaceClientParent) {
            // Remplacer par les liens du compte
            var mobileAccountHTML = ''
                + '<div style="text-align:center;color:var(--genesis-yellow);font-weight:900;'
                + 'font-size:14px;text-transform:uppercase;margin-bottom:8px;">'
                + '<i class="fas fa-hand-wave" style="margin-right:6px;"></i>Bonjour ' + prenom + ' !</div>'
                + '<a href="dashboard.html" class="border-4 border-[var(--genesis-yellow)] text-[var(--genesis-yellow)] '
                + 'px-8 py-4 text-sm tracking-widest font-black hover:bg-[var(--genesis-yellow)] hover:text-black '
                + 'transition text-center block" style="margin-bottom:8px;">'
                + '<i class="fas fa-tachometer-alt" style="margin-right:6px;"></i>Mon espace client</a>'
                + '<a href="payment.html" class="border-4 border-white text-white '
                + 'px-8 py-4 text-sm tracking-widest font-black hover:bg-white hover:text-black '
                + 'transition text-center block" style="margin-bottom:8px;">'
                + '<i class="fas fa-credit-card" style="margin-right:6px;"></i>Mes paiements</a>'
                + '<a href="mon-compte.html" class="border-4 border-white text-white '
                + 'px-8 py-4 text-sm tracking-widest font-black hover:bg-white hover:text-black '
                + 'transition text-center block" style="margin-bottom:8px;">'
                + '<i class="fas fa-user-cog" style="margin-right:6px;"></i>Mon compte</a>'
                + '<a href="#" class="nav-mobile-logout border-4 border-[#f44336] text-[#f44336] '
                + 'px-8 py-4 text-sm tracking-widest font-black hover:bg-[#f44336] hover:text-white '
                + 'transition text-center block">'
                + '<i class="fas fa-sign-out-alt" style="margin-right:6px;"></i>Se d\u00e9connecter</a>';

            // Remplacer le contenu du parent (div.flex.flex-col qui contient Espace client + Lancer un projet)
            // Garder le bouton "Lancer un projet"
            var lancerProjetLink = null;
            var parentLinks = espaceClientParent.querySelectorAll('a');
            for (var j = 0; j < parentLinks.length; j++) {
                if (parentLinks[j].textContent.trim().indexOf('Lancer') !== -1) {
                    lancerProjetLink = parentLinks[j].cloneNode(true);
                    break;
                }
            }

            espaceClientParent.innerHTML = mobileAccountHTML;

            if (lancerProjetLink) {
                espaceClientParent.appendChild(lancerProjetLink);
            }

            // Attacher event logout mobile
            var mobileLogout = espaceClientParent.querySelector('.nav-mobile-logout');
            if (mobileLogout) {
                mobileLogout.addEventListener('click', function(e) {
                    e.preventDefault();
                    doLogout();
                });
            }
        }
    }

    /**
     * Point d'entree principal
     */
    function initNavGlobal() {
        var user = getUser();

        // === DESKTOP ===
        // Trouver le lien "Espace client" dans la nav desktop
        var nav = document.querySelector('nav');
        if (!nav) return;

        var desktopBtns = nav.querySelectorAll('.hidden.md\\:flex a, .hidden.md\\:flex button');
        var espaceClientDesktop = null;

        for (var i = 0; i < desktopBtns.length; i++) {
            var text = desktopBtns[i].textContent.trim();
            if (text === 'Espace client') {
                espaceClientDesktop = desktopBtns[i];
                break;
            }
        }

        if (user && espaceClientDesktop) {
            // Utilisateur connecte: remplacer "Espace client" par dropdown "Mon compte"
            var dropdown = createDesktopDropdown(user);
            espaceClientDesktop.parentNode.replaceChild(dropdown, espaceClientDesktop);
        }

        // === MOBILE ===
        updateMobileMenu(user);

        // === Fermer dropdown au clic exterieur ===
        document.addEventListener('click', function() {
            closeAllDropdowns();
        });
    }

    // Lancer au chargement
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNavGlobal);
    } else {
        initNavGlobal();
    }

})();
