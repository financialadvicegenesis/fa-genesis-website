/**
 * FA GENESIS APP - Traduction multilingue de la SPA (app.html)
 *
 * Différent de i18n.js (site vitrine) : app.html construit ses écrans par
 * injection dynamique de HTML (innerHTML=) à chaque navigation, donc une
 * traduction "au chargement" une seule fois ne suffit pas (i18n.js fait ça et
 * ne fonctionnerait pas ici). Ce module traduit chaque nœud de texte au moment
 * où il apparaît dans le DOM, via un MutationObserver qui tourne en continu :
 * ainsi aucun site d'appel des ~1100 fonctions de rendu de app.html n'a besoin
 * d'être modifié pour que la traduction s'applique partout, y compris aux
 * écrans qui n'existent pas encore au moment du chargement de la page.
 *
 * Changement de langue = sauvegarde + rechargement de page plutôt qu'une
 * tentative de "retraduire en sens inverse" le DOM déjà modifié en place (une
 * grande partie du texte de l'app change légitimement après coup - statuts de
 * commande, compteurs animés... - distinguer "texte retraduit par nous" de
 * "texte changé ensuite par l'app elle-même" de façon fiable serait bien plus
 * fragile qu'un simple rechargement, qui redémarre proprement dans la langue
 * choisie dès le premier écran).
 *
 * Dictionnaires par langue chargés séparément AVANT ce script
 * (app-i18n-en.js, app-i18n-es.js, ...), chacun appelle
 * AppI18n.registerDict('en', {...}) - permet d'ajouter une langue sans
 * toucher ce fichier moteur, et de garder chaque dictionnaire éditable
 * indépendamment.
 */
(function () {
  "use strict";

  var SUPPORTED_LANGS = ["fr", "en", "es", "pt", "ar", "de", "zh", "it", "ja", "hi"];
  var RTL_LANGS = ["ar"];
  var STORAGE_KEY = "fa_genesis_app_lang";

  var DICTS = {}; // lang -> { "texte FR exact": "texte traduit" }
  var currentLang = "fr";
  var observer = null;

  function registerDict(lang, dict) {
    DICTS[lang] = dict;
  }

  function translate(text, lang) {
    var dict = DICTS[lang];
    if (!dict) return null;
    var trimmed = text.trim();
    if (!trimmed) return null;
    var hit = dict[trimmed];
    if (hit === undefined) return null;
    // préserve les espaces de début/fin éventuels autour du texte traduit
    return text.replace(trimmed, hit);
  }

  // Certains textes ne doivent JAMAIS être traduits même si une clé correspond par
  // hasard dans le dictionnaire — ex. le sélecteur de langue lui-même, qui doit
  // toujours afficher chaque langue dans son nom natif ("Português", pas
  // "Portuguese" une fois l'app passée en anglais). Marqué via data-i18n-skip sur
  // un ancêtre (voir #lang-list dans app.html).
  function isSkipped(el) {
    return !!(el && el.closest && el.closest("[data-i18n-skip]"));
  }

  function translateTextNode(node) {
    if (node.nodeValue === node.__i18nLastOutput) return; // notre propre écriture, ignorer
    var parent = node.parentNode;
    if (parent && (parent.tagName === "SCRIPT" || parent.tagName === "STYLE" || parent.tagName === "NOSCRIPT")) return;
    if (isSkipped(parent)) return;
    if (!node.nodeValue || node.nodeValue.trim().length < 2) return;
    var t = translate(node.nodeValue, currentLang);
    if (t && t !== node.nodeValue) {
      node.nodeValue = t;
      node.__i18nLastOutput = t;
    }
  }

  var TRANSLATABLE_ATTRS = ["placeholder", "title", "aria-label"];
  function translateElementAttrs(el) {
    if (isSkipped(el)) return;
    for (var i = 0; i < TRANSLATABLE_ATTRS.length; i++) {
      var attr = TRANSLATABLE_ATTRS[i];
      var v = el.getAttribute(attr);
      if (!v) continue;
      var cacheKey = "__i18nAttrLast_" + attr;
      if (el[cacheKey] === v) continue; // déjà traduit par nous
      var t = translate(v, currentLang);
      if (t && t !== v) {
        el.setAttribute(attr, t);
        el[cacheKey] = t;
      }
    }
    if (el.tagName === "INPUT" && (el.type === "submit" || el.type === "button") && el.value) {
      var tv = translate(el.value, currentLang);
      if (tv && tv !== el.value) el.value = tv;
    }
  }

  function translateNode(node) {
    if (!node) return;
    if (node.nodeType === 3) {
      translateTextNode(node);
      return;
    }
    if (node.nodeType !== 1) return;
    translateElementAttrs(node);
    var child = node.firstChild;
    while (child) {
      translateNode(child);
      child = child.nextSibling;
    }
  }

  function startObserving() {
    if (observer) return;
    observer = new MutationObserver(function (mutations) {
      if (currentLang === "fr") return;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === "childList") {
          for (var j = 0; j < m.addedNodes.length; j++) translateNode(m.addedNodes[j]);
        } else if (m.type === "characterData") {
          translateTextNode(m.target);
        } else if (m.type === "attributes") {
          translateElementAttrs(m.target);
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRS,
    });
  }

  function applyDocumentDirection(lang) {
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", RTL_LANGS.indexOf(lang) !== -1 ? "rtl" : "ltr");
  }

  // Appelée le plus tôt possible au boot de l'app (en haut du tout premier bloc
  // <script> inline), donc APRÈS que tout le HTML statique situé avant ce bloc dans
  // le fichier (écran roleChoice, etc.) soit déjà parsé dans le DOM, mais AVANT tout
  // innerHTML injecté par la suite par l'app elle-même. D'où le double traitement :
  // un passage immédiat sur document.body pour ce qui existe déjà (sinon l'écran
  // roleChoice, jamais "ajouté" par mutation, resterait en français pour toujours),
  // puis l'observer pour tout ce qui sera injecté après coup.
  function initAppLanguage() {
    var saved = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (e) {}
    if (saved && SUPPORTED_LANGS.indexOf(saved) !== -1 && saved !== "fr") {
      currentLang = saved;
      applyDocumentDirection(saved);
      translateNode(document.body);
      startObserving();
    } else {
      currentLang = "fr";
      applyDocumentDirection("fr");
    }
  }

  // Changer de langue = sauvegarder puis recharger (voir commentaire d'en-tête).
  function setAppLanguage(lang) {
    if (SUPPORTED_LANGS.indexOf(lang) === -1) lang = "fr";
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {}
    // Best-effort, ne bloque pas le rechargement si ça échoue (ex. hors-ligne).
    try {
      if (typeof USER !== "undefined" && USER && USER._token) {
        var base = (typeof window.FA_GENESIS_API !== "undefined" && window.FA_GENESIS_API) || (typeof API !== "undefined" ? API : "");
        fetch(base + "/api/user/language", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + USER._token },
          body: JSON.stringify({ language: lang }),
        }).catch(function () {});
      }
    } catch (e) {}
    location.reload();
  }

  function getAppLanguage() {
    return currentLang;
  }

  window.AppI18n = {
    registerDict: registerDict,
    initAppLanguage: initAppLanguage,
    setAppLanguage: setAppLanguage,
    getAppLanguage: getAppLanguage,
    SUPPORTED_LANGS: SUPPORTED_LANGS,
    RTL_LANGS: RTL_LANGS,
  };
})();
