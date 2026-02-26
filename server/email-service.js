/**
 * FA GENESIS - Service d'envoi d'emails
 * Supporte 2 modes : Brevo HTTP API (production) et SMTP direct (local)
 */

const nodemailer = require('nodemailer');
const fetch = require('node-fetch');

// ============================================================
// CONFIGURATION DU TRANSPORTEUR EMAIL
// ============================================================

let transporter = null;

/**
 * Envoyer un email via Brevo HTTP API
 */
async function sendViaBrevo(mailOptions) {
    const apiKey = process.env.BREVO_API_KEY;

    // Parser le champ "from"
    const fromMatch = mailOptions.from ? mailOptions.from.match(/"(.+)"\s*<(.+)>/) : null;
    const senderName = fromMatch ? fromMatch[1] : (process.env.EMAIL_FROM_NAME || 'FA GENESIS');
    const senderEmail = fromMatch ? fromMatch[2] : (process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER);

    const body = {
        sender: { name: senderName, email: senderEmail },
        to: [{ email: typeof mailOptions.to === 'string' ? mailOptions.to : mailOptions.to[0] }],
        subject: mailOptions.subject,
        htmlContent: mailOptions.html
    };

    if (mailOptions.replyTo) {
        const replyEmail = typeof mailOptions.replyTo === 'string' ? mailOptions.replyTo : mailOptions.replyTo.address;
        body.replyTo = { email: replyEmail };
    }

    console.log(`[EMAIL] Brevo API -> ${body.to[0].email} | Sujet: ${body.subject}`);

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Erreur Brevo API: ' + response.status);
    }

    console.log(`[EMAIL] Brevo OK - messageId: ${data.messageId || 'N/A'}`);
    return { messageId: data.messageId || ('brevo-' + Date.now()) };
}

function initializeTransporter() {
    if (transporter) return transporter;

    // Mode 1 : Brevo HTTP API (pour production / cloud hosting)
    if (process.env.BREVO_API_KEY) {
        console.log('[EMAIL] Mode Brevo HTTP API activé');
        transporter = {
            sendMail: sendViaBrevo,
            verify: (cb) => cb(null, true)
        };
        return transporter;
    }

    // Mode 2 : SMTP direct (pour developpement local)
    const port = parseInt(process.env.SMTP_PORT) || 465;
    const secure = process.env.SMTP_SECURE === 'false' ? false : (port === 465);

    const smtpConfig = {
        host: process.env.SMTP_HOST,
        port: port,
        secure: secure,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
        },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000
    };

    console.log(`[EMAIL] Mode SMTP: host=${smtpConfig.host}, port=${smtpConfig.port}, secure=${smtpConfig.secure}`);

    if (!smtpConfig.host || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
        console.warn('[EMAIL] Configuration SMTP incomplète - Les emails ne seront pas envoyés');
        return null;
    }

    transporter = nodemailer.createTransport(smtpConfig);

    transporter.verify((error, success) => {
        if (error) {
            console.error('[EMAIL] Erreur connexion SMTP:', error.message);
            transporter = null;
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
                            <p style="margin: 5px 0 0 0; font-size: 12px; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">
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
                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #000000; text-align: center;">
                                <strong>FA GENESIS</strong> - Structurez votre idée. Lancez avec clarté
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #333333; text-align: center;">
                                Email : <a href="mailto:Financialadvicegenesis@gmail.com" style="color: #FFD700; font-weight:700;">Financialadvicegenesis@gmail.com</a>
                            </p>
                            <p style="margin: 15px 0 0 0; font-size: 11px; color: #555555; text-align: center;">
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

    const frontUrl = process.env.FRONT_URL || 'https://fagenesis.com';

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
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #FFD700; font-weight: 700; font-style: italic;">
            Build. Launch. Impact.
        </p>
        <p style="margin: 0; font-size: 14px; color: #666666;">
            Contact : <a href="mailto:financialadvicegenesis@gmail.com" style="color: #FFD700; font-weight:700;">financialadvicegenesis@gmail.com</a>
        </p>
    `;

    try {
        const result = await transport.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
            to: clientEmail,
            subject: `[FA GENESIS] Confirmation de réception de votre message`,
            html: getEmailTemplate(content, 'Confirmation de réception'),
            replyTo: process.env.EMAIL_ADMIN_ADDRESS || process.env.EMAIL_FROM_ADDRESS
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
            to: process.env.EMAIL_ADMIN_ADDRESS || 'financialadvicegenesis@gmail.com',
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
            <div style="background-color: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px 20px; border-radius: 4px; margin: 20px 0;">
                <p style="margin: 0; font-size: 15px; color: #2e7d32;">
                    <strong>Acompte confirmé (${offerData.deposit_amount ? offerData.deposit_amount.toFixed(2) + ' €' : '30%'})</strong> – Votre espace client est activé !
                </p>
            </div>
            <div style="background-color: #FFF9E6; border-left: 4px solid #FFD700; padding: 20px; margin: 25px 0;">
                <p style="margin: 0 0 15px 0; font-weight: 700; color: #000; font-size: 16px;">
                    Prochaines étapes de votre accompagnement :
                </p>
                <ol style="margin: 0; padding-left: 20px; color: #333; line-height: 2;">
                    <li><strong>Choisissez votre date de lancement</strong> – Rendez-vous dans votre espace client pour sélectionner la date de début de votre accompagnement via le calendrier</li>
                    <li><strong>Confirmation par notre équipe</strong> – L'équipe FA Genesis et votre partenaire dédié valideront la date choisie</li>
                    <li><strong>Votre parcours démarre</strong> – Début de votre accompagnement sur ${offerData.duration || 'la période définie'}, à la date confirmée</li>
                    <li><strong>Solde (${offerData.balance_amount ? offerData.balance_amount.toFixed(2) + ' €' : '70%'})</strong> – À régler en fin de parcours</li>
                </ol>
            </div>
            `;
        } else if (isPrestation) {
            nextStepsSection = `
            <div style="background-color: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px 20px; border-radius: 4px; margin: 20px 0;">
                <p style="margin: 0; font-size: 15px; color: #2e7d32;">
                    <strong>Acompte confirmé (${offerData.deposit_amount ? offerData.deposit_amount.toFixed(2) + ' €' : '30%'})</strong> – Votre commande est validée !
                </p>
            </div>
            <div style="background-color: #FFF9E6; border-left: 4px solid #FFD700; padding: 20px; margin: 25px 0;">
                <p style="margin: 0 0 15px 0; font-weight: 700; color: #000; font-size: 16px;">
                    Prochaines étapes de votre prestation :
                </p>
                <ol style="margin: 0; padding-left: 20px; color: #333; line-height: 2;">
                    <li><strong>Choisissez votre date de prestation</strong> – Rendez-vous dans votre espace client pour sélectionner la date souhaitée via le calendrier</li>
                    <li><strong>Confirmation par notre équipe</strong> – L'équipe FA Genesis et votre partenaire dédié valideront la date choisie</li>
                    <li><strong>Réalisation de la prestation</strong> – Notre équipe s'occupe de tout à la date confirmée</li>
                    <li><strong>Solde (${offerData.balance_amount ? offerData.balance_amount.toFixed(2) + ' €' : '70%'})</strong> – Pour télécharger vos fichiers originaux en haute qualité</li>
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
            Nous sommes ravis de vous accueillir chez <strong>FA GENESIS</strong>. Votre paiement a bien été reçu et votre espace client est désormais activé.
        </p>

        <div style="background-color: #e8f5e9; border: 1px solid #4caf50; padding: 15px 20px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; font-size: 15px; color: #2e7d32;">
                <strong>Votre espace client est prêt</strong> – Connectez-vous dès maintenant pour choisir votre date de ${isAccompagnement ? 'lancement' : isPrestation ? 'prestation' : 'démarrage'} via le calendrier.
            </p>
        </div>

        ${offerSection}

        ${nextStepsSection}

        <div style="background-color: #000000; color: #ffffff; padding: 20px; border-radius: 4px; margin: 25px 0; text-align: center;">
            <p style="margin: 0 0 15px 0; font-size: 14px; color: #cccccc;">
                Accédez à votre espace client pour choisir votre date de ${isAccompagnement ? 'lancement' : isPrestation ? 'prestation' : 'démarrage'}
            </p>
            <a href="${process.env.FRONT_URL || 'https://fagenesis.com'}/login.html"
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
            ? `${prenom}, votre ${isAccompagnement ? 'accompagnement' : 'prestation'} ${offerData.name} est lancé${isPrestation ? 'e' : ''} !`
            : `Bienvenue ${prenom} ! Votre compte FA GENESIS est créé`;

        const result = await transport.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
            to: clientEmail,
            subject: `[FA GENESIS] ${subjectLine}`,
            html: getEmailTemplate(content, 'Confirmation de paiement')
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
            to: process.env.EMAIL_ADMIN_ADDRESS || 'financialadvicegenesis@gmail.com',
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
    console.log(`[EMAIL] sendAdminReply appelé pour ${clientEmail}`);

    const transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configuré - Réponse admin non envoyée');
        return { success: false, reason: 'SMTP non configuré' };
    }

    const safeName = escapeHtml(clientName);
    const safeSubject = escapeHtml(originalSubject);
    const safeReply = escapeHtml(replyMessage);

    const content = `
        <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #000000; font-weight: 700;">
            Bonjour ${safeName},
        </h2>

        <p style="margin: 0 0 10px 0; font-size: 14px; color: #888888;">
            En réponse à votre message : <strong>${safeSubject}</strong>
        </p>

        <div style="background-color: #FFF9E6; border-left: 4px solid #FFD700; padding: 20px; margin: 25px 0;">
            <p style="margin: 0; font-size: 15px; color: #333333; white-space: pre-wrap; line-height: 1.6;">${safeReply}</p>
        </div>

        <p style="margin: 25px 0 5px 0; font-size: 16px; color: #333333;">
            Cordialement,
        </p>

        <p style="margin: 0 0 5px 0; font-size: 16px; color: #000000; font-weight: 700;">
            L'équipe Financial Advice Genesis
        </p>
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #FFD700; font-weight: 700; font-style: italic;">
            Build. Launch. Impact.
        </p>
        <p style="margin: 0; font-size: 14px; color: #666666;">
            Contact : <a href="mailto:financialadvicegenesis@gmail.com" style="color: #FFD700; font-weight:700;">financialadvicegenesis@gmail.com</a>
        </p>
    `;

    const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER;
    const fromName = process.env.EMAIL_FROM_NAME || 'FA GENESIS';

    try {
        const result = await transport.sendMail({
            from: `"${fromName}" <${fromAddress}>`,
            to: clientEmail,
            subject: `[FA GENESIS] Re: ${originalSubject}`,
            html: getEmailTemplate(content, 'Réponse FA GENESIS'),
            replyTo: fromAddress
        });

        console.log(`[EMAIL] Réponse admin envoyée à ${clientEmail} - ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId };

    } catch (error) {
        console.error('[EMAIL] Erreur envoi reponse admin:', error.message, error.stack);
        return { success: false, error: error.message };
    }
}

