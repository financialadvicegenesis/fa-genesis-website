# Architecture Serveur pour Integration SumUp - FA GENESIS

## Vue d'ensemble

L'integration complete de SumUp necessite un backend serveur pour:
- Stocker les cles API de maniere securisee
- Creer les sessions de paiement (checkouts)
- Recevoir et traiter les webhooks
- Verifier le statut des paiements

## Architecture recommandee

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client Web    │────▶│  Backend API    │────▶│   SumUp API     │
│  (Navigateur)   │◀────│  (Node.js)      │◀────│                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   Base de       │
                        │   donnees       │
                        └─────────────────┘
```

## Fichiers du projet

### Frontend (deja crees)
- `checkout.html` - Page de checkout avec formulaire client
- `payment-success.html` - Page de succes apres paiement
- `payment-cancel.html` - Page d'annulation
- `orders-system.js` - Gestion des commandes (localStorage pour le moment)
- `sumup-integration.js` - Module d'integration SumUp cote client

### Backend a creer

#### 1. Configuration de l'environnement

```env
# .env
SUMUP_API_KEY=your_sumup_api_key
SUMUP_MERCHANT_CODE=your_merchant_code
SUMUP_PAY_TO_EMAIL=votre-email@fagenesis.com
NODE_ENV=development
PORT=3000
DATABASE_URL=your_database_url
```

#### 2. Structure du backend Node.js

```
backend/
├── server.js
├── routes/
│   ├── checkout.js
│   ├── webhooks.js
│   └── orders.js
├── services/
│   ├── sumup.js
│   └── orders.js
├── models/
│   └── order.js
└── middleware/
    └── auth.js
```

#### 3. Endpoints API requis

| Methode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/checkout/create` | Creer un checkout SumUp |
| GET | `/api/checkout/:id/status` | Verifier le statut |
| POST | `/api/webhooks/sumup` | Recevoir les notifications |
| GET | `/api/orders/:id` | Recuperer une commande |
| PUT | `/api/orders/:id/payment` | Enregistrer un paiement |

## Integration SumUp - Details techniques

### 1. Creation d'un Checkout

```javascript
// POST /api/checkout/create
const createCheckout = async (orderData) => {
    const response = await fetch('https://api.sumup.com/v0.1/checkouts', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.SUMUP_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            checkout_reference: orderData.orderId,
            amount: orderData.amount,
            currency: 'EUR',
            pay_to_email: process.env.SUMUP_PAY_TO_EMAIL,
            description: orderData.description,
            return_url: `${process.env.FRONTEND_URL}/payment-success.html?order=${orderData.orderId}`,
            merchant_code: process.env.SUMUP_MERCHANT_CODE
        })
    });
    return response.json();
};
```

### 2. Configuration des Webhooks

Dans votre dashboard SumUp, configurez:
- URL: `https://votre-domaine.com/api/webhooks/sumup`
- Events: `CHECKOUT.COMPLETED`, `CHECKOUT.PAID`, `CHECKOUT.FAILED`

```javascript
// POST /api/webhooks/sumup
app.post('/api/webhooks/sumup', async (req, res) => {
    const { event_type, checkout_reference, transaction_id } = req.body;

    switch (event_type) {
        case 'CHECKOUT.PAID':
            await OrderService.markAsPaid(checkout_reference, transaction_id);
            break;
        case 'CHECKOUT.FAILED':
            await OrderService.markAsFailed(checkout_reference);
            break;
    }

    res.status(200).send('OK');
});
```

### 3. Verification du statut

```javascript
// GET /api/checkout/:id/status
const getCheckoutStatus = async (checkoutId) => {
    const response = await fetch(
        `https://api.sumup.com/v0.1/checkouts/${checkoutId}`,
        {
            headers: {
                'Authorization': `Bearer ${process.env.SUMUP_API_KEY}`
            }
        }
    );
    return response.json();
};
```

## Base de donnees recommandee

### Schema Order

```sql
CREATE TABLE orders (
    id VARCHAR(50) PRIMARY KEY,
    customer_email VARCHAR(255) NOT NULL,
    customer_first_name VARCHAR(100),
    customer_last_name VARCHAR(100),
    customer_phone VARCHAR(20),
    customer_company VARCHAR(255),
    offer_id VARCHAR(50) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    deposit_amount DECIMAL(10,2) NOT NULL,
    balance_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payments (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50) REFERENCES orders(id),
    amount DECIMAL(10,2) NOT NULL,
    type VARCHAR(20), -- 'deposit' ou 'balance'
    method VARCHAR(50), -- 'sumup'
    transaction_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Options d'hebergement

### Option 1: Vercel + PostgreSQL (Recommande pour debuter)
- Frontend: Vercel (gratuit)
- Backend: Vercel Serverless Functions
- BDD: Vercel Postgres ou Supabase

### Option 2: Railway
- Tout-en-un avec PostgreSQL inclus
- Deploiement simple depuis GitHub

### Option 3: Heroku
- Dyno + PostgreSQL addon
- Configuration facile

### Option 4: VPS (OVH, DigitalOcean)
- Plus de controle
- Necessite plus de configuration

## Flux de paiement complet

```
1. Client remplit le formulaire checkout.html
   ↓
2. Frontend envoie les donnees au backend
   POST /api/checkout/create
   ↓
3. Backend cree la commande en BDD
   ↓
4. Backend appelle SumUp pour creer le checkout
   ↓
5. Backend retourne l'URL de paiement SumUp
   ↓
6. Client est redirige vers SumUp
   ↓
7. Client complete le paiement sur SumUp
   ↓
8. SumUp redirige vers payment-success.html
   ↓
9. SumUp envoie un webhook au backend
   ↓
10. Backend met a jour la commande en BDD
    ↓
11. Frontend affiche la confirmation
```

## Securite

### Cles API
- Jamais exposees cote client
- Stockees dans des variables d'environnement
- Differentes pour sandbox et production

### Webhooks
- Valider la signature SumUp
- Utiliser HTTPS uniquement
- Logger toutes les transactions

### CORS
```javascript
app.use(cors({
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT'],
    credentials: true
}));
```

## Compte SumUp requis

1. Creer un compte sur [sumup.com](https://sumup.com)
2. Acceder au [Developer Portal](https://developer.sumup.com)
3. Creer une application pour obtenir les cles API
4. Configurer les webhooks
5. Tester en mode sandbox avant la production

## Migration vers la production

1. [ ] Creer le backend avec les endpoints
2. [ ] Configurer la base de donnees
3. [ ] Obtenir les cles API SumUp production
4. [ ] Mettre a jour les URLs dans le frontend
5. [ ] Configurer les webhooks en production
6. [ ] Tester le flux complet
7. [ ] Deployer

## Support

Pour toute question technique:
- Documentation SumUp: https://developer.sumup.com/docs/
- Email FA Genesis: financialadvicegenesis@gmail.com

---

**Version**: 1.0
**Date**: Fevrier 2025
**FA GENESIS - Groupe FA Industries**
