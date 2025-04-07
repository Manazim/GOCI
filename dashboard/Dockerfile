FROM node:20

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Expose backend and frontend ports
EXPOSE 3000 5173

# Start both backend and frontend using concurrently
CMD ["npx", "concurrently", "npm run dev", "npm start"]
