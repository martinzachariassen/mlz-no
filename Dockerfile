FROM nginx:1.30-alpine

RUN rm -rf /usr/share/nginx/html/*

COPY public/ /usr/share/nginx/html/
# Drop the config in /etc/nginx/templates so the official image's
# docker-entrypoint runs envsubst on it at startup — Railway injects PORT
# and routes traffic to it, so nginx has to listen there, not on a fixed 80.
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Restrict envsubst to PORT so nginx variables ($uri, $cache_control, …) survive.
# The official entrypoint reads NGINX_ENVSUBST_FILTER as a regex over env-var names.
ENV NGINX_ENVSUBST_FILTER='^PORT$'
ENV PORT=80

EXPOSE 80
