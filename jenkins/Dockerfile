FROM jenkins/jenkins:lts-jdk21
# The plugins the Jenkinsfile needs: pipelines, git, and secret credentials.
RUN jenkins-plugin-cli --plugins workflow-aggregator git credentials-binding timestamper
