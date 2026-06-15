'use strict';

var MOIS_PAR_AN = 12;
var MAX_MOIS = 2000;        // borne supérieure de la durée générée
var SEUIL_ARRONDI = 0.005;  // en deçà, le capital restant est ramené à 0

// + Number.EPSILON corrige les arrondis flottants (ex. 1.005 → 1.01 au lieu de 1.00).
var round2 = function (x) { return Math.round((x + Number.EPSILON) * 100) / 100; };

var nfFR = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
var nfFR1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
function formatFrenchNumber(num) {
  // « + 0 » normalise un éventuel -0 en 0 pour ne pas afficher « -0,00 ».
  return nfFR.format(round2(num) + 0);
}

/**
 * Calcule l'échéancier d'amortissement.
 * @returns {{rows:Array, totals:Object, extinctionMois:?number, stopped:?Object, resteCapital:number}}
 */
function computeSchedule(p) {
  var r = p.tauxAnnuel / MOIS_PAR_AN;
  var capitalRestant = round2(p.capitalInitial);
  var rows = [];
  var totalVerse = 0, totalInterets = 0, totalFrais = 0;
  var echeancesPayees = 0;
  var extinctionMois = null;
  var stopped = null;

  for (var m = 1; m <= p.nbMois; m++) {
    // Capital éteint : inutile de générer des échéances vides, on s'arrête.
    if (capitalRestant <= 0) break;

    var interets = round2(capitalRestant * r);
    var capitalRembourse = round2(p.mensualite - interets - p.autresFrais);

    // Garde-fou : la mensualité ne couvre pas intérêts + frais → amortissement
    // négatif (le capital augmenterait indéfiniment). On arrête proprement.
    if (capitalRembourse <= 0) {
      // Ligne informative (grisée, hors totaux) montrant le mois de blocage.
      rows.push({
        m: m, paiement: 0, interets: interets, frais: p.autresFrais,
        capitalRembourse: 0, capitalRestant: capitalRestant, zero: true
      });
      stopped = { m: m, interets: interets };
      break;
    }

    var paiement = p.mensualite;
    var lastPayment = false;
    if (capitalRembourse > capitalRestant) {
      // Dernière échéance : on ne rembourse que ce qui reste.
      capitalRembourse = round2(capitalRestant);
      paiement = round2(interets + p.autresFrais + capitalRembourse);
      lastPayment = true;
    }

    var nouveau = round2(capitalRestant - capitalRembourse);
    if (Math.abs(nouveau) < SEUIL_ARRONDI) nouveau = 0;

    rows.push({
      m: m, paiement: paiement, interets: interets, frais: p.autresFrais,
      capitalRembourse: capitalRembourse, capitalRestant: nouveau, lastPayment: lastPayment
    });

    totalVerse += paiement;
    totalInterets += interets;
    totalFrais += p.autresFrais;
    echeancesPayees++;
    capitalRestant = nouveau;

    if (capitalRestant === 0 && extinctionMois === null) extinctionMois = m;
  }

  return {
    rows: rows,
    totals: { verse: round2(totalVerse), interets: round2(totalInterets), frais: round2(totalFrais) },
    echeancesPayees: echeancesPayees,
    extinctionMois: extinctionMois,
    stopped: stopped,
    resteCapital: capitalRestant > 0 ? round2(capitalRestant) : 0
  };
}

// --- DOM ---
var form = document.getElementById('form');
var results = document.getElementById('results');
var alertsEl = document.getElementById('alerts');
var summaryEl = document.getElementById('summary');
var tbody = document.getElementById('tbody');
var csvBtn = document.getElementById('csvBtn');
var printBtn = document.getElementById('printBtn');
var resetBtn = document.getElementById('resetBtn');

// Références d'inputs mises en cache (évite un getElementById par champ à chaque calcul).
var inputs = {
  capital: document.getElementById('capital'),
  taux: document.getElementById('taux'),
  mensualite: document.getElementById('mensualite'),
  frais: document.getElementById('frais'),
  nbMois: document.getElementById('nbMois')
};

var lastResult = null;

// Vide les sorties et désactive les exports (état « pas de résultat »).
function clearResults() {
  alertsEl.replaceChildren();
  summaryEl.replaceChildren();
  tbody.replaceChildren();
  csvBtn.disabled = true;
  printBtn.disabled = true;
  lastResult = null;
}

// Parse strict : rejette les saisies partielles (« 100abc » → NaN), tolère les
// séparateurs de milliers (espaces classiques, fines et insécables) et accepte
// la virgule française comme séparateur décimal.
function parseNumber(value) {
  if (typeof value !== 'string') return NaN;
  var s = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(s)) return NaN;
  return parseFloat(s);
}

function readParams() {
  return {
    capitalInitial: parseNumber(inputs.capital.value),
    tauxAnnuel: parseNumber(inputs.taux.value) / 100,
    mensualite: parseNumber(inputs.mensualite.value),
    autresFrais: parseNumber(inputs.frais.value),
    nbMois: parseNumber(inputs.nbMois.value)
  };
}

function validate(p) {
  if (!isFinite(p.capitalInitial) || p.capitalInitial <= 0) return 'Le capital de départ doit être un montant positif.';
  if (!isFinite(p.tauxAnnuel) || p.tauxAnnuel < 0) return 'Le taux annuel doit être positif ou nul.';
  if (!isFinite(p.mensualite) || p.mensualite <= 0) return 'La mensualité doit être un montant positif.';
  if (!isFinite(p.autresFrais) || p.autresFrais < 0) return 'Les autres frais doivent être positifs ou nuls.';
  if (!isFinite(p.nbMois) || p.nbMois < 1) return 'La durée doit être d\'au moins 1 mois.';
  if (!Number.isInteger(p.nbMois)) return 'La durée doit être un nombre entier de mois.';
  if (p.nbMois > MAX_MOIS) return 'La durée ne peut pas dépasser ' + MAX_MOIS + ' mois.';
  return null;
}

