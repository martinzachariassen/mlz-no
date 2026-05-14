FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

COPY index.html 404.html robots.txt sitemap.xml \
     favicon.svg apple-touch-icon.svg apple-touch-icon.png \
     og.svg og.png \
     /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
