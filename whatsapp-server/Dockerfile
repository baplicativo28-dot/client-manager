FROM node:20-alpine

# Install git and build tools (required by Baileys)
RUN apk add --no-cache git python3 make g++

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY index.js ./

# Volume for WhatsApp auth persistence
VOLUME ["/app/auth_info"]

EXPOSE 3001

CMD ["node", "index.js"]