// Construit une alerte sans innerHTML : chaque partie est insérée comme
// texte (createTextNode), les segments { b: ... } deviennent des <strong>.
// Aucune chaîne n'est interprétée comme du HTML → pas de vecteur XSS.
function makeAlert(type, parts) {
  var div = document.createElement('div');
  div.className = 'alert ' + type;
  parts.forEach(function (part) {
    if (typeof part === 'string') {
      div.appendChild(document.createTextNode(part));
    } else {
      var strong = document.createElement('strong');
      strong.textContent = part.b;
      div.appendChild(strong);
    }
  });
  return div;
}

function makeStat(k, v) {
  var wrap = document.createElement('div');
  wrap.className = 'stat';
  var kd = document.createElement('div');
  kd.className = 'k';
  kd.textContent = k;
  var vd = document.createElement('div');
  vd.className = 'v';
  vd.textContent = v;
  wrap.appendChild(kd);
  wrap.appendChild(vd);
  return wrap;
}

function render(res, p) {
  // Alertes
  if (res.stopped) {
    alertsEl.replaceChildren(makeAlert('err', [
      '⛔ Au mois ' + res.stopped.m + ', les intérêts (' + formatFrenchNumber(res.stopped.interets) +
      ' €) plus les frais (' + formatFrenchNumber(p.autresFrais) + ' €) dépassent la mensualité (' +
      formatFrenchNumber(p.mensualite) + ' €). Le capital restant dû (',
      { b: formatFrenchNumber(res.resteCapital) + ' €' },
      ') ne diminuera jamais : augmentez la mensualité.'
    ]));
  } else if (res.resteCapital > 0) {
    alertsEl.replaceChildren(makeAlert('warn', [
      '⚠️ Capital non éteint après ' + p.nbMois + ' mois : il reste ',
      { b: formatFrenchNumber(res.resteCapital) + ' €' },
      '. Augmentez la mensualité ou la durée.'
    ]));
  } else if (res.extinctionMois) {
    alertsEl.replaceChildren(makeAlert('ok', [
      '✅ Prêt soldé au mois ',
      { b: String(res.extinctionMois) },
      ' (' + nfFR1.format(res.extinctionMois / MOIS_PAR_AN) + ' ans).'
    ]));
  } else {
    alertsEl.replaceChildren();
  }

  // Synthèse
  var coutCredit = round2(res.totals.interets + res.totals.frais);
  summaryEl.replaceChildren(
    makeStat('Échéances payées', res.echeancesPayees),
    makeStat('Total versé', formatFrenchNumber(res.totals.verse) + ' €'),
    makeStat('Total intérêts', formatFrenchNumber(res.totals.interets) + ' €'),
    makeStat('Total frais', formatFrenchNumber(res.totals.frais) + ' €'),
    makeStat('Coût du crédit', formatFrenchNumber(coutCredit) + ' €')
  );

  // Tableau : construction via DocumentFragment + textContent (pas d'innerHTML).
  var frag = document.createDocumentFragment();
  res.rows.forEach(function (row) {
    var tr = document.createElement('tr');
    if (row.zero) tr.className = 'zero';
    else if (row.lastPayment) tr.className = 'last-payment';
    var cells = [row.m, formatFrenchNumber(row.paiement), formatFrenchNumber(row.interets),
      formatFrenchNumber(row.frais), formatFrenchNumber(row.capitalRembourse),
      formatFrenchNumber(row.capitalRestant)];
    cells.forEach(function (c) {
      var td = document.createElement('td');
      td.textContent = c;
      tr.appendChild(td);
    });
    frag.appendChild(tr);
  });
  tbody.replaceChildren(frag);

  results.classList.remove('hidden');
  csvBtn.disabled = false;
  printBtn.disabled = false;
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

form.addEventListener('submit', function (e) {
  e.preventDefault();
  var p = readParams();
  var err = validate(p);
  if (err) {
    clearResults();
    results.classList.remove('hidden');
    alertsEl.replaceChildren(makeAlert('err', ['⛔ ' + err]));
    return;
  }
  lastResult = { res: computeSchedule(p), p: p };
  render(lastResult.res, lastResult.p);
});

resetBtn.addEventListener('click', function () {
  form.reset();
  clearResults();
  results.classList.add('hidden');
});

csvBtn.addEventListener('click', function () {
  if (!lastResult) return;
  var header = ['Échéance', 'Montant du versement', 'Intérêts payés par versement',
    'Autres frais', 'Capital remboursé par versement', 'Capital restant dû après chaque versement'];
  // Valeur numérique brute (décimale française, sans séparateur de milliers)
  // pour qu'Excel/LibreOffice interprètent bien les cellules comme des nombres.
  var csvNum = function (x) { return round2(x).toFixed(2).replace('.', ','); };
  var lines = [header.join(';')];
  lastResult.res.rows.forEach(function (row) {
    lines.push([row.m, csvNum(row.paiement), csvNum(row.interets),
      csvNum(row.frais), csvNum(row.capitalRembourse),
      csvNum(row.capitalRestant)].join(';'));
  });
  // BOM pour ouverture correcte des accents dans Excel.
  var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'echeancier.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

printBtn.addEventListener('click', function () { window.print(); });
