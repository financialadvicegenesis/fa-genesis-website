/**
 * FA GENESIS - Système de traduction FR/EN complet
 * Traduit dynamiquement le contenu de toutes les pages
 */
(function() {
    'use strict';

    // ========================================
    // DICTIONNAIRE DE TRADUCTIONS
    // ========================================
    var translations = {
        // === NAVIGATION ===
        'Accueil': 'Home',
        'À Propos': 'About',
        'À propos': 'About',
        'Offres': 'Offers',
        'Contact': 'Contact',
        'FAQ': 'FAQ',
        'Espace client': 'Client Area',
        'Lancer un projet': 'Start a project',
        'Dashboard': 'Dashboard',
        'Livrables': 'Deliverables',
        'Séances': 'Sessions',
        'Mon compte': 'My Account',
        'Déconnexion': 'Log out',

        // === INDEX - MARQUEE ===
        'TRANSFORME TON IDÉE EN PROJET': 'TURN YOUR IDEA INTO A PROJECT',
        'STRATÉGIE': 'STRATEGY',
        'VISIBILITÉ': 'VISIBILITY',
        'CRÉDIBILITÉ': 'CREDIBILITY',
        'FA GENESIS': 'FA GENESIS',
        'IMPACT DURABLE': 'LASTING IMPACT',

        // === INDEX - HERO ===
        'BIENVENUE CHEZ FA GENESIS': 'WELCOME TO FA GENESIS',
        'VOTRE PARTENAIRE POUR TRANSFORMER UNE IDÉE EN UN PROJET STRUCTURÉ, CRÉDIBLE ET VISIBLE': 'YOUR PARTNER TO TURN AN IDEA INTO A STRUCTURED, CREDIBLE AND VISIBLE PROJECT',

        // === INDEX - VALUES ===
        'STRATÉGIE CLAIRE': 'CLEAR STRATEGY',
        'Nous structurons votre projet avec une méthodologie éprouvée pour transformer votre idée en une vision concrète et actionnable.': 'We structure your project with a proven methodology to turn your idea into a concrete and actionable vision.',
        'VISIBILITÉ PRO': 'PRO VISIBILITY',
        'Image professionnelle, contenus percutants et présence médiatique pour vous démarquer et gagner en crédibilité.': 'Professional image, impactful content and media presence to stand out and gain credibility.',
        'IMPACT DURABLE': 'LASTING IMPACT',
        'Résultats mesurables, accompagnement personnalisé et plan d\'action concret pour assurer votre succès sur le long terme.': 'Measurable results, personalized support and concrete action plan to ensure your long-term success.',

        // === INDEX - INSPIRATIONAL ===
        '"DE L\'IDÉE À LA RÉALISATION"': '"FROM IDEA TO REALITY"',
        'DE L\'IDÉE À LA RÉALISATION': 'FROM IDEA TO REALITY',
        'Chaque grand projet commence par une vision. Nous transformons cette vision en succès tangible.': 'Every great project starts with a vision. We turn that vision into tangible success.',

        // === INDEX - FOUR PILLARS ===
        'ACCÉLÉRATION': 'ACCELERATION',
        'Ne perdez plus de temps. Nous vous donnons les outils et la méthode pour avancer rapidement et efficacement vers vos objectifs.': 'Stop wasting time. We give you the tools and methods to move quickly and efficiently toward your goals.',
        'PRÉCISION': 'PRECISION',
        'Chaque action compte. Notre approche ciblée garantit que vos efforts produisent des résultats concrets et mesurables.': 'Every action counts. Our targeted approach ensures your efforts produce concrete and measurable results.',
        'TRANSFORMATION': 'TRANSFORMATION',
        'Passez du statut de porteur d\'idée à celui d\'entrepreneur reconnu. Nous vous accompagnons dans cette évolution.': 'Go from idea holder to recognized entrepreneur. We support you through this evolution.',
        'EXCELLENCE': 'EXCELLENCE',
        'Votre projet mérite le meilleur. Nous appliquons les standards les plus élevés à chaque étape de notre collaboration.': 'Your project deserves the best. We apply the highest standards at every stage of our collaboration.',

        // === INDEX - STATS ===
        'Projets Accompagnés': 'Projects Supported',
        'Clients Satisfaits': 'Satisfied Clients',
        'Support Disponible': 'Support Available',

        // === INDEX - FAQ ===
        'Questions Fréquentes': 'Frequently Asked Questions',
        'Tout ce que vous devez savoir sur FA Genesis': 'Everything you need to know about FA Genesis',
        'C\'est quoi Financial Advice Genesis ?': 'What is Financial Advice Genesis?',
        'Financial Advice Genesis accompagne les étudiants et entrepreneurs débutants à transformer une idée en un projet structuré, crédible et visible, à un coût accessible.': 'Financial Advice Genesis helps students and aspiring entrepreneurs turn an idea into a structured, credible and visible project, at an affordable cost.',
        'À qui s\'adressent vos accompagnements ?': 'Who are your services for?',
        'Nos offres s\'adressent principalement aux étudiants, aux porteurs de projets, aux jeunes entrepreneurs et aux personnes qui ont une idée mais ne savent pas par où commencer.': 'Our offers are primarily aimed at students, project leaders, young entrepreneurs and people who have an idea but don\'t know where to start.',
        'Est-ce que je dois déjà avoir un projet ?': 'Do I need to already have a project?',
        'Non. Vous pouvez venir avec une idée, un début de projet ou même juste une envie. On vous aidera à clarifier et structurer votre projet.': 'No. You can come with an idea, the beginning of a project, or even just a desire. We will help you clarify and structure your project.',
        'Vos services sont-ils adaptés aux étudiants ?': 'Are your services suitable for students?',
        'Oui. Nos offres ont été pensées en tenant compte de la réalité financière des étudiants en France.': 'Yes. Our offers have been designed taking into account the financial reality of students in France.',
        'Comment se déroule l\'accompagnement ?': 'How does the support process work?',
        'L\'accompagnement se fait en plusieurs étapes : clarification de l\'idée, structuration du projet, visibilité (photo, vidéo, média) et plan d\'action concret. Chaque accompagnement est simple, progressif et sans pression.': 'The support process takes place in several stages: idea clarification, project structuring, visibility (photo, video, media) and concrete action plan. Each support is simple, progressive and pressure-free.',
        'Combien coûtent vos accompagnements ?': 'How much do your services cost?',
        'Nos prix sont affichés directement sur notre site internet et sur notre page Instagram. Nous proposons aussi des facilités de paiement.': 'Our prices are displayed directly on our website and on our Instagram page. We also offer payment facilities.',
        'Est-ce que je peux payer en plusieurs fois ?': 'Can I pay in installments?',
        'Oui. Certains accompagnements peuvent être payés en plusieurs fois, surtout pour les étudiants.': 'Yes. Some support packages can be paid in installments, especially for students.',
        'Est-ce que vous garantissez la réussite du projet ?': 'Do you guarantee project success?',
        'Nous ne garantissons pas le succès d\'un projet, mais nous garantissons un accompagnement sérieux, structuré et adapté à votre situation. La réussite de votre projet dépendra énormément de votre volonté à l\'accomplir.': 'We do not guarantee the success of a project, but we guarantee serious, structured support adapted to your situation. The success of your project will greatly depend on your willingness to accomplish it.',
        'Est-ce que vous faites des offres sur mesure ?': 'Do you offer custom packages?',
        'Oui. Si votre besoin est spécifique (podcast, projet particulier, entreprise, etc.), nous pouvons créer une offre personnalisée.': 'Yes. If your need is specific (podcast, particular project, business, etc.), we can create a customized offer.',
        'Comment vous contacter ?': 'How can I contact you?',
        'Vous pouvez nous écrire directement en message privé sur nos réseaux sociaux ou par e-mail : Financialadvicegenesis@gmail.com': 'You can write to us directly via private message on our social media or by email: Financialadvicegenesis@gmail.com',
        'Combien de temps dure un accompagnement ?': 'How long does the support last?',
        'Cela dépend de l\'offre choisie : 2 jours, 7 jours, 14 jours, 1 mois ou plus selon votre projet.': 'It depends on the chosen offer: 2 days, 7 days, 14 days, 1 month or more depending on your project.',
        'Est-ce que vous travaillez avec des partenaires ?': 'Do you work with partners?',
        'Oui. Nous travaillons avec des photographes, vidéastes et médias partenaires pour offrir une expérience complète.': 'Yes. We work with partner photographers, videographers and media to offer a complete experience.',

        // === INDEX - FINAL CTA ===
        'Prêt à Transformer votre Idée ?': 'Ready to Transform your Idea?',
        'Rejoignez les entrepreneurs qui ont choisi FA Genesis pour structurer, lancer et développer leur projet': 'Join the entrepreneurs who chose FA Genesis to structure, launch and grow their project',
        'Découvrir nos offres': 'Discover our offers',
        'Nous contacter': 'Contact us',

        // === À PROPOS ===
        'À PROPOS': 'ABOUT',
        'Découvrez l\'écosystème FA Industries et notre mission': 'Discover the FA Industries ecosystem and our mission',
        'L\'ÉCOSYSTÈME FA INDUSTRIES': 'THE FA INDUSTRIES ECOSYSTEM',
        'FA Genesis est le pôle d\'incubation stratégique dédiée à la transformation des idées en un projet structuré, crédible et visible.': 'FA Genesis is the strategic incubation hub dedicated to transforming ideas into structured, credible and visible projects.',
        'Nous sommes le catalyseur qui donne un cadre, une méthode et un réseau à ceux qui osent bâtir leur avenir.': 'We are the catalyst that provides a framework, a method and a network to those who dare to build their future.',
        'NOS PILIERS': 'OUR PILLARS',
        'BUILD': 'BUILD',
        'Structurer l\'idée, la vision et le positionnement.': 'Structure the idea, vision and positioning.',
        'LAUNCH': 'LAUNCH',
        'Créer une image pro et une visibilité cohérente.': 'Create a professional image and consistent visibility.',
        'IMPACT': 'IMPACT',
        'Générer des résultats concrets et durables.': 'Generate concrete and lasting results.',
        'NOTRE VISION': 'OUR VISION',
        'INNOVATION': 'INNOVATION',
        'Nous croyons en l\'innovation comme moteur de transformation. Chaque projet est une opportunité de repousser les limites et de créer quelque chose d\'unique.': 'We believe in innovation as a driver of transformation. Every project is an opportunity to push boundaries and create something unique.',
        'AUTHENTICITÉ': 'AUTHENTICITY',
        'Nous valorisons l\'authenticité dans chaque projet. Votre identité unique est au cœur de notre approche, pour un positionnement sincère et différenciant.': 'We value authenticity in every project. Your unique identity is at the heart of our approach, for sincere and differentiating positioning.',
        'AMBITION': 'AMBITION',
        'Nous accompagnons les visionnaires qui osent voir grand. Ensemble, nous transformons les ambitions les plus audacieuses en réalisations concrètes.': 'We support visionaries who dare to think big. Together, we turn the most daring ambitions into concrete achievements.',
        'Prêt à Rejoindre l\'Aventure ?': 'Ready to Join the Adventure?',
        'Faites partie de l\'écosystème FA Genesis et transformez votre vision en réalité': 'Be part of the FA Genesis ecosystem and turn your vision into reality',

        // === OFFRES ===
        'NOS OFFRES': 'OUR OFFERS',
        'Découvrez nos solutions sur mesure pour transformer votre projet': 'Discover our tailor-made solutions to transform your project',
        'SOLUTIONS': 'SOLUTIONS',
        'ÉTUDIANTS': 'STUDENTS',
        'PARTICULIERS': 'INDIVIDUALS',
        'ENTREPRISES': 'BUSINESSES',
        'Sélectionner': 'Select',
        'Démarrer': 'Get Started',
        'Lancer': 'Launch',
        'Maximiser': 'Maximize',
        'Demander un devis': 'Request a quote',
        'SUR DEVIS': 'CUSTOM QUOTE',
        'Sur Mesure': 'Custom',
        'Jours': 'Days',
        'Mois': 'Month',
        'jours': 'days',
        'mois': 'month',
        'paiement possible en': 'payment possible in',
        'soit': 'i.e.',
        'Paiement possible en': 'Payment possible in',
        'STRUCTURER': 'STRUCTURE',
        'CRÉDIBILITÉ': 'CREDIBILITY',
        'AUTORITÉ': 'AUTHORITY',
        'Propulser': 'Propel',
        'Dominer': 'Dominate',
        'Analyser': 'Analyze',
        'Planifier': 'Plan',
        'Transformer': 'Transform',
        'Médiatiser': 'Media coverage',
        'Amplifier': 'Amplify',
        'Rayonner': 'Radiate',
        'Promouvoir': 'Promote',

        // Offer details
        'Séance stratégique': 'Strategic session',
        'Mini séance stratégique': 'Mini strategic session',
        'Structuration claire du projet': 'Clear project structuring',
        'Mini plan d\'action': 'Mini action plan',
        'Plan d\'action': 'Action plan',
        'Conseils visibilité gratuits (sans tournage)': 'Free visibility advice (no shooting)',
        'Structuration claire & storytelling simple du projet': 'Clear structuring & simple storytelling',
        'Mini tournage vidéo': 'Mini video shoot',
        'vidéo courte': 'short video',
        'vidéo longue': 'long video',
        'Accès à 1 Média crédible': 'Access to 1 credible Media',
        'Post et/ou': 'Post and/or',
        'Story': 'Story',
        'Plan de diffusion': 'Distribution plan',
        'Plan de communication': 'Communication plan',
        'Shooting photo': 'Photo shoot',
        'photos retouchées': 'retouched photos',
        'Tournage vidéo': 'Video shoot',
        'tournage vidéo': 'video shoot',
        'tournages vidéos': 'video shoots',
        'Diagnostic stratégique personnalisé': 'Customized strategic assessment',
        'Séances stratégiques sur mesure': 'Custom strategic sessions',
        'Séances stratégiques personnalisées': 'Personalized strategic sessions',
        'Structuration & storytelling du projet': 'Project structuring & storytelling',
        'Image, visibilité & posture professionnelle': 'Image, visibility & professional posture',
        'Image, visibilité & posture dirigeante': 'Image, visibility & leadership posture',
        'Plan d\'action concret & réaliste': 'Concrete & realistic action plan',
        'Plan d\'action réaliste & mesurable': 'Realistic & measurable action plan',
        'Clarification du positionnement': 'Positioning clarification',
        'Message central & discours clair': 'Core message & clear pitch',
        'Conseils visibilité (sans tournage)': 'Visibility advice (no shooting)',
        'Structuration du storytelling de l\'entreprise': 'Company storytelling structuring',
        'shooting photo professionnel': 'professional photo shoot',
        'Shooting photo professionnel': 'Professional photo shoot',
        'vidéos longues': 'long videos',
        'chacune': 'each',
        'chacun': 'each',
        'Direction narrative': 'Narrative direction',
        'Format réseaux sociaux': 'Social media format',
        'Structuration du positionnement & discours': 'Positioning & speech structuring',
        'Storytelling & communication globale': 'Storytelling & global communication',
        'Production de contenus personnalisée': 'Customized content production',

        // Tarifs individuels
        'TARIFS INDIVIDUELS': 'INDIVIDUAL PRICING',
        'Tarifs Individuels': 'Individual Pricing',
        'PHOTO': 'PHOTO',
        'VIDÉO': 'VIDEO',
        'MARKETING': 'MARKETING',
        'MÉDIA': 'MEDIA',
        'Séance photo personnalisée': 'Personalized photo session',
        'Orientation posture & image professionnelle': 'Professional posture & image guidance',
        'Nombre de photos retouchées adapté': 'Adapted number of retouched photos',
        'Tournage vidéo personnalisé': 'Customized video shoot',
        'Nombre de vidéos adapté': 'Adapted number of videos',
        'Direction narrative & storytelling': 'Narrative direction & storytelling',
        'Conseils de diffusion': 'Distribution advice',
        'Son & cadrage professionnels': 'Professional sound & framing',
        'Orientation posture & discours': 'Posture & speech guidance',
        'Analyse du projet': 'Project analysis',
        'Clarification cible & message': 'Target & message clarification',
        'Recommandations concrètes': 'Concrete recommendations',
        'Positionnement': 'Positioning',
        'Message central': 'Core message',
        'Branding': 'Branding',
        'Option Digitales': 'Digital Option',
        'Choix des plateformes': 'Platform selection',
        'Conseils contenus': 'Content advice',
        'Diagnostic approfondi': 'In-depth assessment',
        'Priorités claires': 'Clear priorities',
        'Storytelling du projet': 'Project storytelling',
        'Plan de publication': 'Publication plan',
        'Accès à 1 média crédible': 'Access to 1 credible media',
        'Publication': 'Publication',
        'Brief en amont pour cadrer le message': 'Upstream brief to frame the message',
        'Conseils pour réutiliser la publication sur les réseaux sociaux': 'Tips for reusing the publication on social media',
        'Stratégie de visibilité pour avoir une crédibilité sur du long terme': 'Visibility strategy for long-term credibility',
        'Visibilité auprès d\'une audience ciblée et engagée': 'Visibility with a targeted and engaged audience',
        'Mise en avant de votre contenus (Artiste, marque ou évènement)': 'Highlighting your content (Artist, brand or event)',
        'Gain de notoriété et de crédibilité grâce à un relais média': 'Reputation and credibility gains through media relay',

        // === CONTACT ===
        'CONTACT': 'CONTACT',
        'Commence ton aventure maintenant': 'Start your adventure now',
        'NOM COMPLET': 'FULL NAME',
        'EMAIL PROFESSIONNEL': 'PROFESSIONAL EMAIL',
        'QUEL PROFIL': 'YOUR PROFILE',
        'ÉTUDIANT': 'STUDENT',
        'PARTICULIER': 'INDIVIDUAL',
        'ENTREPRISE': 'BUSINESS',
        'OBJET DE LA DEMANDE': 'REQUEST SUBJECT',
        'DEMANDE D\'INFORMATION': 'INFORMATION REQUEST',
        'DEVIS PERSONNALISÉ': 'CUSTOM QUOTE',
        'QUESTION SUR UNE OFFRE': 'QUESTION ABOUT AN OFFER',
        'QUESTION TECHNIQUE': 'TECHNICAL QUESTION',
        'SUPPORT CLIENT': 'CLIENT SUPPORT',
        'PARTENARIAT': 'PARTNERSHIP',
        'AUTRE': 'OTHER',
        'TYPE DE PRESTATION': 'SERVICE TYPE',
        'ÉCRIVEZ VOTRE DEMANDE': 'WRITE YOUR REQUEST',
        'Envoyer': 'Send',
        'EMAIL': 'EMAIL',
        'TÉLÉPHONE': 'PHONE',
        'HORAIRES': 'HOURS',
        'Lun - Ven : 9h - 18h': 'Mon - Fri: 9am - 6pm',

        // === LOGIN ===
        'ESPACE CLIENT': 'CLIENT AREA',
        'Connectez-vous pour accéder à votre tableau de bord': 'Log in to access your dashboard',
        'votre.email@exemple.com': 'your.email@example.com',
        'Mot de passe': 'Password',
        'Se connecter': 'Log in',
        'Mot de passe oublié ?': 'Forgot password?',
        'Contactez-nous': 'Contact us',
        'Pas encore de compte ?': 'Don\'t have an account?',
        'Créer un compte': 'Create account',
        'Découvrir nos offres ?': 'Discover our offers?',
        'Voir les offres': 'View offers',
        'Pour accepter votre devis, veuillez vous connecter ou créer votre compte. Vous pourrez ensuite payer l\'acompte de 30%.': 'To accept your quote, please log in or create your account. You can then pay the 30% deposit.',
        'Compte désactivé': 'Account deactivated',
        'Votre compte est temporairement suspendu. Vos données sont conservées.': 'Your account is temporarily suspended. Your data is preserved.',
        'Réactiver mon compte': 'Reactivate my account',

        // === REGISTER ===
        'CRÉER UN COMPTE': 'CREATE AN ACCOUNT',
        'Rejoignez FA Genesis et accédez à votre espace client': 'Join FA Genesis and access your client area',
        'Prénom': 'First Name',
        'Nom': 'Last Name',
        'Email': 'Email',
        'Téléphone': 'Phone',
        'Offre souhaitée': 'Desired offer',
        'QUELLE FORMULE ?': 'WHICH PLAN?',
        'Minimum 8 caractères': 'Minimum 8 characters',
        'Confirmer le mot de passe': 'Confirm password',
        'J\'accepte les conditions générales et la politique de confidentialité': 'I accept the terms and conditions and the privacy policy',
        'Créer mon compte': 'Create my account',
        'Déjà un compte ?': 'Already have an account?',
        'Vos données sont sécurisées et confidentielles': 'Your data is secure and confidential',
        'Acceptation de devis': 'Quote acceptance',
        'Créez votre compte pour accepter votre devis personnalisé et payer l\'acompte de 30%.': 'Create your account to accept your custom quote and pay the 30% deposit.',
        'Compte créé avec succès !': 'Account created successfully!',
        'Offre sélectionnée': 'Selected offer',

        // === DASHBOARD ===
        'Bienvenue': 'Welcome',
        'Voici un aperçu de votre espace client': 'Here is an overview of your client area',
        'Votre espace est presque prêt !': 'Your space is almost ready!',
        'Pour accéder à votre espace client et démarrer votre accompagnement, il vous suffit de régler l\'acompte de 30%.': 'To access your client area and start your support, you just need to pay the 30% deposit.',
        'Offre sélectionnée': 'Selected offer',
        'L\'acompte confirme votre inscription et déclenche le démarrage de votre projet.': 'The deposit confirms your registration and triggers the start of your project.',
        'Vous aurez accès à votre tableau de bord, vos livrables et votre suivi personnalisé.': 'You will have access to your dashboard, deliverables and personalized follow-up.',
        'Un conseiller FA Genesis vous contactera sous 24 à 48h après le paiement.': 'An FA Genesis advisor will contact you within 24 to 48 hours after payment.',
        'Payer l\'acompte (30%)': 'Pay the deposit (30%)',
        'Paiement sécurisé par SumUp': 'Secure payment via SumUp',
        'Le solde (70%) sera dû après livraison.': 'The balance (70%) will be due after delivery.',
        'Votre offre': 'Your offer',
        'Chargement...': 'Loading...',
        'Étape actuelle': 'Current step',
        'En attente': 'Pending',
        'Démarrage après paiement': 'Starting after payment',
        'Progression': 'Progress',
        'Votre parcours': 'Your journey',
        'Votre avancement': 'Your progress',
        'Votre accompagnement n\'a pas encore démarré.': 'Your support has not started yet.',
        'Suivi de votre prestation': 'Service follow-up',
        'Actions rapides': 'Quick Actions',
        'Mes livrables': 'My deliverables',
        'Téléchargez vos documents': 'Download your documents',
        'Mes séances': 'My sessions',
        'Consultez votre planning': 'Check your schedule',
        'Gérez vos informations': 'Manage your information',
        'Contactez notre équipe': 'Contact our team',
        'Besoin d\'aide ?': 'Need help?',
        'Notre équipe est là pour vous accompagner à chaque étape': 'Our team is here to support you at every step',
        'Compte créé - En attente de paiement': 'Account created - Awaiting payment',
        'Un acompte de 30% est requis pour démarrer l\'accompagnement.': 'A 30% deposit is required to start the support.',
        'Acompte payé': 'Deposit paid',
        'Acompte en cours de livraison': 'Delivery in progress',
        'Livraison prête': 'Delivery ready',
        'Livraison complétée': 'Delivery completed',
        'STATUT DE PAIEMENT': 'PAYMENT STATUS',
        'Total payé': 'Total paid',
        'Prix total': 'Total price',

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
        'Chargement de vos séances...': 'Loading your sessions...',
        'Date & heure': 'Date & time',
        'Lieu': 'Location',

        // === LIVRABLES ===
        'MES LIVRABLES': 'MY DELIVERABLES',
        'Mes Livrables': 'My Deliverables',
        'Téléchargez vos documents stratégiques': 'Download your strategic documents',
        'Tous': 'All',
        'En cours': 'In progress',
        'Terminé': 'Completed',
        'Livré': 'Delivered',
        'Télécharger': 'Download',
        'Voir tout': 'View all',
        'Aucun livrable disponible': 'No deliverables available',
        'Vos livrables apparaîtront ici': 'Your deliverables will appear here',
        'Chargement de vos livrables...': 'Loading your deliverables...',

        // === MON COMPTE ===
        'MON COMPTE': 'MY ACCOUNT',
        'Informations personnelles': 'Personal Information',
        'Modifier': 'Edit',
        'Sauvegarder': 'Save',
        'Annuler': 'Cancel',
        'Changer le mot de passe': 'Change password',
        'Mot de passe actuel': 'Current password',
        'Nouveau mot de passe': 'New password',

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
        'Récapitulatif de votre commande': 'Order Summary',
        'Procéder au paiement': 'Proceed to payment',
        'Votre paiement a été effectué avec succès !': 'Your payment was successful!',
        'Votre paiement n\'a pas été finalisé. Pas d\'inquiétude, aucun montant n\'a été débité.': 'Your payment was not completed. Don\'t worry, no amount was charged.',
        'Que s\'est-il passé ?': 'What happened?',
        'Vous souhaitez réessayer ?': 'Would you like to try again?',
        'Votre sélection est toujours disponible. Cliquez ci-dessous pour reprendre le processus de paiement.': 'Your selection is still available. Click below to resume the payment process.',
        'Besoin d\'aide ?': 'Need help?',
        'Notre équipe est disponible pour répondre à vos questions et vous accompagner dans votre paiement.': 'Our team is available to answer your questions and assist you with your payment.',

        // === FOOTER ===
        'Avertissement : FA Genesis propose un accompagnement stratégique et pédagogique. Aucun résultat n\u2019est garanti. Les livrables et recommandations dépendent de l\u2019implication du client.': 'Disclaimer: FA Genesis provides strategic and educational support. No results are guaranteed. Deliverables and recommendations depend on client involvement.',
        'Groupe FA Industries': 'FA Industries Group',
        'Conditions générales': 'Terms & Conditions',
        'Confidentialité': 'Privacy',
        'Mentions légales': 'Legal Notice',
        'Réclamation': 'Complaints',
        'Support': 'Support',
        'Tous droits réservés': 'All rights reserved',
        'Cookies': 'Cookies',
        'CGV': 'T&C',
        'Espace': 'Account',
        'Légal': 'Legal',
        'Devis personnalisé': 'Custom quote',
        'Offres Étudiants': 'Student Offers',
        'Offres Particuliers': 'Individual Offers',
        'Offres Entreprises': 'Business Offers',

        // === COOKIES BANNER ===
        'Gestion des cookies': 'Cookie Settings',
        'cookies techniques': 'technical cookies',
        'nécessaires au fonctionnement du service (authentification, session).': 'necessary for the service to function (authentication, session).',
        'Aucun cookie publicitaire ou de tracking n\u2019est utilisé.': 'No advertising or tracking cookies are used.',
        'En savoir plus sur notre politique de confidentialité': 'Learn more about our privacy policy',
        'J\u2019ai compris': 'I understand',

        // === PAGES LÉGALES ===
        'Conditions Générales de Vente': 'General Terms and Conditions of Sale',
        'Politique de Confidentialité': 'Privacy Policy',
        'Mentions Légales': 'Legal Notice',
        'Retour au site': 'Back to site',
        'Dernière mise à jour': 'Last updated',

        // === COMMUN ===
        'Chargement': 'Loading',
        'Erreur': 'Error',
        'Succès': 'Success',
        'Fermer': 'Close',
        'Inscription': 'Sign Up',
        'Connexion': 'Login',
        'ou': 'or',
        'et': 'and'
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
        if (!text) return null;
        var trimmed = text.trim();
        if (!trimmed) return null;

        // Match exact
        if (translations[trimmed]) {
            return text.replace(trimmed, translations[trimmed]);
        }

        // Match partiel pour les textes longs
        var changed = false;
        var result = text;
        // Trier les clés par longueur décroissante pour éviter les remplacements partiels
        var keys = Object.keys(translations).sort(function(a, b) { return b.length - a.length; });
        for (var i = 0; i < keys.length; i++) {
            if (keys[i].length >= 4 && result.indexOf(keys[i]) !== -1) {
                result = result.split(keys[i]).join(translations[keys[i]]);
                changed = true;
            }
        }
        return changed ? result : null;
    }

    // ========================================
    // FONCTION : Parcourir le DOM et traduire
    // ========================================
    function translatePage(lang) {
        if (lang === 'fr') {
            restoreOriginal();
            return;
        }

        if (lang === 'en' && !isTranslated) {
            collectAndTranslate();
        }
    }

    function collectAndTranslate() {
        originalTexts = [];

        // 1. Traduire les text nodes
        var walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        var textNodes = [];
        var node;
        while (node = walker.nextNode()) {
            if (node.nodeValue && node.nodeValue.trim().length > 1) {
                var parent = node.parentNode;
                if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.tagName === 'NOSCRIPT')) continue;
                textNodes.push(node);
            }
        }

        for (var i = 0; i < textNodes.length; i++) {
            var original = textNodes[i].nodeValue;
            var translated = translate(original);
            if (translated && translated !== original) {
                originalTexts.push({ node: textNodes[i], original: original, type: 'text' });
                textNodes[i].nodeValue = translated;
            }
        }

        // 2. Traduire les placeholders
        var inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]');
        for (var j = 0; j < inputs.length; j++) {
            var ph = inputs[j].getAttribute('placeholder');
            var phTranslated = translate(ph);
            if (phTranslated && phTranslated !== ph) {
                originalTexts.push({ node: inputs[j], original: ph, type: 'placeholder' });
                inputs[j].setAttribute('placeholder', phTranslated);
            }
        }

        // 3. Traduire le title de page
        var titleText = document.title;
        if (titleText) {
            var newTitle = titleText;
            newTitle = newTitle.replace('Accueil', 'Home');
            newTitle = newTitle.replace('Nos Offres', 'Our Offers');
            newTitle = newTitle.replace('À Propos', 'About');
            newTitle = newTitle.replace('Espace Client', 'Client Area');
            newTitle = newTitle.replace('Mes Séances', 'My Sessions');
            newTitle = newTitle.replace('Mes Livrables', 'My Deliverables');
            newTitle = newTitle.replace('Mon Compte', 'My Account');
            newTitle = newTitle.replace('Connexion', 'Login');
            newTitle = newTitle.replace('Inscription', 'Sign Up');
            newTitle = newTitle.replace('Créer un compte', 'Create Account');
            newTitle = newTitle.replace('Paiement réussi', 'Payment Successful');
            newTitle = newTitle.replace('Paiement annulé', 'Payment Cancelled');
            newTitle = newTitle.replace('Conditions Générales', 'Terms & Conditions');
            newTitle = newTitle.replace('Politique de Confidentialité', 'Privacy Policy');
            newTitle = newTitle.replace('Mentions Légales', 'Legal Notice');
            newTitle = newTitle.replace('Réclamation', 'Complaints');
            if (newTitle !== titleText) {
                originalTexts.push({ node: null, original: titleText, type: 'title' });
                document.title = newTitle;
            }
        }

        // 4. Traduire les boutons input
        var buttons = document.querySelectorAll('input[type="submit"], input[type="button"]');
        for (var b = 0; b < buttons.length; b++) {
            var val = buttons[b].value;
            var valTranslated = translate(val);
            if (valTranslated && valTranslated !== val) {
                originalTexts.push({ node: buttons[b], original: val, type: 'value' });
                buttons[b].value = valTranslated;
            }
        }

        // 5. Traduire les options de select
        var selects = document.querySelectorAll('select option');
        for (var s = 0; s < selects.length; s++) {
            var optText = selects[s].textContent;
            var optTranslated = translate(optText);
            if (optTranslated && optTranslated !== optText) {
                originalTexts.push({ node: selects[s], original: optText, type: 'text' });
                selects[s].textContent = optTranslated;
            }
        }

        isTranslated = true;
    }

    function restoreOriginal() {
        for (var i = 0; i < originalTexts.length; i++) {
            var item = originalTexts[i];
            if (item.type === 'title') {
                document.title = item.original;
            } else if (item.type === 'placeholder') {
                item.node.setAttribute('placeholder', item.original);
            } else if (item.type === 'value') {
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
            setTimeout(autoTranslate, 300);
        });
    } else {
        setTimeout(autoTranslate, 300);
    }
})();
