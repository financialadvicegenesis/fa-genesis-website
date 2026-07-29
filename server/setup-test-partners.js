/**
 * Script de création des comptes de test prestataire par niveau GENESIS
 * Usage : node server/setup-test-partners.js
 * À exécuter une seule fois depuis le shell Render (ou en local).
 *
 * Le badge prestataire est CALCULÉ dynamiquement (missions + note), pas stocké.
 * Ce script crée donc aussi les payouts (missions) et avis (note) nécessaires.
 *
 * Tiers :
 *   Sans badge  :  0 missions, 0 avis
 *   Bronze      :  5 missions, note moy. ≥ 4.0
 *   Argent      : 20 missions, note moy. ≥ 4.3
 *   Or          : 50 missions, note moy. ≥ 4.5
 *   Élite       :100 missions, note moy. ≥ 5.0
 */

'use strict';

var path   = require('path');
var fs     = require('fs');
var bcrypt = require('bcryptjs');
var crypto = require('crypto');

var DATA_DIR           = path.join(__dirname, 'data');
var PARTNERS_FILE      = path.join(DATA_DIR, 'partners.json');
var PAYOUTS_FILE       = path.join(DATA_DIR, 'payouts.json');
var REVIEWS_FILE       = path.join(DATA_DIR, 'partner_reviews.json');

