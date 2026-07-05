FROM node:24-alpine AS builder

WORKDIR /app

COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci

COPY apps/web/tsconfig.json apps/web/vite.config.ts apps/web/index.html ./
COPY apps/web/public/ public/
COPY apps/web/src/ src/

RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist/ /usr/share/nginx/html/
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
