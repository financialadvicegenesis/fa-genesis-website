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
            response: 'Financial Advice Genesis accompagne les \u00e9tudiants et les entrepreneurs d\u00e9butants \u00e0 transformer une id\u00e9e en un projet structur\u00e9, cr\u00e9dible et visible. Nous vous aidons \u00e0 clarifier votre vision, structurer votre projet et gagner en visibilit\u00e9, le tout \u00e0 un co\u00fbt accessible.',
            quickReplies: ['Voir les offres', 'Comment \u00e7a marche ?', 'Contacter l\u2019\u00e9quipe'],
            link: null
        },
        {
            id: 'who_is_it_for',
            category: 'general',
            keywords: ['pour qui', 'a qui', 's\'adresse', 'cible', 'public', 'porteur de projet', 'jeune'],
            response: 'Nos accompagnements s\u2019adressent aux \u00e9tudiants, aux porteurs de projets, aux jeunes entrepreneurs, aux particuliers et aux entreprises. Que vous ayez d\u00e9j\u00e0 un projet ou juste une id\u00e9e, nous pouvons vous aider.',
            quickReplies: ['Offres \u00c9tudiants', 'Offres Particuliers', 'Offres Entreprises'],
            link: null
        },
        {
            id: 'no_project_yet',
            category: 'general',
            keywords: ['pas de projet', 'pas encore', 'juste une idee', 'je sais pas', 'commencer', 'debuter', 'je ne sais pas par ou', 'je debute', 'aucune idee', 'pas d\'idee'],
            response: 'Pas de souci ! Vous n\u2019avez pas besoin d\u2019avoir un projet tout pr\u00eat. Vous pouvez venir avec une id\u00e9e, un d\u00e9but de r\u00e9flexion ou m\u00eame juste une envie. Nous vous aidons \u00e0 clarifier et structurer tout \u00e7a.',
            quickReplies: ['Voir les offres', 'Comment \u00e7a marche ?'],
            link: null
        },
        {
            id: 'about_partners',
            category: 'general',
            keywords: ['partenaire', 'photographe', 'videast', 'collaboration', 'travaillez avec'],
            response: 'Oui, nous travaillons avec des photographes, vid\u00e9astes et m\u00e9dias partenaires pour offrir une exp\u00e9rience compl\u00e8te \u00e0 nos clients.',
            quickReplies: [],
            link: null
        },
        {
            id: 'student_adapted',
            category: 'general',
            keywords: ['adapte etudiant', 'prix etudiant', 'budget etudiant', 'abordable', 'pas cher', 'accessible', 'etudiant'],
            response: 'Absolument ! Nos offres ont \u00e9t\u00e9 pens\u00e9es en tenant compte de la r\u00e9alit\u00e9 financi\u00e8re des \u00e9tudiants en France. Les prix \u00e9tudiants commencent \u00e0 partir de 50 \u20ac. Vous pouvez consulter tous les d\u00e9tails sur notre page offres.',
            quickReplies: ['Offres \u00c9tudiants'],
            link: { url: 'offres.html', label: 'Voir les offres \u00e9tudiants' }
        },
        {
            id: 'location',
            category: 'general',
            keywords: ['ou etes vous', 'localisation', 'adresse', 'ville', 'situe', 'ou se trouve', 'en ligne', 'presentiel', 'distance', 'distanciel'],
            response: 'FA Genesis propose ses accompagnements principalement en ligne, ce qui vous permet d\u2019en b\u00e9n\u00e9ficier o\u00f9 que vous soyez en France. Pour certaines prestations (photo, vid\u00e9o), des sessions en pr\u00e9sentiel peuvent \u00eatre organis\u00e9es. Contactez-nous pour en savoir plus.',
            quickReplies: ['Contacter l\u2019\u00e9quipe'],
            link: null
        },
        {
            id: 'difference_vs_others',
            category: 'general',
            keywords: ['difference', 'pourquoi vous', 'avantage', 'concurrent', 'mieux', 'unique', 'special'],
            response: 'Ce qui distingue FA Genesis, c\u2019est notre approche accessible, humaine et concr\u00e8te. Nous ne faisons pas de promesses irr\u00e9alistes : nous vous accompagnons pas \u00e0 pas, avec des prix adapt\u00e9s (d\u00e8s 50 \u20ac pour les \u00e9tudiants), une \u00e9quipe r\u00e9active, et des r\u00e9sultats tangibles (photos, vid\u00e9os, plan d\u2019action).',
            quickReplies: ['Voir les offres', 'Comment \u00e7a marche ?'],
            link: null
        },

        // ===================== OFFRES =====================
        {
            id: 'offers_overview',
            category: 'offres',
            keywords: ['offre', 'formule', 'forfait', 'pack', 'programme', 'quelles offres', 'vos services', 'proposez', 'tarif', 'prix', 'offres et tarifs', 'combien coute', 'catalogue', 'grille tarifaire', 'liste offres'],
            response: 'Nous proposons plusieurs cat\u00e9gories d\u2019offres :\n\n\u2022 \u00c9TUDIANTS : de 50 \u20ac (2 jours) \u00e0 290 \u20ac (1 mois)\n\u2022 PARTICULIERS : de 149 \u20ac (2 jours) \u00e0 1 490 \u20ac (1 mois)\n\u2022 ENTREPRISES : de 1 490 \u20ac (7 jours) \u00e0 4 900 \u20ac (30 jours)\n\u2022 Prestations individuelles : Photo, Vid\u00e9o, Marketing, M\u00e9dia\n\nChaque cat\u00e9gorie propose aussi des offres sur mesure. Retrouvez tous les d\u00e9tails sur notre page offres.',
            quickReplies: ['Offres \u00c9tudiants', 'Offres Particuliers', 'Offres Entreprises', 'Tarifs individuels'],
            link: { url: 'offres.html', label: 'Voir toutes les offres' }
        },
        {
            id: 'student_offers',
            category: 'offres',
            keywords: ['offre etudiant', 'etudiant idea', 'etudiant starter', 'etudiant launch', 'etudiant impact', 'tarif etudiant', 'prix etudiant', 'offres etudiants', 'etudiant offre', 'etudiant prix'],
            response: 'Voici nos offres pour les \u00e9tudiants :\n\n\u2022 IDEA : 50 \u20ac / 2 jours \u2014 1 mini s\u00e9ance strat\u00e9gique (45 min) + structuration + mini plan d\u2019action\n\u2022 STARTER : 100 \u20ac / 7 jours \u2014 1 s\u00e9ance (1h30) + structuration + conseils visibilit\u00e9 + plan d\u2019action (14 jours)\n\u2022 LAUNCH : 189 \u20ac / 14 jours \u2014 strat\u00e9gie + storytelling + 1 vid\u00e9o courte + acc\u00e8s 1 m\u00e9dia + plan de diffusion (30 jours)\n\u2022 IMPACT : 290 \u20ac / 1 mois \u2014 accompagnement complet : strat\u00e9gie + photo (5 photos) + vid\u00e9o (1h) + m\u00e9dia + plan de communication (30 jours)\n\u2022 CUSTOM : sur mesure\n\nPaiement en plusieurs fois possible (jusqu\u2019\u00e0 8x). Tous les d\u00e9tails sur la page offres.',
            quickReplies: ['Voir les offres \u00e9tudiants'],
            link: { url: 'offres.html#offres-etudiants', label: 'Voir les offres \u00e9tudiants' }
        },
        {
            id: 'particulier_offers',
            category: 'offres',
            keywords: ['offre particulier', 'particulier idea', 'particulier starter', 'particulier launch', 'particulier impact', 'tarif particulier', 'prix particulier', 'offres particuliers', 'particulier offre', 'particulier prix'],
            response: 'Voici nos offres pour les particuliers :\n\n\u2022 IDEA : 149 \u20ac / 2 jours \u2014 s\u00e9ance strat\u00e9gique + structuration + plan d\u2019action\n\u2022 STARTER : 490 \u20ac / 7 jours \u2014 s\u00e9ance compl\u00e8te + structuration + conseils visibilit\u00e9 (paiement en 2x)\n\u2022 LAUNCH : 790 \u20ac / 14 jours \u2014 strat\u00e9gie + vid\u00e9o + m\u00e9dia + plan de diffusion (paiement en 2x)\n\u2022 IMPACT : 1 490 \u20ac / 1 mois \u2014 accompagnement complet avec photo, vid\u00e9o, m\u00e9dia (paiement en 2x)\n\u2022 CUSTOM : sur mesure\n\nConsultez la page offres pour le d\u00e9tail complet.',
            quickReplies: ['Voir les offres particuliers'],
            link: { url: 'offres.html#offres-particuliers', label: 'Voir les offres particuliers' }
        },
        {
            id: 'enterprise_offers',
            category: 'offres',
            keywords: ['offre entreprise', 'entreprise start', 'entreprise visibility', 'entreprise impact', 'tarif entreprise', 'prix entreprise', 'b2b', 'offres entreprises', 'entreprise offre', 'professionnel', 'societe'],
            response: 'Voici nos offres pour les entreprises :\n\n\u2022 START : 1 490 \u20ac / 7 jours \u2014 positionnement strat\u00e9gique + message central + conseils visibilit\u00e9 + mini plan d\u2019action (30 jours)\n\u2022 VISIBILITY : 2 990 \u20ac / 14 jours \u2014 storytelling + shooting photo (24 photos) + vid\u00e9o + m\u00e9dias (6 posts/stories) + plan de diffusion\n\u2022 IMPACT : 4 900 \u20ac / 30 jours \u2014 positionnement + photo (40 photos) + 2 vid\u00e9os + m\u00e9dias (9 posts/stories) + plan de communication (60 jours)\n\u2022 CUSTOM : sur mesure\n\nPour un devis personnalis\u00e9, n\u2019h\u00e9sitez pas \u00e0 contacter l\u2019\u00e9quipe.',
            quickReplies: ['Voir les offres entreprises', 'Contacter l\u2019\u00e9quipe'],
            link: { url: 'offres.html#offres-entreprises', label: 'Voir les offres entreprises' }
        },
        {
            id: 'individual_services',
            category: 'offres',
            keywords: ['prestation individuelle', 'service individuel', 'tarif individuel', 'tarifs individuels', 'a la carte', 'prestation seule', 'juste photo', 'juste video', 'juste marketing', 'tarif prestation', 'prix prestation'],
            response: 'Voici nos tarifs individuels :\n\n\u2022 PHOTO : sur devis (photographes professionnels ind\u00e9pendants)\n\u2022 VID\u00c9O : sur devis (vid\u00e9astes professionnels partenaires)\n\u2022 MARKETING : \u00e0 partir de 120 \u20ac (analyse + recommandations)\n\u2022 M\u00c9DIA : \u00e0 partir de 223 \u20ac (publication sur m\u00e9dia cr\u00e9dible)\n\nPour la photo et la vid\u00e9o, le tarif d\u00e9pend du projet. Demandez un devis personnalis\u00e9 via le formulaire de contact.',
            quickReplies: ['Voir les tarifs individuels', 'Demander un devis'],
            link: { url: 'offres.html#tarifs', label: 'Voir les tarifs individuels' }
        },
        {
            id: 'custom_offer',
            category: 'offres',
            keywords: ['sur mesure', 'custom', 'personnalise', 'specifique', 'adapte', 'podcast', 'besoin particulier', 'devis'],
            response: 'Oui, nous proposons des offres sur mesure (CUSTOM) dans chaque cat\u00e9gorie. Si votre besoin est sp\u00e9cifique (podcast, projet particulier, entreprise, etc.), l\u2019\u00e9quipe peut cr\u00e9er une offre adapt\u00e9e \u00e0 vos besoins. Le mieux est de nous contacter pour en discuter.',
            quickReplies: ['Contacter l\u2019\u00e9quipe'],
            link: { url: 'contact.html', label: 'Demander un devis' }
        },
        {
            id: 'choose_offer',
            category: 'offres',
            keywords: ['quelle offre choisir', 'laquelle', 'choisir', 'conseiller', 'recommander', 'hesiter', 'meilleure offre', 'je ne sais pas quelle', 'idea ou starter', 'starter ou launch', 'launch ou impact', 'quelle formule'],
            response: 'Le choix d\u00e9pend de votre profil et de vos besoins :\n\n\u2022 Vous avez une id\u00e9e \u00e0 clarifier ? \u2192 IDEA (2 jours)\n\u2022 Vous voulez structurer un projet ? \u2192 STARTER (7 jours)\n\u2022 Vous souhaitez aussi de la visibilit\u00e9 ? \u2192 LAUNCH (14 jours)\n\u2022 Vous voulez un accompagnement complet ? \u2192 IMPACT (1 mois)\n\nSi vous h\u00e9sitez, contactez notre \u00e9quipe : elle vous orientera vers l\u2019offre la plus adapt\u00e9e.',
            quickReplies: ['Voir les offres', 'Contacter l\u2019\u00e9quipe'],
            link: null
        },
        {
            id: 'whats_included',
            category: 'offres',
            keywords: ['inclus', 'comprend', 'contenu', 'quoi dans', 'qu\'est-ce qui est inclus', 'detail offre', 'compose'],
            response: 'Chaque offre comprend des \u00e9l\u00e9ments diff\u00e9rents selon le niveau choisi. En g\u00e9n\u00e9ral :\n\n\u2022 IDEA : 1 s\u00e9ance strat\u00e9gique + structuration + plan d\u2019action\n\u2022 STARTER : s\u00e9ance compl\u00e8te + structuration + conseils visibilit\u00e9\n\u2022 LAUNCH : strat\u00e9gie + tournage vid\u00e9o + acc\u00e8s m\u00e9dia + plan de diffusion\n\u2022 IMPACT : tout ce qui pr\u00e9c\u00e8de + shooting photo + accompagnement complet\n\nPour le d\u00e9tail pr\u00e9cis de chaque offre, consultez la page offres.',
            quickReplies: ['Voir les offres'],
            link: { url: 'offres.html', label: 'Voir le d\u00e9tail des offres' }
        },

        // ===================== PAIEMENT =====================
        {
            id: 'payment_how',
            category: 'paiement',
            keywords: ['payer', 'paiement', 'prix', 'combien', 'cout', 'tarif', 'comment payer', 'moyen de paiement', 'combien ca coute', 'carte bancaire', 'virement'],
            response: 'Les prix sont affich\u00e9s directement sur notre site et sur notre page Instagram. Le paiement fonctionne en deux \u00e9tapes :\n\n\u2022 Un acompte de 30 % pour d\u00e9marrer\n\u2022 Le solde de 70 % \u00e0 la fin de l\u2019accompagnement\n\nLe paiement s\u2019effectue par carte bancaire de mani\u00e8re s\u00e9curis\u00e9e. Nous proposons aussi des facilit\u00e9s de paiement.',
            quickReplies: ['Payer en plusieurs fois ?', 'Voir les offres'],
            link: { url: 'offres.html', label: 'Voir les prix' }
        },
        {
            id: 'payment_installments',
            category: 'paiement',
            keywords: ['plusieurs fois', 'echelon', 'facilite', 'mensualite', 'etaler', 'en 2 fois', 'en 3 fois', 'en 4 fois', 'echelonne'],
            response: 'Oui, le paiement en plusieurs fois est possible sur la plupart de nos offres :\n\n\u2022 \u00c9tudiants : jusqu\u2019\u00e0 2x (IDEA), 4x (STARTER), 6x (LAUNCH) ou 8x (IMPACT)\n\u2022 Particuliers : jusqu\u2019\u00e0 2x (STARTER, LAUNCH, IMPACT)\n\u2022 Entreprises et Custom : facilit\u00e9s de paiement n\u00e9gociables\n\nContactez notre \u00e9quipe pour conna\u00eetre les modalit\u00e9s exactes selon votre offre.',
            quickReplies: ['Contacter l\u2019\u00e9quipe', 'Voir les offres'],
            link: null
        },
        {
            id: 'deposit_balance',
            category: 'paiement',
            keywords: ['acompte', 'solde', '30%', '70%', 'reste a payer', 'premier paiement', 'depot'],
            response: 'Le paiement se fait en deux temps :\n\n\u2022 30 % d\u2019acompte au d\u00e9marrage de l\u2019accompagnement\n\u2022 70 % de solde \u00e0 la fin\n\nCe syst\u00e8me vous permet de commencer sans tout payer d\u2019un coup. L\u2019acompte active votre acc\u00e8s \u00e0 l\u2019espace client.',
            quickReplies: ['Voir les offres'],
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
            response: 'Votre s\u00e9curit\u00e9 est notre priorit\u00e9. Les paiements sont trait\u00e9s via SumUp, une plateforme de paiement s\u00e9curis\u00e9e et certifi\u00e9e. Vos donn\u00e9es bancaires ne sont jamais stock\u00e9es sur nos serveurs. FA Genesis est une entreprise enregistr\u00e9e et l\u00e9gitime.',
            quickReplies: ['Voir les offres'],
            link: null
        },

        // ===================== ACCOMPAGNEMENT =====================
        {
            id: 'how_it_works',
            category: 'accompagnement',
            keywords: ['comment ca marche', 'comment fonctionne', 'deroulement', 'etape', 'processus', 'fonctionnement', 'comment se passe', 'comment ca se passe'],
            response: 'L\u2019accompagnement se d\u00e9roule en plusieurs \u00e9tapes :\n\n1. Clarification de votre id\u00e9e\n2. Structuration du projet\n3. Visibilit\u00e9 (photo, vid\u00e9o, m\u00e9dia selon l\u2019offre)\n4. Plan d\u2019action concret\n\nChaque accompagnement est simple, progressif et sans pression. Vous avancez \u00e0 votre rythme avec un suivi adapt\u00e9.',
            quickReplies: ['Voir les offres', 'Combien de temps ?'],
            link: null
        },
        {
            id: 'duration',
            category: 'accompagnement',
            keywords: ['duree', 'combien de temps', 'jours', 'semaines', 'mois', 'long', 'rapide', 'dure'],
            response: 'La dur\u00e9e d\u00e9pend de l\u2019offre choisie :\n\n\u2022 IDEA : 2 jours\n\u2022 STARTER : 7 jours\n\u2022 LAUNCH : 14 jours\n\u2022 IMPACT : 1 mois\n\u2022 CUSTOM : variable selon vos besoins\n\nChaque offre est con\u00e7ue pour aller \u00e0 l\u2019essentiel dans le temps imparti.',
            quickReplies: ['Voir les offres'],
            link: null
        },
        {
            id: 'guarantee',
            category: 'accompagnement',
            keywords: ['garantie', 'resultat', 'reussite', 'succes', 'ca marche', 'efficace', 'certitude', 'assure'],
            response: 'Nous ne garantissons pas le succ\u00e8s d\u2019un projet, car cela d\u00e9pend \u00e9norm\u00e9ment de votre volont\u00e9 et de votre engagement. En revanche, nous garantissons un accompagnement s\u00e9rieux, structur\u00e9 et adapt\u00e9 \u00e0 votre situation. Nous mettons tout en \u0153uvre pour vous donner les meilleures chances de r\u00e9ussir.',
            quickReplies: [],
            link: null
        },
        {
            id: 'after_accompaniment',
            category: 'accompagnement',
            keywords: ['apres', 'ensuite', 'termine', 'fini', 'suite', 'suivi apres', 'apres l\'accompagnement'],
            response: 'Une fois votre accompagnement termin\u00e9, vous conservez tous vos livrables (photos, vid\u00e9os, documents, plan d\u2019action). Vous pouvez \u00e9galement souscrire \u00e0 une nouvelle offre si vous souhaitez continuer \u00e0 \u00eatre accompagn\u00e9. Notre \u00e9quipe reste disponible pour r\u00e9pondre \u00e0 vos questions.',
            quickReplies: ['Voir les offres', 'Contacter l\u2019\u00e9quipe'],
            link: null
        },

        // ===================== ESPACE CLIENT =====================
        {
            id: 'client_area',
            category: 'espace_client',
            keywords: ['espace client', 'mon compte', 'mon espace', 'tableau de bord', 'dashboard', 'connexion', 'se connecter', 'connecter', 'login'],
            response: 'Votre espace client vous permet de suivre votre accompagnement, acc\u00e9der \u00e0 vos documents et consulter vos s\u00e9ances. Pour vous connecter, rendez-vous sur la page de connexion.',
            quickReplies: [],
            link: { url: 'login.html', label: 'Se connecter' }
        },
        {
            id: 'create_account',
            category: 'espace_client',
            keywords: ['creer compte', 'inscription', 's\'inscrire', 'nouveau compte', 'register', 'enregistrer', 'ouvrir compte'],
            response: 'Pour cr\u00e9er votre compte, rendez-vous sur la page d\u2019inscription. Vous aurez besoin de vos informations personnelles et de choisir une offre.',
            quickReplies: [],
            link: { url: 'register.html', label: 'Cr\u00e9er un compte' }
        },
        {
            id: 'documents',
            category: 'espace_client',
            keywords: ['document', 'livrable', 'fichier', 'telecharger', 'pdf', 'livraison', 'telechargement'],
            response: 'Vos documents et livrables sont accessibles depuis votre espace client. Les documents d\u2019accueil sont disponibles d\u00e8s le paiement de l\u2019acompte. Les livrables finaux (photos, vid\u00e9os, etc.) sont disponibles au t\u00e9l\u00e9chargement une fois le solde r\u00e9gl\u00e9.',
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
            response: 'Vos s\u00e9ances sont planifi\u00e9es par notre \u00e9quipe et visibles dans votre espace client, dans la section \u00ab S\u00e9ances \u00bb. Si vous souhaitez modifier ou planifier un rendez-vous, contactez-nous directement.',
            quickReplies: ['Contacter l\u2019\u00e9quipe'],
            link: { url: 'login.html', label: 'Voir mes s\u00e9ances' }
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
            response: 'Vous pouvez nous contacter de plusieurs fa\u00e7ons :\n\n\u2022 Par e-mail : financialadvicegenesis@gmail.com\n\u2022 Par t\u00e9l\u00e9phone : +33 7 64 16 36 09\n\u2022 Via le formulaire de contact sur notre site\n\u2022 Par message sur nos r\u00e9seaux sociaux\n\nHoraires : du lundi au vendredi, de 9 h \u00e0 18 h.',
            quickReplies: [],
            link: { url: 'contact.html', label: 'Formulaire de contact' }
        },
        {
            id: 'social_media',
            category: 'contact',
            keywords: ['instagram', 'linkedin', 'tiktok', 'reseaux sociaux', 'reseau', 'social', 'insta'],
            response: 'Retrouvez-nous sur nos r\u00e9seaux sociaux :\n\n\u2022 Instagram : @financial_advice_genesis\n\u2022 LinkedIn : Financial Advice Genesis\n\u2022 TikTok : @financial.advice.genesis\n\nN\u2019h\u00e9sitez pas \u00e0 nous envoyer un message directement !',
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
            response: 'Je peux vous aider sur les sujets suivants :\n\n\u2022 Nos offres et tarifs\n\u2022 Le fonctionnement de l\u2019accompagnement\n\u2022 Le paiement et les facilit\u00e9s\n\u2022 L\u2019espace client et les documents\n\u2022 Comment nous contacter\n\nPosez-moi votre question ou cliquez sur un bouton ci-dessous.',
            quickReplies: ['Offres et tarifs', 'Comment \u00e7a marche ?', 'Paiement', 'Espace client', 'Contact'],
            link: null
        },
        {
            id: 'who_are_you',
            category: 'meta',
            keywords: ['qui es tu', 'tu es qui', 'robot', 'bot', 'humain', 'intelligence artificielle', 'ia'],
            response: 'Je suis l\u2019assistant virtuel de FA Genesis. Je suis l\u00e0 pour r\u00e9pondre \u00e0 vos questions sur nos offres, le fonctionnement de l\u2019accompagnement, le paiement et l\u2019espace client. Pour une demande sp\u00e9cifique, je peux transmettre votre question \u00e0 notre \u00e9quipe.',
            quickReplies: ['Voir les offres', 'Contacter l\u2019\u00e9quipe'],
            link: null
        },
        {
            id: 'joke_or_chitchat',
            category: 'meta',
            keywords: ['blague', 'drole', 'rigole', 'amour', 'meteo', 'temps', 'sport', 'musique', 'film'],
            response: 'Je suis sp\u00e9cialis\u00e9 dans les questions li\u00e9es \u00e0 FA Genesis (offres, paiement, accompagnement, espace client). Pour d\u2019autres sujets, je vous invite \u00e0 contacter directement notre \u00e9quipe qui se fera un plaisir de discuter avec vous !',
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
            link: { url: 'contact.html?formule=devis', label: 'Demander un devis photo' }
        },
        {
            id: 'video_detail',
            category: 'services',
            keywords: ['video', 'video pro', 'video storytelling', 'video visibility', 'tournage video', 'montage video', 'format video', 'duree video', 'reels', 'clip', 'tarif video', 'tournage', 'videaste', 'filmer'],
            response: 'Les tarifs vid\u00e9o sont d\u00e9finis en fonction du format, des objectifs du projet et du vid\u00e9aste partenaire.\n\nPrestations incluses :\n\u2022 Tournage vid\u00e9o personnalis\u00e9\n\u2022 Nombre de vid\u00e9os adapt\u00e9\n\u2022 Direction narrative & storytelling\n\u2022 Conseils de diffusion\n\u2022 Son & cadrage professionnels\n\u2022 Orientation posture & discours\n\u2022 Format r\u00e9seaux sociaux\n\nPaiement possible en plusieurs fois selon le projet.\nDemandez un devis personnalis\u00e9 pour conna\u00eetre le tarif adapt\u00e9 \u00e0 votre besoin.',
            quickReplies: ['Demander un devis', 'Voir les offres'],
            link: { url: 'contact.html?formule=devis', label: 'Demander un devis vid\u00e9o' }
        },
        {
            id: 'marketing_detail',
            category: 'services',
            keywords: ['marketing', 'marketing express', 'marketing strategy', 'marketing impact', 'strategie marketing', 'analyse marketing', 'positionnement marketing', 'branding', 'audience', 'digital', 'conseil marketing', 'communication digitale'],
            response: 'Nos prestations marketing :\n\n\u2022 EXPRESS : 120 \u20ac \u2014 analyse de votre projet + clarification de votre audience cible\n\u2022 STRATEGY : 150 \u20ac \u2014 positionnement, message, branding (option Digital +70 \u20ac)\n\u2022 IMPACT : 350 \u20ac \u2014 diagnostic approfondi + plan de publication sur 30 jours\n\u2022 CUSTOM : sur devis\n\nChaque prestation vous donne des recommandations concr\u00e8tes et actionnables.',
            quickReplies: ['Voir les offres', 'Contacter l\u2019\u00e9quipe'],
            link: { url: 'offres.html', label: 'Voir les prestations marketing' }
        },
        {
            id: 'media_detail',
            category: 'services',
            keywords: ['media', 'media visibility', 'media impact', 'media premium', 'media promotion', 'publication media', 'presse', 'article', 'credibilite media', 'post media', 'story media', 'stories', 'publication'],
            response: 'Nos prestations m\u00e9dia (publication sur m\u00e9dias cr\u00e9dibles) :\n\n\u2022 VISIBILITY : 223 \u20ac \u2014 4 posts/stories sur 1 m\u00e9dia cr\u00e9dible\n\u2022 IMPACT : 420 \u20ac \u2014 6 posts/stories\n\u2022 PREMIUM : 590 \u20ac \u2014 8 posts/stories + cr\u00e9dibilit\u00e9 long terme\n\u2022 PROMOTION : 679 \u20ac \u2014 12 posts/stories + audience cibl\u00e9e\n\u2022 CUSTOM : sur devis\n\nGagnez en cr\u00e9dibilit\u00e9 gr\u00e2ce \u00e0 des publications sur des m\u00e9dias reconnus.',
            quickReplies: ['Voir les offres', 'Contacter l\u2019\u00e9quipe'],
            link: { url: 'offres.html', label: 'Voir les prestations m\u00e9dia' }
        },

        // ===================== PROCESSUS D\u00c9TAILL\u00c9 =====================
        {
            id: 'first_steps',
            category: 'accompagnement',
            keywords: ['premiere etape', 'comment commencer', 'apres inscription', 'apres paiement', 'demarrage', 'comment ca demarre', 'suite inscription', 'que se passe'],
            response: 'Apr\u00e8s votre inscription et le paiement de l\u2019acompte (30 %), voici ce qui se passe :\n\n1. Acc\u00e8s \u00e0 votre espace client\n2. R\u00e9ception des documents d\u2019accueil\n3. Planification de votre premi\u00e8re s\u00e9ance strat\u00e9gique\n4. D\u00e9but de l\u2019accompagnement selon votre offre\n\nNotre \u00e9quipe vous contacte rapidement pour organiser le d\u00e9marrage.',
            quickReplies: ['Voir les offres', 'Contacter l\u2019\u00e9quipe'],
            link: null
        },
        {
            id: 'strategic_session',
            category: 'accompagnement',
            keywords: ['seance strategique', 'seance strategie', 'session strategique', 'c\'est quoi la seance', 'comment se passe la seance', 'premiere seance', 'consultation', 'rdv strategique'],
            response: 'La s\u00e9ance strat\u00e9gique est le c\u0153ur de chaque accompagnement. C\u2019est un rendez-vous en visioconf\u00e9rence o\u00f9 nous :\n\n\u2022 Clarifions votre id\u00e9e et vos objectifs\n\u2022 Analysons votre positionnement\n\u2022 D\u00e9finissons une strat\u00e9gie adapt\u00e9e\n\u2022 \u00c9laborons un plan d\u2019action concret\n\nDur\u00e9e : 45 min (IDEA) \u00e0 1h30 (autres offres). C\u2019est un moment d\u2019\u00e9change personnalis\u00e9.',
            quickReplies: ['Comment \u00e7a marche ?', 'Voir les offres'],
            link: null
        },
        {
            id: 'what_to_prepare',
            category: 'accompagnement',
            keywords: ['preparer', 'preparation', 'avant seance', 'besoin de quoi', 'apporter', 'fournir', 'prevoir', 'quoi amener'],
            response: 'Pour profiter au maximum de votre accompagnement, voici ce que vous pouvez pr\u00e9parer :\n\n\u2022 Une description de votre id\u00e9e ou projet (m\u00eame br\u00e8ve)\n\u2022 Vos objectifs principaux\n\u2022 Votre cible / public vis\u00e9 (si vous le savez)\n\u2022 Vos questions et attentes\n\nPas de panique si vous n\u2019avez pas tout ! La s\u00e9ance strat\u00e9gique sert justement \u00e0 clarifier tout cela ensemble.',
            quickReplies: ['Comment \u00e7a marche ?', 'Voir les offres'],
            link: null
        },
        {
            id: 'deliverables_format',
            category: 'accompagnement',
            keywords: ['format livrable', 'format photo', 'format video', 'qualite livrable', 'resolution', 'haute definition', 'hd', 'raw', 'brut', 'retouch'],
            response: 'Tous vos livrables sont fournis en qualit\u00e9 professionnelle :\n\n\u2022 Photos : haute r\u00e9solution, retouch\u00e9es, pr\u00eates pour les r\u00e9seaux sociaux et l\u2019impression\n\u2022 Vid\u00e9os : mont\u00e9es, optimis\u00e9es pour les r\u00e9seaux sociaux (formats adapt\u00e9s)\n\u2022 Documents : PDF accessibles depuis votre espace client\n\nVous conservez tous vos livrables \u00e0 vie, m\u00eame apr\u00e8s la fin de l\u2019accompagnement.',
            quickReplies: ['Voir les offres'],
            link: null
        },
        {
            id: 'video_call',
            category: 'accompagnement',
            keywords: ['visio', 'visioconference', 'zoom', 'meet', 'google meet', 'teams', 'appel video', 'en ligne seance'],
            response: 'Oui, toutes nos s\u00e9ances strat\u00e9giques et consultations se font en visioconf\u00e9rence. Cela vous permet d\u2019en b\u00e9n\u00e9ficier o\u00f9 que vous soyez en France (ou m\u00eame \u00e0 l\u2019\u00e9tranger). Le lien de connexion vous est envoy\u00e9 avant chaque s\u00e9ance.',
            quickReplies: ['Comment \u00e7a marche ?', 'Voir les offres'],
            link: null
        },
        {
            id: 'urgency',
            category: 'accompagnement',
            keywords: ['urgent', 'rapidement', 'vite', 'presse', 'deadline', 'delai court', 'quand commencer', 'disponibilite', 'place disponible', 'tout de suite'],
            response: 'Nous faisons notre possible pour d\u00e9marrer rapidement. Apr\u00e8s le paiement de l\u2019acompte, l\u2019accompagnement peut commencer sous quelques jours selon les disponibilit\u00e9s. Pour un besoin urgent, contactez-nous directement par t\u00e9l\u00e9phone au +33 7 64 16 36 09.',
            quickReplies: ['Contacter l\u2019\u00e9quipe'],
            link: null
        },
        {
            id: 'what_media_means',
            category: 'accompagnement',
            keywords: ['media credible', 'c\'est quoi media', 'quel media', 'acces media', 'parution', 'quoi media', 'media inclus'],
            response: 'L\u2019acc\u00e8s m\u00e9dia inclus dans certaines offres vous permet d\u2019\u00eatre publi\u00e9(e) sur un ou plusieurs m\u00e9dias en ligne reconnus et cr\u00e9dibles. Cela renforce votre visibilit\u00e9 et votre cr\u00e9dibilit\u00e9 aupr\u00e8s de votre audience. Le nombre de publications (posts/stories) d\u00e9pend de l\u2019offre choisie.',
            quickReplies: ['Voir les offres', 'Tarifs individuels'],
            link: null
        },

        // ===================== OFFRES COMPL\u00c9MENT =====================
        {
            id: 'upgrade_offer',
            category: 'offres',
            keywords: ['changer offre', 'upgrade', 'passer a', 'modifier offre', 'evoluer', 'monter en gamme', 'changer de formule', 'augmenter offre'],
            response: 'Oui, il est possible d\u2019ajuster votre accompagnement en cours de route. Si vous souhaitez passer \u00e0 une offre sup\u00e9rieure ou ajouter des services (photo, vid\u00e9o, m\u00e9dia), contactez notre \u00e9quipe. Nous trouverons la meilleure solution adapt\u00e9e \u00e0 vos besoins.',
            quickReplies: ['Contacter l\u2019\u00e9quipe', 'Voir les offres'],
            link: null
        },
        {
            id: 'free_consultation',
            category: 'offres',
            keywords: ['gratuit', 'essai', 'consultation gratuite', 'sans engagement', 'decouvrir', 'tester', 'essayer'],
            response: 'Nous ne proposons pas de consultation gratuite \u00e0 proprement parler, mais notre \u00e9quipe est disponible pour r\u00e9pondre \u00e0 toutes vos questions avant de vous engager. Vous pouvez nous contacter par e-mail, t\u00e9l\u00e9phone ou via le formulaire de contact pour discuter de votre projet sans obligation.',
            quickReplies: ['Contacter l\u2019\u00e9quipe', 'Voir les offres'],
            link: { url: 'contact.html', label: 'Nous contacter' }
        },
        {
            id: 'student_proof',
            category: 'offres',
            keywords: ['justificatif etudiant', 'carte etudiant', 'prouver etudiant', 'certificat scolarite', 'statut etudiant', 'preuve etudiant'],
            response: 'Pour b\u00e9n\u00e9ficier des tarifs \u00e9tudiants, un justificatif peut vous \u00eatre demand\u00e9 (carte \u00e9tudiante, certificat de scolarit\u00e9, etc.). Contactez notre \u00e9quipe pour plus de d\u00e9tails sur les conditions d\u2019\u00e9ligibilit\u00e9.',
            quickReplies: ['Offres \u00c9tudiants', 'Contacter l\u2019\u00e9quipe'],
            link: null
        },
        {
            id: 'group_offer',
            category: 'offres',
            keywords: ['groupe', 'equipe', 'ami', 'ensemble', 'collectif', 'association', 'duo', 'binome', 'plusieurs personnes'],
            response: 'Si vous souhaitez vous inscrire \u00e0 plusieurs (amis, associ\u00e9s, \u00e9quipe), contactez notre \u00e9quipe pour une offre adapt\u00e9e. Nous pouvons proposer des accompagnements de groupe ou des tarifs sp\u00e9ciaux selon votre situation.',
            quickReplies: ['Contacter l\u2019\u00e9quipe', 'Voir les offres'],
            link: { url: 'contact.html', label: 'Demander un devis groupe' }
        },

        // ===================== G\u00c9N\u00c9RAL COMPL\u00c9MENT =====================
        {
            id: 'company_values',
            category: 'general',
            keywords: ['valeur', 'mission', 'vision', 'philosophie', 'approche', 'methode', 'innovation', 'authenticite', 'ambition'],
            response: 'FA Genesis repose sur trois valeurs fondamentales :\n\n\u2022 INNOVATION \u2014 Nous croyons en l\u2019innovation comme moteur de transformation\n\u2022 AUTHENTICIT\u00c9 \u2014 Votre identit\u00e9 unique est au c\u0153ur de notre approche\n\u2022 AMBITION \u2014 Nous accompagnons ceux qui osent voir grand\n\nNotre mission : transformer une id\u00e9e en un projet structur\u00e9, cr\u00e9dible et visible. Build. Launch. Impact.',
            quickReplies: ['C\u2019est quoi FA Genesis ?', 'Voir les offres'],
            link: { url: 'a-propos.html', label: 'En savoir plus' }
        },
        {
            id: 'fa_industries',
            category: 'general',
            keywords: ['fa industries', 'ecosysteme', 'groupe', 'maison mere', 'structure', 'holding'],
            response: 'FA Genesis fait partie de l\u2019\u00e9cosyst\u00e8me FA Industries. FA Genesis est le p\u00f4le d\u00e9di\u00e9 \u00e0 l\u2019incubation strat\u00e9gique : nous aidons les porteurs de projets \u00e0 structurer, lancer et rendre visible leur id\u00e9e. C\u2019est le hub qui fournit cadre, m\u00e9thode et r\u00e9seau \u00e0 ceux qui osent construire leur avenir.',
            quickReplies: ['C\u2019est quoi FA Genesis ?'],
            link: { url: 'a-propos.html', label: 'Page \u00c0 propos' }
        },
        {
            id: 'build_launch_impact',
            category: 'general',
            keywords: ['build', 'launch', 'impact', 'trois piliers', 'pilier', 'methodologie', 'etapes cles'],
            response: 'Notre m\u00e9thodologie repose sur trois piliers :\n\n\u2022 BUILD \u2014 Structurer votre id\u00e9e, votre vision et votre positionnement\n\u2022 LAUNCH \u2014 Cr\u00e9er votre image professionnelle et une visibilit\u00e9 coh\u00e9rente (photo, vid\u00e9o, m\u00e9dia)\n\u2022 IMPACT \u2014 G\u00e9n\u00e9rer des r\u00e9sultats concrets et durables gr\u00e2ce \u00e0 un plan d\u2019action clair\n\nChaque accompagnement suit cette progression pour maximiser vos chances de r\u00e9ussite.',
            quickReplies: ['Comment \u00e7a marche ?', 'Voir les offres'],
            link: null
        },
        {
            id: 'testimonials',
            category: 'general',
            keywords: ['temoignage', 'avis', 'retour', 'experience client', 'client satisfait', 'exemple', 'portfolio', 'reference', 'cas client', 'resultat client', 'preuve'],
            response: 'Nous avons accompagn\u00e9 plus de 100 projets avec un taux de satisfaction de 95 %. Nos clients appr\u00e9cient particuli\u00e8rement l\u2019approche personnalis\u00e9e et les r\u00e9sultats concrets (photos, vid\u00e9os, plan d\u2019action). N\u2019h\u00e9sitez pas \u00e0 consulter notre page d\u2019accueil ou nos r\u00e9seaux sociaux pour d\u00e9couvrir nos r\u00e9alisations.',
            quickReplies: ['Voir les offres', 'Contacter l\u2019\u00e9quipe'],
            link: null
        },
        {
            id: 'language',
            category: 'general',
            keywords: ['langue', 'francais', 'anglais', 'english', 'language', 'parlez'],
            response: 'Nos accompagnements sont principalement dispens\u00e9s en fran\u00e7ais. Si vous avez des besoins sp\u00e9cifiques concernant la langue, n\u2019h\u00e9sitez pas \u00e0 nous contacter pour en discuter.',
            quickReplies: ['Contacter l\u2019\u00e9quipe'],
            link: null
        },
        {
            id: 'data_privacy',
            category: 'general',
            keywords: ['donnees', 'rgpd', 'confidentialite', 'vie privee', 'protection', 'donnees personnelles', 'securite donnees'],
            response: 'La protection de vos donn\u00e9es personnelles est une priorit\u00e9. Vos informations sont utilis\u00e9es uniquement dans le cadre de votre accompagnement et ne sont jamais partag\u00e9es avec des tiers sans votre consentement. Les paiements sont s\u00e9curis\u00e9s via SumUp.',
            quickReplies: [],
            link: null
        }
    ];

    // Mapping boutons rapides -> messages utilisateur
    var QUICK_REPLY_MAP = {
        'C\u2019est quoi FA Genesis ?': 'C\u2019est quoi Financial Advice Genesis ?',
        'Voir les offres': 'Quelles sont vos offres ?',
        'Contacter l\u2019\u00e9quipe': 'Comment vous contacter ?',
        'Comment \u00e7a marche ?': 'Comment fonctionne l\u2019accompagnement ?',
        'Offres \u00c9tudiants': 'Quelles sont les offres \u00e9tudiants ?',
        'Offres Particuliers': 'Quelles sont les offres particuliers ?',
        'Offres Entreprises': 'Quelles sont les offres entreprises ?',
        'Voir les offres \u00e9tudiants': 'Quelles sont les offres \u00e9tudiants ?',
        'Voir les offres particuliers': 'Quelles sont les offres particuliers ?',
        'Voir les offres entreprises': 'Quelles sont les offres entreprises ?',
        'Tarifs individuels': 'Quels sont vos tarifs individuels ?',
        'Voir les tarifs individuels': 'Quels sont vos tarifs individuels ?',
        'Payer en plusieurs fois ?': 'Est-ce que je peux payer en plusieurs fois ?',
        'Combien de temps ?': 'Combien de temps dure un accompagnement ?',
        'Offres et tarifs': 'Quelles sont vos offres et tarifs ?',
        'Paiement': 'Comment fonctionne le paiement ?',
        'Espace client': 'Comment acc\u00e9der \u00e0 mon espace client ?',
        'Contact': 'Comment vous contacter ?',
        'Voir la FAQ': '__FAQ_REDIRECT__',
        'Oui, transmettre ma question': '__ESCALATION__'
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
                + '#fa-chatbot-trigger { width: 60px; height: 60px; background: #FFD700; border: 4px solid #000; box-shadow: 6px 6px 0px #000; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.1s, box-shadow 0.1s; }'
                + '#fa-chatbot-trigger:hover { transform: translate(-2px, -2px); box-shadow: 8px 8px 0px #000; }'
                + '#fa-chatbot-trigger:active { transform: translate(4px, 4px); box-shadow: 0px 0px 0px #000; }'
                + '#fa-chatbot-trigger svg { width: 32px; height: 32px; fill: #000; }'
                + '#fa-chatbot-window { display: none; flex-direction: column; position: fixed; bottom: 20px; right: 20px; width: 400px; height: 550px; background: #000; border: 4px solid #000; box-shadow: 10px 10px 0px #FFD700; z-index: 35; overflow: hidden; }'
                + '#fa-chatbot-header { background: #FFD700; color: #000; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #000; }'
                + '#fa-chatbot-header-left { display: flex; align-items: center; gap: 10px; }'
                + '#fa-chatbot-header-icon svg { width: 22px; height: 22px; fill: #000; }'
                + '#fa-chatbot-header-title { font-family: "Unbounded", cursive; font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }'
                + '#fa-chatbot-close { background: none; border: none; font-size: 24px; cursor: pointer; font-weight: 900; color: #000; padding: 0 4px; line-height: 1; }'
                + '#fa-chatbot-close:hover { opacity: 0.6; }'
                + '#fa-chatbot-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }'
                + '#fa-chatbot-messages::-webkit-scrollbar { width: 6px; }'
                + '#fa-chatbot-messages::-webkit-scrollbar-track { background: #111; }'
                + '#fa-chatbot-messages::-webkit-scrollbar-thumb { background: #FFD700; }'
                + '.fa-chatbot-msg { max-width: 85%; padding: 12px 16px; font-size: 14px; line-height: 1.5; white-space: pre-line; word-wrap: break-word; }'
                + '.fa-chatbot-msg.bot { background: #FFD700; color: #000; border: 3px solid #000; align-self: flex-start; font-weight: 500; }'
                + '.fa-chatbot-msg.user { background: #fff; color: #000; border: 3px solid #000; align-self: flex-end; font-weight: 700; }'
                + '.fa-chatbot-msg-link { display: inline-block; margin-top: 10px; background: #000; color: #FFD700; padding: 8px 16px; border: 2px solid #FFD700; font-weight: 900; text-transform: uppercase; font-size: 12px; text-decoration: none; letter-spacing: 0.5px; transition: background 0.2s, color 0.2s; }'
                + '.fa-chatbot-msg-link:hover { background: #FFD700; color: #000; }'
                + '#fa-chatbot-typing { display: none; align-self: flex-start; padding: 12px 20px; background: #FFD700; border: 3px solid #000; }'
                + '.fa-chatbot-dot { display: inline-block; width: 8px; height: 8px; background: #000; border-radius: 50%; margin: 0 2px; animation: faChatbotBounce 1.4s infinite ease-in-out both; }'
                + '.fa-chatbot-dot:nth-child(1) { animation-delay: -0.32s; }'
                + '.fa-chatbot-dot:nth-child(2) { animation-delay: -0.16s; }'
                + '@keyframes faChatbotBounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }'
                + '#fa-chatbot-quick-replies { padding: 8px 16px; display: flex; flex-wrap: wrap; gap: 8px; border-top: 2px solid #222; background: #000; }'
                + '.fa-chatbot-quick-btn { background: transparent; border: 2px solid #FFD700; color: #FFD700; padding: 6px 14px; font-size: 12px; font-weight: 700; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px; transition: background 0.2s, color 0.2s; font-family: "Space Grotesk", sans-serif; }'
                + '.fa-chatbot-quick-btn:hover { background: #FFD700; color: #000; }'
                + '#fa-chatbot-input-area { display: flex; border-top: 4px solid #000; }'
                + '#fa-chatbot-input { flex: 1; padding: 14px 16px; border: none; background: #fff; font-size: 14px; font-family: "Space Grotesk", sans-serif; outline: none; color: #000; }'
                + '#fa-chatbot-input::placeholder { color: #999; text-transform: uppercase; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; }'
                + '#fa-chatbot-send { background: #FFD700; border: none; border-left: 4px solid #000; padding: 14px 18px; cursor: pointer; font-weight: 900; font-size: 16px; color: #000; transition: background 0.2s; }'
                + '#fa-chatbot-send:hover { background: #e6c200; }'
                + '#fa-chatbot-escalation { display: none; padding: 16px; background: #111; border-top: 4px solid #FFD700; }'
                + '#fa-chatbot-escalation h4 { color: #FFD700; font-family: "Unbounded", cursive; font-weight: 900; font-size: 13px; text-transform: uppercase; margin: 0 0 12px 0; }'
                + '#fa-chatbot-escalation input, #fa-chatbot-escalation textarea { width: 100%; padding: 10px 12px; border: 3px solid #333; background: #222; color: #fff; font-size: 13px; font-family: "Space Grotesk", sans-serif; margin-bottom: 8px; box-sizing: border-box; outline: none; }'
                + '#fa-chatbot-escalation input:focus, #fa-chatbot-escalation textarea:focus { border-color: #FFD700; }'
                + '#fa-chatbot-escalation textarea { height: 60px; resize: none; }'
                + '#fa-chatbot-esc-submit { width: 100%; background: #FFD700; color: #000; border: 3px solid #000; padding: 10px; font-weight: 900; font-size: 13px; text-transform: uppercase; cursor: pointer; font-family: "Space Grotesk", sans-serif; letter-spacing: 0.5px; }'
                + '#fa-chatbot-esc-submit:hover { background: #e6c200; }'
                + '#fa-chatbot-esc-cancel { width: 100%; background: transparent; color: #999; border: none; padding: 8px; font-size: 12px; cursor: pointer; margin-top: 4px; font-family: "Space Grotesk", sans-serif; }'
                + '#fa-chatbot-esc-cancel:hover { color: #fff; }'
                + '@media (max-width: 768px) {'
                // Bouton trigger mobile : plus petit, bien positionn\u00e9
                + '  #fa-chatbot-container { bottom: 16px; right: 16px; z-index: 9999; }'
                + '  #fa-chatbot-trigger { width: 52px; height: 52px; box-shadow: 4px 4px 0px #000; }'
                + '  #fa-chatbot-trigger svg { width: 28px; height: 28px; }'
                // Fen\u00eatre plein \u00e9cran sur mobile
                + '  #fa-chatbot-window { top: 0; left: 0; right: 0; bottom: 0; width: 100% !important; height: 100% !important; max-height: 100vh; max-height: 100dvh; border: none; box-shadow: none; border-radius: 0; z-index: 99999; }'
                // Header mobile : safe area pour iPhone notch
                + '  #fa-chatbot-header { padding: 12px 16px; padding-top: max(12px, env(safe-area-inset-top, 12px)); }'
                + '  #fa-chatbot-header-title { font-size: 12px; letter-spacing: 0.5px; }'
                + '  #fa-chatbot-header-icon svg { width: 20px; height: 20px; }'
                // Bouton fermer : zone tactile agrandie
                + '  #fa-chatbot-close { font-size: 28px; padding: 4px 8px; min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center; }'
                // Messages mobile : scroll fluide iOS
                + '  #fa-chatbot-messages { padding: 12px; gap: 10px; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }'
                + '  .fa-chatbot-msg { max-width: 90%; padding: 10px 14px; font-size: 14px; line-height: 1.5; }'
                + '  .fa-chatbot-msg-link { padding: 10px 16px; font-size: 12px; min-height: 44px; display: inline-flex; align-items: center; }'
                // Quick replies mobile : boutons plus gros pour le tactile
                + '  #fa-chatbot-quick-replies { padding: 10px 12px; gap: 6px; overflow-x: auto; flex-wrap: wrap; -webkit-overflow-scrolling: touch; max-height: 120px; overflow-y: auto; }'
                + '  .fa-chatbot-quick-btn { padding: 8px 12px; font-size: 11px; min-height: 36px; white-space: nowrap; }'
                // Input mobile : font-size 16px pour emp\u00eacher le zoom auto iOS
                + '  #fa-chatbot-input-area { border-top: 3px solid #000; padding-bottom: env(safe-area-inset-bottom, 0px); background: #fff; }'
                + '  #fa-chatbot-input { padding: 12px 14px; font-size: 16px; }'
                + '  #fa-chatbot-input::placeholder { font-size: 12px; }'
                + '  #fa-chatbot-send { padding: 12px 16px; font-size: 18px; min-width: 50px; min-height: 48px; }'
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

    // SVG t\u00eate de robot
    var ROBOT_SVG = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a1 1 0 0 1 1 1v2h3a3 3 0 0 1 3 3v1h1a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-1v2a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-2H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h1V8a3 3 0 0 1 3-3h3V3a1 1 0 0 1 1-1zM8 7a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H8zm1.5 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm5 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM10 15h4a1 1 0 0 1 0 2h-4a1 1 0 0 1 0-2z"/></svg>';

    function createWidget() {
        try {
            var container = document.createElement('div');
            container.id = 'fa-chatbot-container';

            // Bouton trigger avec ic\u00f4ne robot
            var trigger = document.createElement('button');
            trigger.id = 'fa-chatbot-trigger';
            trigger.setAttribute('aria-label', 'Ouvrir l\u2019assistant FA Genesis');
            trigger.innerHTML = ROBOT_SVG;

            // Fen\u00eatre chat
            var chatWindow = document.createElement('div');
            chatWindow.id = 'fa-chatbot-window';

            // Header avec ic\u00f4ne robot
            var header = document.createElement('div');
            header.id = 'fa-chatbot-header';
            header.innerHTML = '<div id="fa-chatbot-header-left"><span id="fa-chatbot-header-icon">' + ROBOT_SVG + '</span><span id="fa-chatbot-header-title">FA Genesis Assistant</span></div>';

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
                        'D\u00e9sol\u00e9, une erreur est survenue. Vous pouvez nous contacter directement \u00e0 financialadvicegenesis@gmail.com',
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
                            'Une erreur est survenue lors de l\u2019envoi. Vous pouvez aussi nous contacter directement par e-mail : financialadvicegenesis@gmail.com',
                            ['Contacter l\u2019\u00e9quipe'],
                            null
                        );
                    }
                } catch (e) {
                    addBotMessage('Une erreur est survenue. Contactez-nous \u00e0 financialadvicegenesis@gmail.com', [], null);
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
                        'Impossible de joindre le serveur pour le moment. Vous pouvez nous \u00e9crire directement \u00e0 financialadvicegenesis@gmail.com ou appeler le +33 7 64 16 36 09.',
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
