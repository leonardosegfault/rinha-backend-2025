FROM node:24-alpine

WORKDIR /app

COPY package*.json .

RUN npm ci --omit=dev

COPY entrypoint.sh /usr/local/bin/

RUN chmod +x /usr/local/bin/entrypoint.sh

COPY . .

EXPOSE 9999

USER node

CMD ["/bin/sh", "entrypoint.sh"]