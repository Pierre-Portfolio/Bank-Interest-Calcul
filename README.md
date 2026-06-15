<h1 align="center">
  <img src="./assets/images/github/header.png" alt="CSV SCREEN" />
</h1>
<img src="./assets/images/github/star.gif" alt="star" />

---

# Bank Interest Calcul

## Aperçu
Projet générique pour produire un échéancier d’amortissement mensuel à partir d’un point de départ (deux premières lignes) et générer automatiquement les mois suivants jusqu’à extinction du capital. Conçu pour être facilement adapté à votre prêt (montant, taux, mensualité, frais, durée) et exportable en Google Sheets, Excel (.xlsx) ou CSV.

## Objectifs
- Fournir un tableau mois par mois avec la répartition : paiement total, intérêts, autres frais, capital remboursé et capital restant.
- Permettre une génération automatique en recopiant seulement les 2 premières lignes d’un tableau source.
- Offrir des sorties prêtes à l’emploi (CSV / .xlsx / Google Sheet) et un script automatisé pour créer la feuille et suivre l’exécution.
- Laisser les paramètres aisément modifiables pour l’adapter à tout type de prêt.

## Technologie
- JavaScript

## Déploiement
Voici les étapes rapides pour obtenir le .xlsx téléchargeable :

- Ouvrez https://script.google.com → Nouveau projet.
- Collez le code ci‑dessus, enregistrez.
- Exécutez createEcheancierWithLineLogs → acceptez les autorisations (accès à Drive/Sheets).
- À la fin, récupérez l’URL dans la boîte de dialogue / journal d’exécution → ouvrez la feuille créée. La feuille est créée **privée** ; partagez-la manuellement si besoin (vos données financières ne sont pas exposées publiquement).
- Dans Google Sheets : Fichier → Télécharger → Microsoft Excel (.xlsx). Le fichier .xlsx téléchargé contiendra les 300 lignes formatées.

> Astuce : les montants sont écrits comme de **vrais nombres** (format français appliqué), donc directement triables et calculables. Les paramètres (taux, mensualité, frais, durée) sont modifiables en appelant `createEcheancier({ tauxAnnuel: 0.034, mensualite: 1000, autresFrais: 15, nbMois: 300 })`.

## Démo
<img src="./assets/images/github/demo.png" alt="demo" />

## Auteur
- [Pierre-Portfolio](https://github.com/Pierre-Portfolio/)

---

<p align="center">Projet démarré en 2026 et mis à jour régulièrement.</p>
