#!/bin/bash
dir=$(dirname $0)
docker run -d --name markdown-uml -v ${dir}:/usr/share/nginx/html -p 8080:80 hikaru/nginx