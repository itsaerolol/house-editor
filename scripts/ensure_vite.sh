#!/bin/sh
# start the preview dev server if it is not answering
if ! curl -s -o /dev/null http://127.0.0.1:5199/preview.html; then
  cd /home/claude/farmhouse-editor && (nohup npx vite --port 5199 --host 127.0.0.1 --strictPort > /tmp/vite.log 2>&1 &)
  for i in 1 2 3 4 5 6 7 8 9 10; do sleep 1; curl -s -o /dev/null http://127.0.0.1:5199/preview.html && break; done
fi
