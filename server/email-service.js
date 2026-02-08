/**
 * FA GENESIS - Service d'envoi d'emails
 * Gère l'envoi d'emails automatiques via Nodemailer
 */

const nodemailer = require('nodemailer');

// ============================================================
// CONFIGURATION DU TRANSPORTEUR SMTP
// ============================================================

let transporter = null;

function initializeTransporter() {
    if (transporter) return transporter;

    const smtpConfig = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
        }
    };

    // Vérifier que la configuration est présente
    if (!smtpConfig.host || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
        console.warn('[EMAIL] Configuration SMTP incomplète - Les emails ne seront pas envoyés');
        return null;
    }

    transporter = nodemailer.createTransport(smtpConfig);

    // Vérifier la connexion au démarrage
    transporter.verify((error, success) => {
        if (error) {
            console.error('[EMAIL] Erreur connexion SMTP:', error.message);
        } else {
            console.log('[EMAIL] Connexion SMTP établie avec succès');
        }
    });

    return transporter;
}

// ============================================================
// TEMPLATES D'EMAILS
// ============================================================

/**
 * Template HTML pour les emails FA GENESIS
 */
function getEmailTemplate(content, title = 'FA GENESIS') {
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 0;">
                <table role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #000000; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #000000; border-bottom: 4px solid #FFD700;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #FFD700; letter-spacing: 2px;">
                                FA GENESIS
                            </h1>
                            <p style="margin: 5px 0 0 0; font-size: 12px; color: #888888; text-transform: uppercase; letter-spacing: 1px;">
                                Groupe FA Industries
                            </p>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px; background-color: #ffffff;">
                            ${content}
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f8f8f8; border-top: 1px solid #e0e0e0;">
                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666; text-align: center;">
                                <strong>FA GENESIS</strong> - Conseil en image et communication
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #999999; text-align: center;">
                                Email : <a href="mailto:Financialadvicegenesis@gmail.com" style="color: #FFD700;">Financialadvicegenesis@gmail.com</a>
                            </p>
                            <p style="margin: 15px 0 0 0; font-size: 11px; color: #cccccc; text-align: center;">
                                Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
}

// ============================================================
// FONCTIONS D'ENVOI D'EMAILS
// ============================================================

/**
 * Retourne un paragraphe specifique selon l'objet de la demande
 * @param {string} subject - L'objet de la demande
 * @returns {string} HTML du paragraphe adapte
 */
function getSubjectSpecificContent(subject) {
    const s = (subject || '').toLowerCase();

    if (s.includes('information')) {
        return `Pour mieux vous orienter, nous vous invitons à consulter notre <strong>page Offres</strong> qui détaille l'ensemble de nos accompagnements et prestations. Notre équipe reviendra vers vous avec les informations complémentaires adaptées à votre situation.`;
    }

    if (s.includes('devis')) {
        return `Votre demande de <strong>devis personnalisé</strong> a bien été enregistrée. Un conseiller FA GENESIS étudiera votre projet en détail afin de vous proposer une solution sur mesure, adaptée à vos objectifs et à votre budget.`;
    }

    if (s.includes('offre')) {
        return `Nous avons bien noté votre question concernant nos offres. Chaque accompagnement est conçu pour répondre à des besoins spécifiques — notre équipe vous apportera une <strong>réponse claire et détaillée</strong>.`;
    }

    if (s.includes('technique')) {
        return `Votre question technique a été transmise à notre équipe compétente. Si votre demande concerne un accès ou un problème sur votre espace client, vérifiez vos identifiants de connexion en attendant notre retour.`;
    }

    if (s.includes('support')) {
        return `Votre demande de support a bien été prise en compte. Si vous êtes déjà client, vous pouvez accéder à votre <strong>espace client</strong> pour consulter vos documents et suivre l'avancement de votre accompagnement.`;
    }

    if (s.includes('partenariat')) {
        return `Nous avons bien reçu votre proposition de partenariat. L'équipe FA GENESIS évalue attentivement chaque opportunité de collaboration. Si votre projet correspond à notre vision, nous vous recontacterons pour en discuter.`;
    }

    // Defaut (autre ou non reconnu)
    return `Votre message a bien été transmis à l'équipe concernée. Nous vous répondrons dans les meilleurs délais.`;
}

