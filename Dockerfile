# Use official Node.js image as base
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port your app runs on (change if needed)
EXPOSE 5001

# Start the application: run migrations, generate Prisma client, then start app
CMD npx prisma migrate deploy && npx prisma generate && npm start

