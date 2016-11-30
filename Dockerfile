FROM library/node:6.9.1

MAINTAINER ContainerShip Developers <developers@containership.io>

# add code
WORKDIR /app
ADD . /app

# set default environment variables
ENV LOG_LEVEL=debug
ENV MYRIAD_MANAGEMENT_PORT=26660
ENV MYRIAD_PORT=27770
ENV MYRIAD_PUBLIC=true

# install dependencies
RUN npm install yarn -g
RUN yarn install --ignore-engines

# set command
CMD ./docker/containership.js
