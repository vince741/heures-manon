AidePlanning 13

Le planning propose une vue Mois avec le nombre de visites et jusqu’à trois
noms par jour. Touchez une journée pour voir le détail de toutes ses visites.
La vue Semaine, proposée par défaut sur téléphone, affiche chaque nom en
entier avec son horaire. Touchez une visite pour la modifier ou le bouton +
pour en saisir une à la date correspondante.

Les bénéficiaires reçoivent automatiquement une couleur. Vous pouvez la
modifier dans Bénéficiaires → Modifier → Couleur dans le planning.

METTRE À JOUR LA VERSION EXISTANTE

1. Sur le téléphone et dans l’application actuellement utilisés, ouvrez
   Plus → Données et sauvegarde → Créer une sauvegarde complète.
   Enregistrez le fichier JSON dans un emplacement privé et vérifiez que
   vous pouvez le retrouver avant de mettre l’application à jour.
2. Décompressez l’archive. Placez les fichiers du dossier extrait dans le
   dossier publié du dépôt GitHub existant, au même emplacement que
   l’ancien index.html. Incluez le nouveau fichier data.js. Si vous passez
   par GitHub, validez les modifications dans la branche déjà publiée.
3. Après la publication, ouvrez l’application à son adresse habituelle en
   étant connecté à Internet. Fermez-la complètement et rouvrez-la pour
   permettre au nouveau cache hors ligne de prendre le relais.
4. Vérifiez les bénéficiaires, quelques interventions passées et le total
   d’un mois dans Statistiques. La version se trouve dans Plus → À propos.

En réutilisant la même adresse et le même navigateur ou la même application
installée, AidePlanning reprend normalement les données locales existantes.
Si les données n’apparaissent pas, ou sur un autre téléphone ou navigateur,
reprenez le fichier JSON de l’étape 1. Gardez l’ancienne installation et sa
sauvegarde jusqu’à la vérification des données dans la nouvelle version.

IMPORTER UNE SAUVEGARDE EXISTANTE

1. Ouvrez Plus → Données et sauvegarde → Importer une sauvegarde JSON.
2. Choisissez le fichier créé par AidePlanning. Contrôlez à l’écran le
   nombre de bénéficiaires et de visites dans le fichier.
3. Choisissez Ajouter les données manquantes. Les fiches et visites déjà
   présentes gardent leur version actuelle. Réimporter le même fichier
   ne crée pas de doublons pour les fiches et visites issues de ce fichier.

Si vous souhaitez retrouver exactement le contenu d’une ancienne sauvegarde,
utilisez Remplacer les données actuelles. Après confirmation, vous pouvez
télécharger la copie d’avant remplacement depuis le même écran.

Le CSV sert à consulter les heures du mois dans un tableur. Pour transférer
les fiches et l’historique complet, utilisez le fichier JSON. L’archive du
code sert à mettre à jour l’application. Vos données sont dans l’installation
actuelle et les sauvegardes que vous créez depuis cette installation.