/**
 * Envoyer un email de confirmation de contact au client
 */
async function sendContactConfirmation(clientEmail, clientName, subject) {
    const transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configuré - Email de confirmation non envoyé');
        return { success: false, reason: 'SMTP non configuré' };
    }

    const frontUrl = process.env.FRONT_URL || 'https://financialadvicegenesis.github.io/fa-genesis-website';

    const content = `
        <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333; line-height: 1.6;">
            Bonjour,
        </p>

        <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333; line-height: 1.6;">
            Nous vous remercions pour votre message et l'intérêt que vous portez à <strong>Financial Advice Genesis</strong>.
        </p>

        <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333; line-height: 1.6;">
            Votre demande a bien été reçue par notre équipe. Nous l'analysons avec attention afin de vous apporter une réponse claire, personnalisée et adaptée à votre situation.
        </p>

        <div style="background-color: #000000; color: #ffffff; padding: 20px; border-radius: 4px; margin: 25px 0;">
            <p style="margin: 0; font-size: 16px; font-weight: 700; color: #FFD700;">
                ⏳ Délai de réponse
            </p>
            <p style="margin: 10px 0 0 0; font-size: 15px; color: #ffffff;">
                Nous nous engageons à revenir vers vous dans un délai maximum de <strong>48 heures ouvrées</strong>.
            </p>
        </div>

        <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333; line-height: 1.6;">
            En attendant, nous vous invitons à consulter notre <a href="${frontUrl}/offres.html" style="color: #B8860B; font-weight: 700; text-decoration: underline;">page Offres</a> ou notre espace d'information, où vous trouverez des éléments utiles concernant nos accompagnements.
        </p>

        <p style="margin: 0 0 30px 0; font-size: 14px; color: #999999; font-style: italic;">
            Ce message est automatique. Il n'est pas nécessaire d'y répondre.
        </p>

        <p style="margin: 0 0 5px 0; font-size: 16px; color: #333333;">
            À très bientôt,
        </p>

        <p style="margin: 0 0 5px 0; font-size: 16px; color: #000000; font-weight: 700;">
            L'équipe Financial Advice Genesis
        </p>
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #B8860B; font-weight: 700; font-style: italic;">
            Build. Launch. Impact.
        </p>
        <p style="margin: 0; font-size: 14px; color: #666666;">
            Contact : <a href="mailto:financialadvicegenesis@gmail.com" style="color: #B8860B;">financialadvicegenesis@gmail.com</a>
        </p>
    `;

    try {
        const result = await transport.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
            to: clientEmail,
            subject: `[FA GENESIS] Confirmation de réception de votre message`,
            html: getEmailTemplate(content, 'Confirmation de réception')
        });

        console.log(`[EMAIL] Confirmation envoyée à ${clientEmail} - ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId };

    } catch (error) {
        console.error('[EMAIL] Erreur envoi confirmation:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Envoyer une notification interne à l'admin (Gmail)
 */
async function sendAdminNotification(messageData) {
    const transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configuré - Notification admin non envoyée');
        return { success: false, reason: 'SMTP non configuré' };
    }

    const content = `
        <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #000000; font-weight: 700;">
            Nouveau message reçu
        </h2>

        <div style="background-color: #f5f5f5; padding: 25px; border-radius: 4px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; font-weight: 700; color: #666;">Nom</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; color: #000;">${messageData.name}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; font-weight: 700; color: #666;">Email</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0;">
                        <a href="mailto:${messageData.email}" style="color: #FFD700;">${messageData.email}</a>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; font-weight: 700; color: #666;">Téléphone</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; color: #000;">${messageData.phone || 'Non renseigné'}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; font-weight: 700; color: #666;">Profil</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; color: #000;">${messageData.profil ? messageData.profil.charAt(0).toUpperCase() + messageData.profil.slice(1) : 'Non renseigné'}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; font-weight: 700; color: #666;">Sujet</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; color: #000;">${messageData.subject}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; font-weight: 700; color: #666;">Date</td>
                    <td style="padding: 10px 0; color: #000;">${new Date().toLocaleString('fr-FR')}</td>
                </tr>
            </table>
        </div>

        <div style="background-color: #FFF9E6; border: 1px solid #FFD700; padding: 20px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0; font-weight: 700; color: #000;">Message :</p>
            <p style="margin: 0; color: #333; white-space: pre-line; line-height: 1.6;">${messageData.message}</p>
        </div>

        <p style="margin: 20px 0 0 0; font-size: 14px; color: #666;">
            <a href="mailto:${messageData.email}?subject=Re: ${encodeURIComponent(messageData.subject)}"
               style="display: inline-block; background-color: #FFD700; color: #000; padding: 12px 25px; text-decoration: none; font-weight: 700; border-radius: 4px;">
                Répondre au client
            </a>
        </p>
    `;

    try {
        const result = await transport.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
            to: process.env.EMAIL_ADMIN_ADDRESS,
            subject: `[FA GENESIS] Nouveau message de ${messageData.name}`,
            html: getEmailTemplate(content, 'Nouveau message'),
            replyTo: messageData.email
        });

        console.log(`[EMAIL] Notification admin envoyée - ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId };

    } catch (error) {
        console.error('[EMAIL] Erreur envoi notification admin:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Envoyer un email de confirmation d'inscription
 * Contenu dynamique selon le type d'offre (accompagnement ou prestation individuelle)
 *
 * @param {string} clientEmail - Email du client
 * @param {string} prenom - Prénom du client
 * @param {Object} offerData - Données de l'offre { name, category, product_type, total_price, duration, deposit_amount, balance_amount }
 */
async function sendRegistrationConfirmation(clientEmail, prenom, offerData = null) {
    const transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configuré - Email d\'inscription non envoyé');
        return { success: false, reason: 'SMTP non configuré' };
    }

    // Déterminer le type de contenu selon l'offre
    const isAccompagnement = offerData && offerData.product_type === 'accompagnement';
    const isPrestation = offerData && offerData.product_type === 'prestation_individuelle';
    const hasOffer = offerData && offerData.name;

    // Générer le contenu dynamique selon le type d'offre
    let offerSection = '';
    let nextStepsSection = '';

    if (hasOffer) {
        // Section de l'offre sélectionnée
        offerSection = `
        <div style="background-color: #000000; color: #ffffff; padding: 25px; border-radius: 4px; margin: 25px 0; text-align: center;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #888888; text-transform: uppercase;">
                ${isAccompagnement ? 'Accompagnement sélectionné' : 'Prestation sélectionnée'}
            </p>
            <p style="margin: 0; font-size: 22px; font-weight: 700; color: #FFD700;">
                ${offerData.name}
            </p>
            ${offerData.duration ? `<p style="margin: 10px 0 0 0; font-size: 14px; color: #cccccc;">Durée : ${offerData.duration}</p>` : ''}
        </div>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 4px; margin: 25px 0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: 700; color: #666;">Prix total</td>
                    <td style="padding: 8px 0; color: #000; text-align: right; font-weight: 700;">${offerData.total_price ? offerData.total_price.toFixed(2) + ' €' : 'Sur devis'}</td>
                </tr>
                ${offerData.deposit_amount ? `
                <tr>
                    <td style="padding: 8px 0; font-weight: 700; color: #666;">Acompte (30%)</td>
                    <td style="padding: 8px 0; color: #000; text-align: right;">${offerData.deposit_amount.toFixed(2)} €</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: 700; color: #666;">Solde (70%)</td>
                    <td style="padding: 8px 0; color: #000; text-align: right;">${offerData.balance_amount.toFixed(2)} €</td>
                </tr>
                ` : ''}
            </table>
        </div>
        `;

        // Section des prochaines étapes selon le type d'offre
        if (isAccompagnement) {
            nextStepsSection = `
            <div style="background-color: #FFF9E6; border-left: 4px solid #FFD700; padding: 20px; margin: 25px 0;">
                <p style="margin: 0 0 15px 0; font-weight: 700; color: #000; font-size: 16px;">
                    Prochaines étapes de votre accompagnement :
                </p>
                <ol style="margin: 0; padding-left: 20px; color: #333; line-height: 2;">
                    <li><strong>Connexion à votre espace client</strong> – Accédez à votre tableau de bord personnalisé</li>
                    <li><strong>Règlement de l'acompte (30%)</strong> – Pour démarrer votre accompagnement</li>
                    <li><strong>Prise de contact sous 24-48h</strong> – Un conseiller FA Genesis vous contactera</li>
                    <li><strong>Lancement de votre parcours</strong> – Début de votre accompagnement sur ${offerData.duration || 'la période définie'}</li>
                </ol>
            </div>
            `;
        } else if (isPrestation) {
            nextStepsSection = `
            <div style="background-color: #FFF9E6; border-left: 4px solid #FFD700; padding: 20px; margin: 25px 0;">
                <p style="margin: 0 0 15px 0; font-weight: 700; color: #000; font-size: 16px;">
                    Prochaines étapes de votre prestation :
                </p>
                <ol style="margin: 0; padding-left: 20px; color: #333; line-height: 2;">
                    <li><strong>Règlement de l'acompte (30%)</strong> – Pour confirmer votre commande</li>
                    <li><strong>Planification de la prestation</strong> – Nous vous contacterons sous 24-48h pour fixer une date</li>
                    <li><strong>Réalisation de la prestation</strong> – Notre équipe s'occupe de tout</li>
                    <li><strong>Livraison des fichiers</strong> – Vous recevrez un aperçu dans votre espace client</li>
                    <li><strong>Règlement du solde (70%)</strong> – Pour télécharger vos fichiers originaux en haute qualité</li>
                </ol>
            </div>
            `;
        }
    } else {
        // Pas d'offre spécifique
        nextStepsSection = `
        <div style="background-color: #FFF9E6; border-left: 4px solid #FFD700; padding: 20px; margin: 25px 0;">
            <p style="margin: 0 0 15px 0; font-weight: 700; color: #000; font-size: 16px;">
                Prochaines étapes :
            </p>
            <ol style="margin: 0; padding-left: 20px; color: #333; line-height: 2;">
                <li><strong>Découvrez nos offres</strong> – Consultez notre catalogue d'accompagnements et prestations</li>
                <li><strong>Choisissez votre formule</strong> – Sélectionnez l'offre adaptée à vos besoins</li>
                <li><strong>Contactez-nous</strong> – Notre équipe est disponible pour vous conseiller</li>
            </ol>
        </div>
        `;
    }

    const content = `
        <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #000000; font-weight: 700;">
            Bienvenue ${prenom} !
        </h2>

        <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333; line-height: 1.6;">
            Nous sommes ravis de vous accueillir chez <strong>FA GENESIS</strong>. Votre compte a été créé avec succès et votre inscription a bien été prise en compte.
        </p>

        <div style="background-color: #e8f5e9; border: 1px solid #4caf50; padding: 15px 20px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; font-size: 15px; color: #2e7d32;">
                <strong>Votre compte est actif</strong> – Vous pouvez dès maintenant vous connecter à votre espace client.
            </p>
        </div>

        ${offerSection}

        ${nextStepsSection}

        <div style="background-color: #000000; color: #ffffff; padding: 20px; border-radius: 4px; margin: 25px 0; text-align: center;">
            <p style="margin: 0 0 15px 0; font-size: 14px; color: #cccccc;">
                Accédez à votre espace client pour suivre votre commande
            </p>
            <a href="${process.env.FRONT_URL || 'http://127.0.0.1:5500'}/login.html"
               style="display: inline-block; background-color: #FFD700; color: #000; padding: 15px 30px; text-decoration: none; font-weight: 700; border-radius: 4px; font-size: 16px;">
                Se connecter
            </a>
        </div>

        <p style="margin: 25px 0 15px 0; font-size: 16px; color: #333333; line-height: 1.6;">
            <strong>Une question ?</strong> Notre équipe est à votre disposition pour vous accompagner. N'hésitez pas à nous contacter par email ou via le formulaire de contact de notre site.
        </p>

        <p style="margin: 30px 0 0 0; font-size: 16px; color: #333333;">
            À très bientôt,<br>
            <strong style="color: #000000;">L'équipe FA GENESIS</strong>
        </p>
    `;

    try {
        const subjectLine = hasOffer
            ? `Bienvenue ${prenom} ! Votre ${isAccompagnement ? 'accompagnement' : 'prestation'} ${offerData.name} est confirmé(e)`
            : `Bienvenue ${prenom} ! Votre compte FA GENESIS est créé`;

        const result = await transport.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
            to: clientEmail,
            subject: `[FA GENESIS] ${subjectLine}`,
            html: getEmailTemplate(content, 'Confirmation d\'inscription')
        });

        console.log(`[EMAIL] Confirmation inscription envoyée à ${clientEmail} - ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId };

    } catch (error) {
        console.error('[EMAIL] Erreur envoi confirmation inscription:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Envoyer une notification d'inscription à l'admin
 */
async function sendAdminRegistrationNotification(registrationData) {
    const transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configuré - Notification inscription non envoyée');
        return { success: false, reason: 'SMTP non configuré' };
    }

    const content = `
        <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #000000; font-weight: 700;">
            Nouvelle inscription client
        </h2>

        <div style="background-color: #000000; color: #ffffff; padding: 20px; border-radius: 4px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 5px 0; font-size: 14px; color: #888888;">Offre choisie</p>
            <p style="margin: 0; font-size: 20px; font-weight: 700; color: #FFD700;">${registrationData.offerName || 'Aucune offre sélectionnée'}</p>
        </div>

        <div style="background-color: #f5f5f5; padding: 25px; border-radius: 4px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; font-weight: 700; color: #666;">Nom complet</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; color: #000;">${registrationData.firstName} ${registrationData.lastName}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; font-weight: 700; color: #666;">Email</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0;">
                        <a href="mailto:${registrationData.email}" style="color: #FFD700;">${registrationData.email}</a>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; font-weight: 700; color: #666;">Téléphone</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e0e0e0; color: #000;">${registrationData.phone || 'Non renseigné'}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; font-weight: 700; color: #666;">Date d'inscription</td>
                    <td style="padding: 10px 0; color: #000;">${new Date().toLocaleString('fr-FR')}</td>
                </tr>
            </table>
        </div>

        <p style="margin: 20px 0 0 0; font-size: 14px; color: #666;">
            <a href="mailto:${registrationData.email}?subject=FA GENESIS - Votre inscription"
               style="display: inline-block; background-color: #FFD700; color: #000; padding: 12px 25px; text-decoration: none; font-weight: 700; border-radius: 4px;">
                Contacter le client
            </a>
        </p>
    `;

    try {
        const result = await transport.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
            to: process.env.EMAIL_ADMIN_ADDRESS,
            subject: `[FA GENESIS] Nouvelle inscription - ${registrationData.firstName} ${registrationData.lastName}`,
            html: getEmailTemplate(content, 'Nouvelle inscription'),
            replyTo: registrationData.email
        });

        console.log(`[EMAIL] Notification inscription admin envoyée - ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId };

    } catch (error) {
        console.error('[EMAIL] Erreur envoi notification inscription:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Envoyer un email de confirmation de paiement
 */
async function sendPaymentConfirmation(clientEmail, clientName, orderData) {
    const transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configuré - Email paiement non envoyé');
        return { success: false, reason: 'SMTP non configuré' };
    }

    const isDeposit = !orderData.balance_paid;
    const paymentType = isDeposit ? 'Acompte (30%)' : 'Solde (70%)';
    const amountPaid = isDeposit ? orderData.deposit_amount : orderData.balance_amount;

    const content = `
        <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #000000; font-weight: 700;">
            Paiement confirmé, ${clientName} !
        </h2>

        <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333; line-height: 1.6;">
            Nous vous confirmons la bonne réception de votre paiement.
        </p>

        <div style="background-color: #e8f5e9; border: 1px solid #4caf50; padding: 20px; border-radius: 4px; margin: 25px 0; text-align: center;">
            <p style="margin: 0 0 5px 0; font-size: 14px; color: #666;">Montant reçu</p>
            <p style="margin: 0; font-size: 28px; font-weight: 700; color: #4caf50;">
                ${amountPaid.toFixed(2)} €
            </p>
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">${paymentType}</p>
        </div>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 4px; margin: 25px 0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: 700; color: #666;">Commande</td>
                    <td style="padding: 8px 0; color: #000; text-align: right;">${orderData.id}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: 700; color: #666;">Offre</td>
                    <td style="padding: 8px 0; color: #000; text-align: right;">${orderData.product_name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: 700; color: #666;">Total de l'offre</td>
                    <td style="padding: 8px 0; color: #000; text-align: right;">${orderData.total_amount.toFixed(2)} €</td>
                </tr>
            </table>
        </div>

        ${isDeposit ? `
        <div style="background-color: #FFF9E6; border-left: 4px solid #FFD700; padding: 20px; margin: 25px 0;">
            <p style="margin: 0; color: #333; line-height: 1.6;">
                <strong>Prochaine étape :</strong> Vous pouvez maintenant accéder à votre espace client pour suivre votre ${orderData.product_type === 'accompagnement' ? 'accompagnement' : 'prestation'}.
            </p>
        </div>
        ` : `
        <div style="background-color: #e8f5e9; border-left: 4px solid #4caf50; padding: 20px; margin: 25px 0;">
            <p style="margin: 0; color: #333; line-height: 1.6;">
                <strong>Paiement complet !</strong> Vous avez maintenant accès à tous vos contenus et livrables.
            </p>
        </div>
        `}

        <p style="margin: 30px 0 0 0; font-size: 16px; color: #333333;">
            Merci pour votre confiance,<br>
            <strong style="color: #000000;">L'équipe FA GENESIS</strong>
        </p>
    `;

    try {
        const result = await transport.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
            to: clientEmail,
            subject: `[FA GENESIS] Confirmation de paiement - ${paymentType}`,
            html: getEmailTemplate(content, 'Confirmation de paiement')
        });

        console.log(`[EMAIL] Confirmation paiement envoyée à ${clientEmail} - ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId };

    } catch (error) {
        console.error('[EMAIL] Erreur envoi confirmation paiement:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Echapper les caracteres speciaux HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Envoyer une reponse admin a un message client
 */
async function sendAdminReply(clientEmail, clientName, originalSubject, replyMessage) {
    console.log(`[EMAIL] sendAdminReply appele pour ${clientEmail}`);

    const transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configure - Reponse admin non envoyee');
        return { success: false, reason: 'SMTP non configure' };
    }

    const safeName = escapeHtml(clientName);
    const safeSubject = escapeHtml(originalSubject);
    const safeReply = escapeHtml(replyMessage);

    const content = `
        <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #000000; font-weight: 700;">
            Bonjour ${safeName},
        </h2>

        <p style="margin: 0 0 10px 0; font-size: 14px; color: #888888;">
            En r\u00e9ponse \u00e0 votre message : <strong>${safeSubject}</strong>
        </p>

        <div style="background-color: #FFF9E6; border-left: 4px solid #FFD700; padding: 20px; margin: 25px 0;">
            <p style="margin: 0; font-size: 15px; color: #333333; white-space: pre-wrap; line-height: 1.6;">${safeReply}</p>
        </div>

        <p style="margin: 25px 0 5px 0; font-size: 16px; color: #333333;">
            Cordialement,
        </p>

        <p style="margin: 0 0 5px 0; font-size: 16px; color: #000000; font-weight: 700;">
            L'\u00e9quipe Financial Advice Genesis
        </p>
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #B8860B; font-weight: 700; font-style: italic;">
            Build. Launch. Impact.
        </p>
        <p style="margin: 0; font-size: 14px; color: #666666;">
            Contact : <a href="mailto:financialadvicegenesis@gmail.com" style="color: #B8860B;">financialadvicegenesis@gmail.com</a>
        </p>
    `;

    const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER;
    const fromName = process.env.EMAIL_FROM_NAME || 'FA GENESIS';

    try {
        const result = await transport.sendMail({
            from: `"${fromName}" <${fromAddress}>`,
            to: clientEmail,
            subject: `[FA GENESIS] Re: ${originalSubject}`,
            html: getEmailTemplate(content, 'Reponse FA GENESIS'),
            replyTo: fromAddress
        });

        console.log(`[EMAIL] Reponse admin envoyee a ${clientEmail} - ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId };

    } catch (error) {
        console.error('[EMAIL] Erreur envoi reponse admin:', error.message, error.stack);
        return { success: false, error: error.message };
    }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    initializeTransporter,
    sendContactConfirmation,
    sendAdminNotification,
    sendRegistrationConfirmation,
    sendAdminRegistrationNotification,
    sendPaymentConfirmation,
    sendAdminReply
};
