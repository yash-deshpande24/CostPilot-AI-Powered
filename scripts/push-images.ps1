cmd /c "aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 208805233492.dkr.ecr.ap-south-1.amazonaws.com"
docker network create costpilot-test
docker run -d --name mongo-test --network costpilot-test mongo:7
docker run -d --name backend-test --network costpilot-test -p 5001:5000 `
  -e PORT=5000 -e MONGO_URI=mongodb://mongo-test:27017/costpilot -e JWT_SECRET=test `
  208805233492.dkr.ecr.ap-south-1.amazonaws.com/costpilot/backend:sha-e6cd822
Start-Sleep -Seconds 5
curl.exe http://localhost:5001/health
docker logs backend-test