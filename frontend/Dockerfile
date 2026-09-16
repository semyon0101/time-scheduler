FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

ENV VITE_API_URL=http://localhost:8000/api

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
