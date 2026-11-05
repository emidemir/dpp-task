FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Dpp.Api.csproj ./
RUN dotnet restore Dpp.Api.csproj

COPY . ./
RUN dotnet publish Dpp.Api.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish ./

RUN mkdir -p /app/data && chown "$APP_UID:$APP_UID" /app/data
ENV ASPNETCORE_HTTP_PORTS=8080

USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Dpp.Api.dll"]
