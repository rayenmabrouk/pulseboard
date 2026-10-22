# PulseBoard

**PulseBoard — TP Déploiement Node.js / Docker / Kubernetes sur AWS**

PulseBoard est un petit tableau de bord de statut *stateless* écrit en Node.js 24,
sans aucune dépendance npm (modules natifs `http`, `os` et `fs` uniquement).
Il affiche la version de l'application, le hostname (le nom du Pod dans Kubernetes),
`NODE_ENV`, l'uptime, l'heure du serveur, la version de Node.js et un compteur de
requêtes propre à chaque instance.

Chaîne de déploiement : **Node.js → GitHub → Docker → Docker Hub → Kubernetes (k3s) sur AWS EC2 (Ubuntu 24.04)**.

## Routes

| Méthode | Route       | Description                                             |
|---------|-------------|---------------------------------------------------------|
| GET     | `/`         | Tableau de bord HTML (thème sombre, responsive)         |
| GET     | `/health`   | Statut JSON : `status`, `app`, `version`, `hostname`, `uptime` |
| GET     | `/api/info` | Toutes les informations du tableau de bord en JSON      |
| *       | autre       | `404` en JSON                                           |

## Structure du projet

```
.
├── src/
│   └── server.js        # Serveur HTTP
├── k8s/
│   ├── deployment.yaml  # Deployment (2 réplicas, probes, ressources)
│   └── service.yaml     # Service NodePort 30080
├── Dockerfile
├── .dockerignore
├── .gitignore
├── package.json
└── README.md
```

## Exécution locale

Prérequis : Node.js 24 ou plus.

```bash
npm start
```

L'application écoute sur `http://localhost:3000` (port modifiable via la variable `PORT`).

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/info
```

## Docker

Image publiée sur Docker Hub : [`rayen9/pulseboard:1.0.0`](https://hub.docker.com/r/rayen9/pulseboard).

```bash
# Construire l'image
docker build -t rayen9/pulseboard:1.0.0 .

# Lancer le conteneur
docker run -d --name pulseboard -p 3000:3000 rayen9/pulseboard:1.0.0

# Vérifier
docker ps
curl http://localhost:3000/health

# Publier sur Docker Hub
docker login
docker push rayen9/pulseboard:1.0.0
```

## Déploiement Kubernetes (k3s)

Le manifeste `k8s/deployment.yaml` utilise l'image `rayen9/pulseboard:1.0.0` publiée sur Docker Hub.

```bash
kubectl apply -f k8s/
kubectl get deploy,pods,svc
```

### Accès à l'application

```
http://<IP_PUBLIQUE_EC2>:30080
```

Rafraîchissez la page plusieurs fois : le hostname affiché change selon le pod qui répond.

### Test de haute disponibilité

```bash
# Lister les pods
kubectl get pods

# Supprimer un pod
kubectl delete pod <nom-du-pod>

# Observer la recréation automatique par le Deployment
kubectl get pods -w
```

Le Deployment recrée immédiatement un pod pour maintenir 2 réplicas ; le service
reste disponible grâce au second pod. L'application gère `SIGTERM` pour un arrêt propre.

## AWS — Security Group

Règles entrantes à autoriser sur l'instance EC2 :

| Port  | Protocole | Usage                                   |
|-------|-----------|-----------------------------------------|
| 22    | TCP       | SSH                                     |
| 3000  | TCP       | Test direct de l'application / Docker   |
| 30080 | TCP       | Service Kubernetes NodePort             |

## Licence

Distribué sous licence MIT. Voir [LICENSE](LICENSE).
