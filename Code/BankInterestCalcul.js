/**
 * Crée une feuille Google Sheet "Echeancier" (amortissement mensuel) à partir
 * des 2 premières lignes source, puis calcule les mois 3 -> nbMois.
 *
 * Les montants sont stockés en NOMBRES (cellules calculables/triables) avec un
 * format d'affichage français appliqué. Une ligne CSV est journalisée à chaque
 * itération pour suivre l'avancement (Logger.log + console.log).
 *
 * @param {Object} [options]
 * @param {number} [options.tauxAnnuel=0.034] Taux annuel (ex. 0.034 = 3,4 %).
 * @param {number} [options.mensualite=1000]  Mensualité fixe (à partir du mois 3).
 * @param {number} [options.autresFrais=15]   Frais mensuels fixes.
 * @param {number} [options.nbMois=300]       Nombre d'échéances à générer.
 * @return {string} URL de la feuille créée.
 */
function createEcheancier(options) {
  options = options || {};
  var tauxAnnuel = options.tauxAnnuel != null ? options.tauxAnnuel : 0.034;
  var mensualite = options.mensualite != null ? options.mensualite : 1000;
  var autresFrais = options.autresFrais != null ? options.autresFrais : 15;
  var nbMois = options.nbMois != null ? options.nbMois : 300;
  var r = tauxAnnuel / 12; // taux mensuel

  // --- Utilitaires ---
  var round2 = function (x) { return Math.round(x * 100) / 100; };

  var formatFrenchNumber = function (num) {
    var neg = num < 0;
    if (neg) num = -num;
    var parts = round2(num).toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    var out = parts[0] + ',' + parts[1];
    return neg ? '-' + out : out;
  };

  var log = function (msg) { Logger.log(msg); console.log(msg); };

  var logLigne = function (echeance, valeurs, suffixe) {
    var csv = echeance + ';' + valeurs.map(formatFrenchNumber).join(';');
    log('Ligne ' + echeance + '/' + nbMois + ' - ' + csv + (suffixe || ''));
  };

  // --- En-tête + 2 lignes source (numériques) ---
  var header = [
    'Échéance',
    'Montant du versement',
    'Intérêts payés par versement',
    'Autres frais',
    'Capital remboursé par versement',
    'Capital restant dû après chaque versement'
  ];
  var rows = [header];
  rows.push([1, 3809.33, 578.00, 2798.97, 432.36, 203567.64]); // mois 1 (source)
  rows.push([2, 1025.80, 576.77, 15.44, 433.59, 203134.05]);   // mois 2 (source)

  log(header.join(';'));
  logLigne(1, rows[1].slice(1));
  logLigne(2, rows[2].slice(1));

  // Capital restant après le mois 2
  var capitalRestant = rows[2][5];

  // --- Génération des mois 3 -> nbMois ---
  for (var m = 3; m <= nbMois; m++) {
    var interets = round2(capitalRestant * r);
    var capitalRemboursePropose = round2(mensualite - interets - autresFrais);

    // Garde-fou : si la mensualité ne couvre pas intérêts + frais, le capital
    // augmenterait indéfiniment (amortissement négatif). On arrête proprement.
    if (capitalRemboursePropose <= 0) {
      log('Mensualité (' + mensualite + ') insuffisante au mois ' + m +
        ' : intérêts (' + interets + ') + frais (' + autresFrais + ') >= mensualité. Calcul interrompu.');
      break;
    }

    var capitalRembourse = capitalRemboursePropose;
    var paiementCetteLigne = mensualite;
    if (capitalRemboursePropose > capitalRestant) {
      // Dernière échéance : on ne rembourse que ce qu'il reste.
      capitalRembourse = round2(capitalRestant);
      paiementCetteLigne = round2(interets + autresFrais + capitalRembourse);
    }

    var nouveauCapitalRestant = round2(capitalRestant - capitalRembourse);
    if (Math.abs(nouveauCapitalRestant) < 0.005) nouveauCapitalRestant = 0;

    var ligne = [paiementCetteLigne, interets, autresFrais, capitalRembourse, nouveauCapitalRestant];
    rows.push([m].concat(ligne));
    logLigne(m, ligne);

    capitalRestant = nouveauCapitalRestant;

    // Capital éteint avant la fin : remplir le reste avec des zéros.
    if (capitalRestant === 0 && m < nbMois) {
      var zeros = [0, 0, 0, 0, 0];
      for (var mm = m + 1; mm <= nbMois; mm++) {
        rows.push([mm].concat(zeros));
        logLigne(mm, zeros, ' (remplissage zéro)');
      }
      break;
    }
  }

  // Avertissement si le capital n'est pas éteint au terme des nbMois échéances.
  if (capitalRestant > 0) {
    log('Attention : capital non éteint après ' + nbMois + ' mois (reste ' +
      formatFrenchNumber(capitalRestant) + '). Augmentez la mensualité ou la durée.');
  }

  // --- Écriture dans la feuille (nombres + format français) ---
  var ss = SpreadsheetApp.create('echeancier');
  ss.setSpreadsheetLocale('fr_FR');
  var sheet = ss.getActiveSheet();
  sheet.setName('Echeancier');
  sheet.getRange(1, 1, rows.length, header.length).setValues(rows);
  if (rows.length > 1) {
    // Colonnes 2..6 = montants → format milliers + 2 décimales (rendu fr : "1 234,56").
    sheet.getRange(2, 2, rows.length - 1, header.length - 1).setNumberFormat('#,##0.00');
  }

  // SÉCURITÉ : la feuille contient des données financières personnelles
  // (capital, taux, échéancier). Elle reste PRIVÉE — accessible uniquement au
  // propriétaire. Ne jamais activer un partage public (ANYONE_WITH_LINK)
  // automatiquement : partagez manuellement et de façon ciblée si nécessaire.
  log('Feuille créée (privée) : ' + ss.getUrl());

  // getUi() n'est disponible que lorsqu'un contexte d'interface existe
  // (menu/éditeur). Sous déclencheur temporel ou exécution via API, il lève
  // une exception : on l'isole pour ne pas faire échouer tout le traitement.
  try {
    SpreadsheetApp.getUi().alert('Feuille créée : ' + ss.getUrl());
  } catch (e) {
    log('UI non disponible (exécution sans interface) : ' + e);
  }

  return ss.getUrl();
}

/**
 * Point d'entrée par défaut (paramètres du contrat en dur).
 * Conservé pour compatibilité avec le README.
 */
function createEcheancierWithLineLogs() {
  return createEcheancier();
}
