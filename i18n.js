/**
 * FA GENESIS - Système de traduction FR/EN
 * Traduit dynamiquement le contenu de toutes les pages
 */
(function() {
    'use strict';

    // ========================================
    // DICTIONNAIRE DE TRADUCTIONS
    // ========================================
    var translations = {
        // === NAVIGATION ===
        'Dashboard': 'Dashboard',
        'Livrables': 'Deliverables',
        'Séances': 'Sessions',
        'Mon compte': 'My Account',
        'Déconnexion': 'Log out',
        'Se connecter': 'Log in',
        'Créer un compte': 'Create Account',
        'Inscription': 'Sign Up',
        'Connexion': 'Login',

        // === INDEX / ACCUEIL ===
        'Accueil': 'Home',
        'À propos': 'About',
        'Offres': 'Offers',
        'Contact': 'Contact',
        'FAQ': 'FAQ',
        'TRANSFORMEZ VOTRE IDÉE EN PROJET CONCRET': 'TURN YOUR IDEA INTO A REAL PROJECT',
        'Build. Launch. Impact.': 'Build. Launch. Impact.',
        'Voir les offres': 'View offers',
        'En savoir plus': 'Learn more',
        'Découvrir nos offres': 'Discover our offers',
        'Commencer maintenant': 'Get started',
        'Nous contacter': 'Contact us',
        'Questions Fréquentes': 'Frequently Asked Questions',
        'Tout ce que vous devez savoir sur FA Genesis': 'Everything you need to know about FA Genesis',

        // === OFFRES ===
        'NOS OFFRES': 'OUR OFFERS',
        'Nos Offres': 'Our Offers',
        'Offres Étudiants': 'Student Offers',
        'Offres Particuliers': 'Individual Offers',
        'Offres Entreprises': 'Business Offers',
        'Tarifs Individuels': 'Individual Pricing',
        'Devis personnalisé': 'Custom Quote',
        'Choisir cette offre': 'Choose this offer',
        'Demander un devis': 'Request a quote',
        'À partir de': 'Starting from',
        'par mois': 'per month',
        'Durée': 'Duration',
        'mois': 'months',
        'semaines': 'weeks',
        'séances': 'sessions',
        'Inclus': 'Included',
        'Populaire': 'Popular',

        // === À PROPOS ===
        'À PROPOS': 'ABOUT',
        'Notre Mission': 'Our Mission',
        'Notre Vision': 'Our Vision',
        'Notre Équipe': 'Our Team',
        'Nos Valeurs': 'Our Values',

        // === CONTACT ===
        'CONTACT': 'CONTACT',
        'Contactez-nous': 'Contact Us',
        'Envoyez-nous un message': 'Send us a message',
        'Nom': 'Name',
        'Prénom': 'First Name',
        'Email': 'Email',
        'Téléphone': 'Phone',
        'Sujet': 'Subject',
        'Message': 'Message',
        'Envoyer': 'Send',
        'Envoyer le message': 'Send message',
        'Votre message a été envoyé avec succès': 'Your message has been sent successfully',

        // === DASHBOARD ===
        'Bienvenue': 'Welcome',
        'Votre espace client': 'Your client area',
        'Aperçu de votre accompagnement': 'Overview of your support',
        'Progression': 'Progress',
        'Étape': 'Step',
        'Prochaine étape': 'Next step',
        'Mes livrables': 'My deliverables',
        'Mes séances': 'My sessions',
        'Mon offre': 'My offer',
        'Statut': 'Status',
        'Télécharger': 'Download',
        'Voir tout': 'View all',

        // === LIVRABLES ===
        'MES LIVRABLES': 'MY DELIVERABLES',
        'Mes Livrables': 'My Deliverables',
        'Tous': 'All',
        'En cours': 'In progress',
        'Terminé': 'Completed',
        'En attente': 'Pending',
        'Livré': 'Delivered',
        'Téléchargez vos documents stratégiques': 'Download your strategic documents',

        // === SÉANCES ===
        'MES SÉANCES': 'MY SESSIONS',
        'Mes Séances': 'My Sessions',
        'Votre planning de rendez-vous et visioconférences': 'Your meetings and video conference schedule',
        'Toutes': 'All',
        'À venir': 'Upcoming',
        'Passées': 'Past',
        'Passée': 'Past',
        'Rejoindre la visio': 'Join video call',
        'Aucune séance planifiée': 'No sessions scheduled',
        'Vos prochaines séances apparaîtront ici': 'Your upcoming sessions will appear here',

        // === MON COMPTE ===
        'MON COMPTE': 'MY ACCOUNT',
        'Informations personnelles': 'Personal Information',
        'Modifier': 'Edit',
        'Sauvegarder': 'Save',
        'Annuler': 'Cancel',
        'Changer le mot de passe': 'Change password',
        'Mot de passe actuel': 'Current password',
        'Nouveau mot de passe': 'New password',
        'Confirmer le mot de passe': 'Confirm password',

        // === PAIEMENT ===
        'Paiement': 'Payment',
        'PAIEMENT RÉUSSI': 'PAYMENT SUCCESSFUL',
        'PAIEMENT ANNULÉ': 'PAYMENT CANCELLED',
        'PAIEMENT ÉCHOUÉ': 'PAYMENT FAILED',
        'Payer l\'acompte': 'Pay the deposit',
        'Payer le solde': 'Pay the balance',
        'Acompte de 30%': '30% Deposit',
        'Solde de 70%': '70% Balance',
        'Retour au dashboard': 'Back to dashboard',
        'Retour à l\'accueil': 'Back to home',
        'Réessayer le paiement': 'Retry payment',
        'Voir les offres': 'View offers',

        // === CHECKOUT ===
        'Récapitulatif de votre commande': 'Order Summary',
        'Procéder au paiement': 'Proceed to payment',

        // === LOGIN / REGISTER ===
        'CONNEXION': 'LOGIN',
        'Connectez-vous à votre espace': 'Log in to your account',
        'Adresse email': 'Email address',
        'Mot de passe': 'Password',
        'Se souvenir de moi': 'Remember me',
        'Mot de passe oublié ?': 'Forgot password?',
        'Pas encore de compte ?': 'Don\'t have an account?',
        'Créer un compte gratuitement': 'Create a free account',
        'INSCRIPTION': 'SIGN UP',
        'Créez votre compte': 'Create your account',
        'Déjà un compte ?': 'Already have an account?',

        // === FAQ ===
        'Questions fréquemment posées': 'Frequently Asked Questions',
        'Informations Générales': 'General Information',
        'Qu\'est-ce que FA Genesis ?': 'What is FA Genesis?',
        'À qui s\'adressent vos accompagnements ?': 'Who are your services for?',
        'Est-ce que je dois déjà avoir un projet ?': 'Do I need to already have a project?',
        'Vos services sont-ils adaptés aux étudiants ?': 'Are your services suitable for students?',
        'Comment se déroule l\'accompagnement ?': 'How does the support process work?',
        'Combien coûtent vos accompagnements ?': 'How much do your services cost?',
        'Est-ce que je peux payer en plusieurs fois ?': 'Can I pay in installments?',
        'Est-ce que vous garantissez la réussite du projet ?': 'Do you guarantee project success?',
        'Est-ce que vous faites des offres sur mesure ?': 'Do you offer custom packages?',
        'Comment vous contacter ?': 'How can I contact you?',
        'Combien de temps dure un accompagnement ?': 'How long does the support last?',
        'Est-ce que vous travaillez avec des partenaires ?': 'Do you work with partners?',

        // === FOOTER ===
        'Avertissement : FA Genesis propose un accompagnement stratégique et pédagogique. Aucun résultat n\u2019est garanti. Les livrables et recommandations dépendent de l\u2019implication du client.':
            'Disclaimer: FA Genesis provides strategic and educational support. No results are guaranteed. Deliverables and recommendations depend on client involvement.',
        'Groupe FA Industries': 'FA Industries Group',
        'Conditions générales': 'Terms & Conditions',
        'Confidentialité': 'Privacy Policy',
        'Mentions légales': 'Legal Notice',
        'Réclamation': 'Complaints',
        'Espace client': 'Client Area',
        'Support': 'Support',
        'Tous droits réservés': 'All rights reserved',
        'Cookies': 'Cookies',
        'CGV': 'T&C',
        'Espace': 'Account',
        'Légal': 'Legal',

        // === COOKIES BANNER ===
        'Gestion des cookies': 'Cookie Settings',
        'Ce site utilise uniquement des cookies techniques nécessaires au fonctionnement du service (authentification, session). Aucun cookie publicitaire ou de tracking n\u2019est utilisé.':
            'This site only uses technical cookies necessary for the service to function (authentication, session). No advertising or tracking cookies are used.',
        'J\'ai compris': 'I understand',
        'En savoir plus sur notre politique de confidentialité': 'Learn more about our privacy policy',

        // === PAGES LÉGALES ===
        'Conditions Générales de Vente': 'General Terms and Conditions',
        'Politique de Confidentialité': 'Privacy Policy',
        'Mentions Légales': 'Legal Notice',
        'Réclamation': 'Complaints',
        'Retour au site': 'Back to site',
        'Dernière mise à jour': 'Last updated',

        // === COMMUN ===
        'Chargement': 'Loading',
        'Erreur': 'Error',
        'Succès': 'Success',
        'Fermer': 'Close',
        'Oui': 'Yes',
        'Non': 'No',
        'ou': 'or',
        'et': 'and',
        'de': 'of',
        'Besoin d\'aide ?': 'Need help?'
    };

    // ========================================
    // STOCKAGE DES TEXTES ORIGINAUX
    // ========================================
    var originalTexts = [];
    var isTranslated = false;

    // ========================================
    // FONCTION : Traduire un texte
    // ========================================
    function translate(text) {
        if (!text) return text;
        var trimmed = text.trim();
        if (translations[trimmed]) return text.replace(trimmed, translations[trimmed]);
        return null;
    }

    // ========================================
    // FONCTION : Parcourir le DOM et traduire
    // ========================================
    function translatePage(lang) {
        if (lang === 'fr') {
            restoreOriginal();
            return;
        }

        if (lang === 'en') {
            if (!isTranslated) {
                collectAndTranslate();
            }
        }
    }

    function collectAndTranslate() {
        originalTexts = [];
        var walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        var textNodes = [];
        var node;
        while (node = walker.nextNode()) {
            if (node.nodeValue && node.nodeValue.trim().length > 0) {
                // Ignorer les scripts et styles
                var parent = node.parentNode;
                if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.tagName === 'NOSCRIPT')) continue;
                textNodes.push(node);
            }
        }

        for (var i = 0; i < textNodes.length; i++) {
            var original = textNodes[i].nodeValue;
            var translated = translate(original);
            if (translated && translated !== original) {
                originalTexts.push({ node: textNodes[i], original: original });
                textNodes[i].nodeValue = translated;
            }
        }

        // Traduire les placeholders
        var inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]');
        for (var j = 0; j < inputs.length; j++) {
            var ph = inputs[j].getAttribute('placeholder');
            if (ph && translations[ph.trim()]) {
                originalTexts.push({ node: inputs[j], attr: 'placeholder', original: ph });
                inputs[j].setAttribute('placeholder', translations[ph.trim()]);
            }
        }

        // Traduire les title de page
        var titleText = document.title;
        if (titleText) {
            originalTexts.push({ node: document, attr: 'title', original: titleText });
            var newTitle = titleText;
            for (var key in translations) {
                if (translations.hasOwnProperty(key) && newTitle.indexOf(key) !== -1) {
                    newTitle = newTitle.replace(key, translations[key]);
                }
            }
            if (newTitle.indexOf('Espace Client') !== -1) newTitle = newTitle.replace('Espace Client', 'Client Area');
            if (newTitle.indexOf('Mes Séances') !== -1) newTitle = newTitle.replace('Mes Séances', 'My Sessions');
            if (newTitle.indexOf('Mes Livrables') !== -1) newTitle = newTitle.replace('Mes Livrables', 'My Deliverables');
            document.title = newTitle;
        }

        // Traduire les boutons (value)
        var buttons = document.querySelectorAll('input[type="submit"], input[type="button"]');
        for (var b = 0; b < buttons.length; b++) {
            var val = buttons[b].value;
            if (val && translations[val.trim()]) {
                originalTexts.push({ node: buttons[b], attr: 'value', original: val });
                buttons[b].value = translations[val.trim()];
            }
        }

        isTranslated = true;
    }

    function restoreOriginal() {
        for (var i = 0; i < originalTexts.length; i++) {
            var item = originalTexts[i];
            if (item.attr === 'title') {
                document.title = item.original;
            } else if (item.attr === 'placeholder') {
                item.node.setAttribute('placeholder', item.original);
            } else if (item.attr === 'value') {
                item.node.value = item.original;
            } else {
                item.node.nodeValue = item.original;
            }
        }
        originalTexts = [];
        isTranslated = false;
    }

    // ========================================
    // EXPOSER L'API GLOBALE
    // ========================================
    window.FA_i18n = {
        translatePage: translatePage,
        translations: translations,
        getCurrentLang: function() {
            try { return localStorage.getItem('fa_genesis_lang') || 'fr'; } catch(e) { return 'fr'; }
        }
    };

    // ========================================
    // AUTO-TRADUCTION AU CHARGEMENT
    // ========================================
    function autoTranslate() {
        try {
            var savedLang = localStorage.getItem('fa_genesis_lang');
            if (savedLang && savedLang !== 'fr') {
                translatePage(savedLang);
            }
        } catch(e) {}
    }

    // Attendre que le DOM + footer soient chargés
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            // Petit délai pour laisser footer.js injecter le footer
            setTimeout(autoTranslate, 200);
        });
    } else {
        setTimeout(autoTranslate, 200);
    }
})();
