FROM nginx:latest
RUN set -x\
  echo "alias exit='echo Do not use command `exit` for logout operation. Use Ctrl-p,Ctrl-q.'" >> /etc/bashrc

ENTRYPOINT /usr/sbin/nginx -g 'daemon off;' -c /etc/nginx/nginx.conf

EXPOSE 80
