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
        console.error('[EMAIL] Brevo erreur ' + response.status + ':', JSON.stringify(data));
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
                                Email : <a href="mailto:contact@fagenesis.com" style="color: #FFD700; font-weight:700;">contact@fagenesis.com</a>
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
            Contact : <a href="mailto:contact@fagenesis.com" style="color: #FFD700; font-weight:700;">contact@fagenesis.com</a>
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
            to: process.env.EMAIL_ADMIN_ADDRESS || 'contact@fagenesis.com',
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
            to: process.env.EMAIL_ADMIN_ADDRESS || 'contact@fagenesis.com',
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
            Contact : <a href="mailto:contact@fagenesis.com" style="color: #FFD700; font-weight:700;">contact@fagenesis.com</a>
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
        <p style="text-align:center;font-size:12px;color:#999;margin-top:8px;">
            Si ce bouton n'ouvre pas l'application, ouvrez directement l'app GENESIS sur votre téléphone.
        </p>
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
        var adminEmail = process.env.EMAIL_ADMIN_ADDRESS || 'contact@fagenesis.com';

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
                <a href="${frontUrl}/app.html" style="display: inline-block; background: #FFD700; color: #000; padding: 14px 30px; text-decoration: none; font-weight: 900; font-size: 14px; border: 3px solid #000;">
                    VOIR LE DEVIS
                </a>
            </div>
            <p style="text-align:center;font-size:12px;color:#999;margin-top:8px;">
                Si ce bouton n'ouvre pas l'application, ouvrez directement l'app GENESIS sur votre téléphone.
            </p>
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
        var acceptUrl = frontUrl + '/app.html?quote_token=' + quote.acceptance_token;

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
        + '<a href="' + (process.env.FRONT_URL || 'https://fagenesis.com') + '/seances.html" target="_blank" '
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
    const name = prenom || 'vous';

    const html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Bienvenue sur FA GENESIS !</title></head>'
        + '<body style="margin:0;padding:0;background:#f5f5f5;font-family:\'Helvetica Neue\',Arial,sans-serif;">'
        + '<table role="presentation" width="100%" style="border-collapse:collapse;background:#f5f5f5;">'
        + '<tr><td style="padding:24px 12px;">'
        + '<table role="presentation" width="100%" style="max-width:600px;margin:0 auto;border-collapse:collapse;">'

        // Header
        + '<tr><td style="background:#000;padding:24px 32px;border-radius:12px 12px 0 0;">'
        + '<span style="font-family:\'Arial Black\',Arial,sans-serif;font-size:22px;font-weight:900;color:#FFD700;letter-spacing:2px;">FA GENESIS</span>'
        + '<div style="font-size:10px;color:#888;margin-top:2px;letter-spacing:1px;">Groupe FA Industries</div>'
        + '</td></tr>'

        // Hero
        + '<tr><td style="background:#fff;padding:36px 32px 24px;border-bottom:1px solid #eee;text-align:center;">'
        + '<div style="font-size:48px;margin-bottom:16px;">🎉</div>'
        + '<p style="margin:0 0 10px;font-size:24px;font-weight:800;color:#1a1a1a;">Bienvenue, ' + name + ' !</p>'
        + '<p style="margin:0;font-size:15px;color:#555;line-height:1.6;">Votre compte FA GENESIS est prêt.<br>Découvrez nos prestataires et lancez votre premier projet.</p>'
        + '</td></tr>'

        // Comment ça marche
        + '<tr><td style="background:#fff;padding:28px 32px;border-bottom:1px solid #eee;">'
        + '<p style="margin:0 0 18px;font-size:13px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.8px;">Comment ça marche ?</p>'
        + '<table role="presentation" width="100%" style="border-collapse:collapse;">'
        + _deliverooStep('1', '#FFD700', 'Explorez les prestataires', 'Parcourez notre annuaire de professionnels vérifiés et consultez leurs portfolios.')
        + _deliverooStep('2', '#00ccbc', 'Faites une demande', 'Choisissez un prestataire, décrivez votre besoin — c\'est gratuit et sans engagement.')
        + _deliverooStep('3', '#ff9f00', 'Payez après acceptation', 'Votre prestataire confirme sous 24h. L\'acompte n\'est prélevé qu\'à ce moment-là.')
        + _deliverooStep('4', '#22cc66', 'Suivez en temps réel', 'Suivez l\'avancement de votre mission et recevez vos livrables.', true)
        + '</table>'
        + '</td></tr>'

        // CTA
        + '<tr><td style="background:#fff;padding:28px 32px;border-bottom:1px solid #eee;text-align:center;">'
        + '<p style="margin:0 0 16px;font-size:15px;color:#1a1a1a;">Prêt(e) à commencer ?</p>'
        + '<a href="' + frontUrl + '/app.html" style="display:inline-block;background:#FFD700;color:#000;font-weight:900;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:8px;">Explorer les prestataires →</a>'
        + '</td></tr>'

        // Footer
        + '<tr><td style="background:#f5f5f5;padding:20px 32px;border-radius:0 0 12px 12px;text-align:center;">'
        + '<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#1a1a1a;">Des questions sur votre commande ?</p>'
        + '<p style="margin:0 0 6px;font-size:12px;color:#999;"><a href="mailto:contact@fagenesis.com" style="font-size:13px;color:#1a1a1a;font-weight:600;text-decoration:none;">Contactez-nous par email <span style="color:#FFD700;">contact@fagenesis.com</span></a></p>'
        + '<p style="margin:0;font-size:11px;color:#bbb;">Cet email est envoyé automatiquement. Merci de ne pas y répondre directement.</p>'
        + '</td></tr>'

        + '</table>'
        + '</td></tr></table>'
        + '</body></html>';

    try {
        const result = await transport.sendMail({
            from: `"FA GENESIS" <${process.env.EMAIL_FROM_ADDRESS || 'contact@fagenesis.com'}>`,
            to: clientEmail,
            subject: `🎉 Bienvenue sur FA GENESIS, ${name} ! Votre compte est prêt`,
            html: html
        });

        console.log(`[EMAIL] Email bienvenue envoye a ${clientEmail} - ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId };

    } catch (error) {
        console.error('[EMAIL] Erreur envoi email bienvenue:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Compte partenaire approuvé par l'admin : invite a configurer ses prestations
 */
async function sendPartnerAccountApprovedEmail(partner) {
    const transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configure - Email approbation partenaire non envoye');
        return { success: false, reason: 'SMTP non configure' };
    }

    const frontUrl = process.env.FRONT_URL || 'https://fagenesis.com';
    const prenom = partner.prenom || '';

    const content = `
        <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #000000; font-weight: 700;">
            Votre compte partenaire est approuvé !
        </h2>

        <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333; line-height: 1.6;">
            Bonjour ${prenom},
        </p>

        <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333; line-height: 1.6;">
            Bonne nouvelle : notre équipe vient de valider votre compte partenaire <strong>FA GENESIS</strong>.
        </p>

        <div style="background-color: #FFF9E6; border-left: 4px solid #FFD700; padding: 20px; margin: 25px 0;">
            <p style="margin: 0 0 15px 0; font-weight: 700; color: #000; font-size: 16px;">
                Vous pouvez désormais :
            </p>
            <ol style="margin: 0; padding-left: 20px; color: #333; line-height: 2;">
                <li><strong>Configurer vos prestations</strong> - Libellés, descriptions et tarifs</li>
                <li><strong>Compléter votre profil</strong> - Photo, bio, zone d'intervention</li>
                <li><strong>Apparaître dans l'annuaire</strong> - Visible par les clients FA GENESIS dès maintenant</li>
            </ol>
        </div>

        <div style="background-color: #000000; color: #ffffff; padding: 20px; border-radius: 4px; margin: 25px 0; text-align: center;">
            <p style="margin: 0 0 15px 0; font-size: 14px; color: #cccccc;">
                Accédez à votre espace partenaire pour mettre en ligne vos prestations
            </p>
            <a href="${frontUrl}/app.html#open-partner"
               style="display: inline-block; background-color: #FFD700; color: #000; padding: 15px 30px; text-decoration: none; font-weight: 700; border-radius: 4px; font-size: 16px;">
                Configurer mes prestations
            </a>
        </div>

        <p style="margin: 30px 0 0 0; font-size: 16px; color: #333333;">
            À très bientôt,<br>
            <strong style="color: #000000;">L'équipe FA GENESIS</strong>
        </p>
    `;

    try {
        const result = await transport.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
            to: partner.email,
            subject: `[FA GENESIS] Votre compte partenaire est approuvé`,
            html: getEmailTemplate(content, 'Compte partenaire approuvé')
        });

        console.log(`[EMAIL] Email approbation partenaire envoye a ${partner.email} - ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId };

    } catch (error) {
        console.error('[EMAIL] Erreur envoi email approbation partenaire:', error.message);
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
        + '<a href="' + frontUrl + '/app.html" target="_blank" '
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
        + '<a href="' + frontUrl + '/app.html" target="_blank" '
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
        ctaUrl = frontUrl + '/app.html';
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
        var adminEmail = process.env.EMAIL_ADMIN_ADDRESS || 'contact@fagenesis.com';

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

/**
 * Envoyer le devis coworking au client avec boutons Accepter / Décliner
 */
async function sendCwDevisToClient(devis) {
    var transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configure - CW Devis non envoye');
        return { success: false, reason: 'no_transporter' };
    }

    var apiUrl = process.env.API_URL || 'https://fa-genesis-website.onrender.com';
    var acceptUrl = apiUrl + '/api/coworking/devis/' + devis.id + '/email-respond?token=' + devis.email_token + '&action=accept';
    var declineUrl = apiUrl + '/api/coworking/devis/' + devis.id + '/email-respond?token=' + devis.email_token + '&action=decline';

    var opts = (devis.quote && devis.quote.installments_options) || [1];
    var installmentsText = '';
    if (opts.length > 1 || (opts.length === 1 && opts[0] > 1)) {
        installmentsText = '<p style="color:#000;font-weight:700;margin:0 0 12px 0;">Options de paiement : '
            + opts.map(function(n){ return n === 1 ? '1x (paiement intégral)' : n + ' versements'; }).join(' &bull; ')
            + '</p>';
    }

    var validUntilText = '';
    if (devis.quote && devis.quote.valid_until) {
        var d = new Date(devis.quote.valid_until);
        validUntilText = '<div style="background:#FFF3CD;border:1px solid #FFD700;padding:12px;margin:20px 0;text-align:center;">'
            + '<p style="margin:0;font-size:13px;color:#856404;font-weight:700;">Offre valable jusqu\'au <strong>' + d.toLocaleDateString('fr-FR') + '</strong></p>'
            + '</div>';
    }

    var content = '<h2 style="color:#000;margin:0 0 6px 0;font-size:22px;font-weight:900;text-transform:uppercase;">Votre devis coworking</h2>'
        + '<p style="color:#b81a6e;font-size:10px;font-weight:900;letter-spacing:3px;text-transform:uppercase;margin:0 0 20px 0;">COM VISA — Espace Coworking</p>'
        + '<p style="color:#000;font-weight:700;">Bonjour ' + (devis.client_name || '') + ',</p>'
        + '<p style="color:#000;font-weight:700;">Suite à votre demande pour <strong>' + (devis.service_label || '') + '</strong>, voici le devis que nous vous proposons :</p>'
        + '<table role="presentation" style="width:100%;border-collapse:collapse;border:3px solid #000;margin:20px 0;">'
        + '<tr style="background:#000;"><td style="padding:12px 16px;color:#FFD700;font-weight:900;font-size:13px;text-transform:uppercase;">Prestation</td><td style="padding:12px 16px;color:#FFD700;font-weight:900;font-size:13px;text-transform:uppercase;text-align:right;">Montant</td></tr>'
        + '<tr><td style="padding:16px;color:#000;font-weight:700;">' + (devis.quote ? devis.quote.description : '') + '</td><td style="padding:16px;text-align:right;font-weight:900;color:#000;font-size:22px;">' + Number((devis.quote || {}).amount || 0).toFixed(2) + ' €</td></tr>'
        + '</table>'
        + installmentsText
        + validUntilText
        + '<table role="presentation" style="width:100%;border-collapse:collapse;margin:24px 0;">'
        + '<tr>'
        + '<td style="padding-right:8px;width:50%;">'
        + '<a href="' + acceptUrl + '" style="display:block;background:#000;color:#FFD700;padding:16px 0;text-decoration:none;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:1px;text-align:center;">ACCEPTER LE DEVIS</a>'
        + '</td>'
        + '<td style="padding-left:8px;width:50%;">'
        + '<a href="' + declineUrl + '" style="display:block;background:#fff;color:#000;padding:14px 0;text-decoration:none;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:1px;text-align:center;border:3px solid #000;">DÉCLINER</a>'
        + '</td>'
        + '</tr>'
        + '</table>'
        + '<p style="color:#666;font-size:12px;font-weight:700;margin:0;">En acceptant, vous serez invité à vous connecter à votre espace client pour procéder au paiement.</p>';

    var html = getEmailTemplate(content, 'Devis Coworking — FA GENESIS');

    try {
        await transport.sendMail({
            from: '"FA GENESIS" <' + (process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER) + '>',
            to: devis.client_email,
            subject: '[FA GENESIS] Votre devis — ' + (devis.service_label || 'Coworking'),
            html: html
        });
        console.log('[EMAIL] CW Devis envoye a ' + devis.client_email);
        return { success: true };
    } catch(e) {
        console.error('[EMAIL] Erreur CW devis:', e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Notifier le partenaire coworking d'une nouvelle réservation (depuis email)
 * @param {Object} reservation - La réservation créée
 * @param {Object} order - La commande associée
 */
async function sendCwReservationToPartner(reservation, order) {
    var transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configure - CW reservation non envoyee');
        return { success: false, reason: 'no_transporter' };
    }

    var partnerEmail = process.env.CW_PARTNER_EMAIL || '';
    var apiUrl = process.env.API_URL || 'https://fa-genesis-website.onrender.com';
    var confirmUrl = apiUrl + '/api/reservations/' + reservation.id + '/email-respond?action=confirmed&token=' + reservation.email_token;
    var refuseUrl  = apiUrl + '/api/reservations/' + reservation.id + '/email-respond?action=refused&token=' + reservation.email_token;

    var datesText = '';
    if (reservation.dates && reservation.dates.length > 0) {
        var datesFormatted = reservation.dates.map(function(d) {
            return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }).join(', ');
        datesText = '<p style="color:#000;font-weight:700;margin:0 0 8px 0;"><strong>Date(s) :</strong> ' + datesFormatted + '</p>';
    }
    if (reservation.time_start && reservation.time_end) {
        datesText += '<p style="color:#000;font-weight:700;margin:0 0 8px 0;"><strong>Créneau :</strong> ' + reservation.time_start + ' – ' + reservation.time_end + '</p>';
    }

    var content = '<h2 style="color:#000;margin:0 0 6px 0;font-size:22px;font-weight:900;text-transform:uppercase;">Nouvelle réservation</h2>'
        + '<p style="color:#b81a6e;font-size:10px;font-weight:900;letter-spacing:3px;text-transform:uppercase;margin:0 0 20px 0;">COM VISA — Espace Coworking</p>'
        + '<p style="color:#000;font-weight:700;">Un client vient de réserver votre espace. Confirmez ou refusez ci-dessous.</p>'
        + '<table role="presentation" style="width:100%;border-collapse:collapse;border:3px solid #000;margin:20px 0;">'
        + '<tr style="background:#000;"><td colspan="2" style="padding:12px 16px;color:#FFD700;font-weight:900;font-size:13px;text-transform:uppercase;">Détails de la réservation</td></tr>'
        + '<tr><td style="padding:12px 16px;color:#000;font-weight:700;border-bottom:1px solid #eee;width:40%;">Prestation</td><td style="padding:12px 16px;color:#000;font-weight:900;border-bottom:1px solid #eee;">' + (reservation.product_name || '') + '</td></tr>'
        + '<tr><td style="padding:12px 16px;color:#000;font-weight:700;border-bottom:1px solid #eee;">Client</td><td style="padding:12px 16px;color:#000;font-weight:700;border-bottom:1px solid #eee;">' + (reservation.client_name || '') + '</td></tr>'
        + '<tr><td style="padding:12px 16px;color:#000;font-weight:700;border-bottom:1px solid #eee;">Email</td><td style="padding:12px 16px;border-bottom:1px solid #eee;"><a href="mailto:' + (reservation.client_email || '') + '" style="color:#b81a6e;font-weight:700;">' + (reservation.client_email || '') + '</a></td></tr>'
        + (reservation.client_phone ? '<tr><td style="padding:12px 16px;color:#000;font-weight:700;border-bottom:1px solid #eee;">Téléphone</td><td style="padding:12px 16px;color:#000;font-weight:700;border-bottom:1px solid #eee;">' + reservation.client_phone + '</td></tr>' : '')
        + (datesText ? '<tr><td colspan="2" style="padding:12px 16px;color:#000;border-bottom:1px solid #eee;">' + datesText + '</td></tr>' : '')
        + '<tr><td style="padding:12px 16px;color:#000;font-weight:700;">Montant</td><td style="padding:12px 16px;color:#000;font-weight:900;font-size:20px;">' + Number(reservation.prix || 0).toFixed(2) + ' €</td></tr>'
        + '</table>'
        + '<table role="presentation" style="width:100%;border-collapse:collapse;margin:24px 0;">'
        + '<tr>'
        + '<td style="padding-right:8px;width:50%;">'
        + '<a href="' + confirmUrl + '" style="display:block;background:#000;color:#FFD700;padding:16px 0;text-decoration:none;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:1px;text-align:center;">✔ CONFIRMER</a>'
        + '</td>'
        + '<td style="padding-left:8px;width:50%;">'
        + '<a href="' + refuseUrl + '" style="display:block;background:#fff;color:#000;padding:14px 0;text-decoration:none;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:1px;text-align:center;border:3px solid #000;">✗ REFUSER</a>'
        + '</td>'
        + '</tr>'
        + '</table>'
        + '<p style="color:#666;font-size:12px;font-weight:700;margin:0;">Vous pouvez également gérer cette réservation depuis votre <a href="https://fagenesis.com/coworking-partner.html" style="color:#b81a6e;">espace partenaire</a>.</p>';

    var html = getEmailTemplate(content, 'Nouvelle Réservation — COM VISA');

    try {
        await transport.sendMail({
            from: '"FA GENESIS" <' + (process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER) + '>',
            to: partnerEmail,
            subject: '[COM VISA] Nouvelle réservation — ' + (reservation.product_name || 'Coworking'),
            html: html
        });
        console.log('[EMAIL] CW Reservation envoyee au partenaire: ' + partnerEmail);
        return { success: true };
    } catch(e) {
        console.error('[EMAIL] Erreur CW reservation:', e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Envoyer l'email de réinitialisation de mot de passe
 */
async function sendPasswordResetEmail(email, prenom, resetLink) {
    var transport = initializeTransporter();
    if (!transport) {
        console.warn('[EMAIL] Transport non configuré - email reset non envoyé');
        return;
    }

    var content = '<h2 style="color:#000;font-size:22px;font-weight:900;margin:0 0 16px;">Réinitialisation de votre mot de passe</h2>'
        + '<p style="color:#333;font-size:16px;line-height:1.6;margin:0 0 16px;">Bonjour ' + (prenom || 'Client') + ',</p>'
        + '<p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 24px;">'
        + 'Vous avez demandé à réinitialiser votre mot de passe FA GENESIS.<br>'
        + 'Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe.'
        + '</p>'
        + '<div style="text-align:center;margin:32px 0;">'
        + '<a href="' + resetLink + '" style="display:inline-block;background:#FFD700;color:#000;font-weight:900;font-size:15px;padding:16px 40px;text-decoration:none;text-transform:uppercase;letter-spacing:1px;">'
        + 'Réinitialiser mon mot de passe</a>'
        + '</div>'
        + '<p style="color:#888;font-size:13px;line-height:1.6;margin:24px 0 0;">'
        + 'Ce lien est valable <strong>24 heures</strong>. Si vous n\'avez pas fait cette demande, ignorez cet email — votre compte reste sécurisé.'
        + '</p>'
        + '<hr style="border:none;border-top:1px solid #eee;margin:24px 0;">'
        + '<p style="color:#aaa;font-size:12px;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>'
        + '<span style="color:#666;word-break:break-all;">' + resetLink + '</span></p>';

    var html = getEmailTemplate(content, 'Réinitialisation mot de passe — FA GENESIS');

    try {
        await transport.sendMail({
            from: '"FA GENESIS" <noreply@fagenesis.com>',
            to: email,
            subject: 'Réinitialisation de votre mot de passe FA GENESIS',
            html: html
        });
        console.log('[EMAIL] Reset password envoyé à: ' + email);
        return { success: true };
    } catch (e) {
        console.error('[EMAIL] Erreur reset password:', e.message);
        return { success: false, error: e.message };
    }
}

async function sendOtpEmail(email, prenom, otpCode) {
    var transport = initializeTransporter();
    if (!transport) { console.warn('[OTP EMAIL] Transport non configuré'); return; }
    var content = '<h2 style="font-family:Unbounded,cursive;font-size:20px;font-weight:900;margin:0 0 20px;color:#000;">Code de vérification</h2>'
        + '<p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 8px;">Bonjour ' + (prenom || 'Client') + ',</p>'
        + '<p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 24px;">Voici votre code de vérification FA GENESIS. Ne le partagez avec personne.</p>'
        + '<div style="text-align:center;margin:32px 0;">'
        + '<div style="display:inline-block;background:#111;color:#FFD700;font-family:Courier New,monospace;font-size:38px;font-weight:900;letter-spacing:10px;padding:20px 32px;border-radius:12px;border:2px solid #FFD700;">'
        + otpCode + '</div></div>'
        + '<p style="color:#888;font-size:13px;line-height:1.6;margin:24px 0 0;">Ce code est valable <strong>10 minutes</strong>. Ne le partagez jamais.</p>';
    var html = getEmailTemplate(content, 'Code de vérification — FA GENESIS');
    try {
        await transport.sendMail({
            from: '"FA GENESIS" <noreply@fagenesis.com>',
            to: email,
            subject: 'Votre code FA GENESIS : ' + otpCode,
            html: html
        });
        console.log('[OTP EMAIL] Envoyé à ' + email);
    } catch(e) { console.error('[OTP EMAIL]', e.message); }
}

async function sendOtpSms(phone, otpCode) {
    var apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) throw new Error('BREVO_API_KEY non configuré');

    var body = JSON.stringify({
        sender: 'FAGENESIS',
        recipient: phone,
        content: 'Saisissez le code ' + otpCode + ' pour vous connecter. Ne le partagez pas.',
        type: 'transactional'
    });

    var response = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
        method: 'POST',
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: body
    });

    var result = await response.json();
    if (!response.ok) {
        throw new Error('Brevo SMS erreur ' + response.status + ' : ' + (result.message || JSON.stringify(result)));
    }
    console.log('[SMS] OTP envoyé via Brevo à ' + phone);
}

/**
 * Envoi d'un email de prospection B2B depuis l'admin vers un prospect repéré.
 */
async function sendProspectContactEmail(prospect, subject, bodyText) {
    try {
        if (!transporter) {
            initializeTransporter();
            if (!transporter) return { success: false, reason: 'no_transporter' };
        }
        var bodyHtml = String(bodyText).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g, '<br>');
        var content = '<p style="color:#333333;font-size:15px;line-height:1.8;">' + bodyHtml + '</p>';
        var html = getEmailTemplate(content, subject);
        var adminEmail = process.env.EMAIL_ADMIN_ADDRESS || process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER;
        var mailOptions = {
            from: '"FA GENESIS" <' + (process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER) + '>',
            to: prospect.email,
            replyTo: adminEmail,
            subject: subject,
            html: html
        };
        var result = await transporter.sendMail(mailOptions);
        console.log('[EMAIL] Prospect contacté : ' + prospect.email + ' | sujet : ' + subject);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('[EMAIL] Erreur envoi prospect:', error.message);
        return { success: false, error: error.message };
    }
}

async function sendLevelUpEmail(clientEmail, prenom, levelLabel) {
    try {
        if (!transporter) { initializeTransporter(); }
        var adminEmail = process.env.EMAIL_ADMIN_ADDRESS || process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER;
        var content = '<h2 style="color:#FFD700;font-size:22px;margin:0 0 12px;">🎉 Félicitations ' + (prenom || '') + ' !</h2>'
            + '<p style="color:#ccc;font-size:15px;line-height:1.7;margin:0 0 16px;">Vous venez d\'atteindre le niveau <strong style="color:#FFD700;">' + levelLabel + '</strong> sur FA GENESIS.</p>'
            + '<p style="color:#ccc;font-size:15px;line-height:1.7;margin:0 0 16px;">De nouveaux avantages exclusifs sont maintenant débloqués pour vous. Connectez-vous à l\'application pour les découvrir.</p>'
            + '<a href="https://fagenesis.com/app.html" style="display:inline-block;background:#FFD700;color:#000;font-weight:800;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;margin-top:8px;">Voir mes avantages →</a>';
        var html = getEmailTemplate(content, 'Nouveau niveau GENESIS atteint !');
        var mailOptions = {
            from: '"FA GENESIS" <' + (process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER) + '>',
            to: clientEmail,
            replyTo: adminEmail,
            subject: '🎉 Vous êtes maintenant ' + levelLabel + ' sur FA GENESIS !',
            html: html
        };
        var result = await transporter.sendMail(mailOptions);
        return { success: true, messageId: result.messageId };
    } catch(e) {
        console.warn('[LEVEL_UP_EMAIL] Échec envoi:', e.message);
        return { success: false, error: e.message };
    }
}

async function sendCapacityLimitedEventEmail(clientEmail, prenom, eventTitle, eventLink) {
    try {
        if (!transporter) { initializeTransporter(); }
        var adminEmail = process.env.EMAIL_ADMIN_ADDRESS || process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER;
        var name = prenom || 'membre';
        var link = eventLink || 'https://fagenesis.com/app.html';
        var safeTitle = String(eventTitle || 'Événement GENESIS').substring(0, 120);
        var content = '<h2 style="color:#FFD700;font-size:22px;margin:0 0 12px;">🎫 Événement exclusif disponible, ' + name + ' !</h2>'
            + '<p style="color:#ccc;font-size:15px;line-height:1.7;margin:0 0 16px;">Un nouvel événement à capacité limitée vient d\'être publié sur FA GENESIS :</p>'
            + '<p style="color:#FFD700;font-size:17px;font-weight:800;margin:0 0 16px;">' + safeTitle + '</p>'
            + '<p style="color:#ccc;font-size:14px;line-height:1.7;margin:0 0 20px;">Les places sont limitées — réservez rapidement depuis la section <strong style="color:#fff;">Événements</strong> de l\'application.</p>'
            + '<a href="' + link + '" style="display:inline-block;background:#FFD700;color:#000;font-weight:800;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;margin-top:8px;">Voir l\'événement →</a>';
        var html = getEmailTemplate(content, 'Événement à capacité limitée');
        var mailOptions = {
            from: '"FA GENESIS" <' + (process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER) + '>',
            to: clientEmail,
            replyTo: adminEmail,
            subject: '🎫 Événement exclusif : ' + safeTitle + ' — Places limitées !',
            html: html
        };
        var result = await transporter.sendMail(mailOptions);
        return { success: true, messageId: result.messageId };
    } catch(e) {
        console.warn('[EVENT_EMAIL] Échec envoi:', e.message);
        return { success: false, error: e.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTRAT SIGNÉ → EMAIL AU PRESTATAIRE
// ─────────────────────────────────────────────────────────────────────────────
async function sendContractSignedToPartnerEmail(partnerEmail, partnerPrenom, clientName, serviceName, contractRef) {
    var transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configuré - email contrat signé non envoyé');
        return { success: false, reason: 'SMTP non configuré' };
    }
    var frontUrl = process.env.FRONT_URL || 'https://fagenesis.com';
    var html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Contrat signé !</title></head>'
        + '<body style="margin:0;padding:0;background:#f5f5f5;font-family:\'Helvetica Neue\',Arial,sans-serif;">'
        + '<table role="presentation" width="100%" style="border-collapse:collapse;background:#f5f5f5;">'
        + '<tr><td style="padding:24px 12px;">'
        + '<table role="presentation" width="100%" style="max-width:600px;margin:0 auto;border-collapse:collapse;">'
        + '<tr><td style="background:#000;padding:20px 32px;border-radius:12px 12px 0 0;">'
        + '<span style="font-family:\'Arial Black\',Arial,sans-serif;font-size:20px;font-weight:900;color:#FFD700;letter-spacing:1.5px;">FA GENESIS</span>'
        + '<div style="font-size:10px;color:#FFD700;opacity:.75;margin-top:1px;">Groupe FA Industries</div>'
        + '</td></tr>'
        + '<tr><td style="background:#fff;padding:32px 32px 24px;border-bottom:1px solid #eee;text-align:center;">'
        + '<p style="margin:0 0 12px;font-size:24px;">✍️</p>'
        + '<p style="margin:0 0 16px;font-size:21px;font-weight:800;color:#1a1a1a;line-height:1.3;">Contrat signé !</p>'
        + '<p style="margin:0;font-size:15px;color:#555;line-height:1.6;">Bonjour <strong>' + (partnerPrenom || 'Prestataire') + '</strong>,<br>'
        + '<strong>' + (clientName || 'Un client') + '</strong> vient de signer le contrat pour votre prestation :<br>'
        + '<strong style="color:#1a1a1a;">' + (serviceName || 'Prestation') + '</strong></p>'
        + '</td></tr>'
        + '<tr><td style="background:#fff;padding:20px 32px;border-bottom:1px solid #eee;">'
        + '<table role="presentation" width="100%" style="border-collapse:collapse;font-size:13px;">'
        + '<tr><td style="padding:8px 0;color:#666;">Référence contrat</td><td style="padding:8px 0;font-weight:700;text-align:right;">' + (contractRef || '—') + '</td></tr>'
        + '<tr style="background:#f9f9f9;"><td style="padding:8px 0;color:#666;">Prestation</td><td style="padding:8px 0;font-weight:700;text-align:right;">' + (serviceName || '—') + '</td></tr>'
        + '<tr><td style="padding:8px 0;color:#666;">Client</td><td style="padding:8px 0;font-weight:700;text-align:right;">' + (clientName || '—') + '</td></tr>'
        + '</table>'
        + '</td></tr>'
        + '<tr><td style="background:#fff;padding:24px 32px;text-align:center;border-bottom:1px solid #eee;">'
        + '<p style="margin:0 0 16px;font-size:14px;color:#555;">Retrouvez et téléchargez ce contrat dans votre espace Documents.</p>'
        + '<a href="' + frontUrl + '/app.html" style="display:inline-block;background:#FFD700;color:#000;font-weight:900;font-size:14px;text-decoration:none;padding:13px 28px;border-radius:8px;">Voir mes documents →</a>'
        + '</td></tr>'
        + '<tr><td style="background:#1a1a1a;padding:16px 32px;border-radius:0 0 12px 12px;text-align:center;">'
        + '<p style="margin:0;font-size:11px;color:#888;">FA GENESIS · Plateforme de services créatifs et professionnels</p>'
        + '</td></tr>'
        + '</table></td></tr></table></body></html>';

    try {
        var mailOptions = {
            from: '"FA GENESIS" <' + (process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@fagenesis.com') + '>',
            to: partnerEmail,
            subject: '✍️ Contrat signé — ' + (serviceName || 'Prestation'),
            html: html
        };
        var result = await transport.sendMail(mailOptions);
        return { success: true, messageId: result.messageId };
    } catch(e) {
        console.warn('[EMAIL] Erreur envoi email contrat signé prestataire:', e.message);
        return { success: false, error: e.message };
    }
}

module.exports = {
    initializeTransporter,
    sendContactConfirmation,
    sendAdminNotification,
    sendAdminRegistrationNotification,
    sendPaymentConfirmation,
    sendAdminReply,
    sendNewDocumentNotification,
    sendQuoteAdminNotification,
    sendQuotePartnerNotification,
    sendPartnerAccountApprovedEmail,
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
    sendAccompanimentEndNotification,
    sendUrgentFeedbackNotification,
    sendCwDevisToClient,
    sendCwReservationToPartner,
    sendPasswordResetEmail,
    sendOtpEmail,
    sendOtpSms,
    sendPartnerServiceOrderConfirmation,
    sendSupportTicketAdminEmail,
    sendProspectContactEmail,
    sendLevelUpEmail,
    sendCapacityLimitedEventEmail,
    sendInstallmentReminderEmail,
    sendContractSignedToPartnerEmail
};

// ============================================================
// EMAIL NOTIFICATION SUPPORT TICKET → ADMIN
// ============================================================

/**
 * Envoie un email à l'admin quand un client crée ou répond à un ticket support.
 * Le CTA du mail pointe directement vers admin.html#support-{ticketId}.
 * @param {Object} ticket  - L'objet ticket complet (id, subject, client_name, client_email, messages)
 * @param {string} messageContent - Le contenu du nouveau message (pour la preview)
 */
async function sendSupportTicketAdminEmail(ticket, messageContent) {
    var transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configuré - Notification support admin ignorée');
        return { success: false, reason: 'transport non configuré' };
    }

    var adminUrl = 'https://fagenesis.com/admin.html#support-' + ticket.id;
    var isNewTicket = ticket.messages.length <= 1;
    var label = isNewTicket ? 'Nouveau ticket support' : 'Réponse client — ticket en cours';
    var preview = (messageContent || '').substring(0, 300) + ((messageContent || '').length > 300 ? '…' : '');

    var html = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
        + '<div style="background:#000;padding:20px;text-align:center;">'
        + '<h1 style="color:#FFD700;font-size:22px;margin:0;letter-spacing:3px;">FA GENESIS</h1>'
        + '</div>'
        + '<div style="background:#FFD700;padding:14px;text-align:center;">'
        + '<h2 style="margin:0;color:#000;font-size:15px;font-weight:900;text-transform:uppercase;">' + escapeHtml(label) + '</h2>'
        + '</div>'
        + '<div style="background:#fff;padding:28px;border:1px solid #ddd;">'
        + '<table style="width:100%;border-collapse:collapse;">'
        + '<tr><td style="padding:9px 8px;font-weight:700;color:#555;width:35%;border-bottom:1px solid #eee;">Client</td><td style="padding:9px 8px;border-bottom:1px solid #eee;">' + escapeHtml(ticket.client_name) + '</td></tr>'
        + '<tr style="background:#fafafa;"><td style="padding:9px 8px;font-weight:700;color:#555;border-bottom:1px solid #eee;">Email</td><td style="padding:9px 8px;border-bottom:1px solid #eee;"><a href="mailto:' + escapeHtml(ticket.client_email) + '" style="color:#000;font-weight:700;">' + escapeHtml(ticket.client_email) + '</a></td></tr>'
        + '<tr><td style="padding:9px 8px;font-weight:700;color:#555;border-bottom:1px solid #eee;">Sujet</td><td style="padding:9px 8px;border-bottom:1px solid #eee;">' + escapeHtml(ticket.subject) + '</td></tr>'
        + '<tr style="background:#fafafa;"><td style="padding:9px 8px;font-weight:700;color:#555;">Référence</td><td style="padding:9px 8px;font-size:11px;color:#888;">' + escapeHtml(ticket.id) + '</td></tr>'
        + '</table>'
        + '<div style="background:#FFF9E6;border-left:4px solid #FFD700;padding:16px 20px;margin:22px 0;border-radius:0 6px 6px 0;">'
        + '<p style="margin:0 0 8px;font-weight:700;color:#000;font-size:13px;">Message du client :</p>'
        + '<p style="margin:0;color:#333;white-space:pre-wrap;line-height:1.7;font-size:14px;">' + escapeHtml(preview) + '</p>'
        + '</div>'
        + '<div style="text-align:center;margin-top:28px;">'
        + '<a href="' + adminUrl + '" style="display:inline-block;background:#FFD700;color:#000;padding:15px 36px;font-weight:900;font-size:14px;text-decoration:none;border:2px solid #000;letter-spacing:1px;">RÉPONDRE DANS L\'ESPACE ADMIN →</a>'
        + '</div>'
        + '<p style="margin:20px 0 0;font-size:12px;color:#aaa;text-align:center;">Ce lien vous connecte directement au ticket pour répondre en temps réel.</p>'
        + '</div>'
        + '<div style="background:#111;padding:12px;text-align:center;">'
        + '<p style="color:#666;font-size:11px;margin:0;">FA GENESIS — Support client | ' + new Date().toLocaleString('fr-FR') + '</p>'
        + '</div></div>';

    try {
        var result = await transport.sendMail({
            from: '"FA GENESIS Support" <' + (process.env.EMAIL_FROM_ADDRESS || 'contact@fagenesis.com') + '>',
            to: process.env.EMAIL_ADMIN_ADDRESS || 'contact@fagenesis.com',
            subject: '[Support] ' + (isNewTicket ? 'Nouveau' : 'Réponse') + ' — ' + ticket.subject + ' (' + ticket.client_name + ')',
            html: html
        });
        console.log('[EMAIL] Notification support admin envoyée - ID: ' + (result.messageId || 'N/A'));
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('[EMAIL] Erreur envoi notification support admin:', error.message);
        return { success: false, error: error.message };
    }
}

// ============================================================
// EMAIL CONFIRMATION COMMANDE PRESTATAIRE (style Deliveroo)
// ============================================================

/**
 * Envoi d'un email de confirmation de commande pour une prestation partenaire.
 * Inspiré de Deliveroo : récapitulatif visuel, statut, CTA.
 * @param {string} clientEmail
 * @param {string} clientFirstName
 * @param {Object} order - La commande (product_name, deposit_amount, total_price, id, created_at, ...)
 * @param {string} partnerName - Nom complet du prestataire
 */
async function sendPartnerServiceOrderConfirmation(clientEmail, clientFirstName, order, partnerName) {
    var transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configuré - Confirmation commande partenaire non envoyée');
        return { success: false, reason: 'SMTP non configuré' };
    }

    var frontUrl = process.env.FRONT_URL || 'https://fagenesis.com';
    var prenom = clientFirstName || 'vous';
    var rawRef = (order.id || '').replace('order_', '').toUpperCase();
    var orderRef = rawRef || '—';
    var serviceName = order.product_name || 'Prestation professionnelle';
    var depositAmt = parseFloat(order.deposit_amount || 0).toFixed(2);
    var totalAmt = parseFloat(order.total_amount || order.total_price || 0).toFixed(2);
    var balanceAmt = (parseFloat(totalAmt) - parseFloat(depositAmt)).toFixed(2);
    var orderDate = order.created_at ? new Date(order.created_at).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }) : new Date().toLocaleDateString('fr-FR');
    var partnerDisplay = partnerName || 'Votre prestataire';

    var html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Commande réussie !</title>'
        + '<style>@media only screen and (max-width:480px){.gs-badge{font-size:8px!important;padding:1px 4px!important;}}</style>'
        + '</head>'
        + '<body style="margin:0;padding:0;background:#f5f5f5;font-family:\'Helvetica Neue\',Arial,sans-serif;">'
        + '<table role="presentation" width="100%" style="border-collapse:collapse;background:#f5f5f5;">'
        + '<tr><td style="padding:24px 12px;">'
        + '<table role="presentation" width="100%" style="max-width:600px;margin:0 auto;border-collapse:collapse;">'

        // ── HEADER ──────────────────────────────────────────────
        + '<tr><td style="background:#000;padding:20px 32px;border-radius:12px 12px 0 0;">'
        + '<table role="presentation" width="100%"><tr>'
        + '<td><span style="font-family:\'Arial Black\',Arial,sans-serif;font-size:20px;font-weight:900;color:#FFD700;letter-spacing:1.5px;">FA GENESIS</span>'
        + '<div style="font-size:10px;color:#FFD700;opacity:.75;margin-top:1px;">Groupe FA Industries</div></td>'
        + '<td align="right" style="font-size:11px;color:rgba(255,255,255,.8);">Réf. ' + orderRef + '</td>'
        + '</tr></table>'
        + '</td></tr>'

        // ── HERO ────────────────────────────────────────────────
        + '<tr><td style="background:#fff;padding:32px 32px 24px;border-bottom:1px solid #eee;text-align:center;">'
        + '<p style="margin:0 0 20px;font-size:22px;font-weight:800;color:#1a1a1a;line-height:1.3;">Commande réussie ! 🎉</p>'
        + '<p style="margin:0;font-size:16px;color:#555;line-height:1.6;">Excellent choix, <strong>' + prenom + '</strong> —<br>votre paiement est sécurisé sur le portefeuille GENESIS SAFE™ et ' + partnerDisplay + ' a 24h pour confirmer la prise en charge.</p>'
        + '</td></tr>'

        // ── SUIVI CTA ───────────────────────────────────────────
        + '<tr><td style="background:#fff;padding:24px 32px;border-bottom:1px solid #eee;text-align:center;">'
        + '<p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#1a1a1a;">Suivez votre commande jusqu\'à la livraison</p>'
        + '<a href="' + frontUrl + '/app.html#open-suivi" style="display:inline-block;background:#000;color:#FFD700;font-weight:800;font-size:14px;text-decoration:none;padding:13px 28px;border-radius:8px;">Voir le suivi en temps réel →</a>'
        + '</td></tr>'

        // ── RECAP ───────────────────────────────────────────────
        + '<tr><td style="background:#fff;padding:24px 32px;border-bottom:1px solid #eee;">'
        + '<p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.8px;text-align:center;">Détails de votre commande</p>'
        + '<table role="presentation" width="100%" style="border-collapse:collapse;">'

        // Service row
        + '<tr style="border-bottom:1px solid #f0f0f0;">'
        + '<td style="padding:12px 0;font-size:14px;color:#1a1a1a;font-weight:600;">' + serviceName + '</td>'
        + '<td align="right" style="padding:12px 0;font-size:14px;font-weight:700;color:#1a1a1a;white-space:nowrap;">' + totalAmt + ' €</td>'
        + '</tr>'

        // Prestataire row
        + '<tr style="border-bottom:1px solid #f0f0f0;">'
        + '<td style="padding:10px 0;font-size:13px;color:#777;">Prestataire</td>'
        + '<td align="right" style="padding:10px 0;font-size:13px;color:#1a1a1a;">' + partnerDisplay + '</td>'
        + '</tr>'

        // Acompte row
        + '<tr style="border-bottom:1px solid #f0f0f0;">'
        + '<td style="padding:10px 0;font-size:13px;color:#777;">Paiement réglé <span class="gs-badge" style="background:#e8f8f7;color:#00907e;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;margin-left:4px;">GENESIS SAFE™</span></td>'
        + '<td align="right" style="padding:10px 0;font-size:13px;font-weight:700;color:#FFD700;white-space:nowrap;">' + depositAmt + ' €</td>'
        + '</tr>'

        // Solde restant row
        + (parseFloat(balanceAmt) > 0
            ? '<tr style="border-bottom:1px solid #f0f0f0;">'
              + '<td style="padding:10px 0;font-size:13px;color:#777;">Solde restant (à la livraison)</td>'
              + '<td align="right" style="padding:10px 0;font-size:13px;color:#aaa;white-space:nowrap;">' + balanceAmt + ' €</td>'
              + '</tr>'
            : '')

        // Date row
        + '<tr>'
        + '<td style="padding:10px 0;font-size:13px;color:#777;">Date de commande</td>'
        + '<td align="right" style="padding:10px 0;font-size:13px;color:#777;">' + orderDate + '</td>'
        + '</tr>'
        + '</table>'
        + '</td></tr>'

        // ── QUE SE PASSE-T-IL ENSUITE ───────────────────────────
        + '<tr><td style="background:#fff;padding:24px 32px;border-bottom:1px solid #eee;">'
        + '<p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.8px;text-align:center;">Ce qui se passe ensuite</p>'
        + '<table role="presentation" width="100%" style="border-collapse:collapse;">'
        + _deliverooStep('1', '#FFD700', 'Commande reçue ✅', 'Votre paiement est sécurisé par GENESIS SAFE™.')
        + _deliverooStep('2', '#00ccbc', 'Confirmation (sous 24h) 🤝', partnerDisplay + ' confirme ou décline — vous êtes alerté(e) par notification et email.')
        + _deliverooStep('3', '#ff9f00', 'Mission en cours 🚀', 'Vous et votre prestataire travaillez et échangez directement via la messagerie.')
        + _deliverooStep('4', '#22cc66', 'Livraison & validation 🏁', 'Une fois que vous recevez vos livrables, le prestataire reçoit son argent.', true)
        + '</table>'
        + '</td></tr>'

        // ── QUESTIONS ───────────────────────────────────────────
        + '<tr><td style="background:#fff;padding:24px 32px;border-bottom:1px solid #eee;text-align:center;">'
        + '<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#1a1a1a;">Des questions sur votre commande ?</p>'
        + '<a href="mailto:contact@fagenesis.com" style="font-size:13px;color:#1a1a1a;font-weight:600;text-decoration:none;">Contactez-nous par email <span style="color:#FFD700;">contact@fagenesis.com</span></a>'
        + '</td></tr>'

        // ── FOOTER ──────────────────────────────────────────────
        + '<tr><td style="background:#f5f5f5;padding:20px 32px;border-radius:0 0 12px 12px;text-align:center;">'
        + '<p style="margin:0 0 6px;font-size:12px;color:#999;">Votre numéro de commande FA GENESIS est <strong>' + orderRef + '</strong>.</p>'
        + '<p style="margin:0 0 10px;font-size:12px;color:#999;">FA GENESIS — Groupe FA Industries, fagenesis.com</p>'
        + '<p style="margin:0;font-size:11px;color:#bbb;">Cet email est envoyé automatiquement. Merci de ne pas y répondre directement.</p>'
        + '</td></tr>'

        + '</table>'
        + '</td></tr></table>'
        + '</body></html>';

    try {
        var result = await transport.sendMail({
            from: '"FA GENESIS" <' + (process.env.EMAIL_FROM_ADDRESS || 'contact@fagenesis.com') + '>',
            to: clientEmail,
            subject: '🎉 Commande réussie !',
            html: html
        });
        console.log('[EMAIL] Confirmation commande partenaire envoyée à ' + clientEmail);
        return { success: true, messageId: result.messageId };
    } catch (err) {
        console.error('[EMAIL] Erreur confirmation commande partenaire:', err.message);
        return { success: false, error: err.message };
    }
}