function load(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e) { return []; }
}
function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}
function genId(prefix) {
  return (prefix || 'PRT') + '-TEST-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}
function now() { return new Date().toISOString(); }

// ── Comptes de test ────────────────────────────────────────────────────────────
var TEST_PARTNERS = [
  {
    label:        'Nouveau prestataire (sans badge)',
    email:        'test-prt-nouveau@fagenesis.com',
    password:     'TestPrtNouveau2026!',
    prenom:       'Alex',
    nom:          'Nouveau',
    partner_type: 'photographer',
    city:         'Paris',
    bio:          'Photographe test — compte sans badge (0 mission).',
    missions:     0,    // payouts balance à créer
    reviews:      []    // [{rating, count}]
  },
  {
    label:        'Prestataire Bronze (5 missions, note 4.0)',
    email:        'test-prt-bronze@fagenesis.com',
    password:     'TestPrtBronze2026!',
    prenom:       'Marie',
    nom:          'Bronze',
    partner_type: 'videographer',
    city:         'Lyon',
    bio:          'Vidéaste test — compte Bronze (5 missions, note 4.0).',
    missions:     5,
    reviews:      [{ rating: 4, count: 5 }]   // 5×4 = avg 4.0
  },
  {
    label:        'Prestataire Argent (20 missions, note 4.3)',
    email:        'test-prt-argent@fagenesis.com',
    password:     'TestPrtArgent2026!',
    prenom:       'Jean',
    nom:          'Argent',
    partner_type: 'marketer',
    city:         'Bordeaux',
    bio:          'Marketeur test — compte Argent (20 missions, note 4.3).',
    missions:     20,
    reviews:      [{ rating: 5, count: 6 }, { rating: 4, count: 14 }]  // (30+56)/20 = 4.3
  },
  {
    label:        'Prestataire Or (50 missions, note 4.5)',
    email:        'test-prt-or@fagenesis.com',
    password:     'TestPrtOr2026!',
    prenom:       'Sarah',
    nom:          'Or',
    partner_type: 'graphiste',
    city:         'Marseille',
    bio:          'Graphiste test — compte Or (50 missions, note 4.5).',
    missions:     50,
    reviews:      [{ rating: 5, count: 25 }, { rating: 4, count: 25 }]  // (125+100)/50 = 4.5
  },
  {
    label:        'Prestataire Élite (100 missions, note 5.0)',
    email:        'test-prt-elite@fagenesis.com',
    password:     'TestPrtElite2026!',
    prenom:       'Lucas',
    nom:          'Elite',
    partner_type: 'photographer',
    city:         'Paris',
    bio:          'Photographe test — compte Élite (100 missions, note 5.0).',
    missions:     100,
    reviews:      [{ rating: 5, count: 100 }]
  }
];

// ── Services pré-définis par type (repris de LEGACY_SERVICE_CATALOG) ───────────
var SERVICE_CATALOG = {
  photographer: [
    { label: 'Shooting portrait', price: 150 },
    { label: 'Reportage événement', price: 300 }
  ],
  videographer: [
    { label: 'Vidéo corporate courte', price: 350 },
    { label: 'Clip promotionnel', price: 500 }
  ],
  marketer: [
    { label: 'Audit marketing rapide', price: 120 },
    { label: 'Stratégie marketing complète', price: 350 }
  ],
  graphiste: [
    { label: 'Logo & identité visuelle', price: 200 },
    { label: 'Pack réseaux sociaux', price: 150 }
  ]
};

async function main() {
  var partners = load(PARTNERS_FILE);
  var payouts  = load(PAYOUTS_FILE);
  var reviews  = load(REVIEWS_FILE);

  var created = [];
  var updated = [];

  for (var i = 0; i < TEST_PARTNERS.length; i++) {
    var acc = TEST_PARTNERS[i];
    var email = acc.email.toLowerCase();
    var existingIdx = partners.findIndex(function(p) { return (p.email || '').toLowerCase() === email; });

    var partnerId;

    if (existingIdx !== -1) {
      // Compte existant : mettre à jour les champs de base uniquement
      partnerId = partners[existingIdx].id;
      partners[existingIdx].updatedAt = now();
      updated.push(acc.label + ' (' + email + ') — partenaire existant mis à jour');
    } else {
      partnerId = genId();
      var hash = await bcrypt.hash(acc.password, 10);
      var services = (SERVICE_CATALOG[acc.partner_type] || []).map(function(s) {
        return { id: 'SVC-TEST-' + crypto.randomBytes(3).toString('hex').toUpperCase(), label: s.label, price: s.price, description: '', active: true };
      });
      partners.push({
        id:                partnerId,
        prenom:            acc.prenom,
        nom:               acc.nom,
        email:             email,
        telephone:         '',
        city:              acc.city,
        password:          hash,
        partner_type:      acc.partner_type,
        partner_type_other:'',
        company:           '',
        bio:               acc.bio,
        services:          services,
        sessionToken:      crypto.randomBytes(32).toString('hex'),
        accountStatus:     'active',
        contract_signed:   true,
        contract_signed_at:now(),
        referredBy:        null,
        founderBadge:      false,
        avgResponseMinutes:null,
        createdAt:         now(),
        updatedAt:         now(),
        lastLogin:         now(),
        createdBy:         'setup-test-partners'
      });
      created.push(acc.label + ' (' + email + ')');
    }

    // ── Payouts (missions complétées) ─────────────────────────────────────────
    // Supprimer les anciens payouts de test pour ce partenaire
    payouts = payouts.filter(function(p) { return p.partner_id !== partnerId || p._test !== true; });
    for (var m = 0; m < acc.missions; m++) {
      payouts.push({
        id:         'PAY-TEST-' + partnerId.slice(-8) + '-' + (m + 1),
        partner_id: partnerId,
        order_id:   'ORD-TEST-' + partnerId.slice(-8) + '-' + (m + 1),
        stage:      'balance',
        amount:     120,
        status:     'sent',
        created_at: now(),
        _test:      true
      });
    }

    // ── Reviews (avis publiés) ────────────────────────────────────────────────
    // Supprimer les anciens avis de test pour ce partenaire
    reviews = reviews.filter(function(r) { return r.partnerId !== partnerId || r._test !== true; });
    var reviewN = 0;
    for (var ri = 0; ri < acc.reviews.length; ri++) {
      var group = acc.reviews[ri];
      for (var rj = 0; rj < group.count; rj++) {
        reviewN++;
        reviews.push({
          id:        'REV-TEST-' + partnerId.slice(-8) + '-' + reviewN,
          partnerId: partnerId,
          rating:    group.rating,
          comment:   'Avis de test #' + reviewN,
          status:    'published',
          createdAt: now(),
          _test:     true
        });
      }
    }
  }

  save(PARTNERS_FILE, partners);
  save(PAYOUTS_FILE, payouts);
  save(REVIEWS_FILE, reviews);

  console.log('\n✅ Comptes de test prestataire GENESIS créés / mis à jour\n');
  console.log('━'.repeat(60));

  if (created.length) {
    console.log('\n🆕 Créés :');
    created.forEach(function(l) { console.log('   • ' + l); });
  }
  if (updated.length) {
    console.log('\n♻️  Mis à jour :');
    updated.forEach(function(l) { console.log('   • ' + l); });
  }

  console.log('\n━'.repeat(60));
  console.log('\n🔑 IDENTIFIANTS DE CONNEXION (tableau de bord prestataire)\n');
  TEST_PARTNERS.forEach(function(acc) {
    var badge = acc.missions === 0   ? 'aucun'
              : acc.missions >= 100  ? 'Élite'
              : acc.missions >= 50   ? 'Or'
              : acc.missions >= 20   ? 'Argent'
                                     : 'Bronze';
    console.log('  ' + acc.label);
    console.log('  Email        : ' + acc.email);
    console.log('  Mot de passe : ' + acc.password);
    console.log('  Badge        : ' + badge + ' (' + acc.missions + ' mission(s))');
    console.log('  URL          : https://fagenesis.com/app.html#open-partner');
    console.log('');
  });
  console.log('━'.repeat(60));
  console.log('\n⚠️  Ces comptes sont réservés aux tests internes.');
  console.log('   Les payouts et avis créés sont marqués _test:true.');
  console.log('   Supprimez-les avant l\'ouverture publique si souhaité.\n');
}

main().catch(function(e) { console.error('Erreur :', e.message); process.exit(1); });
