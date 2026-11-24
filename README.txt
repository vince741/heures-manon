AidePlanning 14

METTRE À JOUR EN GARDANT SES DONNÉES

1. Sur le téléphone et dans l’application actuellement utilisés, ouvrez
   Plus → Données et sauvegarde. Créez ou téléchargez la sauvegarde JSON,
   enregistrez-la dans un emplacement privé et vérifiez qu’elle s’y trouve.
2. Décompressez l’archive. Placez tous les fichiers dans le dossier publié
   du dépôt existant, au même emplacement que l’ancien index.html.
   Incluez data.js et workflows.js. Validez dans la branche déjà publiée.
3. Ouvrez l’application à son adresse habituelle avec Internet. Fermez-la
   complètement et rouvrez-la pour actualiser le cache hors ligne.
   Plus → À propos doit afficher AidePlanning 14.
4. Vérifiez quelques fiches, horaires et notes ainsi que le total d’un mois
   passé. Sur le même appareil et dans la même installation, les données
   locales existantes sont reprises à l’ouverture.

Sur un autre téléphone, ou si le planning est vide, ouvrez Plus → Données
et sauvegarde → Importer une sauvegarde JSON. Vérifiez le contenu affiché
et choisissez Ajouter les données manquantes. Les fiches et visites locales
gardent leur version. Une visite déplacée garde son identifiant et une
ancienne sauvegarde ne la recrée pas à l’ancienne date. Les interventions
déjà mises à la corbeille restent dans la corbeille lors de la fusion.

Remplacer les données actuelles restaure le contenu du fichier choisi.
Cette option demande une confirmation et conserve une copie téléchargeable
de l’état précédent. Gardez votre ancien fichier JSON jusqu’à avoir vérifié
les données. Pour tester la restauration avec de vraies données, utilisez
une installation de test distincte de l’application du quotidien.

GESTION DES VISITES

- Planning → Semaine affiche les noms, les horaires, les couleurs et les
  statuts en entier sur téléphone. La vue Mois affiche jusqu’à trois noms
  dans chaque case. Touchez la date pour voir toutes ses visites.
- Ouvrez une intervention pour modifier sa date ou son statut. Dupliquer
  préremplit le formulaire avec la semaine suivante et le statut Prévue.
- Pour une nouvelle intervention, cochez Répéter toutes les semaines et
  choisissez la date de fin. Les occurrences suivantes sont prévues.
  Les créneaux identiques déjà enregistrés pour le bénéficiaire sont
  ignorés. Chaque occurrence peut être modifiée indépendamment.
- Les alertes signalent les chevauchements entre interventions prévues ou
  réalisées, y compris lorsque la première se termine après minuit.
  Ouvrez le détail de la journée pour voir les visites concernées.

HEURES RÉALISÉES ET RELEVÉ MENSUEL

- Chaque visite a un statut Prévue, Réalisée ou Annulée. Seules les visites
  réalisées alimentent les heures travaillées et les trajets réalisés.
- À la mise à jour ou à l’import d’un ancien fichier, une visite dont
  l’heure de fin est passée est classée Réalisée par défaut. Les autres
  passent en Prévue. Vous pouvez corriger ces statuts visite par visite.
- Dans Statistiques, choisissez le mois puis ouvrez Relevé mensuel. Vous
  pouvez masquer les noms. Le relevé inclut les horaires et les totaux
  réalisés. Les notes, adresses et téléphones restent dans l’application.
  Choisissez Imprimer ou enregistrer en PDF, puis utilisez l’option PDF
  du menu d’impression de votre appareil.
- Le CSV contient les créneaux du mois et leur statut. Les colonnes Temps
  travaillé et Temps de trajet sont renseignées pour les visites réalisées.
  Pour transférer les fiches et l’historique complet, utilisez le JSON.

RÉCUPÉRATION ET SAUVEGARDE

- Une visite mise à la corbeille peut être rétablie immédiatement avec
  Annuler ou plus tard dans Plus → Données et sauvegarde → Corbeille des
  interventions. La corbeille est incluse dans le JSON.
- Archiver un bénéficiaire le retire des choix des nouvelles visites et
  conserve sa fiche et ses interventions. Pour le réactiver, ouvrez
  Bénéficiaires → Archivés → Modifier → Réactiver.
- Le planning propose un rappel après 30 jours sans export JSON connu.
  Plus tard décale le rappel de sept jours. Après l’export, gardez le
  fichier dans un emplacement privé accessible en cas de panne du téléphone.
