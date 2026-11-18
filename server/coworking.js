'use strict';
// ============================================================================================
// RÉSERVATION DE CRÉNEAUX COWORKING (2026-11-16, décisions FA GENESIS)
// --------------------------------------------------------------------------------------------
// Fonctions pures (aucun accès fichier) : horaires d'ouverture, fuseau horaire de l'espace,
// places disponibles, prix d'un créneau. Les routes et la persistance sont dans server.js
// (section « COWORKING »). Une réservation = une commande « partner_service » ordinaire avec un
// objet `coworking` : elle passe donc par GENESIS SAFE™, le Wallet et la commission habituels.
//
// Règles anti-fraude validées par FA GENESIS (2026-11-16) :
//  - annulation libre jusqu'à 24 h avant le début du créneau, plus rien ensuite ;
//  - code d'arrivée (4 chiffres) saisi par l'espace = preuve de présence ;
//  - fin du créneau → prestation terminée automatiquement, 24 h pour signaler un problème,
//    puis versement à l'espace (job checkCoworkingBookings + checkAutoPaymentRelease) ;
//  - problème signalé → litige, argent gelé, l'équipe tranche.
// ============================================================================================

var UNITS = {
    hour:     { label: 'heure',        short: 'h' },
    half_day: { label: 'demi-journée', hours: 4 },
    day:      { label: 'journée' }
};
var MODES = ['per_person', 'private'];
var SLOT_STEP_MIN = 30;           // granularité des places (blocs de 30 min)
var MAX_DAYS_AHEAD = 90;          // réservation possible jusqu'à 90 jours à l'avance
var MIN_LEAD_MIN = 10;            // un créneau doit commencer dans au moins 10 min
var HOLD_MIN = 15;                // place bloquée 15 min pendant le paiement
var FREE_CANCEL_HOURS = 24;       // annulation libre jusqu'à 24 h avant
var REPORT_WINDOW_HOURS = 24;     // 24 h après la fin pour signaler un problème
var CHECKIN_MAX_ATTEMPTS = 10;

var TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
var DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Fuseau horaire de l'espace, d'après le pays du prestataire (heures saisies = heures locales).
var TZ_BY_COUNTRY = {
    FR: 'Europe/Paris', MC: 'Europe/Monaco', BE: 'Europe/Brussels', CH: 'Europe/Zurich', LU: 'Europe/Luxembourg',
    GP: 'America/Guadeloupe', MQ: 'America/Martinique', GF: 'America/Cayenne', RE: 'Indian/Reunion',
    YT: 'Indian/Mayotte', PM: 'America/Miquelon', BL: 'America/St_Barthelemy', MF: 'America/Marigot',
    GA: 'Africa/Libreville', CM: 'Africa/Douala', CG: 'Africa/Brazzaville', CD: 'Africa/Kinshasa',
    CI: 'Africa/Abidjan', SN: 'Africa/Dakar', ML: 'Africa/Bamako', BF: 'Africa/Ouagadougou', BJ: 'Africa/Porto-Novo',
    TG: 'Africa/Lome', GN: 'Africa/Conakry', NE: 'Africa/Niamey', TD: 'Africa/Ndjamena', MA: 'Africa/Casablanca',
    TN: 'Africa/Tunis', DZ: 'Africa/Algiers', CA: 'America/Toronto', US: 'America/New_York', GB: 'Europe/London',
    DE: 'Europe/Berlin', ES: 'Europe/Madrid', IT: 'Europe/Rome', PT: 'Europe/Lisbon'
};
function tzFor(partner) {
    var c = String((partner && partner.country) || 'FR').toUpperCase();
    return TZ_BY_COUNTRY[c] || 'Europe/Paris';
}