// ============================================================
// NOTIFICATION NOUVEAU DOCUMENT
// ============================================================

/**
 * Envoie une notification au client quand un nouveau document est ajouté
 * @param {string} clientEmail - Email du client
 * @param {string} clientName - Prénom du client
 * @param {string} documentName - Nom du document
 * @param {number} dayNumber - Numéro du jour
 * @param {string} offerName - Nom de l'offre
 */
async function sendNewDocumentNotification(clientEmail, clientName, documentName, dayNumber, offerName) {
    const transport = initializeTransporter();
    if (!transport) {
        console.warn('[EMAIL] Transport non configuré - notification ignorée');
        return { success: false, error: 'Transport non configuré' };
    }

    const frontUrl = process.env.FRONT_URL || 'https://fagenesis.com';
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER;
    const fromName = process.env.EMAIL_FROM_NAME || 'FA GENESIS';

    const dayLabel = dayNumber ? `Jour ${dayNumber}` : '';
    const subject = dayNumber
        ? `Nouveau document disponible — Jour ${dayNumber}`
        : `Nouveau document disponible`;

    const content = `
        <h2 style="color: #000000; font-size: 22px; font-weight: 700; margin: 0 0 20px 0;">
            ${clientName ? `Bonjour ${clientName},` : 'Bonjour,'}
        </h2>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
            Un nouveau document a été ajouté à votre espace client${dayNumber ? ` pour le <strong>Jour ${dayNumber}</strong>` : ''} de votre accompagnement${offerName ? ` <strong>${offerName}</strong>` : ''}.
        </p>
        <div style="background: #f8f8f8; border-left: 4px solid #FFD700; padding: 15px 20px; margin: 20px 0;">
            <p style="margin: 0; font-weight: 700; color: #000000;">
                📄 ${documentName}
            </p>
            ${dayNumber ? `<p style="margin: 5px 0 0 0; font-size: 14px; color: #666666;">${dayLabel}</p>` : ''}
        </div>
        <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0;">
            Connectez-vous à votre espace client pour le consulter :
        </p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="${frontUrl}/livrables.html" style="display: inline-block; padding: 14px 32px; background-color: #FFD700; color: #000000; text-decoration: none; font-weight: 900; font-size: 16px; text-transform: uppercase; border: 3px solid #000000;">
                Voir mes livrables
            </a>
        </div>
    `;

    try {
        const result = await transport.sendMail({
            from: `"${fromName}" <${fromAddress}>`,
            to: clientEmail,
            subject: `[FA GENESIS] ${subject}`,
            html: getEmailTemplate(content, subject)
        });

        console.log(`[EMAIL] Notification nouveau document envoyée à ${clientEmail} - ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId };

    } catch (error) {
        console.error('[EMAIL] Erreur envoi notification document:', error.message);
        return { success: false, error: error.message };
    }
}

// ============================================================
// FONCTIONS DEVIS (QUOTES)
// ============================================================

/**
 * Notification admin : nouvelle demande de devis
 */
async function sendQuoteAdminNotification(quote) {
    try {
        if (!transporter) {
            console.log('[EMAIL] Transporteur non configure - notification devis admin ignoree');
            return { success: false, reason: 'no_transporter' };
        }

        var serviceLabels = { photo: 'Photo', video: 'Vidéo', media: 'Média', marketing: 'Marketing', other: 'Autre' };
        var serviceLabel = serviceLabels[quote.service_type] || quote.service_type || 'Non spécifié';

        var content = `
            <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 22px;">
                Nouvelle demande de devis
            </h2>
            <div style="background: #FFF8DC; border-left: 4px solid #FFD700; padding: 15px; margin-bottom: 20px;">
                <p style="margin: 0; font-weight: bold; color: #333;">Devis ${quote.quote_number}</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Type : ${serviceLabel}</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #333; width: 120px;">Client</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; color: #555;">${quote.client_name}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #333;">Email</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="mailto:${quote.client_email}" style="color: #FFD700;">${quote.client_email}</a></td>
                </tr>
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #333;">Profil</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; color: #555;">${quote.client_profil || 'Non spécifié'}</td>
                </tr>
            </table>
            <div style="background: #f9f9f9; padding: 15px; border: 1px solid #eee; margin-bottom: 20px;">
                <p style="margin: 0 0 5px 0; font-weight: bold; color: #333;">Brief du client :</p>
                <p style="margin: 0; color: #555; white-space: pre-wrap;">${quote.brief}</p>
            </div>
            ${quote.partner_email ? '<p style="color: #28a745; font-weight: bold;">Partenaire auto-assigné : ' + quote.partner_email + '</p>' : '<p style="color: #dc3545; font-weight: bold;">Aucun partenaire assigné - Assignation manuelle requise</p>'}
        `;

        var html = getEmailTemplate(content, 'Nouveau devis - FA GENESIS');
        var adminEmail = process.env.EMAIL_ADMIN_ADDRESS || 'financialadvicegenesis@gmail.com';

        if (!adminEmail) {
            return { success: false, reason: 'no_admin_email' };
        }

        var mailOptions = {
            from: '"FA GENESIS" <' + (process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER) + '>',
            to: adminEmail,
            subject: '[FA GENESIS] Nouvelle demande de devis ' + quote.quote_number,
            html: html
        };

        var result = await transporter.sendMail(mailOptions);
        console.log('[EMAIL] Notification devis admin envoyee - ' + quote.quote_number);
        return { success: true, messageId: result.messageId };

    } catch (error) {
        console.error('[EMAIL] Erreur notification devis admin:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Notification partenaire : devis assigne
 */
async function sendQuotePartnerNotification(quote, partner) {
    try {
        if (!transporter) {
            return { success: false, reason: 'no_transporter' };
        }

        var serviceLabels = { photo: 'Photo', video: 'Vidéo', media: 'Média', marketing: 'Marketing', other: 'Autre' };
        var serviceLabel = serviceLabels[quote.service_type] || quote.service_type || '';
        var frontUrl = process.env.FRONT_URL || 'https://fagenesis.com';

        var content = `
            <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 22px;">
                Nouveau devis à traiter
            </h2>
            <p style="color: #555; font-size: 16px;">
                Bonjour ${partner.prenom},
            </p>
            <p style="color: #555;">
                Un nouveau devis <strong>${serviceLabel}</strong> vous a été assigné.
            </p>
            <div style="background: #FFF8DC; border-left: 4px solid #FFD700; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-weight: bold; color: #333;">Devis ${quote.quote_number}</p>
            </div>
            <div style="background: #f9f9f9; padding: 15px; border: 1px solid #eee; margin-bottom: 20px;">
                <p style="margin: 0 0 5px 0; font-weight: bold; color: #333;">Brief :</p>
                <p style="margin: 0; color: #555; white-space: pre-wrap;">${quote.brief}</p>
            </div>
            <p style="color: #555;">
                Connectez-vous à votre espace partenaire pour soumettre votre proposition.
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${frontUrl}/partner-dashboard.html" style="display: inline-block; background: #FFD700; color: #000; padding: 14px 30px; text-decoration: none; font-weight: 900; font-size: 14px; border: 3px solid #000;">
                    ACCÉDER À MON ESPACE
                </a>
            </div>
        `;

        var html = getEmailTemplate(content, 'Devis assigné - FA GENESIS');

        var mailOptions = {
            from: '"FA GENESIS" <' + (process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER) + '>',
            to: partner.email,
            subject: '[FA GENESIS] Devis assigné - ' + quote.quote_number,
            html: html
        };

        var result = await transporter.sendMail(mailOptions);
        console.log('[EMAIL] Notification devis partenaire envoyee a ' + partner.email);
        return { success: true, messageId: result.messageId };

    } catch (error) {
        console.error('[EMAIL] Erreur notification devis partenaire:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Envoi du devis officiel au client avec bouton d'acceptation
 */
async function sendQuoteToClient(quote) {
    try {
        if (!transporter) {
            return { success: false, reason: 'no_transporter' };
        }

        if (!quote.admin_final || !quote.pricing) {
            return { success: false, reason: 'quote_not_ready' };
        }

        var frontUrl = process.env.FRONT_URL || 'https://fagenesis.com';
        var acceptUrl = frontUrl + '/login.html?quote_token=' + quote.acceptance_token;

        var serviceLabels = { photo: 'Photo', video: 'Vidéo', media: 'Média', marketing: 'Marketing', other: 'Prestation sur mesure' };
        var serviceLabel = serviceLabels[quote.service_type] || 'Prestation sur mesure';

        // Construire le tableau des prestations
        var itemsRows = '';
        var items = quote.admin_final.items || [];
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var qty = Number(item.qty) || 1;
            var unitPrice = Number(item.unit_price) || 0;
            var subtotal = qty * unitPrice;
            itemsRows += '<tr>' +
                '<td style="padding: 12px; border-bottom: 1px solid #eee; color: #000; font-weight:700;">' + (item.label || '') + '</td>' +
                '<td style="padding: 12px; border-bottom: 1px solid #eee; color: #000; text-align: center; font-weight:700;">' + qty + '</td>' +
                '<td style="padding: 12px; border-bottom: 1px solid #eee; color: #000; text-align: right; font-weight:700;">' + unitPrice.toFixed(2) + ' €</td>' +
                '<td style="padding: 12px; border-bottom: 1px solid #eee; color: #000; text-align: right; font-weight: 900;">' + subtotal.toFixed(2) + ' €</td>' +
                '</tr>';
        }

        // Date d'expiration
        var sentDate = new Date(quote.sent_at || quote.created_at);
        var expiryDate = new Date(sentDate.getTime() + (quote.validity_days * 24 * 60 * 60 * 1000));
        var expiryStr = expiryDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

        var content = `
            <h2 style="color: #000000; margin: 0 0 10px 0; font-size: 24px; font-weight: 900;">
                Votre devis personnalisé
            </h2>
            <p style="color: #333; font-size: 14px; margin: 0 0 25px 0; font-weight: 700;">
                Devis n° <strong>${quote.quote_number}</strong> | ${serviceLabel}
            </p>

            <p style="color: #000; font-size: 16px; font-weight: 700;">
                Bonjour ${quote.client_name},
            </p>
            <p style="color: #000; font-weight: 700;">
                Suite à votre demande, nous avons le plaisir de vous adresser notre proposition.
            </p>

            <!-- Tableau des prestations -->
            <table style="width: 100%; border-collapse: collapse; margin: 25px 0; border: 1px solid #ddd;">
                <thead>
                    <tr style="background: #000;">
                        <th style="padding: 12px; text-align: left; color: #FFD700; font-size: 13px;">PRESTATION</th>
                        <th style="padding: 12px; text-align: center; color: #FFD700; font-size: 13px;">QTÉ</th>
                        <th style="padding: 12px; text-align: right; color: #FFD700; font-size: 13px;">P.U.</th>
                        <th style="padding: 12px; text-align: right; color: #FFD700; font-size: 13px;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsRows}
                </tbody>
            </table>

            <!-- Totaux -->
            <table style="width: 100%; max-width: 300px; margin-left: auto; border-collapse: collapse; margin-bottom: 25px;">
                <tr>
                    <td style="padding: 8px 12px; font-weight: bold; color: #333; font-size: 16px;">TOTAL</td>
                    <td style="padding: 8px 12px; text-align: right; font-weight: 900; color: #000; font-size: 18px;">${quote.pricing.total.toFixed(2)} €</td>
                </tr>
                <tr style="background: #FFF8DC;">
                    <td style="padding: 8px 12px; font-weight: bold; color: #333;">Acompte (30%)</td>
                    <td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #333;">${quote.pricing.deposit_amount.toFixed(2)} €</td>
                </tr>
                <tr>
                    <td style="padding: 8px 12px; color: #333; font-weight: bold;">Solde (70%)</td>
                    <td style="padding: 8px 12px; text-align: right; color: #333; font-weight: bold;">${quote.pricing.balance_amount.toFixed(2)} €</td>
                </tr>
            </table>

            ${quote.admin_final.notes ? '<div style="background: #f9f9f9; padding: 15px; border: 1px solid #eee; margin-bottom: 25px;"><p style="margin: 0 0 5px 0; font-weight: bold; color: #333; font-size: 13px;">CONDITIONS :</p><p style="margin: 0; color: #555; font-size: 14px;">' + quote.admin_final.notes + '</p></div>' : ''}

            <div style="background: #FFF3CD; border: 1px solid #FFD700; padding: 12px; margin-bottom: 25px; text-align: center;">
                <p style="margin: 0; font-size: 13px; color: #856404;">
                    Ce devis est valable jusqu'au <strong>${expiryStr}</strong>
                </p>
            </div>

            <!-- Bouton d'acceptation -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="${acceptUrl}" style="display: inline-block; background: #FFD700; color: #000; padding: 18px 40px; text-decoration: none; font-weight: 900; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; border: 4px solid #000;">
                    ACCEPTER LE DEVIS
                </a>
            </div>

            <p style="color: #333; font-size: 13px; text-align: center; font-weight: 700;">
                En cliquant sur le bouton, vous serez invité à créer votre compte ou vous connecter.<br>
                Un acompte de ${quote.pricing.deposit_amount.toFixed(2)} € (30%) sera ensuite requis pour démarrer la prestation.<br>
                Le solde de ${quote.pricing.balance_amount.toFixed(2)} € (70%) sera dû à la livraison.
            </p>
        `;

        var html = getEmailTemplate(content, 'Devis ' + quote.quote_number + ' - FA GENESIS');

        var mailOptions = {
            from: '"FA GENESIS" <' + (process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER) + '>',
            to: quote.client_email,
            subject: '[FA GENESIS] Votre devis personnalisé ' + quote.quote_number,
            html: html
        };

        var result = await transporter.sendMail(mailOptions);
        console.log('[EMAIL] Devis ' + quote.quote_number + ' envoye a ' + quote.client_email);
        return { success: true, messageId: result.messageId };

    } catch (error) {
        console.error('[EMAIL] Erreur envoi devis client:', error.message);
        return { success: false, error: error.message };
    }
}

// ============================================================
// EMAILS - SESSIONS / SEANCES
// ============================================================

/**
 * Email envoye au client quand une seance est CONFIRMED
 */
async function sendSessionConfirmedEmail(clientEmail, clientName, sessionData) {
    var transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configure - Email session non envoye');
        return { success: false, reason: 'SMTP non configure' };
    }

    var dateStr = 'Date à confirmer';
    if (sessionData.datetime_start) {
        var d = new Date(sessionData.datetime_start);
        dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
            + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    var meetSection = '';
    if (sessionData.meet_url) {
        meetSection = '<div style="text-align:center;margin:25px 0;">'
            + '<a href="' + escapeHtml(sessionData.meet_url) + '" target="_blank" '
            + 'style="display:inline-block;background:#000;color:#fff;padding:16px 32px;font-weight:700;'
            + 'text-transform:uppercase;text-decoration:none;font-size:14px;border:3px solid #000;">'
            + 'Rejoindre le Google Meet</a></div>';
    }

    var locationStr = sessionData.location ? escapeHtml(sessionData.location) : 'À distance';

    var content = '<h2 style="margin:0 0 20px 0;font-size:24px;color:#000;font-weight:700;">'
        + 'Séance confirmée, ' + escapeHtml(clientName) + ' !</h2>'
        + '<p style="margin:0 0 20px 0;font-size:16px;color:#333;line-height:1.6;">'
        + 'Votre séance a été confirmée. Voici les détails :</p>'
        + '<div style="background:#f5f5f5;padding:20px;border-radius:4px;margin:25px 0;">'
        + '<table style="width:100%;border-collapse:collapse;">'
        + '<tr><td style="padding:8px 0;font-weight:700;color:#666;">Date & Heure</td>'
        + '<td style="padding:8px 0;color:#000;text-align:right;">' + escapeHtml(dateStr) + '</td></tr>'
        + '<tr><td style="padding:8px 0;font-weight:700;color:#666;">Durée</td>'
        + '<td style="padding:8px 0;color:#000;text-align:right;">' + (sessionData.duration_minutes || 45) + ' min</td></tr>'
        + '<tr><td style="padding:8px 0;font-weight:700;color:#666;">Lieu</td>'
        + '<td style="padding:8px 0;color:#000;text-align:right;">' + locationStr + '</td></tr>'
        + (sessionData.partner_name ? '<tr><td style="padding:8px 0;font-weight:700;color:#666;">Partenaire</td>'
        + '<td style="padding:8px 0;color:#000;text-align:right;">' + escapeHtml(sessionData.partner_name) + '</td></tr>' : '')
        + '</table></div>'
        + meetSection
        + '<p style="margin:30px 0 0 0;font-size:16px;color:#333;">Merci pour votre confiance,<br>'
        + '<strong style="color:#000;">L\'équipe FA GENESIS</strong></p>';

    try {
        var result = await transport.sendMail({
            from: '"' + process.env.EMAIL_FROM_NAME + '" <' + process.env.EMAIL_FROM_ADDRESS + '>',
            to: clientEmail,
            subject: '[FA GENESIS] Séance confirmée - ' + escapeHtml(dateStr),
            html: getEmailTemplate(content, 'Séance confirmée')
        });
        console.log('[EMAIL] Confirmation seance envoyee a ' + clientEmail);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('[EMAIL] Erreur envoi confirmation seance:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Email envoye au client quand un nouveau creneau est propose (apres reprogrammation)
 */
async function sendSessionRescheduledEmail(clientEmail, clientName, sessionData) {
    var transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configure - Email reprogrammation non envoye');
        return { success: false, reason: 'SMTP non configure' };
    }

    var dateStr = 'Date à confirmer';
    if (sessionData.datetime_start) {
        var d = new Date(sessionData.datetime_start);
        dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
            + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    var content = '<h2 style="margin:0 0 20px 0;font-size:24px;color:#000;font-weight:700;">'
        + 'Nouveau créneau proposé, ' + escapeHtml(clientName) + '</h2>'
        + '<p style="margin:0 0 20px 0;font-size:16px;color:#333;line-height:1.6;">'
        + 'Un nouveau créneau a été proposé pour votre séance. Connectez-vous à votre espace client pour accepter ou demander un autre créneau.</p>'
        + '<div style="background:#FFF9E6;border-left:4px solid #FFD700;padding:20px;margin:25px 0;">'
        + '<p style="margin:0 0 10px 0;font-weight:700;color:#000;">Nouveau créneau proposé :</p>'
        + '<p style="margin:0;font-size:18px;color:#000;font-weight:700;">' + escapeHtml(dateStr) + '</p>'
        + '<p style="margin:5px 0 0 0;color:#666;">Durée : ' + (sessionData.duration_minutes || 45) + ' min</p>'
        + '</div>'
        + '<div style="text-align:center;margin:25px 0;">'
        + '<a href="https://fagenesis.com/seances.html" target="_blank" '
        + 'style="display:inline-block;background:#FFD700;color:#000;padding:16px 32px;font-weight:700;'
        + 'text-transform:uppercase;text-decoration:none;font-size:14px;border:3px solid #000;">'
        + 'Voir mes séances</a></div>'
        + '<p style="margin:30px 0 0 0;font-size:16px;color:#333;">Merci pour votre confiance,<br>'
        + '<strong style="color:#000;">L\'équipe FA GENESIS</strong></p>';

    try {
        var result = await transport.sendMail({
            from: '"' + process.env.EMAIL_FROM_NAME + '" <' + process.env.EMAIL_FROM_ADDRESS + '>',
            to: clientEmail,
            subject: '[FA GENESIS] Nouveau créneau proposé pour votre séance',
            html: getEmailTemplate(content, 'Nouveau créneau')
        });
        console.log('[EMAIL] Email reprogrammation envoye a ' + clientEmail);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('[EMAIL] Erreur envoi email reprogrammation:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Email envoye a l'admin (et au partenaire si assigne) quand un client demande une seance
 */
async function sendSessionRequestedEmail(adminEmail, clientName, sessionData) {
    var transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configure - Email session requested non envoye');
        return { success: false, reason: 'SMTP non configure' };
    }

    var typeLabels = { call: 'Appel / Visio', shooting: 'Shooting photo/vidéo', meeting: 'Réunion / Consultation' };
    var typeLabel = typeLabels[sessionData.session_type] || sessionData.session_type || 'Non précisé';

    var slotsHtml = '';
    if (sessionData.proposed_slots && sessionData.proposed_slots.length > 0) {
        slotsHtml = '<p style="margin:10px 0 5px 0;font-weight:700;color:#333;">Créneaux proposés :</p><ul style="margin:0;padding-left:20px;">';
        for (var i = 0; i < sessionData.proposed_slots.length; i++) {
            var d = new Date(sessionData.proposed_slots[i]);
            var slotStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
                + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            slotsHtml += '<li style="color:#555;">' + escapeHtml(slotStr) + '</li>';
        }
        slotsHtml += '</ul>';
    }

    var providerLabel = '';
    if (sessionData.requested_provider_role) {
        var roleLabels = { admin: 'Consultant FA GENESIS', photographer: 'Photographe', videographer: 'Vidéaste', marketer: 'Consultant Marketing', media: 'Spécialiste Média' };
        providerLabel = roleLabels[sessionData.requested_provider_role] || sessionData.requested_provider_role;
    }

    var content = '<h2 style="margin:0 0 20px 0;font-size:24px;color:#000;font-weight:700;">'
        + 'Nouvelle demande de séance</h2>'
        + '<p style="margin:0 0 20px 0;font-size:16px;color:#333;line-height:1.6;">'
        + '<strong>' + escapeHtml(clientName) + '</strong> a demandé une nouvelle séance.</p>'
        + '<div style="background:#f5f5f5;padding:20px;border-radius:4px;margin:25px 0;">'
        + '<table style="width:100%;border-collapse:collapse;">'
        + '<tr><td style="padding:8px 0;font-weight:700;color:#666;">Type</td>'
        + '<td style="padding:8px 0;color:#000;text-align:right;">' + escapeHtml(typeLabel) + '</td></tr>'
        + (providerLabel ? '<tr><td style="padding:8px 0;font-weight:700;color:#666;">Intervenant souhaité</td>'
        + '<td style="padding:8px 0;color:#000;text-align:right;">' + escapeHtml(providerLabel) + '</td></tr>' : '')
        + '<tr><td style="padding:8px 0;font-weight:700;color:#666;">Séance ID</td>'
        + '<td style="padding:8px 0;color:#000;text-align:right;">' + escapeHtml(sessionData.id || '') + '</td></tr>'
        + '</table></div>'
        + (sessionData.notes_client ? '<div style="background:#FFF9E6;border-left:4px solid #FFD700;padding:15px 20px;margin:20px 0;">'
        + '<p style="margin:0 0 5px 0;font-weight:700;color:#000;">Message du client :</p>'
        + '<p style="margin:0;color:#555;">' + escapeHtml(sessionData.notes_client) + '</p></div>' : '')
        + slotsHtml
        + '<p style="margin:30px 0 0 0;font-size:14px;color:#666;">Connectez-vous à l\'interface admin pour gérer cette demande.</p>';

    try {
        var recipients = [adminEmail];
        // Envoyer aussi au partenaire si assigne
        if (sessionData.partner_id) {
            // Le partenaire sera notifie separement si besoin
        }

        var result = await transport.sendMail({
            from: '"' + (process.env.EMAIL_FROM_NAME || 'FA GENESIS') + '" <' + (process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER) + '>',
            to: adminEmail,
            subject: '[FA GENESIS] Nouvelle demande de séance de ' + escapeHtml(clientName),
            html: getEmailTemplate(content, 'Nouvelle demande de séance')
        });
        console.log('[EMAIL] Notification demande seance envoyee a ' + adminEmail);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('[EMAIL] Erreur envoi notification demande seance:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Email envoye au client quand un partenaire propose un creneau (PROPOSED)
 */
async function sendSessionProposedEmail(clientEmail, clientName, sessionData) {
    var transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configure - Email session proposed non envoye');
        return { success: false, reason: 'SMTP non configure' };
    }

    var dateStr = 'Date a confirmer';
    if (sessionData.datetime_start) {
        var d = new Date(sessionData.datetime_start);
        dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
            + ' a ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    var frontUrl = process.env.FRONT_URL || 'https://fagenesis.com';

    var content = '<h2 style="margin:0 0 20px 0;font-size:24px;color:#000;font-weight:700;">'
        + 'Un créneau vous a été proposé, ' + escapeHtml(clientName) + '</h2>'
        + '<p style="margin:0 0 20px 0;font-size:16px;color:#333;line-height:1.6;">'
        + 'Un intervenant vous a proposé un créneau pour votre séance. Connectez-vous pour accepter ou demander un autre créneau.</p>'
        + '<div style="background:#FFF9E6;border-left:4px solid #FFD700;padding:20px;margin:25px 0;">'
        + '<p style="margin:0 0 10px 0;font-weight:700;color:#000;">Créneau proposé :</p>'
        + '<p style="margin:0;font-size:18px;color:#000;font-weight:700;">' + escapeHtml(dateStr) + '</p>'
        + '<p style="margin:5px 0 0 0;color:#666;">Durée : ' + (sessionData.duration_minutes || 45) + ' min</p>'
        + (sessionData.partner_name ? '<p style="margin:5px 0 0 0;color:#666;">Avec : ' + escapeHtml(sessionData.partner_name) + '</p>' : '')
        + '</div>'
        + '<div style="text-align:center;margin:25px 0;">'
        + '<a href="' + frontUrl + '/seances.html" target="_blank" '
        + 'style="display:inline-block;background:#FFD700;color:#000;padding:16px 32px;font-weight:700;'
        + 'text-transform:uppercase;text-decoration:none;font-size:14px;border:3px solid #000;">'
        + 'Voir mes séances</a></div>'
        + '<p style="margin:30px 0 0 0;font-size:16px;color:#333;">Merci pour votre confiance,<br>'
        + '<strong style="color:#000;">L\'équipe FA GENESIS</strong></p>';

    try {
        var result = await transport.sendMail({
            from: '"' + (process.env.EMAIL_FROM_NAME || 'FA GENESIS') + '" <' + (process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER) + '>',
            to: clientEmail,
            subject: '[FA GENESIS] Un créneau vous a été proposé pour votre séance',
            html: getEmailTemplate(content, 'Créneau proposé')
        });
        console.log('[EMAIL] Email creneau propose envoye a ' + clientEmail);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('[EMAIL] Erreur envoi email creneau propose:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Email envoye au client quand une seance est terminee (COMPLETED)
 */
async function sendSessionCompletedEmail(clientEmail, clientName, sessionData) {
    var transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configure - Email session completed non envoye');
        return { success: false, reason: 'SMTP non configure' };
    }

    var frontUrl = process.env.FRONT_URL || 'https://fagenesis.com';

    var dateStr = '';
    if (sessionData.datetime_start) {
        var d = new Date(sessionData.datetime_start);
        dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    }

    var content = '<h2 style="margin:0 0 20px 0;font-size:24px;color:#000;font-weight:700;">'
        + 'Séance terminée, ' + escapeHtml(clientName) + ' !</h2>'
        + '<p style="margin:0 0 20px 0;font-size:16px;color:#333;line-height:1.6;">'
        + 'Votre séance' + (dateStr ? ' du ' + escapeHtml(dateStr) : '') + ' est maintenant terminée.</p>'
        + '<div style="background:#e8f5e9;border-left:4px solid #4caf50;padding:20px;margin:25px 0;">'
        + '<p style="margin:0;font-size:15px;color:#2e7d32;">'
        + '<strong>Vos livrables seront bientôt disponibles</strong> dans votre espace client.</p></div>'
        + '<div style="text-align:center;margin:25px 0;">'
        + '<a href="' + frontUrl + '/livrables.html" target="_blank" '
        + 'style="display:inline-block;background:#FFD700;color:#000;padding:16px 32px;font-weight:700;'
        + 'text-transform:uppercase;text-decoration:none;font-size:14px;border:3px solid #000;">'
        + 'Voir mes livrables</a></div>'
        + '<p style="margin:30px 0 0 0;font-size:16px;color:#333;">Merci pour votre confiance,<br>'
        + '<strong style="color:#000;">L\'équipe FA GENESIS</strong></p>';

    try {
        var result = await transport.sendMail({
            from: '"' + (process.env.EMAIL_FROM_NAME || 'FA GENESIS') + '" <' + (process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER) + '>',
            to: clientEmail,
            subject: '[FA GENESIS] Votre séance est terminée',
            html: getEmailTemplate(content, 'Séance terminée')
        });
        console.log('[EMAIL] Email seance terminee envoye a ' + clientEmail);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('[EMAIL] Erreur envoi email seance terminee:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Envoyer un email de bienvenue a l'inscription (avant paiement)
 * Invite le client a decouvrir les offres et tarifs
 *
 * @param {string} clientEmail
 * @param {string} prenom
 */
async function sendWelcomeEmail(clientEmail, prenom) {
    const transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configure - Email bienvenue non envoye');
        return { success: false, reason: 'SMTP non configure' };
    }

    const frontUrl = process.env.FRONT_URL || 'https://fagenesis.com';

    const content = `
        <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #000000; font-weight: 700;">
            Bienvenue ${prenom} !
        </h2>

        <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333; line-height: 1.6;">
            Nous sommes ravis de vous accueillir chez <strong>FA GENESIS</strong>. Votre compte a bien été créé avec succès.
        </p>

        <div style="background-color: #FFF9E6; border-left: 4px solid #FFD700; padding: 20px; margin: 25px 0;">
            <p style="margin: 0 0 15px 0; font-weight: 700; color: #000; font-size: 16px;">
                Pour démarrer votre accompagnement :
            </p>
            <ol style="margin: 0; padding-left: 20px; color: #333; line-height: 2;">
                <li><strong>Découvrez nos prestations</strong> - Consultez notre catalogue d'offres et tarifs</li>
                <li><strong>Ajoutez au panier</strong> - Sélectionnez les prestations adaptées à vos besoins</li>
                <li><strong>Lancez votre projet</strong> - Finalisez votre commande et commencez l'aventure</li>
            </ol>
        </div>

        <div style="background-color: #000000; color: #ffffff; padding: 20px; border-radius: 4px; margin: 25px 0; text-align: center;">
            <p style="margin: 0 0 15px 0; font-size: 14px; color: #cccccc;">
                Découvrez nos offres et tarifs
            </p>
            <a href="${frontUrl}/offres.html"
               style="display: inline-block; background-color: #FFD700; color: #000; padding: 15px 30px; text-decoration: none; font-weight: 700; border-radius: 4px; font-size: 16px;">
                Voir nos prestations
            </a>
        </div>

        <p style="margin: 25px 0 15px 0; font-size: 16px; color: #333333; line-height: 1.6;">
            <strong>Une question ?</strong> Notre équipe est à votre disposition pour vous accompagner. N'hésitez pas à nous contacter par email ou via le formulaire de contact.
        </p>

        <p style="margin: 30px 0 0 0; font-size: 16px; color: #333333;">
            À très bientôt,<br>
            <strong style="color: #000000;">L'équipe FA GENESIS</strong>
        </p>
    `;

    try {
        const result = await transport.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
            to: clientEmail,
            subject: `[FA GENESIS] Bienvenue ${prenom} ! Découvrez nos offres et tarifs`,
            html: getEmailTemplate(content, 'Bienvenue chez FA GENESIS')
        });

        console.log(`[EMAIL] Email bienvenue envoye a ${clientEmail} - ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId };

    } catch (error) {
        console.error('[EMAIL] Erreur envoi email bienvenue:', error.message);
        return { success: false, error: error.message };
    }
}

