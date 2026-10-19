FROM node:24-alpine

WORKDIR /app

# Dépendances d'abord (aucune ici) pour profiter du cache des couches
COPY package.json ./
COPY src ./src

ENV NODE_ENV=production \
    PORT=3000

# Exécution en utilisateur non-root
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "src/server.js"]
