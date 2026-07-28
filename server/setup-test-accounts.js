/**
 * Script de création des comptes de test par niveau GENESIS
 * Usage : node server/setup-test-accounts.js
 * À exécuter une seule fois depuis le shell Render (ou en local).
 */

'use strict';

var path    = require('path');
var fs      = require('fs');
var bcrypt  = require('bcryptjs');
var crypto  = require('crypto');

var USERS_FILE = path.join(__dirname, 'data', 'users.json');

function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch(e) { return []; }
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}
function genId() {
  return 'USR-TEST-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

var TEST_ACCOUNTS = [
  {
    label:    'Nouvel utilisateur (40 QG — bonus bienvenue uniquement)',
    email:    'test-nouveau@fagenesis.com',
    password: 'TestNouveau2026!',
    prenom:   'Test',
    nom:      'Nouveau',
    referralBonusQG: 40    // 40 QG → bonus bienvenue seul, aucun niveau
  },
  {
    label:    'Créateur (100 QG)',
    email:    'test-createur@fagenesis.com',
    password: 'TestCreateur2026!',
    prenom:   'Test',
    nom:      'Createur',
    referralBonusQG: 100   // 100 QG → niveau Créateur (bronze)
  },
  {
    label:    'Bâtisseur (300 QG)',
    email:    'test-batisseur@fagenesis.com',
    password: 'TestBatisseur2026!',
    prenom:   'Test',
    nom:      'Batisseur',
    referralBonusQG: 300   // 300 QG → niveau Bâtisseur (argent)
  },
  {
    label:    'Visionnaire (600 QG)',
    email:    'test-visionnaire@fagenesis.com',
    password: 'TestVisionnaire2026!',
    prenom:   'Test',
    nom:      'Visionnaire',
    referralBonusQG: 600   // 600 QG → niveau Visionnaire (or)
  },
  {
    label:    'Générateur (1000 QG)',
    email:    'test-generateur@fagenesis.com',
    password: 'TestGenerateur2026!',
    prenom:   'Test',
    nom:      'Generateur',
    referralBonusQG: 1000  // 1000 QG → niveau Générateur (elite)
  }
];

async function main() {
  var users = loadUsers();
  var created = [];
  var skipped = [];

  for (var i = 0; i < TEST_ACCOUNTS.length; i++) {
    var acc = TEST_ACCOUNTS[i];
    var existing = users.find(function(u) { return (u.email || '').toLowerCase() === acc.email.toLowerCase(); });

    if (existing) {
      // Mettre à jour le referralBonusQG si le compte existe déjà
      existing.referralBonusQG = acc.referralBonusQG;
      existing.updatedAt = new Date().toISOString();
      skipped.push(acc.label + ' (' + acc.email + ') — compte existant mis à jour');
    } else {
      var hash = await bcrypt.hash(acc.password, 10);
      users.push({
        id:               genId(),
        prenom:           acc.prenom,
        nom:              acc.nom,
        email:            acc.email,
        telephone:        null,
        password:         hash,
        accountType:      'particulier',
        offre:            null,
        activeOfferId:    null,
        productType:      null,
        paymentStatus:    'registered',
        referralBonusQG:  acc.referralBonusQG,
        missionBonuses:   {},
        profile_bio:      '',
        profile_theme:    'genesis',
        profile_banner:   null,
        createdAt:        new Date().toISOString(),
        updatedAt:        new Date().toISOString()
      });
      created.push(acc.label + ' (' + acc.email + ')');
    }
  }

  saveUsers(users);

  console.log('\n✅ Comptes de test GENESIS créés / mis à jour\n');
  console.log('━'.repeat(55));

  if (created.length) {
    console.log('\n🆕 Créés :');
    created.forEach(function(l) { console.log('   • ' + l); });
  }
  if (skipped.length) {
    console.log('\n♻️  Mis à jour :');
    skipped.forEach(function(l) { console.log('   • ' + l); });
  }

  console.log('\n━'.repeat(55));
  console.log('\n🔑 IDENTIFIANTS DE CONNEXION\n');
  TEST_ACCOUNTS.forEach(function(acc) {
    console.log('  ' + acc.label);
    console.log('  Email    : ' + acc.email);
    console.log('  Mot de passe : ' + acc.password);
    console.log('  URL      : https://fagenesis.com/app.html');
    console.log('');
  });
  console.log('━'.repeat(55));
  console.log('\n⚠️  Ces comptes sont réservés aux tests internes.');
  console.log('   Supprimez-les avant l\'ouverture publique si souhaité.\n');
}

main().catch(function(e) { console.error('Erreur :', e.message); process.exit(1); });
