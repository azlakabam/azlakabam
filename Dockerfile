FROM denoland/deno:2.2.2 as build

WORKDIR /app

RUN apt-get update && apt-get install -y unzip

COPY . .

RUN deno task build-gameserver --target linux

FROM debian:12-slim

COPY --from=build /app/gameServer/out/linux/ .

EXPOSE 8080

ENTRYPOINT ["./splixGameServer", "--hostname", "0.0.0.0"]
