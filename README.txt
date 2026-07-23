AidePlanning V12 Premium

Nouveautés :
- formulaire d’avis entièrement intégré à l’application
- aucun besoin d’ouvrir Google Forms
- envoi direct vers Google Sheets avec Google Apps Script
- prénom, téléphone, e-mail et message obligatoires
- validation de l’adresse e-mail et du numéro de téléphone
- catégories : avis, bug, suggestion et contact
- note de 1 à 5 pour les avis
- option de demande de rappel pour les contacts
- informations techniques ajoutées automatiquement : version, appareil, écran et langue
- historique local des envois
- messages hors ligne conservés en attente puis renvoyés au retour de la connexion
- écran de confirmation intégré

Installation GitHub Pages :
1. Effectuer une sauvegarde JSON depuis l’ancienne version.
2. Décompresser cette archive.
3. Remplacer tous les fichiers du dépôt GitHub par ceux-ci.
4. Valider avec Commit changes.
5. Attendre quelques minutes puis ouvrir l’application avec Internet.
6. Fermer et relancer l’application pour renouveler le cache hors ligne.

Google Sheets doit comporter les colonnes dans cet ordre :
Date | Type | Note | Message | Nom | E-mail | Téléphone | Rappel | Version | Appareil

Le script Apps Script actuellement utilisé reçoit :
type, note, message, nom, email, tel, rappel, version, appareil.
IMPORTANT : ajoute data.rappel dans Apps Script si tu souhaites enregistrer la demande de rappel dans une colonne séparée.
