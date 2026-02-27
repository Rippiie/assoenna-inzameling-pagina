FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV STATIC_DIR=/app/dist/moskee-status-page
COPY --from=build /app/dist /app/dist
COPY server /app/server
EXPOSE 3333
CMD ["node", "server/server.mjs"]