function _deliverooStep(num, color, title, desc, isLast) {
    return '<tr>'
        + '<td style="vertical-align:top;width:32px;padding:0 12px 0 0;">'
        + '<div style="width:28px;height:28px;border-radius:50%;background:' + color + ';text-align:center;line-height:28px;font-size:12px;font-weight:900;color:#fff;">' + num + '</div>'
        + (isLast ? '' : '<div style="width:2px;background:#eee;height:24px;margin:4px auto;"></div>')
        + '</td>'
        + '<td style="vertical-align:top;padding-bottom:' + (isLast ? '0' : '14') + 'px;">'
        + '<div style="font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:3px;">' + title + '</div>'
        + '<div style="font-size:12px;color:#777;line-height:1.5;">' + desc + '</div>'
        + '</td>'
        + '</tr>';
}

function _emailStep(num, color, icon, title, desc, isLast) {
    return '<div style="display:flex;align-items:flex-start;margin-bottom:' + (isLast ? '0' : '18') + 'px;">'
        + '<table role="presentation"><tr>'
        + '<td style="vertical-align:top;padding-right:14px;">'
        + '<div style="width:32px;height:32px;border-radius:50%;background:' + color + ';display:flex;align-items:center;justify-content:center;font-size:15px;text-align:center;line-height:32px;">' + icon + '</div>'
        + (isLast ? '' : '<div style="width:2px;background:#2a2a2a;height:100%;margin:4px auto 0;min-height:16px;"></div>')
        + '</td>'
        + '<td style="vertical-align:top;padding-top:4px;">'
        + '<div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:3px;">' + title + '</div>'
        + '<div style="font-size:12px;color:#888;line-height:1.5;">' + desc + '</div>'
        + '</td>'
        + '</tr></table>'
        + '</div>';
}

