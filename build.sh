#!/bin/bash
# Download the .NET SDK installation script
curl -sSL https://dot.net/v1/dotnet-install.sh > dotnet-install.sh
chmod +x dotnet-install.sh

# Install .NET SDK 10.0 locally
./dotnet-install.sh -c 10.0 -InstallDir ./dotnet


# Publish the application using the local SDK installation
./dotnet/dotnet publish -c Release -o output
