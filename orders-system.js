// Système de gestion des commandes FA GENESIS
// Gère la création, le suivi et le statut des commandes

console.log('Chargement de orders-system.js');

/**
 * Statuts de commande possibles
 */
const ORDER_STATUS = {
    PENDING: 'pending',           // En attente de paiement
    DEPOSIT_PAID: 'deposit_paid', // Acompte payé
    IN_PROGRESS: 'in_progress',   // En cours de réalisation
    READY: 'ready',               // Prêt pour livraison
    BALANCE_PENDING: 'balance_pending', // En attente du solde
    COMPLETED: 'completed',       // Commande terminée
    CANCELLED: 'cancelled'        // Commande annulée
};

/**
 * Classe Order pour représenter une commande
 */
class Order {
    constructor(customerInfo, offerId) {
        this.id = this.generateOrderId();
        this.customerInfo = customerInfo; // { firstName, lastName, email, phone, company }
        this.offerId = offerId;
        this.offer = getOfferById(offerId);
        this.status = ORDER_STATUS.PENDING;
        this.createdAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        this.payments = [];
        this.notes = [];
        this.deliverables = [];
    }

    generateOrderId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `ORD-${timestamp}-${random}`.toUpperCase();
    }

    /**
     * Obtenir le montant total de la commande
     */
    getTotalAmount() {
        return this.offer ? this.offer.prixTotal : 0;
    }

    /**
     * Obtenir le montant de l'acompte
     */
    getDepositAmount() {
        return this.offer ? this.offer.acompte : 0;
    }

    /**
     * Obtenir le montant du solde
     */
    getBalanceAmount() {
        return this.offer ? this.offer.solde : 0;
    }

    /**
     * Obtenir le total payé
     */
    getTotalPaid() {
        return this.payments.reduce((sum, p) => sum + p.amount, 0);
    }

    /**
     * Obtenir le reste à payer
     */
    getRemainingAmount() {
        return this.getTotalAmount() - this.getTotalPaid();
    }
}

/**
 * Gestionnaire de commandes
 */
