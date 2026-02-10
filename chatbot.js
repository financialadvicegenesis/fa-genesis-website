// ============================================================
// FA GENESIS - Chatbot IA Guide
// Widget auto-contenu (CSS + HTML + logique)
// ============================================================
(function() {
    'use strict';

    // ============================================================
    // A) CONFIGURATION
    // ============================================================
    var CHATBOT_CONFIG = {
        botName: 'Genesis Bot',
        welcomeMessage: 'Bonjour ! Je suis l\'assistant FA Genesis. Comment puis-je vous aider ?',
        apiBaseUrl: (typeof window !== 'undefined' && window.FA_GENESIS_API) ? window.FA_GENESIS_API : 'https://fa-genesis-website.onrender.com',
        typingDelay: 800,
        escalationThreshold: 2
    };

    var unmatchedCount = 0;
    var chatInitialized = false;
    var isOpen = false;

    // ============================================================
    // B) BASE DE CONNAISSANCES (27 entrees)
    // ============================================================
    var KNOWLEDGE_BASE = [
        // === GENERAL ===
        {
            id: 'what_is_fa_genesis',
            category: 'general',
            keywords: ['c\'est quoi', 'qu\'est-ce que', 'qu est ce', 'financial advice', 'fa genesis', 'genesis c\'est', 'qui etes', 'qui vous', 'c est quoi', 'votre entreprise', 'votre societe', 'presentez', 'a propos'],
            response: 'Financial Advice Genesis accompagne les etudiants et les entrepreneurs debutants a transformer une idee en un projet structure, credible et visible. On vous aide a clarifier votre vision, structurer votre projet et gagner en visibilite, le tout a un cout accessible.',
            quickReplies: ['Voir les offres', 'Comment ca marche ?', 'Contacter l\'equipe'],
            link: null
        },
        {
            id: 'who_is_it_for',
            category: 'general',
            keywords: ['pour qui', 'a qui', 's\'adresse', 'cible', 'public', 'porteur de projet', 'jeune'],
            response: 'Nos accompagnements s\'adressent aux etudiants, aux porteurs de projets, aux jeunes entrepreneurs, aux particuliers et aux entreprises. Que vous ayez deja un projet ou juste une idee, on peut vous aider.',
            quickReplies: ['Offres Etudiants', 'Offres Particuliers', 'Offres Entreprises'],
            link: null
        },
        {
            id: 'no_project_yet',
            category: 'general',
            keywords: ['pas de projet', 'pas encore', 'juste une idee', 'je sais pas', 'commencer', 'debuter', 'je ne sais pas par ou', 'je debute', 'aucune idee'],
            response: 'Pas de souci ! Vous n\'avez pas besoin d\'avoir un projet tout pret. Vous pouvez venir avec une idee, un debut de reflexion ou meme juste une envie. On vous aide a clarifier et structurer tout ca.',
            quickReplies: ['Voir les offres', 'Comment ca marche ?'],
            link: null
        },
        {
            id: 'about_partners',
            category: 'general',
            keywords: ['partenaire', 'photographe', 'videast', 'collaboration', 'travaillez avec'],
            response: 'Oui, nous travaillons avec des photographes, videastes et medias partenaires pour offrir une experience complete a nos clients.',
            quickReplies: [],
            link: null
        },
        {
            id: 'student_adapted',
            category: 'general',
            keywords: ['adapte etudiant', 'prix etudiant', 'budget etudiant', 'abordable', 'pas cher', 'accessible', 'etudiant'],
            response: 'Absolument ! Nos offres ont ete pensees en tenant compte de la realite financiere des etudiants en France. Les prix etudiants commencent a partir de 50 euros. Vous pouvez consulter tous les details sur notre page offres.',
            quickReplies: ['Offres Etudiants'],
            link: { url: 'offres.html', label: 'Voir les offres etudiants' }
        },

        // === OFFRES ===
        {
            id: 'offers_overview',
            category: 'offres',
            keywords: ['offre', 'formule', 'forfait', 'pack', 'programme', 'quelles offres', 'vos services', 'proposez'],
            response: 'Nous proposons plusieurs categories d\'offres :\n\n\u2022 ETUDIANTS : de 50\u20ac (2 jours) a 290\u20ac (1 mois)\n\u2022 PARTICULIERS : de 149\u20ac (2 jours) a 1490\u20ac (1 mois)\n\u2022 ENTREPRISES : de 1490\u20ac (7 jours) a 4900\u20ac (30 jours)\n\u2022 Prestations individuelles : Photo, Video, Marketing, Media\n\nChaque categorie propose aussi des offres sur mesure. Retrouvez tous les details sur notre page offres.',
            quickReplies: ['Offres Etudiants', 'Offres Particuliers', 'Offres Entreprises', 'Services individuels'],
            link: { url: 'offres.html', label: 'Voir toutes les offres' }
        },
        {
            id: 'student_offers',
            category: 'offres',
            keywords: ['offre etudiant', 'etudiant idea', 'etudiant starter', 'etudiant launch', 'etudiant impact', 'tarif etudiant'],
            response: 'Voici nos offres pour les etudiants :\n\n\u2022 IDEA : 50\u20ac / 2 jours \u2014 mini seance strategie + structuration + plan d\'action\n\u2022 STARTER : 100\u20ac / 7 jours \u2014 seance complete + structuration + conseils visibilite\n\u2022 LAUNCH : 189\u20ac / 14 jours \u2014 strategie + video + media + plan de diffusion\n\u2022 IMPACT : 290\u20ac / 1 mois \u2014 accompagnement complet avec photo, video, media\n\u2022 CUSTOM : sur mesure\n\nTous les details sont sur la page offres.',
            quickReplies: [],
            link: { url: 'offres.html', label: 'Voir les offres etudiants' }
        },
        {
            id: 'particulier_offers',
            category: 'offres',
            keywords: ['offre particulier', 'particulier idea', 'particulier starter', 'particulier launch', 'particulier impact', 'tarif particulier'],
            response: 'Voici nos offres pour les particuliers :\n\n\u2022 IDEA : 149\u20ac / 2 jours\n\u2022 STARTER : 490\u20ac / 7 jours\n\u2022 LAUNCH : 790\u20ac / 14 jours\n\u2022 IMPACT : 1490\u20ac / 1 mois\n\u2022 CUSTOM : sur mesure\n\nChaque offre inclut une seance strategique et un accompagnement progressif. Consultez la page offres pour le detail complet.',
            quickReplies: [],
            link: { url: 'offres.html', label: 'Voir les offres particuliers' }
        },
        {
            id: 'enterprise_offers',
            category: 'offres',
            keywords: ['offre entreprise', 'entreprise start', 'entreprise visibility', 'entreprise impact', 'tarif entreprise', 'prix entreprise', 'b2b'],
            response: 'Voici nos offres pour les entreprises :\n\n\u2022 START : 1490\u20ac / 7 jours \u2014 positionnement + strategie + plan d\'action\n\u2022 VISIBILITY : 2990\u20ac / 14 jours \u2014 storytelling + shooting + video + media\n\u2022 IMPACT : 4900\u20ac / 30 jours \u2014 accompagnement premium complet\n\u2022 CUSTOM : sur mesure\n\nPour un devis personnalise, n\'hesitez pas a contacter l\'equipe.',
            quickReplies: ['Contacter l\'equipe'],
            link: { url: 'offres.html', label: 'Voir les offres entreprises' }
        },
        {
            id: 'individual_services',
            category: 'offres',
            keywords: ['photo', 'video', 'marketing', 'media', 'shooting', 'tournage', 'prestation', 'service individuel', 'tarif photo', 'tarif video'],
            response: 'Nous proposons aussi des prestations individuelles :\n\n\u2022 PHOTO : a partir de 180\u20ac (8 photos retouchees)\n\u2022 VIDEO : a partir de 120\u20ac (1 video courte)\n\u2022 MARKETING : a partir de 120\u20ac (analyse + recommandations)\n\u2022 MEDIA : a partir de 223\u20ac (publication sur media credible)\n\nTous les details sont sur la page offres.',
            quickReplies: [],
            link: { url: 'offres.html', label: 'Voir les prestations individuelles' }
        },
        {
            id: 'custom_offer',
            category: 'offres',
            keywords: ['sur mesure', 'custom', 'personnalise', 'specifique', 'adapte', 'podcast', 'besoin particulier', 'devis'],
            response: 'Oui, nous proposons des offres sur mesure (CUSTOM) dans chaque categorie. Si votre besoin est specifique (podcast, projet particulier, entreprise, etc.), l\'equipe peut creer une offre adaptee a vos besoins. Le mieux est de nous contacter pour en discuter.',
            quickReplies: ['Contacter l\'equipe'],
            link: { url: 'contact.html', label: 'Demander un devis' }
        },

        // === PAIEMENT ===
        {
            id: 'payment_how',
            category: 'paiement',
            keywords: ['payer', 'paiement', 'prix', 'combien', 'cout', 'tarif', 'comment payer', 'moyen de paiement', 'combien ca coute'],
            response: 'Les prix sont affiches directement sur notre site et sur notre page Instagram. Le paiement fonctionne en deux etapes :\n\n\u2022 Un acompte de 30% pour demarrer\n\u2022 Le solde de 70% a la fin de l\'accompagnement\n\nNous proposons aussi des facilites de paiement.',
            quickReplies: ['Payer en plusieurs fois ?', 'Voir les offres'],
            link: { url: 'offres.html', label: 'Voir les prix' }
        },
        {
            id: 'payment_installments',
            category: 'paiement',
            keywords: ['plusieurs fois', 'echelon', 'facilite', 'mensualite', 'etaler', 'en 2 fois', 'en 3 fois', 'en 4 fois', 'echelonne'],
            response: 'Oui, certains accompagnements peuvent etre payes en plusieurs fois, surtout pour les etudiants. Le nombre d\'echeances depend de l\'offre choisie. N\'hesitez pas a contacter l\'equipe pour plus de details sur les facilites de paiement.',
            quickReplies: ['Contacter l\'equipe', 'Voir les offres'],
            link: null
        },
        {
            id: 'deposit_balance',
            category: 'paiement',
            keywords: ['acompte', 'solde', '30%', '70%', 'reste a payer', 'premier paiement', 'depot'],
            response: 'Le paiement se fait en deux temps :\n\n\u2022 30% d\'acompte au demarrage de l\'accompagnement\n\u2022 70% de solde a la fin\n\nCe systeme vous permet de commencer sans tout payer d\'un coup. L\'acompte active votre acces a l\'espace client.',
            quickReplies: ['Voir les offres'],
            link: null
        },

        // === ACCOMPAGNEMENT ===
        {
            id: 'how_it_works',
            category: 'accompagnement',
            keywords: ['comment ca marche', 'comment fonctionne', 'deroulement', 'etape', 'processus', 'fonctionnement', 'comment se passe', 'comment ca se passe'],
            response: 'L\'accompagnement se deroule en plusieurs etapes :\n\n1. Clarification de votre idee\n2. Structuration du projet\n3. Visibilite (photo, video, media selon l\'offre)\n4. Plan d\'action concret\n\nChaque accompagnement est simple, progressif et sans pression. Vous avancez a votre rythme avec un suivi adapte.',
            quickReplies: ['Voir les offres', 'Combien de temps ?'],
            link: null
        },
        {
            id: 'duration',
            category: 'accompagnement',
            keywords: ['duree', 'combien de temps', 'jours', 'semaines', 'mois', 'long', 'rapide', 'dure'],
            response: 'La duree depend de l\'offre choisie :\n\n\u2022 IDEA : 2 jours\n\u2022 STARTER : 7 jours\n\u2022 LAUNCH : 14 jours\n\u2022 IMPACT : 1 mois\n\u2022 CUSTOM : variable selon vos besoins\n\nChaque offre est concue pour aller a l\'essentiel dans le temps imparti.',
            quickReplies: ['Voir les offres'],
            link: null
        },
        {
            id: 'guarantee',
            category: 'accompagnement',
            keywords: ['garantie', 'resultat', 'reussite', 'succes', 'ca marche', 'efficace', 'certitude', 'assure'],
            response: 'Nous ne garantissons pas le succes d\'un projet, car cela depend enormement de votre volonte et de votre engagement. En revanche, nous garantissons un accompagnement serieux, structure et adapte a votre situation. Nous mettons tout en oeuvre pour vous donner les meilleures chances de reussir.',
            quickReplies: [],
            link: null
        },

        // === ESPACE CLIENT ===
        {
            id: 'client_area',
            category: 'espace_client',
            keywords: ['espace client', 'mon compte', 'mon espace', 'tableau de bord', 'dashboard', 'connexion', 'se connecter', 'connecter', 'login'],
            response: 'Votre espace client vous permet de suivre votre accompagnement, acceder a vos documents et consulter vos seances. Pour vous connecter, rendez-vous sur la page de connexion.',
            quickReplies: [],
            link: { url: 'login.html', label: 'Se connecter' }
        },
        {
            id: 'create_account',
            category: 'espace_client',
            keywords: ['creer compte', 'inscription', 's\'inscrire', 'nouveau compte', 'register', 'enregistrer', 'ouvrir compte'],
            response: 'Pour creer votre compte, rendez-vous sur la page d\'inscription. Vous aurez besoin de vos informations personnelles et de choisir une offre.',
            quickReplies: [],
            link: { url: 'register.html', label: 'Creer un compte' }
        },
        {
            id: 'documents',
            category: 'espace_client',
            keywords: ['document', 'livrable', 'fichier', 'telecharger', 'pdf', 'livraison', 'telechargement'],
            response: 'Vos documents et livrables sont accessibles depuis votre espace client. Les documents d\'accueil sont disponibles des le paiement de l\'acompte. Les livrables finaux (photos, videos, etc.) sont disponibles au telechargement une fois le solde regle.',
            quickReplies: [],
            link: { url: 'login.html', label: 'Acceder a mes documents' }
        },

        // === CONTACT ===
        {
            id: 'how_to_contact',
            category: 'contact',
            keywords: ['contacter', 'contact', 'joindre', 'ecrire', 'email', 'mail', 'telephone', 'appeler', 'message', 'numero'],
            response: 'Vous pouvez nous contacter de plusieurs facons :\n\n\u2022 Par email : financialadvicegenesis@gmail.com\n\u2022 Par telephone : +33 7 64 16 36 09\n\u2022 Via le formulaire de contact sur notre site\n\u2022 Par message sur nos reseaux sociaux\n\nHoraires : Lundi - Vendredi, 9h - 18h.',
            quickReplies: [],
            link: { url: 'contact.html', label: 'Formulaire de contact' }
        },
        {
            id: 'social_media',
            category: 'contact',
            keywords: ['instagram', 'linkedin', 'tiktok', 'reseaux sociaux', 'reseau', 'social', 'insta'],
            response: 'Retrouvez-nous sur nos reseaux sociaux :\n\n\u2022 Instagram : @financial_advice_genesis\n\u2022 LinkedIn : Financial Advice Genesis\n\u2022 TikTok : @financial.advice.genesis\n\nN\'hesitez pas a nous envoyer un message directement !',
            quickReplies: [],
            link: null
        },
        {
            id: 'start_project',
            category: 'contact',
            keywords: ['lancer', 'demarrer', 'commencer projet', 'je veux', 'interesse', 'ca m\'interesse', 'comment demarrer', 'je suis interesse'],
            response: 'Super ! Pour lancer votre projet avec FA Genesis, vous avez deux options :\n\n1. Consulter nos offres pour choisir celle qui vous convient\n2. Nous contacter directement pour en discuter\n\nL\'equipe sera ravie de vous accompagner !',
            quickReplies: ['Voir les offres', 'Contacter l\'equipe'],
            link: { url: 'offres.html', label: 'Decouvrir les offres' }
        },

        // === META ===
        {
            id: 'greeting',
            category: 'meta',
            keywords: ['bonjour', 'salut', 'hello', 'bonsoir', 'hey', 'coucou', 'yo', 'allo', 'bsr', 'bjr'],
            response: 'Bonjour ! Bienvenue chez FA Genesis. Comment puis-je vous aider aujourd\'hui ?',
            quickReplies: ['C\'est quoi FA Genesis ?', 'Voir les offres', 'Contacter l\'equipe'],
            link: null
        },
        {
            id: 'thanks',
            category: 'meta',
            keywords: ['merci', 'super', 'parfait', 'genial', 'top', 'cool', 'nickel', 'excellent', 'bien recu'],
            response: 'Avec plaisir ! N\'hesitez pas si vous avez d\'autres questions. L\'equipe FA Genesis est la pour vous.',
            quickReplies: ['Voir les offres', 'Contacter l\'equipe'],
            link: null
        },
        {
            id: 'goodbye',
            category: 'meta',
            keywords: ['au revoir', 'bye', 'a bientot', 'bonne journee', 'bonne soiree', 'ciao', 'a plus'],
            response: 'A bientot ! N\'hesitez pas a revenir si vous avez des questions. Bonne continuation !',
            quickReplies: [],
            link: null
        },
        {
            id: 'help',
            category: 'meta',
            keywords: ['aide', 'help', 'je comprends pas', 'comment ca marche le bot', 'que peux-tu faire', 'quoi faire'],
            response: 'Je peux vous aider sur les sujets suivants :\n\n\u2022 Nos offres et tarifs\n\u2022 Le fonctionnement de l\'accompagnement\n\u2022 Le paiement et les facilites\n\u2022 L\'espace client et les documents\n\u2022 Comment nous contacter\n\nPosez-moi votre question ou cliquez sur un bouton ci-dessous.',
            quickReplies: ['Offres et tarifs', 'Comment ca marche ?', 'Paiement', 'Espace client', 'Contact'],
            link: null
        }
    ];

    // Mapping boutons rapides -> messages utilisateur
    var QUICK_REPLY_MAP = {
        'C\'est quoi FA Genesis ?': 'C\'est quoi Financial Advice Genesis ?',
        'Voir les offres': 'Quelles sont vos offres ?',
        'Contacter l\'equipe': 'Comment vous contacter ?',
        'Comment ca marche ?': 'Comment fonctionne l\'accompagnement ?',
        'Offres Etudiants': 'Quelles sont les offres etudiants ?',
        'Offres Particuliers': 'Quelles sont les offres particuliers ?',
        'Offres Entreprises': 'Quelles sont les offres entreprises ?',
        'Services individuels': 'Quels sont vos services individuels ?',
        'Payer en plusieurs fois ?': 'Est-ce que je peux payer en plusieurs fois ?',
        'Combien de temps ?': 'Combien de temps dure un accompagnement ?',
        'Offres et tarifs': 'Quelles sont vos offres et tarifs ?',
        'Paiement': 'Comment fonctionne le paiement ?',
        'Espace client': 'Comment acceder a mon espace client ?',
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
            // Supprimer les accents
            if (typeof normalized.normalize === 'function') {
                normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            } else {
                // Fallback manuel pour vieux navigateurs
                normalized = normalized
                    .replace(/[\u00e0\u00e2\u00e4]/g, 'a')
                    .replace(/[\u00e9\u00e8\u00ea\u00eb]/g, 'e')
                    .replace(/[\u00ee\u00ef]/g, 'i')
                    .replace(/[\u00f4\u00f6]/g, 'o')
                    .replace(/[\u00f9\u00fb\u00fc]/g, 'u')
                    .replace(/[\u00e7]/g, 'c');
            }
            // Supprimer ponctuation
            normalized = normalized.replace(/[^\w\s]/g, ' ');
            // Compresser espaces
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
                        // Mot-cle multi-mots : chercher dans le message complet
                        if (normalized.indexOf(keyword) !== -1) {
                            score = score + 3;
                        }
                    } else {
                        // Mot-cle simple : chercher dans chaque mot
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
            console.error('[CHATBOT] Erreur detection:', e);
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
                    text: 'Je ne suis pas sur de bien comprendre votre demande. Pour une reponse precise et personnalisee, je vous invite a contacter notre equipe directement. Souhaitez-vous que je transmette votre question ?',
                    quickReplies: ['Oui, transmettre ma question', 'Contacter l\'equipe', 'Voir la FAQ'],
                    link: null
                };
            }
            return {
                text: 'Je n\'ai pas bien compris votre question. Pouvez-vous la reformuler ? Vous pouvez aussi utiliser les boutons ci-dessous pour naviguer.',
                quickReplies: ['Offres et tarifs', 'Comment ca marche ?', 'Contacter l\'equipe', 'Voir la FAQ'],
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
                + '#fa-chatbot-trigger svg { width: 28px; height: 28px; fill: #000; }'
                + '#fa-chatbot-window { display: none; flex-direction: column; position: fixed; bottom: 20px; right: 20px; width: 400px; height: 550px; background: #000; border: 4px solid #000; box-shadow: 10px 10px 0px #FFD700; z-index: 35; overflow: hidden; }'
                + '#fa-chatbot-header { background: #FFD700; color: #000; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #000; }'
                + '#fa-chatbot-header-title { font-family: "Unbounded", cursive; font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }'
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
                + '  #fa-chatbot-window { top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; border: none; box-shadow: none; }'
                + '  #fa-chatbot-container { bottom: 16px; right: 16px; }'
                + '  #fa-chatbot-trigger { width: 54px; height: 54px; }'
                + '}';
            document.head.appendChild(style);
        } catch (e) {
            console.error('[CHATBOT] Erreur injection CSS:', e);
        }
    }

    // ============================================================
    // F) CREATION DU WIDGET HTML
    // ============================================================

    function createWidget() {
        try {
            var container = document.createElement('div');
            container.id = 'fa-chatbot-container';

            // Bouton trigger
            var trigger = document.createElement('button');
            trigger.id = 'fa-chatbot-trigger';
            trigger.setAttribute('aria-label', 'Ouvrir le chatbot');
            trigger.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';

            // Fenetre chat
            var chatWindow = document.createElement('div');
            chatWindow.id = 'fa-chatbot-window';

            // Header
            var header = document.createElement('div');
            header.id = 'fa-chatbot-header';
            header.innerHTML = '<span id="fa-chatbot-header-title">FA Genesis Assistant</span>';

            var closeBtn = document.createElement('button');
            closeBtn.id = 'fa-chatbot-close';
            closeBtn.setAttribute('aria-label', 'Fermer le chatbot');
            closeBtn.textContent = '\u00D7';
            header.appendChild(closeBtn);

            // Messages
            var messages = document.createElement('div');
            messages.id = 'fa-chatbot-messages';

            // Indicateur de frappe
            var typing = document.createElement('div');
            typing.id = 'fa-chatbot-typing';
            typing.innerHTML = '<span class="fa-chatbot-dot"></span><span class="fa-chatbot-dot"></span><span class="fa-chatbot-dot"></span>';

            messages.appendChild(typing);

            // Quick replies
            var quickReplies = document.createElement('div');
            quickReplies.id = 'fa-chatbot-quick-replies';

            // Formulaire d'escalade
            var escalation = document.createElement('div');
            escalation.id = 'fa-chatbot-escalation';
            escalation.innerHTML = ''
                + '<h4>Transmettre a l\'equipe</h4>'
                + '<input type="text" id="fa-chatbot-esc-name" placeholder="Votre nom">'
                + '<input type="email" id="fa-chatbot-esc-email" placeholder="Votre email">'
                + '<textarea id="fa-chatbot-esc-message" placeholder="Votre question..."></textarea>'
                + '<button id="fa-chatbot-esc-submit">Envoyer a l\'equipe</button>'
                + '<button id="fa-chatbot-esc-cancel">Annuler</button>';

            // Zone de saisie
            var inputArea = document.createElement('div');
            inputArea.id = 'fa-chatbot-input-area';
            inputArea.innerHTML = ''
                + '<input type="text" id="fa-chatbot-input" placeholder="Ecrivez votre message..." autocomplete="off">'
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

            console.log('[CHATBOT] Widget cree');
        } catch (e) {
            console.error('[CHATBOT] Erreur creation widget:', e);
        }
    }

    // ============================================================
    // G) GESTION DES MESSAGES ET EVENEMENTS
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

            // Inserer avant le typing indicator
            var typingEl = document.getElementById('fa-chatbot-typing');
            if (typingEl) {
                messagesContainer.insertBefore(msgEl, typingEl);
            } else {
                messagesContainer.appendChild(msgEl);
            }

            // Mettre a jour les boutons rapides
            updateQuickReplies(quickRepliesArr || []);

            scrollToBottom();
        } catch (e) {
            console.error('[CHATBOT] Erreur ajout message bot:', e);
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
            console.error('[CHATBOT] Erreur ajout message user:', e);
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
            console.error('[CHATBOT] Erreur quick replies:', e);
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

    function toggleChatbot() {
        try {
            var chatWindow = document.getElementById('fa-chatbot-window');
            var trigger = document.getElementById('fa-chatbot-trigger');

            if (!isOpen) {
                chatWindow.style.display = 'flex';
                trigger.style.display = 'none';
                isOpen = true;

                if (!chatInitialized) {
                    addBotMessage(
                        CHATBOT_CONFIG.welcomeMessage,
                        ['C\'est quoi FA Genesis ?', 'Voir les offres', 'Contacter l\'equipe'],
                        null
                    );
                    chatInitialized = true;
                }

                var input = document.getElementById('fa-chatbot-input');
                if (input) input.focus();
            } else {
                closeChatbot();
            }
        } catch (e) {
            console.error('[CHATBOT] Erreur toggle:', e);
        }
    }

    function closeChatbot() {
        try {
            var chatWindow = document.getElementById('fa-chatbot-window');
            var trigger = document.getElementById('fa-chatbot-trigger');

            chatWindow.style.display = 'none';
            trigger.style.display = 'flex';
            isOpen = false;
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
            console.error('[CHATBOT] Erreur envoi message:', e);
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
            console.error('[CHATBOT] Erreur quick reply:', e);
        }
    }

    function processUserMessage(text) {
        try {
            addUserMessage(text);

            // Cacher les quick replies pendant le traitement
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
                        'Desole, une erreur est survenue. Vous pouvez nous contacter directement a financialadvicegenesis@gmail.com',
                        ['Contacter l\'equipe'],
                        null
                    );
                }
            }, CHATBOT_CONFIG.typingDelay);
        } catch (e) {
            console.error('[CHATBOT] Erreur traitement message:', e);
        }
    }

    // ============================================================
    // H) SYSTEME D'ESCALADE
    // ============================================================

    function showEscalationForm() {
        try {
            var quickReplies = document.getElementById('fa-chatbot-quick-replies');
            var escalation = document.getElementById('fa-chatbot-escalation');
            var inputArea = document.getElementById('fa-chatbot-input-area');

            if (quickReplies) quickReplies.style.display = 'none';
            if (inputArea) inputArea.style.display = 'none';
            if (escalation) escalation.style.display = 'block';

            // Pre-remplir si l'utilisateur est connecte
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

            // Pre-remplir le message avec le resume de la conversation
            var messageField = document.getElementById('fa-chatbot-esc-message');
            if (messageField) {
                messageField.value = buildConversationSummary();
            }

            addBotMessage(
                'Remplissez le formulaire ci-dessous et notre equipe vous repondra par email dans les plus brefs delais.',
                [],
                null
            );
        } catch (e) {
            console.error('[CHATBOT] Erreur affichage escalation:', e);
        }
    }

    function hideEscalationForm() {
        try {
            var quickReplies = document.getElementById('fa-chatbot-quick-replies');
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
                return 'Questions posees via le chatbot :\n' + parts.join('\n');
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

            // Desactiver le bouton
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Envoi en cours...';
            }

            var apiUrl = CHATBOT_CONFIG.apiBaseUrl;

            var xhr = new XMLHttpRequest();
            xhr.open('POST', apiUrl + '/api/contact', true);
            xhr.setRequestHeader('Content-Type', 'application/json');

            xhr.onload = function() {
                try {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Envoyer a l\'equipe';
                    }

                    if (xhr.status >= 200 && xhr.status < 300) {
                        hideEscalationForm();
                        unmatchedCount = 0;
                        addBotMessage(
                            'Votre question a bien ete transmise a notre equipe ! Vous recevrez une reponse par email a ' + email + '. En attendant, n\'hesitez pas a consulter notre FAQ ou nos offres.',
                            ['Voir les offres', 'Voir la FAQ'],
                            null
                        );
                    } else {
                        addBotMessage(
                            'Une erreur est survenue lors de l\'envoi. Vous pouvez aussi nous contacter directement par email : financialadvicegenesis@gmail.com',
                            ['Contacter l\'equipe'],
                            null
                        );
                    }
                } catch (e) {
                    addBotMessage('Une erreur est survenue. Contactez-nous a financialadvicegenesis@gmail.com', [], null);
                }
            };

            xhr.onerror = function() {
                try {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Envoyer a l\'equipe';
                    }
                    hideEscalationForm();
                    addBotMessage(
                        'Impossible de joindre le serveur pour le moment. Vous pouvez nous ecrire directement a financialadvicegenesis@gmail.com ou appeler le +33 7 64 16 36 09.',
                        ['Contacter l\'equipe'],
                        null
                    );
                } catch (e) {}
            };

            xhr.send(JSON.stringify({
                name: name,
                email: email,
                profil: 'CHATBOT',
                subject: '[CHATBOT] Question non resolue',
                message: message
            }));

        } catch (e) {
            console.error('[CHATBOT] Erreur soumission escalation:', e);
        }
    }

    // ============================================================
    // I) INITIALISATION
    // ============================================================

    function bindEvents() {
        try {
            // Bouton trigger
            var trigger = document.getElementById('fa-chatbot-trigger');
            if (trigger) trigger.addEventListener('click', toggleChatbot);

            // Bouton fermer
            var closeBtn = document.getElementById('fa-chatbot-close');
            if (closeBtn) closeBtn.addEventListener('click', closeChatbot);

            // Bouton envoyer
            var sendBtn = document.getElementById('fa-chatbot-send');
            if (sendBtn) sendBtn.addEventListener('click', handleSendMessage);

            // Entree clavier
            var input = document.getElementById('fa-chatbot-input');
            if (input) {
                input.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' || e.keyCode === 13) {
                        e.preventDefault();
                        handleSendMessage();
                    }
                });
            }

            // Touche Escape
            document.addEventListener('keydown', function(e) {
                if ((e.key === 'Escape' || e.keyCode === 27) && isOpen) {
                    closeChatbot();
                }
            });

            // Bouton escalation submit
            var escSubmit = document.getElementById('fa-chatbot-esc-submit');
            if (escSubmit) escSubmit.addEventListener('click', submitEscalation);

            // Bouton escalation annuler
            var escCancel = document.getElementById('fa-chatbot-esc-cancel');
            if (escCancel) {
                escCancel.addEventListener('click', function() {
                    hideEscalationForm();
                    addBotMessage(
                        'Pas de probleme ! Posez-moi une autre question ou utilisez les boutons ci-dessous.',
                        ['Offres et tarifs', 'Comment ca marche ?', 'Contacter l\'equipe'],
                        null
                    );
                });
            }

            console.log('[CHATBOT] Evenements lies');
        } catch (e) {
            console.error('[CHATBOT] Erreur liaison evenements:', e);
        }
    }

    function init() {
        try {
            console.log('[CHATBOT] Initialisation...');
            injectStyles();
            createWidget();
            bindEvents();
            console.log('[CHATBOT] Pret');
        } catch (e) {
            console.error('[CHATBOT] Erreur initialisation:', e);
        }
    }

    // Demarrer quand le DOM est pret
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
