// Documents spécifiques à chaque offre FA GENESIS
// Ces documents sont accessibles après le paiement de l'acompte (30%)

console.log('🔵 Chargement de offer-specific-documents.js');

const OFFER_SPECIFIC_DOCUMENTS = {
    // ========== ÉTUDIANTS ==========
    'etudiant-idea': [
        {
            id: 'etudiant-idea-1',
            title: 'Guide de démarrage IDEA',
            offerId: 'etudiant-idea',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-16',
            description: 'Guide pour démarrer votre projet étudiant'
        },
        {
            id: 'etudiant-idea-2',
            title: 'Template Plan d\'Action',
            offerId: 'etudiant-idea',
            fileUrl: '#',
            fileType: 'WORD',
            updatedAt: '2024-01-16',
            description: 'Modèle pour structurer votre plan d\'action'
        }
    ],
    'etudiant-starter': [
        {
            id: 'etudiant-starter-1',
            title: 'Kit de démarrage complet',
            offerId: 'etudiant-starter',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-21',
            description: 'Tous les outils pour démarrer efficacement'
        },
        {
            id: 'etudiant-starter-2',
            title: 'Guide méthodologie projet',
            offerId: 'etudiant-starter',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-21',
            description: 'Méthodologie complète de gestion de projet'
        },
        {
            id: 'etudiant-starter-3',
            title: 'Templates documents',
            offerId: 'etudiant-starter',
            fileUrl: '#',
            fileType: 'WORD',
            updatedAt: '2024-01-21',
            description: 'Pack de templates pour vos documents'
        }
    ],
    'etudiant-launch': [
        {
            id: 'etudiant-launch-1',
            title: 'Guide lancement projet',
            offerId: 'etudiant-launch',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-16',
            description: 'Guide complet pour lancer votre projet'
        },
        {
            id: 'etudiant-launch-2',
            title: 'Stratégie de communication',
            offerId: 'etudiant-launch',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-18',
            description: 'Plan de communication détaillé'
        },
        {
            id: 'etudiant-launch-3',
            title: 'Kit visibilité réseaux sociaux',
            offerId: 'etudiant-launch',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-20',
            description: 'Guide pour optimiser votre présence en ligne'
        }
    ],
    'etudiant-impact': [
        {
            id: 'etudiant-impact-1',
            title: 'Stratégie d\'impact complète',
            offerId: 'etudiant-impact',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-10',
            description: 'Document de stratégie globale'
        },
        {
            id: 'etudiant-impact-2',
            title: 'Guide networking et partenariats',
            offerId: 'etudiant-impact',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-12',
            description: 'Comment développer votre réseau'
        },
        {
            id: 'etudiant-impact-3',
            title: 'Plan de développement 6 mois',
            offerId: 'etudiant-impact',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-15',
            description: 'Feuille de route détaillée sur 6 mois'
        }
    ],

    // ========== PARTICULIERS ==========
    'particulier-idea': [
        {
            id: 'particulier-idea-1',
            title: 'Guide structuration projet',
            offerId: 'particulier-idea',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-16',
            description: 'Comment structurer votre projet professionnel'
        },
        {
            id: 'particulier-idea-2',
            title: 'Analyse de marché simplifiée',
            offerId: 'particulier-idea',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-18',
            description: 'Template d\'analyse de votre marché'
        }
    ],
    'particulier-starter': [
        {
            id: 'particulier-starter-1',
            title: 'Business Plan Template',
            offerId: 'particulier-starter',
            fileUrl: '#',
            fileType: 'WORD',
            updatedAt: '2024-01-20',
            description: 'Modèle de business plan professionnel'
        },
        {
            id: 'particulier-starter-2',
            title: 'Guide positionnement marché',
            offerId: 'particulier-starter',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-20',
            description: 'Comment vous positionner sur votre marché'
        },
        {
            id: 'particulier-starter-3',
            title: 'Stratégie marketing digital',
            offerId: 'particulier-starter',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-22',
            description: 'Plan marketing digital complet'
        }
    ],
    'particulier-launch': [
        {
            id: 'particulier-launch-1',
            title: 'Plan de lancement complet',
            offerId: 'particulier-launch',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-15',
            description: 'Document de planification du lancement'
        },
        {
            id: 'particulier-launch-2',
            title: 'Kit communication professionnelle',
            offerId: 'particulier-launch',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-18',
            description: 'Tous les outils de communication'
        },
        {
            id: 'particulier-launch-3',
            title: 'Stratégie acquisition clients',
            offerId: 'particulier-launch',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-20',
            description: 'Comment acquérir vos premiers clients'
        }
    ],
    'particulier-impact': [
        {
            id: 'particulier-impact-1',
            title: 'Stratégie de croissance',
            offerId: 'particulier-impact',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-02',
            description: 'Plan de développement et croissance'
        },
        {
            id: 'particulier-impact-2',
            title: 'Guide personal branding',
            offerId: 'particulier-impact',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-05',
            description: 'Construire votre marque personnelle'
        },
        {
            id: 'particulier-impact-3',
            title: 'Plan média et visibilité',
            offerId: 'particulier-impact',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-08',
            description: 'Stratégie de visibilité médiatique'
        },
        {
            id: 'particulier-impact-4',
            title: 'Dossier de presse',
            offerId: 'particulier-impact',
            fileUrl: '#',
            fileType: 'WORD',
            updatedAt: '2024-01-10',
            description: 'Template de dossier de presse professionnel'
        }
    ],

    // ========== ENTREPRISES ==========
    'entreprise-start': [
        {
            id: 'entreprise-start-1',
            title: 'Audit complet entreprise',
            offerId: 'entreprise-start',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-10',
            description: 'Analyse complète de votre entreprise'
        },
        {
            id: 'entreprise-start-2',
            title: 'Plan d\'action stratégique',
            offerId: 'entreprise-start',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-12',
            description: 'Feuille de route pour votre développement'
        },
        {
            id: 'entreprise-start-3',
            title: 'Guide optimisation processus',
            offerId: 'entreprise-start',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-15',
            description: 'Optimisez vos processus internes'
        }
    ],
    'entreprise-visibility': [
        {
            id: 'entreprise-visibility-1',
            title: 'Stratégie de visibilité complète',
            offerId: 'entreprise-visibility',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-08',
            description: 'Plan de visibilité sur 3 mois'
        },
        {
            id: 'entreprise-visibility-2',
            title: 'Plan communication multicanal',
            offerId: 'entreprise-visibility',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-10',
            description: 'Stratégie de communication intégrée'
        },
        {
            id: 'entreprise-visibility-3',
            title: 'Guide relations presse',
            offerId: 'entreprise-visibility',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-12',
            description: 'Comment gérer vos relations avec les médias'
        },
        {
            id: 'entreprise-visibility-4',
            title: 'Kit médias entreprise',
            offerId: 'entreprise-visibility',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-15',
            description: 'Tous vos documents médias'
        }
    ],
    'entreprise-impact': [
        {
            id: 'entreprise-impact-1',
            title: 'Stratégie d\'impact globale',
            offerId: 'entreprise-impact',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-05',
            description: 'Document de stratégie complète'
        },
        {
            id: 'entreprise-impact-2',
            title: 'Plan de transformation',
            offerId: 'entreprise-impact',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-08',
            description: 'Roadmap de transformation'
        },
        {
            id: 'entreprise-impact-3',
            title: 'Guide scaling entreprise',
            offerId: 'entreprise-impact',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-12',
            description: 'Comment scaler votre entreprise'
        },
        {
            id: 'entreprise-impact-4',
            title: 'Stratégie partenariats',
            offerId: 'entreprise-impact',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-15',
            description: 'Développer vos partenariats stratégiques'
        },
        {
            id: 'entreprise-impact-5',
            title: 'Plan de communication premium',
            offerId: 'entreprise-impact',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-18',
            description: 'Communication haut de gamme'
        }
    ],

    // ========== TARIFS INDIVIDUELS - PHOTO ==========
    'photo-essentiel': [
        {
            id: 'photo-essentiel-1',
            title: 'Guide préparation shooting',
            offerId: 'photo-essentiel',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-10',
            description: 'Comment bien préparer votre séance photo'
        }
    ],
    'photo-pro': [
        {
            id: 'photo-pro-1',
            title: 'Guide shooting professionnel',
            offerId: 'photo-pro',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-12',
            description: 'Préparation complète de votre shooting'
        },
        {
            id: 'photo-pro-2',
            title: 'Conseils utilisation photos',
            offerId: 'photo-pro',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-15',
            description: 'Comment utiliser vos photos efficacement'
        }
    ],
    'photo-event': [
        {
            id: 'photo-event-1',
            title: 'Planification événement',
            offerId: 'photo-event',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-10',
            description: 'Organisation de la couverture photo'
        },
        {
            id: 'photo-event-2',
            title: 'Brief photographe',
            offerId: 'photo-event',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-12',
            description: 'Document de briefing complet'
        }
    ],

    // ========== TARIFS INDIVIDUELS - VIDÉO ==========
    'video-pro': [
        {
            id: 'video-pro-1',
            title: 'Guide production vidéo',
            offerId: 'video-pro',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-15',
            description: 'Toutes les étapes de production'
        },
        {
            id: 'video-pro-2',
            title: 'Script et storyboard',
            offerId: 'video-pro',
            fileUrl: '#',
            fileType: 'WORD',
            updatedAt: '2024-01-18',
            description: 'Templates pour votre vidéo'
        }
    ],
    'video-storytelling': [
        {
            id: 'video-storytelling-1',
            title: 'Guide storytelling vidéo',
            offerId: 'video-storytelling',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-12',
            description: 'Créer une histoire captivante'
        },
        {
            id: 'video-storytelling-2',
            title: 'Script narratif complet',
            offerId: 'video-storytelling',
            fileUrl: '#',
            fileType: 'WORD',
            updatedAt: '2024-01-15',
            description: 'Script détaillé de votre vidéo'
        },
        {
            id: 'video-storytelling-3',
            title: 'Guide diffusion vidéo',
            offerId: 'video-storytelling',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-18',
            description: 'Comment diffuser votre vidéo'
        }
    ],
    'video-visibility': [
        {
            id: 'video-visibility-1',
            title: 'Stratégie campagne vidéo',
            offerId: 'video-visibility',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-10',
            description: 'Plan de campagne complet'
        },
        {
            id: 'video-visibility-2',
            title: 'Scripts 3 vidéos',
            offerId: 'video-visibility',
            fileUrl: '#',
            fileType: 'WORD',
            updatedAt: '2024-01-12',
            description: 'Scripts pour vos 3 vidéos'
        },
        {
            id: 'video-visibility-3',
            title: 'Plan de diffusion multicanal',
            offerId: 'video-visibility',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-15',
            description: 'Stratégie de diffusion optimisée'
        }
    ],

    // ========== TARIFS INDIVIDUELS - MARKETING ==========
    'marketing-express': [
        {
            id: 'marketing-express-1',
            title: 'Audit marketing express',
            offerId: 'marketing-express',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-18',
            description: 'Analyse rapide de votre marketing'
        },
        {
            id: 'marketing-express-2',
            title: 'Plan d\'action immédiat',
            offerId: 'marketing-express',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-20',
            description: 'Actions à mettre en place rapidement'
        }
    ],
    'marketing-strategy': [
        {
            id: 'marketing-strategy-1',
            title: 'Stratégie marketing complète',
            offerId: 'marketing-strategy',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-15',
            description: 'Document de stratégie détaillé'
        },
        {
            id: 'marketing-strategy-2',
            title: 'Étude de marché',
            offerId: 'marketing-strategy',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-18',
            description: 'Analyse complète de votre marché'
        },
        {
            id: 'marketing-strategy-3',
            title: 'Plan de communication',
            offerId: 'marketing-strategy',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-20',
            description: 'Votre stratégie de communication'
        }
    ],
    'marketing-impact': [
        {
            id: 'marketing-impact-1',
            title: 'Stratégie marketing globale',
            offerId: 'marketing-impact',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-10',
            description: 'Stratégie complète sur 3 mois'
        },
        {
            id: 'marketing-impact-2',
            title: 'Plan campagnes multiples',
            offerId: 'marketing-impact',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-15',
            description: 'Calendrier de campagnes'
        },
        {
            id: 'marketing-impact-3',
            title: 'Guide performance marketing',
            offerId: 'marketing-impact',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-18',
            description: 'Suivi et optimisation des performances'
        }
    ],

    // ========== TARIFS INDIVIDUELS - MÉDIA ==========
    'media-visibility': [
        {
            id: 'media-visibility-1',
            title: 'Communiqué de presse',
            offerId: 'media-visibility',
            fileUrl: '#',
            fileType: 'WORD',
            updatedAt: '2024-01-15',
            description: 'Communiqué professionnel prêt à diffuser'
        },
        {
            id: 'media-visibility-2',
            title: 'Liste contacts médias',
            offerId: 'media-visibility',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-18',
            description: 'Base de contacts médias ciblés'
        }
    ],
    'media-impact': [
        {
            id: 'media-impact-1',
            title: 'Stratégie média complète',
            offerId: 'media-impact',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-12',
            description: 'Plan média sur 2 mois'
        },
        {
            id: 'media-impact-2',
            title: 'Dossier de presse complet',
            offerId: 'media-impact',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-15',
            description: 'Dossier professionnel pour les médias'
        },
        {
            id: 'media-impact-3',
            title: 'Guide relations presse',
            offerId: 'media-impact',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-18',
            description: 'Comment gérer vos relations presse'
        }
    ],
    'media-premium': [
        {
            id: 'media-premium-1',
            title: 'Stratégie média premium',
            offerId: 'media-premium',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-10',
            description: 'Campagne d\'envergure sur 3 mois'
        },
        {
            id: 'media-premium-2',
            title: 'Dossier de presse VIP',
            offerId: 'media-premium',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-12',
            description: 'Dossier premium pour médias majeurs'
        },
        {
            id: 'media-premium-3',
            title: 'Kit média complet',
            offerId: 'media-premium',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-15',
            description: 'Tous vos documents médias'
        },
        {
            id: 'media-premium-4',
            title: 'Plan de diffusion premium',
            offerId: 'media-premium',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-18',
            description: 'Stratégie de diffusion optimale'
        }
    ],
    'media-promotion': [
        {
            id: 'media-promotion-1',
            title: 'Plan de promotion média',
            offerId: 'media-promotion',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-12',
            description: 'Stratégie de promotion ciblée'
        },
        {
            id: 'media-promotion-2',
            title: 'Analyse d\'impact',
            offerId: 'media-promotion',
            fileUrl: '#',
            fileType: 'PDF',
            updatedAt: '2024-01-15',
            description: 'Mesure de l\'impact de vos actions'
        }
    ]
};

/**
 * Récupérer les documents spécifiques d'une offre
 * @param {string} offerId - ID de l'offre
 * @returns {Array}
 */
function getOfferSpecificDocuments(offerId) {
    return OFFER_SPECIFIC_DOCUMENTS[offerId] || [];
}

/**
 * Récupérer tous les documents pour un utilisateur (communs + spécifiques à son offre)
 * @param {string} offerId - ID de l'offre de l'utilisateur
 * @returns {Object} - { common: [...], specific: [...] }
 */
function getAllUserDocuments(offerId) {
    return {
        common: COMMON_DOCUMENTS || [],
        specific: getOfferSpecificDocuments(offerId)
    };
}

console.log('🟢 offer-specific-documents.js chargé avec succès');
console.log('📊 Nombre d\'offres avec documents spécifiques:', Object.keys(OFFER_SPECIFIC_DOCUMENTS).length);
