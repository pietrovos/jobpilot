FROM node:24.21.0-bookworm-slim

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install --yes --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./
RUN npm run prisma:generate

EXPOSE 3000

CMD ["./node_modules/.bin/next", "dev", "--hostname", "0.0.0.0"]