const OrdersManager = {
    STORAGE_KEY: 'fa_genesis_orders',

    /**
     * Récupérer toutes les commandes
     */
    getAll() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    },

    /**
     * Sauvegarder toutes les commandes
     */
    saveAll(orders) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(orders));
    },

    /**
     * Créer une nouvelle commande
     */
    create(customerInfo, offerId) {
        const orders = this.getAll();
        const order = new Order(customerInfo, offerId);
        orders.push(order);
        this.saveAll(orders);
        console.log('Commande créée:', order.id);
        return order;
    },

    /**
     * Récupérer une commande par son ID
     */
    getById(orderId) {
        const orders = this.getAll();
        return orders.find(o => o.id === orderId) || null;
    },

    /**
     * Récupérer les commandes d'un client par email
     */
    getByEmail(email) {
        const orders = this.getAll();
        return orders.filter(o => o.customerInfo.email === email);
    },

    /**
     * Mettre à jour le statut d'une commande
     */
    updateStatus(orderId, newStatus) {
        const orders = this.getAll();
        const index = orders.findIndex(o => o.id === orderId);

        if (index === -1) {
            console.error('Commande non trouvée:', orderId);
            return null;
        }

        orders[index].status = newStatus;
        orders[index].updatedAt = new Date().toISOString();
        this.saveAll(orders);

        console.log('Statut commande mis à jour:', orderId, newStatus);
        return orders[index];
    },

    /**
     * Ajouter un paiement à une commande
     */
    addPayment(orderId, paymentData) {
        const orders = this.getAll();
        const index = orders.findIndex(o => o.id === orderId);

        if (index === -1) {
            console.error('Commande non trouvée:', orderId);
            return null;
        }

        const payment = {
            id: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`.toUpperCase(),
            amount: paymentData.amount,
            type: paymentData.type, // 'deposit' ou 'balance'
            method: paymentData.method, // 'sumup', 'card', 'transfer'
            transactionId: paymentData.transactionId || null,
            status: paymentData.status || 'completed',
            date: new Date().toISOString()
        };

        orders[index].payments.push(payment);
        orders[index].updatedAt = new Date().toISOString();

        // Mettre à jour le statut de la commande si nécessaire
        if (paymentData.type === 'deposit') {
            orders[index].status = ORDER_STATUS.DEPOSIT_PAID;
        } else if (paymentData.type === 'balance') {
            orders[index].status = ORDER_STATUS.COMPLETED;
        }

        this.saveAll(orders);
        console.log('Paiement ajouté à la commande:', orderId, payment);
        return orders[index];
    },

    /**
     * Ajouter une note à une commande
     */
    addNote(orderId, noteText, author = 'System') {
        const orders = this.getAll();
        const index = orders.findIndex(o => o.id === orderId);

        if (index === -1) return null;

        orders[index].notes.push({
            id: Date.now(),
            text: noteText,
            author: author,
            date: new Date().toISOString()
        });
        orders[index].updatedAt = new Date().toISOString();
        this.saveAll(orders);

        return orders[index];
    },

    /**
     * Ajouter un livrable à une commande
     */
    addDeliverable(orderId, deliverableData) {
        const orders = this.getAll();
        const index = orders.findIndex(o => o.id === orderId);

        if (index === -1) return null;

        orders[index].deliverables.push({
            id: Date.now(),
            name: deliverableData.name,
            type: deliverableData.type, // 'document', 'video', 'photo', etc.
            url: deliverableData.url || null,
            status: deliverableData.status || 'pending', // 'pending', 'ready', 'delivered'
            addedAt: new Date().toISOString()
        });
        orders[index].updatedAt = new Date().toISOString();
        this.saveAll(orders);

        return orders[index];
    },

    /**
     * Récupérer les commandes par statut
     */
    getByStatus(status) {
        const orders = this.getAll();
        return orders.filter(o => o.status === status);
    },

    /**
     * Récupérer les statistiques des commandes
     */
    getStats() {
        const orders = this.getAll();
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();

        const thisMonthOrders = orders.filter(o => {
            const date = new Date(o.createdAt);
            return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
        });

        const totalRevenue = orders.reduce((sum, o) => {
            return sum + o.payments.reduce((pSum, p) => pSum + p.amount, 0);
        }, 0);

        const thisMonthRevenue = thisMonthOrders.reduce((sum, o) => {
            return sum + o.payments.reduce((pSum, p) => pSum + p.amount, 0);
        }, 0);

        return {
            totalOrders: orders.length,
            thisMonthOrders: thisMonthOrders.length,
            pendingOrders: orders.filter(o => o.status === ORDER_STATUS.PENDING).length,
            completedOrders: orders.filter(o => o.status === ORDER_STATUS.COMPLETED).length,
            totalRevenue: totalRevenue,
            thisMonthRevenue: thisMonthRevenue,
            averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0
        };
    },

    /**
     * Annuler une commande
     */
    cancel(orderId, reason = '') {
        const orders = this.getAll();
        const index = orders.findIndex(o => o.id === orderId);

        if (index === -1) return null;

        orders[index].status = ORDER_STATUS.CANCELLED;
        orders[index].updatedAt = new Date().toISOString();

        if (reason) {
            orders[index].notes.push({
                id: Date.now(),
                text: `Commande annulée: ${reason}`,
                author: 'System',
                date: new Date().toISOString()
            });
        }

        this.saveAll(orders);
        console.log('Commande annulée:', orderId);
        return orders[index];
    },

    /**
     * Supprimer une commande (admin uniquement)
     */
    delete(orderId) {
        let orders = this.getAll();
        const initialLength = orders.length;
        orders = orders.filter(o => o.id !== orderId);

        if (orders.length < initialLength) {
            this.saveAll(orders);
            console.log('Commande supprimée:', orderId);
            return true;
        }
        return false;
    }
};

/**
 * Fonctions utilitaires pour le checkout
 */
const CheckoutUtils = {
    /**
     * Valider les informations client
     */
    validateCustomerInfo(info) {
        const errors = [];

        if (!info.firstName || info.firstName.trim().length < 2) {
            errors.push('Le prénom est requis (min. 2 caractères)');
        }

        if (!info.lastName || info.lastName.trim().length < 2) {
            errors.push('Le nom est requis (min. 2 caractères)');
        }

        if (!info.email || !this.isValidEmail(info.email)) {
            errors.push('Une adresse email valide est requise');
        }

        if (!info.phone || !this.isValidPhone(info.phone)) {
            errors.push('Un numéro de téléphone valide est requis');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    },

    /**
     * Valider une adresse email
     */
    isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    },

    /**
     * Valider un numéro de téléphone
     */
    isValidPhone(phone) {
        // Accepte les formats: 0612345678, +33612345678, 06 12 34 56 78, etc.
        const cleaned = phone.replace(/[\s\-\.]/g, '');
        const regex = /^(\+33|0)[1-9](\d{8})$/;
        return regex.test(cleaned);
    },

    /**
     * Formater un prix en euros
     */
    formatPrice(amount) {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    },

    /**
     * Obtenir le libellé du statut de commande
     */
    getStatusLabel(status) {
        const labels = {
            [ORDER_STATUS.PENDING]: 'En attente de paiement',
            [ORDER_STATUS.DEPOSIT_PAID]: 'Acompte payé',
            [ORDER_STATUS.IN_PROGRESS]: 'En cours de réalisation',
            [ORDER_STATUS.READY]: 'Prêt pour livraison',
            [ORDER_STATUS.BALANCE_PENDING]: 'En attente du solde',
            [ORDER_STATUS.COMPLETED]: 'Terminée',
            [ORDER_STATUS.CANCELLED]: 'Annulée'
        };
        return labels[status] || 'Statut inconnu';
    },

    /**
     * Obtenir la couleur du statut
     */
    getStatusColor(status) {
        const colors = {
            [ORDER_STATUS.PENDING]: '#FFA500',
            [ORDER_STATUS.DEPOSIT_PAID]: '#4CAF50',
            [ORDER_STATUS.IN_PROGRESS]: '#2196F3',
            [ORDER_STATUS.READY]: '#9C27B0',
            [ORDER_STATUS.BALANCE_PENDING]: '#FF9800',
            [ORDER_STATUS.COMPLETED]: '#4CAF50',
            [ORDER_STATUS.CANCELLED]: '#F44336'
        };
        return colors[status] || '#757575';
    }
};

/**
 * Stocker temporairement les données de checkout en session
 */
const CheckoutSession = {
    STORAGE_KEY: 'fa_genesis_checkout_session',

    /**
     * Créer une session de checkout
     */
    create(offerId) {
        const session = {
            id: `SESS-${Date.now()}`,
            offerId: offerId,
            offer: getOfferById(offerId),
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
        };
        sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
        return session;
    },

    /**
     * Récupérer la session de checkout active
     */
    get() {
        const data = sessionStorage.getItem(this.STORAGE_KEY);
        if (!data) return null;

        const session = JSON.parse(data);

        // Vérifier si la session a expiré
        if (new Date(session.expiresAt) < new Date()) {
            this.clear();
            return null;
        }

        return session;
    },

    /**
     * Mettre à jour la session avec les infos client
     */
    setCustomerInfo(customerInfo) {
        const session = this.get();
        if (!session) return null;

        session.customerInfo = customerInfo;
        sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
        return session;
    },

    /**
     * Effacer la session
     */
    clear() {
        sessionStorage.removeItem(this.STORAGE_KEY);
    }
};

console.log('orders-system.js chargé avec succès');
console.log('Statuts de commande disponibles:', Object.values(ORDER_STATUS));
