// ============================================================
// FA GENESIS - Chatbot IA Guide v2
// Widget auto-contenu (CSS + HTML + logique)
// Icone robot + orthographe corrigee + couverture complete
// ============================================================
(function() {
    'use strict';

    // ============================================================
    // A) CONFIGURATION
    // ============================================================
    var CHATBOT_CONFIG = {
        botName: 'Genesis Bot',
        welcomeMessage: 'Bonjour \u{1F44B} ! Je suis l\u2019assistant virtuel de FA Genesis. Comment puis-je vous aider aujourd\u2019hui ?',
        apiBaseUrl: (typeof window !== 'undefined' && window.FA_GENESIS_API) ? window.FA_GENESIS_API : 'https://fa-genesis-website.onrender.com',
        typingDelay: 800,
        escalationThreshold: 2
    };

    var unmatchedCount = 0;
    var chatInitialized = false;
    var isOpen = false;

    // ============================================================
    // B) BASE DE CONNAISSANCES
    // ============================================================
    var KNOWLEDGE_BASE = [

        // ===================== GENERAL =====================
        {
            id: 'what_is_fa_genesis',
            category: 'general',
            keywords: ['c\'est quoi', 'qu\'est-ce que', 'qu est ce', 'financial advice', 'fa genesis', 'genesis c\'est', 'qui etes', 'qui vous', 'c est quoi', 'votre entreprise', 'votre societe', 'presentez', 'a propos'],
            response: 'Financial Advice Genesis est une plateforme qui met en relation des clients avec des prestataires ind\u00e9pendants (photographes, vid\u00e9astes, sp\u00e9cialistes marketing, professionnels m\u00e9dia...) pour donner vie \u00e0 leurs projets. Le paiement est s\u00e9curis\u00e9 gr\u00e2ce \u00e0 GENESIS SAFE\u2122.',
            quickReplies: ['Voir les prestations', 'Comment \u00e7a marche ?', 'Contacter l\u2019\u00e9quipe'],
            link: null
        },
        {
            id: 'who_is_it_for',
            category: 'general',
            keywords: ['pour qui', 'a qui', 's\'adresse', 'cible', 'public', 'porteur de projet', 'jeune'],
            response: 'La plateforme s\u2019adresse \u00e0 toute personne ayant besoin d\u2019une prestation (photo, vid\u00e9o, marketing, m\u00e9dia...) : \u00e9tudiants, porteurs de projets, particuliers ou entreprises. Vous explorez l\u2019annuaire de prestataires ind\u00e9pendants et r\u00e9servez directement celui qui correspond \u00e0 votre besoin.',
            quickReplies: ['Voir les prestations', 'Comment \u00e7a marche ?'],
            link: null
        },
        {
            id: 'no_project_yet',
            category: 'general',
            keywords: ['pas de projet', 'pas encore', 'juste une idee', 'je sais pas', 'commencer', 'debuter', 'je ne sais pas par ou', 'je debute', 'aucune idee', 'pas d\'idee'],
            response: 'Pas de souci ! Vous n\u2019avez pas besoin d\u2019un projet tout pr\u00eat pour explorer nos prestataires. Parcourez l\u2019annuaire par cat\u00e9gorie, ou contactez notre \u00e9quipe si vous voulez qu\u2019on vous aide \u00e0 identifier la prestation la plus adapt\u00e9e \u00e0 votre besoin.',
            quickReplies: ['Voir les prestations', 'Contacter l\u2019\u00e9quipe'],
            link: null
        },
        {
            id: 'about_partners',
            category: 'general',
            keywords: ['partenaire', 'photographe', 'videast', 'collaboration', 'travaillez avec'],
            response: 'Oui, notre plateforme r\u00e9unit des photographes, vid\u00e9astes, sp\u00e9cialistes marketing et professionnels m\u00e9dia ind\u00e9pendants. Chaque prestataire est v\u00e9rifi\u00e9 par notre \u00e9quipe avant d\u2019appara\u00eetre dans l\u2019annuaire.',
            quickReplies: [],
            link: null
        },
        {
            id: 'student_adapted',
            category: 'general',
            keywords: ['adapte etudiant', 'prix etudiant', 'budget etudiant', 'abordable', 'pas cher', 'accessible', 'etudiant'],
            response: 'Chaque prestataire fixe librement son tarif selon votre projet \u2014 il n\u2019y a pas de grille tarifaire impos\u00e9e. Demandez un devis pour conna\u00eetre le tarif adapt\u00e9 \u00e0 votre budget, ou comparez les profils de prestataires dans l\u2019annuaire.',
            quickReplies: ['Voir les prestations'],
            link: { url: 'offres.html', label: 'Voir les prestations' }
        },
        {
            id: 'location',
            category: 'general',
            keywords: ['ou etes vous', 'localisation', 'adresse', 'ville', 'situe', 'ou se trouve', 'en ligne', 'presentiel', 'distance', 'distanciel'],
            response: 'Les prestataires de notre plateforme interviennent partout en France, en ligne comme en pr\u00e9sentiel selon la prestation (les shootings photo/vid\u00e9o se font g\u00e9n\u00e9ralement en pr\u00e9sentiel, les prestations marketing/m\u00e9dia \u00e0 distance). Le profil de chaque prestataire pr\u00e9cise sa zone d\u2019intervention.',
            quickReplies: ['Voir les prestations'],
            link: null
        },
        {
            id: 'difference_vs_others',
            category: 'general',
            keywords: ['difference', 'pourquoi vous', 'avantage', 'concurrent', 'mieux', 'unique', 'special'],
            response: 'Ce qui distingue FA Genesis, c\u2019est la s\u00e9curit\u00e9 du paiement : gr\u00e2ce \u00e0 GENESIS SAFE\u2122, votre carte est autoris\u00e9e \u00e0 la r\u00e9servation mais l\u2019argent n\u2019est vers\u00e9 au prestataire qu\u2019une fois la prestation valid\u00e9e. Vous ne risquez jamais de payer pour un service jamais livr\u00e9. Tous nos prestataires sont v\u00e9rifi\u00e9s avant d\u2019appara\u00eetre sur la plateforme.',
            quickReplies: ['Voir les prestations', 'Comment \u00e7a marche ?'],
            link: null
        },

        // ===================== OFFRES =====================
        {
            id: 'offers_overview',
            category: 'offres',
            keywords: ['offre', 'offres', 'formule', 'forfait', 'pack', 'programme', 'quelles offres', 'vos offres', 'quelles sont vos offres', 'vos services', 'vos prestations', 'proposez', 'tarif', 'tarifs', 'prix', 'offres et tarifs', 'combien coute', 'catalogue', 'grille tarifaire', 'liste offres'],
            response: 'Notre plateforme r\u00e9unit des prestataires ind\u00e9pendants dans plusieurs cat\u00e9gories : PHOTO, VID\u00c9O, MARKETING et M\u00c9DIA. Chaque prestataire fixe librement son propre tarif selon votre projet \u2014 il n\u2019y a pas de prix impos\u00e9 par FA Genesis. Demandez un devis personnalis\u00e9 ou parcourez l\u2019annuaire pour comparer les profils et leurs tarifs.',
            quickReplies: ['Voir les prestations', 'Tarifs individuels'],
            link: { url: 'offres.html', label: 'Voir toutes les prestations' }
        },
        {
            id: 'individual_services',
            category: 'offres',
            keywords: ['prestation individuelle', 'service individuel', 'tarif individuel', 'tarifs individuels', 'a la carte', 'prestation seule', 'juste photo', 'juste video', 'juste marketing', 'tarif prestation', 'prix prestation'],
            response: 'Voici nos cat\u00e9gories de prestations : PHOTO, VID\u00c9O, MARKETING et M\u00c9DIA. Pour toutes, le tarif d\u00e9pend du prestataire et du projet \u2014 chaque prestataire fixe librement son propre tarif. Demandez un devis personnalis\u00e9 via le formulaire de contact, ou choisissez directement un prestataire dans l\u2019annuaire au tarif qu\u2019il affiche.',
            quickReplies: ['Voir les prestations', 'Demander un devis'],
            link: { url: 'offres.html#offres', label: 'Voir les prestations' }
        },
        {
            id: 'custom_offer',
            category: 'offres',
            keywords: ['sur mesure', 'custom', 'personnalise', 'specifique', 'adapte', 'podcast', 'besoin particulier', 'devis'],
            response: 'Oui, de nombreux prestataires proposent des devis sur mesure pour des besoins sp\u00e9cifiques (podcast, projet particulier, entreprise, etc.). Vous pouvez le demander directement au prestataire, ou nous contacter pour qu\u2019on vous oriente vers le bon profil.',
            quickReplies: ['Contacter l\u2019\u00e9quipe', 'Voir les prestations'],
            link: { url: 'contact.html', label: 'Demander un devis' }
        },
        {
            id: 'choose_offer',
            category: 'offres',
            keywords: ['quelle offre choisir', 'laquelle', 'choisir', 'conseiller', 'recommander', 'hesiter', 'meilleure offre', 'je ne sais pas quelle', 'quelle formule', 'quel prestataire'],
            response: 'Le choix d\u00e9pend de votre besoin : photo, vid\u00e9o, marketing ou m\u00e9dia. Retrouvez le d\u00e9tail de chaque cat\u00e9gorie sur la page prestations. Si vous h\u00e9sitez, contactez notre \u00e9quipe : elle vous orientera vers la prestation la plus adapt\u00e9e.',
            quickReplies: ['Voir les prestations', 'Contacter l\u2019\u00e9quipe'],
            link: null
        },

        // ===================== PAIEMENT =====================
        {
            id: 'payment_how',
            category: 'paiement',
            keywords: ['payer', 'paiement', 'prix', 'combien', 'cout', 'tarif', 'comment payer', 'moyen de paiement', 'combien ca coute', 'carte bancaire', 'virement'],
            response: 'Selon la prestation, le paiement est int\u00e9gral \u00e0 la r\u00e9servation ou en acompte + solde. Le paiement s\u2019effectue par carte bancaire (ou PayPal) de mani\u00e8re s\u00e9curis\u00e9e : gr\u00e2ce \u00e0 GENESIS SAFE\u2122, votre carte est autoris\u00e9e \u00e0 la r\u00e9servation mais l\u2019argent n\u2019est d\u00e9bit\u00e9 qu\u2019une fois la prestation valid\u00e9e.',
            quickReplies: ['Payer en plusieurs fois ?', 'Voir les prestations'],
            link: { url: 'offres.html', label: 'Voir les prestations' }
        },
        {
            id: 'payment_installments',
            category: 'paiement',
            keywords: ['plusieurs fois', 'echelon', 'facilite', 'mensualite', 'etaler', 'en 2 fois', 'en 3 fois', 'en 4 fois', 'echelonne'],
            response: 'Oui, le paiement en plusieurs fois est possible sur certaines prestations (jusqu\u2019\u00e0 8 versements selon le cas) \u2014 c\u2019est indiqu\u00e9 directement au moment de la r\u00e9servation. Contactez notre \u00e9quipe si vous avez une question sur les modalit\u00e9s d\u2019une prestation en particulier.',
            quickReplies: ['Contacter l\u2019\u00e9quipe', 'Voir les prestations'],
            link: null
        },
        {
            id: 'deposit_balance',
            category: 'paiement',
            keywords: ['acompte', 'solde', '30%', '70%', 'reste a payer', 'premier paiement', 'depot'],
            response: 'Selon la prestation, le paiement peut se faire int\u00e9gralement \u00e0 la r\u00e9servation, ou en acompte + solde (le solde \u00e9tant d\u00fb \u00e0 la livraison). Dans tous les cas, gr\u00e2ce \u00e0 GENESIS SAFE\u2122, l\u2019argent reste s\u00e9curis\u00e9 et n\u2019est vers\u00e9 au prestataire qu\u2019apr\u00e8s validation de la prestation par vos soins.',
            quickReplies: ['Voir les prestations'],
            link: null
        },
        {
            id: 'refund',
            category: 'paiement',
            keywords: ['remboursement', 'rembourser', 'annuler', 'annulation', 'resilier', 'resiliation', 'retractation'],
            response: 'Pour toute question concernant un remboursement ou une annulation, nous vous invitons \u00e0 contacter directement notre \u00e9quipe. Chaque situation est \u00e9tudi\u00e9e au cas par cas, et nous ferons de notre mieux pour trouver une solution adapt\u00e9e.',
            quickReplies: ['Contacter l\u2019\u00e9quipe'],
            link: { url: 'contact.html', label: 'Contacter l\u2019\u00e9quipe' }
        },
        {
            id: 'payment_security',
            category: 'paiement',
            keywords: ['securise', 'securite', 'fiable', 'confiance', 'arnaque', 'serieux', 'sur'],
            response: 'Votre s\u00e9curit\u00e9 est notre priorit\u00e9. Les paiements sont trait\u00e9s via Stripe, une plateforme certifi\u00e9e, et prot\u00e9g\u00e9s par GENESIS SAFE\u2122 : l\u2019argent n\u2019est vers\u00e9 au prestataire qu\u2019apr\u00e8s validation de la prestation par le client. Vos donn\u00e9es bancaires ne sont jamais stock\u00e9es sur nos serveurs.',
            quickReplies: ['Voir les prestations'],
            link: null
        },

        // ===================== ESPACE CLIENT =====================
        {
            id: 'client_area',
            category: 'espace_client',
            keywords: ['espace client', 'mon compte', 'mon espace', 'tableau de bord', 'dashboard', 'connexion', 'se connecter', 'connecter', 'login'],
            response: 'Votre espace client vous permet de suivre vos commandes, \u00e9changer avec vos prestataires et acc\u00e9der \u00e0 vos livrables. Pour vous connecter, rendez-vous sur la page de connexion.',
            quickReplies: [],
            link: { url: 'login.html', label: 'Se connecter' }
        },
        {
            id: 'create_account',
            category: 'espace_client',
            keywords: ['creer compte', 'inscription', 's\'inscrire', 'nouveau compte', 'register', 'enregistrer', 'ouvrir compte'],
            response: 'Pour cr\u00e9er votre compte, rendez-vous sur la page d\u2019inscription. Vous aurez besoin de vos informations personnelles, puis vous pourrez directement r\u00e9server une prestation aupr\u00e8s du prestataire de votre choix.',
            quickReplies: [],
            link: { url: 'register.html', label: 'Cr\u00e9er un compte' }
        },
        {
            id: 'documents',
            category: 'espace_client',
            keywords: ['document', 'livrable', 'fichier', 'telecharger', 'pdf', 'livraison', 'telechargement'],
            response: 'Vos documents et livrables sont accessibles depuis votre espace client, dans le d\u00e9tail de chaque commande. Les livrables (photos, vid\u00e9os, fichiers...) sont disponibles au t\u00e9l\u00e9chargement une fois la prestation valid\u00e9e.',
            quickReplies: [],
            link: { url: 'login.html', label: 'Acc\u00e9der \u00e0 mes documents' }
        },
        {
            id: 'password_issue',
            category: 'espace_client',
            keywords: ['mot de passe', 'oublie', 'mdp', 'password', 'mot de passe oublie', 'reinitialiser', 'changer mot de passe', 'connexion impossible'],
            response: 'Si vous avez oubli\u00e9 votre mot de passe ou si vous rencontrez des difficult\u00e9s de connexion, veuillez contacter notre \u00e9quipe. Nous vous aiderons \u00e0 r\u00e9cup\u00e9rer l\u2019acc\u00e8s \u00e0 votre compte rapidement.',
            quickReplies: ['Contacter l\u2019\u00e9quipe'],
            link: { url: 'contact.html', label: 'Contacter le support' }
        },
        {
            id: 'sessions_booking',
            category: 'espace_client',
            keywords: ['seance', 'rendez-vous', 'rdv', 'planifier', 'calendrier', 'booking', 'reservation', 'planning', 'prochain rendez-vous'],
            response: 'La date de votre prestation se convient directement avec le prestataire, via la messagerie de votre espace client. Vous retrouvez vos rendez-vous et r\u00e9servations dans la section correspondante.',
            quickReplies: ['Contacter l\u2019\u00e9quipe'],
            link: { url: 'login.html', label: 'Voir mes r\u00e9servations' }
        },
        {
            id: 'technical_issue',
            category: 'espace_client',
            keywords: ['bug', 'probleme', 'erreur', 'ne marche pas', 'ne fonctionne pas', 'page blanche', 'technique', 'bloque'],
            response: 'Si vous rencontrez un probl\u00e8me technique sur le site ou dans votre espace client, essayez de rafra\u00eechir la page avec Ctrl+Maj+R (ou Cmd+Maj+R sur Mac). Si le probl\u00e8me persiste, contactez notre \u00e9quipe en d\u00e9crivant le souci rencontr\u00e9.',
            quickReplies: ['Contacter l\u2019\u00e9quipe'],
            link: { url: 'contact.html', label: 'Signaler un probl\u00e8me' }
        },
        {
            id: 'account_management',
            category: 'espace_client',
            keywords: ['modifier profil', 'changer email', 'supprimer compte', 'desactiver', 'modifier informations', 'mettre a jour'],
            response: 'Vous pouvez g\u00e9rer vos informations personnelles depuis la section \u00ab Mon compte \u00bb de votre espace client. Pour supprimer ou d\u00e9sactiver votre compte, rendez-vous \u00e9galement dans cette section.',
            quickReplies: [],
            link: { url: 'login.html', label: 'Acc\u00e9der \u00e0 mon compte' }
        },

        // ===================== CONTACT =====================
        {
            id: 'how_to_contact',
            category: 'contact',
            keywords: ['contacter', 'contact', 'joindre', 'ecrire', 'email', 'mail', 'telephone', 'appeler', 'message', 'numero'],
            response: 'Vous pouvez nous contacter de plusieurs fa\u00e7ons :\n\n\u2022 Par e-mail : contact@fagenesis.com\n\u2022 Par t\u00e9l\u00e9phone : +33 7 64 16 36 09\n\u2022 Via le formulaire de contact sur notre site\n\u2022 Par message sur nos r\u00e9seaux sociaux\n\nHoraires : du lundi au vendredi, de 9 h \u00e0 18 h.',
            quickReplies: [],
            link: { url: 'contact.html', label: 'Formulaire de contact' }
        },
        {
            id: 'social_media',
            category: 'contact',
            keywords: ['instagram', 'linkedin', 'tiktok', 'reseaux sociaux', 'reseau', 'social', 'insta'],
            response: 'Retrouvez-nous sur nos r\u00e9seaux sociaux :\n\n\u2022 Instagram : @fagenesis_\n\u2022 LinkedIn : Financial Advice Genesis\n\u2022 TikTok : @financial.advice.genesis\n\nN\u2019h\u00e9sitez pas \u00e0 nous envoyer un message directement !',
            quickReplies: [],
            link: null
        },
        {
            id: 'start_project',
            category: 'contact',
            keywords: ['lancer', 'demarrer', 'commencer projet', 'je veux', 'interesse', 'ca m\'interesse', 'comment demarrer', 'je suis interesse'],
            response: 'Super ! Pour lancer votre projet avec FA Genesis, vous avez deux options :\n\n1. Consulter nos offres pour choisir celle qui vous convient\n2. Nous contacter directement pour en discuter\n\nL\u2019\u00e9quipe sera ravie de vous accompagner !',
            quickReplies: ['Voir les offres', 'Contacter l\u2019\u00e9quipe'],
            link: { url: 'offres.html', label: 'D\u00e9couvrir les offres' }
        },
        {
            id: 'response_time',
            category: 'contact',
            keywords: ['delai', 'reponse', 'combien de temps pour repondre', 'attendre', 'quand', 'repondez vite'],
            response: 'Nous faisons de notre mieux pour r\u00e9pondre \u00e0 toutes les demandes dans un d\u00e9lai de 24 \u00e0 48 heures ouvr\u00e9es. Pour les urgences, n\u2019h\u00e9sitez pas \u00e0 nous appeler directement au +33 7 64 16 36 09.',
            quickReplies: ['Contacter l\u2019\u00e9quipe'],
            link: null
        },

        // ===================== META =====================
        {
            id: 'greeting',
            category: 'meta',
            keywords: ['bonjour', 'salut', 'hello', 'bonsoir', 'hey', 'coucou', 'yo', 'allo', 'bsr', 'bjr'],
            response: 'Bonjour ! Bienvenue chez FA Genesis. Comment puis-je vous aider aujourd\u2019hui ?',
            quickReplies: ['C\u2019est quoi FA Genesis ?', 'Voir les offres', 'Contacter l\u2019\u00e9quipe'],
            link: null
        },
        {
            id: 'thanks',
            category: 'meta',
            keywords: ['merci', 'super', 'parfait', 'genial', 'top', 'cool', 'nickel', 'excellent', 'bien recu'],
            response: 'Avec plaisir ! N\u2019h\u00e9sitez pas si vous avez d\u2019autres questions. L\u2019\u00e9quipe FA Genesis est l\u00e0 pour vous.',
            quickReplies: ['Voir les offres', 'Contacter l\u2019\u00e9quipe'],
            link: null
        },
        {
            id: 'goodbye',
            category: 'meta',
            keywords: ['au revoir', 'bye', 'a bientot', 'bonne journee', 'bonne soiree', 'ciao', 'a plus'],
            response: '\u00c0 bient\u00f4t ! N\u2019h\u00e9sitez pas \u00e0 revenir si vous avez des questions. Bonne continuation !',
            quickReplies: [],
            link: null
        },
        {
            id: 'help',
            category: 'meta',
            keywords: ['aide', 'help', 'je comprends pas', 'comment ca marche le bot', 'que peux-tu faire', 'quoi faire'],
            response: 'Je peux vous aider sur les sujets suivants :\n\n\u2022 Nos prestations et tarifs\n\u2022 Comment fonctionne le paiement s\u00e9curis\u00e9\n\u2022 L\u2019espace client et les livrables\n\u2022 Comment nous contacter\n\nPosez-moi votre question ou cliquez sur un bouton ci-dessous.',
            quickReplies: ['Offres et tarifs', 'Comment \u00e7a marche ?', 'Paiement', 'Espace client', 'Contact'],
            link: null
        },
        {
            id: 'who_are_you',
            category: 'meta',
            keywords: ['qui es tu', 'tu es qui', 'robot', 'bot', 'humain', 'intelligence artificielle', 'ia'],
            response: 'Je suis l\u2019assistant virtuel de FA Genesis. Je suis l\u00e0 pour r\u00e9pondre \u00e0 vos questions sur nos prestations, le paiement s\u00e9curis\u00e9 et l\u2019espace client. Pour une demande sp\u00e9cifique, je peux transmettre votre question \u00e0 notre \u00e9quipe.',
            quickReplies: ['Voir les offres', 'Contacter l\u2019\u00e9quipe'],
            link: null
        },
        {
            id: 'joke_or_chitchat',
            category: 'meta',
            keywords: ['blague', 'drole', 'rigole', 'amour', 'meteo', 'temps', 'sport', 'musique', 'film'],
            response: 'Je suis sp\u00e9cialis\u00e9 dans les questions li\u00e9es \u00e0 FA Genesis (prestations, paiement, espace client). Pour d\u2019autres sujets, je vous invite \u00e0 contacter directement notre \u00e9quipe qui se fera un plaisir de discuter avec vous !',
            quickReplies: ['Voir les offres', 'Contacter l\u2019\u00e9quipe'],
            link: null
        },

        // ===================== SERVICES D\u00c9TAILL\u00c9S =====================
        {
            id: 'photo_detail',
            category: 'services',
            keywords: ['photo', 'photo essentiel', 'photo pro', 'photo event', 'shooting photo', 'seance photo', 'combien photo', 'retouchee', 'portrait', 'nombre photo', 'tarif photo', 'shooting', 'photographe'],
            response: 'FA Genesis collabore avec plusieurs photographes professionnels ind\u00e9pendants.\n\nLe tarif d\u00e9pend du projet, du format, de la dur\u00e9e et du prestataire s\u00e9lectionn\u00e9.\n\nPrestations incluses :\n\u2022 S\u00e9ance photo personnalis\u00e9e\n\u2022 Orientation posture & image professionnelle\n\u2022 Format r\u00e9seaux sociaux\n\u2022 Nombre de photos retouch\u00e9es adapt\u00e9\n\nPaiement possible en plusieurs fois selon le projet.\nDemandez un devis personnalis\u00e9 pour conna\u00eetre le tarif adapt\u00e9 \u00e0 votre besoin.',
            quickReplies: ['Demander un devis', 'Voir les offres'],
            link: { url: 'contact.html?objet=devis&service=photo', label: 'Demander un devis photo' }
        },
        {
            id: 'video_detail',
            category: 'services',
            keywords: ['video', 'video pro', 'video storytelling', 'video visibility', 'tournage video', 'montage video', 'format video', 'duree video', 'reels', 'clip', 'tarif video', 'tournage', 'videaste', 'filmer'],
            response: 'Les tarifs vid\u00e9o sont d\u00e9finis en fonction du format, des objectifs du projet et du vid\u00e9aste partenaire.\n\nPrestations incluses :\n\u2022 Tournage vid\u00e9o personnalis\u00e9\n\u2022 Nombre de vid\u00e9os adapt\u00e9\n\u2022 Direction narrative & storytelling\n\u2022 Conseils de diffusion\n\u2022 Son & cadrage professionnels\n\u2022 Orientation posture & discours\n\u2022 Format r\u00e9seaux sociaux\n\nPaiement possible en plusieurs fois selon le projet.\nDemandez un devis personnalis\u00e9 pour conna\u00eetre le tarif adapt\u00e9 \u00e0 votre besoin.',
            quickReplies: ['Demander un devis', 'Voir les offres'],
            link: { url: 'contact.html?objet=devis&service=video', label: 'Demander un devis vid\u00e9o' }
        },
        {
            id: 'marketing_detail',
            category: 'services',
            keywords: ['marketing', 'marketing express', 'marketing strategy', 'marketing impact', 'strategie marketing', 'analyse marketing', 'positionnement marketing', 'branding', 'audience', 'digital', 'conseil marketing', 'communication digitale'],
            response: 'FA Genesis collabore avec plusieurs sp\u00e9cialistes marketing ind\u00e9pendants.\n\nLe tarif d\u00e9pend du besoin (analyse, positionnement, strat\u00e9gie, plan de publication...) et du prestataire s\u00e9lectionn\u00e9 \u2014 chacun fixe librement son tarif.\n\nPrestations possibles :\n\u2022 Analyse de votre projet et de votre audience cible\n\u2022 Positionnement, message, branding\n\u2022 Diagnostic approfondi + plan de publication\n\nPaiement possible en plusieurs fois selon le projet.\nDemandez un devis personnalis\u00e9 pour conna\u00eetre le tarif adapt\u00e9 \u00e0 votre besoin.',
            quickReplies: ['Voir les offres', 'Contacter l\u2019\u00e9quipe'],
            link: { url: 'offres.html', label: 'Voir les prestations marketing' }
        },
        {
            id: 'media_detail',
            category: 'services',
            keywords: ['media', 'media visibility', 'media impact', 'media premium', 'media promotion', 'publication media', 'presse', 'article', 'credibilite media', 'post media', 'story media', 'stories', 'publication'],
            response: 'FA Genesis collabore avec plusieurs professionnels m\u00e9dia ind\u00e9pendants (publication sur m\u00e9dias cr\u00e9dibles).\n\nLe tarif d\u00e9pend du nombre de publications, de la dur\u00e9e de la campagne et du prestataire s\u00e9lectionn\u00e9 \u2014 chacun fixe librement son tarif.\n\nPrestations possibles :\n\u2022 Publication (posts / stories) sur un m\u00e9dia cr\u00e9dible\n\u2022 Brief en amont pour cadrer le message\n\u2022 Strat\u00e9gie de visibilit\u00e9 sur le long terme\n\nGagnez en cr\u00e9dibilit\u00e9 gr\u00e2ce \u00e0 des publications sur des m\u00e9dias reconnus.\nDemandez un devis personnalis\u00e9 pour conna\u00eetre le tarif adapt\u00e9 \u00e0 votre besoin.',
            quickReplies: ['Voir les offres', 'Contacter l\u2019\u00e9quipe'],
            link: { url: 'offres.html', label: 'Voir les prestations m\u00e9dia' }
        },

        // ===================== OFFRES COMPL\u00c9MENT =====================
        {
            id: 'free_consultation',
            category: 'offres',
            keywords: ['gratuit', 'essai', 'consultation gratuite', 'sans engagement', 'decouvrir', 'tester', 'essayer'],
            response: 'Nous ne proposons pas de consultation gratuite \u00e0 proprement parler, mais notre \u00e9quipe est disponible pour r\u00e9pondre \u00e0 toutes vos questions avant de vous engager. Vous pouvez nous contacter par e-mail, t\u00e9l\u00e9phone ou via le formulaire de contact pour discuter de votre projet sans obligation.',
            quickReplies: ['Contacter l\u2019\u00e9quipe', 'Voir les prestations'],
            link: { url: 'contact.html', label: 'Nous contacter' }
        },
        {
            id: 'group_offer',
            category: 'offres',
            keywords: ['groupe', 'equipe', 'ami', 'ensemble', 'collectif', 'association', 'duo', 'binome', 'plusieurs personnes'],
            response: 'Si vous souhaitez r\u00e9server pour plusieurs personnes (amis, associ\u00e9s, \u00e9quipe), contactez notre \u00e9quipe ou directement le prestataire concern\u00e9 pour discuter d\u2019un tarif adapt\u00e9.',
            quickReplies: ['Contacter l\u2019\u00e9quipe', 'Voir les prestations'],
            link: { url: 'contact.html', label: 'Demander un devis groupe' }
        },

        // ===================== G\u00c9N\u00c9RAL COMPL\u00c9MENT =====================
        {
            id: 'company_values',
            category: 'general',
            keywords: ['valeur', 'mission', 'vision', 'philosophie', 'approche', 'methode', 'innovation', 'authenticite', 'ambition'],
            response: 'FA Genesis repose sur trois valeurs fondamentales :\n\n\u2022 INNOVATION \u2014 Nous croyons en l\u2019innovation comme moteur de transformation\n\u2022 AUTHENTICIT\u00c9 \u2014 Votre identit\u00e9 unique est au c\u0153ur de notre approche\n\u2022 AMBITION \u2014 Nous mettons en relation ceux qui osent voir grand avec des prestataires de confiance\n\nNotre mission : connecter des clients \u00e0 des prestataires ind\u00e9pendants v\u00e9rifi\u00e9s, avec un paiement s\u00e9curis\u00e9 de bout en bout.',
            quickReplies: ['C\u2019est quoi FA Genesis ?', 'Voir les prestations'],
            link: { url: 'a-propos.html', label: 'En savoir plus' }
        },
        {
            id: 'fa_industries',
            category: 'general',
            keywords: ['fa industries', 'ecosysteme', 'groupe', 'maison mere', 'structure', 'holding'],
            response: 'FA Genesis fait partie de l\u2019\u00e9cosyst\u00e8me FA Industries. FA Genesis est le p\u00f4le d\u00e9di\u00e9 \u00e0 la mise en relation entre clients et prestataires ind\u00e9pendants (photo, vid\u00e9o, marketing, m\u00e9dia). C\u2019est la plateforme qui s\u00e9curise la transaction et la relation entre les deux parties.',
            quickReplies: ['C\u2019est quoi FA Genesis ?'],
            link: { url: 'a-propos.html', label: 'Page \u00c0 propos' }
        },
        {
            id: 'testimonials',
            category: 'general',
            keywords: ['temoignage', 'avis', 'retour', 'experience client', 'client satisfait', 'exemple', 'portfolio', 'reference', 'cas client', 'resultat client', 'preuve'],
            response: 'Nos clients laissent des avis sur chaque prestataire apr\u00e8s leur prestation \u2014 vous pouvez les consulter directement sur le profil du prestataire avant de r\u00e9server. N\u2019h\u00e9sitez pas \u00e0 consulter notre page d\u2019accueil ou nos r\u00e9seaux sociaux pour d\u00e9couvrir des r\u00e9alisations.',
            quickReplies: ['Voir les prestations', 'Contacter l\u2019\u00e9quipe'],
            link: null
        },
        {
            id: 'language',
            category: 'general',
            keywords: ['langue', 'francais', 'anglais', 'english', 'language', 'parlez'],
            response: 'Nos prestations sont principalement propos\u00e9es en fran\u00e7ais. Si vous avez des besoins sp\u00e9cifiques concernant la langue, n\u2019h\u00e9sitez pas \u00e0 nous contacter pour en discuter.',
            quickReplies: ['Contacter l\u2019\u00e9quipe'],
            link: null
        },
        {
            id: 'data_privacy',
            category: 'general',
            keywords: ['donnees', 'rgpd', 'confidentialite', 'vie privee', 'protection', 'donnees personnelles', 'securite donnees'],
            response: 'La protection de vos donn\u00e9es personnelles est une priorit\u00e9. Vos informations sont utilis\u00e9es uniquement dans le cadre de vos commandes et ne sont jamais partag\u00e9es avec des tiers sans votre consentement. Les paiements sont s\u00e9curis\u00e9s via Stripe et GENESIS SAFE\u2122.',
            quickReplies: [],
            link: null
        },

        // ===================== PANIER & COMMANDE =====================
        {
            id: 'cart_how',
            category: 'panier',
            keywords: ['panier', 'ajouter panier', 'mettre dans panier', 'comment commander', 'mon panier', 'voir panier', 'vider panier', 'modifier panier', 'comment ajouter'],
            response: 'Ajouter une prestation au panier est simple :\n\n1\ufe0f\u20e3 Connectez-vous \u00e0 votre espace client (ou cr\u00e9ez un compte)\n2\ufe0f\u20e3 Parcourez l\u2019annuaire de prestataires et choisissez un profil\n3\ufe0f\u20e3 Cliquez sur \u00ab Ajouter au panier \u00bb sur la prestation qui vous int\u00e9resse\n4\ufe0f\u20e3 Consultez votre panier via l\u2019ic\u00f4ne \ud83d\uded2\n5\ufe0f\u20e3 Validez et payez (int\u00e9gral ou acompte selon la prestation)\n\nVous pouvez combiner plusieurs prestations de diff\u00e9rents prestataires dans un seul panier !',
            quickReplies: ['Passer une commande', 'Voir les prestations'],
            link: { url: 'offres.html', label: 'Voir les prestations' }
        },
        {
            id: 'checkout_process',
            category: 'panier',
            keywords: ['passer commande', 'valider commande', 'finaliser', 'checkout', 'commander', 'inscription avant paiement', 'faut creer compte', 'compte avant payer', 'comment valider'],
            response: 'Pour passer commande :\n\n1\ufe0f\u20e3 Cr\u00e9ez votre compte (ou connectez-vous)\n2\ufe0f\u20e3 Ajoutez vos prestations au panier depuis l\u2019annuaire de prestataires\n3\ufe0f\u20e3 Cliquez sur \u00ab Valider mon panier \u00bb\n4\ufe0f\u20e3 Payez par carte bancaire, de mani\u00e8re s\u00e9curis\u00e9e\n\nGr\u00e2ce \u00e0 GENESIS SAFE\u2122, l\u2019argent est autoris\u00e9 \u00e0 la r\u00e9servation mais n\u2019est vers\u00e9 au prestataire qu\u2019apr\u00e8s validation de la prestation.',
            quickReplies: ['Comment fonctionne le paiement ?', 'Espace client'],
            link: { url: 'panier.html', label: 'Mon panier' }
        },
        {
            id: 'combine_offers',
            category: 'panier',
            keywords: ['combiner offres', 'plusieurs offres', 'deux offres', 'cumuler', 'ajouter plusieurs', 'pack personnalise', 'plusieurs prestations', 'mixer', 'associer'],
            response: 'Oui, vous pouvez tout \u00e0 fait combiner plusieurs prestations de prestataires diff\u00e9rents dans votre panier ! Par exemple : une prestation d\u2019un photographe et une prestation d\u2019un sp\u00e9cialiste marketing. Le total est calcul\u00e9 automatiquement. \ud83d\udc4c',
            quickReplies: ['Voir les prestations', 'Ajouter au panier'],
            link: { url: 'offres.html', label: 'Voir les prestations' }
        },

        // ===================== SUIVI DE COMMANDE =====================
        {
            id: 'order_status',
            category: 'espace_client',
            keywords: ['statut commande', 'ou est ma commande', 'quand commence', 'etat commande', 'suivi commande', 'ma commande', 'avancement', 'progression commande'],
            response: 'Suivez vos commandes depuis votre espace client :\n\n\u2022 \ud83d\udcca Mes commandes \u2014 vue d\u2019ensemble et statut de paiement\n\u2022 \ud83d\udcac Messages \u2014 \u00e9changez directement avec votre prestataire\n\u2022 \ud83d\udcc1 Livrables \u2014 vos fichiers disponibles au t\u00e9l\u00e9chargement\n\nConnectez-vous avec l\u2019email utilis\u00e9 lors de la commande.',
            quickReplies: ['Espace client', 'Mes livrables'],
            link: { url: 'app.html', label: 'Mon espace client' }
        },
        {
            id: 'when_get_deliverables',
            category: 'espace_client',
            keywords: ['quand recevoir livrable', 'quand photos', 'quand video', 'delai livraison', 'combien de temps livrable', 'livraison livrables', 'attente livrables', 'quand fichiers disponibles'],
            response: 'Le d\u00e9lai de livraison d\u00e9pend du prestataire et de la prestation \u2014 il est g\u00e9n\u00e9ralement indiqu\u00e9 sur sa fiche ou convenu directement avec lui via la messagerie. Vous recevez une notification d\u00e8s que vos livrables sont disponibles dans votre espace client.',
            quickReplies: ['Mes livrables', 'Espace client'],
            link: { url: 'livrables.html', label: 'Mes livrables' }
        },

        // ===================== PAIEMENT (COMPL\u00c9MENTS) =====================
        {
            id: 'when_balance_due',
            category: 'paiement',
            keywords: ['quand payer solde', 'solde du', 'echeance solde', 'deuxieme paiement quand', 'delai solde', 'quand payer reste', 'solde quand'],
            response: 'Pour les prestations avec acompte + solde, le solde est d\u00fb au moment de la validation de la prestation par vos soins. Gr\u00e2ce \u00e0 GENESIS SAFE\u2122, l\u2019argent reste s\u00e9curis\u00e9 jusque-l\u00e0 et n\u2019est vers\u00e9 au prestataire qu\u2019une fois la prestation confirm\u00e9e.',
            quickReplies: ['Payer en plusieurs fois ?', 'Espace client'],
            link: null
        },
        {
            id: 'invoice_receipt',
            category: 'paiement',
            keywords: ['facture', 'recu paiement', 'justificatif', 'tva', 'confirmation paiement', 'preuve paiement', 'ticket', 'avoir une facture'],
            response: 'Un email de confirmation est envoy\u00e9 automatiquement apr\u00e8s chaque paiement. Pour une facture formelle, contactez-nous \u00e0 contact@fagenesis.com en indiquant votre num\u00e9ro de commande.\n\n\u2139\ufe0f FA Genesis est une micro-entreprise (TVA non applicable, article 293 B du CGI).',
            quickReplies: ['Contacter l\u2019\u00e9quipe'],
            link: null
        },
        {
            id: 'payment_failed',
            category: 'paiement',
            keywords: ['paiement echoue', 'paiement refuse', 'carte refusee', 'erreur paiement', 'paiement bloque', 'transaction echouee', 'carte non acceptee', 'probleme paiement', 'paiement ne marche pas'],
            response: 'Si votre paiement a \u00e9chou\u00e9 :\n\n1\ufe0f\u20e3 V\u00e9rifiez que les informations de carte sont correctes\n2\ufe0f\u20e3 Assurez-vous que votre carte est activ\u00e9e pour les paiements en ligne\n3\ufe0f\u20e3 Contactez votre banque si votre carte a \u00e9t\u00e9 bloqu\u00e9e\n4\ufe0f\u20e3 R\u00e9essayez depuis votre espace client\n\nProbl\u00e8me persistant ? Contactez-nous au +33 7 64 16 36 09.',
            quickReplies: ['Contacter l\u2019\u00e9quipe', 'Espace client'],
            link: null
        },

        // ===================== S\u00c9ANCES & LIVRABLES =====================
        {
            id: 'session_reschedule',
            category: 'espace_client',
            keywords: ['reprogrammer', 'reporter seance', 'changer date', 'annuler seance', 'modifier rdv', 'deplacement seance', 'seance reportee', 'changer rendez vous', 'pas disponible ce jour', 'decaler seance'],
            response: 'Pour changer la date d\u2019une prestation, le plus simple est d\u2019en discuter directement avec le prestataire via la messagerie de votre espace client. En cas de difficult\u00e9, notre \u00e9quipe peut aussi intervenir.',
            quickReplies: ['Contacter l\u2019\u00e9quipe'],
            link: null
        },
        {
            id: 'choose_partner',
            category: 'espace_client',
            keywords: ['choisir photographe', 'choisir videaste', 'quel photographe', 'qui fait les photos', 'qui fait la video', 'photographe partenaire', 'videaste partenaire', 'qui prend photos'],
            response: 'C\u2019est vous qui choisissez votre prestataire ! Parcourez l\u2019annuaire, consultez les profils (portfolio, avis, tarifs) et r\u00e9servez directement celui qui correspond \u00e0 votre univers et \u00e0 vos besoins.\n\nSi vous h\u00e9sitez entre plusieurs profils, notre \u00e9quipe peut vous conseiller.',
            quickReplies: ['Voir les prestations', 'Contacter l\u2019\u00e9quipe'],
            link: { url: 'offres.html', label: 'Voir les prestataires' }
        },

        // ===================== ESPACE CLIENT (COMPL\u00c9MENTS) =====================
        {
            id: 'feedback_how',
            category: 'espace_client',
            keywords: ['laisser avis', 'donner avis', 'note', 'satisfaction', 'retour experience', 'espace feedback', 'evaluer', 'opinion', 'avis client', 'temoignage laisser'],
            response: 'Vous pouvez laisser un retour d\u2019exp\u00e9rience depuis votre espace client, dans la section \u00ab Feedback \u00bb. Vous pouvez :\n\n\u2b50 Attribuer une note\n\ud83d\udcac Laisser un commentaire\n\u2705 Accepter que votre t\u00e9moignage soit visible sur le site\n\nVotre avis compte vraiment pour am\u00e9liorer nos services !',
            quickReplies: ['Espace client'],
            link: { url: 'feedback.html', label: 'Laisser un feedback' }
        },
        {
            id: 'registration_issue',
            category: 'espace_client',
            keywords: ['inscription bloquee', 'n arrive pas a m inscrire', 'erreur inscription', 'compte pas cree', 'pas recu email', 'email confirmation', 'pas recu identifiants', 'compte inexistant', 'email non recu', 'pas de mail'],
            response: 'Si vous avez un probl\u00e8me d\u2019inscription ou n\u2019avez pas re\u00e7u votre email de confirmation :\n\n1\ufe0f\u20e3 V\u00e9rifiez vos spams / courriers ind\u00e9sirables\n2\ufe0f\u20e3 Attendez 5 \u00e0 10 minutes\n3\ufe0f\u20e3 Si rien apr\u00e8s 30 minutes, contactez-nous \u00e0 contact@fagenesis.com avec l\u2019email utilis\u00e9\n\nNous cr\u00e9erons votre compte manuellement si n\u00e9cessaire.',
            quickReplies: ['Contacter l\u2019\u00e9quipe'],
            link: null
        }
    ];

    // Mapping boutons rapides -> messages utilisateur
    var QUICK_REPLY_MAP = {
        'C\u2019est quoi FA Genesis ?': 'C\u2019est quoi Financial Advice Genesis ?',
        'Voir les offres': 'Quelles sont vos offres ?',
        'Voir les prestations': 'Quelles sont vos offres ?',
        'Voir les prestataires': 'Quelles sont vos offres ?',
        'Contacter l\u2019\u00e9quipe': 'Comment vous contacter ?',
        'Comment \u00e7a marche ?': 'Comment fonctionne le paiement ?',
        'Tarifs individuels': 'Quels sont vos tarifs individuels ?',
        'Voir les tarifs individuels': 'Quels sont vos tarifs individuels ?',
        'Payer en plusieurs fois ?': 'Est-ce que je peux payer en plusieurs fois ?',
        'Offres et tarifs': 'Quelles sont vos offres et tarifs ?',
        'Paiement': 'Comment fonctionne le paiement ?',
        'Espace client': 'Comment acc\u00e9der \u00e0 mon espace client ?',
        'Contact': 'Comment vous contacter ?',
        'Voir la FAQ': '__FAQ_REDIRECT__',
        'Oui, transmettre ma question': '__ESCALATION__',
        'Passer une commande': 'Comment passer une commande ?',
        'Ajouter au panier': 'Comment ajouter une offre au panier ?',
        'Mes livrables': 'Quand est-ce que je reçois mes livrables ?',
        'Comment fonctionne le paiement ?': 'Comment fonctionne le paiement ?'
    };

    // ============================================================
    // C) MOTEUR DE DETECTION D'INTENTION
    // ============================================================

    function normalizeText(text) {
        try {
            var normalized = text.toLowerCase();
            if (typeof normalized.normalize === 'function') {
                normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            } else {
                normalized = normalized
                    .replace(/[\u00e0\u00e2\u00e4]/g, 'a')
                    .replace(/[\u00e9\u00e8\u00ea\u00eb]/g, 'e')
                    .replace(/[\u00ee\u00ef]/g, 'i')
                    .replace(/[\u00f4\u00f6]/g, 'o')
                    .replace(/[\u00f9\u00fb\u00fc]/g, 'u')
                    .replace(/[\u00e7]/g, 'c')
                    .replace(/[\u0153]/g, 'oe');
            }
            normalized = normalized.replace(/[^\w\s]/g, ' ');
            normalized = normalized.replace(/\s+/g, ' ').trim();
            return normalized;
        } catch (e) {
            return text.toLowerCase();
        }
    }

    function detectIntent(userMessage) {
        try {
            var normalized = normalizeText(userMessage);
            var words = normalized.split(' ');
            var bestMatch = null;
            var bestScore = 0;

            for (var i = 0; i < KNOWLEDGE_BASE.length; i++) {
                var topic = KNOWLEDGE_BASE[i];
                var score = 0;

                for (var k = 0; k < topic.keywords.length; k++) {
                    var keyword = normalizeText(topic.keywords[k]);

                    if (keyword.indexOf(' ') !== -1) {
                        if (normalized.indexOf(keyword) !== -1) {
                            score = score + 3;
                        }
                    } else {
                        for (var w = 0; w < words.length; w++) {
                            if (words[w] === keyword) {
                                score = score + 2;
                            } else if (words[w].length > 3 && keyword.length > 3) {
                                if (words[w].indexOf(keyword) !== -1 || keyword.indexOf(words[w]) !== -1) {
                                    score = score + 1;
                                }
                            }
                        }
                    }
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = topic;
                }
            }

            if (bestScore >= 2) {
                return bestMatch;
            }
            return null;
        } catch (e) {
            console.error('[CHATBOT] Erreur d\u00e9tection :', e);
            return null;
        }
    }

    // ============================================================
    // D) GENERATEUR DE REPONSES
    // ============================================================

    function generateResponse(topic) {
        if (!topic) {
            unmatchedCount = unmatchedCount + 1;
            if (unmatchedCount >= CHATBOT_CONFIG.escalationThreshold) {
                return {
                    text: 'Je ne suis pas s\u00fbr de bien comprendre votre demande. Pour une r\u00e9ponse pr\u00e9cise et personnalis\u00e9e, je vous invite \u00e0 contacter notre \u00e9quipe directement. Souhaitez-vous que je transmette votre question ?',
                    quickReplies: ['Oui, transmettre ma question', 'Contacter l\u2019\u00e9quipe', 'Voir la FAQ'],
                    link: null
                };
            }
            return {
                text: 'Je n\u2019ai pas bien compris votre question. Pouvez-vous la reformuler ? Vous pouvez aussi utiliser les boutons ci-dessous pour naviguer.',
                quickReplies: ['Offres et tarifs', 'Comment \u00e7a marche ?', 'Contacter l\u2019\u00e9quipe', 'Voir la FAQ'],
                link: null
            };
        }
        unmatchedCount = 0;
        return {
            text: topic.response,
            quickReplies: topic.quickReplies || [],
            link: topic.link || null
        };
    }

    // ============================================================
    // E) INJECTION CSS
    // ============================================================

    function injectStyles() {
        try {
            var style = document.createElement('style');
            style.id = 'fa-chatbot-styles';
            style.textContent = ''
                + '#fa-chatbot-container { position: fixed; bottom: 20px; right: 20px; z-index: 30; font-family: "Space Grotesk", sans-serif; }'
                + '#fa-chatbot-trigger { width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #FFD700, #e6c200); border: none; box-shadow: 0 10px 26px rgba(255,215,0,.35), 0 0 0 1px rgba(255,215,0,.15); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform .2s ease, box-shadow .2s ease; position: relative; }'
                + '#fa-chatbot-trigger:hover { transform: translateY(-3px) scale(1.05); box-shadow: 0 16px 36px rgba(255,215,0,.45), 0 0 0 1px rgba(255,215,0,.2); }'
                + '#fa-chatbot-trigger:active { transform: translateY(0) scale(.96); }'
                + '#fa-chatbot-trigger svg { width: 26px; height: 26px; fill: #0a0800; stroke: #0a0800; position: relative; z-index: 2; }'
                + '#fa-chatbot-trigger::before { content: ""; position: absolute; inset: -7px; border-radius: 50%; border: 1.5px solid rgba(255,215,0,.35); animation: faChatbotRing 2.6s ease-out infinite; pointer-events: none; }'
                + '@keyframes faChatbotRing { 0% { transform: scale(.82); opacity: .9; } 100% { transform: scale(1.4); opacity: 0; } }'
                + '#fa-chatbot-trigger-dot { position: absolute; top: 1px; right: 1px; width: 13px; height: 13px; border-radius: 50%; background: #22c55e; border: 2.5px solid #050505; z-index: 3; animation: faChatbotBlink 2.2s ease-in-out infinite; }'
                + '@keyframes faChatbotBlink { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }'
                + '#fa-chatbot-window { display: none; flex-direction: column; position: fixed; bottom: 20px; right: 20px; width: 400px; height: 560px; background: #0c0c0c; border: 1.5px solid rgba(255,215,0,.14); border-radius: 24px; box-shadow: 0 30px 80px rgba(0,0,0,.65), 0 0 0 1px rgba(255,215,0,.06); z-index: 35; overflow: hidden; }'
                + '#fa-chatbot-header { background: linear-gradient(180deg, rgba(255,215,0,.07), rgba(255,215,0,0) 70%); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); color: #fff; padding: 18px 18px 16px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(255,215,0,.12); }'
                + '#fa-chatbot-header-left { display: flex; align-items: center; gap: 12px; }'
                + '#fa-chatbot-header-icon { width: 38px; height: 38px; border-radius: 12px; background: linear-gradient(135deg, #FFD700, #e6c200); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 14px rgba(255,215,0,.3); }'
                + '#fa-chatbot-header-icon svg { width: 19px; height: 19px; fill: #0a0800; stroke: #0a0800; }'
                + '#fa-chatbot-header-text { display: flex; flex-direction: column; gap: 4px; }'
                + '#fa-chatbot-header-title { font-family: "Unbounded", sans-serif; font-weight: 700; font-size: 13px; letter-spacing: .2px; background: linear-gradient(135deg,#FFD700,#FF8C00); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }'
                + '#fa-chatbot-header-status { display: flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 600; color: #a0a0a0; text-transform: uppercase; letter-spacing: .6px; }'
                + '#fa-chatbot-header-status-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; animation: faChatbotBlink 2.2s ease-in-out infinite; }'
                + '#fa-chatbot-close { background: rgba(255,255,255,.06); border: none; width: 30px; height: 30px; border-radius: 50%; font-size: 17px; cursor: pointer; font-weight: 400; color: #a0a0a0; padding: 0; line-height: 1; display: flex; align-items: center; justify-content: center; transition: background .2s, color .2s; flex-shrink: 0; }'
                + '#fa-chatbot-close:hover { background: rgba(255,255,255,.12); color: #fff; }'
                + '#fa-chatbot-messages { flex: 1; overflow-y: auto; padding: 18px 16px; display: flex; flex-direction: column; gap: 14px; background: #0a0a0a; }'
                + '#fa-chatbot-messages::-webkit-scrollbar { width: 5px; }'
                + '#fa-chatbot-messages::-webkit-scrollbar-track { background: transparent; }'
                + '#fa-chatbot-messages::-webkit-scrollbar-thumb { background: rgba(255,215,0,.25); border-radius: 10px; }'
                + '.fa-chatbot-msg { max-width: 85%; padding: 12px 16px; font-size: 13.5px; line-height: 1.55; white-space: pre-line; word-wrap: break-word; border-radius: 16px; animation: faChatbotMsgIn .25s ease; }'
                + '@keyframes faChatbotMsgIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }'
                + '.fa-chatbot-msg.bot { background: #161616; color: #f0f0f0; border: 1px solid rgba(255,215,0,.1); align-self: flex-start; font-weight: 400; border-bottom-left-radius: 4px; }'
                + '.fa-chatbot-msg.user { background: linear-gradient(135deg, #FFD700, #e6c200); color: #0a0800; border: none; align-self: flex-end; font-weight: 600; border-bottom-right-radius: 4px; }'
                + '.fa-chatbot-msg-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; background: rgba(255,215,0,.1); color: #FFD700; padding: 8px 14px; border: 1px solid rgba(255,215,0,.3); border-radius: 10px; font-weight: 700; font-size: 12px; text-decoration: none; letter-spacing: .2px; transition: background .2s, border-color .2s; }'
                + '.fa-chatbot-msg-link:hover { background: rgba(255,215,0,.18); border-color: rgba(255,215,0,.5); }'
                + '#fa-chatbot-typing { display: none; align-self: flex-start; padding: 12px 18px; background: #161616; border: 1px solid rgba(255,215,0,.1); border-radius: 16px; border-bottom-left-radius: 4px; }'
                + '.fa-chatbot-dot { display: inline-block; width: 6px; height: 6px; background: #FFD700; border-radius: 50%; margin: 0 2px; animation: faChatbotBounce 1.4s infinite ease-in-out both; }'
                + '.fa-chatbot-dot:nth-child(1) { animation-delay: -0.32s; }'
                + '.fa-chatbot-dot:nth-child(2) { animation-delay: -0.16s; }'
                + '@keyframes faChatbotBounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }'
                + '#fa-chatbot-quick-replies { padding: 10px 16px; display: flex; flex-wrap: wrap; gap: 8px; border-top: 1px solid rgba(255,215,0,.08); background: #0c0c0c; }'
                + '.fa-chatbot-quick-btn { background: rgba(255,215,0,.06); border: 1px solid rgba(255,215,0,.25); color: #FFD700; padding: 7px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; letter-spacing: .2px; transition: background .2s, border-color .2s, transform .15s; font-family: "Space Grotesk", sans-serif; }'
                + '.fa-chatbot-quick-btn:hover { background: rgba(255,215,0,.15); border-color: rgba(255,215,0,.5); transform: translateY(-1px); }'
                + '#fa-chatbot-input-area { display: flex; align-items: center; gap: 8px; padding: 12px; border-top: 1px solid rgba(255,215,0,.1); background: #0c0c0c; }'
                + '#fa-chatbot-input { flex: 1; padding: 12px 16px; border: 1px solid rgba(255,255,255,.08); border-radius: 14px; background: #161616; font-size: 14px; font-family: "Space Grotesk", sans-serif; outline: none; color: #fff; transition: border-color .2s; }'
                + '#fa-chatbot-input:focus { border-color: rgba(255,215,0,.4); }'
                + '#fa-chatbot-input::placeholder { color: #555; font-size: 13px; font-weight: 400; text-transform: none; letter-spacing: normal; }'
                + '#fa-chatbot-send { background: linear-gradient(135deg, #FFD700, #e6c200); border: none; width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0; cursor: pointer; font-weight: 700; font-size: 16px; color: #0a0800; display: flex; align-items: center; justify-content: center; transition: opacity .2s, transform .15s; }'
                + '#fa-chatbot-send:hover { opacity: .9; transform: translateY(-1px); }'
                + '#fa-chatbot-escalation { display: none; padding: 18px 16px; background: #0c0c0c; border-top: 1px solid rgba(255,215,0,.14); }'
                + '#fa-chatbot-escalation h4 { color: #FFD700; font-family: "Unbounded", sans-serif; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; margin: 0 0 12px 0; }'
                + '#fa-chatbot-escalation input, #fa-chatbot-escalation textarea { width: 100%; padding: 11px 14px; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; background: #161616; color: #fff; font-size: 13px; font-family: "Space Grotesk", sans-serif; margin-bottom: 8px; box-sizing: border-box; outline: none; transition: border-color .2s; }'
                + '#fa-chatbot-escalation input:focus, #fa-chatbot-escalation textarea:focus { border-color: rgba(255,215,0,.4); }'
                + '#fa-chatbot-escalation textarea { height: 64px; resize: none; }'
                + '#fa-chatbot-esc-submit { width: 100%; background: linear-gradient(135deg, #FFD700, #e6c200); color: #0a0800; border: none; border-radius: 12px; padding: 11px; font-weight: 700; font-size: 13px; cursor: pointer; font-family: "Space Grotesk", sans-serif; letter-spacing: .2px; transition: opacity .2s; }'
                + '#fa-chatbot-esc-submit:hover { opacity: .9; }'
                + '#fa-chatbot-esc-cancel { width: 100%; background: transparent; color: #555; border: none; padding: 8px; font-size: 12px; cursor: pointer; margin-top: 4px; font-family: "Space Grotesk", sans-serif; }'
                + '#fa-chatbot-esc-cancel:hover { color: #a0a0a0; }'
                + '@media (max-width: 768px) {'
                // Bouton trigger mobile : plus petit, bien positionn\u00e9
                + '  #fa-chatbot-container { bottom: 16px; right: 16px; z-index: 9999; }'
                + '  #fa-chatbot-trigger { width: 54px; height: 54px; }'
                + '  #fa-chatbot-trigger svg { width: 24px; height: 24px; }'
                // Fen\u00eatre plein \u00e9cran sur mobile
                + '  #fa-chatbot-window { top: 0; left: 0; right: 0; bottom: 0; width: 100% !important; height: 100% !important; max-height: 100vh; max-height: 100dvh; border: none; box-shadow: none; border-radius: 0; z-index: 99999; }'
                // Header mobile : safe area pour iPhone notch
                + '  #fa-chatbot-header { padding: 14px 16px; padding-top: max(14px, env(safe-area-inset-top, 14px)); }'
                + '  #fa-chatbot-header-title { font-size: 12px; letter-spacing: 0.2px; }'
                + '  #fa-chatbot-header-icon { width: 34px; height: 34px; }'
                + '  #fa-chatbot-header-icon svg { width: 17px; height: 17px; }'
                // Bouton fermer : zone tactile agrandie
                + '  #fa-chatbot-close { width: 40px; height: 40px; font-size: 20px; }'
                // Messages mobile : scroll fluide iOS
                + '  #fa-chatbot-messages { padding: 14px 12px; gap: 10px; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }'
                + '  .fa-chatbot-msg { max-width: 90%; padding: 11px 14px; font-size: 14px; line-height: 1.5; }'
                + '  .fa-chatbot-msg-link { padding: 10px 16px; font-size: 12px; min-height: 44px; display: inline-flex; align-items: center; }'
                // Quick replies mobile : boutons plus gros pour le tactile
                + '  #fa-chatbot-quick-replies { padding: 10px 12px; gap: 6px; overflow-x: auto; flex-wrap: wrap; -webkit-overflow-scrolling: touch; max-height: 120px; overflow-y: auto; }'
                + '  .fa-chatbot-quick-btn { padding: 8px 12px; font-size: 11px; min-height: 36px; white-space: nowrap; }'
                // Input mobile : font-size 16px pour emp\u00eacher le zoom auto iOS
                + '  #fa-chatbot-input-area { padding: 10px 12px; padding-bottom: max(10px, env(safe-area-inset-bottom, 10px)); }'
                + '  #fa-chatbot-input { padding: 12px 14px; font-size: 16px; }'
                + '  #fa-chatbot-input::placeholder { font-size: 13px; }'
                + '  #fa-chatbot-send { width: 46px; height: 46px; font-size: 18px; }'
                // Formulaire escalade mobile
                + '  #fa-chatbot-escalation { padding: 14px 12px; padding-bottom: max(14px, env(safe-area-inset-bottom, 14px)); }'
                + '  #fa-chatbot-escalation h4 { font-size: 12px; margin-bottom: 10px; }'
                + '  #fa-chatbot-escalation input, #fa-chatbot-escalation textarea { font-size: 16px; padding: 10px; }'
                + '  #fa-chatbot-esc-submit { padding: 12px; font-size: 13px; min-height: 44px; }'
                + '  #fa-chatbot-esc-cancel { min-height: 44px; font-size: 13px; }'
                + '}'
                // Petits \u00e9crans (iPhone SE, etc.)
                + '@media (max-width: 380px) {'
                + '  #fa-chatbot-header-title { font-size: 11px; }'
                + '  .fa-chatbot-msg { font-size: 13px; padding: 9px 12px; }'
                + '  .fa-chatbot-quick-btn { padding: 7px 10px; font-size: 10px; }'
                + '  #fa-chatbot-escalation input, #fa-chatbot-escalation textarea { font-size: 16px; }'
                + '}';
            document.head.appendChild(style);
        } catch (e) {
            console.error('[CHATBOT] Erreur injection CSS :', e);
        }
    }

    // ============================================================
    // F) CREATION DU WIDGET HTML
    // ============================================================

    // SVG robot moderne : silhouette arrondie pleine + yeux "lumineux" (contraste fixe, ind\u00e9pendant
    // de la couleur h\u00e9rit\u00e9e) + antenne \u00e0 pointe allum\u00e9e \u2014 lisible m\u00eame en tr\u00e8s petit format.
    var ROBOT_SVG = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
        + '<line x1="12" y1="2.2" x2="12" y2="5.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'
        + '<circle cx="12" cy="2.2" r="1.3" fill="currentColor"/>'
        + '<rect x="1.4" y="11.3" width="2.2" height="4.6" rx="1.1" fill="currentColor"/>'
        + '<rect x="20.4" y="11.3" width="2.2" height="4.6" rx="1.1" fill="currentColor"/>'
        + '<rect x="3.5" y="5.4" width="17" height="14.6" rx="6" fill="currentColor"/>'
        + '<ellipse cx="8.7" cy="12.6" rx="1.5" ry="2" fill="#fff"/>'
        + '<ellipse cx="15.3" cy="12.6" rx="1.5" ry="2" fill="#fff"/>'
        + '<rect x="9" y="16.2" width="6" height="1.6" rx="0.8" fill="#fff" opacity=".85"/>'
        + '</svg>';

    function createWidget() {
        try {
            var container = document.createElement('div');
            container.id = 'fa-chatbot-container';

            // Bouton trigger avec ic\u00f4ne robot + pastille "en ligne"
            var trigger = document.createElement('button');
            trigger.id = 'fa-chatbot-trigger';
            trigger.setAttribute('aria-label', 'Ouvrir l\u2019assistant FA Genesis');
            trigger.innerHTML = ROBOT_SVG + '<span id="fa-chatbot-trigger-dot"></span>';

            // Fen\u00eatre chat
            var chatWindow = document.createElement('div');
            chatWindow.id = 'fa-chatbot-window';

            // Header avec ic\u00f4ne + statut "en ligne"
            var header = document.createElement('div');
            header.id = 'fa-chatbot-header';
            header.innerHTML = '<div id="fa-chatbot-header-left"><span id="fa-chatbot-header-icon">' + ROBOT_SVG + '</span><div id="fa-chatbot-header-text"><span id="fa-chatbot-header-title">FA Genesis Assistant</span><span id="fa-chatbot-header-status"><span id="fa-chatbot-header-status-dot"></span>En ligne</span></div></div>';

            var closeBtn = document.createElement('button');
            closeBtn.id = 'fa-chatbot-close';
            closeBtn.setAttribute('aria-label', 'Fermer le chatbot');
            closeBtn.textContent = '\u00D7';
            header.appendChild(closeBtn);

            // Messages
            var messages = document.createElement('div');
            messages.id = 'fa-chatbot-messages';

            var typing = document.createElement('div');
            typing.id = 'fa-chatbot-typing';
            typing.innerHTML = '<span class="fa-chatbot-dot"></span><span class="fa-chatbot-dot"></span><span class="fa-chatbot-dot"></span>';
            messages.appendChild(typing);

            // Quick replies
            var quickReplies = document.createElement('div');
            quickReplies.id = 'fa-chatbot-quick-replies';

            // Formulaire d\u2019escalade
            var escalation = document.createElement('div');
            escalation.id = 'fa-chatbot-escalation';
            escalation.innerHTML = ''
                + '<h4>Transmettre \u00e0 l\u2019\u00e9quipe</h4>'
                + '<input type="text" id="fa-chatbot-esc-name" placeholder="Votre nom">'
                + '<input type="email" id="fa-chatbot-esc-email" placeholder="Votre e-mail">'
                + '<textarea id="fa-chatbot-esc-message" placeholder="Votre question\u2026"></textarea>'
                + '<button id="fa-chatbot-esc-submit">Envoyer \u00e0 l\u2019\u00e9quipe</button>'
                + '<button id="fa-chatbot-esc-cancel">Annuler</button>';

            // Zone de saisie
            var inputArea = document.createElement('div');
            inputArea.id = 'fa-chatbot-input-area';
            inputArea.innerHTML = ''
                + '<input type="text" id="fa-chatbot-input" placeholder="\u00c9crivez votre message\u2026" autocomplete="off">'
                + '<button id="fa-chatbot-send" aria-label="Envoyer">\u27A4</button>';

            // Assemblage
            chatWindow.appendChild(header);
            chatWindow.appendChild(messages);
            chatWindow.appendChild(quickReplies);
            chatWindow.appendChild(escalation);
            chatWindow.appendChild(inputArea);

            container.appendChild(trigger);
            container.appendChild(chatWindow);

            document.body.appendChild(container);

            console.log('[CHATBOT] Widget cr\u00e9\u00e9');
        } catch (e) {
            console.error('[CHATBOT] Erreur cr\u00e9ation widget :', e);
        }
    }

    // ============================================================
    // G) GESTION DES MESSAGES ET \u00c9V\u00c9NEMENTS
    // ============================================================

    function addBotMessage(text, quickRepliesArr, linkObj) {
        try {
            var messagesContainer = document.getElementById('fa-chatbot-messages');
            if (!messagesContainer) return;

            var msgEl = document.createElement('div');
            msgEl.className = 'fa-chatbot-msg bot';

            var content = text;
            if (linkObj && linkObj.url && linkObj.label) {
                content = content + '\n';
                var linkHtml = '<a href="' + linkObj.url + '" class="fa-chatbot-msg-link">' + linkObj.label + ' \u2192</a>';
                msgEl.innerHTML = content.replace(/\n/g, '<br>') + linkHtml;
            } else {
                msgEl.innerHTML = content.replace(/\n/g, '<br>');
            }

            var typingEl = document.getElementById('fa-chatbot-typing');
            if (typingEl) {
                messagesContainer.insertBefore(msgEl, typingEl);
            } else {
                messagesContainer.appendChild(msgEl);
            }

            updateQuickReplies(quickRepliesArr || []);
            scrollToBottom();
        } catch (e) {
            console.error('[CHATBOT] Erreur ajout message bot :', e);
        }
    }

    function addUserMessage(text) {
        try {
            var messagesContainer = document.getElementById('fa-chatbot-messages');
            if (!messagesContainer) return;

            var msgEl = document.createElement('div');
            msgEl.className = 'fa-chatbot-msg user';
            msgEl.textContent = text;

            var typingEl = document.getElementById('fa-chatbot-typing');
            if (typingEl) {
                messagesContainer.insertBefore(msgEl, typingEl);
            } else {
                messagesContainer.appendChild(msgEl);
            }

            scrollToBottom();
        } catch (e) {
            console.error('[CHATBOT] Erreur ajout message utilisateur :', e);
        }
    }

    function showTyping() {
        try {
            var typingEl = document.getElementById('fa-chatbot-typing');
            if (typingEl) typingEl.style.display = 'block';
            scrollToBottom();
        } catch (e) {}
    }

    function hideTyping() {
        try {
            var typingEl = document.getElementById('fa-chatbot-typing');
            if (typingEl) typingEl.style.display = 'none';
        } catch (e) {}
    }

    function updateQuickReplies(replies) {
        try {
            var container = document.getElementById('fa-chatbot-quick-replies');
            if (!container) return;

            container.innerHTML = '';
            if (!replies || replies.length === 0) {
                container.style.display = 'none';
                return;
            }

            container.style.display = 'flex';
            for (var i = 0; i < replies.length; i++) {
                var btn = document.createElement('button');
                btn.className = 'fa-chatbot-quick-btn';
                btn.textContent = replies[i];
                btn.setAttribute('data-reply', replies[i]);
                btn.addEventListener('click', handleQuickReply);
                container.appendChild(btn);
            }
        } catch (e) {
            console.error('[CHATBOT] Erreur boutons rapides :', e);
        }
    }

    function scrollToBottom() {
        try {
            var messagesContainer = document.getElementById('fa-chatbot-messages');
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        } catch (e) {}
    }

    // ============================================================
    // HANDLERS
    // ============================================================

    function isMobile() {
        return window.innerWidth <= 768;
    }

    function lockBodyScroll() {
        if (isMobile()) {
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
            document.body.style.top = '-' + window.scrollY + 'px';
        }
    }

    function unlockBodyScroll() {
        if (document.body.style.position === 'fixed') {
            var scrollY = document.body.style.top;
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.top = '';
            window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }
    }

    function toggleChatbot() {
        try {
            var chatWindow = document.getElementById('fa-chatbot-window');
            var trigger = document.getElementById('fa-chatbot-trigger');

            if (!isOpen) {
                chatWindow.style.display = 'flex';
                trigger.style.display = 'none';
                isOpen = true;
                lockBodyScroll();

                if (!chatInitialized) {
                    addBotMessage(
                        CHATBOT_CONFIG.welcomeMessage,
                        ['C\u2019est quoi FA Genesis ?', 'Voir les offres', 'Contacter l\u2019\u00e9quipe'],
                        null
                    );
                    chatInitialized = true;
                }

                var input = document.getElementById('fa-chatbot-input');
                if (input && !isMobile()) input.focus();
                scrollToBottom();
            } else {
                closeChatbot();
            }
        } catch (e) {
            console.error('[CHATBOT] Erreur toggle :', e);
        }
    }

    function closeChatbot() {
        try {
            var chatWindow = document.getElementById('fa-chatbot-window');
            var trigger = document.getElementById('fa-chatbot-trigger');

            chatWindow.style.display = 'none';
            trigger.style.display = 'flex';
            isOpen = false;
            unlockBodyScroll();

            var input = document.getElementById('fa-chatbot-input');
            if (input) input.blur();
        } catch (e) {}
    }

    function handleSendMessage() {
        try {
            var input = document.getElementById('fa-chatbot-input');
            if (!input) return;

            var text = input.value.trim();
            if (!text) return;

            input.value = '';
            processUserMessage(text);
        } catch (e) {
            console.error('[CHATBOT] Erreur envoi message :', e);
        }
    }

    function handleQuickReply(e) {
        try {
            var replyText = e.target.getAttribute('data-reply');
            if (!replyText) return;

            var mappedMessage = QUICK_REPLY_MAP[replyText];

            if (mappedMessage === '__FAQ_REDIRECT__') {
                window.location.href = 'index.html#faq';
                return;
            }

            if (mappedMessage === '__ESCALATION__') {
                addUserMessage(replyText);
                showEscalationForm();
                return;
            }

            var messageToSend = mappedMessage || replyText;
            processUserMessage(messageToSend);
        } catch (e) {
            console.error('[CHATBOT] Erreur bouton rapide :', e);
        }
    }

    function processUserMessage(text) {
        try {
            addUserMessage(text);
            updateQuickReplies([]);
            showTyping();

            setTimeout(function() {
                try {
                    hideTyping();
                    var topic = detectIntent(text);
                    var response = generateResponse(topic);
                    addBotMessage(response.text, response.quickReplies, response.link);
                } catch (e) {
                    hideTyping();
                    addBotMessage(
                        'D\u00e9sol\u00e9, une erreur est survenue. Vous pouvez nous contacter directement \u00e0 contact@fagenesis.com',
                        ['Contacter l\u2019\u00e9quipe'],
                        null
                    );
                }
            }, CHATBOT_CONFIG.typingDelay);
        } catch (e) {
            console.error('[CHATBOT] Erreur traitement message :', e);
        }
    }

    // ============================================================
    // H) SYST\u00c8ME D'ESCALADE
    // ============================================================

    function showEscalationForm() {
        try {
            var quickReplies = document.getElementById('fa-chatbot-quick-replies');
            var escalation = document.getElementById('fa-chatbot-escalation');
            var inputArea = document.getElementById('fa-chatbot-input-area');

            if (quickReplies) quickReplies.style.display = 'none';
            if (inputArea) inputArea.style.display = 'none';
            if (escalation) escalation.style.display = 'block';

            try {
                var session = localStorage.getItem('fa_genesis_session');
                if (session) {
                    var userData = JSON.parse(session);
                    var nameField = document.getElementById('fa-chatbot-esc-name');
                    var emailField = document.getElementById('fa-chatbot-esc-email');

                    if (nameField && userData.prenom) {
                        nameField.value = (userData.prenom || '') + ' ' + (userData.nom || '');
                    }
                    if (emailField && userData.email) {
                        emailField.value = userData.email;
                    }
                }
            } catch (e) {}

            var messageField = document.getElementById('fa-chatbot-esc-message');
            if (messageField) {
                messageField.value = buildConversationSummary();
            }

            addBotMessage(
                'Remplissez le formulaire ci-dessous et notre \u00e9quipe vous r\u00e9pondra par e-mail dans les plus brefs d\u00e9lais.',
                [],
                null
            );
        } catch (e) {
            console.error('[CHATBOT] Erreur affichage escalade :', e);
        }
    }

    function hideEscalationForm() {
        try {
            var escalation = document.getElementById('fa-chatbot-escalation');
            var inputArea = document.getElementById('fa-chatbot-input-area');

            if (escalation) escalation.style.display = 'none';
            if (inputArea) inputArea.style.display = 'flex';
        } catch (e) {}
    }

    function buildConversationSummary() {
        try {
            var userMsgs = document.querySelectorAll('.fa-chatbot-msg.user');
            var parts = [];
            for (var i = 0; i < userMsgs.length; i++) {
                parts.push('- ' + userMsgs[i].textContent);
            }
            if (parts.length > 0) {
                return 'Questions pos\u00e9es via le chatbot :\n' + parts.join('\n');
            }
            return '';
        } catch (e) {
            return '';
        }
    }

    function submitEscalation() {
        try {
            var nameField = document.getElementById('fa-chatbot-esc-name');
            var emailField = document.getElementById('fa-chatbot-esc-email');
            var messageField = document.getElementById('fa-chatbot-esc-message');
            var submitBtn = document.getElementById('fa-chatbot-esc-submit');

            var name = nameField ? nameField.value.trim() : '';
            var email = emailField ? emailField.value.trim() : '';
            var message = messageField ? messageField.value.trim() : '';

            if (!name || !email || !message) {
                addBotMessage('Merci de remplir tous les champs pour transmettre votre question.', [], null);
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Envoi en cours\u2026';
            }

            var apiUrl = CHATBOT_CONFIG.apiBaseUrl;

            var xhr = new XMLHttpRequest();
            xhr.open('POST', apiUrl + '/api/contact', true);
            xhr.setRequestHeader('Content-Type', 'application/json');

            xhr.onload = function() {
                try {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Envoyer \u00e0 l\u2019\u00e9quipe';
                    }

                    if (xhr.status >= 200 && xhr.status < 300) {
                        hideEscalationForm();
                        unmatchedCount = 0;
                        addBotMessage(
                            'Votre question a bien \u00e9t\u00e9 transmise \u00e0 notre \u00e9quipe ! Vous recevrez une r\u00e9ponse par e-mail \u00e0 ' + email + '. En attendant, n\u2019h\u00e9sitez pas \u00e0 consulter notre FAQ ou nos offres.',
                            ['Voir les offres', 'Voir la FAQ'],
                            null
                        );
                    } else {
                        addBotMessage(
                            'Une erreur est survenue lors de l\u2019envoi. Vous pouvez aussi nous contacter directement par e-mail : contact@fagenesis.com',
                            ['Contacter l\u2019\u00e9quipe'],
                            null
                        );
                    }
                } catch (e) {
                    addBotMessage('Une erreur est survenue. Contactez-nous \u00e0 contact@fagenesis.com', [], null);
                }
            };

            xhr.onerror = function() {
                try {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Envoyer \u00e0 l\u2019\u00e9quipe';
                    }
                    hideEscalationForm();
                    addBotMessage(
                        'Impossible de joindre le serveur pour le moment. Vous pouvez nous \u00e9crire directement \u00e0 contact@fagenesis.com ou appeler le +33 7 64 16 36 09.',
                        ['Contacter l\u2019\u00e9quipe'],
                        null
                    );
                } catch (e) {}
            };

            xhr.send(JSON.stringify({
                name: name,
                email: email,
                profil: 'CHATBOT',
                subject: '[CHATBOT] Question non r\u00e9solue',
                message: message
            }));

        } catch (e) {
            console.error('[CHATBOT] Erreur soumission escalade :', e);
        }
    }

    // ============================================================
    // I) INITIALISATION
    // ============================================================

    function bindEvents() {
        try {
            var trigger = document.getElementById('fa-chatbot-trigger');
            if (trigger) trigger.addEventListener('click', toggleChatbot);

            var closeBtn = document.getElementById('fa-chatbot-close');
            if (closeBtn) closeBtn.addEventListener('click', closeChatbot);

            var sendBtn = document.getElementById('fa-chatbot-send');
            if (sendBtn) sendBtn.addEventListener('click', handleSendMessage);

            var input = document.getElementById('fa-chatbot-input');
            if (input) {
                input.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' || e.keyCode === 13) {
                        e.preventDefault();
                        handleSendMessage();
                    }
                });
            }

            document.addEventListener('keydown', function(e) {
                if ((e.key === 'Escape' || e.keyCode === 27) && isOpen) {
                    closeChatbot();
                }
            });

            var escSubmit = document.getElementById('fa-chatbot-esc-submit');
            if (escSubmit) escSubmit.addEventListener('click', submitEscalation);

            var escCancel = document.getElementById('fa-chatbot-esc-cancel');
            if (escCancel) {
                escCancel.addEventListener('click', function() {
                    hideEscalationForm();
                    addBotMessage(
                        'Pas de probl\u00e8me ! Posez-moi une autre question ou utilisez les boutons ci-dessous.',
                        ['Offres et tarifs', 'Comment \u00e7a marche ?', 'Contacter l\u2019\u00e9quipe'],
                        null
                    );
                });
            }

            // Gestion du clavier mobile (visualViewport API)
            if (typeof window.visualViewport !== 'undefined') {
                window.visualViewport.addEventListener('resize', function() {
                    if (!isOpen || !isMobile()) return;
                    try {
                        var chatWindow = document.getElementById('fa-chatbot-window');
                        if (!chatWindow) return;
                        var viewportHeight = window.visualViewport.height;
                        chatWindow.style.height = viewportHeight + 'px';
                        chatWindow.style.maxHeight = viewportHeight + 'px';
                        scrollToBottom();
                    } catch (e) {}
                });
            }

            // Scroll vers le bas quand l\u2019input re\u00e7oit le focus sur mobile
            var chatInput = document.getElementById('fa-chatbot-input');
            if (chatInput) {
                chatInput.addEventListener('focus', function() {
                    if (isMobile()) {
                        setTimeout(function() { scrollToBottom(); }, 300);
                    }
                });
            }

            console.log('[CHATBOT] \u00c9v\u00e9nements li\u00e9s');
        } catch (e) {
            console.error('[CHATBOT] Erreur liaison \u00e9v\u00e9nements :', e);
        }
    }

    function init() {
        try {
            console.log('[CHATBOT] Initialisation v2\u2026');
            injectStyles();
            createWidget();
            bindEvents();
            console.log('[CHATBOT] Pr\u00eat');
        } catch (e) {
            console.error('[CHATBOT] Erreur initialisation :', e);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
