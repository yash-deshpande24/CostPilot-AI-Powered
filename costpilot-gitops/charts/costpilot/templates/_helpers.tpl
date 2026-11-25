{{- define "costpilot.labels" -}}
app.kubernetes.io/part-of: costpilot
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}

{{- define "costpilot.image" -}}
{{- $registry := required "image.registry is required. Set it in gitops/envs/<env>/values.yaml" .root.Values.image.registry -}}
{{- $tag := required "image.tag is required. Run scripts/push-images.ps1 and put the tag in gitops/envs/<env>/values.yaml" .root.Values.image.tag -}}
{{- printf "%s/%s:%s" $registry .repository $tag -}}
{{- end -}}

{{- define "costpilot.env" -}}
- name: PORT
  value: {{ .Values.backend.port | quote }}
- name: COST_SOURCE
  value: {{ .Values.config.costSource | quote }}
- name: AWS_REGION
  value: {{ .Values.config.awsRegion | quote }}
- name: CACHE_HOURS
  value: {{ .Values.config.cacheHours | quote }}
- name: ANTHROPIC_MODEL
  value: {{ .Values.config.anthropicModel | quote }}
- name: AI_DAILY_LIMIT
  value: {{ .Values.config.aiDailyLimit | quote }}
- name: GITHUB_REPO
  value: {{ .Values.pr.repo | quote }}
- name: GITHUB_BASE_BRANCH
  value: {{ .Values.pr.baseBranch | quote }}
- name: PR_DIR
  value: {{ .Values.pr.dir | quote }}
- name: PR_MODE
  value: {{ .Values.pr.mode | quote }}
- name: PR_DAILY_LIMIT
  value: {{ .Values.pr.dailyLimit | quote }}
{{- end -}}

{{- define "costpilot.backendSecurity" -}}
allowPrivilegeEscalation: false
capabilities:
  drop: ["ALL"]
{{- end -}}