/**
 * Envoyer une notification email pour un feedback urgent (note ≤ 2 ou catégorie Site/Bug)
 * @param {Object} feedback - L'objet feedback complet
 */
async function sendUrgentFeedbackNotification(feedback) {
    var transport = initializeTransporter();
    if (!transport) {
        console.log('[EMAIL] Transport non configure - Feedback urgent non envoye');
        return;
    }

    var stars = '';
    for (var s = 0; s < 5; s++) {
        stars += s < (feedback.rating || 0) ? '\u2605' : '\u2606';
    }

    var isUrgent = (feedback.rating <= 2) || (feedback.category === 'Site/Bug');
    var urgentLabel = isUrgent ? '[URGENT] ' : '';

    var html = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
        + '<div style="background:#000;padding:20px;text-align:center;">'
        + '<h1 style="color:#FFD700;font-size:24px;margin:0;">FA GENESIS</h1>'
        + '</div>'
        + '<div style="background:' + (isUrgent ? '#ff6b6b' : '#fff3cd') + ';padding:16px;text-align:center;">'
        + '<h2 style="margin:0;color:#000;font-size:18px;">' + urgentLabel + 'Nouveau feedback client</h2>'
        + '</div>'
        + '<div style="background:#fff;padding:24px;border:1px solid #ddd;">'
        + '<table style="width:100%;border-collapse:collapse;">'
        + '<tr><td style="padding:8px;font-weight:700;color:#555;width:40%;">Client</td><td style="padding:8px;">' + (feedback.userName || 'Inconnu') + ' (' + (feedback.userEmail || '') + ')</td></tr>'
        + '<tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:700;color:#555;">Offre</td><td style="padding:8px;">' + (feedback.offerName || 'N/A') + '</td></tr>'
        + '<tr><td style="padding:8px;font-weight:700;color:#555;">Note</td><td style="padding:8px;font-size:20px;">' + stars + ' (' + (feedback.rating || 0) + '/5)</td></tr>'
        + '<tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:700;color:#555;">Cat\u00e9gorie</td><td style="padding:8px;">' + (feedback.category || '') + '</td></tr>'
        + '<tr><td style="padding:8px;font-weight:700;color:#555;">Retour</td><td style="padding:8px;">' + (feedback.feedbackText || '').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</td></tr>'
        + (feedback.suggestionText ? '<tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:700;color:#555;">Suggestion</td><td style="padding:8px;">' + (feedback.suggestionText || '').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</td></tr>' : '')
        + '</table>'
        + '<div style="margin-top:20px;padding:12px;background:#000;text-align:center;">'
        + '<a href="https://fagenesis.com/admin.html" style="color:#FFD700;font-weight:700;">Voir dans l\'espace admin \u2192</a>'
        + '</div></div></div>';

    try {
        await transport.sendMail({
            from: '"FA GENESIS" <contact@fagenesis.com>',
            to: 'contact@fagenesis.com',
            subject: urgentLabel + 'Feedback ' + (feedback.rating || '?') + '/5 - ' + (feedback.category || '') + ' - ' + (feedback.userName || ''),
            html: html
        });
        console.log('[EMAIL] Feedback urgent envoye pour:', feedback.userEmail);
    } catch (err) {
        console.error('[EMAIL] Erreur envoi feedback urgent:', err.message);
    }
}

// ============================================================
// RAPPEL MENSUALITÉ → CLIENT
// ============================================================

async function sendInstallmentReminderEmail(clientEmail, clientFirstName, order, installment, isOverdue) {
    var transport = initializeTransporter();
    if (!transport) return;
    try {
        var isOD = isOverdue === true;
        var dueDateFr = installment.due_date
            ? new Date(installment.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
            : 'N/A';
        var accentColor = isOD ? '#ef4444' : '#FFD700';
        var icon = isOD ? '⚠️' : '📅';
        var headline = isOD ? 'Mensualité en retard' : 'Rappel de mensualité';
        var subline = isOD
            ? 'Une mensualité était due le <strong>' + dueDateFr + '</strong> et n\'a pas encore été réglée.'
            : 'Une mensualité arrive à échéance le <strong>' + dueDateFr + '</strong>.';
        var html = getEmailTemplate(
            '<div style="text-align:center;font-size:52px;margin-bottom:16px;">' + icon + '</div>'
            + '<h2 style="color:' + accentColor + ';font-size:20px;font-weight:900;text-transform:uppercase;text-align:center;margin:0 0 24px;">' + headline + '</h2>'
            + '<p style="color:#fff;font-size:15px;margin:0 0 8px;">Bonjour <strong>' + (clientFirstName || 'Client') + '</strong>,</p>'
            + '<p style="color:#ccc;font-size:14px;margin:0 0 24px;">' + subline + '</p>'
            + '<div style="background:#1a1a1a;border:2px solid ' + accentColor + ';padding:20px;margin-bottom:24px;">'
            +   '<div style="font-size:13px;font-weight:900;color:' + accentColor + ';text-transform:uppercase;margin-bottom:8px;">' + (installment.label || 'Mensualité') + '</div>'
            +   '<div style="font-size:32px;font-weight:900;color:#fff;">' + installment.amount + ' €</div>'
            +   '<div style="font-size:12px;color:#888;margin-top:6px;">Prestation : ' + (order.product_name || '') + '</div>'
            + '</div>'
            + '<div style="text-align:center;margin-bottom:24px;">'
            +   '<a href="' + (process.env.SITE_URL || 'https://fagenesis.com') + '/app.html#open-reservations" style="display:inline-block;background:' + accentColor + ';color:#000;font-weight:900;font-size:14px;padding:14px 36px;text-decoration:none;text-transform:uppercase;border:2px solid #000;">Régler maintenant →</a>'
            + '</div>'
            + '<p style="color:#555;font-size:12px;text-align:center;margin:0;">Rendez-vous dans votre espace <strong>Réservations</strong>.</p>',
            headline + ' — FA GENESIS'
        );
        await transport.sendMail({
            from: '"FA GENESIS" <' + (process.env.EMAIL_FROM_ADDRESS || 'contact@fagenesis.com') + '>',
            to: clientEmail,
            subject: (isOD ? '⚠️ ' : '📅 ') + headline + ' — ' + (installment.amount || '') + ' € (' + (installment.label || '') + ')',
            html: html
        });
        console.log('[EMAIL] Rappel mensualité envoyé à', clientEmail, '(' + (isOD ? 'retard' : 'à venir') + ')');
    } catch(err) {
        console.error('[EMAIL] sendInstallmentReminderEmail:', err.message);
    }
}

