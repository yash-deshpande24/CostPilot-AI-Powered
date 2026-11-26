// Promotes an image that GitHub Actions already built and scanned.
// It never builds anything. It writes the new tag into gitops/envs/<env>/values.yaml and pushes to Git.
// ArgoCD then deploys that commit, and a smoke test job runs inside the cluster after the deploy.
pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 30, unit: 'MINUTES')
  }

  parameters {
    choice(name: 'ENVIRONMENT', choices: ['dev', 'prod'], description: 'Where to promote the image. prod asks for approval first.')
    string(name: 'IMAGE_TAG', defaultValue: '', description: 'Tag from GitHub Actions, for example sha-1a2b3c4')
    string(name: 'SMOKE_URL', defaultValue: '', description: 'Optional. A public address of the app to check after the push, for example https://costpilot.example.com')
  }

  environment {
    REPO_HOST_PATH = 'github.com/yash-deshpande24/CostPilot-AI-Powered.git'
    BRANCH = 'main'
  }

  stages {
    stage('Check input') {
      steps {
        script {
          if (!(params.IMAGE_TAG ==~ /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/)) {
            error("IMAGE_TAG '${params.IMAGE_TAG}' is not valid. Use the tag from the GitHub Actions summary, for example sha-1a2b3c4.")
          }
        }
      }
    }

    stage('Approval for production') {
      when { expression { params.ENVIRONMENT == 'prod' } }
      steps {
        input message: "Promote ${params.IMAGE_TAG} to PRODUCTION?", ok: 'Promote'
      }
    }

    stage('Promote') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'github-token', usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
          sh '''
            set -e
            git config user.name "costpilot-jenkins"
            git config user.email "jenkins@localhost"
            REMOTE="https://${GH_USER}:${GH_TOKEN}@${REPO_HOST_PATH}"

            # Start from the newest main, in case someone pushed while this job was waiting.
            git fetch "$REMOTE" "$BRANCH"
            git checkout -B "$BRANCH" FETCH_HEAD

            VALUES="gitops/envs/${ENVIRONMENT}/values.yaml"
            test -f "$VALUES" || { echo "Missing $VALUES"; exit 1; }
            sed -i -E "s|^([[:space:]]*tag:[[:space:]]*).*$|\\1\\"${IMAGE_TAG}\\"|" "$VALUES"
            grep -n "tag:" "$VALUES"

            git add "$VALUES"
            if git diff --cached --quiet; then
              echo "Tag is already ${IMAGE_TAG} in ${ENVIRONMENT}. Nothing to commit."
              exit 0
            fi
            git commit -m "chore(${ENVIRONMENT}): promote image ${IMAGE_TAG} [skip ci]"
            git push "$REMOTE" "HEAD:${BRANCH}"
          '''
        }
      }
    }

    stage('Smoke test from outside') {
      when { expression { params.SMOKE_URL?.trim() } }
      steps {
        sh '''
          set -e
          for i in $(seq 1 45); do
            BODY=$(curl -fsS "${SMOKE_URL}/api/health" || true)
            if echo "$BODY" | grep -q "\\"version\\":\\"${IMAGE_TAG}\\""; then
              echo "OK: $BODY"
              exit 0
            fi
            echo "Waiting for ${IMAGE_TAG} ($i/45): $BODY"
            sleep 10
          done
          echo "The new version did not appear within about 7 minutes."
          exit 1
        '''
      }
    }
  }

  post {
    success { echo "Promoted ${params.IMAGE_TAG} to ${params.ENVIRONMENT}. ArgoCD will deploy it within about 3 minutes." }
    failure { echo 'Promotion failed. Nothing was deployed.' }
  }
}
