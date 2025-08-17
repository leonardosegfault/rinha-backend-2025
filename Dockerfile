FROM node:24-alpine

RUN apk add --no-cache su-exec

WORKDIR /app

COPY package*.json .

RUN npm ci --omit=dev

COPY . .

RUN chmod +x ./entrypoint.sh

EXPOSE 9999

ENTRYPOINT [ "./entrypoint.sh" ]
CMD ["npm", "start"]