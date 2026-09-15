FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 3000
# Dev server na stack local; build de produção pode ser ajustado depois.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
