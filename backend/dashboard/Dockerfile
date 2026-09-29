FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY scripts ./scripts
COPY public ./public
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/public /usr/share/nginx/html
