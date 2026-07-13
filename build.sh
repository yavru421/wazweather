#!/bin/bash
echo "Installing .NET SDK 10.0..."
./dotnet-install.sh -c 10.0 -InstallDir ./dotnet
chmod -R +x ./dotnet/

echo "Publishing Blazor WebAssembly app..."
./dotnet/dotnet publish WaZWeather.csproj -c Release -o ./publish_temp

echo "Copying published Blazor assets to wwwroot..."
cp -R ./publish_temp/wwwroot/_framework ./wwwroot/
cp ./publish_temp/wwwroot/WaZWeather.styles.css ./wwwroot/ || true
cp ./publish_temp/wwwroot/index.html ./wwwroot/
cp ./publish_temp/wwwroot/service-worker-assets.js ./wwwroot/ || true

echo "Allowing Wrangler to upload compiled assets..."
sed -i '/wwwroot/d' .gitignore || true

echo "Build complete."
