// Jenkins pipeline for CostPilot.
//
// It does two things:
//   1. runs the same checks as GitHub Actions (tests, build, Terraform, Helm)
//   2. promotes an image tag into costpilot-gitops/envs/<env>/values.yaml and pushes the commit,
//      which is what makes ArgoCD deploy it. Jenkins never touches the cluster directly.
//
// Jenkins agent needs: git, Node.js 20, Docker, AWS CLI, Terraform, Helm.
// The ready-made image in jenkins/Dockerfile has all of them.
//
// Credentials to create in Jenkins (Manage Jenkins -> Credentials -> System -> Global):
//   github-gitops  "Username with password"  GitHub user + a fine-grained token (Contents: read/write)
//   aws-costpilot  "AWS Credentials"         access key of a user allowed to push to ECR (only for PUSH_IMAGES)
pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  parameters {
    string(
      name: 'IMAGE_TAG',
      defaultValue: '',
      description: 'Tag to promote, e.g. sha-1a2b3c4 or 20261125-101500-1a2b3c4. Copy it from the GitHub Actions run. Leave empty to build a new one.'
    )
    choice(
      name: 'TARGET_ENV',
      choices: ['dev', 'staging', 'prod'],
      description: 'Which costpilot-gitops/envs/<env>/values.yaml to change.'
    )
    booleanParam(
      name: 'PUSH_IMAGES',
      defaultValue: false,
      description: 'Build and push new images to ECR (needs the aws-costpilot credential and Docker).'
    )
  }

  environment {
    AWS_REGION = 'ap-south-1'
    GIT_REPO = 'github.com/yash-deshpande24/CostPilot-AI-Powered.git'
    TAG_FILE = '.image-tag'
  }

  stages {
    stage('Checks') {
      parallel {
        stage('Backend tests') {
          steps {
            dir('backend') {
              sh 'npm ci --no-audit --no-fund'
              sh 'npm test'
            }
          }
        }
        stage('Frontend build') {
          steps {
            dir('frontend') {
              sh 'npm ci --no-audit --no-fund'
              sh 'npm run build'
            }
          }
        }
        stage('Helm lint') {
          steps {
            sh 'helm lint costpilot-gitops/charts/costpilot -f costpilot-gitops/envs/dev/values.yaml'
          }
        }
      }
    }

    stage('Terraform validate') {
      steps {
        sh '''
          set -e
          terraform fmt -check -recursive terraform
          for d in terraform/bootstrap terraform/envs/dev terraform/github-oidc; do
            (cd "$d" && terraform init -backend=false -input=false > /dev/null && terraform validate)
          done
        '''
      }
    }

    stage('Build and push images') {
      when {
        expression { params.PUSH_IMAGES && !params.IMAGE_TAG?.trim() }
      }
      steps {
        withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-costpilot']]) {
          sh '''
            set -euo pipefail
            ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
            REGISTRY="$ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com"
            TAG="$(date -u +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)"
            aws ecr get-login-password --region "$AWS_REGION" \
              | docker login --username AWS --password-stdin "$REGISTRY"
            for name in backend frontend; do
              docker build -t "$REGISTRY/costpilot/$name:$TAG" "./$name"
              docker push "$REGISTRY/costpilot/$name:$TAG"
            done
            echo "$TAG" > "$TAG_FILE"
            echo "Built and pushed $TAG"
          '''
        }
      }
    }

    stage('Approve prod') {
      when {
        expression { params.TARGET_ENV == 'prod' }
      }
      steps {
        input message: 'Promote this tag to prod?', ok: 'Promote'
      }
    }

    stage('Promote tag') {
      when {
        expression { (params.IMAGE_TAG?.trim() || params.PUSH_IMAGES) }
      }
      steps {
        withCredentials([usernamePassword(credentialsId: 'github-gitops', usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
          sh '''
            set -euo pipefail
            CURRENT=$(git rev-parse --abbrev-ref HEAD)
            if [ "$CURRENT" != "main" ]; then
              echo "On branch $CURRENT, not main. Nothing was pushed."
              exit 0
            fi

            TAG="${IMAGE_TAG:-}"
            if [ -z "$TAG" ]; then TAG="$(cat "$TAG_FILE")"; fi

            chmod +x scripts/set-image-tag.sh
            ./scripts/set-image-tag.sh "$TAG" "$TARGET_ENV"

            git config user.email "jenkins@costpilot.local"
            git config user.name "Jenkins"
            git add "costpilot-gitops/envs/$TARGET_ENV/values.yaml"
            if git diff --cached --quiet; then
              echo "Nothing to promote: Git already has $TAG in $TARGET_ENV."
              exit 0
            fi
            git commit -m "ci: promote $TAG to $TARGET_ENV"
            git push "https://${GH_USER}:${GH_TOKEN}@${GIT_REPO}" HEAD:main
            echo "Pushed $TAG to $TARGET_ENV. ArgoCD deploys it within about 3 minutes."
          '''
        }
      }
    }
  }

  post {
    success {
      echo 'Done. Check ArgoCD: kubectl -n argocd get applications'
    }
    failure {
      echo 'Failed. Open the stage log above; the Week 6 doc has a troubleshooting table.'
    }
    always {
      cleanWs()
    }
  }
}