// ============================================================
// EXPORTS
// ============================================================

// ============================================================
// EMAILS - PLANIFICATION DE DATE DE DEMARRAGE
// ============================================================

/**
 * Notification a l'admin (ou partenaire) quand un client propose une date de demarrage
 */
async function sendScheduleProposedNotification(recipientEmail, clientName, proposedDate, orderName) {
    var transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configure - Notification planning non envoyee');
        return { success: false, reason: 'SMTP non configure' };
    }

    var dateStr = proposedDate;
    try {
        var d = new Date(proposedDate + 'T00:00:00');
        dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    } catch (e) {}

    var frontUrl = process.env.FRONT_URL || 'https://fagenesis.com';

    var content = '<h2 style="margin:0 0 20px 0;font-size:24px;color:#000;font-weight:700;">'
        + 'Nouvelle demande de date</h2>'
        + '<p style="margin:0 0 20px 0;font-size:16px;color:#333;line-height:1.6;">'
        + '<strong>' + escapeHtml(clientName) + '</strong> a proposé une date de démarrage pour sa commande.'
        + '</p>'
        + '<div style="background:#FFF9E6;border-left:4px solid #FFD700;padding:20px;margin:25px 0;">'
        + '<table style="width:100%;border-collapse:collapse;">'
        + '<tr><td style="padding:8px 0;font-weight:700;color:#666;">Client</td>'
        + '<td style="padding:8px 0;color:#000;text-align:right;">' + escapeHtml(clientName) + '</td></tr>'
        + '<tr><td style="padding:8px 0;font-weight:700;color:#666;">Offre</td>'
        + '<td style="padding:8px 0;color:#000;text-align:right;">' + escapeHtml(orderName || '') + '</td></tr>'
        + '<tr><td style="padding:8px 0;font-weight:700;color:#666;">Date proposée</td>'
        + '<td style="padding:8px 0;color:#000;font-weight:900;text-align:right;">' + escapeHtml(dateStr) + '</td></tr>'
        + '</table></div>'
        + '<p style="margin:0 0 20px 0;font-size:15px;color:#333;">Connectez-vous à votre espace pour confirmer cette date ou en proposer une autre.</p>'
        + '<p style="margin:30px 0 0 0;font-size:16px;color:#333;">Cordialement,<br>'
        + '<strong style="color:#000;">FA GENESIS</strong></p>';

    try {
        var result = await transport.sendMail({
            from: '"' + (process.env.EMAIL_FROM_NAME || 'FA GENESIS') + '" <' + (process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER) + '>',
            to: recipientEmail,
            subject: '[FA GENESIS] Nouvelle demande de date - ' + escapeHtml(clientName),
            html: getEmailTemplate(content, 'Nouvelle demande de date')
        });
        console.log('[EMAIL] Notification planning envoyee a ' + recipientEmail);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('[EMAIL] Erreur notification planning:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Email au client quand sa date de demarrage est confirmee par l'equipe
 */
async function sendScheduleConfirmedToClient(clientEmail, clientName, confirmedDate, orderName) {
    var transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configure - Confirmation date non envoyee');
        return { success: false, reason: 'SMTP non configure' };
    }

    var dateStr = confirmedDate;
    try {
        var d = new Date(confirmedDate + 'T00:00:00');
        dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    } catch (e) {}

    var frontUrl = process.env.FRONT_URL || 'https://fagenesis.com';

    var content = '<h2 style="margin:0 0 20px 0;font-size:24px;color:#000;font-weight:700;">'
        + 'Votre date de démarrage est confirmée !</h2>'
        + '<p style="margin:0 0 20px 0;font-size:16px;color:#333;line-height:1.6;">'
        + 'Bonjour ' + escapeHtml(clientName) + ',<br><br>'
        + 'Votre date de démarrage a été confirmée par l\'équipe FA GENESIS. Votre parcours commence bientôt !'
        + '</p>'
        + '<div style="background:#e8f5e9;border-left:4px solid #4CAF50;padding:20px;margin:25px 0;">'
        + '<table style="width:100%;border-collapse:collapse;">'
        + '<tr><td style="padding:8px 0;font-weight:700;color:#666;">Offre</td>'
        + '<td style="padding:8px 0;color:#000;text-align:right;">' + escapeHtml(orderName || '') + '</td></tr>'
        + '<tr><td style="padding:8px 0;font-weight:700;color:#666;">Date confirmée</td>'
        + '<td style="padding:8px 0;color:#000;font-weight:900;text-align:right;">' + escapeHtml(dateStr) + '</td></tr>'
        + '</table></div>'
        + '<div style="text-align:center;margin:25px 0;">'
        + '<a href="' + frontUrl + '/dashboard.html" target="_blank" '
        + 'style="display:inline-block;background:#FFD700;color:#000;padding:16px 32px;font-weight:700;'
        + 'text-transform:uppercase;text-decoration:none;font-size:14px;border:3px solid #000;">'
        + 'Voir mon espace client</a></div>'
        + '<p style="margin:30px 0 0 0;font-size:16px;color:#333;">Merci pour votre confiance,<br>'
        + '<strong style="color:#000;">L\'equipe FA GENESIS</strong></p>';

    try {
        var result = await transport.sendMail({
            from: '"' + (process.env.EMAIL_FROM_NAME || 'FA GENESIS') + '" <' + (process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER) + '>',
            to: clientEmail,
            subject: '[FA GENESIS] Votre date de démarrage est confirmée !',
            html: getEmailTemplate(content, 'Date confirmée')
        });
        console.log('[EMAIL] Confirmation date envoyee a ' + clientEmail);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('[EMAIL] Erreur confirmation date client:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Email au client quand l'admin ou le partenaire contre-propose une date
 */
async function sendScheduleReproposedToClient(clientEmail, clientName, reproposedDate, message, orderName) {
    var transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configure - Contre-proposition date non envoyee');
        return { success: false, reason: 'SMTP non configure' };
    }

    var dateStr = reproposedDate;
    try {
        var d = new Date(reproposedDate + 'T00:00:00');
        dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    } catch (e) {}

    var frontUrl = process.env.FRONT_URL || 'https://fagenesis.com';

    var messageSection = '';
    if (message) {
        messageSection = '<div style="background:#f9f9f9;border-left:4px solid #ccc;padding:15px 20px;margin:20px 0;">'
            + '<p style="margin:0 0 5px 0;font-weight:700;color:#333;">Message de l\'equipe :</p>'
            + '<p style="margin:0;color:#555;">' + escapeHtml(message) + '</p></div>';
    }

    var content = '<h2 style="margin:0 0 20px 0;font-size:24px;color:#000;font-weight:700;">'
        + 'Une nouvelle date vous est proposée</h2>'
        + '<p style="margin:0 0 20px 0;font-size:16px;color:#333;line-height:1.6;">'
        + 'Bonjour ' + escapeHtml(clientName) + ',<br><br>'
        + 'L\'équipe FA GENESIS vous propose une autre date de démarrage pour votre commande '
        + '"' + escapeHtml(orderName || '') + '".'
        + '</p>'
        + '<div style="background:#FFF9E6;border-left:4px solid #FFD700;padding:20px;margin:25px 0;">'
        + '<p style="margin:0 0 10px 0;font-weight:700;color:#000;">Nouvelle date proposee :</p>'
        + '<p style="margin:0;font-size:20px;color:#000;font-weight:900;">' + escapeHtml(dateStr) + '</p>'
        + '</div>'
        + messageSection
        + '<p style="margin:0 0 20px 0;font-size:15px;color:#333;">Connectez-vous a votre espace client pour accepter cette date ou en demander une autre.</p>'
        + '<div style="text-align:center;margin:25px 0;">'
        + '<a href="' + frontUrl + '/dashboard.html" target="_blank" '
        + 'style="display:inline-block;background:#FFD700;color:#000;padding:16px 32px;font-weight:700;'
        + 'text-transform:uppercase;text-decoration:none;font-size:14px;border:3px solid #000;">'
        + 'Voir mon espace client</a></div>'
        + '<p style="margin:30px 0 0 0;font-size:16px;color:#333;">Merci pour votre confiance,<br>'
        + '<strong style="color:#000;">L\'equipe FA GENESIS</strong></p>';

    try {
        var result = await transport.sendMail({
            from: '"' + (process.env.EMAIL_FROM_NAME || 'FA GENESIS') + '" <' + (process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER) + '>',
            to: clientEmail,
            subject: '[FA GENESIS] Une nouvelle date de démarrage vous est proposée',
            html: getEmailTemplate(content, 'Nouvelle date proposée')
        });
        console.log('[EMAIL] Contre-proposition date envoyee a ' + clientEmail);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('[EMAIL] Erreur contre-proposition date client:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Notification a l'admin ou au partenaire quand un client annule sa date
 * Ou notification au client quand l'admin/partenaire annule
 */
async function sendScheduleCancelledNotification(recipientEmail, recipientName, clientName, cancelledDate, orderName, cancelledBy) {
    var transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configure - Notification annulation date non envoyee');
        return { success: false, reason: 'SMTP non configure' };
    }

    var dateStr = cancelledDate || 'Non renseignee';
    if (cancelledDate) {
        try {
            var d = new Date(cancelledDate + 'T00:00:00');
            dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        } catch (e) {}
    }

    var frontUrl = process.env.FRONT_URL || 'https://fagenesis.com';
    var isClientCancelling = (cancelledBy === 'client');

    var title, intro, cta, ctaUrl;
    if (isClientCancelling) {
        title = 'Annulation de date - ' + escapeHtml(clientName);
        intro = '<strong>' + escapeHtml(clientName) + '</strong> a annulé sa date de démarrage pour la commande '
            + '"' + escapeHtml(orderName || '') + '".'
            + ' Le client va proposer une nouvelle date.';
        cta = 'Voir l\'espace admin';
        ctaUrl = frontUrl + '/admin.html';
    } else {
        title = 'Votre date de demarrage a ete annulee';
        intro = 'Bonjour ' + escapeHtml(clientName) + ',<br><br>'
            + 'Votre date de démarrage pour la commande "'
            + escapeHtml(orderName || '') + '" a été annulée par l\'équipe.'
            + ' Vous pouvez proposer une nouvelle date depuis votre espace client.';
        cta = 'Proposer une nouvelle date';
        ctaUrl = frontUrl + '/dashboard.html';
    }

    var content = '<h2 style="margin:0 0 20px 0;font-size:24px;color:#000;font-weight:700;">'
        + escapeHtml(title) + '</h2>'
        + '<p style="margin:0 0 20px 0;font-size:16px;color:#333;line-height:1.6;">'
        + intro + '</p>'
        + '<div style="background:#FFF0F0;border-left:4px solid #e53e3e;padding:20px;margin:25px 0;">'
        + '<table style="width:100%;border-collapse:collapse;">'
        + '<tr><td style="padding:8px 0;font-weight:700;color:#666;">Client</td>'
        + '<td style="padding:8px 0;color:#000;text-align:right;">' + escapeHtml(clientName) + '</td></tr>'
        + '<tr><td style="padding:8px 0;font-weight:700;color:#666;">Offre</td>'
        + '<td style="padding:8px 0;color:#000;text-align:right;">' + escapeHtml(orderName || '') + '</td></tr>'
        + '<tr><td style="padding:8px 0;font-weight:700;color:#666;">Date annulée</td>'
        + '<td style="padding:8px 0;color:#e53e3e;font-weight:900;text-align:right;">' + escapeHtml(dateStr) + '</td></tr>'
        + '</table></div>'
        + '<div style="text-align:center;margin:25px 0;">'
        + '<a href="' + ctaUrl + '" target="_blank" '
        + 'style="display:inline-block;background:#FFD700;color:#000;padding:16px 32px;font-weight:700;'
        + 'text-transform:uppercase;text-decoration:none;font-size:14px;border:3px solid #000;">'
        + escapeHtml(cta) + '</a></div>'
        + '<p style="margin:30px 0 0 0;font-size:16px;color:#333;">Cordialement,<br>'
        + '<strong style="color:#000;">FA GENESIS</strong></p>';

    var subjectSuffix = isClientCancelling ? (clientName + ' - ' + escapeHtml(orderName || '')) : 'Commande ' + escapeHtml(orderName || '');

    try {
        var result = await transport.sendMail({
            from: '"' + (process.env.EMAIL_FROM_NAME || 'FA GENESIS') + '" <' + (process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER) + '>',
            to: recipientEmail,
            subject: '[FA GENESIS] Annulation de date - ' + subjectSuffix,
            html: getEmailTemplate(content, 'Annulation de date de démarrage')
        });
        console.log('[EMAIL] Notification annulation date envoyee a ' + recipientEmail);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('[EMAIL] Erreur notification annulation date:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Notification annulation de devis par le client
 * Envoie à l'admin et au partenaire si assigné
 */
async function sendQuoteCancelledNotification(quote, cancelledBy) {
    try {
        if (!transporter) {
            console.log('[EMAIL] Transporteur non configure - notification annulation devis ignoree');
            return { success: false, reason: 'no_transporter' };
        }

        var cancellerLabel = cancelledBy === 'client' ? 'Le client' : 'L\'équipe FA GENESIS';
        var content = '<h2 style="color: #333333; margin: 0 0 20px 0; font-size: 22px;">Devis annulé</h2>' +
            '<div style="background: #fff3f3; border-left: 4px solid #f44336; padding: 15px; margin-bottom: 20px;">' +
            '<p style="margin: 0; font-weight: bold; color: #333;">Devis ' + (quote.quote_number || '') + '</p>' +
            '<p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">' + cancellerLabel + ' a annulé ce devis.</p>' +
            '</div>' +
            '<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">' +
            '<tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #333; width: 120px;">Client</td>' +
            '<td style="padding: 10px; border-bottom: 1px solid #eee; color: #555;">' + (quote.client_name || '') + '</td></tr>' +
            '<tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #333;">Email</td>' +
            '<td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="mailto:' + (quote.client_email || '') + '" style="color: #FFD700;">' + (quote.client_email || '') + '</a></td></tr>' +
            '</table>' +
            '<p style="color: #555; font-size: 14px;">Rendez-vous dans l\'espace administration pour plus de détails.</p>';

        var html = getEmailTemplate(content, 'Devis annulé - FA GENESIS');
        var adminEmail = process.env.EMAIL_ADMIN_ADDRESS || 'financialadvicegenesis@gmail.com';

        var results = [];

        // Notification admin
        var mailAdmin = {
            from: '"FA GENESIS" <' + (process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER) + '>',
            to: adminEmail,
            subject: '[FA GENESIS] Devis annulé - ' + (quote.quote_number || ''),
            html: html
        };
        try {
            var r = await transporter.sendMail(mailAdmin);
            results.push({ to: adminEmail, success: true, messageId: r.messageId });
            console.log('[EMAIL] Notification annulation devis envoyee a admin');
        } catch (e) {
            results.push({ to: adminEmail, success: false, error: e.message });
        }

        // Notification partenaire si assigné
        if (quote.partner_email) {
            var mailPartner = {
                from: '"FA GENESIS" <' + (process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER) + '>',
                to: quote.partner_email,
                subject: '[FA GENESIS] Devis annulé - ' + (quote.quote_number || ''),
                html: html
            };
            try {
                var rp = await transporter.sendMail(mailPartner);
                results.push({ to: quote.partner_email, success: true, messageId: rp.messageId });
                console.log('[EMAIL] Notification annulation devis envoyee au partenaire ' + quote.partner_email);
            } catch (e) {
                results.push({ to: quote.partner_email, success: false, error: e.message });
            }
        }

        return { success: true, results: results };

    } catch (error) {
        console.error('[EMAIL] Erreur notification annulation devis:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Email au client : fin d'accompagnement déclarée (par admin ou partenaire)
 * @param {string} clientEmail
 * @param {string} clientName
 * @param {string} declaredBy  - 'admin' | nom du partenaire
 * @param {string} orderName   - nom de l'offre/tarif
 * @param {number} balanceAmount - montant du solde restant (EUR)
 */
async function sendAccompanimentEndNotification(clientEmail, clientName, declaredBy, orderName, balanceAmount) {
    var transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configure - Fin accompagnement non envoyee');
        return { success: false, reason: 'SMTP non configure' };
    }

    var frontUrl = process.env.FRONT_URL || 'https://fagenesis.com';
    var declarantLabel = (declaredBy && declaredBy !== 'admin')
        ? 'votre conseiller <strong>' + escapeHtml(declaredBy) + '</strong>'
        : 'l\'équipe FA GENESIS';

    var balanceLine = '';
    if (balanceAmount && balanceAmount > 0) {
        balanceLine = '<div style="background:#fff3cd;border-left:4px solid #ff922b;padding:20px;margin:25px 0;">'
            + '<p style="margin:0;font-size:15px;font-weight:700;color:#000;">'
            + 'Solde restant à régler : <span style="font-size:22px;font-weight:900;">' + balanceAmount + ' €</span>'
            + '</p>'
            + '<p style="margin:8px 0 0 0;font-size:13px;color:#555;">'
            + 'Payez le solde pour débloquer immédiatement vos livrables finaux.'
            + '</p></div>';
    }

    var content = '<h2 style="margin:0 0 20px 0;font-size:24px;color:#000;font-weight:900;">'
        + '🎉 Votre accompagnement est terminé !</h2>'
        + '<p style="margin:0 0 20px 0;font-size:16px;color:#333;line-height:1.6;">'
        + 'Bonjour ' + escapeHtml(clientName) + ',<br><br>'
        + 'Félicitations ! ' + declarantLabel + ' vient de déclarer la fin de votre accompagnement '
        + '<strong style="color:#000;">' + escapeHtml(orderName || '') + '</strong>.<br><br>'
        + 'Nous espérons que cet accompagnement vous a apporté les résultats attendus et que vous avez apprécié cette expérience avec FA GENESIS.'
        + '</p>'
        + balanceLine
        + '<div style="background:#f8f8f8;border:2px solid #000;padding:20px;margin:25px 0;">'
        + '<p style="margin:0 0 10px 0;font-weight:900;font-size:15px;color:#000;">Vos prochaines étapes :</p>'
        + '<ul style="margin:0;padding-left:20px;font-size:14px;color:#333;line-height:2;">'
        + (balanceAmount > 0 ? '<li>Payer le solde de <strong>' + balanceAmount + ' €</strong> pour accéder à vos livrables finaux</li>' : '')
        + '<li>Télécharger tous vos livrables depuis votre espace client</li>'
        + '<li>Nous laisser un retour sur votre expérience</li>'
        + '</ul></div>'
        + '<div style="text-align:center;margin:30px 0;">'
        + '<a href="' + frontUrl + '/payment.html" target="_blank" '
        + 'style="display:inline-block;background:#FFD700;color:#000;padding:16px 32px;font-weight:900;'
        + 'text-transform:uppercase;text-decoration:none;font-size:14px;border:3px solid #000;margin-right:12px;">'
        + '💳 Payer le solde</a>'
        + '<a href="' + frontUrl + '/livrables.html" target="_blank" '
        + 'style="display:inline-block;background:#000;color:#FFD700;padding:16px 32px;font-weight:900;'
        + 'text-transform:uppercase;text-decoration:none;font-size:14px;border:3px solid #000;">'
        + '📁 Mes livrables</a>'
        + '</div>'
        + '<p style="margin:30px 0 0 0;font-size:16px;color:#333;">Merci pour votre confiance,<br>'
        + '<strong style="color:#000;">L\'équipe FA GENESIS</strong></p>';

    try {
        var result = await transport.sendMail({
            from: '"' + (process.env.EMAIL_FROM_NAME || 'FA GENESIS') + '" <' + (process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER) + '>',
            to: clientEmail,
            subject: '[FA GENESIS] Votre accompagnement est terminé — Téléchargez vos livrables',
            html: getEmailTemplate(content, 'Fin d\'accompagnement')
        });
        console.log('[EMAIL] Fin accompagnement envoyee a ' + clientEmail);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('[EMAIL] Erreur fin accompagnement:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    initializeTransporter,
    sendContactConfirmation,
    sendAdminNotification,
    sendRegistrationConfirmation,
    sendAdminRegistrationNotification,
    sendPaymentConfirmation,
    sendAdminReply,
    sendNewDocumentNotification,
    sendQuoteAdminNotification,
    sendQuotePartnerNotification,
    sendQuoteToClient,
    sendSessionConfirmedEmail,
    sendSessionRescheduledEmail,
    sendSessionRequestedEmail,
    sendSessionProposedEmail,
    sendSessionCompletedEmail,
    sendWelcomeEmail,
    sendScheduleProposedNotification,
    sendScheduleConfirmedToClient,
    sendScheduleReproposedToClient,
    sendScheduleCancelledNotification,
    sendQuoteCancelledNotification,
    sendAccompanimentEndNotification
};
