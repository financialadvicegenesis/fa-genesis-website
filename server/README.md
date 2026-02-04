# FA GENESIS - Backend SumUp

Backend Node.js pour l'integration des paiements SumUp.

## Architecture

```
fa-genesis-landing/
├── server/                    # Backend Node.js
│   ├── server.js              # Serveur Express principal
│   ├── products.js            # Configuration des produits (prix)
│   ├── package.json           # Dependances
│   ├── .env                   # Configuration (CLE API ICI)
│   ├── .env.example           # Template de configuration
│   └── data/                  # Stockage des commandes
│       └── orders.json        # Commandes (auto-genere)
│
├── checkout.html              # Page de paiement (frontend)
├── payment-success.html       # Page de succes
└── payment-cancel.html        # Page d'annulation
```

## Installation

### 1. Installer les dependances

```bash
cd server
npm install
```

### 2. Configurer la cle API SumUp

**IMPORTANT**: Ne jamais commiter votre vraie cle API !

1. Ouvrez le fichier `server/.env`
2. Remplacez les valeurs par vos vraies informations SumUp:

```env
# Votre cle API SumUp (depuis https://developer.sumup.com)
SUMUP_API_KEY=votre_cle_api_ici

# Votre Merchant Code (depuis votre dashboard SumUp)
SUMUP_MERCHANT_CODE=votre_merchant_code_ici

# Email de votre compte SumUp
SUMUP_PAY_TO_EMAIL=votre-email@example.com
```

### 3. Ou trouver ces informations ?

#### Cle API (SUMUP_API_KEY)
1. Allez sur https://developer.sumup.com
2. Connectez-vous avec votre compte SumUp
3. Creez une nouvelle application ou utilisez une existante
4. Dans les parametres de l'application, recuperez l'"Access Token"

#### Merchant Code (SUMUP_MERCHANT_CODE)
1. Allez sur https://me.sumup.com
2. Connectez-vous
3. Allez dans Parametres > Profil commercial
4. Votre Merchant Code y est affiche

## Demarrage

### Terminal 1 - Backend (port 3001)

```bash
cd server
npm start
```

Vous devriez voir:
```
=================================================
   FA GENESIS - Backend SumUp
=================================================
   Serveur demarre sur http://localhost:3001
   Mode: sandbox
```

### Terminal 2 - Frontend (Live Server)

1. Ouvrez VS Code dans le dossier `fa-genesis-landing`
2. Clic droit sur `index.html` > "Open with Live Server"
3. Live Server ouvrira http://127.0.0.1:5500

## Test du flux de paiement

1. Allez sur http://127.0.0.1:5500/fa-genesis-landing/offres.html
2. Cliquez sur "Souscrire" sur une offre
3. Remplissez le formulaire de checkout
4. Cliquez sur "Continuer vers le paiement SumUp"
5. Vous serez redirige vers la page de paiement SumUp
6. Apres paiement, retour sur la page de succes

## Endpoints API

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/health` | Verifier l'etat du serveur |
| GET | `/api/products` | Liste des produits avec prix |
| GET | `/api/products/:id` | Details d'un produit |
| POST | `/api/orders/create` | Creer une commande |
| GET | `/api/orders/:id` | Details d'une commande |
| POST | `/api/payments/sumup/create-checkout` | Creer un checkout SumUp |
| POST | `/api/payments/sumup/webhook` | Webhook SumUp |
| POST | `/api/payments/verify` | Verifier un paiement |

## Securite

### Ce qui est cote serveur (securise)
- Cle API SumUp
- Calcul des prix (30%/70%)
- Creation des checkouts
- Verification des paiements

### Ce qui est cote client (frontend)
- ID du produit choisi
- Informations client (nom, email...)
- Redirection vers SumUp

### Le frontend n'a JAMAIS acces a:
- La cle API
- La modification des prix
- Les donnees bancaires

## Webhook SumUp (Production)

En production, configurez le webhook dans votre dashboard SumUp:

1. Allez sur https://developer.sumup.com
2. Dans votre application > Webhooks
3. Ajoutez l'URL: `https://votre-domaine.com/api/payments/sumup/webhook`
4. Selectionnez les evenements: `CHECKOUT.PAID`, `CHECKOUT.FAILED`

## Mode Sandbox vs Production

Dans `.env`:
- `SUMUP_MODE=sandbox` : Mode test (pas de vrais paiements)
- `SUMUP_MODE=production` : Mode reel (vrais paiements)

## Problemes courants

### "SUMUP_API_KEY non configuree"
-> Verifiez que vous avez rempli le fichier `.env`

### "CORS error" dans la console
-> Verifiez que le backend tourne sur le port 3001

### "Impossible de contacter le serveur"
-> Lancez le backend avec `cd server && npm start`

### "Produit introuvable"
-> Verifiez que l'ID du produit existe dans `products.js`

## Support

Email: financialadvicegenesis@gmail.com

---

**FA GENESIS - Groupe FA Industries**
