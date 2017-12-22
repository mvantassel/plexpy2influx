FROM mhart/alpine-node:base-4
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY . /usr/src/app
CMD [ "node", "app.js" ]