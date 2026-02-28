# Guide de restauration DynamoDB — Ecnelis FLY

## Ce qui est protege

| Protection | Portee | Details |
|-----------|--------|---------|
| Point-in-Time Recovery (PITR) | Toutes les tables DynamoDB | Restauration a n'importe quelle seconde des 35 derniers jours |
| Deletion Protection | Toutes les tables DynamoDB | Empeche la suppression accidentelle |
| S3 Versioning | Bucket fichiers audio/images | Anciennes versions gardees 90 jours |

> Ces protections sont actives en **production uniquement** (pas en sandbox).

---

## Scenario 1 : Restaurer des donnees supprimees ou corrompues

### Via la console AWS

1. Aller dans **AWS Console > DynamoDB > Tables**
2. Selectionner la table concernee (ex: `Sound-xxxxxxx`)
3. Onglet **Backups** > **Restore to point in time**
4. Choisir la date et l'heure AVANT l'incident
5. Nom de la table restauree : `Sound-xxxxxxx-restored` (DynamoDB ne peut pas ecraser la table originale)
6. Cliquer **Restore**
7. Attendre la fin de la restauration (quelques minutes)

### Via AWS CLI

```bash
# Lister les tables pour trouver le nom exact
aws dynamodb list-tables --region eu-west-1

# Restaurer a un instant precis (format ISO 8601)
aws dynamodb restore-table-to-point-in-time \
  --source-table-name Sound-xxxxxxx \
  --target-table-name Sound-xxxxxxx-restored \
  --restore-date-time 2026-02-28T10:30:00Z \
  --region eu-west-1

# Verifier l'etat de la restauration
aws dynamodb describe-table \
  --table-name Sound-xxxxxxx-restored \
  --region eu-west-1 \
  --query 'Table.TableStatus'
```

---

## Scenario 2 : Apres la restauration — remettre les donnees en service

La table restauree est une **copie independante**. Pour remettre les donnees en service :

### Option A : Copier les items manquants (recommande)

Si seuls quelques items ont ete supprimes/corrompus :

```bash
# Scanner la table restauree
aws dynamodb scan \
  --table-name Sound-xxxxxxx-restored \
  --region eu-west-1 \
  --output json > restored-data.json

# Re-inserer les items manquants dans la table originale
# (utiliser un script ou l'import DynamoDB)
```

### Option B : Remplacer la table entiere (cas extreme)

Si la table originale est inutilisable :

1. Supprimer la table originale (desactiver d'abord Deletion Protection)
2. Renommer n'est pas possible dans DynamoDB — il faut exporter/reimporter
3. Alternative : pointer l'application vers la table restauree en modifiant la config Amplify

> **Attention** : cette option est complexe avec Amplify Gen2 car les noms de table sont generes. Privilegier l'option A.

---

## Scenario 3 : Restaurer un fichier audio/image (S3)

Le versioning S3 est active. Pour recuperer une version anterieure :

### Via la console AWS

1. **AWS Console > S3 > ecnelisFlyStorage-xxxxx**
2. Naviguer vers le fichier (ex: `sounds/mon-fichier.wav`)
3. Activer **Show versions** (toggle en haut)
4. Selectionner la version souhaitee et **Download** ou **Restore**

### Via AWS CLI

```bash
# Lister les versions d'un fichier
aws s3api list-object-versions \
  --bucket ecnelisFlyStorage-xxxxx \
  --prefix sounds/mon-fichier.wav

# Restaurer une version specifique (la copier comme version courante)
aws s3api copy-object \
  --bucket ecnelisFlyStorage-xxxxx \
  --copy-source ecnelisFlyStorage-xxxxx/sounds/mon-fichier.wav?versionId=VERSION_ID \
  --key sounds/mon-fichier.wav
```

---

## Bonnes pratiques

- **Avant une operation risquee** (migration, import massif, suppression en lot) : noter l'heure UTC exacte. En cas de probleme, restaurer a cet instant
- **Tester la restauration** : faire un essai sur une table non critique pour se familiariser avec le processus
- **Les index GSI ne sont pas restaures automatiquement** : la table restauree les recree, mais verifier qu'ils sont actifs avant d'utiliser les donnees
- **PITR = 35 jours max** : au-dela, les donnees ne sont plus recuperables. Pour des snapshots long terme, utiliser les backups on-demand (`aws dynamodb create-backup`)
- **Cout de restauration** : la table restauree consomme du stockage DynamoDB comme une table normale. Supprimer la table `-restored` une fois les donnees recuperees

---

## Contacts et region AWS

- **Region** : verifier dans `amplify_outputs.json` (champ `aws_region`)
- **Compte AWS** : accessible via AWS Console > coin superieur droit > Account ID
