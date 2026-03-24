#!/bin/sh
docker rm -f soketi-local 2>/dev/null
docker run -d --name soketi-local -p 6001:6001 -e SOKETI_DEFAULT_APP_ID=signoffchat-local -e SOKETI_DEFAULT_APP_KEY=local-key -e SOKETI_DEFAULT_APP_SECRET=local-secret quay.io/soketi/soketi:latest
echo ""
sleep 2
curl http://localhost:6001/ready
echo ""
echo "Soketi is running on port 6001"
