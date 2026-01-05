/**
 * Crée une feuille Google Sheet "Echeancier" contenant 300 lignes (valeurs fixes)
 * à partir des 2 premières lignes fournies et calcule les mois 3 -> 300.
 * Log (Logger.log et console.log) une ligne CSV à chaque itération pour suivre l'avancement.
 */
function createEcheancierWithLineLogs() {
  // Paramètres
  var tauxAnnuel = 0.034;             // Exemple de taux actuel en france (3,4%)
  var r = tauxAnnuel / 12;            // taux mensuel par mois
  var mensualite = 1000;              // montant fixe mensuel de votre contrat (à partir du 2ieme mois)
  var autresFrais = 15   ;            // autres frais mensuels fixes de votre contrat
  var nbMois = 300;

  // Prépare les lignes (en affichage français)
  var rows = [];
  rows.push([
    'Échéance',
    'Montant du versement',
    'Intérêts payés par versement',
    'Autres frais',
    'Capital remboursé par versement',
    'Capital restant dû après chaque versement'
  ]);

  // Ligne 1 (1er mois) — conservée telle quelle (source)
  rows.push([1, '3 809,33', '578,00', '2 798,97', '432,36', '203 567,64']);

  // Ligne 2 (2ème mois) — conservée telle quelle (source)
  rows.push([2, '1 025,80', '576,77', '15,44', '433,59', '203 134,05']);

  // Fonctions utilitaires
  function parseFrenchNumber(s) {
    if (typeof s === 'number') return s;
    return Number(String(s).replace(/\s/g, '').replace(',', '.'));
  }

  function formatFrenchNumber(num) {
    var neg = num < 0;
    if (neg) num = -num;
    var parts = (Math.round(num * 100) / 100).toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    var out = parts[0] + ',' + parts[1];
    return neg ? '-' + out : out;
  }

  // Log de l'en-tête CSV
  var headerCsv = rows[0].join(';');
  Logger.log(headerCsv);
  console.log(headerCsv);

  // Log des 2 premières lignes (format CSV)
  for (var i = 1; i <= 2; i++) {
    var csvLineInit = String(rows[i][0]) + ';' + rows[i].slice(1).join(';');
    Logger.log('Ligne %d/%d - %s', i, nbMois, csvLineInit);
    console.log('Ligne ' + i + '/' + nbMois + ' - ' + csvLineInit);
  }

  // Récupère le capital restant après le mois 2 (numérique)
  var capitalRestant = parseFrenchNumber(rows[2][5]); // 203134.05

  // Générer mois 3 -> 300 en journalisant chaque ligne CSV
  for (var m = 3; m <= nbMois; m++) {
    var interets = Math.round((capitalRestant * r) * 100) / 100;
    var capitalRemboursePropose = Math.round((mensualite - interets - autresFrais) * 100) / 100;

    var capitalRembourse;
    var paiementCetteLigne = mensualite;
    if (capitalRemboursePropose > capitalRestant) {
      capitalRembourse = Math.round(capitalRestant * 100) / 100;
      paiementCetteLigne = Math.round((interets + autresFrais + capitalRembourse) * 100) / 100;
    } else {
      capitalRembourse = capitalRemboursePropose;
    }

    var nouveauCapitalRestant = Math.round((capitalRestant - capitalRembourse) * 100) / 100;
    if (Math.abs(nouveauCapitalRestant) < 0.005) nouveauCapitalRestant = 0;

    // Formattage français pour affichage
    var paiementFmt = formatFrenchNumber(paiementCetteLigne);
    var interetsFmt = formatFrenchNumber(interets);
    var autresFraisFmt = formatFrenchNumber(autresFrais);
    var capitalRembFmt = formatFrenchNumber(capitalRembourse);
    var capitalRestFmt = formatFrenchNumber(nouveauCapitalRestant);

    rows.push([
      m,
      paiementFmt,
      interetsFmt,
      autresFraisFmt,
      capitalRembFmt,
      capitalRestFmt
    ]);

    // Construction de la ligne CSV (séparateur ;)

    var csvLine = m + ';' + paiementFmt + ';' + interetsFmt + ';' + autresFraisFmt + ';' + capitalRembFmt + ';' + capitalRestFmt;

    // Log à chaque ligne : Logger.log et console.log
    Logger.log('Ligne %d/%d - %s', m, nbMois, csvLine);
    console.log('Ligne ' + m + '/' + nbMois + ' - ' + csvLine);

    capitalRestant = nouveauCapitalRestant;

    // Si arrivé à 0 avant 300 (sécurité), remplir le reste avec zéros et logger
    if (capitalRestant === 0 && m < nbMois) {
      for (var mm = m + 1; mm <= nbMois; mm++) {
        var zeroLine = mm + ';0,00;0,00;0,00;0,00;0,00';
        rows.push([mm, formatFrenchNumber(0), formatFrenchNumber(0), formatFrenchNumber(0), formatFrenchNumber(0), formatFrenchNumber(0)]);
        Logger.log('Ligne %d/%d - %s (remplissage zéro)', mm, nbMois, zeroLine);
        console.log('Ligne ' + mm + '/' + nbMois + ' - ' + zeroLine + ' (remplissage zéro)');
      }
      break;
    }
  }

  // Écrire toutes les lignes dans la feuille
  var ss = SpreadsheetApp.create('echeancier');
  var sheet = ss.getActiveSheet();
  sheet.setName('Echeancier');
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

  // Partage (Anyone with link - Viewer) si possible
  try {
    var file = DriveApp.getFileById(ss.getId());
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log('Impossible de changer le partage automatiquement : ' + e);
    console.log('Impossible de changer le partage automatiquement : ' + e);
  }

  Logger.log('Feuille créée : %s', ss.getUrl());
  console.log('Feuille créée : ' + ss.getUrl());
  SpreadsheetApp.getUi().alert('Feuille créée : ' + ss.getUrl() + '\nLa feuille est partagée en lecture (si autorisation Drive accordée).');
}