function toMin(t) {
    var m = TIME_RE.exec(String(t || ''));
    return m ? (parseInt(m[1], 10) * 60 + parseInt(m[2], 10)) : null;
}
function fromMin(m) {
    var h = Math.floor(m / 60), mi = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi;
}
function validDate(d) {
    var m = DATE_RE.exec(String(d || ''));
    if (!m) return false;
    var t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return t.getUTCFullYear() === +m[1] && t.getUTCMonth() === +m[2] - 1 && t.getUTCDate() === +m[3];
}
function dowOf(date) {
    var m = DATE_RE.exec(date);
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
}
function addDays(date, n) {
    var m = DATE_RE.exec(date);
    var t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
    return t.toISOString().slice(0, 10);
}

// Décalage du fuseau à un instant donné (ms) — sans dépendance, via Intl.
function tzOffsetMs(ts, tz) {
    var base = Math.floor(ts / 1000) * 1000;
    var parts = {};
    new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(new Date(base)).forEach(function(p) { parts[p.type] = p.value; });
    var asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, (+parts.hour) % 24, +parts.minute, +parts.second);
    return asUtc - base;
}
// « 2026-11-18 14:00 heure de l'espace » → timestamp UTC.
function zonedToUtc(date, time, tz) {
    var m = DATE_RE.exec(date), mins = toMin(time);
    var guess = Date.UTC(+m[1], +m[2] - 1, +m[3], Math.floor(mins / 60), mins % 60);
    var off = tzOffsetMs(guess, tz);
    var ts = guess - off;
    var off2 = tzOffsetMs(ts, tz);
    if (off2 !== off) ts = guess - off2;
    return ts;
}
// Date et minute locales de l'espace à l'instant ts.
function localNow(ts, tz) {
    var local = new Date(ts + tzOffsetMs(ts, tz));
    return { date: local.toISOString().slice(0, 10), min: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

// ── Paramètres de l'espace (horaires, fermetures, adresse, accès) ─────────────────────────────
function emptySettings() {
    return { hours: { '0': null, '1': null, '2': null, '3': null, '4': null, '5': null, '6': null }, closures: [], blocks: [], address: '', access: '' };
}
function normWindow(w) {
    if (!w) return null;
    var o = toMin(w.o), c = toMin(w.c);
    if (o === null || c === null) return { error: 'Horaire invalide (format HH:MM).' };
    if (c <= o) return { error: 'L’heure de fermeture doit être après l’heure d’ouverture.' };
    return { o: fromMin(o), c: fromMin(c) };
}
// Valide les horaires/fermetures/adresse envoyés par le prestataire. Les blocages manuels
// (blocks) sont gérés par leurs propres routes et conservés tels quels.
function sanitizeSettings(input, prev, todayDate) {
    var out = emptySettings();
    prev = prev || {};
    out.blocks = Array.isArray(prev.blocks) ? prev.blocks : [];
    var hours = (input && input.hours) || {};
    for (var d = 0; d <= 6; d++) {
        var w = hours[String(d)];
        if (!w) { out.hours[String(d)] = null; continue; }
        var n = normWindow(w);
        if (n && n.error) return { error: n.error };
        out.hours[String(d)] = n;
    }
    var closures = Array.isArray(input && input.closures) ? input.closures : [];
    if (closures.length > 200) return { error: 'Trop de dates exceptionnelles (200 maximum).' };
    var seen = {};
    for (var i = 0; i < closures.length; i++) {
        var cl = closures[i] || {};
        if (!validDate(cl.date)) return { error: 'Date exceptionnelle invalide.' };
        if (todayDate && cl.date < todayDate) continue;            // passé : inutile de garder
        if (seen[cl.date]) continue;
        seen[cl.date] = true;
        if (cl.o || cl.c) {
            var nw = normWindow({ o: cl.o, c: cl.c });
            if (nw && nw.error) return { error: nw.error };
            out.closures.push({ date: cl.date, o: nw.o, c: nw.c });
        } else {
            out.closures.push({ date: cl.date, o: null, c: null });
        }
    }
    out.closures.sort(function(a, b) { return a.date < b.date ? -1 : 1; });
    out.address = String((input && input.address) || '').trim().slice(0, 200);
    out.access = String((input && input.access) || '').trim().slice(0, 600);
    return { settings: out };
}

// Champs coworking d'une prestation (prix à l'heure / demi-journée / journée, places, mode).
function sanitizeServiceCw(s) {
    var unit = s && s.cw_unit;
    if (!UNITS[unit]) return { cw_unit: null, cw_seats: null, cw_mode: null, cw_min_hours: null };
    var seats = parseInt(s.cw_seats, 10);
    if (!(seats >= 1)) seats = 1;
    if (seats > 500) seats = 500;
    var mode = MODES.indexOf(s.cw_mode) !== -1 ? s.cw_mode : 'per_person';
    var minH = parseInt(s.cw_min_hours, 10);
    if (!(minH >= 1)) minH = 1;
    if (minH > 12) minH = 12;
    return { cw_unit: unit, cw_seats: seats, cw_mode: mode, cw_min_hours: unit === 'hour' ? minH : null };
}
function isSlotService(service) { return !!(service && UNITS[service.cw_unit] && service.pricing_type !== 'quote'); }

// Fenêtre d'ouverture d'une date (fermeture exceptionnelle > horaires spéciaux > horaires habituels).
function dayWindow(settings, date) {
    settings = settings || emptySettings();
    var cl = (settings.closures || []).find(function(c) { return c.date === date; });
    if (cl) return (cl.o && cl.c) ? { o: toMin(cl.o), c: toMin(cl.c) } : null;
    var w = settings.hours && settings.hours[String(dowOf(date))];
    return w ? { o: toMin(w.o), c: toMin(w.c) } : null;
}

// Intervalle demandé → {start, end} en minutes locales, ou {error}.
// endTime (2026-11-18) : le client choisit son heure d'arrivée ET de départ.
//  - journée : arrivée/départ libres dans les horaires d'ouverture, prix d'une journée ; la place
//    n'est occupée que sur ces heures (sans heures envoyées : toute la plage, comme avant) ;
//  - format 4h : départ 4 h, 8 h… après l'arrivée, prix × nombre de tranches de 4 h.
function bookingInterval(service, settings, date, startTime, hours, endTime) {
    var win = dayWindow(settings, date);
    if (!win) return { error: 'L’espace est fermé ce jour-là.' };
    var unit = service.cw_unit;
    if (unit === 'day') {
        var ds = startTime ? toMin(startTime) : win.o, de = endTime ? toMin(endTime) : win.c;
        if (ds === null || de === null) return { error: 'Heure d’arrivée ou de départ invalide.' };
        if (ds < win.o || de > win.c || de <= ds) return { error: 'Choisissez une arrivée et un départ pendant les horaires d’ouverture (' + fromMin(win.o) + ' – ' + fromMin(win.c) + ').' };
        if ((ds - win.o) % SLOT_STEP_MIN !== 0 || (de !== win.c && (de - win.o) % SLOT_STEP_MIN !== 0)) return { error: 'Horaires non disponibles.' };
        return { start: ds, end: de, units: 1 };
    }
    var s = toMin(startTime);
    if (s === null) return { error: 'Heure de début invalide.' };
    if (s < win.o || (s - win.o) % SLOT_STEP_MIN !== 0) return { error: 'Heure de début non disponible.' };
    var dur;
    if (unit === 'half_day') {
        var he = endTime ? toMin(endTime) : null;
        dur = (he !== null) ? he - s : UNITS.half_day.hours * 60;
        if (!(dur >= 240) || dur % 240 !== 0) return { error: 'Format 4h : l’heure de départ doit être 4 h, 8 h… après l’arrivée.' };
        if (s + dur > win.c) return { error: 'Le créneau dépasse l’heure de fermeture (' + fromMin(win.c) + ').' };
        return { start: s, end: s + dur, units: dur / 240 };
    }
    else {
        var h = parseInt(hours, 10);
        var minH = service.cw_min_hours || 1;
        if (!(h >= minH)) return { error: 'Durée minimale : ' + minH + ' h.' };
        if (h > 24) return { error: 'Durée invalide.' };
        dur = h * 60;
    }
    if (s + dur > win.c) return { error: 'Le créneau dépasse l’heure de fermeture (' + fromMin(win.c) + ').' };
    return { start: s, end: s + dur, units: unit === 'hour' ? dur / 60 : 1 };
}

// Places occupées : max simultané sur [a,b) pour cette prestation et cette date.
// occupancy = [{start, end, seats}] (réservations actives + blocages manuels, seats déjà résolu).
function maxUsed(occupancy, a, b) {
    var pts = [a];
    occupancy.forEach(function(o) { if (o.start > a && o.start < b) pts.push(o.start); });
    var max = 0;
    pts.forEach(function(p) {
        var used = 0;
        occupancy.forEach(function(o) { if (o.start <= p && o.end > p) used += o.seats; });
        if (used > max) max = used;
    });
    return max;
}
function seatsNeeded(service, persons) {
    return service.cw_mode === 'private' ? (service.cw_seats || 1) : persons;
}
// Blocs de 30 min de la journée avec les places libres (pour l'écran de réservation client).
function dayBlocks(service, settings, date, occupancy, nowTs, tz) {
    var win = dayWindow(settings, date);
    if (!win) return null;
    var now = localNow(nowTs, tz);
    var blocks = [];
    for (var t = win.o; t + SLOT_STEP_MIN <= win.c; t += SLOT_STEP_MIN) {
        var past = date < now.date || (date === now.date && t < now.min + MIN_LEAD_MIN);
        var free = past ? 0 : Math.max(0, (service.cw_seats || 1) - maxUsed(occupancy, t, t + SLOT_STEP_MIN));
        blocks.push({ start: fromMin(t), end: fromMin(t + SLOT_STEP_MIN), free: free });
    }
    return { open: fromMin(win.o), close: fromMin(win.c), blocks: blocks };
}

function round2(n) { return Math.round(n * 100) / 100; }
function priceFor(service, unitPrice, units, persons) {
    var mult = service.cw_mode === 'private' ? 1 : persons;
    return round2(unitPrice * units * mult);
}

// Statuts de commande qui libèrent la place.
function bookingIsActive(order, nowTs) {
    if (!order || !order.coworking) return false;
    if (['cancelled', 'refunded', 'expired'].indexOf(order.status) !== -1) return false;
    if (order.deposit_paid || order.deposit_authorized) return true;
    var hold = order.coworking.hold_until ? Date.parse(order.coworking.hold_until) : 0;
    return hold > nowTs;
}

module.exports = {
    UNITS: UNITS, MODES: MODES, SLOT_STEP_MIN: SLOT_STEP_MIN, MAX_DAYS_AHEAD: MAX_DAYS_AHEAD,
    MIN_LEAD_MIN: MIN_LEAD_MIN, HOLD_MIN: HOLD_MIN, FREE_CANCEL_HOURS: FREE_CANCEL_HOURS,
    REPORT_WINDOW_HOURS: REPORT_WINDOW_HOURS, CHECKIN_MAX_ATTEMPTS: CHECKIN_MAX_ATTEMPTS,
    tzFor: tzFor, toMin: toMin, fromMin: fromMin, validDate: validDate, dowOf: dowOf, addDays: addDays,
    tzOffsetMs: tzOffsetMs, zonedToUtc: zonedToUtc, localNow: localNow,
    emptySettings: emptySettings, sanitizeSettings: sanitizeSettings, sanitizeServiceCw: sanitizeServiceCw,
    isSlotService: isSlotService, dayWindow: dayWindow, bookingInterval: bookingInterval,
    maxUsed: maxUsed, seatsNeeded: seatsNeeded, dayBlocks: dayBlocks, priceFor: priceFor,
    bookingIsActive: bookingIsActive, round2: round2
};
